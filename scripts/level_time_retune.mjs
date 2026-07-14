// Regenerate _LX_LEVEL_COST_TABLE in mojiworld_game.html.
// Calibration target (SOLO, ~5s/kill, adjacent +-2 mobs, x10 opening EVENT OFF,
// permanent x10 monster mult ON, Normal difficulty):
//   cumulative time to REACH Lv 50 ~= 10h  (7,200 kills)
//   cumulative time to REACH Lv 80 ~= 40h  (28,800 kills)
// Per-level EXP cost = target_kills(L) * live adjacent EXP/kill(L), so kill (and
// time) counts stay smooth even where the mob-EXP tables are lumpy.
//   node scripts/level_time_retune.mjs        # prints verification + the array
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../mojiworld_game.html', import.meta.url), 'utf8');

function extractObject(v) {
  const idx = html.indexOf('const ' + v + ' = {'); const start = html.indexOf('{', idx);
  let d = 0, i = start, s = null, e = false, c = null;
  for (; i < html.length; i++) {
    const ch = html[i], n = html[i + 1];
    if (c === '//') { if (ch === '\n') c = null; continue; } if (c === '/*') { if (ch === '*' && n === '/') { c = null; i++; } continue; }
    if (s) { if (e) e = false; else if (ch === '\\') e = true; else if (ch === s) s = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { s = ch; continue; }
    if (ch === '/' && n === '/') { c = '//'; i++; continue; } if (ch === '/' && n === '*') { c = '/*'; i++; continue; }
    if (ch === '{') d++; else if (ch === '}') { d--; if (d === 0) break; }
  }
  return eval('(' + html.slice(start, i + 1) + ')');
}
const monsterTypes = extractObject('monsterTypes'), NAT = extractObject('MOB_NATURAL_LEVEL');
const mobs = [];
for (const k in monsterTypes) {
  const m = monsterTypes[k];
  if (!m || typeof m !== 'object' || m.exp == null || m.boss || /^octoLeg/.test(k)) continue;
  const lvl = (m.level != null) ? m.level : NAT[k]; if (lvl == null) continue;
  mobs.push({ k, lvl, exp: m.exp });
}
mobs.sort((a, b) => a.lvl - b.lvl);
const avgAdj = L => {
  let p = mobs.filter(m => Math.abs(m.lvl - L) <= 2);
  if (!p.length) p = mobs.slice().sort((a, b) => Math.abs(a.lvl - L) - Math.abs(b.lvl - L)).slice(0, 3);
  return p.reduce((s, m) => s + m.exp, 0) / p.length;
};
const XP_CURVE = 1.35, MONSTER = 10;            // event=1 (off), normal diff=1
const perKill = (L, eventOn) => avgAdj(L) * XP_CURVE * (L <= 5 ? 3 : 1) * MONSTER * (eventOn ? 10 : 1);

const p = Math.log(4) / Math.log(79 / 49);       // power law through (50,7200),(80,28800)
const A = 7200 / Math.pow(49, p);
const cumReach = L => A * Math.pow(Math.max(0, L - 1), p);
const FLOOR = 8;
const targetKills = L => Math.max(FLOOR, cumReach(L + 1) - cumReach(L));

const COST = [];
for (let L = 1; L <= 200; L++) COST.push(Math.max(15, Math.round(targetKills(L) * perKill(L, false))));
const cost = L => (L < 1 ? COST[0] : L <= 200 ? COST[L - 1] : Math.floor(COST[199] * Math.pow(COST[199] / COST[198], L - 200)));

const SEC = 5, hrs = s => (s / 3600).toFixed(2) + 'h';
for (const ev of [false, true]) {
  let ck = 0; const mk = {};
  for (let L = 1; L <= 100; L++) { if ([50, 80, 100].includes(L)) mk[L] = ck; ck += cost(L) / perKill(L, ev); }
  console.log('EVENT ' + (ev ? 'ON ' : 'OFF') + ' cumulative to reach: Lv50=' + hrs(mk[50] * SEC) + ' Lv80=' + hrs(mk[80] * SEC) + ' Lv100=' + hrs(mk[100] * SEC));
}
let out = 'const _LX_LEVEL_COST_TABLE = [\n';
for (let i = 0; i < COST.length; i += 10) out += '  ' + COST.slice(i, i + 10).join(',') + (i + 10 < COST.length ? ',' : '') + '\n';
out += '];';
console.log('\n' + out);
