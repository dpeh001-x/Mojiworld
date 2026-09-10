#!/usr/bin/env node
// Animation frames for the Sage's meteor (the meteor_warn telegraph's falling rock).
// -> Sprites/projectiles/anim/meteor_0..8.webp, picked up by _projAnimFrame('meteor').
//
// Base: Sprites/projectiles/p_meteor.webp (v0.30.484, ludo.ai via gen_meteor_sprite.mjs) — a
// molten rock at the bottom with a vertical fire plume above it, drawn UNROTATED straight down a
// column. The frames must keep that: the rock stays put and the fire does the moving.
//
// THE SMOOTHNESS RULE (same as gen_bolt_anim.mjs): the frames must NOT rotate, drift or rescale.
// The hazard drawer sizes the sprite by fall progress (100 -> 170 px) and stacks six fading trail
// copies above the head, so any per-frame jitter in position or scale would multiply seven times.
// The loop plays 0..8 and jumps back to 0 (_bossLoopFrame), so frame 8 must flow into frame 0.
//
//   node scripts/gen_meteor_anim.mjs              # dry run: print the motion prompt
//   node scripts/gen_meteor_anim.mjs --generate   # 9 frames -> Sprites/projectiles/anim/meteor_*.webp
//   node scripts/gen_meteor_anim.mjs --contact    # review strip -> scripts/_meteor_anim_review/
// Needs LUDO_API_KEY. After a drop: node scripts/gen_sprite_frame_index.mjs && node scripts/animator_parity_check.mjs
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = join(repoRoot, 'Sprites', 'projectiles', 'p_meteor.webp');
const OUT_DIR = join(repoRoot, 'Sprites', 'projectiles', 'anim');
const REVIEW = join(repoRoot, 'scripts', '_meteor_anim_review');
const KEY = 'meteor';
const FRAMES = 9;
const SIZE = 680;   // matches the static sprite it animates

const has = (f) => process.argv.includes(f);
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

const MOTION =
  'Animate this burning meteor as a seamless, perfectly looping cycle of FIRE motion only. ' +
  'The flames streaming UP from the rock flicker, lick and ripple, tongues of orange and gold rising ' +
  'and dissolving into sparks and heat-shimmer at the top; the white-hot cracks across the dark rock ' +
  'pulse gently brighter and dimmer; a few small embers and rock chips break away upward and fade. ' +
  'CRITICAL - THE ROCK DOES NOT MOVE: the molten rock at the bottom stays at exactly the same position, ' +
  'size and orientation in every frame. The whole sprite must NOT rotate, turn, tilt, sway, wobble or ' +
  'drift. The meteor keeps falling straight down, rock low, fire high, vertical in every frame. ' +
  'CRITICAL - LOCKED FRAMING: stay perfectly centred at the exact same size, position and scale in ' +
  'every frame. Do not zoom, pan, crop, rescale, mirror or flip. The overall silhouette height and ' +
  'width stay constant; only the flame tongues change shape inside that silhouette. ' +
  'CRITICAL - SEAMLESS LOOP: the last frame must flow continuously back into the first with no jump, ' +
  'pop or reset. ' +
  'Keep the exact same painterly hand-painted style, the same saturated orange / gold / ember-red ' +
  'palette, the soft luminous glow and a fully transparent background in every frame. NO hard black ' +
  'outline, no sticker keyline. No face, no character, no background, no shadow, no text.';

