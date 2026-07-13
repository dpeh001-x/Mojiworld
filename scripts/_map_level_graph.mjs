// Extract the map graph: levelReq per map + portal adjacency, flag big jumps. v2
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../mojiworld_game.html', import.meta.url), 'utf8');

// --- MOB_NATURAL_LEVEL ---
const natStart = src.indexOf('const MOB_NATURAL_LEVEL = {');
const natEnd = src.indexOf('};', natStart);
const NAT = {};
for (const m of src.slice(natStart, natEnd).matchAll(/([\w$]+):\s*(\d+)/g)) NAT[m[1]] = +m[2];

// --- find the MAPS literal via brace depth ---
const mapsStart = src.indexOf('const MAPS = {');
let depth = 0, i = src.indexOf('{', mapsStart), mapsEnd = -1;
for (; i < src.length; i++) {
  const c = src[i];
  if (c === '{') depth++;
  else if (c === '}') { depth--; if (depth === 0) { mapsEnd = i; break; } }
}
const lit = src.slice(mapsStart, mapsEnd);

// --- top-level map keys inside the literal (depth 1) ---
const maps = {};
depth = 0;
let keyStart = -1;
for (let j = src.indexOf('{', mapsStart); j <= mapsEnd; j++) {
  const c = src[j];
  if (c === '{') { depth++; continue; }
  if (c === '}') { depth--; continue; }
}
// simpler: regex keys at line start with 2 spaces, then verify depth by body capture between successive keys within the literal
const keyRe = /^  ([A-Za-z_$][\w$]*):\s*(?:\{|\(\(\) => \{)/gm;
const hits = [];
let km;
while ((km = keyRe.exec(lit))) hits.push({ id: km[1], idx: km.index });
for (let k = 0; k < hits.length; k++) {
  const body = lit.slice(hits[k].idx, k + 1 < hits.length ? hits[k + 1].idx : undefined);
  const id = hits[k].id;
  const lv = body.match(/levelReq:\s*(\d+)/);
  const nm = body.match(/name:\s*'((?:[^'\\]|\\.)*)'/);
  // spawns: type + optional per-spawn level
  const spawnLvls = [];
  for (const sm of body.matchAll(/\{\s*type:\s*'([\w$]+)'([^}]*)\}/g)) {
    const t = sm[1];
    const lm = sm[2].match(/level:\s*(\d+)/);
    const l = lm ? +lm[1] : NAT[t];
    if (l) spawnLvls.push(l);
  }
  maps[id] = {
    name: nm ? nm[1] : id,
    levelReq: lv ? +lv[1] : null,
    spawnMax: spawnLvls.length ? Math.max(...spawnLvls) : null,
  };
}
// --- MAPS.id = { ... } assignments outside the literal ---
for (const am of src.matchAll(/^MAPS\.([\w$]+) = \{/gm)) {
  const id = am[1];
  if (maps[id]) continue;
  const start = am.index;
  let d = 0, e = src.indexOf('{', start);
  for (let j = e; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (d === 0) { e = j; break; } }
  }
  const body = src.slice(start, e);
  const lv = body.match(/levelReq:\s*(\d+)/);
  const nm = body.match(/name:\s*'((?:[^'\\]|\\.)*)'/);
  const spawnLvls = [];
  for (const sm of body.matchAll(/\{\s*type:\s*'([\w$]+)'([^}]*)\}/g)) {
    const lm = sm[2].match(/level:\s*(\d+)/);
    const l = lm ? +lm[1] : NAT[sm[1]];
    if (l) spawnLvls.push(l);
  }
  maps[id] = { name: nm ? nm[1] : id, levelReq: lv ? +lv[1] : null, spawnMax: spawnLvls.length ? Math.max(...spawnLvls) : null };
}

const eff = (id) => {
  const m = maps[id];
  if (!m) return null;
  return m.levelReq != null ? m.levelReq : m.spawnMax;
};

