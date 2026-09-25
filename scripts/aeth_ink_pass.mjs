#!/usr/bin/env node
// AETHERION FORM-1 INK PASS (v0.30.x). Per user: "for aetherion sprites he appear to be blurry and the black outlines
// does not seem uniform throughout, please help to edit".
//
// Measured before the pass, at each set's ON-SCREEN scale (drawn canvas px / source px, read from a live Sanctum draw):
//   form 1  idle 1.66 px, walk 1.48, attack 1.15, astral 1.48 - thin, and absent along the wing rims
//   form 2  idle 2.95 px, walk 3.26, attack 3.26               - bold and even (dark ink: 18.9% of the body vs 3.6-6.8%)
// The pass gives every form-1 frame form 2's line: a stroke straddling the body's edge (40% in, covering the soft rim;
// 60% out), sized per set so it lands at the same on-screen weight whatever the set's calib scale, plus one-sided local
// contrast that pushes existing line art toward the ink colour (no halos: only pixels darker than their neighbourhood
// move). Lightning, sparks, the astral swirl and glowing light are not body and are left alone (see bodyMask).
//
// IDEMPOTENT: it always reads the ORIGINAL art from git (SOURCE_REV, the last commit before the pass), never the files
// on disk, so a re-run reproduces the shipped frames instead of inking them twice.
//   node scripts/aeth_ink_pass.mjs            # write the 36 frames
//   node scripts/aeth_ink_pass.mjs --check    # exit 1 if any shipped frame differs from a fresh pass
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(ROOT, 'package.json'));
const sharp = require2('sharp'); sharp.cache(false);

const SOURCE_REV = '557dd049';                          // v0.30.1022: the untouched art
const INK = [26, 14, 6];                                // form 2's own outline colour, sampled (a warm brown-black)
const GLOW_L = 233;                                     // a neighbourhood this bright is light, not body: no ring
// set -> [on-screen scale, stroke px on screen]. Scale = drawn canvas px / source px (1656 wide) in the game; the
// stroke is tuned so the finished outline measures ~3.2 px on screen, form 2's weight.
const SETS = {
  'idle/aetherion':         [1300 / 1656, 2.3],
  'walk/aetherion':         [860 / 1656, 2.6],
  'attack/aetherion':       [1316 / 1656, 2.7],       // at the x1.6 attack calib (wings spread wide, per user)
  'attack/aetherionastral': [1020 / 1656, 2.6],
};

const INF = 1e9;
function chamfer(W, H, seed) {                          // 3-4 chamfer distance (px) to the nearest seed pixel
  const d = new Float32Array(W * H);
  for (let i = 0; i < d.length; i++) d[i] = seed[i] ? 0 : INF;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; let v = d[i]; if (v === 0) continue;
    if (x > 0) v = Math.min(v, d[i - 1] + 3);
    if (y > 0) { v = Math.min(v, d[i - W] + 3); if (x > 0) v = Math.min(v, d[i - W - 1] + 4); if (x < W - 1) v = Math.min(v, d[i - W + 1] + 4); }
    d[i] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x; let v = d[i]; if (v === 0) continue;
    if (x < W - 1) v = Math.min(v, d[i + 1] + 3);
    if (y < H - 1) { v = Math.min(v, d[i + W] + 3); if (x < W - 1) v = Math.min(v, d[i + W + 1] + 4); if (x > 0) v = Math.min(v, d[i + W - 1] + 4); }
    d[i] = v;
  }
  for (let i = 0; i < d.length; i++) d[i] /= 3;
  return d;
}
function boxBlur(src, W, H, r) {                        // separable box blur, 3 passes (~gaussian)
  const a = Float32Array.from(src), b = new Float32Array(src.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < H; y++) { let s = 0, n = 0; const o = y * W;
      for (let x = -r; x < W + r; x++) {
        if (x + r < W) { s += a[o + x + r]; n++; }
        if (x - r - 1 >= 0) { s -= a[o + x - r - 1]; n--; }
        if (x >= 0 && x < W) b[o + x] = s / n;
      } }
    for (let x = 0; x < W; x++) { let s = 0, n = 0;
      for (let y = -r; y < H + r; y++) {
        if (y + r < H) { s += b[(y + r) * W + x]; n++; }
        if (y - r - 1 >= 0) { s -= b[(y - r - 1) * W + x]; n--; }
        if (y >= 0 && y < H) a[y * W + x] = s / n;
      } }
  }
  return a;
}

// THE BODY. Attack frames carry lightning and sparks, the astral set a violet sparkle swirl; none of it is body. An
// opening of the solid mask (erode K, keep components >= 10% of the largest) finds body + wings; a geodesic regrow of
// GROW px through solid, non-violet pixels gives back the horns, claws and spikes the erosion cut.
function bodyMask(data, W, H, opaque, dToClear) {
  const N = W * H, K = 8, GROW = 34;
  const fx = new Uint8Array(N);
  for (let i = 0; i < N; i++) { const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]; fx[i] = (b - g > 30 && r - g > 5) ? 1 : 0; }
  const lab = new Int32Array(N), sizes = [0], stack = new Int32Array(N);
  for (let s = 0; s < N; s++) {
    if (lab[s] || dToClear[s] <= K || fx[s]) continue;
    const id = sizes.length; let sp = 0, n = 0; stack[sp++] = s; lab[s] = id;
    while (sp) { const i = stack[--sp]; n++; const x = i % W;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (j < 0 || j >= N || lab[j] || dToClear[j] <= K || fx[j]) continue;
        if ((j === i - 1 && x === 0) || (j === i + 1 && x === W - 1)) continue;
        lab[j] = id; stack[sp++] = j; } }
    sizes.push(n);
  }
  let big = 0; for (let k = 1; k < sizes.length; k++) if (sizes[k] > big) big = sizes[k];
  const dist = new Int16Array(N).fill(-1); let qh = 0, qt = 0;
  for (let i = 0; i < N; i++) if (lab[i] && sizes[lab[i]] >= big * 0.10) { dist[i] = 0; stack[qt++] = i; }
  while (qh < qt) { const i = stack[qh++], x = i % W;
    if (dist[i] >= K + GROW) continue;
    for (const j of [i - 1, i + 1, i - W, i + W, i - W - 1, i - W + 1, i + W - 1, i + W + 1]) {
      if (j < 0 || j >= N || dist[j] >= 0 || !opaque[j] || fx[j]) continue;
      if (Math.abs((j % W) - x) > 1) continue;
      dist[j] = dist[i] + 1; stack[qt++] = j; } }
  const body = new Uint8Array(N); for (let i = 0; i < N; i++) body[i] = dist[i] >= 0 ? 1 : 0;
  return body;
}