async function fetchBuf(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`fetch ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function framesFrom(data, n) {
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const cols = data.num_cols, rows = data.num_rows;
    const sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
    const cw = Math.floor(meta.width / cols), ch = Math.floor(meta.height / rows), o = [];
    for (let r = 0; r < rows && o.length < n; r++) for (let c = 0; c < cols && o.length < n; c++)
      o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  const urls = data.individual_frame_urls || [];
  if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  throw new Error('no usable frames in response');
}

// Every frame onto one identical SIZE canvas WITHOUT per-frame trimming — trimming each frame on its
// own content would re-centre them differently and make the rock jitter as the loop plays.
async function normalise(buf) {
  return sharp(buf).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 92 }).toBuffer();
}

// Alpha bounding box — used to reject a set whose frames wander (a rotated or drifting meteor).
async function alphaBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) throw new Error('frame is fully transparent');
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

async function doGenerate() {
  const key = process.env.LUDO_API_KEY;
  if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
  const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
  await mkdir(OUT_DIR, { recursive: true });
  const buf = await readFile(BASE);
  const uri = 'data:image/png;base64,' + (await sharp(buf).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
  let last;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      process.stdout.write(`animate ${KEY} attempt ${attempt} ... `);
      const res = await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(600000),
        body: JSON.stringify({ initial_image: uri, motion_prompt: MOTION, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
      const bufs = await framesFrom(await res.json(), FRAMES);
      const outs = [];
      for (let i = 0; i < FRAMES; i++) outs.push(await normalise(bufs[i]));
      // ACCEPT-BEFORE-WRITE: the rock must hold still. Measure every frame's content box against
      // frame 0 - a drift of more than 6% of the canvas, or a size swing past 12%, is a wandering set.
      const b0 = await alphaBox(outs[0]);
      let worstDrift = 0, worstSize = 0;
      for (let i = 1; i < FRAMES; i++) {
        const b = await alphaBox(outs[i]);
        worstDrift = Math.max(worstDrift, Math.hypot(b.cx - b0.cx, b.cy - b0.cy) / SIZE);
        worstSize = Math.max(worstSize, Math.abs(b.h - b0.h) / b0.h, Math.abs(b.w - b0.w) / b0.w);
      }
      console.log(`candidate: frame0 ${b0.w}x${b0.h}, worst drift ${(worstDrift * 100).toFixed(1)}%, worst size swing ${(worstSize * 100).toFixed(1)}%`);
      if (worstDrift > 0.06 || worstSize > 0.12) throw new Error('set wanders (rotated / drifting meteor) - rejected before writing');
      for (let i = 0; i < FRAMES; i++) {
        const f = join(OUT_DIR, `${KEY}_${i}.webp`);
        await writeFile(f + '.tmp', outs[i]); await rename(f + '.tmp', f);
      }
      console.log(`OK - wrote ${FRAMES} frames to Sprites/projectiles/anim/${KEY}_0..8.webp`);
      return;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (attempt < 4) await new Promise((s) => setTimeout(s, 4000 * attempt)); }
  }
  console.error('FAILED: ' + (last && last.message));
  process.exit(1);
}

// Review strip: all 9 frames in order, large and at a true in-game size, so a pop in the loop or
// a stray rotation is visible at a glance.
async function doContact() {
  await mkdir(REVIEW, { recursive: true });
  const BIG = 118, SMALL = 64, PAD = 8, HDR = 44, LBL = 18;
  const W = FRAMES * (BIG + PAD) + PAD, H = HDR + BIG + LBL + PAD * 2 + SMALL + LBL + PAD;
  const svg = (t, s, c, w, h) => Buffer.from(`<svg width="${w}" height="${h}"><text x="0" y="${s}" font-family="Segoe UI,Arial" font-size="${s}" font-weight="700" fill="${c}">${t}</text></svg>`);
  const layers = [{ input: svg(`${KEY} anim - 9 frames in order (top: large, bottom: 64px)`, 18, '#fff', W, HDR), left: PAD, top: 12 }];
  for (let i = 0; i < FRAMES; i++) {
    const f = join(OUT_DIR, `${KEY}_${i}.webp`);
    if (!await exists(f)) continue;
    const b = await readFile(f);
    const x = PAD + i * (BIG + PAD);
    layers.push({ input: await sharp(b).resize(BIG, BIG, { fit: 'inside' }).png().toBuffer(), left: x, top: HDR });
    layers.push({ input: svg(String(i), 14, '#ffd870', BIG, LBL), left: x, top: HDR + BIG + 2 });
    layers.push({ input: await sharp(b).resize(SMALL, SMALL, { fit: 'inside' }).png().toBuffer(), left: x + Math.round((BIG - SMALL) / 2), top: HDR + BIG + LBL + PAD * 2 });
  }
  const out = join(REVIEW, `${KEY}_anim_strip.png`);
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 22, g: 26, b: 42, alpha: 1 } } }).composite(layers).png().toFile(out);
  console.log('wrote ' + out);
}

if (has('--generate')) await doGenerate();
else if (has('--contact')) await doContact();
else {
  console.log(`# Sage meteor animation -> Sprites/projectiles/anim/${KEY}_0..8.webp`);
  console.log('# The rock holds still; only the fire moves. No rotation, locked framing, seamless loop.');
  console.log(MOTION);
  console.log('# 1) node scripts/gen_meteor_anim.mjs --generate');
  console.log('# 2) node scripts/gen_meteor_anim.mjs --contact');
  console.log('# 3) node scripts/gen_sprite_frame_index.mjs && node scripts/animator_parity_check.mjs');
}
