#!/usr/bin/env node
// v0.29.430 — certify the equipment TIER curves.
//
//   node scripts/tier_mul_test.mjs
//
// Two curves now exist and they must not drift into each other:
//   _TIER_MUL     — FLAT stats (atk/def/hp/mp/crit/accuracy); since v0.30.1596 a calibration to weapon ATK targets (it peaks at T5)
//   _TIER_PCT_MUL — percentage family, marginal, 1.00 .. 1.25
// Both tables and both accessors are extracted VERBATIM from
// mojiworld_game.html (a hand-copied duplicate would certify nothing — that is
// exactly how the tier badge went stale) and then driven directly.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8');

function grab(name) {
  const m = src.match(new RegExp(`const ${name} = \\[[^\\]]*\\];`));
  if (!m) throw new Error(`${name} table not found`);
  return m[0];
}
function grabFn(name) {
  const at = src.indexOf(`\nfunction ${name}(`);
  if (at < 0) throw new Error(`${name}() not found`);
  let depth = 0;
  for (let j = src.indexOf('{', at); j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(at, j + 1); }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

const api = new Function(`
  ${grab('_TIER_MUL')}
  ${grab('_TIER_PCT_MUL')}
  ${grabFn('_tierMul')}
  ${grabFn('_tierPctMul')}
  return { _TIER_MUL, _TIER_PCT_MUL, _tierMul, _tierPctMul };
`)();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra });

// --- flat curve, exactly as specified -------------------------------------
// v0.30.1589 (per user: "The jump between the equipment tier stats are way too steep, make T1-T3 gear stronger, T4-T5
// slightly stronger, Nerf T9 and T10 down"): T1 +70%, T2 +50%, T3 +35%, T4-T5 +15%, T6-T8 as they were, T9 -12.5%, T10 -20%.
// v0.30.1596 (per user: "T2 needs to start at typical weapon ATK of around 50, T3 at 100, T4-5 around 200-300, T6-8 around 400-600")
const WANT_FLAT = { 1: 3.40, 2: 4.20, 3: 4.90, 4: 5.60, 5: 6.40, 6: 6.20, 7: 4.80, 8: 3.95, 9: 3.50, 10: 4.00 };
for (const [t, want] of Object.entries(WANT_FLAT)) {
  const got = api._tierMul(Number(t));
  ok(`flat T${t} = ${want.toFixed(2)}`, Math.abs(got - want) < 1e-9, got);
}
// v0.30.1589 - the complaint itself, measured on the item pool: the median weapon ATK a tier pays (base x _TIER_MUL x the
// weapon's 0.85). Before: 14 24 41 75 71 196 334 536 952 1828 - steps up to x2.74, 130x from T1 to T10.
const POOL = (() => {
  const BS = String.fromCharCode(92), at = src.indexOf('const ITEM_POOL = {');
  let i = src.indexOf('{', at), d = 0, j = i;
  for (; j < src.length; j++) {
    const c = src[j];
    if (c === '{') d++;
    else if (c === '}') { d--; if (!d) break; }
    else if (c === "'" || c === '"' || c === '`') { const q = c; j++; while (j < src.length && src[j] !== q) { if (src[j] === BS) j++; j++; } }
    else if (c === '/' && src[j + 1] === '/') { while (src[j] !== '\n') j++; }
  }
  return Function('return ' + src.slice(i, j + 1))();
})();
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const atkAt = (t) => med(POOL.weapons.filter((b) => (b.tier | 0) === t && b.atk).map((b) => b.atk * api._tierMul(t) * 0.85));
const jumps = []; for (let t = 2; t <= 10; t++) jumps.push(+(atkAt(t) / atkAt(t - 1)).toFixed(2));
ok('no tier-to-tier step in weapon ATK is steeper than x2.5 (it reached x2.74)', Math.max(...jumps) <= 2.5, jumps.join(' '));
ok('T1 to T10 spans at most 70x (it spanned 130x)', atkAt(10) / atkAt(1) <= 70, (atkAt(10) / atkAt(1)).toFixed(1) + 'x');
// v0.30.1596 - the user's targets for the typical weapon ATK a tier pays, and every armour stat still rising tier over tier
// (one multiplier per tier scales every slot, so the calibration has to hold both)
const inR = (v, lo, hi) => v >= lo && v <= hi;
ok('typical weapon ATK: T2 ~50, T3 ~100, T4-T5 200-300, T6-T8 400-600, then T9 and T10 above', inR(atkAt(2), 45, 55) && inR(atkAt(3), 90, 110)
  && inR(atkAt(4), 190, 310) && inR(atkAt(5), 190, 310) && [6, 7, 8].every((t) => inR(atkAt(t), 380, 620)) && atkAt(9) > atkAt(8) && atkAt(10) > atkAt(9),
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((t) => Math.round(atkAt(t))).join(' '));
const armAt = (t, k) => med(POOL.armors.filter((b) => (b.tier | 0) === t && b[k]).map((b) => b[k] * api._tierMul(t) * 1.15));
ok('armour DEF and HP still rise at every tier', [2, 3, 4, 5, 6, 7, 8, 9, 10].every((t) => armAt(t, 'def') >= armAt(t - 1, 'def') && armAt(t, 'hp') >= armAt(t - 1, 'hp')),
  ['def', 'hp'].map((k) => k + ' ' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((t) => Math.round(armAt(t, k))).join(' ')).join(' | '));

