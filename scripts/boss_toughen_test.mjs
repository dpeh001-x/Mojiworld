// BARNABY + SUNDERED SMITH: tougher, more frequent 70% waves, real shoves.
// ============================================================================
// Per user: "Barnabyand sundered smith is way too easy too, make them tougher
// with occasional 70% max HP damage", then "make their powerful attacks more
// frequent" and "make them do large knockbacks that push the player more".
//
// The 70% wave rides each boss's existing pillar attack (Barnaby's Fire
// Pillars at 55%, the Smith's Forge Pillars at 60%): ~40% of waves roll the
// empowered variant, announced by its own name. Both waves now stamp a
// knockback strength the hazard resolver turns into a real launch away from
// the pillar's centre. Asserted deterministically by forcing the arm timers
// and pinning Math.random, then reading the REAL hazards the wave pushed; the
// shove is proven live by standing in a pillar and sampling player velocity.
// Run: node scripts/boss_toughen_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9967);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const EXE = [process.env.PW_EXE, process.env.MOJI_PW_EXE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({
  channel: EXE ? undefined : 'msedge', executablePath: EXE || undefined,
  headless: true, args: ['--no-sandbox', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`,
  { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof spawnMonster === 'function', null, { timeout: 180000 });
await page.waitForTimeout(7000);
await page.evaluate(() => { window._lxBootGateDone = true; window._prologueActive = false; });
await page.fill('#hero-name-input', 'BossTough').catch(() => {});
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  if (!m) return;
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 200) });

const stats = await page.evaluate(() => ({
  barn: { hp: monsterTypes.young_confused_barnaby.hp, atk: monsterTypes.young_confused_barnaby.atk, def: monsterTypes.young_confused_barnaby.def },
  smith: { hp: monsterTypes.sundered_smith.hp, atk: monsterTypes.sundered_smith.atk, def: monsterTypes.sundered_smith.def },
}));
ok('Barnaby is tougher: HP 2.2M, ATK 290, DEF 190 (was 1.6M/225/76)',
  stats.barn.hp === 2200000 && stats.barn.atk === 290 && stats.barn.def === 190, JSON.stringify(stats.barn));
ok('the Smith is tougher: HP 2.6M, ATK 350, DEF 210 (was 1.8M/275/63)',
  stats.smith.hp === 2600000 && stats.smith.atk === 350 && stats.smith.def === 210, JSON.stringify(stats.smith));

// ---- deterministic wave inspection ------------------------------------------
const waves = await page.evaluate(async () => {
  loadMap('forest', 300);
  await new Promise((r) => setTimeout(r, 1500));
  game.paused = false;
  player.level = 60; player._god = true;
  // the wave formula is max(pct x maxHp, atk x N): on a fresh character's
  // ~300 HP the ATK side wins and the % is invisible — a first draft asserted
  // percentages against it and read 3400%. Give the fixture a real HP pool so
  // the % side is the max, which is the live case for any levelled player.
  player.maxHp = 500000; player.hp = getMaxHp();
  const armAndCatch = (type, armField, roll) => {
    game.monsters = []; game.hazards.length = 0;
    spawnMonster(player.x + 500, player.y, type, true);
    const b = game.monsters[game.monsters.length - 1];
    b.currentHp = b.maxHp;
    if (type === 'sundered_smith') { b._smithHeat = 'quenched'; b._smithHeatAt = game.time + 9999; b._smithTollAt = game.time + 9999; }
    b[armField] = game.time;                   // arm NOW
    const rnd = Math.random; Math.random = () => roll;
    for (let i = 0; i < 6 && !game.hazards.length; i++) { game.time++; try { updateMonsters(16); } catch (e) {} }
    Math.random = rnd;
    const h = game.hazards.find((x) => x && x.type === 'meteor_warn' && x.owner === 'enemy');
    const out = h ? { dmg: h.damage, kb: h._kb | 0, label: h._sourceLabel, n: game.hazards.length } : null;
    game.hazards.length = 0; game.monsters = [];
    return out;
  };
  const maxHp = getMaxHp();
  return {
    maxHp,
    barnWrath: armAndCatch('young_confused_barnaby', '_barnPillarsAt', 0.1),
    barnNorm: armAndCatch('young_confused_barnaby', '_barnPillarsAt', 0.9),
    smithRuin: armAndCatch('sundered_smith', '_smithPillarsAt', 0.1),
    smithNorm: armAndCatch('sundered_smith', '_smithPillarsAt', 0.9),
    barnRearm: (() => {  // re-arm cadence, read straight off the boss
      game.monsters = []; game.hazards.length = 0;
      spawnMonster(player.x + 500, player.y, 'young_confused_barnaby', true);
      const b = game.monsters[game.monsters.length - 1];
      b._barnPillarsAt = game.time;
      const t0 = game.time;
      for (let i = 0; i < 6 && !game.hazards.length; i++) { game.time++; try { updateMonsters(16); } catch (e) {} }
      const dt = b._barnPillarsAt - t0;
      game.hazards.length = 0; game.monsters = [];
      return dt;
    })(),
  };
});
const pct = (d) => d && (d.dmg / waves.maxHp);
ok("Barnaby's wrath wave deals 70% of max HP and shoves at 15",
  waves.barnWrath && Math.abs(pct(waves.barnWrath) - 0.70) < 0.01 && waves.barnWrath.kb === 15
  && /Wrath/.test(waves.barnWrath.label),
  JSON.stringify(waves.barnWrath) + ` (maxHp ${waves.maxHp})`);
ok("Barnaby's ordinary wave stays at 55%, and still shoves",
  waves.barnNorm && Math.abs(pct(waves.barnNorm) - 0.55) < 0.01 && waves.barnNorm.kb === 15,
  JSON.stringify(waves.barnNorm));
ok("the Smith's ruin wave deals 70% and shoves at 18",
  waves.smithRuin && Math.abs(pct(waves.smithRuin) - 0.70) < 0.01 && waves.smithRuin.kb === 18
  && /Ruin/.test(waves.smithRuin.label),
  JSON.stringify(waves.smithRuin));
ok("the Smith's ordinary wave stays at 60%",
  waves.smithNorm && Math.abs(pct(waves.smithNorm) - 0.60) < 0.01, JSON.stringify(waves.smithNorm));
ok('Barnaby re-arms in 720 frames (was 1080) — more frequent, as asked',
  waves.barnRearm === 721 || waves.barnRearm === 720 || (waves.barnRearm > 715 && waves.barnRearm < 730),
  `re-arm delta ${waves.barnRearm}`);

// ---- the shove, live --------------------------------------------------------
const shove = await page.evaluate(async () => {
  game.monsters = []; game.hazards.length = 0;
  player._god = false; player.hp = getMaxHp(); player.invulnerable = 0;
  // a hand-planted pillar directly on the player, kb-stamped like the bosses'
  game.hazards.push({ type: 'meteor_warn', cx: player.x + player.w / 2,
    x: player.x - 40, y: 0, w: 80, h: 720, radius: 60, life: 2, maxLife: 2, fireAt: 2,
    owner: 'enemy', damage: 100, color: '#ff4411', _sourceLabel: 'test pillar', _pctCap: true, _kb: 18 });
  let maxVx = 0, lifted = false;
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => requestAnimationFrame(r));
    maxVx = Math.max(maxVx, Math.abs(player.vx || 0));
    if ((player.vy || 0) < -4) lifted = true;
    if (!game.hazards.length && i > 20) break;
  }
  const out = { maxVx: +maxVx.toFixed(1), lifted, hpLost: getMaxHp() - player.hp };
  player._god = true; player.hp = getMaxHp();
  return out;
});
ok('standing in a kb pillar launches the player hard (|vx| >= 12, real lift)',
  shove.maxVx >= 12 && shove.lifted, JSON.stringify(shove));
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' · '));

await browser.close(); server.kill();
let fail = 0;
for (const r of res) { if (!r.pass) fail++; console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra ? '  — ' + r.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
