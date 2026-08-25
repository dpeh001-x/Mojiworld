#!/usr/bin/env node
// Per user: "lets do a linear increase in difficulty so lower level maps
// receive less of a bump up, but higher level monsters especially after 40
// receive a higher gradual linear bump (increase raw DEF and HP more than ATK
// in proportion)."
//
// WHY THE NUMBERS ARE BAKED INTO THE TABLE rather than applied at spawn:
// data/monster_stats.js opens by promising "Every number here is the ACTUAL
// stat a monster spawns with in game... Nothing is scaled behind your back -
// no level curve, no per-map factor, no universal multiplier." A runtime ramp
// would make that header a lie and every future balance read misleading. So the
// ramp is applied ONCE, here, and what you read in the table stays what you
// fight.
//
// THE RAMP is piecewise linear with the knee at 40, which is what "especially
// after 40" asks for - the slope above 40 is twice the slope below it:
//
//   lv <= 10        untouched (x1.00)  - starter maps are not the complaint
//   lv 10 -> 40     gentle
//   lv 40 -> 100    twice as steep
//
//            @10     @40     @70     @100
//   DEF     1.00    1.60    2.80    4.00     <- largest, per "DEF and HP more"
//   HP      1.00    1.35    2.05    2.75
//   ATK     1.00    1.12    1.36    1.60     <- smallest, "more than ATK"
//
// EXP and COIN are RECOMPUTED from the new HP, preserving the ratio each entry
// already has (the table header documents exp = hp x0.02 for regular monsters
// and x0.055 for bosses; 134 of 135 entries match one of those to within 6%).
// Holding them fixed instead would have quietly cut XP per kill by the whole HP
// multiplier. Note the consequence that remains: kills take longer by the DEF
// factor as well, which EXP does not track, so XP per SECOND does fall.
//
//   node scripts/gen_monster_difficulty_ramp.mjs            # rewrite the table
//   node scripts/gen_monster_difficulty_ramp.mjs --dry      # print, change nothing
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'monster_stats.js');
const DRY = process.argv.includes('--dry');

// Piecewise-linear multiplier: 1.0 at or below KNEE_LO, `mid` at KNEE_HI,
// then continuing on a steeper slope to `top` at 100.
const KNEE_LO = 10, KNEE_HI = 40, TOP = 100;
const ramp = (lv, mid, top) => {
  if (lv <= KNEE_LO) return 1;
  if (lv <= KNEE_HI) return 1 + (mid - 1) * (lv - KNEE_LO) / (KNEE_HI - KNEE_LO);
  return mid + (top - mid) * Math.min(1, (lv - KNEE_HI) / (TOP - KNEE_HI));
};
const defMul = (lv) => ramp(lv, 1.60, 4.00);
const hpMul  = (lv) => ramp(lv, 1.35, 2.75);
const atkMul = (lv) => ramp(lv, 1.12, 1.60);

const src = readFileSync(FILE, 'utf8');
// One entry per line:  name: { lv: N, hp: N, atk: N, def: N, exp: N, coin: N },
const LINE = /^(\s*[A-Za-z_][A-Za-z0-9_]*\s*:\s*\{\s*lv:\s*)(\d+)(,\s*hp:\s*)(\d+)(,\s*atk:\s*)(\d+)(,\s*def:\s*)(\d+)(,\s*exp:\s*)(\d+)(,\s*coin:\s*)(\d+)(\s*\},?\s*)$/;

// Keep the column alignment the file is written in: pad the new number back to
// the width the old one occupied wherever it still fits.
const fit = (numStr, oldStr) => (numStr.length >= oldStr.length ? numStr : ' '.repeat(oldStr.length - numStr.length) + numStr);

let changed = 0, skipped = 0;
const report = [];
const outLines = src.split('\n').map((line) => {
  const m = line.match(LINE);
  if (!m) { return line; }
  const [, p1, lvS, p2, hpS, p3, atkS, p4, defS, p5, expS, p6, coinS, p7] = m;
  const lv = +lvS, hp = +hpS, atk = +atkS, def = +defS, exp = +expS, coin = +coinS;
  if (lv <= KNEE_LO) { skipped++; return line; }

  const expPerHp = hp > 0 ? exp / hp : 0;
  const coinPerHp = hp > 0 ? coin / hp : 0;
  const nHp = Math.max(1, Math.round(hp * hpMul(lv)));
  const nAtk = Math.max(0, Math.round(atk * atkMul(lv)));
  const nDef = Math.max(0, Math.round(def * defMul(lv)));
  // Preserve each entry's OWN exp/coin ratio rather than assuming the boss or
  // regular constant - petalfly does not match either, and guessing would have
  // silently retuned its reward.
  const nExp = Math.max(1, Math.round(nHp * expPerHp));
  const nCoin = Math.max(0, Math.round(nHp * coinPerHp));

  changed++;
  if (report.length < 14 || lv >= 40) {
    report.push({ lv, name: line.trim().split(':')[0].trim(),
                  hp, nHp, atk, nAtk, def, nDef, exp, nExp });
  }
  return p1 + lvS + p2 + fit(String(nHp), hpS) + p3 + fit(String(nAtk), atkS) +
         p4 + fit(String(nDef), defS) + p5 + fit(String(nExp), expS) +
         p6 + fit(String(nCoin), coinS) + p7;
});

console.log('\n  ramp: DEF x' + defMul(40).toFixed(2) + ' @40, x' + defMul(50).toFixed(2) +
            ' @50, x' + defMul(100).toFixed(2) + ' @100');
console.log('        HP  x' + hpMul(40).toFixed(2) + ' @40, x' + hpMul(50).toFixed(2) +
            ' @50, x' + hpMul(100).toFixed(2) + ' @100');
console.log('        ATK x' + atkMul(40).toFixed(2) + ' @40, x' + atkMul(50).toFixed(2) +
            ' @50, x' + atkMul(100).toFixed(2) + ' @100\n');
console.log('  ' + 'monster'.padEnd(26) + 'lv'.padStart(4) + '   hp'.padStart(22) + '   atk'.padStart(14) + '   def'.padStart(12));
for (const r of report.filter((x) => x.lv >= 40).slice(0, 16)) {
  console.log('  ' + r.name.padEnd(26) + String(r.lv).padStart(4) +
    (r.hp.toLocaleString() + ' -> ' + r.nHp.toLocaleString()).padStart(22) +
    (r.atk + ' -> ' + r.nAtk).padStart(14) + (r.def + ' -> ' + r.nDef).padStart(12));
}
console.log('\n  rewritten: ' + changed + '   left alone (lv <= ' + KNEE_LO + '): ' + skipped);

if (DRY) { console.log('  --dry: nothing written.'); }
else {
  writeFileSync(FILE + '.tmp', outLines.join('\n'), 'utf8');
  renameSync(FILE + '.tmp', FILE);
  console.log('  wrote ' + FILE);
}
