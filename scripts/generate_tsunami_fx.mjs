#!/usr/bin/env node
// p_tsunami — nicer wave art + a real looping animation (ludo.ai)
// =============================================================================
// Per user: "regenerate p_tsunami sprite into something there is much nicer" and
// then "add animation for this as well".
//
// WHAT WAS WRONG. The shipped art — static AND all nine animation frames — was
// a flat teal SLAB: a near-full-frame rectangle of water with a scalloped top
// and squared sides. It read as a wall or a curtain, never a wave, and the nine
// "animation" frames were near-identical, so the effect looked frozen.
//
// WHICH FILE ACTUALLY MATTERS. drawProjectiles picks
// `_projAnimFrame(p.skill) || LX_MOB_PROJ[p.skill]`, and 'tsunami' is already
// in _PROJ_ANIM_KEYS with 9 frames on disk — so the ANIMATION is what renders
// and the static webp is only the pre-decode fallback. Replacing just the
// static sprite would have changed almost nothing on screen. Both are rebuilt
// here from one base so they cannot disagree.
//
// This sprite serves two skills, both drawn with _PROJ_SPRITE_BLIT
// mode:'orient' (rotated to atan2(vy, vx) every frame):
//   • tsunami    — Cancer's horizontal water wave
//   • tidalSweep — Octobaby's grotto tidal sweep (wired v0.29.931)
// So the art must read as a wave travelling LEFT-TO-RIGHT along its own long
// axis and taper at both ends, or any rotation looks like a sliced rectangle.
//
// PIPELINE (same three stages as generate_soul_vortex_fx.mjs, which is the
// in-repo precedent for a clean looping VFX):
//   1. /assets/image           -> a base wave sprite
//   2. /assets/sprite/animate  -> N temporally-coherent looping frames
//   3. bake to the UNION content box of every frame
// Stage 3 is the one that matters for smoothness: writing each frame trimmed to
// its OWN box makes the content rescale frame to frame, which is exactly the
// size-jitter that read as choppiness on the old vortex set (v0.29.926).
//
//   node scripts/generate_tsunami_fx.mjs                       # dry-run
//   node scripts/generate_tsunami_fx.mjs --generate            # 9 frames
//   flags: --frames N  --base <png>  (skip stage 1, animate an existing image)
// Needs LUDO_API_KEY. Never commit the key.
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROJ_DIR = join(repoRoot, 'Sprites', 'projectiles');
const ANIM_DIR = join(PROJ_DIR, 'anim');
const WORK = join(repoRoot, 'scripts', '_tmp_tsu_work');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// Frame count stays 9 — that is what ships today and what data/sprite_frame_index.js
// records. Changing it means regenerating the index too.
const FRAMES = Number(arg('--frames') || 9);
const KEY = 'tsunami';

const SUFFIX = ' special-effect for a 2D side-scroller game, simple flat cel-shaded anime style with bold dark outlines, minimal detail, clean bold simple shapes, vibrant saturated colors, game VFX element only, no character, no person, no creature, no text, every stroke tapers and fades to nothing well before the image border, nothing touching or clipped by the frame edge, generous empty margin on all sides, transparent background';

// Effect-first and explicitly a side-on TRAVELLING wave, never a body of water:
// the old art failed by being a filled rectangle, so the shape vocabulary here
// is all crest / curl / spray with a thin tapering tail. Long "cute RPG
// aesthetic" prefixes make this account's sprite model return chibi characters
// regardless of the effect described — see generate_dash_fx.mjs.
const BASE_PROMPT =
  'A single cresting ocean wave seen from the side travelling to the right, '
  + 'one tall curling turquoise crest at the right end with a white foam lip curling over, '
  + 'the body sweeping back to the left and thinning to a fine tapered tail, '
  + 'a few small white foam droplets flicking off the crest, '
  + 'much wider than tall, strong sense of fast sideways motion, deep teal to bright cyan gradient,'
  + SUFFIX;

