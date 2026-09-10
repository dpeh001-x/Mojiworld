#!/usr/bin/env node
// GRAVITOS METEOR LANDING — blue void-impact VFX (ludo.ai).
// Per user, of the orange burst under a blue Gravitos meteor: "this red explosion here should be
// blue and the art should be better and more aesthetic".
//
//   1) a still impact sprite                  -> Sprites/fx/grav_impact.webp
//   2) a 9-frame detonation loop from it      -> Sprites/fx/anim/grav_impact_0..8.webp
//
//   node scripts/gen_grav_impact_fx.mjs              # dry run (prints prompts)
//   node scripts/gen_grav_impact_fx.mjs --generate   # needs LUDO_API_KEY
//   flags: --only=still|anim
//
// Edge feather (the gen_bolt_impact_fx.mjs lesson): alpha ramps to zero over the outermost RAMP px so
// the burst fades out instead of being guillotined by its own frame. No whole-image rotation in the
// frames: spawnSpriteBurst has no spin here, the burst grows from the ground line.
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STILL = join(ROOT, 'Sprites', 'fx', 'grav_impact.webp');
const ANIM_DIR = join(ROOT, 'Sprites', 'fx', 'anim');
const KEY = 'grav_impact';
const FRAMES = 9, SIZE = 768, RAMP = 56;
const has = (f) => process.argv.includes(f);
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];
const key = process.env.LUDO_API_KEY;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';

const STILL_PROMPT =
  'A single 2D game VFX sprite: the instant a BLUE VOID METEOR slams into the ground. A blinding ' +
  'white-cyan flash at the point of impact, a dome of pale-blue plasma bursting upward, a thin ' +
  'bright electric-blue shockwave ring snapping outward along the ground, and a scatter of small ' +
  'angular ice-blue crystal shards and white sparks thrown up and outward, with wisps of deep ' +
  'indigo-violet smoke curling at the edges. Palette strictly cold: white core, electric cyan, ' +
  'sky blue, deep indigo-violet - NO orange, NO red, NO yellow, NO fire. Painterly hand-painted ' +
  'game art with soft luminous glow and crisp readable shapes, NO hard black outline. The burst ' +
  'rises from the BOTTOM-CENTRE of the image (the ground) and is symmetric left-right, filling ' +
  'about 85% of the frame. Fully TRANSPARENT background (alpha only), viewed flat from the side. ' +
  'NO face, NO character, NO creature, NO text, NO shadow, NO background, NO ground plane drawn.';

const MOTION =
  'The void impact BLOOMS AND DISSIPATES with strong visible change in EVERY frame, spread evenly ' +
  'across all nine - no still or near-identical frames. Frames 1-3: the white-cyan flash opens and ' +
  'the plasma dome swells upward fast, the shockwave ring snaps out along the ground. Frames 4-6: ' +
  'the ring races wider and thins, the shards fly up and outward and tumble, the core narrows to a ' +
  'bright pinpoint, the indigo smoke curls up. Frames 7-9: the ring fades at its rim, the shards ' +
  'shrink and scatter, the smoke thins, the whole burst dims toward transparency. ' +
  'CRITICAL - DO NOT ROTATE the image as a whole: no spin, no turn, no mirror, no flip. Only the ' +
  'energy expanding outward and upward from the bottom-centre moves. ' +
  'CRITICAL - LOCKED FRAMING: the impact point stays at the exact same spot at the bottom-centre in ' +
  'every frame, no zoom, pan, crop or drift; the burst must never touch or exceed the frame edges. ' +
  'Keep the exact same cold palette (white, cyan, sky blue, indigo-violet - no warm colours), the ' +
  'same painterly style and a fully transparent background in every frame.';

