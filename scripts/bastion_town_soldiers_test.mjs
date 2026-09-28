#!/usr/bin/env node
// v0.30.1408: soldiers scattered through the Bastion town (per user: "scatter them throughout the bastion town"). The throne room keeps its
// ranks and squad; the Courtyard and the Rampart get guards and sentries, and four goofy look-alikes that reuse the squad's NPC art
// through LX_OBJECTS_SRC. No browser - reads the game file, the tables and the art, with each map's RUNTIME geometry (the Rampart's
// platforms and portals come from the stage bake, the Courtyard's portals from MAPS.bastion.portals.push):
//   - SOURCED ART: the four look-alikes point at the squad's still + 9 idle frames, all on disk and tabled; the loader and
//     _lxPropFrame read those paths
//   - ENOUGH, AND MIXED: 6+ soldiers in the Courtyard and 5+ on the Rampart, serious and goofy on each
//   - FOOTING + HEAD ROOM: each stands on a platform top that spans him, and his drawn body crosses no other platform
//   - CLEAR: his body stays inside the map and off every other prop (banners, lions, flags), every other soldier, the portals and
//     the NPCs
//   - SCATTERED: on each map they stand at 2+ heights (the Rampart has only two a soldier fits: its crenels sit under the wall walk)
//     and at uneven spacing, not drilled like the throne room
//   node scripts/bastion_town_soldiers_test.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const sharp = require('sharp'); sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const G = fs.readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8').replace(/\r\n/g, '\n');
const arrayAt = (head, from) => { const i = G.indexOf(head, from); if (i < 0 || from < 0) return null; const k = G.indexOf('[', i + head.length - 1); let d = 0, j;
  const src = G.slice(k).split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  for (j = 0; j < src.length; j++) { if (src[j] === '[') d++; else if (src[j] === ']' && --d === 0) break; }
  return Function('return ' + src.slice(0, j + 1))(); };
