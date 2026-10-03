#!/usr/bin/env node
// v0.29.430 — certify the equipment TIER curves.
//
//   node scripts/tier_mul_test.mjs
//
// The rows must not drift into each other:
//   _TIER_MUL      — FLAT stats (atk/def/hp/mp/crit) of every piece but a weapon's ATK; the v0.30.1589 row (again since v0.30.1599)
//   _TIER_WATK_MUL — a weapon's ATK (since v0.30.1599), calibrated to the user's weapon ATK targets on the BAKED catalog ATK
//   _TIER_ACC_MUL  — accuracy (Shardsight vs the zodiac's evasion)
//   _TIER_PCT_MUL  — percentage family, marginal, 1.00 .. 1.25
// Every table and accessor, and the boot-time weapon bake, is extracted VERBATIM from mojiworld_game.html (a hand-copied
// duplicate would certify nothing — that is exactly how the tier badge went stale) and then driven directly.
// v0.30.1596 measured its weapon targets on the ITEM_POOL literals and missed by 2-5x: _bakeWeaponTierAtk multiplies every
// catalog weapon's ATK by x2.0 (T1) .. x5.0 (T10) at boot. This test runs that bake on the pool before it measures anything.

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
function balanced(at) {
  let depth = 0;
  for (let j = src.indexOf('{', at); j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return j + 1; }
  }
  throw new Error('unbalanced braces at ' + at);
}
function grabFn(name) {
  const at = src.indexOf(`\nfunction ${name}(`);
  if (at < 0) throw new Error(`${name}() not found`);
  return src.slice(at, balanced(at));
}
const BAKE = (() => {
  const at = src.indexOf('(function _bakeWeaponTierAtk() {');
  if (at < 0) throw new Error('_bakeWeaponTierAtk not found');
  const end = balanced(at);
  if (src.slice(end, end + 4) !== ')();') throw new Error('_bakeWeaponTierAtk is not an IIFE any more');
  return src.slice(at, end + 4);
})();
const WEAPON_ATK = Number((src.match(/const LX_WEAPON_ATK_MUL = ([\d.]+);/) || [])[1]);
const ARMOR_ROLE = Function('return ' + (src.match(/const LX_ARMOR_ROLE = (\{[^}]*\});/) || [])[1])();

const api = new Function(`
  ${grab('_TIER_MUL')}
  ${grab('_TIER_ACC_MUL')}
  ${grab('_TIER_WATK_MUL')}
  ${grab('_TIER_PCT_MUL')}
  ${grabFn('_tierMul')}
  ${grabFn('_tierAccMul')}
  ${grabFn('_tierPctMul')}
  ${grabFn('_tierStatMul')}
  ${grabFn('_lxWeaponBakeMul')}
  return { _TIER_MUL, _TIER_ACC_MUL, _TIER_WATK_MUL, _TIER_PCT_MUL, _tierMul, _tierAccMul, _tierPctMul, _tierStatMul, _lxWeaponBakeMul };
`)();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra });
const T = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const rowIs = (fn, want) => T.every((t, i) => Math.abs(fn(t) - want[i]) < 1e-9);

// --- the rows, exactly as specified ---------------------------------------
// v0.30.1589 (per user: "The jump between the equipment tier stats are way too steep, make T1-T3 gear stronger, T4-T5
// slightly stronger, Nerf T9 and T10 down"): T1 +70%, T2 +50%, T3 +35%, T4-T5 +15%, T6-T8 as they were, T9 -12.5%, T10 -20%.
// v0.30.1599: back on that row after v0.30.1596's mis-measured calibration lifted armour with the weapons.
const WANT_FLAT = [3.40, 3.00, 2.70, 2.30, 2.30, 2.50, 3.00, 3.50, 3.50, 4.00];
ok('flat row = the v0.30.1589 row', rowIs(api._tierMul, WANT_FLAT), T.map(api._tierMul).join(' '));
ok('accuracy row = the row Shardsight was balanced on', rowIs(api._tierAccMul, WANT_FLAT), api._TIER_ACC_MUL.join(' '));
const WANT_WATK = [2.21, 1.78, 1.84, 1.87, 2.10, 1.47, 1.15, 0.90, 0.68, 0.55];
ok('weapon ATK row as calibrated', rowIs((t) => api._tierStatMul({ tier: t, slot: 'weapon' }, 'atk'), WANT_WATK), api._TIER_WATK_MUL.join(' '));

