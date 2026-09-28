#!/usr/bin/env node
// Trim the dark SHELL off a glowing vfx sprite - the black outline an ink-outline brief bakes around the glow.
// =============================================================================
// Per user, of the Gravitos void rift: "the black outline for this above void sprite looks weird, please trim or
// remove it". gen_gravitos_voidrift.mjs asks ludo.ai for "a bold dark outline", so its output comes back wrapped in a
// near-black jagged shell ((25,9,38)-(42,23,55)) lined with a thin pale-lavender stroke, with dark chips scattered
// round it. The void inside the rift is dark too, but it is ENCLOSED by the bright rim, and that is what tells them apart:
//   1. shell  - flood from the transparent outside through DARK pixels (max channel < DARK), at most BAND px deep, and
//               clear them. The band stops a gap in the rim letting the flood reach the core.
//   2. stroke - the pale lavender line the shell leaves behind. The lightning bolts are the SAME colours, so colour
//               cannot tell them apart; thickness can: the stroke is 2-4 px, a bolt body 8-20 px. Open the pale mask
//               (erode, then dilate, radius OPEN) and drop pale pixels the opening loses, within STROKE px of the shell.
//   3. specks - islands under MINC px (8-connected) left floating where the chips were.
// Then a one-pixel soften: a kept pixel beside a cleared one takes min(alpha, mean of its 3x3).
//
//   node scripts/trim_dark_shell.mjs <file.webp>...              # in place (tmp + rename)
//   node scripts/trim_dark_shell.mjs --out <dir> <file.webp>...  # writes <dir>/<same name>
//   env: DARK=72 BAND=28 OPEN=2 STROKE=5 MINC=60 (the values the rift shipped with)
// Run it ONCE per generation, on the raw art: a second pass would start eating into the rim's own dark ink.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
sharp.cache(false);

const env = (k, d) => +(process.env[k] ?? d);
const DARK = env('DARK', 72), BAND = env('BAND', 28), OPEN = env('OPEN', 2), SD = env('STROKE', 5), MINC = env('MINC', 60);
const argv = process.argv.slice(2);
const oi = argv.indexOf('--out'), outDir = oi >= 0 ? argv.splice(oi, 2)[1] : null;
if (!argv.length) { console.error('usage: node scripts/trim_dark_shell.mjs [--out dir] <file.webp>...'); process.exit(2); }
if (outDir) fs.mkdirSync(outDir, { recursive: true });

async function trim(f) {
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  const a = (p) => data[p * 4 + 3];
  const mx = (p) => Math.max(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
  const sat = (p) => mx(p) - Math.min(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
  const nb = (p) => { const x = p % W, y = (p - x) / W; return [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]; };
  // 1. shell
  const depth = new Int16Array(N).fill(-1), q = new Int32Array(N); let qh = 0, qt = 0, removed = 0;
  for (let p = 0; p < N; p++) if (a(p) < 40) { depth[p] = 0; q[qt++] = p; }
  while (qh < qt) {
    const p = q[qh++], d = depth[p];
    if (d >= BAND) continue;
    for (const r of nb(p)) {
      if (r < 0 || depth[r] !== -1) continue;
      if (a(r) >= 40 && mx(r) >= DARK) continue;   // a lit pixel stops the flood
      depth[r] = d + 1; q[qt++] = r; if (a(r) >= 40) removed++;
    }
  }
  // 2. stroke
  const pm = new Uint8Array(N);
  for (let p = 0; p < N; p++) pm[p] = a(p) >= 40 && !(depth[p] > 0) && sat(p) < 60 ? 1 : 0;
  const morph = (src, keepIf) => { const o = new Uint8Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let c = 0, t = 0;
      for (let dy = -OPEN; dy <= OPEN; dy++) for (let dx = -OPEN; dx <= OPEN; dx++) {
        if (dx * dx + dy * dy > OPEN * OPEN + 1) continue;
        const xx = x + dx, yy = y + dy; t++; if (xx >= 0 && yy >= 0 && xx < W && yy < H && src[yy * W + xx]) c++; }
      o[y * W + x] = keepIf(c, t) ? 1 : 0; }
    return o; };
  const opened = OPEN > 0 ? morph(morph(pm, (c, t) => c === t), (c) => c > 0) : pm;
  const d2 = new Int8Array(N).fill(-1); qh = qt = 0;
  for (let p = 0; p < N; p++) if (depth[p] > 0 && a(p) >= 40) { d2[p] = 0; q[qt++] = p; }
  let stroke = 0;
  while (qh < qt) {
    const p = q[qh++];
    if (d2[p] >= SD) continue;
    for (const r of nb(p)) {
      if (r < 0 || d2[r] !== -1 || !pm[r] || opened[r]) continue;
      d2[r] = d2[p] + 1; q[qt++] = r; stroke++;
    }
  }
  removed += stroke;
  const alpha = new Float32Array(N);
  for (let p = 0; p < N; p++) alpha[p] = ((depth[p] > 0 && a(p) >= 40) || d2[p] > 0) ? 0 : a(p);
  for (let p = 0; p < N; p++) if (d2[p] > 0) depth[p] = 1;   // the soften treats the stroke as cleared too
  // 3. specks
  const lab = new Uint8Array(N); let islands = 0;
  for (let s = 0; s < N; s++) {
    if (lab[s] || alpha[s] <= 20) continue;
    const comp = [s]; lab[s] = 1;
    for (let k = 0; k < comp.length; k++) { const p = comp[k], x = p % W, y = (p - x) / W;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const r = yy * W + xx; if (!lab[r] && alpha[r] > 20) { lab[r] = 1; comp.push(r); } } }
    if (comp.length < MINC) { for (const p of comp) { alpha[p] = 0; depth[p] = 1; } removed += comp.length; islands++; }
  }
  // the soften
  const out = Buffer.from(data);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x; let s = 0, c = 0, touch = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const r = yy * W + xx; s += alpha[r]; c++; if (depth[r] > 0 && a(r) >= 40) touch = true; }
    out[p * 4 + 3] = Math.round(touch && alpha[p] > 0 ? Math.min(alpha[p], s / c) : alpha[p]);
  }
  const dst = outDir ? path.join(outDir, path.basename(f)) : f;
  await sharp(out, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 95, alphaQuality: 100, effort: 6 }).toFile(dst + '.tmp.webp');
  fs.renameSync(dst + '.tmp.webp', dst);
  console.log(`${path.basename(f)}: cleared ${removed} px (${(removed / N * 100).toFixed(1)}%), ${stroke} stroke, ${islands} specks`);
}
for (const f of argv) await trim(f);
