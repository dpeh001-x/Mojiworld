// VIRGA'S FRAMES STAY SHARP (per user: "virga's sprites are very blurry please fix"). The v0.30.1382 / v0.30.1399 re-animation
// shipped her idle, walk, fly and attack sets at a third of her still's fine detail (mean |laplacian| on solid pixels: still 19.9,
// sets 7.1-8.9); they were re-sharpened with the luminance shock filter (the Elderbark recipe) with the alpha byte-identical, so
// no bbox / edges / calib row moved. No browser - reads the art:
//   [1] every frame of the four sets is on disk, 1332 x 1332 like the still;
//   [2] every frame keeps at least 15 fine detail, and each set's mean is at least 90% of the still's - a softer redraw fails;
//   [3] the silhouette is the one the tables describe: each frame's opaque bbox matches its data/sprite_bbox.js row.
// The build before fails [2].   node scripts/virga_sharpness_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { readFileSync, existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const sharp = require('sharp');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const Z = path.join(ROOT, 'Sprites/bosses/zodiac');
const detail = async (f) => { const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height;
  const L = (i) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; let s = 0, n = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = (y * W + x) * 4;
    if (data[i + 3] >= 250) { s += Math.abs(4 * L(i) - L(i - 4) - L(i + 4) - L(i - W * 4) - L(i + W * 4)); n++; } }
  // gen_sprite_bbox's scan, exactly: bottom = first row from below with two consecutive alpha > 64 px; top = first row with alpha > 12
  const A = (x, y) => data[(y * W + x) * 4 + 3]; let bot = H - 1, top = 0;
  outer: for (let y = H - 1; y >= 0; y--) { let run = 0; for (let x = 0; x < W; x++) { if (A(x, y) > 64) { if (++run >= 2) { bot = y; break outer; } } else run = 0; } }
  outer2: for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y) > 12) { top = y; break outer2; }
  return { d: s / n, W, H, row: [top, bot, W, H].join(',') }; };
const bboxSrc = readFileSync(path.join(ROOT, 'data/sprite_bbox.js'), 'utf8');
const row = (k) => { const m = bboxSrc.match(new RegExp('"' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '":"([0-9,]+)"')); return m ? m[1].split(',').map(Number) : null; };
const still = await detail(path.join(Z, 'virgo.webp'));
const miss = [], size = [], soft = [], means = {}, boxOff = [];
for (const s of ['idle', 'walk', 'fly', 'attack']) {
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const f = path.join(Z, s, 'virgo_' + i + '.webp'); if (!existsSync(f)) { miss.push(s + '_' + i); continue; }
    const r = await detail(f); sum += r.d;
    if (r.W !== still.W || r.H !== still.H) size.push(s + '_' + i + ' ' + r.W + 'x' + r.H);
    if (r.d < 15) soft.push(s + '_' + i + ' ' + r.d.toFixed(1));
    const b = row('bosses/zodiac/' + s + '/virgo_' + i + '.webp');   // "top,bot,w,h"
    if (!b || b.join(',') !== r.row) boxOff.push(s + '_' + i + ' table ' + (b ? b.join(',') : 'none') + ' vs art ' + r.row);
  }
  means[s] = +(sum / 9).toFixed(1);
}
ok('[1] all 36 frames of idle / walk / fly / attack are on disk at the still\'s 1332 x 1332', miss.length === 0 && size.length === 0, { miss, size });
ok('[2] every frame keeps >= 15 fine detail and each set >= 90% of the still (' + still.d.toFixed(1) + ')', soft.length === 0 && Object.values(means).every((m) => m >= 0.9 * still.d), { means, soft: soft.slice(0, 6) });
ok('[3] the silhouettes are the ones data/sprite_bbox.js describes (alpha untouched)', boxOff.length === 0, boxOff.slice(0, 4));
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
