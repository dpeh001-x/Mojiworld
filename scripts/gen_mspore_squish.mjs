#!/usr/bin/env node
// Sprites/projectiles/anim/mspore_0..8.webp — the spore puff's squish loop.
// ============================================================================
// Per user: "i have updated the new mspore, please generate a good squishy animation without
// causing cutoffs".
//
// DERIVED FROM THE SHIPPED SPRITE, NOT REDRAWN. A squish is squash-and-stretch, which is an affine
// transform - the exact thing a transform does perfectly and a redraw does badly. Asking the model
// for nine frames would return nine slightly different creatures (that is precisely what happened
// to the mage ward: the glow flattened and the glyphs changed shape frame to frame). Here every
// frame is the user's own art, so the puff cannot drift, the loop closes exactly, and "no cutoffs"
// is a property of the arithmetic rather than something to hope for and check afterwards.
//
// WHY IT CANNOT CLIP. The sprite is 529x469 of ink inside a 768 canvas, so it carries 117px of side
// margin and 149px of top/bottom. A volume-preserving squash at amplitude A widens the ink to
// 529*(1+A) at its widest, which at A=0.11 is 587 - needing 29px a side against the 117 available.
// The script computes that headroom from the actual file and refuses to run if the requested
// amplitude would not fit, so the margin is checked rather than assumed. Every frame is then
// re-measured for border contact anyway.
//
//   node scripts/gen_mspore_squish.mjs           # what it would do, measured, writes nothing
//   node scripts/gen_mspore_squish.mjs --write   # write the nine frames
//   flags: --amp 0.11   --tilt 2.2
import sharp from 'sharp';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'Sprites', 'projectiles', 'mspore.webp');
const ANIM = join(ROOT, 'Sprites', 'projectiles', 'anim');
const FRAMES = 9;
const has = (f) => process.argv.includes(f);
const argOf = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const AMP = Number(argOf('--amp', '0.11'));    // squash amplitude, volume preserving
const TILT = Number(argOf('--tilt', '2.2'));   // degrees of secondary wobble
const ALPHA_ON = 16;

async function px(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { d: data, w: info.width, h: info.height };
}
function inkBox(p) {
  let x0 = p.w, y0 = p.h, x1 = -1, y1 = -1;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.d[(y * p.w + x) * 4 + 3] > ALPHA_ON) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) throw new Error('fully transparent');
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, W: p.w, H: p.h };
}
// The loop: one full squash-and-stretch cycle across nine frames, so frame 8 flows into frame 0.
// sx * sy === 1 at every step, which is what makes it read as a squishy body holding its volume
// rather than a sprite being scaled. The tilt runs a quarter phase behind the squash - secondary
// motion lagging the primary is what stops it looking mechanical.
const phase = (i) => (2 * Math.PI * i) / FRAMES;
// A SECOND HARMONIC. A single cosine over nine frames is mirror-symmetric - frames i and 9-i share
// a scale - so the turnaround frames differed only by tilt and the loop nearly stalled there (0.37%
// against a 0.35% floor). Adding a half-amplitude overtone at a phase offset breaks that symmetry
// outright, and it is also how a real jelly moves: the wobble rings rather than swinging cleanly.
const _SX = [];
for (let i = 0; i < FRAMES; i++) _SX.push(1 + AMP * (Math.cos(phase(i)) + 0.42 * Math.cos(2 * phase(i) + 1.05)) / 1.42);
const sxOf = (i) => _SX[i];
const syOf = (i) => 1 / sxOf(i);
// sin(phase), NOT sin(phase - PI/2). The latter is just -cos, so it repeated the squash's own
// symmetry: cos over nine evenly spaced frames pairs i with 9-i, which made frames 4 and 5 byte
// identical and the loop stall for a beat. A true quarter-phase lag pairs on a different axis, so
// no two frames coincide - and a secondary motion trailing the primary is what makes it read as
// jelly rather than as a sprite being scaled.
const tiltOf = (i) => TILT * Math.sin(phase(i));