// --- edges from .portals.push ---
const edges = new Set();
for (const pm of src.matchAll(/MAPS\.([\w$]+)\.portals\.push\s*\(\s*\{[^}]*dest:\s*'([\w$]+)'/g)) {
  const [a, b] = [pm[1], pm[2]];
  edges.add(a < b ? a + '|' + b : b + '|' + a);
}
// inline portals inside each map body
for (const id of Object.keys(maps)) { /* body-scoped: reuse hit bodies */ }
for (let k = 0; k < hits.length; k++) {
  const body = lit.slice(hits[k].idx, k + 1 < hits.length ? hits[k + 1].idx : undefined);
  const id = hits[k].id;
  const pIdx = body.indexOf('portals:');
  if (pIdx === -1) continue;
  // portals array: bracket-match
  let d = 0, s = body.indexOf('[', pIdx), e2 = s;
  for (let j = s; j < body.length; j++) {
    if (body[j] === '[') d++;
    else if (body[j] === ']') { d--; if (d === 0) { e2 = j; break; } }
  }
  for (const dm of body.slice(s, e2).matchAll(/dest:\s*'([\w$]+)'/g)) {
    const b = dm[1];
    edges.add(id < b ? id + '|' + b : b + '|' + id);
  }
}

// --- report ---
const rows = [];
for (const e of edges) {
  const [a, b] = e.split('|');
  const la = eff(a), lb = eff(b);
  rows.push({ a, b, la, lb, gap: (la != null && lb != null) ? Math.abs(la - lb) : null });
}
rows.sort((x, y) => (y.gap ?? -1) - (x.gap ?? -1));
console.log('=== MAPS (' + Object.keys(maps).length + ') — eff level [levelReq/spawnMax] ===');
const ids = Object.keys(maps).sort((a, b) => (eff(a) ?? -1) - (eff(b) ?? -1));
for (const id of ids) console.log(String(eff(id) ?? '?').padStart(4), id.padEnd(26), 'req:' + String(maps[id].levelReq).padEnd(5), 'spawn:' + String(maps[id].spawnMax).padEnd(5), maps[id].name);
console.log('\n=== EDGES with gap > 8 ===');
for (const r of rows) if (r.gap != null && r.gap > 8) console.log(String(r.gap).padStart(3), ' Lv' + r.la, r.a, '<->', 'Lv' + r.lb, r.b);
console.log('\n=== EDGES with unknown level ===');
for (const r of rows) if (r.gap == null) console.log('  ?', r.a, '(' + r.la + ')', '<->', r.b, '(' + r.lb + ')');

// --- roster detail for combat maps ---
console.log('\n=== ROSTERS (type@naturalLv xcount) ===');
for (let k = 0; k < hits.length; k++) {
  const body = lit.slice(hits[k].idx, k + 1 < hits.length ? hits[k + 1].idx : undefined);
  dumpRoster(hits[k].id, body);
}
for (const am of src.matchAll(/^MAPS\.([\w$]+) = \{/gm)) {
  const start = am.index; let d = 0, e = src.indexOf('{', start);
  for (let j = e; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (d === 0) { e = j; break; } } }
  dumpRoster(am[1], src.slice(start, e));
}
function dumpRoster(id, body) {
  const sIdx = body.indexOf('spawns:');
  if (sIdx === -1) return;
  let d = 0, s = body.indexOf('[', sIdx), e2 = s;
  for (let j = s; j < body.length; j++) { if (body[j] === '[') d++; else if (body[j] === ']') { d--; if (d === 0) { e2 = j; break; } } }
  const entries = [];
  for (const sm of body.slice(s, e2).matchAll(/\{\s*type:\s*'([\w$]+)'([^}]*)\}/g)) {
    const lm = sm[2].match(/level:\s*(\d+)/);
    const cm = sm[2].match(/count:\s*(\d+)/);
    entries.push(sm[1] + '@' + (lm ? lm[1] + '!' : (NAT[sm[1]] ?? '?')) + 'x' + (cm ? cm[1] : '?'));
  }
  if (entries.length) console.log(String(eff(id) ?? '?').padStart(4), id.padEnd(24), entries.join('  '));
}