async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); }
async function feather(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const smooth = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
  const rowRamp = new Float32Array(H), colRamp = new Float32Array(W);
  for (let y = 0; y < H; y++) rowRamp[y] = Math.min(smooth(y / RAMP), smooth((H - 1 - y) / RAMP));
  for (let x = 0; x < W; x++) colRamp[x] = Math.min(smooth(x / RAMP), smooth((W - 1 - x) / RAMP));
  for (let y = 0; y < H; y++) { const ry = rowRamp[y]; for (let x = 0; x < W; x++) { const i = (y * W + x) * C + 3; if (data[i] === 0) continue; const r = Math.min(ry, colRamp[x]); if (r < 1) data[i] = Math.round(data[i] * r); } }
  return sharp(data, { raw: { width: W, height: H, channels: C } }).webp({ quality: 92 }).toBuffer();
}
const normalise = async (buf) => feather(await sharp(buf).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer());
// warmth gate: a burst that came back orange is the wrong burst
async function warmth(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let warm = 0, lit = 0;
  for (let i = 0; i < data.length; i += 4) { if (data[i + 3] < 80) continue; lit++; if (data[i] > data[i + 2] + 40 && data[i] > 120) warm++; }
  return lit ? warm / lit : 0;
}

async function makeStill() {
  let chosen = null;
  for (let round = 1; round <= 5 && !chosen; round++) {
    process.stdout.write(`still attempt ${round} ... `);
    try {
      const res = await fetch(`${API}/assets/image`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(150000),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: STILL_PROMPT }) });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
      const j = await res.json();
      const url = Array.isArray(j) ? (j[0] && j[0].url) : (j && (j.url || (j.images && j.images[0] && j.images[0].url)));
      if (!url) throw new Error('no url');
      const raw = await fetchBuf(url);
      const { data, info } = await sharp(raw).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const corner = data[3] + data[(info.width - 1) * 4 + 3];
      const w = await warmth(raw);
      console.log(`cornerA ${corner} warm ${(w * 100).toFixed(1)}%`);
      if (corner > 0) { console.log('  rejected: background not transparent'); continue; }
      if (w > 0.06) { console.log('  rejected: warm palette (this must be blue)'); continue; }
      chosen = raw;
    } catch (e) { console.log('failed: ' + e.message); await new Promise((r) => setTimeout(r, 2500 * round)); }
  }
  if (!chosen) { console.error('REFUSING: no still met the gate in 5 rounds.'); process.exit(1); }
  await mkdir(dirname(STILL), { recursive: true });
  await writeFile(STILL + '.tmp', await normalise(chosen)); await rename(STILL + '.tmp', STILL);
  console.log('wrote Sprites/fx/grav_impact.webp');
}
async function framesFrom(data, n) {
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const cols = data.num_cols, rows = data.num_rows, sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
    const cw = Math.floor(meta.width / cols), ch = Math.floor(meta.height / rows), o = [];
    for (let r = 0; r < rows && o.length < n; r++) for (let c = 0; c < cols && o.length < n; c++) o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  const urls = data.individual_frame_urls || [];
  if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  throw new Error('no usable frames');
}
async function makeAnim() {
  await mkdir(ANIM_DIR, { recursive: true });
  const uri = 'data:image/png;base64,' + (await sharp(await readFile(STILL)).resize(990, 990, { fit: 'inside' }).png().toBuffer()).toString('base64');
  let last;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      process.stdout.write(`animate ${KEY} attempt ${attempt} ... `);
      const res = await fetch(`${API}/assets/sprite/animate`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(600000),
        body: JSON.stringify({ initial_image: uri, motion_prompt: MOTION, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true }) });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
      const bufs = await framesFrom(await res.json(), FRAMES);
      const outs = []; let worstWarm = 0;
      for (const b of bufs) { worstWarm = Math.max(worstWarm, await warmth(b)); outs.push(await normalise(b)); }
      console.log(`candidate: worst warmth ${(worstWarm * 100).toFixed(1)}%`);
      if (worstWarm > 0.08) throw new Error('a frame went warm - rejected before writing');
      for (let i = 0; i < FRAMES; i++) { const f = join(ANIM_DIR, `${KEY}_${i}.webp`); await writeFile(f + '.tmp', outs[i]); await rename(f + '.tmp', f); }
      console.log(`OK - wrote Sprites/fx/anim/${KEY}_0..8.webp`); return;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (attempt < 4) await new Promise((s) => setTimeout(s, 4000 * attempt)); }
  }
  console.error('FAILED: ' + (last && last.message)); process.exit(1);
}
// THE GROUND MARKER (per user: "this marker sprite can be better regenerated, slightly simpler and
// more fitting for a sidescroll view, now it looks very angled"). The game stretches it into a
// (rad*2+20) x 70 px box on the ground line - roughly 3:1 - so the art is authored WIDE and nearly
// edge-on: a thin ring of light lying on the floor as a side-scroller sees it, not a disc in perspective.
const MARKER = join(ROOT, 'Sprites', 'fx', 'meteor_marker_blue.webp');
const MARKER_W = 1024, MARKER_H = 320;
const MARKER_PROMPT =
  'A single 2D game VFX sprite for a SIDE-SCROLLING platformer, seen straight from the side at ' +
  'ground level: a glowing electric-blue magic circle lying flat on the floor, so flat that it ' +
  'reads as one thin, wide horizontal ellipse of cyan light - about five times wider than it is ' +
  'tall - with a soft luminous glow above and below it, a bright white-cyan centre line, a few ' +
  'faint thin rune marks along the ring, and a handful of small pale-blue crystal spikes standing ' +
  'UP from the ring. Simple, clean, uncluttered - no inner rings, no perspective tilt, no ' +
  'three-quarter view, no cube or platform under it. Palette strictly cold: white, cyan, sky blue, ' +
  'indigo - NO orange, NO red, NO yellow. Painterly with soft glow, NO hard black outline. Centred, ' +
  'symmetric left-right, filling most of the width. Fully TRANSPARENT background (alpha only). ' +
  'NO character, NO text, NO shadow, NO ground plane drawn.';
