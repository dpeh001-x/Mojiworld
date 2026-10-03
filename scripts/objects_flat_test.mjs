#!/usr/bin/env node
// v0.30.1338: twelve world props redrawn flat for the side-scroller (scripts/gen_objects_flat.mjs) - they had a 3/4 camera. No browser:
//   - SAME SCALE: each keeps its original canvas, which is what drawWorldProps sizes a prop from
//   - SAME FLOOR: the content's bottom row (the runtime bbox rule) within 3 px of the old one, so each stands where it stood
//   - TABLES: data/sprite_bbox.js holds exactly these sprites' bounds (the runtime reads it instead of scanning), and
//     data/sprite_edges.js marks no left or right edge as cut (the art is 24 px clear of the canvas sides - a cut edge is feathered)
//   - FLAT FRONT: where the object is symmetric, its silhouette mirrors onto itself (IoU >= 0.85). The old 3/4 art: market_stall_2
//     0.762, shadow_shuriken_rack 0.655, bastion_throne_scribe_desk 0.597, market_stall_1 0.865 (new 0.947 / 0.891 / 0.861 / 0.945)
// v0.30.1346: the hearth, the signpost and the three fountains join. The fountains were symmetric already (tilted to show their water;
//   old 0.98 / 0.98 / 0.93, new 0.99 / 0.99 / 0.99) and join the mirror check; the hearth's stool and the signpost's boards do not.
// v0.30.1352: the signpost and the hearth are the old art again (per user) and leave this list; the Azure fountains are redrawn with a
//   bold black outline, checked below against their old art's line. The floor row may move 3 px (the runtime plants by the bbox table).
//   node scripts/objects_flat_test.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const sharp = require('sharp'); sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
// key: [canvas, old bottom row]
const PROPS = { bastion_anvil: [768, 758], bastion_throne: [992, 991], bastion_throne_prayer_candle: [425, 424], bastion_throne_scribe_desk: [768, 707],
  market_stall_1: [768, 766], market_stall_2: [768, 766], shadow_shuriken_rack: [768, 766], shadow_tatami: [768, 766], wagon_empty: [709, 707],
  celestial_arcane_glyph_stone: [768, 667], crate_stack: [567, 566], well_stone: [768, 766],
  azure_large_waterfountain: [1984, 1980], azure_waterfountain: [850, 849],
  town_fountain_small_east: [768, 584] };
const SYMMETRIC = ['market_stall_1', 'market_stall_2', 'shadow_shuriken_rack', 'bastion_throne_scribe_desk', 'bastion_throne_prayer_candle', 'celestial_arcane_glyph_stone', 'crate_stack', 'well_stone',
  'azure_large_waterfountain', 'azure_waterfountain', 'town_fountain_small_east'];