const bl = G.indexOf('  const B = {"'), B = JSON.parse(G.slice(bl + 12, G.indexOf('\n', bl)).replace(/;\s*$/, ''));
const lit = G.indexOf("  bastion: {\n    name:'The Bastion"), mp = G.indexOf('const MAP_PROPS = {');
const MAPS_ = {
  bastion: { W: +(G.slice(lit).match(/worldWidth: (\d+)/) || [])[1], plats: arrayAt('platforms: [', lit), npcs: arrayAt('npcs: [', lit),
    portals: [...G.matchAll(/MAPS\.bastion\.portals\.push\s*\(\{x:(\d+)/g)].map((m) => +m[1]), props: arrayAt('  bastion: [', mp) },
  bastionRampart: { W: B.bastionRampart.worldWidth, plats: B.bastionRampart.platforms, npcs: B.bastionRampart.npcs || [],
    portals: (B.bastionRampart.portals || []).map((p) => p.x), props: arrayAt('  bastionRampart: [', mp) },
};
const SRC = {}; for (const m of G.matchAll(/(bastion_goof_\w+): *\{ still: '(Sprites\/[^']+)', frames: '(Sprites\/[^']+)' \}/g)) SRC[m[1]] = { still: m[2], frames: m[3] };
const table = (file, name) => { const t = fs.readFileSync(path.join(ROOT, 'data', file), 'utf8'); return JSON.parse(t.slice(t.indexOf(name + ' = ') + name.length + 3, t.lastIndexOf(';'))); };
const BB = table('sprite_bbox.js', 'window.LX_SPRITE_BBOX'), ED = table('sprite_edges.js', 'window.LX_SPRITE_EDGES');
const GOOF = ['bastion_goof_daisy', 'bastion_goof_flop', 'bastion_goof_mope', 'bastion_goof_munch'];
const srcBad = GOOF.filter((k) => { const s = SRC[k]; if (!s) return true; const rel = s.still.replace(/^Sprites\//, '');
  const frames = Array.from({ length: 9 }, (_, i) => `${s.frames}_${i}.webp`);
  return !fs.existsSync(path.join(ROOT, s.still)) || !BB[rel] || ED[rel] == null || !frames.every((f) => fs.existsSync(path.join(ROOT, f)) && BB[f.replace(/^Sprites\//, '')])
    || !new RegExp(k + ': 9').test((G.match(/const LX_OBJECTS_ANIM = \{([^}]*)\}/) || [])[1] || ''); });
ok('the four goofy look-alikes source the squad\'s still + 9 idle frames (on disk, tabled, animated)', !srcBad.length
  && /for \(const \[k, s\] of Object\.entries\(LX_OBJECTS_SRC\)\)/.test(G) && /LX_OBJECTS_SRC\[prop\.key\] \? LX_OBJECTS_SRC\[prop\.key\]\.frames/.test(G), srcBad.join(', '));
const isSoldier = (k) => /^bastion_(soldier|goof)_/.test(k);
const artOf = async (key) => { const rel = SRC[key] ? SRC[key].still.replace(/^Sprites\//, '') : `objects/${key}.webp`;
  const { data, info } = await sharp(path.join(ROOT, 'Sprites', rel)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, x1 = -1, y0 = info.height, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 12) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const row = String(BB[rel] || '').split(','); return { W: info.width, H: info.height, x0, x1, y0, y1, top: +row[0], bot: +row[1] }; };
const cache = {}; const boxOf = async (p) => {   // drawWorldProps: h = 80 x scale x f, feet on the bbox bottom row (+1 px bury), hang from the bbox top
  const a = cache[p.key] || (cache[p.key] = await artOf(p.key)), f = Math.max(0.7, Math.min(1.4, Math.max(a.W, a.H) / 512)), h = 80 * (p.scale || 1) * f, w = h * a.W / a.H;
  const sx = p.x - w / 2, sy = p.anchor === 'hang' ? p.y - h * (a.top / a.H) : p.y - h * ((a.bot + 1) / a.H) + 1;
  let l = sx + w * a.x0 / a.W, r = sx + w * (a.x1 + 1) / a.W; if (p.flip) [l, r] = [2 * p.x - r, 2 * p.x - l];
  return { l, r, t: sy + h * a.y0 / a.H, b: sy + h * (a.y1 + 1) / a.H }; };
const hit = (A, Bx, tol) => A.l < Bx.r - tol && A.r > Bx.l + tol && A.t < Bx.b - tol && A.b > Bx.t + tol;
const probs = { count: [], foot: [], head: [], clear: [], scatter: [] };
for (const [id, M] of Object.entries(MAPS_)) {
  const sol = (M.props || []).filter((p) => isSoldier(p.key)), other = (M.props || []).filter((p) => !isSoldier(p.key));
  const serious = sol.filter((p) => /^bastion_soldier_/.test(p.key)).length, goof = sol.length - serious;
  if (sol.length < (id === 'bastion' ? 6 : 5) || !serious || !goof) probs.count.push(`${id}: ${serious} serious + ${goof} goofy`);
  const oboxes = await Promise.all(other.map(boxOf)), sboxes = await Promise.all(sol.map(boxOf));
  sol.forEach((s, i) => {
    const bx = sboxes[i], tag = `${id} ${s.key.replace('bastion_', '')}@${s.x},${s.y}`;
    const on = M.plats.find((p) => p.y === s.y && s.x >= p.x && s.x <= p.x + p.w); if (!on) probs.foot.push(tag);
    const through = M.plats.filter((p) => p !== on && bx.l < p.x + p.w - 2 && bx.r > p.x + 2 && bx.t < p.y + p.h - 2 && bx.b > p.y + 2); if (through.length) probs.head.push(`${tag} x ${through.map((p) => p.x + ',' + p.y).join(' ')}`);
    if (bx.l < 0 || bx.r > M.W) probs.clear.push(`${tag} off the map`);
    other.forEach((o, j) => { if (hit(bx, oboxes[j], 4)) probs.clear.push(`${tag} on ${o.key.replace('bastion_', '')}@${o.x}`); });
    sol.forEach((o, j) => { if (j > i && hit(bx, sboxes[j], 4)) probs.clear.push(`${tag} on ${o.key.replace('bastion_', '')}@${o.x}`); });
    if (s.y === 480) { for (const px of M.portals) if (Math.abs(s.x - px) < 70) probs.clear.push(`${tag} at the portal @${px}`); }
    for (const n of M.npcs) { const ny = (n.y == null ? 436 : n.y) + 44; if (ny === s.y && Math.abs(s.x - n.x) < 70) probs.clear.push(`${tag} at ${n.name}`); }
  });
  const heights = new Set(sol.map((s) => s.y)), xs = sol.map((s) => s.x).sort((a, b) => a - b), gaps = xs.slice(1).map((x, i) => x - xs[i]);
  if (heights.size < 2 || Math.max(...gaps) - Math.min(...gaps) < 40) probs.scatter.push(`${id}: ${heights.size} heights, gaps ${gaps.join('/')}`);
}
ok('6+ soldiers in the Courtyard and 5+ on the Rampart, serious and goofy on each', !probs.count.length, probs.count.join('; '));
ok('every soldier stands on a platform top that spans him', !probs.foot.length, probs.foot.join(', '));
ok('no soldier pokes through another platform (head room)', !probs.head.length, probs.head.join('; '));
ok('every soldier is inside the map and clear of the props, each other, the portals and the NPCs', !probs.clear.length, probs.clear.join('; '));
ok('they are scattered: 2+ heights and uneven spacing on each map', !probs.scatter.length, probs.scatter.join('; '));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
