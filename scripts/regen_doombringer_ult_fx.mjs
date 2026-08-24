#!/usr/bin/env node
// Regenerate the Calamity Incarnate (doombringer B-slot ultimate) cast FX.
//
// Per user: "further improve and do not rotate doombringer B skill sword
// animation." The rotation came from two places and both had to go: the spawn
// passed spin: 0.3, AND the art itself tilts the blade 18 degrees across the
// nine frames. Removing only the first would have left the sword still wobbling.
//
// WHAT WAS WRONG, measured on the art this replaces:
//
//   steps        34 30 101 151 319 250 149 81 21     cv 0.77
//   blade angle  -66.7 -67.4 -67.3 -49.3 -60.2 ...   spread 18.1 deg
//   grey shadow  4.9 4.5 2.0 8.6 8.2 1.7 2.7 4.7 5.2
//
// 1. The pacing lurches: three near-still frames (34, 30), then a 319 jump, then
//    back to 21. Fifteen times the motion in one step as in another.
// 2. The blade swings 18 degrees - the tilt the user is objecting to.
// 3. A grey ground shadow is baked under a MID-AIR effect, and it pulses 5x
//    frame to frame, so it flickers.
//
// The fix is to hold the sword perfectly still and put all the motion in the
// fire, which is what an ultimate's cast VFX wants anyway.
//
//   node scripts/regen_doombringer_ult_fx.mjs             # measure what is on disk
//   node scripts/regen_doombringer_ult_fx.mjs --generate  # needs LUDO_API_KEY
import sharp from 'sharp';
import { writeFile, rename } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STILL = join(ROOT, 'Sprites', 'fx', 'doombringer_ult.webp');
const ANIM = join(ROOT, 'Sprites', 'fx', 'anim');
const KEY = 'doombringer_ult';
const FRAMES = 9, ANIM_PX = 952;
const has = (f) => process.argv.slice(2).includes(f);

const MAX_TILT = 5.0;    // degrees of blade swing across the whole set (was 18.1)
const MAX_CV = 0.38;     // pacing (was 0.77)
const MIN_STEP = 60;     // mean frame-to-frame change: it must actually animate
const MAX_SHADOW_SPREAD = 3.0;  // % swing in the baked ground shadow (was 6.9)

const MOTION =
  'the burning sword stands PERFECTLY STILL while the fire around it roars and ' +
  'surges. The flames climb and billow upward, the purple outer fire churns, ' +
  'embers and sparks lift off and drift up, and the blade itself glows hotter ' +
  'and brighter as the cast builds - ending at full blaze with sparks streaming ' +
  'off it. ' +
  'CRITICAL - THE SWORD MUST NOT MOVE OR TURN. The blade stays at the EXACT ' +
  'same angle, the exact same position and the exact same size in every single ' +
  'frame. Do NOT rotate it. Do NOT tilt it. Do NOT swing, wobble, lean, spin or ' +
  'sway it, not even slightly. Do NOT move it up, down or sideways. Only the ' +
  'fire, the smoke and the sparks move. ' +
  'CRITICAL - NO GROUND SHADOW: this effect hangs in mid air. There must be no ' +
  'grey shadow, no dark ellipse and no ground plane beneath the sword in any ' +
  'frame. ' +
  'CRITICAL - EVEN PACING: every frame advances the fire by the SAME amount. No ' +
  'frame may sit almost unchanged from the one before it, and none may jump far ' +
  'ahead of the rest. ' +
  'CRITICAL - STAY IN FRAME: the whole sword and its fire stay inside the frame ' +
  'with clear margin on every side; do not zoom, drift, crop closer or resize. ' +
  'Keep the same art style, the same red-orange fire and purple outer flame, and ' +
  'a fully transparent background. Do NOT add text or background.';

const hashOf = (b) => createHash('md5').update(b).digest('hex');

// --- measurement ------------------------------------------------------------
// The blade's orientation comes from the principal axis of its BRIGHT METAL
// core - light, low-saturation pixels. Fire is saturated and orange, so it does
// not contribute; that is what makes the angle track the sword and not the
// flames around it.
async function frameStats(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  const pts = [];
  let sx = 0, sy = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * C;
    if (data[o + 3] < 160) continue;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx > 170 && mx - mn < 60) { pts.push(x, y); sx += x; sy += y; }
  }
  let angle = null;
  const n = pts.length / 2;
  if (n > 50) {
    const cx = sx / n, cy = sy / n;
    let a = 0, b2 = 0, c = 0;
    for (let i = 0; i < pts.length; i += 2) {
      const dx = pts[i] - cx, dy = pts[i + 1] - cy;
      a += dx * dx; b2 += dx * dy; c += dy * dy;
    }
    angle = +(0.5 * Math.atan2(2 * b2, a - c) * 180 / Math.PI).toFixed(1);
  }
  // Baked ground shadow: mid-dark, near-grey pixels low in the frame.
  let grey = 0, lit = 0;
  for (let y = Math.floor(H * 0.78); y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * C;
    if (data[o + 3] < 128) continue;
    lit++;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx > 40 && mx < 150 && mx - mn < 34) grey++;
  }
  let edge = 0;
  for (let x = 0; x < W; x++) { if (data[x * C + 3] > 200) edge++; if (data[((H - 1) * W + x) * C + 3] > 200) edge++; }
  for (let y = 0; y < H; y++) { if (data[(y * W) * C + 3] > 200) edge++; if (data[(y * W + W - 1) * C + 3] > 200) edge++; }
  return { angle, shadow: lit ? +(100 * grey / lit).toFixed(1) : 0, edge };
}