// --- the routing: one function answers for every stat of every piece --------
const sm = (tier, slot, k) => api._tierStatMul({ tier, slot }, k);
ok('a weapon\'s ATK reads the weapon row, from the slot argument or the piece\'s own slot',
  sm(8, 'weapon', 'atk') === 0.90 && api._tierStatMul({ tier: 8 }, 'atk', 'weapon') === 0.90);
ok('a weapon\'s other flat stats read the shared row', ['def', 'hp', 'mp', 'crit'].every((k) => sm(8, 'weapon', k) === api._tierMul(8)));
ok('armour and accessory ATK read the shared row', sm(8, 'armor', 'atk') === api._tierMul(8) && sm(8, 'accessory', 'atk') === api._tierMul(8));
ok('accuracy reads its own row in every slot', ['weapon', 'armor', 'accessory'].every((s) => sm(7, s, 'accuracy') === api._tierAccMul(7)));
ok('the Whittled Stick (T0, never baked) stays on the shared row', sm(0, 'weapon', 'atk') === api._tierMul(0) && api._lxWeaponBakeMul(0) === 1);
ok('the bake factor: T1 x2, T10 x5, nothing below T1', api._lxWeaponBakeMul(1) === 2 && api._lxWeaponBakeMul(10) === 5 && api._lxWeaponBakeMul(0) === 1,
  [0, 1, 5, 10].map(api._lxWeaponBakeMul).join(' '));

// --- the targets, measured on the item pool AFTER the game's own bake ---------
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
const lit = POOL.weapons.map((w) => w.atk);
new Function('ITEM_POOL', '_lxWeaponBakeMul', BAKE)(POOL, api._lxWeaponBakeMul);
ok('the bake ran on the pool (a T10 weapon carries 5x its literal ATK)', POOL.weapons.some((w, i) => (w.tier | 0) === 10 && w.atk === Math.round(lit[i] * 5)));
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const atkAt = (t) => med(POOL.weapons.filter((b) => (b.tier | 0) === t && b.atk).map((b) => b.atk * api._tierStatMul({ tier: t, slot: 'weapon' }, 'atk') * WEAPON_ATK));
const A = T.map((t) => Math.round(atkAt(t)));
const inR = (v, lo, hi) => v >= lo && v <= hi;
// per user: "T2 needs to start at typical weapon ATK of around 50, T3 at 100, T4-5 around 200-300, T6-8 around 400-600",
// then "T9 750, T 10 1000"; T1 sits at about 30 below them
ok('typical weapon ATK: T1 ~30, T2 ~50, T3 ~100, T4-T5 200-300, T6-T8 400-600, T9 ~750, T10 ~1000', inR(A[0], 27, 33) && inR(A[1], 45, 55)
  && inR(A[2], 90, 110) && inR(A[3], 200, 300) && inR(A[4], 200, 300) && [5, 6, 7].every((i) => inR(A[i], 400, 600))
  && inR(A[8], 700, 800) && inR(A[9], 950, 1050), A.join(' '));
