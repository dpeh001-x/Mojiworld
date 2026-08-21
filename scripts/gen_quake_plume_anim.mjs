#!/usr/bin/env node
// Monster / boss ground-slam SMOKE PLUME — a 9-frame animation of its own.
//
// The slam telegraph (`mob_quake`, fired by high-tier monsters and by bosses
// such as Legosaurus) has been animating on THREE frames. It borrows
// quake_ring.webp, whose 9 frames are an eruption that BECOMES a debris ring:
// 0-2 billow, frame 3 introduces a smoke torus, 4-8 spread a ring over a
// settling mound. The user asked for "just the plume", so the renderer caps
// itself at frame 2 and the other six are unusable — a third of an animation
// doing a full animation's job.
//
// So author a plume that is a plume for all nine frames: a side-on dust
// column that punches up, billows, rolls over and thins out, never becoming a
// ring. Then the cap can go and the effect animates properly.
//
// Two stages, both ludo.ai: text->image for the key frame, then
// /assets/sprite/animate to drive it. frame_size:-9 (True-Size) plus a
// motion-only HOLD prompt keeps the model from zooming or panning, which
// otherwise crops the plume; every frame is then resized to the exact base
// dims so the in-game blit box matches pixel for pixel.
//
// NO-CUTOFF (per user "ensure that there is no cutoff, it gets truncated at
// the top"). Prompting alone does not get there: the first pass asked for
// headroom and still returned frames whose content began at y=4 of 768 —
// pressed flat against the ceiling, so the billowing heads read as sliced. A
// dust plume grows upward, so any zoom the model applies eats the top first.
// The fix is mechanical rather than verbal, in three parts:
//   1. COMPOSE the base ourselves — trim the generated art to its content and
//      seat it in the lower HEADROOM_FRAC of the canvas, bottom-flush. The
//      model then starts with room above it no matter what it drew.
//   2. Let it animate into that room.
//   3. RE-FRAME afterwards from the measured union bbox of all nine frames:
//      one identical square crop, bottom-flush (the plume's base must stay on
//      the ground line the renderer anchors to) with a small margin above.
//      Identical for every frame, so the set cannot jitter.
// The script then FAILS if any frame's content still touches an edge, so a bad
// roll cannot be shipped by accident.
//
//   node scripts/gen_quake_plume_anim.mjs             # dry-run, prints prompts
//   node scripts/gen_quake_plume_anim.mjs --generate  # needs LUDO_API_KEY
//   flags: --force (overwrite existing frames)
// Output -> Sprites/vfx/quake_plume.webp + Sprites/vfx/anim/quake_plume_0..8.webp
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const VFX_DIR = join(repoRoot, 'Sprites', 'vfx');
const ANIM_DIR = join(VFX_DIR, 'anim');
const KEY = 'quake_plume';
const FRAMES = 9, SIZE = 768;
// The plume occupies this fraction of the base canvas height, bottom-flush, so
// the animator has the rest as headroom to billow into.
const HEADROOM_FRAC = 0.60;
// Margin left above/beside the content when re-framing. Bottom gets none: the
// renderer anchors the art's bottom edge to the ground line.
const REFRAME_MARGIN = 0.05;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);

const BASE_PROMPT =
  'Game VFX sprite, SIDE VIEW: a violent burst of DUST AND SMOKE erupting upward from the ground. ' +
  'Fully transparent background, alpha only — no scene, no sky, no floor line, no text, no watermark, ' +
  'no characters, no rocks arranged in a ring. ONE single centered plume, its base flush with the ' +
  'BOTTOM EDGE of the square canvas and its top well inside the canvas with clear headroom — nothing ' +
  'cropped on any side. A broad column of churning grey-brown dust billowing upward and outward into ' +
  'soft rolling cauliflower heads, denser and darker at the base, thinning to translucent wisps at the ' +
  'top. Warm tan and dusty ochre in the thick lower body, cooler grey in the high wisps, with a few ' +
  'small dark pebbles and grit flung up inside the near edge. Painterly cel-shaded anime game-art ' +
  'style with soft confident outlines, high contrast against transparency. ' +
  'STRICTLY NO RING: no torus, no circular shockwave, no expanding disc, no halo — this is a vertical ' +
  'billowing column seen from the side, not a ground ring seen from above.';