// The wave must churn IN PLACE — it is rotated to velocity by the blit, so any
// net drift in the frames fights the engine's own motion and reads as sliding.
const MOTION_PROMPT =
  'the wave churns and rolls continuously in place without moving off centre: '
  + 'the crest curls over and breaks, white foam spills down the face and is drawn back up, '
  + 'spray droplets flick off the top of the crest and fade, '
  + 'the tapered tail ripples. seamless loop, the overall silhouette and its position, '
  + 'size and framing stay constant every frame, no camera movement, no zooming, no drifting, '
  + 'no character, no creature, transparent background';

if (!has('--generate')) {
  console.log('# p_tsunami art + animation (ludo.ai)\n');
  console.log(`  frames : ${FRAMES}`);
  console.log(`  out    : Sprites/projectiles/p_${KEY}.webp`);
  console.log(`           Sprites/projectiles/anim/${KEY}_0..${FRAMES - 1}.webp`);
  console.log('  used by: tsunami (Cancer) + tidalSweep (Octobaby) — both mode:orient');
  console.log('\n  NOTE: the ANIMATION is what renders in game (_projAnimFrame wins over');
  console.log('        the static sprite); the static webp is the pre-decode fallback.');
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flags: --frames N --base <png>');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); };
async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST', signal: AbortSignal.timeout(300000),
    headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 402 || /\b402\b/.test(t)) throw new Error('402 OUT OF CREDITS');
    throw new Error(`${path} ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}
await mkdir(WORK, { recursive: true });

// --- 1. base sprite ----------------------------------------------------------
const basePath = join(WORK, 'base.webp');
const supplied = arg('--base');
if (supplied && existsSync(supplied)) {
  console.log(`1/3 base: using ${supplied}`);
  await writeFile(basePath, await sharp(supplied).webp({ quality: 94 }).toBuffer());
} else {
  process.stdout.write('1/3 base sprite ... ');
  const d = await post('/assets/image', {
    image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_16_9',
    n: 1, augment_prompt: false, prompt: BASE_PROMPT,
  });
  const url = Array.isArray(d) ? d[0]?.url : (d?.url || d?.images?.[0]?.url);
  if (!url) throw new Error('no image url in response');
  await writeFile(basePath, await sharp(await fetchBuf(url)).webp({ quality: 94 }).toBuffer());
  const m = await sharp(basePath).metadata();
  console.log(`OK (${m.width}x${m.height})`);
}

// --- 2. animate --------------------------------------------------------------
// Pad first: the model drifts a few percent, and headroom is cheaper than a
// clipped crest. Stage 3 removes the padding again.
process.stdout.write(`2/3 animating ${FRAMES} frames ... `);
const bm = await sharp(basePath).metadata();
const PAD = 0.12;
const padded = await sharp(basePath).extend({
  top: Math.round(bm.height * PAD), bottom: Math.round(bm.height * PAD),
  left: Math.round(bm.width * PAD), right: Math.round(bm.width * PAD),
  background: { r: 0, g: 0, b: 0, alpha: 0 },
}).webp({ quality: 94 }).toBuffer();
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

// --- 3. bake to the UNION content box ----------------------------------------
// One box for every frame: the art IS its content, no per-frame rescale. Writing
// each frame trimmed to its own box is what made the old vortex set jitter.
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
  await writeFile(join(ANIM_DIR, `${KEY}_${i}.webp`),
    await sharp(bufs[i]).extract({ left: U.x0, top: U.y0, width: cropW, height: cropH }).webp({ quality: 92 }).toBuffer());
}
// Static fallback comes from the SAME box, so the pre-decode frame and the loop
// are the same wave at the same size — no pop when the animation takes over.
await writeFile(join(PROJ_DIR, `p_${KEY}.webp`),
  await sharp(bufs[0]).extract({ left: U.x0, top: U.y0, width: cropW, height: cropH }).webp({ quality: 94 }).toBuffer());
console.log(`OK — ${bufs.length} frames at ${cropW}x${cropH} (aspect ${(cropW / cropH).toFixed(2)}), content fills the canvas`);
console.log('\nNEXT: node scripts/gen_sprite_frame_index.mjs   (the loader asks the index how many frames exist)');
