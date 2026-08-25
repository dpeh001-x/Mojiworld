#!/usr/bin/env node
// Per user: "Ensure that for skills only higher def pierce at higher RP in a
// ramp up gradual fashion."
//
// Measures the effective pierce at each rank, using the twin-monster method
// from def_pierce_cap_test (each tag against its own no-defence baseline, on
// two monsters spawned together, with the defence-variance roll and
// game.comboMult pinned). Anything less careful reads noise as signal here.
//
//   node scripts/def_pierce_rank_ramp_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'mojiworld_game.html';
const URL = 'file:///' + path.join(ROOT, FILE).split(path.sep).join('/');

const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof hitMonster === 'function', { timeout: 90000 });

const out = await page.evaluate(async () => {
  window._lxBootGateDone = true;
  try { const bo = document.getElementById('loading-overlay'); if (bo) bo.remove(); } catch (e) {}
  try { await Promise.race([window._lxNpcSpritesReady || Promise.resolve(), new Promise((r) => setTimeout(r, 20000))]); } catch (e) {}
  loadMap('forest');
  player.cls = 'warrior'; player.level = 50; player._god = true; game.paused = false;
  player.skillRanks = player.skillRanks || {};

  const K = 300, DMG = 200000, TYPE = 'kingKrook';
  const effDef = (skill) => {
    let withT = 0, noT = 0, n = 0;
    for (let i = 0; i < 8; i++) {
      for (const q of (game.monsters || [])) q.currentHp = 0;
      game.monsters.length = 0;
      try { spawnMonster(700, 300, TYPE, false, false); spawnMonster(760, 300, TYPE, false, false); } catch (e) {}
      const A = game.monsters[0], B = game.monsters[1];
      if (!A || !B) continue;
      A.maxHp = A.currentHp = 1e13; B.maxHp = B.currentHp = 1e13;
      A._defVar = 1; B._defVar = 1; B.def = 0;
      let d1 = 0, d2 = 0;
      try { game.comboMult = 1; game.combo = 0; game.comboTimer = 0; } catch (e) {}
      { const b4 = A.currentHp; hitMonster(A, DMG, false, skill); d1 = b4 - A.currentHp; }
      try { game.comboMult = 1; game.combo = 0; game.comboTimer = 0; } catch (e) {}
      { const b4 = B.currentHp; hitMonster(B, DMG, false, skill); d2 = b4 - B.currentHp; }
      if (d1 > 0 && d2 > 0) { withT += d1; noT += d2; n++; }
    }
    if (!n) return null;
    return Math.max(0, K / ((withT / n) / (noT / n)) - K);
  };

  const base = effDef('melee');
  const rows = [];
  for (const r of [0, 2, 5, 8, 10]) {
    player.skillRanks.ballista_volley = r;
    const d = effDef('siege');
    rows.push({ rank: r, pierce: base > 0 && d != null ? 1 - d / base : null, def: d });
  }
  player.skillRanks.ballista_volley = 0;
  return { base, rows };
});
await browser.close();

console.log('\n  ' + FILE + '   effective DEF facing a normal hit: ' + Math.round(out.base) + '\n');
console.log('  ' + 'RP rank'.padStart(8) + 'DEF faced'.padStart(12) + 'pierce'.padStart(10));
for (const r of out.rows) {
  console.log('  ' + String(r.rank).padStart(8) + String(Math.round(r.def)).padStart(12) +
              ((r.pierce * 100).toFixed(1) + '%').padStart(10));
}
const fails = [];
const p = out.rows.map((r) => r.pierce);
if (!(p[0] < 0.30)) fails.push('rank 0 pierce is ' + (p[0] * 100).toFixed(1) + '%, expected well under 30%');
if (!(p[p.length - 1] > 0.65 && p[p.length - 1] <= 0.78)) fails.push('rank 10 pierce is ' + (p[p.length - 1] * 100).toFixed(1) + '%, expected ~75%');
for (let i = 1; i < p.length; i++) if (!(p[i] > p[i - 1] - 0.03)) fails.push('pierce fell from rank ' + out.rows[i - 1].rank + ' to ' + out.rows[i].rank);
if (!(p[p.length - 1] - p[0] > 0.35)) fails.push('the ramp is too flat to be a ramp');
console.log('');
if (fails.length) { for (const f of fails) console.error('  FAIL  ' + f); process.exit(1); }
console.log('  PASS — pierce climbs gradually with RP and tops out at the 75% cap.');
