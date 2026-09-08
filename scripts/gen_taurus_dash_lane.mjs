#!/usr/bin/env node
// Taur the Granite Bull's charge-lane telegraph (ludo.ai):
//   base -> Sprites/fx/tg_dash_zodiac_taurus.webp
//   anim -> Sprites/fx/anim/tg_dash_zodiac_taurus_0..8.webp
//
//   node scripts/gen_taurus_dash_lane.mjs              # dry run (prints prompts)
//   node scripts/gen_taurus_dash_lane.mjs --generate   # needs LUDO_API_KEY
//   flags: --only=base|anim
//
// v0.30.x — per user: "make the top and bottom edge to be less blocky, make it look more aesthetic
// and zodiac themed".
//
// THE ASPECT IS THE BUG. _lxAttackZones draws a telegraph with
//   ctx.drawImage(_img, sx, sy, z.w, z.h)
// which stretches the WHOLE sprite into the lane rect. Taur's lane is
//   w = m.w + distance + pad = 283 + 620 + 30 = 933,  h = m.h = 290   -> 3.22:1
// and the old art was authored 768x768, i.e. SQUARE. Every frame was therefore squashed 3.2x
// horizontally on screen, which is what flattened its stone kerbs into the blocky bars the user
// is looking at: they are drawn as neat rectangular blocks and then crushed wide. Authoring at
// the lane's true ratio is most of the fix; asking for a soft feathered falloff instead of hard
// stone rails is the rest.
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = join(repoRoot, 'Sprites', 'fx', 'tg_dash_zodiac_taurus.webp');
const ANIM_DIR = join(repoRoot, 'Sprites', 'fx', 'anim');
// 3.2:1, the measured lane ratio. Width 1024 keeps the chevrons crisp when the lane is ~933px.
const W = 1024, H = 320, FRAMES = 9;
const V_MARGIN = 0.06;   // transparent gutter kept at top and bottom ONLY
const ALPHA_ON = 8;
const has = (f) => process.argv.includes(f);
const only = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1];

const BASE_PROMPT =
  'A long horizontal CHARGE LANE warning corridor for a 2D fantasy game boss, zodiac Taurus themed, ' +
  'in a wide letterbox composition about three times wider than it is tall. ' +
  'A translucent corridor of warm amber and gold celestial energy running the full width, filled ' +
  'with large bold chevron arrows all pointing to the RIGHT along its length, the chevrons shaped ' +
  'like sweeping BULL HORNS. Along the corridor, a faint CONSTELLATION of the Taurus star sign: ' +
  'small bright stars joined by thin delicate gold lines, and one glowing Taurus zodiac glyph ' +
  '(a circle with two horns rising from it) set as a seal in the lane. Golden speed streaks, ' +
  'drifting stardust motes and faint hoofprint sparks inside the corridor. ' +
  'CRITICAL — the TOP and BOTTOM edges must FADE SOFTLY to fully transparent with a feathered, ' +
  'wispy, glowing falloff: NO hard rails, NO straight border lines, NO stone kerbs, NO bricks, ' +
  'NO blocks, NO paving, NO solid ground plane, no rectangular frame of any kind. The lane is ' +
  'made of light and stardust, not masonry. ' +
  'The corridor runs off the left and right edges of the frame as a continuing tunnel. ' +
  'Deep indigo-to-amber celestial palette, luminous gold, warm bronze. Flat 2D cartoon game vfx ' +
  'sprite, crisp cel shading, glowing, ominous but clearly a WARNING MARKER not an explosion. ' +
  'Fully TRANSPARENT background. NO bull, NO creature, NO character, NO text, NO watermark, ' +
  'NO ground, NO scenery, NO background.';

const MOTION =
  'The celestial charge lane SURGES with warning energy, changing visibly in EVERY single frame, ' +
  'with the motion spread evenly across all nine frames and no still or near-identical frames: ' +
  'the bull-horn chevrons brighten in sequence one after another from left to right like a ' +
  'travelling pulse racing down the corridor, the golden speed streaks stream rightward, the ' +
  'constellation stars twinkle and their joining lines shimmer, the Taurus glyph seal pulses ' +
  'brighter and dimmer, and stardust motes drift through the lane. ' +
  'CRITICAL — the TOP and BOTTOM edges stay SOFT and feathered, fading to transparent in every ' +
  'frame; never grow a hard rail, border line, kerb, brick or solid edge. ' +
  'CRITICAL — LOCKED FRAMING: the corridor keeps exactly the same height, position and scale in ' +
  'every frame; no zoom, pan, crop, rescale, drift, wobble, mirror or flip, and the lane must NOT ' +
  'rotate or tilt. The chevrons keep pointing RIGHT in every frame and stay in the same places — ' +
  'they brighten in place rather than sliding along. ' +
  'CRITICAL — SEAMLESS LOOP: the last frame flows continuously back into the first with no pop. ' +
  'Keep the exact same art style, wide letterbox shape, celestial amber-gold palette and fully ' +
  'transparent background in every frame. No bull, no creature, no character, no text, no background.';

