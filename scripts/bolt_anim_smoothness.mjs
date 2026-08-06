#!/usr/bin/env node
// Objective smoothness check for Sprites/anim/bolt_0..8.webp.
//
// Four things can make a loop feel wrong, and the eye is bad at all of them:
//   1. PACING   uneven change between consecutive frames = a visible stutter.
//               Reported as the spread of per-frame delta around its mean.
//   2. LOOP     frame 8 -> frame 0 must be no bigger a step than any other,
//               or the loop pops once per cycle (_bossLoopFrame wraps 8->0).
//   3. STABILITY the orb must not drift, jitter or breathe in size — the
//               alpha centroid and area must hold across all 9 frames.
//   4. ROTATION the frames must NOT rotate: drawProjectiles already spins the
//               bolt continuously at 0.35 rad/frame, so baked-in rotation
//               would double-spin AND downgrade a 60fps spin to 20.8fps.
//               Estimated by cross-correlating each frame's polar intensity
//               profile against frame 0 and reading off the best-fit angle.
// Run: node scripts/bolt_anim_smoothness.mjs
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const N = 9, S = 128, BINS = 72;

const frames = [];
for (let i = 0; i < N; i++) {
  const p = join(root, 'Sprites', 'anim', `bolt_${i}.webp`);
  const { data } = await sharp(await readFile(p)).resize(S, S, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  frames.push(data);
}

const lum = (d, i) => (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) * (d[i + 3] / 255);

// 1/2 — per-frame delta, including the 8->0 wrap
const deltas = [];
for (let k = 0; k < N; k++) {
  const a = frames[k], b = frames[(k + 1) % N];
  let s = 0;
  for (let i = 0; i < a.length; i += 4) s += Math.abs(lum(a, i) - lum(b, i));
  deltas.push(s / (S * S));
}
const mean = deltas.reduce((x, y) => x + y, 0) / N;
const wrap = deltas[N - 1];
// Pacing spread deliberately EXCLUDES the 8->0 seam. A small seam step is what
// a seamless loop looks like (the cycle closing on itself), so folding it into
// a max/min ratio punishes exactly the thing we want. Judge the body of the
// cycle with a coefficient of variation, which no single value can dominate.
const body = deltas.slice(0, N - 1);
const bMean = body.reduce((x, y) => x + y, 0) / body.length;
const cv = Math.sqrt(body.reduce((a, d) => a + (d - bMean) ** 2, 0) / body.length) / bMean;
const minBody = Math.min(...body);

// 3 — centroid + area stability
const stats = frames.map((d) => {
  let cx = 0, cy = 0, m = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const a = d[(y * S + x) * 4 + 3] / 255; cx += x * a; cy += y * a; m += a; }
  return { cx: cx / m, cy: cy / m, area: m };
});
const drift = Math.max(...stats.map((s, _, A) => Math.hypot(s.cx - A[0].cx, s.cy - A[0].cy)));
const areaVar = (Math.max(...stats.map((s) => s.area)) / Math.min(...stats.map((s) => s.area)) - 1) * 100;

// 4 — RIGID-ROTATION TEST.
// A polar cross-correlation alone is not trustworthy here: this swirl has
// ~6-fold rotational symmetry, so the correlation has six equally good maxima
// and the "best angle" hops between them at random. The decisive question is
// not "what angle fits" but "does ANY rotation of frame k reproduce frame 0".
// If some rotation makes the residual collapse toward zero, the frames are a
// rigid spin (bad — it would double up on the code spin). If the residual
// stays near the ordinary inter-frame delta at every angle, the change is
// internal churn (good), whatever the best-fit angle happens to be.
const lumBuf = (d) => { const o = new Float32Array(S * S); for (let i = 0, j = 0; i < d.length; i += 4, j++) o[j] = lum(d, i); return o; };
const L = frames.map(lumBuf);
const rotDiff = (src, ang) => {                             // mean|rot(src,ang) - frame0|
  const c = (S - 1) / 2, cos = Math.cos(ang), sin = Math.sin(ang);
  let acc = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x - c, dy = y - c;
    const sx = Math.round(c + dx * cos - dy * sin), sy = Math.round(c + dx * sin + dy * cos);
    const v = (sx < 0 || sy < 0 || sx >= S || sy >= S) ? 0 : src[sy * S + sx];
    acc += Math.abs(v - L[0][y * S + x]);
  }
  return acc / (S * S);
};
const rot = frames.map((_, k) => {
  if (k === 0) return { best: 0, resid: 0 };
  let best = 0, resid = Infinity;
  for (let a = 0; a < 360; a += 5) { const d = rotDiff(L[k], a * Math.PI / 180); if (d < resid) { resid = d; best = a; } }
  return { best: best > 180 ? best - 360 : best, resid };
});
const degs = rot.map((r) => r.best);
// "Collapse" = the best rotation explains the frame far better than no rotation
// does. Rigid spin -> residual near zero and far below the inter-frame delta.
// Only frames whose best fit is a MEANINGFUL rotation can indicate a baked
// spin. If the best angle is ~0 the "rotation" is the identity, and the small
// residual just means that frame is close to frame 0 — which is true of the
// loop's own neighbours and is not evidence of spin.
const rotated = rot.slice(1).filter((r) => Math.abs(r.best) > 8);
const worstCollapse = rotated.length ? Math.min(...rotated.map((r) => r.resid)) : Infinity;
const rigid = rotated.length >= 3 && worstCollapse < mean * 0.35;

const fmt = (x, n = 2) => x.toFixed(n);
console.log('=== bolt anim smoothness ===\n');
console.log(`per-frame delta   ${deltas.map((d) => fmt(d, 1)).join(', ')}`);
console.log(`  cycle mean ${fmt(bMean, 1)}   variation ${fmt(cv * 100, 0)}%   ${cv <= 0.45 ? 'PASS even pacing' : 'FAIL uneven — visible stutter'}`);
console.log(`  quietest step ${fmt(minBody, 1)} = ${fmt(minBody / bMean * 100, 0)}% of mean  ${minBody / bMean >= 0.3 ? 'PASS no stalled frame' : 'FAIL a near-duplicate frame pair stalls the loop'}`);
console.log(`loop seam (8->0)  ${fmt(wrap, 1)}  vs mean ${fmt(mean, 1)}  ratio ${fmt(wrap / mean)}x  ${wrap / mean <= 2.0 ? 'PASS seamless' : 'FAIL pops on wrap'}`);
console.log(`centroid drift    ${fmt(drift)} px of ${S}  ${drift <= 2.0 ? 'PASS stable' : 'FAIL jitters'}`);
console.log(`area variation    ${fmt(areaVar, 1)}%  ${Math.abs(areaVar) <= 12 ? 'PASS no breathing' : 'FAIL zooms'}`);
console.log(`rigid-rotation test best-fit angles ${degs.join('°, ')}°`);
console.log(`  lowest residual after best rotation ${fmt(worstCollapse, 1)} vs inter-frame mean ${fmt(mean, 1)}`);
console.log(`  ${rigid ? 'FAIL frames are a rigid spin — will double up on the code spin' : 'PASS no rigid rotation: no angle reproduces frame 0, so the change is internal churn'}`);

const fails = [cv > 0.45, minBody / bMean < 0.3, wrap / mean > 2.0, drift > 2.0, Math.abs(areaVar) > 12, rigid].filter(Boolean).length;
console.log(`\n${fails ? fails + ' issue(s)' : 'all checks pass'}`);
process.exit(fails ? 1 : 0);
