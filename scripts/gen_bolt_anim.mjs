#!/usr/bin/env node
// Animation frames for the mage's basic-attack orb (skill 'bolt').
// -> Sprites/anim/bolt_0..8.webp, picked up by _projAnimFrame('bolt').
//
// 'bolt' has been registered in _PROJ_ANIM_KEYS since v0.26.x but the art was
// never made, so it silently fell back to the static sprite. This makes it.
//
// THE SMOOTHNESS RULE — why these frames must NOT rotate:
// drawProjectiles already spins the bolt procedurally at 0.35 rad/frame
// (p._spin, ~3.3 rev/sec) — a CONTINUOUS 60 fps rotation, i.e. perfectly
// smooth by construction. The frame loop runs at _PROJ_ANIM_FRAME_MS = 48 ms
// (9 frames, ~20.8 fps). If the frames carried their own rotation we would
//   (a) double-rotate — two spins compounding at different rates, and
//   (b) REPLACE a smooth 60 fps rotation with a stepped 20.8 fps one.
// So rotation stays procedural, and the frames animate only what a rigid
// rotation physically cannot: the swirl arms churning inward and the core
// breathing. The two layers compose instead of fighting.
//
// The loop must also be SEAMLESS: _bossLoopFrame plays 0..8 then jumps
// straight back to 0, so frame 8 has to flow into frame 0 with no pop.
//
//   node scripts/gen_bolt_anim.mjs              # dry run
//   node scripts/gen_bolt_anim.mjs --generate   # 9 frames -> Sprites/anim/
//   node scripts/gen_bolt_anim.mjs --contact    # build a review strip
// Needs LUDO_API_KEY.
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = join(repoRoot, 'Sprites', 'projectiles', 'p_mage_orb.png');
const OUT_DIR = join(repoRoot, 'Sprites', 'anim');
const REVIEW = join(repoRoot, 'scripts', '_mage_orb_review');
const FRAMES = 9;
const SIZE = 768;

const has = (f) => process.argv.includes(f);
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

const MOTION =
  'Animate this magical energy orb as a seamless, perfectly looping cycle of INTERNAL energy motion. ' +
  'The spiral arms of blue plasma flow and churn steadily INWARD toward the centre, being drawn into ' +
  'the bright core, while the white-hot core pulses gently brighter and dimmer and small cyan energy ' +
  'wisps drift along the arms. ' +
  'CRITICAL — DO NOT ROTATE: the orb must NOT spin, turn, revolve or orbit as a whole. Its overall ' +
  'orientation stays FIXED and identical in every single frame; only the energy INSIDE it flows. ' +
  'Do not rotate the image, do not turn the sprite, no rigid rotation of any kind. ' +
  'CRITICAL — LOCKED FRAMING: stay perfectly centred at the exact same size, position and scale in ' +
  'every frame. Do not zoom, pan, crop, rescale, drift, wobble, mirror or flip. The outer silhouette ' +
  'and diameter stay constant. ' +
  'CRITICAL — SEAMLESS LOOP: the last frame must flow continuously back into the first with no jump, ' +
  'pop or reset. ' +
  'Keep the exact same art style, palette, thick dark navy outline and fully transparent background ' +
  'in every frame. No face, no eyes, no character, no background, no shadow.';

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

// Every frame onto an identical SIZE canvas WITHOUT per-frame trimming —
// trimming each frame independently would re-centre them differently and make
// the orb jitter as the loop plays. One shared box keeps it dead still.
async function normalise(buf) {
  return sharp(buf).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 92 }).toBuffer();
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
      process.stdout.write(`animate bolt attempt ${attempt} ... `);
      const res = await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(600000),
        body: JSON.stringify({ initial_image: uri, motion_prompt: MOTION, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
      const bufs = await framesFrom(await res.json(), FRAMES);
      for (let i = 0; i < FRAMES; i++) await writeFile(join(OUT_DIR, `bolt_${i}.webp`), await normalise(bufs[i]));
      console.log(`OK — wrote ${FRAMES} frames to Sprites/anim/bolt_0..8.webp`);
      return;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (attempt < 4) await new Promise(s => setTimeout(s, 4000 * attempt)); }
  }
  console.error('FAILED: ' + (last && last.message));
  process.exit(1);
}

// Review strip: all 9 frames in order at true in-game size + large, so a pop
// in the loop or a stray rotation is visible at a glance.
async function doContact() {
  await mkdir(REVIEW, { recursive: true });
  const BIG = 118, SMALL = 64, PAD = 8, HDR = 44, LBL = 18;
  const W = FRAMES * (BIG + PAD) + PAD, H = HDR + BIG + LBL + PAD * 2 + SMALL + LBL + PAD;
  const svg = (t, s, c, w, h) => Buffer.from(`<svg width="${w}" height="${h}"><text x="0" y="${s}" font-family="Segoe UI,Arial" font-size="${s}" font-weight="700" fill="${c}">${t}</text></svg>`);
  const layers = [{ input: svg('bolt anim — 9 frames in order (top: large, bottom: true 64px in-game size)', 18, '#fff', W, HDR), left: PAD, top: 12 }];
  for (let i = 0; i < FRAMES; i++) {
    const f = join(OUT_DIR, `bolt_${i}.webp`);
    if (!await exists(f)) continue;
    const b = await readFile(f);
    const x = PAD + i * (BIG + PAD);
    layers.push({ input: await sharp(b).resize(BIG, BIG, { fit: 'inside' }).png().toBuffer(), left: x, top: HDR });
    layers.push({ input: svg(String(i), 14, '#ffd870', BIG, LBL), left: x, top: HDR + BIG + 2 });
    layers.push({ input: await sharp(b).resize(SMALL, SMALL, { fit: 'inside' }).png().toBuffer(), left: x + Math.round((BIG - SMALL) / 2), top: HDR + BIG + LBL + PAD * 2 });
  }
  const out = join(REVIEW, 'bolt_anim_strip.png');
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 22, g: 26, b: 42, alpha: 1 } } }).composite(layers).png().toFile(out);
  console.log('wrote ' + out);
}

if (has('--generate')) await doGenerate();
else if (has('--contact')) await doContact();
else {
  console.log('# Mage bolt orb animation -> Sprites/anim/bolt_0..8.webp');
  console.log('# Frames must NOT rotate: drawProjectiles already spins the bolt');
  console.log('# continuously at 0.35 rad/frame (60fps). Frames animate inward');
  console.log('# energy churn + core pulse only, so the two layers compose.');
  console.log('# 1) node scripts/gen_bolt_anim.mjs --generate');
  console.log('# 2) node scripts/gen_bolt_anim.mjs --contact');
}