if (!has('--generate')) {
  console.log(`# base -> Sprites/fx/tg_dash_zodiac_taurus.webp  (${W}x${H}, the 3.2:1 lane ratio)\n` + BASE_PROMPT + '\n');
  console.log('# anim -> Sprites/fx/anim/tg_dash_zodiac_taurus_0..8.webp\n' + MOTION + '\n# Re-run with --generate.');
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
async function alphaBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) { const row = y * w * ch;
    for (let x = 0; x < w; x++) if (data[row + x * ch + (ch - 1)] > ALPHA_ON) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  if (x1 < 0) throw new Error('fully transparent');
  return { x0, y0, x1: x1 + 1, y1: y1 + 1, w, h };
}
// A LANE's edge rule is not a burst's. Left and right SHOULD run to the frame — the corridor is a
// continuing tunnel and a gutter there would leave a visible gap at each end of the drawn rect.
// Only TOP and BOTTOM must stay clear, which is exactly the blockiness the user is reporting.
// One shared vertical transform across the nine frames, so the loop cannot jitter.
async function packLane(bufs, label) {
  const boxes = []; for (const b of bufs) boxes.push(await alphaBox(b));
  const SH = boxes[0].h;
  const u = boxes.reduce((a, b) => ({ y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1) }));
  if (u.y0 <= 1 || u.y1 >= SH - 1) throw new Error(`lane touches the top/bottom of the source canvas (y ${u.y0}..${u.y1} of ${SH}) — regenerating`);
  const inner = Math.round(H * (1 - 2 * V_MARGIN));
  const src = u.y1 - u.y0;
  const out = [];
  for (const b of bufs) {
    const strip = await sharp(b).extract({ left: 0, top: u.y0, width: boxes[0].w, height: src })
      .resize(W, inner, { fit: 'fill' }).png().toBuffer();
    out.push(await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: strip, gravity: 'centre' }]).webp({ quality: 92 }).toBuffer());
  }
  console.log(`  ${label}: lane rows ${u.y0}..${u.y1} of ${SH}, packed to ${inner}px with a ${Math.round((H - inner) / 2)}px gutter top and bottom`);
  return out;
}
async function assertSoftEdges(files) {
  for (const f of files) {
    const b = await alphaBox(await readFile(f));
    const hit = [b.y0 === 0 ? 'top' : null, b.y1 >= b.h ? 'bottom' : null].filter(Boolean);
    if (hit.length) throw new Error(`${f} has ink on the ${hit.join(' and ')} edge`);
  }
  console.log(`  verified: ${files.length} file(s), top and bottom edges clear`);
}

if (!only || only === 'base') {
  let last, ok = false;
  for (let a = 1; a <= 4 && !ok; a++) {
    try {
      process.stdout.write(`base attempt ${a} ... `);
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(150000),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_16_9', n: 1, augment_prompt: false, prompt: BASE_PROMPT }),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      const packed = await packLane([await fetchBuf(url)], 'base');
      await writeFile(BASE, packed[0]);
      await assertSoftEdges([BASE]);
      console.log('base -> tg_dash_zodiac_taurus.webp'); ok = true;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  if (!ok) { console.error('BASE FAILED: ' + (last && last.message)); process.exit(1); }
}

if (!only || only === 'anim') {
  const uri = 'data:image/png;base64,' + (await sharp(await readFile(BASE)).png().toBuffer()).toString('base64');
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
      console.log('frames in');
      const packed = await packLane(bufs, 'anim');
      await mkdir(ANIM_DIR, { recursive: true });
      const written = [];
      for (let i = 0; i < FRAMES; i++) { const p = join(ANIM_DIR, `tg_dash_zodiac_taurus_${i}.webp`); await writeFile(p, packed[i]); written.push(p); }
      await assertSoftEdges(written);
      console.log('OK — 9 lane frames'); ok = true;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  if (!ok) { console.error('ANIM FAILED: ' + (last && last.message)); process.exit(1); }
}
