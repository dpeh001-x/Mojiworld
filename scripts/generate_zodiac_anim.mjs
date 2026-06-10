#!/usr/bin/env node
// Zodiac boss attack + idle animation runner — v0.26.320
// =============================================================================
// 9-frame attack AND idle loops per zodiac sign, generated from each base
// sprite in Sprites/bosses/zodiac/<sign>.png. Designed for ZERO reframe/warp:
//   - frame_size:-9 ("True Size") locks every output frame to the input's
//     framing (no zoom / drift / reposition). Needs a <1MP input, so the base
//     is downscaled (aspect-preserved) just for the request.
//   - each returned frame is then scaled back to the EXACT base dimensions
//     (same aspect -> uniform, no warp), so the animation overlays the source
//     pixel-for-pixel. We do NOT crop-to-content / re-anchor like the main
//     boss normalizer — the character stays exactly where the base has it.
//   - eagle model (8/10 quality); charge-up attacks (no directional beam) +
//     anti-flip so nothing resizes, mirrors, or shoots the wrong way.
//
//   node scripts/generate_zodiac_anim.mjs                 # dry-run list
//   node scripts/generate_zodiac_anim.mjs --only leo --generate
//   node scripts/generate_zodiac_anim.mjs --generate      # all 12 (skips done)
// Output: Sprites/bosses/zodiac/{attack,idle}/<sign>_0..8.webp
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import { dirname, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const ZODIAC_DIR = join(repoRoot, 'Sprites', 'bosses', 'zodiac');
const FRAMES = 9;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const FACING = ' Keep the EXACT same left/right facing and orientation as the source — never mirror or flip horizontally. Keep the EXACT same size, position and framing — do not zoom, pan, crop, or rescale.';
const ATTACK_MOTION = 'the zodiac creature performs its attack IN PLACE: it opens its mouth / raises its stance and bright zodiac energy charges and glows at its center. Do NOT emit a long beam or projectile in any direction — keep the energy as a concentrated charge.' + FACING;
const IDLE_MOTION = 'the zodiac creature idles in place — a subtle living loop: slow breathing, a slight sway and an occasional blink; only soft idle motion.' + FACING;
const WALK_MOTION = 'the zodiac creature performs a smooth looping WALK cycle IN PLACE (treadmill): its legs stride/step and its body bobs with each step, limbs swinging naturally. It does NOT travel or slide across the frame — it stays centered. One single connected body; do NOT duplicate or detach any limbs.' + FACING;
// Per-sign idle overrides for creatures whose generic "breathing" reads oddly.
const IDLE_OVERRIDES = {
  pisces: 'the two koi fish HOLD their positions in the yin-yang ring and do NOT swim around, circle, rotate, or drift — only their FINS and TAILS flap, wave, fan and ripple actively (pectoral fins fanning, tail fins swishing), with gentle gill/sparkle motion and a soft pulse on the central orb. The bodies stay put; just the fins move. Lively fins, NOT stiff.' + FACING,
};
// Per-sign WALK overrides (winged signs hover/flap rather than leg-walk).
const WALK_OVERRIDES = {
  virgo: 'the winged maiden (Virgo) hovers gently in place and flaps her wings in a soft flying cycle. CRITICAL: the wings must stay FULLY INSIDE the frame at all times — keep the wing-beat compact and contained so the wingtips never reach, touch, or extend past the frame edges and are never clipped. No leg-walking; she floats in place.' + FACING,
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const smallBaseUri = async (buf) => {
  const small = await sharp(buf).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  return 'data:image/png;base64,' + small.toString('base64');
};
async function fetchBuf(url) { const r = await fetch(url); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); }
async function framesFrom(data, n) {
  // Prefer the spritesheet — cells match the input aspect. Ludo's
  // individual_frame_urls wrongly square non-square frames. Slice first.
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
  throw new Error('no usable frames');
}

// discover signs
let signs = (await readdir(ZODIAC_DIR, { withFileTypes: true }))
  .filter((d) => d.isFile() && /\.(png|webp)$/i.test(d.name))
  .map((d) => ({ sign: basename(d.name, extname(d.name)), file: d.name }));
const only = arg('--only');
if (only) { const set = new Set(only.split(',')); signs = signs.filter((s) => set.has(s.sign)); }
if (!signs.length) { console.error('No zodiac sprites found.'); process.exit(1); }

if (!has('--generate')) {
  console.log(`# ${signs.length} zodiac signs -> attack + idle (9-frame, True-Size, exact base dims):\n`);
  for (const s of signs) console.log(`  ${s.sign}  -> zodiac/{attack,idle}/${s.sign}_0..8.webp`);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function genMode(s, mode) {
  const outDir = join(ZODIAC_DIR, mode);
  const done = (await Promise.all(Array.from({ length: FRAMES }, (_, i) => exists(join(outDir, `${s.sign}_${i}.webp`))))).every(Boolean);
  if (!force && done) return 'skip';
  const buf = await readFile(join(ZODIAC_DIR, s.file));
  const { width: W, height: H } = await sharp(buf).metadata();
  const res = await fetch(`${API}/assets/sprite/animate`, {
    method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ initial_image: await smallBaseUri(buf), motion_prompt: mode === 'attack' ? ATTACK_MOTION : mode === 'walk' ? (WALK_OVERRIDES[s.sign] || WALK_MOTION) : (IDLE_OVERRIDES[s.sign] || IDLE_MOTION),
      frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: mode !== 'attack', image_type: 'sprite' }),
  });
  if (!res.ok) throw new Error(`${mode} ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const bufs = await framesFrom(await res.json(), FRAMES);
  if (bufs.length < FRAMES) throw new Error(`${mode} got ${bufs.length} frames`);
  await mkdir(outDir, { recursive: true });
  // Resize each frame to the EXACT base dimensions (same aspect => uniform, no warp).
  for (let i = 0; i < bufs.length; i++)
    await writeFile(join(outDir, `${s.sign}_${i}.webp`), await sharp(bufs[i]).resize(W, H, { fit: 'fill' }).webp({ quality: 92 }).toBuffer());
  return `${W}x${H}`;
}

console.log(`Generating zodiac attack + idle for ${signs.length} sign(s)...`);
let made = 0, failed = 0;
for (const s of signs) {
  for (const mode of ['attack', 'idle', 'walk']) {
    process.stdout.write(`  ${s.sign}/${mode} ... `);
    try { const r = await genMode(s, mode); if (r === 'skip') console.log('skip'); else { made++; console.log(`OK ${r}`); await sleep(800); } }
    catch (e) { failed++; console.log(`FAIL: ${e.message}`); }
  }
}
console.log(`Done. ${made} made, ${failed} failed.`);
process.exit(failed ? 2 : 0);
