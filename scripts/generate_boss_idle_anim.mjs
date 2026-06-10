#!/usr/bin/env node
// Boss IDLE-animation runner — v0.26.314
// =============================================================================
// 4-frame gentle idle loop per boss, generated via Ludo animateSprite from the
// base sprite ALONE (no final_image) with an "idle in place, do not rescale"
// motion prompt — same body-stable approach as the attack runner so the loop
// flows. Output -> Sprites/bosses/idle/<type>_0..3.webp. Normalize afterwards
// with: node scripts/normalize_boss_attack.mjs --dir idle
//
//   node scripts/generate_boss_idle_anim.mjs                 # dry-run list
//   node scripts/generate_boss_idle_anim.mjs --only koopaKing --generate
//   node scripts/generate_boss_idle_anim.mjs --generate      # all (skips done)
//
// Needs LUDO_API_KEY. Skips a boss whose 4 idle frames already exist (--force).
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import { dirname, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = join(__dirname, '..');
const BOSS_DIR  = join(repoRoot, 'Sprites', 'bosses');
const OUT_DIR   = join(BOSS_DIR, 'idle');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// Keep the source's facing — never mirror/flip (matches the attack runner).
const FACING = ' Keep the EXACT same left/right facing and orientation as the source image — never mirror or flip the character horizontally.';
const MOTION_PROMPT =
  'the character idles in place — a subtle, gentle living loop: slow breathing, ' +
  'a slight sway/bob and an occasional blink. It stays the EXACT same size and ' +
  'position, does not zoom, step, lunge, or rescale; only soft idle motion.' + FACING;
const MOTION_OVERRIDES = {
  octobaby: 'the octopus idles in place — gentle breathing, tentacles sway softly, an occasional slow blink behind the shades. Stays the EXACT same size and position; no zoom, no rescale.' + FACING,
  koopaKing: 'the turtle-dragon king idles in place — slow heavy breathing, chest rises and falls, mohawk flames flicker gently, occasional blink. Stays the EXACT same size and position; no zoom, no rescale.' + FACING,
  // v0.26.321 — gravitos (FORM 1 ONLY) was duplicating/detaching legs. Lock anatomy.
  gravitos: 'the cosmic-energy golem idles in place — gentle breathing, a slight sway, the chest core softly pulses and the arms flex subtly. It is ONE single connected body with EXACTLY two arms and two legs all attached to the torso; do NOT add, duplicate, split, mirror, or detach any limbs, and no floating body parts — the full body stays intact.' + FACING,
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
// frame_size:-9 ("True Size") anchors output to the input framing (no zoom /
// drift) but needs a <1MP input — downscale the base to fit within 940px.
const smallBaseUri = async (p) => {
  const small = await sharp(await readFile(p)).resize(940, 940, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  return 'data:image/png;base64,' + small.toString('base64');
};

let work = (await readdir(BOSS_DIR, { withFileTypes: true }))
  .filter((d) => d.isFile() && /\.(png|webp)$/i.test(d.name))
  .map((d) => ({ type: basename(d.name, extname(d.name)), file: d.name }));
const only = arg('--only');
if (only) { const set = new Set(only.split(',')); work = work.filter((w) => set.has(w.type)); }
const limit = arg('--limit');
if (limit) work = work.slice(0, Number(limit));
if (!work.length) { console.error('No matching boss sprites.'); process.exit(1); }

if (!has('--generate')) {
  console.log(`# ${work.length} boss IDLE animations to generate:\n`);
  for (const w of work) console.log(`  ${w.type}  [${MOTION_OVERRIDES[w.type] ? 'authored' : 'generic'} idle]  -> idle/${w.type}_0..3.webp`);
  console.log(`\n# Re-run with --generate (needs LUDO_API_KEY).`);
  process.exit(0);
}

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(path, body) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${(await res.text()).slice(0, 180)}`);
  return res.json();
}
async function fetchBuf(url) { const r = await fetch(url); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); }
// Prefer individual_frame_urls; if absent (eagle on some inputs), slice the
// returned spritesheet into its num_cols x num_rows grid ourselves.
async function framesFrom(data, n) {
  // Prefer the spritesheet (cells match input aspect); individual_frame_urls
  // wrongly square non-square frames. Slice first, individual URLs as fallback.
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

// v0.26.315 — 9 frames (3x3) for smoother idle. animateSprite only accepts
// perfect-square counts [4,9,16,...]; 8 isn't valid, so 9.
const FRAMES = 9;
async function animate(w) {
  const data = await post('/assets/sprite/animate', {
    initial_image: await smallBaseUri(join(BOSS_DIR, w.file)),
    motion_prompt: MOTION_OVERRIDES[w.type] || MOTION_PROMPT,
    frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite',
  });
  const bufs = await framesFrom(data, FRAMES);
  if (bufs.length < FRAMES) throw new Error(`got ${bufs.length} frames`);
  await mkdir(OUT_DIR, { recursive: true });
  for (let i = 0; i < bufs.length; i++) await writeFile(join(OUT_DIR, `${w.type}_${i}.webp`), bufs[i]);
}

console.log(`Generating ${work.length} boss IDLE animations (skip-existing: ${!force})...`);
let made = 0, skipped = 0, failed = 0, done = 0;
for (const w of work) {
  process.stdout.write(`[${++done}/${work.length}] ${w.type} ... `);
  try {
    const framesDone = (await Promise.all(Array.from({ length: FRAMES }, (_, i) => exists(join(OUT_DIR, `${w.type}_${i}.webp`))))).every(Boolean);
    if (!force && framesDone) { skipped++; console.log('skip (frames exist)'); continue; }
    await animate(w);
    made++; console.log(`OK -> ${FRAMES} frames`); await sleep(800);
  } catch (e) { failed++; console.log(`FAIL: ${e.message}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
