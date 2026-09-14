#!/usr/bin/env node
// Soften a sprite set's OWN alpha boundary, as opposed to the canvas edge.
//
//   IN_DIR=... OUT_DIR=... node scripts/soften_edges.mjs ground_slam [--write]
//
// v0.30.x — per user, of the reworked Ground Slam crater: "there seems to be a sharp cut off at
// the edges of the width".
//
// The v0.30.740 plates already carry a RADIAL feather, and it is doing its job — it guarantees
// nothing is clipped by the square canvas. It cannot help here, because the crater's ink stops
// well inside that band. Measured along the horizontal centreline of the shipped plate, as a
// fraction of the half-width:
//
//     0.75 -> 255 · 0.80 -> 168 · 0.85 -> 0
//
// That last step is the complaint: the art's own silhouette ends in a cliff at its widest point,
// and a radial ramp placed at 0.80-0.985 has almost no ink left to act on by the time it starts.
//
// Widening that ramp inward would fix the cliff by hollowing out the crater rim, which is a real
// feature of the art. So this does the thing an artist would: FEATHER THE ALPHA ITSELF.
// alpha' = min(alpha, blur(alpha)). A blur of a flat interior is still flat, so everything inside
// stays fully opaque; only within a blur-radius of the boundary does the minimum bite, turning the
// cliff into a ramp. Taking the MINIMUM rather than the blur outright matters: a plain blur would
// also push alpha OUTWARD past the old silhouette, into pixels whose colour is undefined, and the
// crater would gain a dark fringe. This can only ever remove alpha, so it cannot invent one.
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
sharp.cache(false);

const IN = process.env.IN_DIR, OUT = process.env.OUT_DIR;
const KEY = process.argv[2];
if (!IN || !KEY) { console.error('usage: IN_DIR=... OUT_DIR=... node soften_edges.mjs <key> [--write]'); process.exit(1); }
const WRITE = process.argv.includes('--write');
const SIGMA = Number(process.env.SIGMA || 14);   // on a 768 canvas: a ~30 px ramp, ~18 px at draw size

const files = [`${KEY}.webp`];
for (let i = 0; i < 9; i++) files.push(`${KEY}_${i}.webp`);

// alpha along the horizontal centreline, averaged over a band of rows so one stray pixel cannot
// speak for the edge
async function centreline(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  const W = info.width, cy = info.height >> 1, out = [];
  for (let k = 0.70; k <= 1.0001; k += 0.01) {   // ~4 px steps: a 0.05 stride is 19 px and cannot see a 30 px ramp
    const x = Math.min(W - 1, Math.round(W / 2 + k * (W / 2)));
    let s = 0, n = 0;
    for (let y = cy - 12; y <= cy + 12; y++) { s += data[y * W + x]; n++; }
    out.push({ k: +k.toFixed(2), a: Math.round(s / n) });
  }
  return out;
}
// the steepest single step between adjacent samples — the number that IS the complaint
const worstStep = (prof) => Math.max(...prof.slice(1).map((p, i) => prof[i].a - p.a));

if (WRITE) await mkdir(OUT, { recursive: true });
console.log(`alpha feather, sigma ${SIGMA}px\n`);
let beforeMax = 0, afterMax = 0;
for (const f of files) {
  const p = join(IN, f);
  if (!existsSync(p)) { console.error('missing ' + f); process.exit(1); }
  const src = await readFile(p);
  const meta = await sharp(src).metadata();
  const { data: rgba, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  // PREMULTIPLIED BLUR. The obvious version of this — alpha' = min(alpha, blur(alpha)) — was tried
  // first and cannot finish the job: min() can only REMOVE alpha, never carry it past the original
  // silhouette, so however wide the blur the boundary still ends on a step (measured: a 128 -> 0
  // cliff survived at every sigma from 14 to 38). A real feather has to extend outward, and alpha
  // extended over pixels whose colour is undefined is how sprites get a dark fringe.
  //
  // So blur the COLOUR weighted by its own alpha, and divide it back out afterwards: the new
  // semi-transparent ring inherits the rim's colour instead of black. The interior is then restored
  // from the original in proportion to how far inside it was, so the cracks stay crisp and only the
  // edge is soft.
  const N = info.width * info.height;
  const pre = Buffer.alloc(N * 3), alphaRaw = Buffer.alloc(N);
  for (let i = 0, q = 0; i < N; i++, q += 4) {
    const a = rgba[q + 3];
    alphaRaw[i] = a;
    pre[i * 3] = (rgba[q] * a) / 255;
    pre[i * 3 + 1] = (rgba[q + 1] * a) / 255;
    pre[i * 3 + 2] = (rgba[q + 2] * a) / 255;
  }
  // Read each blur's own layout rather than assuming it: sharp hands back 3 channels for a
  // single-channel input, and indexing that as 1 channel reads the wrong pixels — which zeroed the
  // alpha across the whole crater on the first run of this pass.
  const bA = await sharp(alphaRaw, { raw: { width: info.width, height: info.height, channels: 1 } })
    .blur(SIGMA).raw().toBuffer({ resolveWithObject: true });
  const bC = await sharp(pre, { raw: { width: info.width, height: info.height, channels: 3 } })
    .blur(SIGMA).raw().toBuffer({ resolveWithObject: true });
  const ac = bA.info.channels, cc = bC.info.channels;
  for (let i = 0, q = 0; i < N; i++, q += 4) {
    const a0 = rgba[q + 3];
    const aB = bA.data[i * ac];
    if (aB <= 0) { rgba[q] = rgba[q + 1] = rgba[q + 2] = rgba[q + 3] = 0; continue; }
    // un-premultiply the blurred colour
    const r = Math.min(255, (bC.data[i * cc] * 255) / aB);
    const g = Math.min(255, (bC.data[i * cc + 1] * 255) / aB);
    const b = Math.min(255, (bC.data[i * cc + 2] * 255) / aB);
    // t = how far inside the original silhouette this pixel was; 1 keeps the art untouched
    const t = a0 / 255;
    rgba[q] = Math.round(r + (rgba[q] - r) * t);
    rgba[q + 1] = Math.round(g + (rgba[q + 1] - g) * t);
    rgba[q + 2] = Math.round(b + (rgba[q + 2] - b) * t);
    rgba[q + 3] = aB;
  }
  const out = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 94 }).toBuffer();

  const b = await centreline(src), a = await centreline(out);
  const bs = worstStep(b), as = worstStep(a);
  beforeMax = Math.max(beforeMax, bs); afterMax = Math.max(afterMax, as);
  console.log(`${f.padEnd(18)} steepest edge step ${String(bs).padStart(3)} -> ${String(as).padStart(3)}`);
  if (f === KEY + '.webp' || f === KEY + '_4.webp') {
    console.log(`  before ${b.filter((x,i)=>i%3===0).map((x) => x.k.toFixed(2) + ':' + String(x.a).padStart(3)).join(' ')}`);
    console.log(`  after  ${a.filter((x,i)=>i%3===0).map((x) => x.k.toFixed(2) + ':' + String(x.a).padStart(3)).join(' ')}`);
  }
  if (WRITE) await writeFile(join(OUT, f), out);
}
console.log(`\nworst edge step across the set: ${beforeMax} -> ${afterMax}`);
if (afterMax > 90) { console.error('REFUSING: the silhouette still ends in a cliff.'); process.exit(2); }
console.log(WRITE ? `written to ${OUT}` : '(report only — pass --write)');
