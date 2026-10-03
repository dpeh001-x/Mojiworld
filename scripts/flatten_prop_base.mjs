#!/usr/bin/env node
// Straightens a world prop's ROUNDED base so it stands flat on the floor line (v0.30.1605, per user: the Azure fountains' base "flat
// rather than rounded"; "the black outline should be exactly at the floor blackline"). Ludo could not do it: fresh flat-prop takes changed
// the design and still sagged in the middle, and image-edits of the art came back with the curve, so the approved art is warped instead.
// The base's solid bottom curve (alpha >= 160) is fitted with an even polynomial (1, u^2, u^4) over its middle 80%, so the drop
// D(x) = lowest row - curve(x) is smooth (a raw per-column drop shears diagonal edges into stair steps). Each column of the base then drops
// by min(D, cap): its lowest <block> rows - the bottom line and the band above it, which run parallel to the curve and so come out
// straight - move RIGIDLY (the line keeps its weight), the <span> rows above stretch to fill the gap, and nothing above the span moves.
// The cap leaves the outermost corners a little rounding. The faint anti-aliased columns just outside the side outlines move with their
// neighbours (left alone they streak below the old corner). Same canvas and same lowest row; [maxRow] holds the anti-aliasing below the
// art's bbox bottom under the table's alpha 64 rule, so its data/sprite_bbox.js row (and any landed marker on it) stays valid.
//   node scripts/flatten_prop_base.mjs <in.webp> <out.webp> <block> <span> <cap> [maxRow]
// First use (v0.30.1605), on the art as it was at v0.30.1604 - the outputs are the shipped files, byte for byte:
//   azure_large_waterfountain  99 110 50 1982   (the bottom line, white strip and lower blue band move; the gem row stretches)
//   azure_waterfountain        92 60 28 849     (the lower ring moves; the recess and the rim's underside stretch)
// Check the result: the lowest solid row varies by <= 2 px across the middle 90% of the base (scripts/town_beautify_test.mjs [4]).
import fs from 'node:fs'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const sharp = require('sharp'); sharp.cache(false);
const [IN, OUT, TBs, SPs, CAPs, MAXs] = process.argv.slice(2);
if (!IN || !OUT || !CAPs) { console.error('usage: flatten_prop_base.mjs <in.webp> <out.webp> <block> <span> <cap> [maxRow]'); process.exit(1); }
const TB = Number(TBs), SPAN = Number(SPs), CAP = Number(CAPs), MAXROW = MAXs ? Number(MAXs) : Infinity;
const { data, info } = await sharp(fs.readFileSync(IN)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, out = Buffer.from(data), I = (x, y) => (y * W + x) * 4;
const raw = new Int32Array(W).fill(-1);
for (let x = 0; x < W; x++) for (let y = H - 1; y >= 0; y--) if (data[I(x, y) + 3] >= 160) { raw[x] = y; break; }
const Y0 = Math.max(...raw), base = []; for (let x = 0; x < W; x++) if (raw[x] >= 0 && Y0 - raw[x] <= TB + SPAN) base.push(x);
const x0 = base[0], x1 = base[base.length - 1], xc = (x0 + x1) / 2, hw = (x1 - x0) / 2;
const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], v = [0, 0, 0];   // least squares b = c0 + c1 u^2 + c2 u^4 over |u| <= 0.8
for (const x of base) { const u = (x - xc) / hw; if (Math.abs(u) > 0.8) continue; const f = [1, u * u, u ** 4]; for (let i = 0; i < 3; i++) { v[i] += f[i] * raw[x]; for (let j = 0; j < 3; j++) M[i][j] += f[i] * f[j]; } }
const det3 = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
const D0 = det3(M), c = [0, 1, 2].map((k) => det3(M.map((row, i) => row.map((val, j) => (j === k ? v[i] : val)))) / D0);
const fit = (x) => { const u = (x - xc) / hw; return c[0] + c[1] * u * u + c[2] * u ** 4; };
let Yr = -1; for (const x of base) if (Math.abs(x - xc) <= hw * 0.1) Yr = Math.max(Yr, raw[x]);   // the real lowest solid row at the middle
const off = Yr - fit(xc);
const cols = []; for (let x = Math.max(0, x0 - 8); x <= Math.min(W - 1, x1 + 8); x++) { let any = x >= x0 && x <= x1; for (let y = Math.max(0, Y0 - TB - SPAN); !any && y < H; y++) if (data[I(x, y) + 3] > 0) any = true; if (any) cols.push(x); }
let maxD = 0;
for (const x of cols) {
  const bf = fit(Math.max(x0, Math.min(x1, x))) + off, D = Math.max(0, Math.min(CAP, Yr - bf)); if (D <= 0.05) continue; maxD = Math.max(maxD, D);
  const A = Math.max(0, Math.floor(bf - TB - SPAN)), blkT = bf + D - TB;   // A: rows above never change; from blkT down the block moves by D
  for (let ty = A; ty < H; ty++) {
    const s = ty >= blkT ? ty - D : A + (ty - A) * ((bf - TB - A) / Math.max(1, blkT - A)), o = I(x, ty);
    if (s > H - 1) { out[o + 3] = 0; continue; }
    const s0 = Math.floor(s), f = s - s0, s1 = Math.min(H - 1, s0 + 1), p0 = I(x, Math.max(0, s0)), p1 = I(x, s1);
    const a0 = data[p0 + 3], a1 = data[p1 + 3], a = a0 * (1 - f) + a1 * f;
    for (let k = 0; k < 3; k++) out[o + k] = a > 0 ? Math.round((data[p0 + k] * a0 * (1 - f) + data[p1 + k] * a1 * f) / a) : 0;
    out[o + 3] = Math.round(a);
  }
}
for (let y = MAXROW + 1; y < H; y++) for (let x = 0; x < W; x++) { const o = I(x, y) + 3; if (out[o] > 64) out[o] = 64; }
const buf = await sharp(out, { raw: { width: W, height: H, channels: 4 } }).webp({ lossless: true, effort: 6 }).toBuffer();
fs.writeFileSync(OUT + '.tmp', buf); fs.renameSync(OUT + '.tmp', OUT);
console.log(IN.split(/[\\/]/).pop(), `base ${x0}-${x1}, lowest solid row ${Yr}, curve sag at |u|=0.8: ${(Yr - fit(xc + 0.8 * hw) - off).toFixed(1)} px, max drop ${maxD.toFixed(1)} px`);
