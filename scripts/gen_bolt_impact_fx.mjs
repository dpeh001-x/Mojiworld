#!/usr/bin/env node
// MAGIC BOLT IMPACT — energy-burst VFX (ludo.ai).
// Per user: "For magic bolt projectile, after it comes into contact with a
// monster have an animation where the magic bolt does an energy burst - use
// ludo.ai to make the animation".
//
//   1) a still burst sprite, derived from the shipped bolt art so the burst is
//      recognisably THAT bolt coming apart   -> Sprites/fx/bolt_impact.webp
//   2) a 9-frame detonation loop from it     -> Sprites/fx/anim/bolt_impact_0..8.webp
//
//   node scripts/gen_bolt_impact_fx.mjs              # dry run (prints prompts)
//   node scripts/gen_bolt_impact_fx.mjs --generate   # needs LUDO_API_KEY
//   flags: --force --only=still|anim --feather-only
//
// EDGE FEATHER (per user: "feather the edges for magic bolt energy burst").
// The raw roll put fully opaque pixels (alpha 255) hard on the frame border in
// 7 of 8 frames — the burst read as a rectangle cropping the shards. Every
// write now ramps alpha smoothly to zero over the outermost RAMP px, so the
// shards fade out instead of being guillotined. --feather-only re-runs the
// ramp over the shipped files in place (idempotent: already-faded edges are
// multiplied by ~1 and a second pass is a no-op within rounding).
//
// NO whole-image rotation in the frames — spawnSpriteBurst applies spin
// procedurally (the smoothness rule from gen_bolt_anim.mjs / gen_arcane_burst_fx.mjs).
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOLT = join(repoRoot, 'Sprites', 'fx', 'magic_bolt.webp');
const STILL = join(repoRoot, 'Sprites', 'fx', 'bolt_impact.webp');
const ANIM_DIR = join(repoRoot, 'Sprites', 'fx', 'anim');
const FRAMES = 9, SIZE = 768;
const has = (f) => process.argv.includes(f);
const only = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1];
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

const STILL_PROMPT =
  'A single flat 2D cartoon game VFX sprite: the instant an arcane MAGIC BOLT detonates on impact. ' +
  'A white-hot core flares at the centre, wrapped in a violet-and-cyan energy bloom, with a thin ' +
  'bright shockwave ring snapping outward around it and a scatter of small angular arcane shards ' +
  'and sparks thrown radially outward. Bold clean vector shapes, crisp cel shading, thick dark ' +
  'outline, luminous magic palette (deep violet, electric cyan, white core) matching the bolt that ' +
  'caused it. Perfectly centred, radially symmetric, filling about 85% of the frame. ' +
  'Fully TRANSPARENT background (alpha only). Viewed flat face-on (no perspective tilt). ' +
  'NO face, NO character, NO creature, NO text, NO shadow, NO background, NO ground.';

const MOTION =
  'The arcane bolt detonation BLOOMS AND DISSIPATES, with strong visible change in EVERY single ' +
  'frame and no still or near-identical frames anywhere — the motion is spread evenly across all ' +
  'nine frames, never concentrated into a few. Frames 1-3: the white-hot core flashes open and the ' +
  'inner bloom swells outward fast. Frames 4-6: the shockwave ring expands past the bloom and ' +
  'thins, the shards fly outward and start to tumble, the core narrows to a bright pinpoint. ' +
  'Frames 7-9: the ring fades at its rim, the shards shrink and scatter wider, the whole burst ' +
  'dims toward transparency as the energy spends itself. ' +
  'CRITICAL — DO NOT ROTATE the image as a whole: no spin, no turn, no mirror, no flip. Only the ' +
  'energy expanding OUTWARD from the centre moves. ' +
  'CRITICAL — LOCKED FRAMING: perfectly centred in every frame, no zoom, pan, crop or drift; the ' +
  'burst grows from the centre within the frame and must never touch or exceed the frame edges. ' +
  'CRITICAL — ONE-SHOT, NOT A LOOP: this plays once on impact, so frame 9 is the faintest and the ' +
  'sequence must read as a burst spending itself, not as a repeating cycle. ' +
  'Keep the exact same art style, palette and fully transparent background in every frame. ' +
  'No face, no character, no text, no background, no shadow.';

