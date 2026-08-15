// Equipment is harder to come by, measured by actually killing and opening.
// Per user: "make it even harder to gain equipments from chest and drops."
//
// Drives the REAL killMonster and openChest paths thousands of times and
// counts equipment, rather than asserting on the constants - so the numbers
// below are observed rates, not arithmetic.
// Run: node scripts/drop_rate_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9236;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

const out = await page.evaluate(async () => {
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  for (const id of ['class-select-modal', 'advancement-modal', 'tutorial-modal'])
    { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = 'warrior'; player.level = 40; player.hp = 9e6; player.maxHp = 9e6;
  player.luck = 0; player._god = true; game.paused = false;
  loadMap('forest', 300);
  await new Promise(r => setTimeout(r, 400));

  // ── CHESTS: open N of each grade through the real openChest ──────────────
  const chestRate = {};
  for (const tier of ['wood', 'silver', 'gold']) {
    let gear = 0; const N = 4000;
    for (let i = 0; i < N; i++) {
      const before = player.inventory.length;
      const dropsBefore = game.drops.length;
      const c = { x: 400, y: 400, w: 24, h: 20, tier, opened: false };
      try { openChest(c); } catch (e) {}
      // gear lands either in the bag or (bag full) on the ground
      const gotItem = player.inventory.length > before
        || game.drops.slice(dropsBefore).some(d => d && d.type === 'item');
      if (gotItem) gear++;
      // keep the bag from filling and changing the path
      player.inventory.length = before;
      game.drops.length = dropsBefore;
    }
    chestRate[tier] = +(100 * gear / N).toFixed(1);
  }

  // ── KILLS: run the real killMonster for normal and elite mobs ────────────
  // The tier flag is m.isElite (NOT m.elite - setting the wrong field makes
  // an "elite" cohort silently measure the tier-0 rate). Normal sits near
  // 0.05%, so it needs a large N to be measurable at all: 200k trials give
  // ~100 expected hits, ~10% relative error.
  const killRate = {}, killHits = {};
  const template = spawnMonster(600, 400, 'slime', false, false);
  for (const [label, N] of [['normal', 200000], ['elite', 40000]]) {
    let gear = 0;
    for (let i = 0; i < N; i++) {
      const m = { ...template, isElite: label === 'elite', isMiniBoss: false, isBoss: false,
                  x: 600, y: 400, currentHp: 0, _dying: false };
      // killMonster returns early unless the monster is IN game.monsters
      // (`indexOf(m) < 0` guard) - it splices it out itself.
      game.monsters.push(m);
      const dropsBefore = game.drops.length;
      try { killMonster(m); } catch (e) {}
      if (game.drops.length > dropsBefore
          && game.drops.slice(dropsBefore).some(d => d && d.type === 'item')) gear++;
      game.drops.length = dropsBefore;
    }
    killHits[label] = gear;
    killRate[label] = +(100 * gear / N).toFixed(3);
  }
  return { chestRate, killRate, killHits,
           bossBonusIntact: /_bossBonusDrops = 1 \+ Math\.floor\(Math\.random\(\) \* 2\)/.test(killMonster.toString()) };
});

console.log('  observed chest gear rates:', JSON.stringify(out.chestRate));
console.log('  observed kill gear rates :', JSON.stringify(out.killRate), 'hits:', JSON.stringify(out.killHits));

// Chests: each grade must land near its new target, and well under the old one.
ok('wood chests give equipment ~22% of the time (was 40%)',
   out.chestRate.wood >= 18 && out.chestRate.wood <= 26, `${out.chestRate.wood}%`);
ok('silver chests give equipment ~30% of the time (was 50%)',
   out.chestRate.silver >= 26 && out.chestRate.silver <= 34, `${out.chestRate.silver}%`);
ok('gold chests give equipment ~55% of the time (was 80%)',
   out.chestRate.gold >= 50 && out.chestRate.gold <= 60, `${out.chestRate.gold}%`);
ok('chest generosity still rises with grade',
   out.chestRate.wood < out.chestRate.silver && out.chestRate.silver < out.chestRate.gold);

// Kills: normal and elite both drop, at the new lower rates.
// Band chosen to DISCRIMINATE: 200k trials put the new rate at ~0.048% (+/-10%
// at ~96 hits) and the old one at ~0.079%, so [0.030, 0.065] separates them
// rather than passing on either build.
ok('a normal kill drops equipment ~0.05% of the time (was 0.084%)',
   out.killRate.normal >= 0.030 && out.killRate.normal <= 0.065, `${out.killRate.normal}%`);
ok('an elite kill drops equipment ~0.9% of the time (was 1.5%)',
   out.killRate.elite >= 0.6 && out.killRate.elite <= 1.2, `${out.killRate.elite}%`);
ok('elites still out-drop normal kills by a wide margin',
   out.killRate.elite > out.killRate.normal * 5, `elite ${out.killRate.elite}% vs normal ${out.killRate.normal}%`);
ok('a boss still keeps its guaranteed 1-2 bonus drops (out of scope, unchanged)',
   out.bossBonusIntact);

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
