#!/usr/bin/env node
// Soul Vortex (Lich X) — new pool art + a SMOOTH looping animation.
// =============================================================================
//   node scripts/generate_soul_vortex_fx.mjs            # dry-run: show prompts
//   node scripts/generate_soul_vortex_fx.mjs --generate # call Ludo, write art
//   ... --frames 16 --keep-base   (reuse _work/base.webp instead of re-rolling)
//
// Three stages, and the third is the one that matters:
//   1. /assets/image          -> a new base pool sprite
//   2. /assets/sprite/animate -> N looping frames from that base
//   3. NORMALISE              -> the part Ludo cannot do for us
//
// Why stage 3 exists. The shipped v0.26.504 frames were written straight from
// the model, and measuring them shows two defects the eye reads as "choppy":
//   • Content fills 0.60 of the frame canvas while the renderer scales by a
//     baked 0.76 (correct for the STATIC sprite only) — so the animated pool
//     drew ~20% narrower than its own hurtbox.
//   • Content HEIGHT swings 235->272 px across the nine frames (+/-16%), so the
//     pool visibly pulses and jitters once per loop.
// Cropping every frame to the UNION of all their content boxes fixes both at
// once: the margin goes away, every frame keeps its true relative motion (a
// per-frame crop would flatten the animation instead), and the content then
// fills the canvas exactly — so the renderer needs no magic fraction at all.
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FX_DIR = join(ROOT, 'Sprites', 'fx');
const ANIM_DIR = join(FX_DIR, 'anim');
const WORK = join(ROOT, 'scripts', '_tmp_sv_work');
const KEY = 'soul_vortex';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const FRAMES = Number(arg('--frames') || 16);

// The pool is drawn as a flat ellipse on the ground at 460x192 (LX_VORTEX_RX/RY
// x2), i.e. ~2.4:1 — so the art is authored wide and the swirl is seen in
// PERSPECTIVE, not from straight above. Saying so explicitly is the difference
// between a ground pool and a logo-like top-down spiral.
const BASE_PROMPT =
  'A wide flat elliptical necrotic soul-vortex pool lying ON THE GROUND, seen ' +
  'from a low 3/4 game camera so the whirlpool is a squashed horizontal ellipse ' +
  'in perspective, about three times wider than it is tall. A dark abyssal core ' +
  'at the centre sinks away into blackness; spectral ghost-green energy spirals ' +
  'inward around it in long sweeping arms, with pale translucent wisps and ' +
  'faint screaming soul-faces drawn down the spiral toward the core. Rim of the ' +
  'pool glows toxic emerald and frays into drifting embers. Bright rim light, ' +
  'deep contrast, glowing volumetric energy, crisp clean edges. Centered, whole ' +
  'effect fully inside the frame with transparent empty margin all around it. ' +
  'Nothing else in the image — no ground texture, no characters, no background, ' +
  'no text, no UI, no border. Transparent background.';

// Motion: it must LOOP and it must not change size. Everything that made the
// old frames jitter is named as a prohibition here.
const MOTION_PROMPT =
  'the soul vortex churns continuously in place: the spiral arms rotate ' +
  'smoothly and evenly around the dark core, wisps and soul-shapes are dragged ' +
  'inward and swallowed, and the emerald rim glow pulses gently. The motion is ' +
  'CONTINUOUS and SEAMLESS so the last frame flows back into the first with no ' +
  'jump. CRITICAL: the pool stays the EXACT same size, shape, position and ' +
  'framing in EVERY frame — do NOT zoom, scale, grow, shrink, translate, tilt, ' +
  'crop or mirror it, and do not change its outer silhouette. Only the energy ' +
  'inside and the glow move. Keep the whole effect inside the frame with margin.';

