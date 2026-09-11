#!/usr/bin/env node
// SMOOTH THE REGULAR-MONSTER HP CURVE THROUGH LV 36-64 (per user, after the kills-per-level audit:
// "why is there an anomaly between level 40-50, and then becomes much easier from level 55 ... adjust
// the monster stats and exp accordingly").
//
// THE PROBLEM, measured on the roster as it stood: the median regular-monster HP climbs steadily to
// Lv 35 (5.6k), then creeps 6k -> 12k across Lv 40-51 while every level's EXP cost doubles every
// five levels, then jumps to 77k-152k at Lv 56-62. EXP and coin are derived from HP (x0.02 / x0.075),
// so the same shape showed up as a kill-count wall at Lv 40-50 (38k -> 108k kills a level) followed
// by a cliff to 30k at Lv 55 - and as a fight-length cliff: Lv 40-51 mobs were paper next to their
// level, Lv 56-62 mobs sponges.
//
// THE FIX: one geometric HP trend from Lv 35 to Lv 65, both ends pinned to the roster's own trend
// there, so nothing outside the band moves and the band joins its neighbours without a seam. Every
// row in the band is multiplied by (new trend / old trend) at its level, which keeps each monster's
// identity - a mob that was 2x its neighbours stays 2x, a mini-elite or pirate captain stays an elite.
// EXP and COIN scale by the same factor (the table's documented rule: both follow HP). ATK and DEF
// are NOT touched: contact damage is normalised against the hardcoded _MOB_MED_ATK table in the game,
// and moving the roster's ATK would desynchronise it.
//
// Bosses (the "---- Bosses ----" section), tower-run monsters, boss adds (octoLeg*) and anything
// outside Lv 36-64 keep their numbers exactly.
//
//   node scripts/smooth_mob_hp_curve.mjs --dry     # print before/after, change nothing
//   node scripts/smooth_mob_hp_curve.mjs           # rewrite data/monster_stats.js (atomic)
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'monster_stats.js');
const DRY = process.argv.includes('--dry');
const LO = 35, HI = 65;          // pinned ends of the new trend (not themselves rescaled)
const EXCLUDE = /^(tower|octoLeg|zodiac_)/;

