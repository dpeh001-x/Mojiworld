#!/usr/bin/env node
// Restore a missing black keyline on generated animation frames.
// =============================================================================
//   node scripts/restore_keyline.mjs --check  Sprites/monsters/idle/goblinScout
//   node scripts/restore_keyline.mjs --write  Sprites/monsters/idle/goblinScout
//
// WHY THIS EXISTS. The art style puts a hard black keyline around every
// silhouette. Frames generated from a base sprite keep the shape but lose the
// line in patches: measured on goblinScout idle, frames 0 and 8 match the base
// sprite exactly (0% of the perimeter without a line, median line 13 px at
// 768) while frames 1-7 are missing the line across 22.7-27.2% of their
// perimeter, concentrated on the hat crown and the ears.
//
// WHAT IT DOES. It fills the GAPS only, and deliberately does not re-thicken
// the line where it survived. A uniform inner stroke would have been simpler
// and is idempotent over pixels that are already black - but it also blackens
// any feature narrower than twice the stroke, and the frames carry thin ones
// (fingers, the gap between the legs). Restoring only what is missing cannot
// touch a pixel the artist's line already covers.
//
// HOW. Boundary pixels are classified by walking the inward alpha-gradient
// normal looking for a dark run. Pixels with no run are gap sources. Their
// weight is smeared along the perimeter so a restored run fades into its
// neighbours instead of butting against them, then carried inward by a BFS
// that also yields the depth, so the painted line has the same width as the
// good frames and feathers at its inner edge. Every write is modulated by the
// pixel's own alpha, so the antialiased outer edge stays soft.
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, rename, access } from 'node:fs/promises';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const stems = argv.filter((a) => !a.startsWith('--'));
const exists = (p) => access(p).then(() => true, () => false);

const DARK = 70;        // luma below this is keyline black
const PROBE = 4;        // a line must start within this many px of the edge
const LINE_W = 13;      // target width, = median of the base sprite and frames 0/8
const FEATHER = 4;      // inner px over which the restored line fades out
const SMEAR = 9;        // perimeter radius the gap weight is blurred over

const luma = (d, i) => d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;

function analyse(data, W, H) {
  const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && data[(y * W + x) * 4 + 3] > 128;
  const boundary = [], gap = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!on(x, y)) continue;
      if (on(x - 1, y) && on(x + 1, y) && on(x, y - 1) && on(x, y + 1)) continue;
      boundary.push(y * W + x);
      // inward normal from which neighbours are outside
      let gx = 0, gy = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        if (!on(x + dx, y + dy)) { gx -= dx; gy -= dy; }
      }
      const len = Math.hypot(gx, gy) || 1;
      gx /= len; gy /= len;
      let found = false;
      for (let d = 0; d <= PROBE && !found; d++) {
        const nx = Math.round(x + gx * d), ny = Math.round(y + gy * d);
        if (on(nx, ny) && luma(data, (ny * W + nx) * 4) < DARK) found = true;
      }
      if (!found) gap.push(y * W + x);
    }
  }
  return { boundary, gap, on };
}

