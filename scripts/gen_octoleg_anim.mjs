#!/usr/bin/env node
// Octobaby tentacle dart — new base sprite + 9-frame wriggle loop (ludo.ai).
// -> Sprites/projectiles/p_octoleg.webp (static / pre-decode fallback)
// -> Sprites/projectiles/anim/octoLeg_0..8.webp (looped via _bossLoopFrame)
//
//   node scripts/gen_octoleg_anim.mjs              # dry run (prints prompts)
//   node scripts/gen_octoleg_anim.mjs --generate   # needs LUDO_API_KEY
//   flags: --force  --skip-base (animate the existing p_octoleg.webp)
//
// v0.29.934 — per user: "generate new sprite and animation for octoLeg_0,
// make it more suitable". Two things made the old set unsuitable:
//   • the tentacle ended in a MACHINED STEEL ARROWHEAD — a barbed metal dart
//     grafted onto an octopus limb, reading as an arrow rather than an
//     organic attack;
//   • the 9 "animation" frames were near-identical, so the loop didn't
//     visibly animate at all.
// The projectile is drawn in 'orient' mode (rotated to velocity, tip leads,
// business end on the RIGHT), so the new base keeps the tip rightward and
// the motion prompt animates only the wriggle — rotation stays procedural,
// per the smoothness rule documented in gen_bolt_anim.mjs.
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC_OUT = join(repoRoot, 'Sprites', 'projectiles', 'p_octoleg.webp');
const ANIM_DIR = join(repoRoot, 'Sprites', 'projectiles', 'anim');
const FRAMES = 9, SIZE = 768;
const has = (f) => process.argv.includes(f);
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

const BASE_PROMPT =
  'A lashing OCTOPUS TENTACLE dart, a severed flying tentacle whip for a cute-but-eerie sea boss: ' +
  'streamlined and horizontal, the POINTED TAPERING TIP leading to the RIGHT like a striking whip, ' +
  'the thicker trailing end sweeping into one gentle S-curve on the left. Glossy violet-purple skin ' +
  'on top, soft pink underside lined with round suckers along the lower edge, a few small water ' +
  'droplets flicking off the tail. Entirely ORGANIC — absolutely NO metal, NO arrowhead, NO blade, ' +
  'NO barb, NO weapon parts: the tip is pointed flesh, like a whip cracking. ' +
  'Sprite for a 2D SIDE-SCROLLING platformer, flat side-on silhouette, flat 2D cartoon game sprite, ' +
  'bold clean vector shapes, thick even dark outline, crisp cel shading with 2-3 tones, matching a ' +
  'painterly anime monster set. Centred on a fully TRANSPARENT background (alpha only), generous ' +
  'margin on all sides. NO face, NO eyes, NO text, NO shadow, NO background.';

const MOTION =
  'The tentacle WRIGGLES as it flies: a smooth sinusoidal wave travels along the body from the ' +
  'pointed right tip toward the thick left tail, the S-curve of the tail lashing gently up and down, ' +
  'suckers riding the wave, the small water droplets drifting off the tail end. ' +
  'CRITICAL — DO NOT ROTATE: the tentacle must NOT spin or turn as a whole; the pointed tip stays ' +
  'aimed RIGHT in every frame. Rotation is applied procedurally by the game engine. ' +
  'CRITICAL — LOCKED FRAMING: perfectly centred at the same size, position and scale every frame; ' +
  'no zoom, pan, crop, drift, mirror or flip. ' +
  'CRITICAL — SEAMLESS LOOP: the last frame flows continuously back into the first with no pop. ' +
  'Keep the exact same art style, palette, thick dark outline and fully transparent background in ' +
  'every frame. No face, no eyes, no metal, no background, no shadow.';

if (!has('--generate')) {
  console.log('# base -> Sprites/projectiles/p_octoleg.webp\n' + BASE_PROMPT + '\n');
  console.log('# motion -> anim/octoLeg_0..8.webp\n' + MOTION + '\n# Re-run with --generate.');
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
// One shared canvas, no per-frame trim — independent trims re-centre each
// frame differently and make the loop jitter (rule from gen_bolt_anim.mjs).
async function normalise(buf) {
  return sharp(buf).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 92 }).toBuffer();
}

let baseBuf;
if (has('--skip-base') && await exists(STATIC_OUT)) {
  baseBuf = await readFile(STATIC_OUT);
  console.log('base: reusing existing p_octoleg.webp');
} else {
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      process.stdout.write(`base sprite attempt ${a} ... `);
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
      await writeFile(STATIC_OUT, baseBuf);
      console.log('ok -> p_octoleg.webp');
      break;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  if (!baseBuf) { console.error('BASE FAILED: ' + (last && last.message)); process.exit(1); }
}

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
    await mkdir(ANIM_DIR, { recursive: true });
    for (let i = 0; i < FRAMES; i++) await writeFile(join(ANIM_DIR, `octoLeg_${i}.webp`), await normalise(bufs[i]));
    console.log(`OK — wrote ${FRAMES} frames to Sprites/projectiles/anim/octoLeg_0..8.webp`);
    process.exit(0);
  } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
}
console.error('ANIM FAILED: ' + (last && last.message));
process.exit(1);
