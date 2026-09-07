#!/usr/bin/env node
// The A-press (block / parry stance) gets a class-specific animation: four
// one-shot VFX sets, one per class, drawn over the player when A lands.
//   warrior SHIELD - a golden kite shield of light raised and braced
//   rogue   EVADE  - a violet smoke burst with shadow streaks
//   mage    VANISH - a blue-white arcane veil shimmering into nothing
//   archer  ROLL   - a green wind-and-leaf swirl arcing low
// Two ludo.ai stages each: text->image for the key frame, /assets/sprite/animate
// to drive it (frame_size -9 keeps the framing; the motion prompt is verbs only).
// Frames and the base are re-framed with ONE shared square crop (union of all
// content boxes, centred, with margin) so the set cannot jitter.
//
//   node scripts/gen_block_fx_ludo.mjs                 # dry-run, prints prompts
//   node scripts/gen_block_fx_ludo.mjs --generate      # needs LUDO_API_KEY
//   flags: --only=warrior,rogue   --force (overwrite existing sets)
// Output -> Sprites/fx/block_<cls>.webp + Sprites/fx/anim/block_<cls>_0..8.webp
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const FX_DIR = join(repoRoot, 'Sprites', 'fx');
const ANIM_DIR = join(FX_DIR, 'anim');
const FRAMES = 9, SIZE = 512, MARGIN = 0.06;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const only = (argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);