function restore(data, W, H) {
  const { boundary, gap, on } = analyse(data, W, H);
  if (!gap.length) return { changed: 0, gapPct: 0, boundary: boundary.length };

  // 1. weight field on the perimeter: 1 at a gap, fading over SMEAR px so the
  //    restored run blends into the surviving line rather than butting it
  const weight = new Float32Array(W * H);
  for (const p of gap) weight[p] = 1;
  const bset = new Uint8Array(W * H);
  for (const p of boundary) bset[p] = 1;
  for (let pass = 0; pass < SMEAR; pass++) {
    const next = Float32Array.from(weight);
    for (const p of boundary) {
      const x = p % W, y = (p / W) | 0;
      let s = weight[p], n = 1;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const q = (y + dy) * W + (x + dx);
        if (!dx && !dy) continue;
        if (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= H) continue;
        if (!bset[q]) continue;
        s += weight[q]; n++;
      }
      next[p] = s / n;
    }
    weight.set(next);
  }

  // 2. carry weight + distance inward with a two-pass chamfer transform.
  //    A 4-connected BFS was the first attempt and is wrong here: it yields
  //    Manhattan distance, whose fronts are diamonds, so the restored line came
  //    out visibly stair-stepped along every diagonal and thin over the crown.
  //    Chamfer (1, sqrt2) approximates Euclidean closely enough that the line
  //    reads as drawn rather than rasterised.
  const INF = 1e9;
  const dist = new Float32Array(W * H).fill(INF);
  const carried = new Float32Array(W * H);
  for (const p of boundary) {
    if (weight[p] <= 0.004) continue;
    dist[p] = 0; carried[p] = weight[p];
  }
  const D1 = 1, D2 = Math.SQRT2;
  const relax = (q, p, w) => {
    const nd = dist[p] + w;
    if (nd < dist[q]) { dist[q] = nd; carried[q] = carried[p]; }
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!on(x, y)) continue;
    const q = y * W + x;
    if (x > 0 && on(x - 1, y)) relax(q, q - 1, D1);
    if (y > 0 && on(x, y - 1)) relax(q, q - W, D1);
    if (x > 0 && y > 0 && on(x - 1, y - 1)) relax(q, q - W - 1, D2);
    if (x < W - 1 && y > 0 && on(x + 1, y - 1)) relax(q, q - W + 1, D2);
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    if (!on(x, y)) continue;
    const q = y * W + x;
    if (x < W - 1 && on(x + 1, y)) relax(q, q + 1, D1);
    if (y < H - 1 && on(x, y + 1)) relax(q, q + W, D1);
    if (x < W - 1 && y < H - 1 && on(x + 1, y + 1)) relax(q, q + W + 1, D2);
    if (x > 0 && y < H - 1 && on(x - 1, y + 1)) relax(q, q + W - 1, D2);
  }

  // 3. paint
  let changed = 0;
  for (let p = 0; p < W * H; p++) {
    const d = dist[p];
    if (d > LINE_W) continue;
    const w = carried[p];
    if (w <= 0.004) continue;
    const fade = d <= LINE_W - FEATHER ? 1 : Math.max(0, (LINE_W - d) / FEATHER);
    const k = w * fade;
    if (k <= 0.004) continue;
    const i = p * 4;
    // Darken RGB only, and do NOT scale by alpha. Scaling by it was the first
    // attempt and reads as a thin line: the outermost pixels of a silhouette
    // are semi-transparent, so weighting by alpha left them greenish and the
    // keyline appeared to start a few px inside the edge. On the good frames
    // the line owns the edge - the antialiasing there is black fading to
    // transparent, not green. Alpha is untouched either way, so the edge stays
    // exactly as soft as it was; only its colour changes.
    const m = 1 - k;
    const before = data[i] + data[i + 1] + data[i + 2];
    data[i] = Math.round(data[i] * m);
    data[i + 1] = Math.round(data[i + 1] * m);
    data[i + 2] = Math.round(data[i + 2] * m);
    if (before !== data[i] + data[i + 1] + data[i + 2]) changed++;
  }
  return { changed, gapPct: 100 * gap.length / boundary.length, boundary: boundary.length };
}

for (const stem of stems) {
  for (let i = 0; i < 9; i++) {
    const p = `${stem}_${i}.webp`;
    if (!(await exists(p))) continue;
    const { data, info } = await sharp(await readFile(p)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = Buffer.from(data);
    const r = restore(px, info.width, info.height);
    console.log(`${p}  gap ${r.gapPct.toFixed(1)}% of ${r.boundary} px perimeter` +
      (has('--write') ? `  -> repainted ${r.changed} px` : r.gapPct > 0 ? '  (would repaint)' : '  ok'));
    if (!has('--write') || !r.changed) continue;
    const out = await sharp(px, { raw: { width: info.width, height: info.height, channels: 4 } })
      .webp({ quality: 95 }).toBuffer();
    await writeFile(p + '.tmp', out);        // atomic: never truncate the original
    await rename(p + '.tmp', p);
  }
}