if (!has('--generate')) {
  console.log(`DRY RUN — nothing called, nothing written.\n`);
  console.log(`frames: ${FRAMES}   out: Sprites/fx/${KEY}.webp + Sprites/fx/anim/${KEY}_0..${FRAMES - 1}.webp\n`);
  console.log(`--- base prompt ---\n${BASE_PROMPT}\n`);
  console.log(`--- motion prompt ---\n${MOTION_PROMPT}\n`);
  console.log(`Re-run with --generate (needs LUDO_API_KEY).`);
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchBuf = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); };
async function post(path, body) {
  const res = await fetch(`${API}${path}`, { method: 'POST', signal: AbortSignal.timeout(300000),
    headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { const t = await res.text();
    if (/\b402\b/.test(t) || res.status === 402) throw new Error('402 OUT OF CREDITS');
    throw new Error(`${path} ${res.status}: ${t.slice(0, 200)}`); }
  return res.json();
}
await mkdir(WORK, { recursive: true });

// --- 1. base sprite ----------------------------------------------------------
const basePath = join(WORK, 'base.webp');
if (has('--keep-base') && existsSync(basePath)) {
  console.log('1/3 base: reusing scripts/_tmp_sv_work/base.webp');
} else {
  process.stdout.write('1/3 base sprite ... ');
  const d = await post('/assets/image', { image_type: 'sprite', art_style: 'Anime/Manga',
    aspect_ratio: 'ar_16_9', n: 1, augment_prompt: false, prompt: BASE_PROMPT });
  const url = Array.isArray(d) ? d[0]?.url : (d?.url || d?.images?.[0]?.url);
  if (!url) throw new Error('no image url in response');
  await writeFile(basePath, await sharp(await fetchBuf(url)).webp({ quality: 94 }).toBuffer());
  const m = await sharp(basePath).metadata();
  console.log(`OK (${m.width}x${m.height})`);
}

// --- 2. animate --------------------------------------------------------------
// Pad first: the model likes to drift a few percent, and headroom is cheaper
// than a clipped pool. Stage 3 removes the padding again.
process.stdout.write(`2/3 animating ${FRAMES} frames ... `);
const bm = await sharp(basePath).metadata();
const PAD = 0.12;
const padded = await sharp(basePath).extend({
  top: Math.round(bm.height * PAD), bottom: Math.round(bm.height * PAD),
  left: Math.round(bm.width * PAD), right: Math.round(bm.width * PAD),
  background: { r: 0, g: 0, b: 0, alpha: 0 },
}).webp({ quality: 94 }).toBuffer();
await writeFile(join(WORK, 'padded.webp'), padded);
const anim = await post('/assets/sprite/animate', {
  initial_image: `data:image/webp;base64,${padded.toString('base64')}`,
  motion_prompt: MOTION_PROMPT, frames: FRAMES, frame_size: -9,
  model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite',
});
let bufs = [];
if (anim.spritesheet_url && anim.num_cols && anim.num_rows) {
  const sheet = await fetchBuf(anim.spritesheet_url), sm = await sharp(sheet).metadata();
  const cw = Math.floor(sm.width / anim.num_cols), ch = Math.floor(sm.height / anim.num_rows);
  for (let r = 0; r < anim.num_rows && bufs.length < FRAMES; r++)
    for (let c = 0; c < anim.num_cols && bufs.length < FRAMES; c++)
      bufs.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).webp({ quality: 94 }).toBuffer());
}
if (bufs.length < FRAMES && Array.isArray(anim.individual_frame_urls)) {
  bufs = []; for (const u of anim.individual_frame_urls.slice(0, FRAMES)) bufs.push(await fetchBuf(u));
}
if (bufs.length < FRAMES) throw new Error(`got ${bufs.length}/${FRAMES} frames`);
console.log('OK');

// --- 3. normalise to the union content box ----------------------------------
process.stdout.write('3/3 normalising ... ');
const ALPHA = 24;
const bbox = async (buf) => {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (data[(y * W + x) * C + 3] > ALPHA) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  return (x1 < 0) ? null : { x0, y0, x1, y1, W, H };
};
const boxes = [];
for (const b of bufs) { const bb = await bbox(b); if (bb) boxes.push(bb); }
if (!boxes.length) throw new Error('every frame is empty');
const U = boxes.reduce((a, b) => ({
  x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0),
  x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), W: a.W, H: a.H,
}));
const cropW = U.x1 - U.x0 + 1, cropH = U.y1 - U.y0 + 1;
await mkdir(ANIM_DIR, { recursive: true });
for (let i = 0; i < bufs.length; i++) {
  const out = await sharp(bufs[i]).extract({ left: U.x0, top: U.y0, width: cropW, height: cropH })
    .webp({ quality: 92 }).toBuffer();
  await writeFile(join(ANIM_DIR, `${KEY}_${i}.webp`), out);
}
// Static fallback + the source the skill icon is baked from: frame 0, same box.
await writeFile(join(FX_DIR, `${KEY}.webp`),
  await sharp(bufs[0]).extract({ left: U.x0, top: U.y0, width: cropW, height: cropH }).webp({ quality: 94 }).toBuffer());
console.log(`OK — ${bufs.length} frames at ${cropW}x${cropH}, content fills the canvas`);
console.log(`\nNEXT: node scripts/gen_sprite_frame_index.mjs   (the loader asks the index how many frames exist)`);