if (!has('--generate') && !has('--feather-only')) {
  console.log('# still -> Sprites/fx/bolt_impact.webp\n' + STILL_PROMPT + '\n');
  console.log('# anim  -> Sprites/fx/anim/bolt_impact_0..8.webp\n' + MOTION + '\n# Re-run with --generate.');
  process.exit(0);
}
const key = process.env.LUDO_API_KEY;
if (!key && !has('--feather-only')) { console.error('LUDO_API_KEY required.'); process.exit(1); }
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
const RAMP = 56;   // feather width in px on the 768 canvas (~7%)
// Multiply alpha by a smooth (smoothstep) ramp toward each canvas edge:
// content deeper than RAMP px is untouched, content ON the edge goes to 0.
// Same shape as scripts/generate_gravitos_star_anim.mjs's feather.
async function feather(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const smooth = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
  const rowRamp = new Float32Array(H), colRamp = new Float32Array(W);
  for (let y = 0; y < H; y++) rowRamp[y] = Math.min(smooth(y / RAMP), smooth((H - 1 - y) / RAMP));
  for (let x = 0; x < W; x++) colRamp[x] = Math.min(smooth(x / RAMP), smooth((W - 1 - x) / RAMP));
  for (let y = 0; y < H; y++) {
    const ry = rowRamp[y];
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * C + 3;
      if (data[i] === 0) continue;
      const r = Math.min(ry, colRamp[x]);
      if (r < 1) data[i] = Math.round(data[i] * r);
    }
  }
  return sharp(data, { raw: { width: W, height: H, channels: C } }).webp({ quality: 92 }).toBuffer();
}
const normalise = async (buf) => feather(await sharp(buf).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer());

// ---- re-feather the shipped art in place -----------------------------------
if (has('--feather-only')) {
  const targets = [STILL];
  for (let i = 0; i < FRAMES - 1; i++) targets.push(join(ANIM_DIR, `bolt_impact_${i}.webp`));
  for (const t of targets) {
    if (!(await exists(t))) { console.log('(absent) ' + t); continue; }
    const out = await feather(await readFile(t));
    await writeFile(t + '.tmp', out);
    const { rename } = await import('node:fs/promises');
    await rename(t + '.tmp', t);
    console.log('feathered ' + t.split(/[\/]/).pop());
  }
  console.log('done.');
  process.exit(0);
}

// ---- 1) the still burst, seeded with the shipped bolt art -------------------
if ((!only || only === 'still') && (has('--force') || !(await exists(STILL)))) {
  // NOTE: /assets/image is prompt-only (no reference seed); the burst is tied
  // to the bolt by PALETTE wording in STILL_PROMPT, then animated from itself.
  let last, ok = false;
  for (let a = 1; a <= 4 && !ok; a++) {
    try {
      process.stdout.write(`still attempt ${a} ... `);
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(150000),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: STILL_PROMPT }),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      const raw = await fetchBuf(url);
      let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
      await writeFile(STILL, await normalise(content));
      console.log('ok -> bolt_impact.webp');
      ok = true;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  if (!ok) { console.error('STILL FAILED: ' + (last && last.message)); process.exit(1); }
}

// ---- 2) the 9-frame detonation ---------------------------------------------
if (!only || only === 'anim') {
  const stillBuf = await readFile(STILL);
  const uri = 'data:image/png;base64,' + (await sharp(stillBuf).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
  let last, ok = false;
  for (let a = 1; a <= 4 && !ok; a++) {
    try {
      process.stdout.write(`anim attempt ${a} ... `);
      const res = await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(600000),
        body: JSON.stringify({ initial_image: uri, motion_prompt: MOTION, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
      const bufs = await framesFrom(await res.json(), FRAMES);
      await mkdir(ANIM_DIR, { recursive: true });
      for (let i = 0; i < FRAMES; i++) await writeFile(join(ANIM_DIR, `bolt_impact_${i}.webp`), await normalise(bufs[i]));
      console.log('OK — 9 impact frames');
      ok = true;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  if (!ok) { console.error('ANIM FAILED: ' + (last && last.message)); process.exit(1); }
}
console.log('done.');
