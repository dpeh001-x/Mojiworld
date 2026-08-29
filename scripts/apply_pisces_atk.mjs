// v0.30.297 — "Make pisces boss atk 2x higher" (per user).
// data/monster_stats.js is the live source of truth (_lxApplyStatTable applies
// it verbatim at spawn). exp/coin derive from HP in this file's own boss rule,
// not from atk, so the reward line is deliberately untouched.
// Pisces keeps the v0.30.280 floors: HP 19.39M, DEF 1200.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/data/monster_stats.js';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('atk:70278')) { console.log('already applied'); process.exit(0); }
const OLD = 'zodiac_pisces:                  { lv: 92, hp: 19392000, atk:35139, def:1200,';
const NEW = 'zodiac_pisces:                  { lv: 92, hp: 19392000, atk:70278, def:1200,';
const c = s.split(OLD).length - 1;
if (c !== 1) { console.error(`ABORT: pisces row matched ${c}, expected 1`); process.exit(1); }
s = s.split(OLD).join(NEW);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 15000) { console.error('ABORT: tmp small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: zodiac_pisces atk 35139 -> 70278 (2x)`);
