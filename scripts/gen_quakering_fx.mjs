#!/usr/bin/env node
// Boss QUAKE ground-shock ring — base sprite + 9-frame loop (ludo.ai).
//   -> Sprites/fx/quake_ring.webp
//   -> Sprites/fx/anim/quakeRing_0..8.webp
//
//   node scripts/gen_quakering_fx.mjs              # dry run
//   node scripts/gen_quakering_fx.mjs --generate   # needs LUDO_API_KEY
//   flags: --force --only=base|anim
//
// v0.29.967 — found by auditing every projectile / hazard / FX key against the
// registries: `quakeRing` is spawned by the mob_quake hazard resolve
// (spawnSpriteBurst(h.cx, h.y + 6, 'quakeRing', {... frameGap: 5 })) but is
// registered in NO table and has NO file on disk, so a boss quake landing has
// only its dirt particles — the ring the code asks for never draws. It is the
// single dead visual key in the whole effect system.
//
// The burst passes frameGap, i.e. it expects an animated set, so this makes
// both the static base and the 9-frame loop. Drawn flat on the ground at the
// impact point and NOT rotated by the engine, so the frames may not rotate
// either — they animate the dust rolling outward and the cracks flaring.
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_OUT = join(repoRoot, 'Sprites', 'fx', 'quake_ring.webp');
const ANIM_DIR = join(repoRoot, 'Sprites', 'fx', 'anim');
const FRAMES = 9, SIZE = 768;
const has = (f) => process.argv.includes(f);
const only = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1];
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

const BASE_PROMPT =
  'A GROUND SHOCKWAVE RING from a heavy monster slam, seen FLAT from the side-on game camera as a ' +
  'wide squashed ellipse (much wider than tall, like a ring lying on the floor): a low billowing ' +
  'ring of tan and dusty-brown smoke rolling outward, cracked broken earth and jagged stone plates ' +
  'lifting along the ring, small rock chunks and pebbles flung up around it, faint warm amber dust ' +
  'glow underneath. The centre of the ellipse is EMPTY and transparent. ' +
  'Flat 2D cartoon game sprite for a side-scrolling platformer, bold clean vector shapes, thick even ' +
  'dark outline, crisp cel shading with 2-3 tones, earthy palette (tan, ochre, brown, grey stone) ' +
  'with a touch of warm amber. Fully TRANSPARENT background (alpha only), generous margin. ' +
  'NO face, NO eyes, NO creature, NO character, NO text, NO shadow, NO background, NO fire.';

const MOTION =
  'The ground shockwave ROLLS OUTWARD continuously, with visible change in EVERY frame: the dust ' +
  'billows and churns outward along the ring, the cracked earth plates shift and settle, the small ' +
  'rock chunks tumble and fall back, and the warm amber dust glow underneath pulses. ' +
  'CRITICAL — DO NOT ROTATE: the ring must NOT spin or turn as a whole; it lies flat on the ground ' +
  'and keeps the same orientation in every frame. Only the dust and debris move. ' +
  'CRITICAL — LOCKED FRAMING: perfectly centred at the same size, position and scale every frame; ' +
  'no zoom, pan, crop, drift, mirror or flip. The ellipse keeps its width and height. ' +
  'CRITICAL — KEEP THE CENTRE EMPTY: the middle of the ellipse stays transparent in every frame. ' +
  'CRITICAL — SEAMLESS LOOP: the last frame flows continuously back into the first with no pop. ' +
  // v0.29.967 — the first generation lost transparency in the back half:
  // frames 6-8 measured 28-33% opaque against the base's 20%, the excess being
  // a sky/water backdrop the animator painted in. Everything outside the ring
  // must stay pure alpha, and it is worth over-stating.
  'CRITICAL — TRANSPARENT BACKGROUND IN EVERY FRAME: everything outside the dust ring must be ' +
  '100% transparent alpha, in all nine frames including the last ones. NEVER add a sky, clouds, ' +
  'water, sea, horizon, floor, ground plane, gradient, colour wash or any backdrop of any kind ' +
  'behind or below the ring. No scenery. The only opaque pixels in the entire image are the dust, ' +
  'the cracked stone plates and the rock chunks themselves. ' +
  'Keep the exact same art style, earthy palette, thick dark outline and fully transparent ' +
  'background in every frame. No face, no character, no background, no shadow.';

if (!has('--generate')) {
  console.log('# base -> Sprites/fx/quake_ring.webp\n' + BASE_PROMPT + '\n');
  console.log('# anim -> Sprites/fx/anim/quakeRing_0..8.webp\n' + MOTION + '\n# Re-run with --generate.');
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

let baseBuf;
if (!only || only === 'base') {
  if (!has('--force') && await exists(BASE_OUT)) { baseBuf = await readFile(BASE_OUT); console.log('base: exists, reusing'); }
  else {
    let last;
    for (let a = 1; a <= 4 && !baseBuf; a++) {
      try {
        process.stdout.write(`base attempt ${a} ... `);
        const res = await fetch(`${API}/assets/image`, {
          method: 'POST',
          headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(150000),
          body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: BASE_PROMPT }),
        });
        if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
        const data = await res.json();
        const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
        if (!url) throw new Error('no url');
        const raw = await fetchBuf(url);
        let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
        baseBuf = await normalise(content);
        await writeFile(BASE_OUT, baseBuf);
        console.log('ok -> quake_ring.webp');
      } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
    }
    if (!baseBuf) { console.error('BASE FAILED: ' + (last && last.message)); process.exit(1); }
  }
}

if (!only || only === 'anim') {
  if (!baseBuf) baseBuf = await readFile(BASE_OUT);
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
      for (let i = 0; i < FRAMES; i++) await writeFile(join(ANIM_DIR, `quakeRing_${i}.webp`), await normalise(bufs[i]));
      console.log('OK — 9 frames');
      ok = true;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  if (!ok) { console.error('ANIM FAILED: ' + (last && last.message)); process.exit(1); }
}
