#!/usr/bin/env node
// RE-DERIVE Lv 41-100 OF THE LEVEL-COST TABLE (_LX_LEVEL_COST_TABLE in mojiworld_game.html) from the stats table.
// The tool the table's comment names. Lv 1-40 (and the unreachable Lv 101-200 rows: the level cap is 100) are read from the
// file and never touched.
//
//   cost(L) = kills(L) x ref(L), smoothed
//   kills(L)  the documented line, in kills of a same-level monster: 1,500 + 300 a level past Lv 19 (7,800 at Lv 40, 16,500 at
//             Lv 69, 19,800 at Lv 80), then 19,800 -> 30,000 by Lv 85, then +5,000 a level (100,000 for 99 -> 100)
//   ref(L)    what one ordinary monster within +/-2 levels of min(L, 80) pays (the mean of data/monster_stats.js exp), held
//             non-decreasing from Lv 40's own reference, divided by 1.467. Lv 80 is the top of the ordinary roster, and a hero
//             past it is measured as Lv 80 by the level-gap falloff, so Lv 81-100 are kills of Lv 78-80 monsters at full rate.
//             The 1.467: the line counts kills of the monsters as they were before v0.30.1646 raised HP and EXP together
//             x1.467 ("same time per level"), the scale the unchanged Lv 1-40 costs were baked on.
//   ORDINARY  no boss, no tower / Express / Ticket / Conductor / mirror / octopus-leg / zodiac type, exp/hp <= 0.04 (the
//             regular-monster rate), and NOT A RARE ELITE: a type whose every map roster entry is gated (spawnChance:
//             rolled once per map load, never in the respawn drip - Blight Elder, Ossuary Tyrant, Path's Bane) or that is
//             in no roster at all (spawned by script once per visit - Elder Arlen). One of those per map pays 5-10x its
//             neighbours: in the +/-2 mean the Lv 71 Blight Elder alone made Lv 69 cost x2.66 Lv 68, and Path's Bane /
//             Ossuary Tyrant priced Lv 81-100 at ~1.7x their line.
//   SMOOTHED  no level may cost more than STEP (x1.30) the one before. A larger step in the monsters' EXP (Lv 58, 63, 70, 76,
//             80) is spread evenly in log space, half over the levels before it and half after (geometric mean of a
//             forward-capped and a backward-capped pass). The kills then sit a little off the line around such a step.
//
//   node scripts/exp_raw_bake.mjs              dry run: old vs new costs, step ratios, kills per level
//   node scripts/exp_raw_bake.mjs --write      patch mojiworld_game.html in place (atomic, CRLF kept)
//   node scripts/exp_raw_bake.mjs --check      exit 1 when the file's Lv 41-100 differ from the bake
//   flags: --html=<file>  --stats=<file>  --step=1.30
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const HTML = path.resolve(arg('html', path.join(ROOT, 'mojiworld_game.html')));
const STATS = path.resolve(arg('stats', path.join(ROOT, 'data', 'monster_stats.js')));
const STEP = +arg('step', 1.30), LO = 41, HI = 100, MOB_TOP = 80, EXP_RISE = 1.467;

const html = fs.readFileSync(HTML, 'utf8');
const TABLE_RE = /const _LX_LEVEL_COST_TABLE = \[([\d,\s]+)\];/;
const tm = html.match(TABLE_RE);
if (!tm) throw new Error('cost table not found in ' + HTML);
const OLD = tm[1].match(/\d+/g).map(Number);
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(STATS, 'utf8'), ctx);
const S = ctx.window.LX_MONSTER_STATS;
if (!S) throw new Error('LX_MONSTER_STATS not found in ' + STATS);

const line = (L) => (L <= 80) ? 1500 + 300 * (L - 19) : (L <= 85) ? 19800 + 2040 * (L - 80) : 30000 + 5000 * (L - 85);
const bosses = new Set();
for (const m of html.matchAll(/^\s{2}([A-Za-z_0-9]+):\s*\{[^\n]*\bboss\s*:\s*true/gm)) bosses.add(m[1]);
const roster = {};
for (const m of html.matchAll(/\{\s*type\s*:\s*'([A-Za-z_0-9]+)'\s*,\s*count\s*:\s*\d+([^}]*)\}/g)) (roster[m[1]] = roster[m[1]] || []).push(/spawnChance/.test(m[2]));
const regular = Object.keys(S).filter((t) => { const v = S[t]; return v && v.exp > 0 && v.lv > 0 && !bosses.has(t)
  && !/^(tower|express|ticket|conductor|mirror|octoLeg|zodiac_)/i.test(t) && v.exp / Math.max(1, v.hp) <= 0.04; });
