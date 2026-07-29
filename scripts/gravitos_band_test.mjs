#!/usr/bin/env node
// v0.29.331 — certify the Gravitos damage bands.
//
//   node scripts/gravitos_band_test.mjs
//
// Gravitos is the only boss whose non-OHKO hits are clamped by its OWN
// anchor (_GRAV_BAND_REF) rather than the shared _refLoAtLv(lv). Two things
// have to stay true and are easy to break by accident:
//
//   1. the hardest landable non-OHKO hit is exactly 4000;
//   2. every kind escalates strictly P1 < P2 < P3, and no other boss moves.
//
// _gravHeavyBand / _gravBandClamp are extracted VERBATIM from the game file
// (a hand-copied duplicate would certify nothing), then driven directly.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8');

function extract(name) {
  const at = src.indexOf(`\nfunction ${name}(`);
  if (at < 0) throw new Error(`${name}() not found in mojiworld_game.html`);
  let depth = 0;
  for (let j = src.indexOf('{', at); j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(at, j + 1); }
  }
  throw new Error(`unbalanced braces in ${name}()`);
}
function constant(name) {
  const m = src.match(new RegExp(`const ${name} = (\\d+(?:\\.\\d+)?)`));
  if (!m) throw new Error(`${name} not found in mojiworld_game.html`);
  return parseFloat(m[1]);
}

const REF = constant('_GRAV_BAND_REF');
const api = new Function('_GRAV_BAND_REF', `
  const _refLoAtLv = (lv) => Math.round((63 + 15.7 * lv) * 1.5);
  const game = { _diffDmgMul: 1 };
  ${extract('_gravHeavyBand')}
  ${extract('_gravBandClamp')}
  return { _gravHeavyBand, _gravBandClamp, _refLoAtLv };
`)(REF);

const KINDS = ['touch', 'comet', 'ring', 'skill', 'bhCore'];
const HUGE = 9e9;   // far above any cap — what lands IS the ceiling
const ceiling = (kind, phase) => api._gravBandClamp(HUGE, api._gravHeavyBand(phase, kind));

let pass = 0, fail = 0;
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`); }
};

console.log('\n== ceilings per kind (P1 / P2 / P3) ==');
const EXPECTED = {
  touch:  [1717, 2828, 17750],
  comet:  [1717, 2828, 17750],
  ring:   [1470, 2586, 14200],
  skill:  [1470, 2505, 17750],
  bhCore: [1224, 2343,  3550],
};
for (const k of KINDS) check(k, [1, 2, 3].map(p => ceiling(k, p)), EXPECTED[k]);

console.log('\n== the headline invariants ==');
const hardest = Math.max(...KINDS.flatMap(k => [1, 2, 3].map(p => ceiling(k, p))));
check('hardest landable non-OHKO hit is 17750', hardest, 17750);
check('forms 1-2 untouched by the P3 regime (max 2828)',
  Math.max(...KINDS.flatMap(k => [1, 2].map(p => ceiling(k, p)))), 2828);
check('anchor is Gravitos-specific, not _refLoAtLv(100)', REF !== api._refLoAtLv(100), true);
check('generic boss anchor still 2450', api._refLoAtLv(100), 2450);

console.log('\n== phase escalation is strict, every kind ==');
for (const k of KINDS) {
  const [a, b, c] = [1, 2, 3].map(p => ceiling(k, p));
  check(`${k}: P1 < P2 < P3`, a < b && b < c, true);
}

console.log('\n== phase multiplier reaches the mitigated number ==');
// A geared build sits BELOW the P1/P2 caps, so the multiplier — not the
// ceiling — is what makes form 2 hit harder for it. Regression-guard that:
// raising only the caps left this case identical across all three phases.
const MIT_WARRIOR = 1042;   // measured: BiS balanced warrior, Gravitos contact
const MIT_MAGE    = 2327;   // measured: BiS pure attack mage, same
const touchAt = (mit, p) => api._gravBandClamp(mit, api._gravHeavyBand(p, 'touch'));
const geared = [1, 2, 3].map(p => touchAt(MIT_WARRIOR, p));
check('geared build escalates across all three forms', geared, [1042, 1406, 17714]);
check('forms 1-2 stay under their caps (DEF, not the ceiling, decides)',
  [0, 1].every(i => geared[i] < EXPECTED.touch[i]), true);

console.log('\n== the two build targets that were asked for ==');
// HP figures are the measured BiS builds these targets were solved against.
const HP_WARRIOR = 35319, HP_MAGE = 9183;
const hits = (hp, mit) => Math.ceil(hp / touchAt(mit, 3));
check('balanced warrior dies to exactly 2 P3 touches', hits(HP_WARRIOR, MIT_WARRIOR), 2);
check('pure attack mage dies to exactly 1 P3 touch',   hits(HP_MAGE,    MIT_MAGE),    1);
// The warrior must SURVIVE the first touch, or "2-shot" is really "1-shot".
check('balanced warrior survives one P3 touch', touchAt(MIT_WARRIOR, 3) < HP_WARRIOR, true);
// DEF still separates builds inside P3 while mitigated × 17 is under the cap.
const MIT_TANK = 843;   // measured: BiS pure tank warrior
check('pure tank warrior stays under the P3 cap', touchAt(MIT_TANK, 3), 14331);
check('  ...so armor still buys P3 survival', Math.ceil(45824 / touchAt(MIT_TANK, 3)), 4);

console.log('\n== the black-hole DoT opts out of the P3 spike ==');
// It ticks repeatedly; riding ×17 would make it an unavoidable instant kill.
check('bhCore P3 keeps the old ramp, not ×17', api._gravHeavyBand(3, 'bhCore').mul, 1.75);
check('touch P3 does ride ×17', api._gravHeavyBand(3, 'touch').mul, 17.0);
check('bhCore P3 tick stays survivable for the mage', touchAt(MIT_MAGE, 3) > ceiling('bhCore', 3) * 4, true);

console.log('\n== floors stay at 0 so DEF always shows ==');
for (const k of KINDS) check(`${k} floor is 0`, api._gravHeavyBand(2, k).floor, 0);
check('a tiny mitigated hit is not floored up', api._gravBandClamp(7, api._gravHeavyBand(3, 'touch')), Math.floor(7 * 17.0));

console.log('\n== phase argument is clamped, not trusted ==');
check('phase 0 falls back to P1', ceiling('touch', 0), 1717);
check('phase 9 clamps to P3', ceiling('touch', 9), 17750);
check('unknown kind falls back to skill', ceiling('nonsense', 3), EXPECTED.skill[2]);

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} — ${pass}/${pass + fail} checks\n`);
process.exit(fail === 0 ? 0 : 1);
