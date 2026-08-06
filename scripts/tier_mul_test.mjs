#!/usr/bin/env node
// v0.29.430 — certify the equipment TIER curves.
//
//   node scripts/tier_mul_test.mjs
//
// Two curves now exist and they must not drift into each other:
//   _TIER_MUL     — FLAT stats (atk/def/hp/mp/crit/accuracy), 1.00 .. 5.00
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
const WANT_FLAT = { 1: 2.00, 2: 2.00, 3: 2.00, 4: 2.00, 5: 2.00, 6: 2.50, 7: 3.00, 8: 3.50, 9: 4.00, 10: 5.00 };
for (const [t, want] of Object.entries(WANT_FLAT)) {
  const got = api._tierMul(Number(t));
  ok(`flat T${t} = ${want.toFixed(2)}`, Math.abs(got - want) < 1e-9, got);
}
ok('flat curve spans 2.00 .. 5.00', api._tierMul(1) === 2.00 && api._tierMul(10) === 5.00);
ok('flat curve never decreases', (() => {
  for (let t = 2; t <= 10; t++) if (api._tierMul(t) < api._tierMul(t - 1)) return false;
  return true;
})());

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
