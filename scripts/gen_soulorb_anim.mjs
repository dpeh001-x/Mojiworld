#!/usr/bin/env node
// Soul Ward orb — 9-frame ghost-flame loop from the existing base (ludo.ai).
// -> Sprites/projectiles/anim/p_necromancer_soulorb_0..8.webp
//    (base: Sprites/projectiles/p_necromancer_soulorb.webp, ludo.ai v0.29.914)
//
//   node scripts/gen_soulorb_anim.mjs              # dry run
//   node scripts/gen_soulorb_anim.mjs --generate   # needs LUDO_API_KEY
//
// Per user: "generate animations with the existing p_necromancer_soulorb
// sprite or lich_soulorb sprite whichever is active" — the file on main is
// p_necromancer_soulorb.webp.
// SMOOTHNESS RULE (from gen_bolt_anim.mjs): the orb renderer already rotates
// the sprite procedurally at 0.05 rad/frame, so the frames must NOT rotate —
// they animate only what a rigid rotation cannot: the soulfire churning and
// the core breathing.
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = join(repoRoot, 'Sprites', 'projectiles', 'p_necromancer_soulorb.webp');
const OUT_DIR = join(repoRoot, 'Sprites', 'projectiles', 'anim');
const FRAMES = 9, SIZE = 768;
const has = (f) => process.argv.includes(f);

const MOTION =
  'The spectral teal soul-flame CHURNS: the ghost-flame shells around the pale-jade core ripple and ' +
  'lick upward like a will-o-wisp, the wisps curling off the top flicker and re-form, the tiny ' +
  'mint-green ember flecks drift slowly around the orb, and the bright core breathes gently brighter ' +
  'and dimmer. ' +
  'CRITICAL — DO NOT ROTATE: the orb must NOT spin, turn or revolve as a whole; its orientation stays ' +
  'identical in every frame (the game engine rotates it procedurally). Only the flame INSIDE moves. ' +
  'CRITICAL — LOCKED FRAMING: perfectly centred at the exact same size, position and scale in every ' +
  'frame; no zoom, pan, crop, rescale, drift, wobble, mirror or flip. ' +
  'CRITICAL — SEAMLESS LOOP: the last frame flows continuously back into the first with no pop. ' +
  'Keep the exact same art style, cool blue-green palette (teal, jade, seafoam), thick dark outline ' +
  'and fully transparent background in every frame. No face, no eyes, no character, no background.';

if (!has('--generate')) { console.log('# motion -> anim/p_necromancer_soulorb_0..8.webp\n' + MOTION); process.exit(0); }
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
// Shared canvas, no per-frame trim — per-frame trims re-centre and jitter.
async function normalise(buf) {
  return sharp(buf).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 92 }).toBuffer();
}

const baseBuf = await readFile(BASE);
const uri = 'data:image/png;base64,' + (await sharp(baseBuf).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
let last;
for (let a = 1; a <= 4; a++) {
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
    await mkdir(OUT_DIR, { recursive: true });
    for (let i = 0; i < FRAMES; i++) await writeFile(join(OUT_DIR, `p_necromancer_soulorb_${i}.webp`), await normalise(bufs[i]));
    console.log(`OK — wrote ${FRAMES} frames`);
    process.exit(0);
  } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
}
console.error('FAILED: ' + (last && last.message));
process.exit(1);