ok('typical weapon ATK rises at every tier', A.every((v, i) => !i || v > A[i - 1]), A.join(' '));
const jumps = A.slice(1).map((v, i) => +(v / A[i]).toFixed(2));
ok('no tier-to-tier step in weapon ATK is steeper than x2.5 (it reached x3.0 before v0.30.1589)', Math.max(...jumps) <= 2.5, jumps.join(' '));
ok('T1 to T10 spans at most 70x (it spanned 340x before v0.30.1589)', A[9] / A[0] <= 70, (A[9] / A[0]).toFixed(1) + 'x');
const armAt = (t, k) => med(POOL.armors.filter((b) => (b.tier | 0) === t && b[k]).map((b) => b[k] * api._tierStatMul({ tier: t, slot: 'armor' }, k) * ARMOR_ROLE[k]));
ok('armour DEF and HP rise at every tier', [2, 3, 4, 5, 6, 7, 8, 9, 10].every((t) => armAt(t, 'def') >= armAt(t - 1, 'def') && armAt(t, 'hp') >= armAt(t - 1, 'hp')),
  ['def', 'hp'].map((k) => k + ' ' + T.map((t) => Math.round(armAt(t, k))).join(' ')).join(' | '));

// --- pct curve: marginal, and strictly gentler than the flat curve ---------
const WANT_PCT = { 1: 1.00, 5: 1.00, 6: 1.05, 7: 1.10, 8: 1.15, 9: 1.20, 10: 1.25 };
for (const [t, want] of Object.entries(WANT_PCT)) {
  const got = api._tierPctMul(Number(t));
  ok(`pct T${t} = ${want.toFixed(2)}`, Math.abs(got - want) < 1e-9, got);
}
ok('pct curve never decreases', T.every((t) => t === 1 || api._tierPctMul(t) >= api._tierPctMul(t - 1)));
ok('pct stays MARGINAL vs flat at every tier', T.every((t) => api._tierPctMul(t) < api._tierMul(t)));
ok('pct tops out at +25% (a modifier, not a second flat curve)', api._tierPctMul(10) === 1.25);

// --- accessor hygiene ------------------------------------------------------
ok('tier 0 / undefined coerces to T1', api._tierMul(0) === api._tierMul(1) && api._tierMul(undefined) === api._tierMul(1));
ok('above-max tier clamps to T10', api._tierMul(99) === api._tierMul(10) && api._tierPctMul(99) === api._tierPctMul(10) && sm(99, 'weapon', 'atk') === sm(10, 'weapon', 'atk'));
ok('no table entry is 0 / NaN', [api._TIER_MUL, api._TIER_ACC_MUL, api._TIER_WATK_MUL, api._TIER_PCT_MUL].every((r) => r.every((v) => v > 0)));
ok('all four tables are the same length', [api._TIER_ACC_MUL, api._TIER_WATK_MUL, api._TIER_PCT_MUL].every((r) => r.length === api._TIER_MUL.length));

// --- every reader asks _tierStatMul, so the card, the score, the forge and the compare show what is paid ---
const READERS = { 'getEquipBonus': '_tierStatMul(it, k, slot)', 'the item card': "_tierStatMul(it, 'atk', it.slot)", 'the forge': '_tierStatMul(it, k, it.slot)',
  'the compare rows': '_tierStatMul(x, k, x.slot)', 'the tier badge': "_tierStatMul(it, 'atk', 'weapon')" };
ok('getEquipBonus, the item card, itemScore, the forge, the compare rows and the tier badge read _tierStatMul',
  Object.values(READERS).every((s) => src.includes(s)) && src.split("_tierStatMul(it, 'atk', it.slot)").length - 1 >= 2,
  Object.entries(READERS).filter(([, s]) => !src.includes(s)).map(([w]) => w).join(', '));

// --- the badge must read the real function, not a copy ---------------------
ok('tier badge no longer hard-codes its own multiplier table', !/const _muls = \[1\.00, 1\.00/.test(src));

// --- flat-stat membership --------------------------------------------------
const flatSet = src.match(/const _TIER_FLAT_STATS = new Set\(\[([\s\S]*?)\]\)/);
ok('_TIER_FLAT_STATS covers atk/def/hp/mp/crit', flatSet &&
  ['atk', 'def', 'hp', 'mp', 'crit'].every((k) => flatSet[1].includes(`'${k}'`)), flatSet && flatSet[1].trim());

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.pass ? '' : '  got=' + JSON.stringify(r.extra)}`); }
console.log(`\n${res.length - bad}/${res.length} checks passed`);
process.exit(bad ? 1 : 0);