async function makeMarker() {
  let chosen = null;
  for (let round = 1; round <= 5 && !chosen; round++) {
    process.stdout.write(`marker attempt ${round} ... `);
    try {
      const res = await fetch(`${API}/assets/image`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(150000),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_16_9', n: 1, augment_prompt: false, prompt: MARKER_PROMPT }) });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
      const j = await res.json();
      const url = Array.isArray(j) ? (j[0] && j[0].url) : (j && (j.url || (j.images && j.images[0] && j.images[0].url)));
      if (!url) throw new Error('no url');
      const raw = await fetchBuf(url);
      const { data, info } = await sharp(raw).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
      for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) { if (data[(y * info.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
      const corner = data[3] + data[(info.width - 1) * 4 + 3], aspect = (x1 - x0 + 1) / (y1 - y0 + 1), w = await warmth(raw);
      console.log(`content ${x1 - x0 + 1}x${y1 - y0 + 1} aspect ${aspect.toFixed(2)} cornerA ${corner} warm ${(w * 100).toFixed(1)}%`);
      if (corner > 0) { console.log('  rejected: background not transparent'); continue; }
      if (w > 0.06) { console.log('  rejected: warm palette'); continue; }
      if (aspect < 2.2) { console.log('  rejected: not flat enough for a side view (want >= 2.2)'); continue; }
      chosen = await sharp(raw).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).png().toBuffer();
    } catch (e) { console.log('failed: ' + e.message); await new Promise((r) => setTimeout(r, 2500 * round)); }
  }
  if (!chosen) { console.error('REFUSING: no marker met the gate in 5 rounds.'); process.exit(1); }
  const fitted = await sharp(chosen).resize(Math.round(MARKER_W * 0.94), Math.round(MARKER_H * 0.9), { fit: 'inside' }).png().toBuffer();
  const fm = await sharp(fitted).metadata();
  const out = await sharp({ create: { width: MARKER_W, height: MARKER_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, left: Math.round((MARKER_W - fm.width) / 2), top: Math.round((MARKER_H - fm.height) / 2) }]).webp({ quality: 92 }).toBuffer();
  await writeFile(MARKER + '.tmp', out); await rename(MARKER + '.tmp', MARKER);
  console.log(`wrote Sprites/fx/meteor_marker_blue.webp ${MARKER_W}x${MARKER_H}`);
}
if (has('--generate')) {
  if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
  if (only !== 'anim' && only !== 'marker') await makeStill();
  if (only !== 'still' && only !== 'marker') await makeAnim();
  if (!only || only === 'marker') await makeMarker();
} else { console.log(STILL_PROMPT); console.log(); console.log(MOTION); console.log(); console.log(MARKER_PROMPT); console.log('\n--generate [--only=still|anim|marker]'); }