const rare = regular.filter((t) => !roster[t] || roster[t].every(Boolean));
const pool = regular.filter((t) => !rare.includes(t));
const adj = (L) => { const p = pool.filter((t) => Math.abs(S[t].lv - L) <= 2); if (!p.length) throw new Error('no ordinary monster within 2 levels of Lv ' + L); return p.reduce((s, t) => s + S[t].exp, 0) / p.length; };

const ref = {}; let run = OLD[LO - 2] / line(LO - 1);   // Lv 40's own reference: the climb never starts below it
for (let L = LO; L <= HI; L++) { run = Math.max(run, adj(Math.min(L, MOB_TOP)) / EXP_RISE); ref[L] = run; }
const h = { [LO - 1]: OLD[LO - 2] };
for (let L = LO; L <= HI; L++) h[L] = line(L) * ref[L];
const f = { ...h }, b = { ...h }, c = { ...h };
for (let L = LO; L <= HI; L++) f[L] = Math.min(h[L], f[L - 1] * STEP);
for (let L = HI - 1; L >= LO; L--) b[L] = Math.max(h[L], b[L + 1] / STEP);
for (let L = LO; L <= HI; L++) c[L] = Math.min(Math.sqrt(f[L] * b[L]), c[L - 1] * STEP);
const NEW = OLD.slice();
for (let L = LO; L <= HI; L++) NEW[L - 1] = Math.round(c[L]);
for (let L = LO; L <= HI; L++) {
  const r = NEW[L - 1] / NEW[L - 2];
  if (!(r > 1)) throw new Error('Lv ' + L + ' costs no more than Lv ' + (L - 1));
  if (r > STEP + 1e-6) throw new Error('Lv ' + L + ' is x' + r.toFixed(3) + ' the level before (cap x' + STEP + ')');
}
for (let i = 0; i < OLD.length; i++) if ((i + 1 < LO || i + 1 > HI) && NEW[i] !== OLD[i]) throw new Error('touched Lv ' + (i + 1));

console.log('ordinary monsters ' + pool.length + '; left out as rare elites: ' + rare.map((t) => t + ' (Lv ' + S[t].lv + ', ' + S[t].exp + ' EXP)').join(', '));
console.log(' Lv |      old cost |  step |      new cost |  step | kills old -> new (line), today\'s ordinary monsters');
const tot = { o80: 0, n80: 0, o: 0, n: 0 };
for (let L = LO - 1; L <= HI; L++) {
  const ro = OLD[L - 1] / OLD[L - 2], rn = NEW[L - 1] / NEW[L - 2];
  let k = '';
  if (ref[L]) { const a = OLD[L - 1] / ref[L] / EXP_RISE, n = NEW[L - 1] / ref[L] / EXP_RISE; if (L < HI) { tot.o += a; tot.n += n; if (L <= 80) { tot.o80 += a; tot.n80 += n; } }
    k = Math.round(a) + ' -> ' + Math.round(n) + ' (' + Math.round(line(L) / EXP_RISE) + ')'; }
  console.log(String(L).padStart(3), '|', String(OLD[L - 1]).padStart(13), '| x' + ro.toFixed(2), '|', String(NEW[L - 1]).padStart(13), '| x' + rn.toFixed(2), '|', k);
}
const pct = (a, b) => ((b / a - 1) * 100).toFixed(1) + '%';
console.log('kills Lv 41 -> 81: ' + Math.round(tot.o80) + ' -> ' + Math.round(tot.n80) + ' (' + pct(tot.o80, tot.n80) + '); Lv 41 -> 100: ' + Math.round(tot.o) + ' -> ' + Math.round(tot.n) + ' (' + pct(tot.o, tot.n) + ')');

const same = NEW.every((v, i) => v === OLD[i]);
if (process.argv.includes('--check')) { console.log(same ? 'the table matches the bake' : 'the table DIFFERS from the bake'); process.exit(same ? 0 : 1); }
if (process.argv.includes('--write')) {
  if (same) { console.log('already baked'); process.exit(0); }
  const NL = html.includes('\r\n') ? '\r\n' : '\n';
  const rows = []; for (let i = 0; i < NEW.length; i += 10) rows.push('  ' + NEW.slice(i, i + 10).join(','));
  const literal = 'const _LX_LEVEL_COST_TABLE = [' + NL + rows.join(',' + NL) + ',' + NL + '];';
  const out = html.replace(TABLE_RE, () => literal);
  fs.writeFileSync(HTML + '.tmp', out); fs.renameSync(HTML + '.tmp', HTML);
  console.log('wrote ' + HTML);
}