// Motion-only. Every verb describes the dust itself; nothing moves the camera,
// and nothing is allowed to spread outward into a ring — that is the exact
// failure mode of the art this replaces.
const MOTION =
  'The dust plume erupts and lives: it punches upward fast at first, its cauliflower heads swelling ' +
  'and rolling over themselves, billowing and churning outward slightly as it rises, the dense base ' +
  'boiling and pulsing, grit and small pebbles arcing up through it, and the high wisps thinning and ' +
  'feathering away into transparency as the whole column loses energy and begins to settle.';
const HOLD =
  ' The plume stays centered and stays the same size in frame — do NOT zoom, do NOT pan, do NOT rotate, ' +
  'do NOT push the camera. It must NEVER form a ring, torus, circular shockwave or expanding disc; it ' +
  'remains a side-on vertical column of dust for every frame. Its base stays planted on the bottom edge, ' +
  'the top never leaves the canvas, nothing is cropped. Fully transparent background, consistent art ' +
  'style across every frame.';

if (!has('--generate')) {
  console.log(`# ${KEY} -> Sprites/vfx/${KEY}.webp + Sprites/vfx/anim/${KEY}_0..${FRAMES - 1}.webp\n`);
  console.log('--- base image prompt ---\n' + BASE_PROMPT);
  console.log('\n--- motion prompt ---\n' + MOTION + HOLD);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flag: --force');
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const fetchBuf = async (url) => { const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };

// The endpoint answers with {spritesheet_url, num_cols, num_rows} even when
// individual_frames is set, so try the sheet first and fall back to the URLs.
async function framesFrom(data, n) {
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const cols = data.num_cols, rows = data.num_rows;
    const sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
    // Guard the grid: a mismatched sheet has crashed sharp hard (0xC0000409).
    if (!cols || !rows || !meta.width || !meta.height) throw new Error('bad sheet grid');
    const cw = Math.floor(meta.width / cols), ch = Math.floor(meta.height / rows), o = [];
    if (cw < 8 || ch < 8) throw new Error(`bad cell ${cw}x${ch}`);
    for (let r = 0; r < rows && o.length < n; r++) for (let c = 0; c < cols && o.length < n; c++)
      o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  const urls = data.individual_frame_urls || [];
  if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  throw new Error('no usable frames');
}

const basePath = join(VFX_DIR, `${KEY}.webp`);
if (!has('--force') && await exists(join(ANIM_DIR, `${KEY}_8.webp`))) {
  console.log('skip (frames exist — use --force)'); process.exit(0);
}

// --- stage 1: the key frame ------------------------------------------------
let base;
for (let attempt = 1; ; attempt++) {
  try {
    const res = await fetch(`${API}/assets/image`, {
      method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(150000),
      body: JSON.stringify({ image_type: 'sprite-vfx', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: BASE_PROMPT }),
    });
    if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
    const data = await res.json();
    const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
    if (!url) throw new Error('no url');
    // Compose the headroom ourselves rather than asking for it: trim to the
    // content the model actually drew, scale it to HEADROOM_FRAC of the canvas
    // height, and seat it bottom-flush. Whatever framing came back, the plume
    // now has room above it to grow into.
    const trimmed = await sharp(await fetchBuf(url)).trim().png().toBuffer();
    const tm = await sharp(trimmed).metadata();
    const ch = Math.round(SIZE * HEADROOM_FRAC);
    const cw = Math.min(SIZE, Math.round(tm.width * (ch / tm.height)));
    const body = await sharp(trimmed).resize(cw, ch, { fit: 'fill' }).png().toBuffer();
    base = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: body, left: Math.round((SIZE - cw) / 2), top: SIZE - ch }])
      .webp({ quality: 92 }).toBuffer();
    console.log(`  base content ${tm.width}x${tm.height} -> ${cw}x${ch}, seated bottom-flush with ${Math.round((1 - HEADROOM_FRAC) * 100)}% headroom`);
    break;
  } catch (e) { if (attempt >= 4) throw e; await sleep(3000 * attempt); }
}
await mkdir(VFX_DIR, { recursive: true });
await writeFile(basePath, base);
console.log(`base frame ${SIZE}x${SIZE} ${Math.round(base.length / 1024)} KB -> ${basePath}`);