async function frame(src, W, H, i) {
  const sx = sxOf(i), sy = syOf(i);
  const nw = Math.max(1, Math.round(W * sx)), nh = Math.max(1, Math.round(H * sy));
  // scale the WHOLE canvas about its centre, so the puff scales about its own centre too
  let img = await sharp(src).resize(nw, nh, { fit: 'fill' }).png().toBuffer();
  if (TILT) img = await sharp(img).rotate(tiltOf(i), { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  // A volume-preserving squash grows ONE axis while the other shrinks, so the frame is both bigger
  // and smaller than the canvas at once. Pad up to at least the canvas in both axes first, then take
  // the centre crop - handling the axes independently is what the single-branch version got wrong.
  const m = await sharp(img).metadata();
  const PW = Math.max(W, m.width), PH = Math.max(H, m.height);
  const padded = await sharp({ create: { width: PW, height: PH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: img, gravity: 'centre' }]).png().toBuffer();
  return sharp(padded)
    .extract({ left: Math.round((PW - W) / 2), top: Math.round((PH - H) / 2), width: W, height: H })
    .png().toBuffer();
}

const src = await readFile(SRC);
const base = await px(src);
const b0 = inkBox(base);
const marginX = Math.min(b0.x0, b0.W - 1 - b0.x1), marginY = Math.min(b0.y0, b0.H - 1 - b0.y1);
// what the widest frame actually needs, measured off this file
// measured off the real series, not off (1 + AMP): with the overtone the peak is not the amplitude
const maxSx = Math.max(..._SX), maxSy = Math.max(..._SX.map((v) => 1 / v));
const needX = Math.ceil((b0.w * maxSx - b0.w) / 2);
const needY = Math.ceil((b0.h * maxSy - b0.h) / 2);
console.log(`source ${b0.W}x${b0.H}, ink ${b0.w}x${b0.h}, margin ${marginX}px side / ${marginY}px top-bottom`);
console.log(`squash peaks at ${maxSx.toFixed(3)}x / ${maxSy.toFixed(3)}y - needs ${needX}px side and ${needY}px top-bottom, plus ${TILT}deg of tilt`);
if (needX > marginX || needY > marginY) {
  console.error(`REFUSING: amplitude ${AMP} does not fit this sprite's margins — it would clip. Lower --amp.`);
  process.exit(2);
}

const out = [];
for (let i = 0; i < FRAMES; i++) out.push(await frame(src, b0.W, b0.H, i));

// every frame re-measured: the arithmetic says it fits, this proves it did
const bad = [];
let minMargin = 1e9;
for (let i = 0; i < FRAMES; i++) {
  const p = await px(out[i]), b = inkBox(p);
  const mg = Math.min(b.x0, b.y0, b.W - 1 - b.x1, b.H - 1 - b.y1);
  if (mg < minMargin) minMargin = mg;
  if (b.x0 === 0 || b.y0 === 0 || b.x1 >= b.W - 1 || b.y1 >= b.H - 1) bad.push(`frame ${i}: ink on the canvas border`);
  if (p.w !== b0.W || p.h !== b0.H) bad.push(`frame ${i}: canvas is ${p.w}x${p.h}, not ${b0.W}x${b0.H}`);
  console.log(`  frame ${i}: ink ${String(b.w).padStart(3)}x${String(b.h).padStart(3)}  scale ${sxOf(i).toFixed(3)}/${syOf(i).toFixed(3)}  tilt ${tiltOf(i).toFixed(1)}deg  margin ${mg}px`);
}
// and it has to actually move, per step, or it is a still image in nine files
const raws = [];
for (const b of out) raws.push(await px(b));
let minStep = 1e9;
for (let i = 0; i < FRAMES; i++) {
  const a = raws[i], c = raws[(i + 1) % FRAMES];
  let diff = 0;
  for (let k = 3; k < a.d.length; k += 4) diff += Math.abs(a.d[k] - c.d[k]);
  const pct = 100 * diff / (255 * a.w * a.h);
  if (pct < minStep) minStep = pct;
}
if (minStep < 0.35) bad.push(`the loop barely moves: smallest step ${minStep.toFixed(2)}% (want >= 0.35%)`);
console.log(`smallest per-step change ${minStep.toFixed(2)}%, tightest margin ${minMargin}px`);
if (bad.length) { console.error('REJECT:\n  ' + bad.join('\n  ')); process.exit(2); }
if (!has('--write')) { console.log('\nDRY RUN — nothing written. Re-run with --write.'); process.exit(0); }
await mkdir(ANIM, { recursive: true });
for (let i = 0; i < FRAMES; i++) {
  const f = join(ANIM, `mspore_${i}.webp`);
  await writeFile(f + '.tmp', await sharp(out[i]).webp({ quality: 98, alphaQuality: 100, effort: 6 }).toBuffer());
  await rename(f + '.tmp', f);
}
console.log(`\n  ${FRAMES} frames written to Sprites/projectiles/anim/ — same art every frame, loop closes, nothing clipped.`);
