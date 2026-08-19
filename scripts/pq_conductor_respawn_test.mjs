// MASTER CONDUCTOR — arena must go quiet once the duel is won.
// ============================================================================
// Reported: "master conductor still spawns enemies after i killed him."
//
// Two causes:
//   1. The respawn drip in killMonster is gated on
//      `!isTown && !isBossArena && !_expeditionMap`. clockworkExpress declares
//      isTower / isCarriage but NOT isBossArena, so the Stage-4 arena refilled
//      like an ordinary field map — and at monsterCap 18 / respawnDelayMul 0.50
//      it refilled fast, forever, with the boss already dead.
//   2. The Conductor's `_pqSummoned` reinforcements were never cleared, so the
//      adds he called in the last seconds of the duel kept fighting afterwards.
//
// The drip is driven by setTimeout, NOT by frames, so these checks wait in real
// time rather than stepping the loop — stepping frames would measure nothing
// and pass on both builds.
//
// The third case is the important one: respawning must still work while he is
// ALIVE (the adds are part of the fight) and on ordinary maps. A fix that just
// switched respawning off everywhere would pass the first two.
// Run: node scripts/pq_conductor_respawn_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9335;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'PQTest');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const enterArena = () => page.evaluate(async () => {
  player.level = 60; player._god = true;
  player._pqFinaleBossPending = true;         // the gate Milo's warp sets
  loadMap('clockworkExpress', 300);
  await new Promise(r => setTimeout(r, 2000));
  game.paused = false;
  return !!game.monsters.find(m => m && m.type === 'pqConductor');
});
const clearField = (keepBoss) => page.evaluate((keep) => {
  for (const m of game.monsters.slice()) {
    if (!m || m.currentHp <= 0) continue;
    if (keep && m.type === 'pqConductor') continue;
    m.currentHp = 0; try { killMonster(m); } catch (e) {}
  }
  game.monsters = game.monsters.filter(m => m && m.currentHp > 0);
  return game.monsters.length;
}, keepBoss);
const alive = () => page.evaluate(() => game.monsters.filter(m => m && m.currentHp > 0).length);

// ---- CASE A: boss alive — the arena MUST still feed the fight ------------
const spawnedA = await enterArena();
await clearField(true);                       // clear the mechs, leave him up
await page.waitForTimeout(6000);
const aliveWhileBossUp = await alive();

// ---- CASE B: his summons must not outlive him ---------------------------
const addsAfterDeath = await page.evaluate(async () => {
  const boss = game.monsters.find(m => m && m.type === 'pqConductor');
  if (!boss) return { noBoss: true };
  // stand in two live reinforcements, exactly as the summon pattern tags them
  for (let i = -1; i <= 1; i += 2) {
    spawnMonster(boss.x + i * 90, boss.y + 40, 'ticketMech', false);
    const add = game.monsters[game.monsters.length - 1];
    if (add) { add._pqSummoned = true; add.currentHp = add.maxHp || 100; }
  }
  const before = game.monsters.filter(m => m && m._pqSummoned && m.currentHp > 0).length;
  // He carries revivesOnce{hpPct:0.25}: the first killMonster() returns early
  // and brings him back at 25% HP. A player has to kill him twice, so the test
  // does too — killing once measures a revive, not a death.
  boss.currentHp = 0; try { killMonster(boss); } catch (e) {}
  await new Promise(r => setTimeout(r, 200));
  const revived = boss.currentHp > 0;
  if (revived) { boss.currentHp = 0; try { killMonster(boss); } catch (e) {} }
  await new Promise(r => setTimeout(r, 250));
  const after = game.monsters.filter(m => m && m._pqSummoned && m.currentHp > 0).length;
  return { before, after, revived, bossHp: boss.currentHp };
});

// ---- CASE C: boss dead — the arena MUST go quiet ------------------------
// Respawn timers queued while he was still alive are legitimately in flight;
// let them drain before clearing, or this races them and the count is noise.
await page.waitForTimeout(2500);
await clearField(false);
await page.waitForTimeout(6000);
const aliveAfterBossDead = await alive();

// ---- CASE D: an ordinary field map must still respawn -------------------
const fieldRespawn = await page.evaluate(async () => {
  loadMap('forest', 300);
  await new Promise(r => setTimeout(r, 1600));
  game.paused = false;
  for (const m of game.monsters.slice()) {
    if (m && m.currentHp > 0) { m.currentHp = 0; try { killMonster(m); } catch (e) {} }
  }
  game.monsters = game.monsters.filter(m => m && m.currentHp > 0);
  return game.monsters.length;
});
await page.waitForTimeout(6000);
const fieldAlive = await alive();
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 125) });

ok('the Conductor spawns in his arena', spawnedA);
ok('while he is ALIVE the arena still feeds the fight', aliveWhileBossUp > 0,
   `alive after 6s with boss up = ${aliveWhileBossUp}`);
ok('his reinforcements do not outlive him',
   !addsAfterDeath.noBoss && addsAfterDeath.before > 0 && addsAfterDeath.after === 0,
   `summoned ${addsAfterDeath.before} -> ${addsAfterDeath.after} alive; revivedFirst=${addsAfterDeath.revived}`);
ok('once he is dead the arena stops refilling', aliveAfterBossDead === 0,
   `alive 6s after the duel ended = ${aliveAfterBossDead}`);
ok('ordinary field maps still respawn (fix is not a blanket off-switch)',
   fieldAlive > 0, `forest cleared to ${fieldRespawn}, alive after 6s = ${fieldAlive}`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