// --- stage 2: drive it -----------------------------------------------------
// The animate endpoint wants the image inline and under ~1MP.
const small = await sharp(base).resize(640, 640, { fit: 'inside' }).png().toBuffer();
const uri = 'data:image/png;base64,' + small.toString('base64');
let bufs;
for (let attempt = 1; ; attempt++) {
  try {
    const res = await fetch(`${API}/assets/sprite/animate`, {
      method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(300000),
      body: JSON.stringify({ initial_image: uri, motion_prompt: MOTION + HOLD, frames: FRAMES,
        frame_size: -9, model: 'eagle', individual_frames: true, loop: false, image_type: 'sprite-vfx' }),
    });
    if (!res.ok) throw new Error(`animate ${res.status}: ${(await res.text()).slice(0, 140)}`);
    bufs = await framesFrom(await res.json(), FRAMES);
    break;
  } catch (e) { if (attempt >= 4) throw e; await sleep(4000 * attempt); }
}
// --- stage 3: re-frame from what was actually drawn ------------------------
// Normalise every frame to SIZE first, then measure the union of all nine
// content boxes and crop them all with ONE identical square. Per-frame crops
// would make the set jitter; a shared crop cannot.
const norm = [];
for (const buf of bufs) norm.push(await sharp(buf).resize(SIZE, SIZE, { fit: 'fill' }).ensureAlpha().png().toBuffer());
const bbox = async (png) => {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 10) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return { x0, y0, x1, y1 };
};
const boxes = [];
for (const p of norm) boxes.push(await bbox(p));
const U = boxes.reduce((a, c) => ({ x0: Math.min(a.x0, c.x0), y0: Math.min(a.y0, c.y0),
  x1: Math.max(a.x1, c.x1), y1: Math.max(a.y1, c.y1) }));
console.log(`union content box: x ${U.x0}..${U.x1}, y ${U.y0}..${U.y1} (of ${SIZE})`);

// A frame whose content runs into an edge was cropped by the model, and no
// amount of re-framing invents the pixels back. Refuse rather than ship it.
const clipped = boxes.map((b2, i) => ({ i, top: b2.y0 <= 1, left: b2.x0 <= 1, right: b2.x1 >= SIZE - 2 }))
  .filter(c => c.top || c.left || c.right);
if (clipped.length) {
  console.error('CUT OFF — content runs into an edge on frames: ' +
    clipped.map(c => `${c.i}(${[c.top && 'top', c.left && 'left', c.right && 'right'].filter(Boolean).join('+')})`).join(', '));
  console.error('Re-run: the model zoomed past the headroom. Lower HEADROOM_FRAC and try again.');
  process.exit(1);
}

// One square crop for the whole set: bottom-flush on the union box (the base
// must sit on the ground line the renderer anchors to), margin above and beside.
const m = Math.round((U.y1 - U.y0) * REFRAME_MARGIN);
let top = Math.max(0, U.y0 - m), left = Math.max(0, U.x0 - m), right = Math.min(SIZE, U.x1 + 1 + m);
const bottom = Math.min(SIZE, U.y1 + 1);
let side = Math.max(right - left, bottom - top);
side = Math.min(side, SIZE);
let cropTop = Math.max(0, bottom - side);
let cropLeft = Math.round((left + right) / 2 - side / 2);
cropLeft = Math.max(0, Math.min(SIZE - side, cropLeft));
console.log(`re-frame: ${side}x${side} at (${cropLeft},${cropTop}) — bottom-flush, ${Math.round(m)}px headroom`);

await mkdir(ANIM_DIR, { recursive: true });
for (let i = 0; i < norm.length; i++) {
  const out = await sharp(norm[i])
    .extract({ left: cropLeft, top: cropTop, width: side, height: side })
    .resize(SIZE, SIZE, { fit: 'fill' })
    .webp({ quality: 92 }).toBuffer();
  await writeFile(join(ANIM_DIR, `${KEY}_${i}.webp`), out);
}
// The static fallback must match the re-framed set, or the pre-decode blit jumps.
await writeFile(basePath, await sharp(norm[0])
  .extract({ left: cropLeft, top: cropTop, width: side, height: side })
  .resize(SIZE, SIZE, { fit: 'fill' }).webp({ quality: 92 }).toBuffer());
for (let i = 0; i < norm.length; i++) {
  const b2 = await bbox(await sharp(join(ANIM_DIR, `${KEY}_${i}.webp`)).png().toBuffer());
  console.log(`  frame ${i}: content y ${b2.y0}..${b2.y1}, x ${b2.x0}..${b2.x1}` + (b2.y0 <= 1 ? '   <-- STILL TOUCHING TOP' : ''));
}
console.log(`${norm.length} frames ${SIZE}x${SIZE} -> ${ANIM_DIR}/${KEY}_0..${norm.length - 1}.webp`);
console.log('NOTE: run `node scripts/gen_sprite_frame_index.mjs` — the loader asks the index how many frames exist.');
