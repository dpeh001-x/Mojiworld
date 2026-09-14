#!/usr/bin/env node
// WARRIOR SHOCKWAVE — a simple red sonic-boom crescent.
// ============================================================================================
// Per user: "just make it a simple sonic red crescent like sonic boom."
//
// WHY THIS IS DERIVED FROM THE USER'S OWN BLADE AND NOT GENERATED. Seven ludo rolls were spent on
// this set. Every one of them repainted the blade: the thin sliver came back fattened, its two horns
// swung together until it was a ring or a donut, and one roll mirrored it (that one shipped as
// v0.30.738). Measured as angular coverage — cast a ray from the centre at every degree and count the
// hits — the user's blade wraps 61% of a turn; the rolls came back 91/93/95/97/100%.
// gen_warrior_shockwave_anim.mjs says in its own header that the still "IS the user's own art and is
// never regenerated or repainted here", and image/edit repaints it by construction.
//
// A sonic boom does not need new art anyway. It needs the SAME crescent with pressure-wave echoes
// travelling off the back of it, so the blade here is the user's file composited untouched — its
// facing, its thinness and its palette are right by definition rather than by gate — and the only
// thing authored is the wave behind it.
//
// The echoes emanate continuously: two of them at staggered phase, each shrinking, sliding back off
// the convex edge and fading out, so frame 8 hands back to frame 0 without a seam.
//
//   node scripts/gen_warrior_shockwave_sonic.mjs            # write the 9 frames
//   node scripts/gen_warrior_shockwave_sonic.mjs --check    # measure only, write nothing
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const STILL = path.join(ROOT, 'scripts/seeds/warrior_shockwave_carved.webp');
const OUT = path.join(ROOT, 'Sprites/projectiles/anim');
const N = 9, SIZE = 768;
// Tuned so the echoes read as successive WAVEFRONTS rather than a motion smear. The first pass kept
// them close (0.42 of the blade width) and shrinking hard (18%), so they sat under the blade as a dark
// ghost. They now travel nearly a full blade-width back, barely contract, and are brightened rather
// than only faded - a pressure wave is energy, and energy does not read as a darker copy.
const ECHOES = 3;          // how many pressure waves are in flight at once
const TRAVEL = 0.92;       // how far back an echo slides, as a fraction of the blade's width
const SHRINK = 0.08;       // how much it contracts over its life
const PEAK = 0.62;         // opacity of a newborn echo

const raw = (b) => sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
async function inkBox(buf) {
  const { data, info } = await raw(buf);
  const { width: W, height: H, channels: C } = info;
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * C + 3] <= 40) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, W, H };
}
// scale about the blade's own centre so an echo contracts in place instead of drifting diagonally
async function echo(still, bb, scale, dx, alpha) {
  const w = Math.max(1, Math.round(bb.W * scale)), h = Math.max(1, Math.round(bb.H * scale));
  const cx = bb.x0 + bb.w / 2, cy = bb.y0 + bb.h / 2;
  const left = Math.round(cx - (cx * scale) + dx), top = Math.round(cy - (cy * scale));
  const img = await sharp(still).resize(w, h, { fit: 'fill' })
    .modulate({ brightness: 1.30, saturation: 1.75 })
    .composite([{ input: Buffer.from([255, 255, 255, Math.round(255 * alpha)]), raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: 'dest-in' }])
    .png().toBuffer();
  return { input: img, left, top };
}

async function build() {
  const still = fs.readFileSync(STILL);
  const bb = await inkBox(still);
  console.log(`blade ${bb.w}x${bb.h} on a ${bb.W}x${bb.H} canvas`);
  const frames = [];
  for (let i = 0; i < N; i++) {
    const t = i / N;
    const layers = [];
    for (let k = 0; k < ECHOES; k++) {
      const p = (t + k / ECHOES) % 1;                       // this echo's life, 0 = just born
      const a = PEAK * Math.pow(1 - p, 1.25);
      if (a < 0.02) continue;
      layers.push(await echo(still, bb, 1 - SHRINK * p, -Math.round(bb.w * TRAVEL * p), a));
    }
    layers.push({ input: still, left: 0, top: 0 });          // the blade itself, untouched, on top
    frames.push(await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(layers).png().toBuffer());
  }
  return frames;
}