async function analyse(bufs) {
  const small = [], angles = [], shadows = [];
  let edge = 0;
  for (const b of bufs) {
    small.push(await sharp(b).resize(96, 96, { fit: 'fill' }).ensureAlpha().raw().toBuffer());
    const st = await frameStats(b);
    if (st.angle !== null) angles.push(st.angle);
    shadows.push(st.shadow);
    if (st.edge > edge) edge = st.edge;
  }
  const steps = [];
  for (let i = 0; i < small.length; i++) {
    const a = small[i], b = small[(i + 1) % small.length];
    let s = 0;
    for (let q = 0; q < a.length; q += 4) s += Math.abs(a[q] - b[q]) + Math.abs(a[q + 3] - b[q + 3]);
    steps.push(Math.round(s / 1000));
  }
  const mean = steps.reduce((a, b) => a + b, 0) / steps.length;
  const cv = +(Math.sqrt(steps.reduce((a, b) => a + (b - mean) ** 2, 0) / steps.length) / mean).toFixed(2);
  const tilt = angles.length ? +(Math.max(...angles) - Math.min(...angles)).toFixed(1) : 999;
  const shadowSpread = +(Math.max(...shadows) - Math.min(...shadows)).toFixed(1);
  const hashes = bufs.map(hashOf);
  return { steps, mean: Math.round(mean), cv, tilt, angles, shadows, shadowSpread, edge,
    unique: new Set(hashes).size,
    pingpong: hashes.length > 2 && hashes[hashes.length - 1] === hashes[0] && hashes[hashes.length - 2] === hashes[1] };
}
const fmt = (a) => `tilt ${a.tilt}deg  cv ${a.cv}  meanStep ${a.mean}  shadowSwing ${a.shadowSpread}%  edge ${a.edge}`;

const cur = [];
for (let i = 0; existsSync(join(ANIM, `${KEY}_${i}.webp`)); i++) cur.push(readFileSync(join(ANIM, `${KEY}_${i}.webp`)));
const curA = await analyse(cur);
console.log(`${KEY}: ${cur.length} frames`);
console.log('  on disk :', fmt(curA));
console.log('  steps   :', curA.steps.join(' '));
console.log('  angles  :', curA.angles.join(' '));
if (!has('--generate')) {
  console.log(`\n# Re-run with --generate (needs LUDO_API_KEY).`);
  console.log(`# Gate: tilt <= ${MAX_TILT}deg, cv <= ${MAX_CV}, mean step >= ${MIN_STEP},`);
  console.log(`#       shadow swing <= ${MAX_SHADOW_SPREAD}%, nothing on the frame edge, ${FRAMES} unique frames.`);
  console.log('# The spawn also passes spin: 0.3 - the art alone cannot fix the rotation.');
  process.exit(0);
}

const K = process.env.LUDO_API_KEY;
if (!K) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const KEEP = process.env.KEEP_DIR || '';
const ROLLS = Number(process.env.ROLLS || 5);
const fetchBuf = async (u) => {
  const r = await fetch(u, { signal: AbortSignal.timeout(300000) });
  if (!r.ok) throw new Error('download ' + r.status);
  return Buffer.from(await r.arrayBuffer());
};

// Containment by construction - the refit from the Gravitos walk and the sakura
// burst. One scale and one offset for the whole set, so the frames keep their
// motion relative to each other; per-frame fitting would cancel the very surge
// this animation is built on, and would also re-introduce a wobble by nudging
// each frame independently.
async function contentBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * C + 3] > 24) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
async function refit(raw, px) {
  const boxes = [];
  for (const b of raw) { const bx = await contentBox(b); if (!bx) throw new Error('a frame came back empty'); boxes.push(bx); }
  const U = { x: Math.min(...boxes.map((b) => b.x)), y: Math.min(...boxes.map((b) => b.y)) };
  U.w = Math.max(...boxes.map((b) => b.x + b.w)) - U.x;
  U.h = Math.max(...boxes.map((b) => b.y + b.h)) - U.y;
  const inner = Math.round(px * 0.92);
  const scale = Math.min(inner / U.w, inner / U.h);
  const dw = Math.max(1, Math.round(U.w * scale)), dh = Math.max(1, Math.round(U.h * scale));
  const dx = Math.round((px - dw) / 2), dy = Math.round((px - dh) / 2);
  const out = [];
  for (const b of raw) {
    const cropped = await sharp(b).extract({ left: U.x, top: U.y, width: U.w, height: U.h })
      .resize(dw, dh, { fit: 'fill' }).png().toBuffer();
    out.push(await sharp({ create: { width: px, height: px, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: cropped, left: dx, top: dy }]).webp({ quality: 92 }).toBuffer());
  }
  return out;
}

