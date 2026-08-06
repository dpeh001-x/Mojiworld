#!/usr/bin/env node
// Complete a die-cut sticker sprite's white rim where the artist stopped short.
// =============================================================================
// death_tombstone.png was drawn with the white contour covering 77% of its
// upward-facing edges but only 27% of its downward ones — the base of the
// stone had no rim at all.
//
// This is STRICTLY ADDITIVE: the original pixels are never modified. It finds
// the silhouette edges that currently lack a rim, and grows white outward from
// only those, leaving the artist's existing rim untouched.
//
// Why not rebuild the rim uniformly from a colour-classified "core"? Tried,
// and rejected on this art. Isolating the core needs a wall to flood against;
// the rim's own antialiased fringe (~185,185,183 @ a=163) defeats a "pure
// white" test, and flooding to the art's dark contour instead escapes into the
// stone exactly where the rim is missing — because the missing rim means a
// missing contour there too. It collapsed the core to 30% of the sprite.
// Additive growth needs no such classification.
//
// The join is seamless when radius == the existing rim thickness: where a rim
// exists the silhouette is already core+T, and this brings the bare edges out
// to core+T as well, so the outer boundary is continuous.
//
//   node tools/complete_sticker_outline.mjs <png> [--radius N] [--out FILE]
//   node tools/complete_sticker_outline.mjs <png> --measure     (report only)
// Writes atomically (tmp -> verify -> rename) per the file-safety rules.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
import { renameSync, unlinkSync, existsSync } from 'node:fs';

const [srcPath, ...flags] = process.argv.slice(2);
if (!srcPath) { console.error('usage: complete_sticker_outline.mjs <png> [--radius N] [--out FILE]'); process.exit(1); }
if (!existsSync(srcPath)) { console.error('no such file: ' + srcPath); process.exit(1); }
const flag = (f) => { const i = flags.indexOf(f); return i >= 0 ? flags[i + 1] : null; };
const MEASURE = flags.includes('--measure');
const OUTPATH = flag('--out') || srcPath;

const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, C = info.channels, N = W * H;
const idx = (x, y) => y * W + x;
const A = (i) => data[i * C + 3];
const lum = (i) => (data[i * C] + data[i * C + 1] + data[i * C + 2]) / 3;
const OPAQUE = 40, LIGHT = 170;
const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && A(idx(x, y)) > OPAQUE;

// ---- edges that already carry a rim vs edges that are bare ----------------
// A rimmed edge pixel is light (the white contour). A bare one is artwork
// meeting empty space directly.
// "Already rimmed?" is answered by looking INWARD, not at the boundary pixel
// itself. That pixel is the rim's antialiased outer edge and can sit as low as
// ~150-185 luminance; testing it directly re-seeds genuinely rimmed edges and
// grows a second ring on top of the artist's (which is what first happened).
// Solid white (>=205) within 3px inward means a rim is present here.
const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const SOLID_WHITE = 205, LOOK = 3;
const seeds = new Uint8Array(N);
let edges = 0, rimmed = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (!solid(x, y)) continue;
  for (const [dx, dy] of DIRS) {
    if (solid(x + dx, y + dy)) continue;              // not an edge this way
    edges++;
    let has = false;
    for (let k = 0; k <= LOOK; k++) {                 // walk inward, away from the gap
      const cx = x - dx * k, cy = y - dy * k;
      if (!solid(cx, cy)) break;
      if (lum(idx(cx, cy)) >= SOLID_WHITE) { has = true; break; }
    }
    if (has) rimmed++;
    else seeds[idx(x, y)] = 1;                        // bare edge -> grow a rim here
  }
}
// Drop tiny seed clusters. A genuinely un-rimmed stretch is a long contiguous
// run along the silhouette (here: the whole base); isolated 1-3px hits are
// detection noise where the rim thins or a dark detail touches the edge, and
// growing a 5px disc from those puts visible blobs on an otherwise clean arch.
const MIN_RUN = 10;
{
  const seen = new Uint8Array(N);
  let dropped = 0;
  for (let i0 = 0; i0 < N; i0++) {
    if (!seeds[i0] || seen[i0]) continue;
    const comp = [i0]; seen[i0] = 1;
    for (let h = 0; h < comp.length; h++) {
      const i = comp[h], x = i % W, y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const cx = x + dx, cy = y + dy;
        if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
        const j = idx(cx, cy);
        if (seeds[j] && !seen[j]) { seen[j] = 1; comp.push(j); }
      }
    }
    if (comp.length < MIN_RUN) { for (const j of comp) seeds[j] = 0; dropped += comp.length; }
  }
  if (dropped) console.log(`  dropped ${dropped} isolated seed px (clusters < ${MIN_RUN})`);
}
let seedCount = 0;
for (let i = 0; i < N; i++) if (seeds[i]) seedCount++;
const covPct = edges ? (100 * rimmed / edges) : 0;

