// Thin the black contour on a sprite without touching the art inside it.
//
//   node scripts/thin_sprite_outline.mjs <in.webp> <out.webp> [shavePx] [--lo=30] [--hi=100] [--sigma=12]
//
// The ludo.ai "chunky cartoon game sprite" style draws a very heavy contour:
// measured across Sprites/projectiles, p_flamefist's stroke sat at 3.13% of its
// longest side where the family median is 0.66% and the 75th percentile 1.95%.
// Regenerating would roll a different fist, so this shaves the stroke
// deterministically and leaves every other pixel byte-identical.
//
// HOW, and why not the obvious way. The obvious way is "delete near-black
// pixels within K of the outside", and it fails on this art: the contour is a
// crisp stroke on the hand but a soft dark GRADIENT along the top of the flame,
// so a hard colour threshold cuts that gradient at an arbitrary iso-line and
// the peel leaves a notched, chewed edge with detached crescents (measured: 4x
// zoom on the upper flame, and 2 extra black fragments at T=9, 11 at T=6).
//
// So erode the SILHOUETTE instead, by a smoothly-varying amount:
//   w(p)   blackness, ramped over max(r,g,b) in [lo,hi] - no hard cutoff
//   b(p)   w averaged over the candidate rim and blurred along the contour,
//          so the shave amount cannot jump between neighbouring edge pixels
//   alpha *= clamp(dOut - K*b + 0.5, 0, 1)      dOut = exact Euclidean EDT
// Where the rim is black the silhouette pulls back K and the band thins by K;
// where the rim is coloured art (the flame tail has no outline at all) b -> 0
// and nothing moves; and because both fields are smooth the new edge stays
// smooth and anti-aliased instead of stepping.
import sharp from 'sharp';

const [IN, OUT, K_S, ...rest] = process.argv.slice(2);
if (!IN || !OUT) { console.error('usage: thin_sprite_outline.mjs <in> <out> [shavePx]'); process.exit(2); }
const K = Number(K_S || 10);
const opt = (n, d) => Number((rest.find(a => a.startsWith(`--${n}=`)) || `--${n}=${d}`).split('=')[1]);
const LO = opt('lo', 30), HI = opt('hi', 100), SIGMA = opt('sigma', 12);

// exact 1-D squared-distance transform (Felzenszwalb & Huttenlocher)
function edt1d(f, n) {
  const d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s;
    for (;;) { s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); if (s <= z[k]) k--; else break; }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  for (let q = 0, kk = 0; q < n; q++) { while (z[kk + 1] < q) kk++; d[q] = (q - v[kk]) * (q - v[kk]) + f[v[kk]]; }
  return d;
}
function edt(mask, W, H) {                          // distance to the nearest mask==1 pixel
  const INF = 1e12, f = new Float64Array(Math.max(W, H)), g = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) g[i] = mask[i] ? 0 : INF;
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) f[y] = g[y * W + x];
    const d = edt1d(f, H); for (let y = 0; y < H; y++) g[y * W + x] = d[y];
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) f[x] = g[y * W + x];
    const d = edt1d(f, W); for (let x = 0; x < W; x++) g[y * W + x] = Math.sqrt(d[x]);
  }
  return g;
}
const blur = async (arr, W, H) => {                 // gaussian over a 0..1 field, via sharp
  const u8 = Buffer.alloc(W * H);
  for (let i = 0; i < W * H; i++) u8[i] = Math.round(Math.max(0, Math.min(1, arr[i])) * 255);
  // sharp hands a 1-channel raw input back as THREE channels after a blur, so
  // read the stride it actually returns rather than assuming 1. Indexing this
  // wrong silently scrambled the field: measured mean rim blackness 0.907 came
  // out of the ratio as 0.210, and the shave collapsed to a fifth of its dial.
  const { data: o, info: oi } = await sharp(u8, { raw: { width: W, height: H, channels: 1 } })
    .blur(SIGMA).raw().toBuffer({ resolveWithObject: true });
  const st = oi.channels, f = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) f[i] = o[i * st] / 255;
  return f;
};

const { data, info } = await sharp(IN).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info, N = W * H;
const clear = new Uint8Array(N), wBlack = new Float64Array(N);
for (let i = 0; i < N; i++) {
  clear[i] = data[i * C + 3] > 24 ? 0 : 1;
  const mx = Math.max(data[i * C], data[i * C + 1], data[i * C + 2]);
  wBlack[i] = Math.max(0, Math.min(1, (HI - mx) / (HI - LO)));
}
const dOut = edt(clear, W, H);

// how black is the rim, averaged over the band we would shave and smoothed
// along the contour so the shave cannot jump between neighbouring edge pixels
const num = new Float64Array(N), den = new Float64Array(N);
for (let i = 0; i < N; i++) if (!clear[i] && dOut[i] <= K) { num[i] = wBlack[i]; den[i] = 1; }
const nB = await blur(num, W, H), dB = await blur(den, W, H);
const b = new Float64Array(N);
for (let i = 0; i < N; i++) b[i] = dB[i] > 0.02 ? Math.max(0, Math.min(1, nB[i] / dB[i])) : 0;

let removed = 0, softened = 0, shaveSum = 0, shaveN = 0;
const out = Buffer.from(data);
for (let i = 0; i < N; i++) {
  if (clear[i] || dOut[i] > K + 1) continue;
  const shave = K * b[i];
  if (dOut[i] <= K) { shaveSum += shave; shaveN++; }
  const f = Math.max(0, Math.min(1, dOut[i] - shave + 0.5));
  if (f >= 1) continue;
  const a = out[i * C + 3], na = Math.round(a * f);
  if (na === 0 && a > 0) removed++; else if (na !== a) softened++;
  out[i * C + 3] = na;
}
// SAFETY: erosion must not break the sprite into pieces
const countComp = (alphaOf) => {
  const seen = new Uint8Array(N); let n = 0, biggest = 0;
  for (let s = 0; s < N; s++) {
    if (!alphaOf(s) || seen[s]) continue;
    const q = [s]; seen[s] = 1; let sz = 0;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % W, y = (i / W) | 0; sz++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx; if (alphaOf(j) && !seen[j]) { seen[j] = 1; q.push(j); }
      }
    }
    if (sz >= 64) { n++; biggest = Math.max(biggest, sz); }
  }
  return { n, biggest };
};
const was = countComp(i => data[i * C + 3] > 24), now = countComp(i => out[i * C + 3] > 24);
if (now.n > was.n) console.warn(`WARN: silhouette split ${was.n} -> ${now.n} parts (shave ${K} may be too deep)`);
await sharp(out, { raw: { width: W, height: H, channels: C } })
  // Only alpha changes here, but any lossy encode requantises RGB too, and
  // measured on p_flamefist the drift is mean 0.9/255 (max 14) at BOTH q92 and
  // q95 - it comes from decoding an already-lossy source, not from the quality
  // dial, so raising quality buys size and not fidelity. q95 is chosen for size
  // parity with the source (43.4 -> 44.6 KB); lossless would be 174 KB, 4x the
  // file for nothing visible at a 104px draw. Do not run this repeatedly on its
  // own output - the drift is per generation.
  .webp({ quality: 95, alphaQuality: 100, effort: 6 }).toFile(OUT);
console.log(`${IN.split('/').pop()} -> ${OUT.split('/').pop()}  shave<=${K}px (mean applied ${(shaveSum / (shaveN || 1)).toFixed(1)}px)`
  + `  removed ${removed}  feathered ${softened}  parts ${was.n}->${now.n}`);