const COMMON = 'Game VFX sprite, side view, fully transparent background, alpha only - no scene, no floor, no character, no text, no watermark. ONE centered effect filling most of the square canvas with clear margin on every side, nothing cropped. Painterly cel-shaded anime game-art style, crisp confident edges, high contrast against transparency. ';
const HOLD = ' The effect stays centered and the same size in frame - do NOT zoom, do NOT pan, do NOT rotate the camera. Fully transparent background, consistent art style across every frame, nothing cropped.';
const SETS = {
  warrior: {
    base: COMMON + 'A large golden kite shield made of radiant light, seen from the front-left, edged with bright white and warm amber glow, small sparks and light motes around its rim, a faint circular ring of light behind it.',
    motion: 'The shield of light flares into existence and braces: it snaps bright, a ring of light pulses outward from its centre, sparks scatter off the rim, then the glow softens and the shield dissolves into drifting motes.' + HOLD,
  },
  rogue: {
    base: COMMON + 'A burst of violet and deep-purple smoke with streaking shadow trails sweeping to one side, small dark afterimage wisps, faint magenta sparks, the smoke thick at the centre and thinning at the edges.',
    motion: 'The smoke bursts outward from the centre, the shadow streaks whip sideways and stretch, wisps curl and tumble, magenta sparks flicker, then the whole cloud thins and dissipates into transparency.' + HOLD,
  },
  mage: {
    base: COMMON + 'A shimmering arcane veil: a tall oval of pale blue-white light with glowing rune glyphs orbiting it, soft cyan sparkles, thin rings of light, ethereal and translucent, the centre fading toward invisibility.',
    motion: 'The veil shimmers and ripples like water, the rune glyphs orbit and glow brighter, sparkles drift upward, the rings of light expand, then the veil folds inward and vanishes leaving a few fading sparkles.' + HOLD,
  },
  archer: {
    base: COMMON + 'A swirling arc of green wind and scattered leaves sweeping low in a rolling curve, pale dust puffs at the base, bright emerald streaks of speed, a few small leaves and grass blades caught in the gust.',
    motion: 'The gust sweeps through in a rolling arc: wind streaks stretch and curl, leaves tumble and spin along the curve, dust puffs kick up at the base and drift, then the streaks thin and the leaves scatter away.' + HOLD,
  },
};
if (!has('--generate')) {
  for (const [cls, s] of Object.entries(SETS)) { if (only.length && !only.includes(cls)) continue; console.log(`# block_${cls}\n--- base ---\n${s.base}\n--- motion ---\n${s.motion}\n`); }
  console.log('# Re-run with --generate (needs LUDO_API_KEY). Flags: --only=a,b --force'); process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY; if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const fetchBuf = async (url) => { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };
async function framesFrom(data, n) {
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const cols = data.num_cols, rows = data.num_rows, sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
    if (!cols || !rows || !meta.width || !meta.height) throw new Error('bad sheet grid');
    const cw = Math.floor(meta.width / cols), ch = Math.floor(meta.height / rows), o = []; if (cw < 8 || ch < 8) throw new Error(`bad cell ${cw}x${ch}`);
    for (let r = 0; r < rows && o.length < n; r++) for (let c = 0; c < cols && o.length < n; c++) o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  const urls = data.individual_frame_urls || []; if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  throw new Error('no usable frames');
}
const bbox = async (png) => {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 10) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1, n };
};
const post = async (path, body, ms) => { for (let attempt = 1; ; attempt++) { try {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(ms), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${(await res.text()).slice(0, 140)}`); return await res.json();
} catch (e) { console.error(`  attempt ${attempt}: ${e.message}`); if (attempt >= 4) throw e; await sleep(4000 * attempt); } } };
await mkdir(ANIM_DIR, { recursive: true });
for (const [cls, s] of Object.entries(SETS)) {
  if (only.length && !only.includes(cls)) continue;
  const KEY = 'block_' + cls;
  if (!has('--force') && await exists(join(ANIM_DIR, `${KEY}_8.webp`))) { console.log(`${KEY}: skip (frames exist - use --force)`); continue; }
  console.log(`== ${KEY}`);
  const img = await post('/assets/image', { image_type: 'sprite-vfx', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: s.base }, 150000);
  const url = Array.isArray(img) ? img[0]?.url : (img?.url || img?.images?.[0]?.url); if (!url) throw new Error('no url');
  const trimmed = await sharp(await fetchBuf(url)).trim().png().toBuffer(); const tm = await sharp(trimmed).metadata();
  const inner = Math.round(SIZE * (1 - 2 * MARGIN)); const sc = Math.min(inner / tm.width, inner / tm.height); const cw = Math.max(1, Math.round(tm.width * sc)), ch = Math.max(1, Math.round(tm.height * sc));
  const base = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp(trimmed).resize(cw, ch, { fit: 'fill' }).png().toBuffer(), left: Math.round((SIZE - cw) / 2), top: Math.round((SIZE - ch) / 2) }]).png().toBuffer();
  console.log(`  base content ${tm.width}x${tm.height} -> ${cw}x${ch} centred in ${SIZE}`);
  const uri = 'data:image/png;base64,' + base.toString('base64');
  const anim = await post('/assets/sprite/animate', { initial_image: uri, motion_prompt: s.motion, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: false, image_type: 'sprite-vfx' }, 300000);
  const bufs = await framesFrom(anim, FRAMES);
  const norm = []; for (const b of bufs) norm.push(await sharp(b).resize(SIZE, SIZE, { fit: 'fill' }).ensureAlpha().png().toBuffer());
  const boxes = []; for (const p of norm) boxes.push(await bbox(p)); const bb = await bbox(base);
  boxes.forEach((b, i) => console.log(`  frame ${i}: x ${b.x0}..${b.x1} y ${b.y0}..${b.y1} px ${b.n}`));
  if (boxes.slice(0, 6).some((b) => b.n < bb.n * 0.25)) { console.error(`${KEY}: an early frame lost most of the effect - re-run`); process.exit(1); }
  const U = boxes.concat([bb]).reduce((a, c) => ({ x0: Math.min(a.x0, c.x0), y0: Math.min(a.y0, c.y0), x1: Math.max(a.x1, c.x1), y1: Math.max(a.y1, c.y1) }));
  const side = Math.min(SIZE, Math.round(Math.max(U.x1 - U.x0, U.y1 - U.y0) * (1 + 2 * MARGIN)));
  let left = Math.round((U.x0 + U.x1) / 2 - side / 2), top = Math.round((U.y0 + U.y1) / 2 - side / 2);
  left = Math.max(0, Math.min(SIZE - side, left)); top = Math.max(0, Math.min(SIZE - side, top));
  console.log(`  union x ${U.x0}..${U.x1} y ${U.y0}..${U.y1} -> crop ${side}x${side} at (${left},${top})`);
  const reframe = (png) => sharp(png).extract({ left, top, width: side, height: side }).resize(SIZE, SIZE, { fit: 'fill' }).webp({ quality: 90 }).toBuffer();
  for (let i = 0; i < norm.length; i++) await writeFile(join(ANIM_DIR, `${KEY}_${i}.webp`), await reframe(norm[i]));
  await writeFile(join(FX_DIR, `${KEY}.webp`), await reframe(base));
  console.log(`  ${norm.length} frames ${SIZE}x${SIZE} -> ${ANIM_DIR}/${KEY}_0..${norm.length - 1}.webp + base`);
}
console.log('NOTE: run `node scripts/gen_sprite_frame_index.mjs` - the loader asks the index how many frames exist.');