const src = readFileSync(FILE, 'utf8');
// Refuse to smooth twice: a second pass would rescale an already-smoothed band against its own trend.
if (src.includes('scripts/smooth_mob_hp_curve.mjs') && !process.argv.includes('--force')) {
  console.log('already smoothed (the table carries this script\'s note) - nothing to do; --force to re-run');
  process.exit(0);
}
const ctx = { window: {} }; vm.runInNewContext(src, ctx);
const T = ctx.window.LX_MONSTER_STATS;
const iReg = src.indexOf('// ---- Regular monsters ----'), iBoss = src.indexOf('// ---- Bosses ----');
if (iReg < 0 || iBoss < 0 || iBoss < iReg) throw new Error('section markers not found');
const regularSection = src.slice(iReg, iBoss);
const inRegular = new Set([...regularSection.matchAll(/^\s{2}([A-Za-z_0-9]+):\s*\{\s*lv:/gm)].map((m) => m[1]));
const regular = Object.keys(T).filter((k) => inRegular.has(k) && !EXCLUDE.test(k) && T[k].exp > 0);

// The old trend: median HP of the ordinary field (heavies/elites carry the same factor but do not
// set the trend - their HP is several times the field's and would drag the median), +-4 levels,
// then a 3-point moving average in log space so a thin level does not jerk the factor.
const ELITE = /^(smithgolem|blightElder|ossuaryTyrant|tombKeeper|pathsBane|young_bloodthirsty_vermillion|graveReaver|echoKnight|drownedCur|bonebosn|spectreCannoneer|brinekraken|vigil_vermillion|thornmaw)$/;
const field = regular.filter((k) => !ELITE.test(k));
const med = (a) => { a = [...a].sort((x, y) => x - y); return a.length % 2 ? a[(a.length - 1) / 2] : Math.sqrt(a[a.length / 2 - 1] * a[a.length / 2]); };
const raw = {};
for (let L = LO - 6; L <= HI + 6; L++) {
  const c = field.filter((k) => Math.abs(T[k].lv - L) <= 4).map((k) => T[k].hp);
  if (c.length) raw[L] = Math.log(med(c));
}
const trendOld = {};
for (let L = LO; L <= HI; L++) {
  const v = [raw[L - 1], raw[L], raw[L + 1]].filter((x) => x != null);
  trendOld[L] = Math.exp(v.reduce((s, x) => s + x, 0) / v.length);
}
const g = Math.pow(trendOld[HI] / trendOld[LO], 1 / (HI - LO));
const trendNew = (L) => trendOld[LO] * Math.pow(g, L - LO);
// Lv 66-TOP (per user, "same goes for level 80"): the roster sags again above Lv 75 (boneWraith, the
// ordinary Lv 79 monster, has 165k HP against 270k at Lv 76), so the same growth CONTINUES from the
// Lv 65 pin. One-sided - there is no regular monster above Lv 79 to pin a far end to.
const TOP = 80;
for (let L = HI + 1; L <= TOP; L++) {
  const c = field.filter((k) => Math.abs(T[k].lv - L) <= 4).map((k) => T[k].hp);
  if (c.length) raw[L] = Math.log(med(c));
}
for (let L = HI + 1; L <= TOP; L++) {
  const v = [raw[L - 1], raw[L], raw[L + 1]].filter((x) => x != null);
  trendOld[L] = Math.exp(v.reduce((s, x) => s + x, 0) / v.length);
}
const factor = (L) => (L <= LO || L > TOP || L === HI) ? 1 : trendNew(L) / trendOld[L];
// Elites / heavies keep their numbers by default: they already sit well above the field, and scaling
// them ate into the bosses' "8x the band's strongest monster" floor (scripts/boss_floor_test.mjs).
const SCALE_ELITES = process.argv.includes('--scale-elites');

// Rewrite the rows in place: only hp / exp / coin numbers change, widths are kept.
const lines = src.split(/\r?\n/);
const NL = src.includes('\r\n') ? '\r\n' : '\n';
const changes = [];
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^(\s{2})([A-Za-z_0-9]+)(:\s*\{\s*lv:\s*)(\d+)(,\s*hp:\s*)(\d+)(.*?exp:\s*)(\d+)(,\s*coin:\s*)(\d+)(.*)$/);
  if (!m) continue;
  const k = m[2]; if (!regular.includes(k)) continue;
  if (!SCALE_ELITES && ELITE.test(k)) continue;
  const lv = +m[4], f = factor(lv); if (Math.abs(f - 1) < 0.005) continue;
  const hp0 = +m[6], exp0 = +m[8], coin0 = +m[10];
  const hp1 = Math.max(1, Math.round(hp0 * f)), exp1 = Math.max(1, Math.round(exp0 * f)), coin1 = Math.max(5, Math.round(coin0 * f));
  const pad = (s, w) => String(s).padStart(Math.max(w, String(s).length));
  lines[i] = m[1] + k + m[3] + m[4] + m[5] + pad(hp1, m[6].length) + m[7] + pad(exp1, m[8].length) + m[9] + pad(coin1, m[10].length) + m[11];
  changes.push({ k, lv, f, hp0, hp1, exp0, exp1, coin0, coin1, elite: ELITE.test(k) });
}

console.log(`trend Lv ${LO} ${Math.round(trendOld[LO])} HP -> Lv ${HI} ${Math.round(trendOld[HI])} HP: x${g.toFixed(4)} a level`);
console.log(' Lv   old trend   new trend  factor');
for (let L = LO; L <= HI; L += 5) console.log(String(L).padStart(3), String(Math.round(trendOld[L])).padStart(11), String(Math.round(trendNew(L))).padStart(11), factor(L).toFixed(2).padStart(7));
console.log(`\n${changes.length} rows rescaled:`);
for (const c of changes.sort((a, b) => a.lv - b.lv)) console.log(`  ${c.k.padEnd(30)} Lv ${String(c.lv).padStart(2)}  x${c.f.toFixed(2)}  hp ${c.hp0} -> ${c.hp1}  exp ${c.exp0} -> ${c.exp1}  coin ${c.coin0} -> ${c.coin1}${c.elite ? '  (elite/heavy)' : ''}`);
if (DRY) { console.log('\n(dry run - nothing written)'); process.exit(0); }
let out = lines.join(NL);
const stamp = '// ---- Regular monsters ----';
const note = '// v0.30.x - Lv 36-80 regular-monster HP (and the EXP / coin that follow it) rescaled onto one smooth' + NL
  + '// trend by scripts/smooth_mob_hp_curve.mjs: the band crept 6k -> 12k HP across Lv 40-51, jumped to' + NL
  + '// 77k-152k at Lv 56-62, and sagged again at Lv 77-80. ATK / DEF, elites and heavies untouched.' + NL + '  ';
if (!out.includes('scripts/smooth_mob_hp_curve.mjs')) out = out.replace(stamp, note.trimEnd() + NL + '  ' + stamp);
const check = { window: {} }; vm.runInNewContext(out, check);
if (Object.keys(check.window.LX_MONSTER_STATS).length !== Object.keys(T).length) throw new Error('row count changed - refusing to write');
writeFileSync(FILE + '.tmp', out); renameSync(FILE + '.tmp', FILE);
console.log(`\nwrote ${path.relative(ROOT, FILE)}`);