const src = await sharp(readFileSync(STILL)).resize(920, 920, { fit: 'inside' }).png().toBuffer();
let best = null;
for (let a = 1; a <= ROLLS; a++) {
  try {
    process.stdout.write(`anim ${a}: `);
    const r = await fetch(API + '/assets/sprite/animate', { method: 'POST',
      headers: { Authorization: `ApiKey ${K}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(600000),
      body: JSON.stringify({ initial_image: 'data:image/png;base64,' + src.toString('base64'),
        motion_prompt: MOTION, frames: FRAMES, frame_size: -9, model: 'eagle',
        individual_frames: true, loop: false, image_type: 'sprite' }) });
    if (!r.ok) throw new Error(`animate ${r.status}: ${(await r.text().catch(() => '')).slice(0, 140)}`);
    const data = await r.json();
    // Slice the SPRITESHEET, never individual_frame_urls: those square off a
    // non-square frame and the art comes back stretched.
    let raw = [];
    if (data.spritesheet_url && data.num_cols && data.num_rows) {
      const sheet = await fetchBuf(data.spritesheet_url);
      const m = await sharp(sheet).metadata();
      const cw = Math.floor(m.width / data.num_cols), ch = Math.floor(m.height / data.num_rows);
      for (let rr = 0; rr < data.num_rows && raw.length < FRAMES; rr++)
        for (let c = 0; c < data.num_cols && raw.length < FRAMES; c++)
          raw.push(await sharp(sheet).extract({ left: c * cw, top: rr * ch, width: cw, height: ch }).png().toBuffer());
    } else {
      const urls = data.individual_frame_urls || [];
      if (urls.length < FRAMES) throw new Error('too few frames');
      for (let i = 0; i < FRAMES; i++) raw.push(await fetchBuf(urls[i]));
    }
    if (raw.length < FRAMES) throw new Error(`got ${raw.length}`);
    const finals = await refit(raw, ANIM_PX);
    const an = await analyse(finals);
    console.log(fmt(an));
    // Rejected rolls keep ALL their frames: frame 0 alone cannot show a tilt or
    // a pacing fault, which are exactly what a rejection turns on here.
    if (KEEP) for (let q = 0; q < finals.length; q++)
      await writeFile(join(KEEP, `db${String(a).padStart(2, '0')}_f${q}.webp`), finals[q]);
    if (an.unique < FRAMES) throw new Error(`only ${an.unique} unique frames`);
    if (an.pingpong) throw new Error('it ping-pongs');
    if (an.edge > 0) throw new Error(`touches the frame edge (${an.edge}px)`);
    if (an.tilt > MAX_TILT) throw new Error(`the sword still turns (${an.tilt}deg > ${MAX_TILT}deg)`);
    if (an.mean < MIN_STEP) throw new Error(`barely animates (mean step ${an.mean} < ${MIN_STEP})`);
    if (an.cv > MAX_CV) throw new Error(`lurching pacing (cv ${an.cv} > ${MAX_CV})`);
    if (an.shadowSpread > MAX_SHADOW_SPREAD) throw new Error(`the ground shadow flickers (${an.shadowSpread}% swing)`);
    // Among rolls that clear the brief: steadiest sword, evenest pacing.
    const score = +(-(an.tilt + an.cv * 10)).toFixed(2);
    console.log(`        accepted — score ${score}` + (best ? ` (incumbent ${best.score})` : ''));
    if (!best || score > best.score) best = { finals, an, score };
  } catch (e) {
    console.log('rejected: ' + e.message);
    if (/\b402\b|credit/i.test(e.message)) { console.error('OUT OF CREDITS'); process.exit(3); }
  }
}
if (!best) { console.error('FAILED — frames left untouched'); process.exit(1); }
for (let i = 0; i < FRAMES; i++) {
  const p = join(ANIM, `${KEY}_${i}.webp`);
  await writeFile(p + '.tmp', best.finals[i]);
  await rename(p + '.tmp', p);
}
console.log(`WROTE ${FRAMES} frames — ${fmt(best.an)}`);
console.log(`  was: ${fmt(curA)}`);
console.log(`  steps ${best.an.steps.join(' ')}`);