// ---- held to the same measures the generator gates on ----
async function arcOf(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  const A = (x, y) => data[((y | 0) * W + (x | 0)) * C + 3];
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (A(x, y) <= 40) continue; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return 1;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.max(x1 - x0, y1 - y0) / 2;
  let hit = 0;
  for (let a = 0; a < 360; a++) {
    const th = a * Math.PI / 180;
    for (let r = 2; r <= R * 1.05; r += 1) {
      const x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r;
      if (x < 0 || y < 0 || x >= W || y >= H) break;
      if (A(x, y) > 40) { hit++; break; }
    }
  }
  return hit / 360;
}
async function bulgeOf(buf) {
  const { data, info } = await raw(buf);
  const { width: W, channels: C } = info;
  const A = (x, y) => data[(y * W + x) * C + 3];
  const bb = await inkBox(buf);
  const rowMax = (y) => { for (let x = bb.x1; x >= bb.x0; x--) if (A(x, y) > 40) return x; return -1; };
  const band = (a, b) => { let v = -1; for (let y = Math.round(bb.y0 + bb.h * a); y <= Math.round(bb.y0 + bb.h * b); y++) { const r = rowMax(y); if (r >= 0) v = Math.max(v, r); } return v; };
  return (band(0.42, 0.58) - Math.max(band(0, 0.18), band(0.82, 1))) / Math.max(1, bb.w - 1);
}
async function motionScore(bufs) {
  const rs = [];
  for (const b of bufs) rs.push(await sharp(b).resize(128, 128, { fit: 'fill' }).ensureAlpha().raw().toBuffer());
  let total = 0;
  for (let i = 0; i < rs.length; i++) {
    const a = rs[i], b = rs[(i + 1) % rs.length];           // includes the 8 -> 0 wrap
    let diff = 0, n = 0;
    for (let p = 0; p < a.length; p += 4) {
      if (a[p + 3] < 20 && b[p + 3] < 20) continue;
      n++; diff += Math.abs(a[p] - b[p]) + Math.abs(a[p + 1] - b[p + 1]) + Math.abs(a[p + 2] - b[p + 2]) + Math.abs(a[p + 3] - b[p + 3]);
    }
    if (n) total += diff / n;
  }
  return total / rs.length;
}

const frames = await build();
// Measure the BLADE, not the composite. The echoes travel back through the crescent's opening, so a
// whole-frame arc reading hits 100% and says "closed into a ring" about a blade that is untouched -
// a false alarm the first run of this script tripped over. What has to be proved here is different:
// that the blade in every frame IS the user's file, pixel for pixel. It is composited last and on
// top, so that is checkable directly.
const still = fs.readFileSync(STILL);
const arc = await arcOf(still), bulge = await bulgeOf(still);
const sRaw = (await raw(still)).data;
let intact = true;
for (const f of frames) {
  const fRaw = (await raw(f)).data;
  for (let p = 0; p < sRaw.length; p += 4) {
    if (sRaw[p + 3] < 250) continue;                        // only the blade's solid pixels
    if (fRaw[p] !== sRaw[p] || fRaw[p + 1] !== sRaw[p + 1] || fRaw[p + 2] !== sRaw[p + 2]) { intact = false; break; }
  }
  if (!intact) break;
}
const score = await motionScore(frames);
console.log(`blade: arc ${(arc * 100).toFixed(0)}%  bulgeRight ${bulge.toFixed(2)}  unaltered in every frame: ${intact}`);
console.log(`wave:  motion ${score.toFixed(1)}`);
const ok = arc <= 0.80 && bulge >= 0.12 && intact && score >= 4;
console.log(ok ? 'PASS' : 'FAIL: ' + [arc > 0.80 && 'blade closed', bulge < 0.12 && 'blade mirrored', !intact && 'the blade was altered', score < 4 && 'too static'].filter(Boolean).join(', '));
if (!ok) process.exit(1);
if (CHECK) { console.log('--check: nothing written'); process.exit(0); }
fs.mkdirSync(OUT, { recursive: true });
for (let i = 0; i < N; i++) {
  const f = path.join(OUT, `warrior_shockwave_${i}.webp`);
  fs.writeFileSync(f + '.tmp', await sharp(frames[i]).webp({ quality: 92, alphaQuality: 100 }).toBuffer());
  fs.renameSync(f + '.tmp', f);
}
console.log(`wrote Sprites/projectiles/anim/warrior_shockwave_0..8.webp`);
