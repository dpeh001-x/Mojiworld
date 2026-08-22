#!/usr/bin/env node
// mforgespark rework (ludo.ai):
//   1) NEW base sprite   -> Sprites/projectiles/mforgespark.webp
//   2) 9-frame loop       -> Sprites/projectiles/anim/mforgespark_0..8.webp
//
//   node scripts/gen_forgespark_fx.mjs              # dry run
//   node scripts/gen_forgespark_fx.mjs --generate   # needs LUDO_API_KEY
//   flags: --force --only=base|anim
//
// Per user, on a screenshot of the Sundered Smith's shot: "using ludo.ai rework
// this sprite".
//
// WHAT IT IS. mforgespark is the molten projectile fired by three FORGE mobs —
// Forgewight, Smithgolem and the Sundered Smith (Lv 48 boss). The sprite it has
// today is a flat six-point sparkle star: a generic cartoon twinkle in red and
// yellow. It reads as "sparkle", not as a gobbet of molten metal thrown off an
// anvil, and it carries none of the soot-and-forge identity the three mobs that
// fire it share.
//
// THE SPIN CONSTRAINT DRIVES THE DESIGN. _MOB_PROJ_SPIN registers this key as
// { mode: 'spin', spinRate: 0.20 } — the ENGINE tumbles it every frame. Two
// consequences, both load-bearing:
//   · the silhouette has to stay readable at every rotation, so the design
//     stays roughly radial rather than picking a "up" direction
//   · the animation frames must NOT rotate. Frame-level rotation fights the
//     procedural spin and reads as a wobble (same rule as gen_bolt_anim.mjs
//     and gen_arcane_burst_fx.mjs).
// It also draws small — size 0.5 with a 34 px base — so the read has to survive
// at roughly 30 px: high contrast core, heavy outline, no fine detail that
// turns to mush.
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(repoRoot, 'Sprites', 'projectiles', 'mforgespark.webp');
const ANIM_DIR = join(repoRoot, 'Sprites', 'projectiles', 'anim');
const FRAMES = 9, SIZE = 768;
const has = (f) => process.argv.includes(f);
const only = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1];
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const key = process.env.LUDO_API_KEY;

const BASE_PROMPT =
  'A single molten forge ember projectile, game VFX sprite, viewed head-on. A blazing white-hot ' +
  'core of liquid metal, wrapped in a ragged burst of molten orange and deep red heat that throws ' +
  'off short jagged spatter points in every direction like metal struck on an anvil. A few tiny ' +
  'white-hot sparks and glowing cinders scatter close around it. The heat glows hottest at the ' +
  'centre and cools to deep ember red at the ragged outer edge, with a thick dark crimson outline ' +
  'holding the whole shape together. ' +
  // Radial, because the engine spins it — a design with a "top" tumbles badly.
  'CRITICAL — RADIALLY SYMMETRIC: the shape must read correctly at ANY rotation, with no top, ' +
  'bottom or direction, and no tail, trail, streak or motion blur pointing one way. ' +
  // Small on screen: ~30px. Fine detail disappears.
  'CRITICAL — BOLD AND SIMPLE: high contrast, heavy outline, chunky shapes that stay readable when ' +
  'shrunk to thirty pixels. No fine detail, no thin wisps, no text. ' +
  'Centred, filling the frame, fully transparent background. No character, no face, no background, ' +
  'no ground, no shadow. Clean anime game-asset style with crisp cel shading.';

const MOTION =
  'The molten ember CHURNS AND BURNS CONTINUOUSLY, with clear visible change in EVERY single frame ' +
  'and no still or near-identical frames anywhere — the motion spread evenly across all nine frames, ' +
  'never concentrated into two or three: the white-hot core pulses and boils brighter and dimmer, ' +
  'molten orange flows and licks outward through the ragged spatter points, the deep red outer heat ' +
  'ripples and breathes, and tiny white sparks pop in and out constantly around the edge. ' +
  'CRITICAL — DO NOT ROTATE: the ember must NOT spin or turn as a whole; its orientation stays ' +
  'identical in every frame (the game engine rotates it procedurally). Only the heat moves. ' +
  'CRITICAL — LOCKED FRAMING: perfectly centred at the exact same size, position and scale in every ' +
  'frame; no zoom, pan, crop, rescale, drift, wobble, mirror or flip. ' +
  'CRITICAL — SEAMLESS LOOP: the last frame flows continuously back into the first with no pop. ' +
  'Keep the exact same art style, palette (white-hot core, molten orange, deep ember red, dark ' +
  'crimson outline), thick outline and fully transparent background in every frame. ' +
  'No face, no character, no background.';

if (!has('--generate')) {
  console.log('DRY RUN — pass --generate to call ludo.ai\n');
  console.log('base -> ' + OUT);
  console.log('anim -> ' + join(ANIM_DIR, 'mforgespark_0..8.webp'));
  console.log('\nBASE PROMPT:\n' + BASE_PROMPT);
  console.log('\nMOTION:\n' + MOTION);
  process.exit(0);
}
if (!key) { console.error('LUDO_API_KEY not set'); process.exit(1); }

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
// Shared canvas, no per-frame trim: trimming each frame re-centres it and the
// loop jitters.
async function normalise(buf) {
  return sharp(buf).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 92 }).toBuffer();
}

if (!only || only === 'base') {
  if (!has('--force') && await exists(OUT) && only !== 'base') { /* fallthrough */ }
  let last, ok = false;
  for (let a = 1; a <= 4 && !ok; a++) {
    try {
      process.stdout.write(`base attempt ${a} ... `);
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(420000),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: BASE_PROMPT }),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      const raw = await fetchBuf(url);
      let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
      await writeFile(OUT, await normalise(content));
      console.log('ok -> mforgespark.webp');
      ok = true;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  if (!ok) { console.error('BASE FAILED: ' + (last && last.message)); process.exit(1); }
}

if (!only || only === 'anim') {
  const baseBuf = await readFile(OUT);
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
      for (let i = 0; i < FRAMES; i++) await writeFile(join(ANIM_DIR, `mforgespark_${i}.webp`), await normalise(bufs[i]));
      console.log('OK — 9 frames');
      ok = true;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  if (!ok) { console.error('ANIM FAILED: ' + (last && last.message)); process.exit(1); }
}
console.log('done');