export async function inkPass(input, scale, T) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H, Tsrc = T / scale;
  const px = new Float32Array(N * 4); for (let i = 0; i < N * 4; i++) px[i] = data[i];
  const opaque = new Uint8Array(N), clear = new Uint8Array(N);
  for (let i = 0; i < N; i++) { const a = data[i * 4 + 3]; opaque[i] = a > 128 ? 1 : 0; clear[i] = a <= 128 ? 1 : 0; }
  const dToClear = chamfer(W, H, clear), body = bodyMask(data, W, H, opaque, dToClear);
  // glow: a large bright blob (the mouth orb, the tail light, the astral starburst) keeps its soft edge
  const Lop = new Float32Array(N), Wop = new Float32Array(N);
  for (let i = 0; i < N; i++) if (opaque[i]) { Lop[i] = 0.3 * data[i * 4] + 0.59 * data[i * 4 + 1] + 0.11 * data[i * 4 + 2]; Wop[i] = 1; }
  const gR = Math.max(3, Math.round(4 / scale)), LopB = boxBlur(Lop, W, H, gR), WopB = boxBlur(Wop, W, H, gR);
  const glow = (i) => WopB[i] > 0.05 && LopB[i] / WopB[i] > GLOW_L;
  // 1. INK THE LINES: a body pixel darker than its neighbourhood is line art, pushed toward the ink colour in
  //    proportion to how much darker (14 -> 60 levels: none -> full). Flat areas and highlights never move.
  const L = new Float32Array(N);
  for (let i = 0; i < N; i++) L[i] = data[i * 4 + 3] > 24 ? (0.3 * data[i * 4] + 0.59 * data[i * 4 + 1] + 0.11 * data[i * 4 + 2]) : 255;
  const Lb = boxBlur(L, W, H, Math.max(1, Math.round(1.6 / scale)));
  for (let i = 0; i < N; i++) {
    if (!body[i] || L[i] > 180) continue;
    const d = Lb[i] - L[i]; if (d <= 14) continue;
    const k = Math.min(1, (d - 14) / 46);
    for (let c = 0; c < 3; c++) px[i * 4 + c] = px[i * 4 + c] * (1 - k) + INK[c] * k;
  }
  // 2. THE STROKE: straddles the body's edge, 40% inside (covers the soft, uneven rim) and 60% outside.
  const dToBody = chamfer(W, H, body), tin = 0.4 * Tsrc, tout = 0.6 * Tsrc;
  const out = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    let r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], a = px[i * 4 + 3] / 255;
    if (!glow(i)) {
      if (opaque[i]) {
        const cov = body[i] ? Math.max(0, Math.min(1, tin + 0.5 - dToClear[i])) : 0;
        if (cov > 0) { r = r * (1 - cov) + INK[0] * cov; g = g * (1 - cov) + INK[1] * cov; b = b * (1 - cov) + INK[2] * cov; }
      } else {
        const cov = Math.max(0, Math.min(1, tout + 0.5 - dToBody[i]));
        if (cov > 0) {                                  // the original pixel OVER the ink ring
          const ao = a + cov * (1 - a);
          r = (r * a + INK[0] * cov * (1 - a)) / ao; g = (g * a + INK[1] * cov * (1 - a)) / ao; b = (b * a + INK[2] * cov * (1 - a)) / ao; a = ao;
        }
      }
    }
    out[i * 4] = Math.round(r); out[i * 4 + 1] = Math.round(g); out[i * 4 + 2] = Math.round(b); out[i * 4 + 3] = Math.round(a * 255);
  }
  return sharp(out, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toBuffer();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const CHECK = process.argv.includes('--check');
  let n = 0, bad = 0;
  for (const [set, [scale, T]] of Object.entries(SETS)) {
    for (let i = 0; ; i++) {
      const rel = `Sprites/bosses/${set}_${i}.webp`;
      let src; try { src = execFileSync('git', ['-C', ROOT, 'show', `${SOURCE_REV}:${rel}`], { maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { break; }
      const buf = await inkPass(src, scale, T), file = path.join(ROOT, rel);
      if (CHECK) { if (!fs.existsSync(file) || !fs.readFileSync(file).equals(buf)) { bad++; console.log('stale ' + rel); } }
      else { fs.writeFileSync(file + '.tmp', buf); fs.renameSync(file + '.tmp', file); }
      n++;
    }
  }
  console.log(`${CHECK ? 'checked' : 'inked'} ${n} frames${CHECK ? ', ' + bad + ' stale' : ''}`);
  if (CHECK && bad) process.exit(1);
}