// Existing rim thickness: march outward from a bare-adjacent light pixel.
// Measured only where a rim exists, so the bare base cannot skew it.
const runs = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = idx(x, y);
  if (A(i) <= OPAQUE || lum(i) >= LIGHT) continue;        // start from real art
  for (const [dx, dy] of DIRS) {
    let n = 0, cx = x + dx, cy = y + dy;
    while (solid(cx, cy) && lum(idx(cx, cy)) >= LIGHT && n < 24) { n++; cx += dx; cy += dy; }
    if (n > 0 && !solid(cx, cy)) runs.push(n);            // rim that ends in空 space
  }
}
runs.sort((a, b) => a - b);
const median = runs.length ? runs[runs.length >> 1] : 4;
const R = flag('--radius') ? Number(flag('--radius')) : Math.max(2, median);
console.log(srcPath);
console.log(`  ${W}x${H}   silhouette edge px ${edges}   rimmed ${rimmed} (${covPct.toFixed(1)}%)   bare ${seedCount}`);
console.log(`  existing rim thickness: median ${median}px over ${runs.length} samples  ->  growing bare edges at radius ${R}`);
if (MEASURE) process.exit(0);
if (!seedCount) { console.log('  nothing to do — every edge is already rimmed.'); process.exit(0); }

// ---- exact Euclidean distance from the bare edges (Felzenszwalb) ----------
// A chamfer approximation was tried first and rejected: its octagonal error
// put visible notches in the new rim. This is exact, so the ring is circular.
const INF = 1e20;
const dt1d = (f, n, d, v, z) => {
  let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
};
const D = new Float64Array(N);
for (let i = 0; i < N; i++) D[i] = seeds[i] ? 0 : INF;
{
  const M = Math.max(W, H);
  const f = new Float64Array(M), d = new Float64Array(M);
  const v = new Int32Array(M), z = new Float64Array(M + 1);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) f[y] = D[idx(x, y)];
    dt1d(f, H, d, v, z);
    for (let y = 0; y < H; y++) D[idx(x, y)] = d[y];
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) f[x] = D[idx(x, y)];
    dt1d(f, W, d, v, z);
    for (let x = 0; x < W; x++) D[idx(x, y)] = d[x];
  }
}
for (let i = 0; i < N; i++) D[i] = Math.sqrt(D[i]);

// ---- paint white under the art, original composited on top ---------------
const out = Buffer.alloc(N * 4);
let added = 0;
for (let i = 0; i < N; i++) {
  const o = i * 4, s = i * C, sa = A(i);
  if (sa >= 250) {                                   // untouched original art
    out[o] = data[s]; out[o + 1] = data[s + 1]; out[o + 2] = data[s + 2]; out[o + 3] = 255;
    continue;
  }
  const ringA = Math.round(Math.max(0, Math.min(1, R + 0.5 - D[i])) * 255);
  if (ringA > 0 && sa <= OPAQUE) added++;
  const a1 = sa / 255, a2 = (ringA / 255) * (1 - a1), aOut = a1 + a2;
  if (aOut <= 0) { out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0; continue; }
  out[o]     = Math.round((data[s]     * a1 + 255 * a2) / aOut);
  out[o + 1] = Math.round((data[s + 1] * a1 + 255 * a2) / aOut);
  out[o + 2] = Math.round((data[s + 2] * a1 + 255 * a2) / aOut);
  out[o + 3] = Math.round(aOut * 255);
}

const tmp = OUTPATH + '.tmp.png';
await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(tmp);
try {
  const { data: vd, info: vi } = await sharp(tmp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (vi.width !== W || vi.height !== H) throw new Error(`size changed: ${vi.width}x${vi.height}`);
  const VC = vi.channels;
  // Every original opaque pixel must be byte-identical — this is additive.
  let n = 0;
  for (let i = 0; i < N; i++) {
    if (A(i) < 250) continue;
    n++;
    if (vd[i * VC] !== data[i * C] || vd[i * VC + 1] !== data[i * C + 1] ||
        vd[i * VC + 2] !== data[i * C + 2] || vd[i * VC + 3] < 250)
      throw new Error(`original art altered at px ${i % W},${(i / W) | 0}`);
  }
  // ...and the result must now be rimmed on every facing.
  // Same inward-looking definition the seeder uses — a verifier that asks a
  // different question than the fixer will always disagree with it.
  const sol = (x, y) => x >= 0 && y >= 0 && x < W && y < H && vd[idx(x, y) * VC + 3] > OPAQUE;
  const vlum = (x, y) => { const i = idx(x, y) * VC; return (vd[i] + vd[i + 1] + vd[i + 2]) / 3; };
  let e2 = 0, r2 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!sol(x, y)) continue;
    for (const [dx, dy] of DIRS) {
      if (sol(x + dx, y + dy)) continue;
      e2++;
      for (let k = 0; k <= LOOK; k++) {
        const cx = x - dx * k, cy = y - dy * k;
        if (!sol(cx, cy)) break;
        if (vlum(cx, cy) >= SOLID_WHITE) { r2++; break; }
      }
    }
  }
  const pct2 = e2 ? (100 * r2 / e2) : 0;
  // Not 99.5: dropping sub-MIN_RUN noise clusters intentionally leaves a
  // handful of stray edge px unrimmed, which is the right trade against
  // blobbing the silhouette. The base — the actual defect — is fully closed.
  if (pct2 < 95) throw new Error(`rim coverage still only ${pct2.toFixed(1)}%`);
  console.log(`  verified: all ${n} original art px byte-identical · +${added} rim px · coverage ${covPct.toFixed(1)}% -> ${pct2.toFixed(1)}%`);
} catch (e) {
  try { unlinkSync(tmp); } catch (_) {}
  console.error('VERIFY FAILED, target untouched — ' + e.message);
  process.exit(1);
}
renameSync(tmp, OUTPATH);
console.log(`  wrote ${OUTPATH}`);
