// UNDEAD — three of them, and they hunt the whole map instead of orbiting you.
// ============================================================================
// Per user: "reduce the number of undead summoned from 5 to 3 instead, for
// these undeads make their AI smart to roam and search for monsters to kill
// throughout the map".
//
// The count is a constant. The hunting was not a tuning problem: updateMinions
// carried a HARD RECALL
//
//     if (!mn.mojimon && (Math.abs(player.x - mn.x) > 1000 || ...)) { mn.x = player.x ... }
//
// that teleports a minion back to the player past 1000px, so no undead could
// ever reach anything further away — it was snapped home mid-walk, every time.
// That recall exists for real reasons (v0.29.690: a player teleport left the
// pack 2618px behind, and a minion nudged into a pit fell 3246px and kept
// falling), so it is NOT deleted here. It is split: travel that is deliberate
// pursuit is allowed out to the hunt range, while falling, being stranded by a
// player teleport, and making no progress still recall instantly.
//
// The prey gate had the same shape — foes were only prey within 700px OF THE
// PLAYER — so even with the recall lifted they had no reason to set off.
//
// Test C is the positive control: it drops a minion into a pit and asserts it
// still comes home. Without it, "they roam further" would also pass for a
// build that simply deleted the safety net.
// Run: node scripts/undead_hunt_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9957);
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
await page.fill('#hero-name-input', 'Necro');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*mage\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => { player.level = 99; player._god = true; loadMap('forest', 300); });
await page.waitForTimeout(4000);

const R = await page.evaluate(async () => {
  game.paused = false;
  for (let i = 0; i < 12; i++) { const r = (typeof _lxPadModalRoot === 'function') && _lxPadModalRoot(); if (!r) break; r.style.display = 'none'; }
  const frame = () => new Promise(r => requestAnimationFrame(r));
  const out = {};

  // ---- A. how many does one cast raise? --------------------------------
  game.minions = [];
  SKILL_FNS.darkPulse();
  out.raised = game.minions.filter(m => !m.mojimon).length;
  out.kinds = [...new Set(game.minions.map(m => m.type))].sort();

  // ---- B. do they travel to prey across the map? -----------------------
  game.minions = []; game.monsters.length = 0;
  const px = player.x, py = player.y;
  const FAR = 1700;                                  // well past the 1000px recall
  const prey = spawnMonster(px + FAR, py, 'horny', false);
  prey.atk = 0; prey.maxHp = 40000; prey.currentHp = 40000;
  const preyHp0 = prey.currentHp;
  for (let i = 0; i < 3; i++) raiseMinion(px + 40 + i * 30, py, i % 2 ? 'zombie' : 'skeleton', 999000);
  let maxReach = 0, recalls = 0;
  const prevX = new Map();
  // WALL CLOCK, not a frame count. requestAnimationFrame fires at ~174/s in
  // this harness while the game's own loop runs at 60 — so "60 * 22 frames"
  // bought 7.6 s of hunting, not 22, and the first read of this test
  // under-reported how far the pack gets before the recall grabs it.
  const _t0 = performance.now();
  while (performance.now() - _t0 < 25000) {
    player.x = px; player.y = py;                     // the master stands still
    player.hp = getMaxHp(); player.invulnerable = 400;
    prey.x = px + FAR; prey.aggroTarget = null;       // and the prey holds its ground
    await frame();
    for (const mn of game.minions) {
      if (mn.mojimon) continue;
      const d = mn.x - player.x;
      if (d > maxReach) maxReach = d;
      const was = prevX.get(mn);
      if (was != null && was - (mn.x - player.x) > 400) recalls++;   // snapped home
      prevX.set(mn, mn.x - player.x);
    }
    if (prey.currentHp <= 0) break;
  }
  out.maxReach = Math.round(maxReach);
  out.preyDmg = Math.round(preyHp0 - prey.currentHp);
  out.recalls = recalls;
  out.alive = game.minions.filter(m => !m.mojimon).length;

  // ---- C. CONTROL: a minion in a pit still comes home -------------------
  game.minions = []; game.monsters.length = 0;
  raiseMinion(px + 40, py, 'skeleton', 999000);
  const pitted = game.minions[0];
  pitted.spawn = 0;
  pitted.y = py + 3000;                               // fell down a hole
  const _p0 = performance.now();
  while (performance.now() - _p0 < 1500) { player.x = px; player.y = py; await frame(); }
  out.pitRescued = Math.abs(pitted.y - py) < 700;
  out.pitDy = Math.round(pitted.y - py);

  // ---- D. CONTROL: the MojiMon companion is NOT a hunter ----------------
  // It shares every line changed here, so widening the undead's leash could
  // silently send someone's pet marching across the map. Each use is gated on
  // !mn.mojimon; this proves the gate rather than trusting it.
  game.minions = []; game.monsters.length = 0;
  const pet = spawnMonster(px + 1700, py, 'horny', false);
  pet.atk = 0; pet.maxHp = 40000; pet.currentHp = 40000;
  raiseMinion(px + 40, py, 'skeleton', 999000);
  const companion = game.minions[0];
  companion.mojimon = true;                          // wear the pet's gating flag
  companion.spawn = 0;
  let petReach = 0;
  const _c0 = performance.now();
  while (performance.now() - _c0 < 12000) {
    player.x = px; player.y = py; player.hp = getMaxHp(); player.invulnerable = 400;
    pet.x = px + 1700; pet.aggroTarget = null;
    try { await frame(); } catch (e) { out.petErr = String(e).slice(0, 80); break; }
    petReach = Math.max(petReach, companion.x - px);
  }
  out.petReach = Math.round(petReach);

  return out;
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 200) });

console.log(`  one Dark Pulse cast raised ${R.raised} undead (${R.kinds.join(' + ')})`);
console.log(`  hunt: reached ${R.maxReach}px of a 1700px walk, dealt ${R.preyDmg} to the far prey, ${R.recalls} snap-backs`);
console.log(`  pit control: minion ended ${R.pitDy}px below the player`);

ok('a Dark Pulse cast raises exactly 3 undead', R.raised === 3, `raised ${R.raised}`);
ok('both kinds still appear in the raise', R.kinds.length === 2, R.kinds.join(' + '));
ok('the pack travels past the old 1000px recall to reach prey', R.maxReach > 1200,
   `furthest ${R.maxReach}px (the recall used to snap them home at 1000)`);
ok('...and actually reaches and hurts prey across the map', R.preyDmg > 0,
   `${R.preyDmg} damage dealt to a foe 1700px away`);
ok('no minion is snapped home while legitimately pursuing', R.recalls === 0,
   `${R.recalls} snap-backs during the hunt`);
ok('CONTROL: the pack survived the trip (not culled)', R.alive === 3, `${R.alive}/3 alive`);
ok('CONTROL: a minion that falls into a pit is still rescued', R.pitRescued,
   `ended ${R.pitDy}px below — the safety net is split, not deleted`);
ok('CONTROL: the MojiMon companion stays leashed, it did not become a hunter', R.petReach < 1100,
   `pet reached ${R.petReach}px toward the same 1700px prey${R.petErr ? ' — err ' + R.petErr : ''}`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