// --- v3: live edges (apply .filter removals) + roster-weighted gaps ---
const removed = new Set();
for (const fm of src.matchAll(/MAPS\.([\w$]+)\.portals\s*=\s*MAPS\.\1\.portals\.filter\(p => p\.dest !== '([\w$]+)'\)/g)) {
  removed.add(fm[1] + '>' + fm[2]);
}
const SAFE = new Set(['town','void','everdawn_megamall','boss_rush','look','mastery']);
const rosterLv = {};
function calcRoster(id, body) {
  const sIdx = body.indexOf('spawns:');
  if (sIdx === -1) return;
  let d = 0, s = body.indexOf('[', sIdx), e2 = s;
  for (let j = s; j < body.length; j++) { if (body[j] === '[') d++; else if (body[j] === ']') { d--; if (d === 0) { e2 = j; break; } } }
  let wsum = 0, w = 0;
  for (const sm of body.slice(s, e2).matchAll(/\{\s*type:\s*'([\w$]+)'([^}]*)\}/g)) {
    const lm = sm[2].match(/level:\s*(\d+)/);
    const cm = sm[2].match(/count:\s*(\d+)/);
    const l = lm ? +lm[1] : NAT[sm[1]];
    const c = cm ? +cm[1] : 1;
    if (l) { wsum += l * c; w += c; }
  }
  if (w) rosterLv[id] = Math.round(wsum / w);
}
for (let k = 0; k < hits.length; k++) calcRoster(hits[k].id, lit.slice(hits[k].idx, k + 1 < hits.length ? hits[k + 1].idx : undefined));
for (const am of src.matchAll(/^MAPS\.([\w$]+) = \{/gm)) {
  const start = am.index; let d = 0, e = src.indexOf('{', start);
  for (let j = e; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (d === 0) { e = j; break; } } }
  calcRoster(am[1], src.slice(start, e));
}
console.log('\n=== LIVE COMBAT EDGES by roster-weighted level, gap>=10 ===');
const liveRows = [];
for (const e of edges) {
  const [a, b] = e.split('|');
  if (removed.has(a + '>' + b) && removed.has(b + '>' + a)) continue;
  // one-sided removal still leaves a walkable link the other way
  const oneWayGone = removed.has(a + '>' + b) || removed.has(b + '>' + a);
  if (SAFE.has(a) || SAFE.has(b)) continue;
  const la = rosterLv[a], lb = rosterLv[b];
  if (la == null || lb == null) continue;   // hubs / parkour / arenas-without-roster excluded here
  liveRows.push({ a, b, la, lb, gap: Math.abs(la - lb), half: oneWayGone });
}
liveRows.sort((x, y) => y.gap - x.gap);
for (const r of liveRows) if (r.gap >= 10) console.log(String(r.gap).padStart(3), ' L' + r.la, r.a, '<->', 'L' + r.lb, r.b, r.half ? '(one-way removed)' : '');
console.log('\n=== removed links ===');
for (const r of removed) console.log('  ', r);

// --- v4: ORDERED replay of portal ops (push / filter) for the true live graph ---
const ops = [];
for (const pm of src.matchAll(/MAPS\.([\w$]+)\.portals\.push\s*\(\s*\{[^}]*dest:\s*'([\w$]+)'/g)) ops.push({ i: pm.index, op: 'add', a: pm[1], b: pm[2] });
for (const fm of src.matchAll(/MAPS\.([\w$]+)\.portals\s*=\s*MAPS\.\1\.portals\.filter\(p => p\.dest !== '([\w$]+)'\)/g)) ops.push({ i: fm.index, op: 'del', a: fm[1], b: fm[2] });
ops.sort((x, y) => x.i - y.i);
const live = new Map();   // 'a>b' -> count
// seed with inline literal portals
for (let k = 0; k < hits.length; k++) {
  const body = lit.slice(hits[k].idx, k + 1 < hits.length ? hits[k + 1].idx : undefined);
  const id = hits[k].id;
  const pIdx = body.indexOf('portals:');
  if (pIdx === -1) continue;
  let d = 0, s = body.indexOf('[', pIdx), e2 = s;
  for (let j = s; j < body.length; j++) { if (body[j] === '[') d++; else if (body[j] === ']') { d--; if (d === 0) { e2 = j; break; } } }
  for (const dm of body.slice(s, e2).matchAll(/dest:\s*'([\w$]+)'/g)) live.set(id + '>' + dm[1], (live.get(id + '>' + dm[1]) || 0) + 1);
}
for (const o of ops) {
  const k = o.a + '>' + o.b;
  if (o.op === 'add') live.set(k, (live.get(k) || 0) + 1);
  else live.delete(k);
}
const liveEdges = new Set();
for (const [k, c] of live) if (c > 0) { const [a, b] = k.split('>'); liveEdges.add(a < b ? a + '|' + b : b + '|' + a); }
console.log('\n=== v4 LIVE EDGES: roster-weighted gaps >= 8 (combat maps) ===');
const out = [];
for (const e of liveEdges) {
  const [a, b] = e.split('|');
  const la = rosterLv[a], lb = rosterLv[b];
  if (la == null || lb == null) continue;
  out.push({ a, b, la, lb, gap: Math.abs(la - lb) });
}
out.sort((x, y) => y.gap - x.gap);
for (const r of out) console.log(String(r.gap).padStart(3), ' L' + r.la, r.a, '<->', 'L' + r.lb, r.b);
console.log('\n=== v4 edges where one side has NO roster (hub/parkour/arena) ===');
for (const e of liveEdges) {
  const [a, b] = e.split('|');
  const la = rosterLv[a], lb = rosterLv[b];
  if ((la == null) !== (lb == null)) console.log('  ', a, '(L' + (la ?? '—') + ')', '<->', b, '(L' + (lb ?? '—') + ')');
}