// --- pct curve: marginal, and strictly gentler than the flat curve ---------
const WANT_PCT = { 1: 1.00, 5: 1.00, 6: 1.05, 7: 1.10, 8: 1.15, 9: 1.20, 10: 1.25 };
for (const [t, want] of Object.entries(WANT_PCT)) {
  const got = api._tierPctMul(Number(t));
  ok(`pct T${t} = ${want.toFixed(2)}`, Math.abs(got - want) < 1e-9, got);
}
ok('pct curve never decreases', (() => {
  for (let t = 2; t <= 10; t++) if (api._tierPctMul(t) < api._tierPctMul(t - 1)) return false;
  return true;
})());
ok('pct stays MARGINAL vs flat at every tier', (() => {
  for (let t = 1; t <= 10; t++) if (api._tierPctMul(t) >= api._tierMul(t)) return false;
  return true;
})());
ok('pct tops out at +25% (a modifier, not a second flat curve)', api._tierPctMul(10) === 1.25);

// --- accessor hygiene ------------------------------------------------------
ok('tier 0 / undefined coerces to T1', api._tierMul(0) === api._tierMul(1) && api._tierMul(undefined) === api._tierMul(1));
ok('above-max tier clamps to T10', api._tierMul(99) === api._tierMul(10) && api._tierPctMul(99) === api._tierPctMul(10));
ok('no table entry is 0 / NaN', api._TIER_MUL.every((v) => v > 0) && api._TIER_PCT_MUL.every((v) => v > 0));
ok('both tables are the same length', api._TIER_MUL.length === api._TIER_PCT_MUL.length);

// --- the badge must read the real function, not a copy ---------------------
ok('tier badge no longer hard-codes its own multiplier table',
  !/const _muls = \[1\.00, 1\.00/.test(src));

// --- flat-stat membership --------------------------------------------------
const flatSet = src.match(/const _TIER_FLAT_STATS = new Set\(\[([\s\S]*?)\]\)/);
ok('_TIER_FLAT_STATS covers atk/def/hp/mp/crit', flatSet &&
  ['atk', 'def', 'hp', 'mp', 'crit'].every((k) => flatSet[1].includes(`'${k}'`)), flatSet && flatSet[1].trim());

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.pass ? '' : '  got=' + JSON.stringify(r.extra)}`); }
console.log(`\n${res.length - bad}/${res.length} checks passed`);
process.exit(bad ? 1 : 0);
