#!/usr/bin/env node
// Arcane Burst VFX pack (ludo.ai):
//   1) 9-frame detonation loop from the existing star base
//        -> Sprites/fx/anim/arcane_burst_0..8.webp
//   2) NEW expanding shockwave-ring sprite (static; the engine grows it)
//        -> Sprites/fx/arcane_shockwave.webp
//
//   node scripts/gen_arcane_burst_fx.mjs              # dry run
//   node scripts/gen_arcane_burst_fx.mjs --generate   # needs LUDO_API_KEY
//   flags: --force --only=anim|ring
//
// v0.29.946 — per user: "Add additional visual special effects sprites and
// animation for arcane burst skill". The burst had one static magic-star
// sprite spun procedurally; the frames animate the detonation itself (flare,
// shards, sparkle churn) while the NEW ring is drawn at the skill's true AoE
// so the player sees exactly what the 320px blast covers.
// NO whole-image rotation in the frames — spawnSpriteBurst applies spin
// procedurally (same smoothness rule as gen_bolt_anim.mjs).
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = join(repoRoot, 'Sprites', 'fx', 'arcane_burst.webp');
const ANIM_DIR = join(repoRoot, 'Sprites', 'fx', 'anim');
const RING_OUT = join(repoRoot, 'Sprites', 'fx', 'arcane_shockwave.webp');
const FRAMES = 9, SIZE = 768;
const has = (f) => process.argv.includes(f);
const only = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1];
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

const MOTION =
  'The arcane detonation star SURGES: the white-pink core flashes brighter and dimmer like a ' +
  'heartbeat, violet and blue energy ripples travel outward along the star points, the small cyan ' +
  'crystal shards around it drift outward and tumble, and tiny white sparkles pop in and out across ' +
  'the blue blades. ' +
  'CRITICAL — DO NOT ROTATE: the star must NOT spin or turn as a whole; its orientation stays ' +
  'identical in every frame (the game engine rotates it procedurally). Only the energy moves. ' +
  'CRITICAL — LOCKED FRAMING: perfectly centred at the exact same size, position and scale in ' +
  'every frame; no zoom, pan, crop, rescale, drift, wobble, mirror or flip. ' +
  'CRITICAL — SEAMLESS LOOP: the last frame flows continuously back into the first with no pop. ' +
  'Keep the exact same art style, palette (electric blue, violet, pink-white core, cyan shards), ' +
  'thick dark outline and fully transparent background in every frame. No face, no character, no background.';

const RING_PROMPT =
  'A thin expanding ARCANE SHOCKWAVE RING for a 2D game explosion: one large perfect circle drawn ' +
  'as a band of electric blue-violet energy with small glowing runes spaced along the band, thin ' +
  'white-hot inner edge, faint pink outer haze, a few tiny cyan crystal shards riding the ring. ' +
  'The centre of the circle is completely EMPTY and transparent — a ring only, band width about ' +
  '8% of the diameter, the ring nearly filling the frame. Flat 2D cartoon game sprite, bold clean ' +
  'vector shapes, crisp cel shading, thick dark outline, matching an electric-blue arcane star ' +
  'explosion set. Fully TRANSPARENT background (alpha only). Viewed flat face-on (no perspective ' +
  'tilt). NO face, NO character, NO text, NO shadow, NO background.';

if (!has('--generate')) {
  console.log('# anim -> Sprites/fx/anim/arcane_burst_0..8.webp\n' + MOTION + '\n');
  console.log('# ring -> Sprites/fx/arcane_shockwave.webp\n' + RING_PROMPT + '\n# Re-run with --generate.');
  process.exit(0);
}
const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }
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
// Shared canvas, no per-frame trim (per-frame trims re-centre and jitter).
async function normalise(buf) {
  return sharp(buf).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 92 }).toBuffer();
}

if (!only || only === 'anim') {
  const baseBuf = await readFile(BASE);
  const uri = 'data:image/png;base64,' + (await sharp(baseBuf).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
  let last, ok = false;
  for (let a = 1; a <= 4 && !ok; a++) {
    try {
      process.stdout.write(`animate attempt ${a} ... `);
      const res = await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(600000),
        body: JSON.stringify({ initial_image: uri, motion_prompt: MOTION, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
      const bufs = await framesFrom(await res.json(), FRAMES);
      await mkdir(ANIM_DIR, { recursive: true });
      for (let i = 0; i < FRAMES; i++) await writeFile(join(ANIM_DIR, `arcane_burst_${i}.webp`), await normalise(bufs[i]));
      console.log('OK — 9 frames');
      ok = true;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  if (!ok) { console.error('ANIM FAILED: ' + (last && last.message)); process.exit(1); }
}

if (!only || only === 'ring') {
  if (!has('--force') && await exists(RING_OUT)) { console.log('ring: skip (exists)'); process.exit(0); }
  let last, ok = false;
  for (let a = 1; a <= 4 && !ok; a++) {
    try {
      process.stdout.write(`ring attempt ${a} ... `);
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(150000),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: RING_PROMPT }),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      const raw = await fetchBuf(url);
      let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
      await writeFile(RING_OUT, await normalise(content));
      console.log('ok -> arcane_shockwave.webp');
      ok = true;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  if (!ok) { console.error('RING FAILED: ' + (last && last.message)); process.exit(1); }
}
