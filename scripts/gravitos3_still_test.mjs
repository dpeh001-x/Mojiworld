// GRAVITOS'S THIRD-FORM STILL. Per user: "ensure that the initial sprite is regenerated with a slight menancing pop
// feel" and "try not to change the features too much as we have generated alot of videos regarding it" (candidate B).
// It is the reference every form-3 animation set is generated from, so what it pins is its geometry:
//   - SAME PLACE: the old 1656x1214 canvas, feet on the old row (1213) and a figure the old height (902 px, within 2%) -
//     the game plants and sizes every form-3 frame from this still
//   - NO CUT-OFFS: nothing inside the 13 px edge band the game's edge probe samples
//   - CLEAN: no white matte left by the generator (the rejected candidates carried 0.75-3% near-white pixels)
//   node scripts/gravitos3_still_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json')); const sharp = require('sharp');
let pass = 0, fail = 0;
const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d !== undefined ? '  ' + JSON.stringify(d) : '')); ok ? pass++ : fail++; };
const { data: d, info } = await sharp(path.join(ROOT, 'Sprites', 'bosses', 'gravitos3.webp')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height; let x0 = W, y0 = H, x1 = -1, y1 = -1, band = 0, op = 0, white = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const o = (y * W + x) * 4, a = d[o + 3];
  if (a > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (a > 16 && (x < 13 || x >= W - 13 || y < 13)) band++;   // the floor edge (bottom) is where his feet stand
  if (a >= 128) { op++; if (d[o] > 225 && d[o + 1] > 225 && d[o + 2] > 225) white++; }
}
check(W === 1656 && H === 1214 && Math.abs(y1 - 1213) <= 1 && Math.abs((y1 - y0 + 1) / 902 - 1) <= 0.02, 'SAME PLACE: the old canvas, feet on row 1213, the old figure height', { canvas: W + 'x' + H, feet: y1, height: y1 - y0 + 1 });
check(band === 0, 'NO CUT-OFFS: nothing in the 13 px band along the top and sides', { px: band });
check(white / op < 0.001, 'CLEAN: no white matte (under 0.1% near-white)', { white, of: op });
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