const table = (file, name) => { const t = fs.readFileSync(path.join(ROOT, 'data', file), 'utf8'); return JSON.parse(t.slice(t.indexOf(name + ' = ') + name.length + 3, t.lastIndexOf(';'))); };
const BB = table('sprite_bbox.js', 'window.LX_SPRITE_BBOX'), ED = table('sprite_edges.js', 'window.LX_SPRITE_EDGES');
const rows = [];
for (const [k, [canvas, oldBottom]] of Object.entries(PROPS)) {
  const { data, info } = await sharp(path.join(ROOT, 'Sprites', 'objects', k + '.webp')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, A = (x, y) => data[(y * W + x) * 4 + 3];
  let bot = H - 1;   // scripts/gen_sprite_bbox.mjs: alpha > 64, two opaque px in a row, scanning up; top: alpha > 12, scanning down
  outer: for (let y = H - 1; y >= 0; y--) { let run = 0; for (let x = 0; x < W; x++) { if (A(x, y) > 64) { if (++run >= 2) { bot = y; break outer; } } else run = 0; } }
  let top = 0;
  outer2: for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) { if (A(x, y) > 12) { top = y; break outer2; } } }
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y) > 4) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  let inter = 0, uni = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const a = A(x, y) > 64, b = A(x0 + x1 - x, y) > 64; if (a && b) inter++; if (a || b) uni++; }
  const edges = ED['objects/' + k + '.webp'];
  rows.push({ k, W, H, canvas, bot, oldBottom, bbRow: BB['objects/' + k + '.webp'], bbNow: [top, bot, W, H].join(','), left: x0, right: W - 1 - x1, edges, mirror: +(inter / Math.max(1, uni)).toFixed(3) });
}
for (const r of rows) console.log(`  ${r.k.padEnd(30)} ${r.W}x${r.H}  bottom ${r.oldBottom}->${r.bot}  margins ${r.left}/${r.right}  edges "${r.edges}"  mirror ${r.mirror}`);
ok('every prop keeps its original canvas (its in-game scale)', rows.every((r) => r.W === r.canvas && r.H === r.canvas), rows.filter((r) => r.W !== r.canvas).map((r) => r.k).join(' '));
ok('every prop stands on its old floor row (within 3 px)', rows.every((r) => Math.abs(r.bot - r.oldBottom) <= 3), rows.map((r) => r.k + ' ' + r.oldBottom + '->' + r.bot).join(' '));
ok('data/sprite_bbox.js holds these sprites\' bounds', rows.every((r) => r.bbRow === r.bbNow), rows.filter((r) => r.bbRow !== r.bbNow).map((r) => r.k + ' ' + r.bbRow + ' vs ' + r.bbNow).join(' '));
ok('no side is 24 px close to the canvas, and data/sprite_edges.js cuts neither side', rows.every((r) => r.left >= 24 && r.right >= 24 && typeof r.edges === 'string' && r.edges.split('|').slice(0, 2).join('') === ''),
  rows.filter((r) => !(r.left >= 24 && r.right >= 24) || (r.edges || '|').split('|').slice(0, 2).join('')).map((r) => r.k).join(' '));
// v0.30.1352 per user: the Azure fountains "need to have good black outline like the old signpost". Outline weight, measured on the
// canvas (so it is the line the game draws): from each silhouette-edge pixel that is near-black, the median walk inward through
// near-black pixels to the first coloured one; and the share of the silhouette edge that is inked. The old art: the large fountain
// 16 px with 78% of its edge inked, the small one 12 px with 100%. The v0.30.1346 takes had 3 px / 66% and 5 px - too light.
const INK = { azure_large_waterfountain: 16, azure_waterfountain: 12 };
const inkOf = async (k) => {
  const { data, info } = await sharp(path.join(ROOT, 'Sprites', 'objects', k + '.webp')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, P = (x, y) => (y * W + x) * 4;
  const op = (x, y) => x >= 0 && y >= 0 && x < W && y < H && data[P(x, y) + 3] > 128;
  const dark = (x, y) => { const i = P(x, y); return data[i + 3] > 128 && (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) < 70; };
  const d = []; let edges = 0, inked = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (!op(x, y) || (op(x - 1, y) && op(x + 1, y) && op(x, y - 1) && op(x, y + 1))) continue;
    edges++; if (!dark(x, y)) continue; inked++;
    let gx = 0, gy = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (op(x + dx, y + dy)) { gx += dx; gy += dy; }
    const n = Math.hypot(gx, gy); if (!n) continue; gx /= n; gy /= n;
    let s = 0; for (; s < 80; s++) { const xx = Math.round(x + gx * s), yy = Math.round(y + gy * s); if (!op(xx, yy) || !dark(xx, yy)) break; }
    d.push(s);
  }
  d.sort((a, b) => a - b);
  return { px: d.length ? d[d.length >> 1] : 0, share: inked / Math.max(1, edges) };
};
const ink = []; for (const k of Object.keys(INK)) ink.push({ k, min: INK[k], ...(await inkOf(k)) });
ok('the Azure fountains have a bold black outline, at least as heavy as their old art and around nearly all of the silhouette',
  ink.every((r) => r.px >= r.min && r.share >= 0.85), ink.map((r) => `${r.k} ${r.px} px (old ${r.min}), ${(100 * r.share).toFixed(0)}% inked`).join('  '));
const sym = rows.filter((r) => SYMMETRIC.includes(r.k));
ok('the symmetric props are flat front views (mirror IoU >= 0.85)', sym.every((r) => r.mirror >= 0.85), sym.map((r) => r.k + ' ' + r.mirror).join(' '));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
