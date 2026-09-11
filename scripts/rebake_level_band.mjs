#!/usr/bin/env node
// EASE ONE BAND OF THE LEVEL-COST TABLE, leaving every other level byte-identical
// (per user, 2026-09-11: "make level 40-80 slightly easier than the current").
//
// WHY THE COST TABLE, AND NOT KILL TARGETS: monster EXP is derived from HP (exp = hp x 0.02, then
// x1.35 x LX_EXP.monster on the kill), so EXP-per-HP is a constant. The total damage a player has to
// deal to gain a level is therefore cost(L) / (EXP per HP) - whichever monsters they fight. The
// roster only decides whether that effort arrives as many small kills or fewer big ones. "Easier"
// is a lower cost; "fewer kills" alone can be bought by tankier monsters at no saving at all.
//
// WHY A BAND SCRIPT: scripts/level_time_retune.mjs rewrites all 200 levels from its July 2026
// anchors (8 kills at Lv 1, 5,000 at Lv 50), which no longer describe the live game.
//
// THE CHANGE: cost x EASE across [BAND_LO, BAND_HI], ramped in geometrically over the RAMP levels
// below and out over the RAMP levels above, so the EXP bar never jumps at a seam. The table stays
// monotonic (asserted); levels outside the ramps are asserted untouched.
//
//   node scripts/rebake_level_band.mjs                 # dry run: print costs + kills per level
//   node scripts/rebake_level_band.mjs --write         # patch mojiworld_game.html (atomic)
//   node scripts/rebake_level_band.mjs --emit=FILE     # write the new table literal to FILE
//   flags: --ease=0.85 --lo=40 --hi=80 --ramp=5
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = path.join(ROOT, 'mojiworld_game.html');
const STATS = path.join(ROOT, 'data', 'monster_stats.js');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const EASE = +arg('ease', 0.85), LO = +arg('lo', 40), HI = +arg('hi', 80), RAMP = +arg('ramp', 5);

const html = fs.readFileSync(HTML, 'utf8');
const tm = html.match(/const _LX_LEVEL_COST_TABLE = \[([\d,\s]+)\];/);
if (!tm) throw new Error('cost table not found');
const OLD = tm[1].match(/\d+/g).map(Number);

// multiplier per level: 1 outside, EASE inside, geometric ramps between
const mul = (L) => {
  if (L <= LO - RAMP || L >= HI + RAMP) return 1;
  if (L >= LO && L <= HI) return EASE;
  const f = L < LO ? (L - (LO - RAMP)) / RAMP : ((HI + RAMP) - L) / RAMP;
  return Math.pow(EASE, f);
};
const NEW = OLD.map((c, i) => Math.round(c * mul(i + 1)));
for (let i = 1; i < NEW.length; i++) if (NEW[i] < NEW[i - 1]) throw new Error(`not monotonic at Lv ${i + 1}: ${NEW[i - 1]} -> ${NEW[i]}`);
for (let i = 0; i < NEW.length; i++) if (mul(i + 1) === 1 && NEW[i] !== OLD[i]) throw new Error('touched Lv ' + (i + 1));

// report: kills against the median same-level regular monster (the audit's measure)
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(STATS, 'utf8'), ctx);
const T = ctx.window.LX_MONSTER_STATS;
const knob = (k) => { const m = html.match(new RegExp('^\\s+' + k + ':\\s*([\\d.]+)\\s*,', 'm')); if (!m) throw new Error('LX_EXP.' + k); return +m[1]; };
const MON = knob('monster'), EVT = knob('event'), E1 = knob('earlyL1'), E5 = knob('earlyL5');
const early = (L) => { let b = 1; if (L <= 5) b = E1 - (E1 - E5) * (L - 1) / 4; else if (L <= 10) b = E5 - (E5 - 1) * (L - 5) / 5; return Math.max(b, EVT); };
const elites = new Set(['echoKnight']);
for (const m of html.matchAll(/^\s{2}([A-Za-z_0-9]+):\s*\{[^\n]*miniElite\s*:\s*true/gm)) elites.add(m[1]);
const bosses = new Set();
for (const m of html.matchAll(/\{\s*type:\s*'([A-Za-z_0-9]+)'[^}]*\bboss:\s*true/g)) bosses.add(m[1]);
const regular = Object.keys(T).filter((k) => T[k].exp > 0 && T[k].exp / T[k].hp < 0.03 && !/^(octoLeg|zodiac_|tower)/.test(k) && !elites.has(k) && !bosses.has(k));
const perKill = (L) => {
  let c = regular.filter((k) => Math.abs(T[k].lv - L) <= 2);
  if (!c.length) { const b = Math.min(...regular.map((k) => Math.abs(T[k].lv - L))); c = regular.filter((k) => Math.abs(T[k].lv - L) === b); }
  const gap = (k) => { const g = L - T[k].lv; return g <= 5 ? 1 : Math.max(0.15, 1 - (g - 5) * 0.055); };
  const e = c.map((k) => T[k].exp * 1.35 * MON * early(L) * gap(k)).sort((a, b) => a - b);
  return e[Math.floor(e.length / 2)];
};
console.log(`ease x${EASE} over Lv ${LO}-${HI}, ramps Lv ${LO - RAMP + 1}-${LO - 1} and ${HI + 1}-${HI + RAMP - 1}; ${regular.length} regular mobs`);
console.log(' Lv |      old cost |      new cost |  mul | EXP/kill | kills old -> new');
for (let L = 30; L <= 90; L++) {
  if (!(L % 5 === 0 || (L > LO - RAMP && L < LO) || (L > HI && L < HI + RAMP))) continue;
  const pk = perKill(L);
  console.log(String(L).padStart(3), '|', String(OLD[L - 1]).padStart(13), '|', String(NEW[L - 1]).padStart(13), '|', mul(L).toFixed(3), '|', String(Math.round(pk)).padStart(8), '|', Math.round(OLD[L - 1] / pk), '->', Math.round(NEW[L - 1] / pk));
}
let a = 0, b = 0; for (let L = LO; L <= HI; L++) { a += OLD[L - 1]; b += NEW[L - 1]; }
console.log(`EXP (= effort) to climb Lv ${LO} -> ${HI + 1}: ${a.toExponential(3)} -> ${b.toExponential(3)} (${Math.round((1 - b / a) * 100)}% less)`);

const lines = []; for (let i = 0; i < NEW.length; i += 10) lines.push('  ' + NEW.slice(i, i + 10).join(','));
const NL = html.includes('\r\n') ? '\r\n' : '\n';
const literal = 'const _LX_LEVEL_COST_TABLE = [' + NL + lines.join(',' + NL) + NL + '];';
const emit = arg('emit', '');
if (emit) { fs.writeFileSync(emit, literal); console.log('emitted ' + emit); }
if (process.argv.includes('--write')) {
  fs.writeFileSync(HTML + '.tmp', html.replace(/const _LX_LEVEL_COST_TABLE = \[[\d,\s]+\];/, literal));
  fs.renameSync(HTML + '.tmp', HTML);
  console.log('wrote ' + path.relative(ROOT, HTML));
}
