#!/usr/bin/env node
// Boss WALK-animation runner — v0.26.322
// =============================================================================
// 9-frame walk cycle per boss, same framework as attack/idle: animateSprite
// from the base sprite, eagle model, frame_size:-9 (True Size, no zoom/drift),
// spritesheet-sliced (Ludo squares non-square individual frames), then
// normalized to the idle's dimensions. Output -> Sprites/bosses/walk/<type>_0..8.
// The boss "walks in place" (treadmill) so it never translates across the frame
// — the game moves the boss via its x position; this is just the leg cycle.
//
//   node scripts/generate_boss_walk_anim.mjs                 # dry-run list
//   node scripts/generate_boss_walk_anim.mjs --only koopaKing --generate
//   node scripts/generate_boss_walk_anim.mjs --generate      # all (skips done)
// Needs LUDO_API_KEY. Skips a boss whose 9 walk frames already exist (--force).
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import { dirname, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOSS_DIR = join(repoRoot, 'Sprites', 'bosses');
const OUT_DIR  = join(BOSS_DIR, 'walk');
const FRAMES = 9;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const FACING = ' Keep the EXACT same left/right facing and orientation as the source — never mirror or flip. Keep the EXACT same size, position and framing — do not zoom, pan, crop, or rescale.';
const WALK_MOTION =
  'the creature performs a smooth looping WALK cycle IN PLACE (like on a treadmill): its legs stride and step, limbs swing naturally and the body bobs gently with each step. It does NOT travel or slide across the frame — it stays centered. It is ONE single connected body; do NOT add, duplicate, split, or detach any limbs, and no floating body parts.' + FACING;
const WALK_OVERRIDES = {
  octobaby: 'the octopus moves IN PLACE with a bouncy floating hover-walk — its tentacles ripple and undulate in a walk-like cycle while the head bobs gently. It stays centered, does not travel across the frame. One connected body, no detached parts.' + FACING,
  aetherion: 'the four-legged dragon performs a looping four-legged WALK cycle IN PLACE — legs stride in sequence, wings shift slightly, tail sways. Stays centered, does not travel across the frame. One connected body, no detached limbs.' + FACING,
  aetherion2: 'the dragon performs a looping WALK cycle IN PLACE — legs stride, wings and tail shift. Keep the FULL WINGSPAN entirely inside the frame with clear margin on every side — the wingtips must NOT touch or get cropped by the canvas edges; zoom out / shrink the dragon slightly if needed so nothing is cut off. Stays centered, does not travel. One connected body, no detached limbs.' + FACING,
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
// v0.26.x — optional transparent padding (env LUDO_ANIM_PAD, e.g. 0.4) added
// BEFORE the downscale so a wide pose (aetherion2's spread wings) gets headroom
// and can't clip against the frame edge. Off by default (PAD=0).
const _ANIM_PAD = Number(process.env.LUDO_ANIM_PAD || 0);
const smallBaseUri = async (p) => {
  let buf = await readFile(p);
  if (_ANIM_PAD > 0) {
    const mm = await sharp(buf).metadata();
    const px = Math.round(mm.width * _ANIM_PAD), py = Math.round(mm.height * _ANIM_PAD);
    buf = await sharp(buf).extend({ top: py, bottom: py, left: px, right: px, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  }
  return 'data:image/png;base64,' + (await sharp(buf).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
};
async function fetchBuf(url) { const r = await fetch(url); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); }
async function framesFrom(data, n) {
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const cols = data.num_cols, rows = data.num_rows;
    const sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
    const cw = Math.floor(meta.width / cols), ch = Math.floor(meta.height / rows), out = [];
    for (let r = 0; r < rows && out.length < n; r++) for (let c = 0; c < cols && out.length < n; c++)
      out.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).webp({ quality: 92 }).toBuffer());
    if (out.length >= n) return out;
  }
  const urls = data.individual_frame_urls || [];
  if (urls.length >= n) { const out = []; for (let i = 0; i < n; i++) out.push(await fetchBuf(urls[i])); return out; }
  throw new Error('no usable frames');
}

let work = (await readdir(BOSS_DIR, { withFileTypes: true })).filter((d) => d.isFile() && /\.(png|webp)$/i.test(d.name)).map((d) => ({ type: basename(d.name, extname(d.name)), file: d.name }));
const only = arg('--only'); if (only) { const set = new Set(only.split(',')); work = work.filter((w) => set.has(w.type)); }
if (!work.length) { console.error('No matching boss sprites.'); process.exit(1); }

if (!has('--generate')) {
  console.log(`# ${work.length} boss WALK cycles -> walk/<type>_0..8.webp:\n`);
  for (const w of work) console.log(`  ${w.type}  [${WALK_OVERRIDES[w.type] ? 'authored' : 'generic'} walk]`);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`Generating ${work.length} boss walk cycles (skip-existing: ${!force})...`);
let made = 0, skipped = 0, failed = 0, done = 0;
for (const w of work) {
  process.stdout.write(`[${++done}/${work.length}] ${w.type} ... `);
  try {
    const have = (await Promise.all(Array.from({ length: FRAMES }, (_, i) => exists(join(OUT_DIR, `${w.type}_${i}.webp`))))).every(Boolean);
    if (!force && have) { skipped++; console.log('skip'); continue; }
    const res = await fetch(`${API}/assets/sprite/animate`, {
      method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ initial_image: await smallBaseUri(join(BOSS_DIR, w.file)), motion_prompt: WALK_OVERRIDES[w.type] || WALK_MOTION,
        frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite' }),
    });
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 150)}`);
    const bufs = await framesFrom(await res.json(), FRAMES);
    await mkdir(OUT_DIR, { recursive: true });
    for (let i = 0; i < bufs.length; i++) await writeFile(join(OUT_DIR, `${w.type}_${i}.webp`), bufs[i]);
    made++; console.log(`OK -> ${FRAMES} frames`); await sleep(800);
  } catch (e) { failed++; console.log(`FAIL: ${e.message}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
