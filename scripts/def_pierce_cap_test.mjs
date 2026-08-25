#!/usr/bin/env node
// Per user: "ensure that DEF piercing skills / boons / equipments does not
// pierce more than 75% of monster's DEF."
//
// METHOD, and why it is not the obvious one. Comparing a piercing hit's damage
// to a NON-piercing hit's damage does not work: skill tags carry their own
// multipliers (the job-talent skillDmg bonus applies to non-basic skills, the
// boss opening/stagger window applies to some, and so on), so 'siege' and
// 'melee' are not two measurements of the same thing. A first version of this
// test did exactly that and ended up PASSING against the unfixed build, which
// is the worst outcome a test can have.
//
// Instead each tag is measured against ITS OWN no-defence baseline:
//
//   scale(S) = damage(S vs target with DEF) / damage(S vs same target at DEF 0)
//            = K / (effectiveDef(S) + K)
//   pierce   = 1 - effectiveDef(siege) / effectiveDef(melee)
//
// Every tag-specific multiplier cancels inside its own ratio, so what is left
// is purely how much defence that tag faced.
//
// Two further sources of noise are pinned rather than averaged away, because
// both are large enough to swamp the signal: the per-monster defence variance
// roll (_mobDefVar, +/-18-24%), and game.comboMult, which CLIMBS across
// consecutive hits and made later measurements land harder for reasons that
// have nothing to do with pierce.
//
//   node scripts/def_pierce_cap_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'mojiworld_game.html';
const URL = 'file:///' + path.join(ROOT, FILE).split(path.sep).join('/');
const CAP = 0.75;

const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof hitMonster === 'function', { timeout: 90000 });

const out = await page.evaluate(async ({ CAP }) => {
  window._lxBootGateDone = true;
  try { const bo = document.getElementById('loading-overlay'); if (bo) bo.remove(); } catch (e) {}
  try { await Promise.race([window._lxNpcSpritesReady || Promise.resolve(), new Promise((r) => setTimeout(r, 20000))]); } catch (e) {}
  loadMap('forest');
  // Level-matched: _lvGapDefAdd bolts extra defence onto a monster that
  // out-levels you, and it lands on the base before the curve.
  player.cls = 'warrior'; player.level = 50; player._god = true; game.paused = false;

  const res = [];
  const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 150) });
  const K = 300, DMG = 200000, TYPE = 'kingKrook';

  // Measure the with-DEF and no-DEF halves on TWIN monsters spawned in the
  // SAME iteration, then hit back to back. Measuring them in separate batches
  // left per-batch drift in the ratio: the same monster read as effective DEF
  // 823 in one run and 608 in another, which is larger than the effect being
  // measured. Twins share every condition that is not the defence itself.
  const effDef = (skill) => {
    let withT = 0, noT = 0, n = 0;
    for (let i = 0; i < 8; i++) {
      for (const q of (game.monsters || [])) q.currentHp = 0;
      game.monsters.length = 0;
      try { spawnMonster(700, 300, TYPE, false, false); spawnMonster(760, 300, TYPE, false, false); } catch (e) {}
      const A = game.monsters[0], B = game.monsters[1];
      if (!A || !B) continue;
      A.maxHp = A.currentHp = 1e13; B.maxHp = B.currentHp = 1e13;
      A._defVar = 1; B._defVar = 1;
      B.def = 0;                                     // the twin with no armour
      let d1 = 0, d2 = 0;
      try { game.comboMult = 1; game.combo = 0; game.comboTimer = 0; } catch (e) {}
      { const b4 = A.currentHp; hitMonster(A, DMG, false, skill); d1 = b4 - A.currentHp; }
      try { game.comboMult = 1; game.combo = 0; game.comboTimer = 0; } catch (e) {}
      { const b4 = B.currentHp; hitMonster(B, DMG, false, skill); d2 = b4 - B.currentHp; }
      if (d1 > 0 && d2 > 0) { withT += d1; noT += d2; n++; }
    }
    if (!n) return null;
    const withDef = withT / n, noDef = noT / n;
    return { def: Math.max(0, K / (withDef / noDef) - K), withDef, noDef };
  };

  const base = effDef('melee');
  const pierced = effDef('siege');
  if (!base || !pierced) return [{ n: 'baseline measurable', pass: false, extra: JSON.stringify({ base, pierced }) }];
  const pierce = base.def > 0 ? 1 - (pierced.def / base.def) : 0;

  ok('the target really does have defence to pierce', base.def > 50,
     'effective DEF facing a normal hit: ' + Math.round(base.def));
  ok('a piercing skill leaves SOME defence standing', pierced.def > base.def * 0.10,
     'DEF facing siege: ' + Math.round(pierced.def) + ' of ' + Math.round(base.def));
  ok('effective pierce is at or under 75%', pierce <= CAP + 0.03,
     'measured ' + (pierce * 100).toFixed(1) + '%');
  ok('...and it still pierces meaningfully', pierce > 0.5,
     'measured ' + (pierce * 100).toFixed(1) + '%');

  // A boon and a gear stat stacked on top of an already-piercing skill must
  // not carry the total past the cap either.
  const origEq = window.getEquipBonus;
  player.mods = player.mods || {};
  player.mods.defPierce = 0.9;
  window.getEquipBonus = (k) => (k === 'defPierce' ? 0.9 : origEq(k));
  const stacked = effDef('siege');
  player.mods.defPierce = 0; window.getEquipBonus = origEq;
  const pierceStacked = (stacked && base.def > 0) ? 1 - (stacked.def / base.def) : 1;
  ok('skill + boon + gear stacked still cannot exceed 75%', pierceStacked <= CAP + 0.03,
     'stacked ' + (pierceStacked * 100).toFixed(1) + '%  (skill .75 + boon .9 + gear .9)');

  return res;
}, { CAP });
await browser.close();

const pad = Math.max(...out.map((r) => r.n.length));
console.log('\n  ' + FILE + '\n');
for (const r of out) console.log((r.pass ? '  PASS  ' : '  FAIL  ') + r.n.padEnd(pad) + (r.extra ? '   [' + r.extra + ']' : ''));
const bad = out.filter((r) => !r.pass).length;
console.log('\n' + (bad ? ('  ' + bad + '/' + out.length + ' FAILED') : ('  all ' + out.length + ' passed')));
process.exit(bad ? 1 : 0);
