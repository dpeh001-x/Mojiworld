#!/usr/bin/env node
// Guguma WALK animation frames (ludo.ai /assets/sprite/animate, sprite mode).
// =============================================================================
// 9-frame continuous walk loop for the canary NPC Guguma — same strict
// framework as generate_npc_anim.mjs (idle): eagle model, frame_size:-9
// (True-Size), individual frames sliced + resized to the EXACT base dims so the
// in-game scale/anchor (see _drawNpcSprite) applies unchanged. Output ->
// Sprites/npc/walk/Guguma_0..8.webp, picked up by _npcWalkFrame() while Guguma
// is wandering. Generalised via --only <basename> for any NPC base sprite.
//
//   node scripts/gen_guguma_walk.mjs                  # dry-run
//   node scripts/gen_guguma_walk.mjs --generate       # Guguma (skips if done)
//   node scripts/gen_guguma_walk.mjs --only Guguma --generate --force
// Needs LUDO_API_KEY. Resumable; stops cleanly on 402 (out of credits).
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const NPC_DIR = join(repoRoot, 'Sprites', 'npc');
const OUT_DIR = join(NPC_DIR, 'walk');
const FRAMES = 9;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const base = arg('--only') || 'Guguma';

// Walk motion — a continuous side-stepping waddle, treadmill (no travel), full
// body in frame, no flip/zoom/rescale. Tuned for a small round chick.
const MOTION =
  'the character WALKS in place on the spot (treadmill — does not travel across ' +
  'the frame): a smooth, full, continuous side-walk cycle with EVEN spacing ' +
  'between every frame — the little legs/feet lift and step in alternation, the ' +
  'round body bobs gently up and down with each step, the stubby wings/arms swing ' +
  'slightly in opposition, looping seamlessly with no jitter, popping or skipped ' +
  'poses. CRITICAL: keep ALL parts of the character (head, beak, body, wings, ' +
  'feet, tail) FULLY INSIDE the frame at ALL times — nothing clipped at the ' +
  'edges. Stay centered at the EXACT same size, position and framing; do not ' +
  'zoom, pan, crop, or rescale, and never mirror or flip the character.';

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const smallBaseUri = async (buf) => 'data:image/png;base64,' + (await sharp(buf).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); }
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
  throw new Error('no usable frames');
}

// Resolve the base sprite file on disk (png or webp).
let file = null;
for (const ext of ['webp', 'png']) { if (await exists(join(NPC_DIR, `${base}.${ext}`))) { file = `${base}.${ext}`; break; } }
if (!file) { console.error(`No base sprite Sprites/npc/${base}.(webp|png)`); process.exit(1); }

if (!has('--generate')) {
  console.log(`# Walk frames -> Sprites/npc/walk/${base}_0..8.webp  (from ${file})`);
  console.log('# motion_prompt:\n' + MOTION);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const done = (await Promise.all(Array.from({ length: FRAMES }, (_, i) => exists(join(OUT_DIR, `${base}_${i}.webp`))))).every(Boolean);
if (!force && done) { console.log(`${base} walk frames already exist — use --force to overwrite.`); process.exit(0); }

const buf = await readFile(join(NPC_DIR, file));
const { width: W, height: H } = await sharp(buf).metadata();
const uri = await smallBaseUri(buf);
let lastErr;
for (let attempt = 1; attempt <= 4; attempt++) {
  try {
    process.stdout.write(`Generating ${base} walk (${W}x${H}) attempt ${attempt} ... `);
    const res = await fetch(`${API}/assets/sprite/animate`, {
      method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(280000),
      body: JSON.stringify({ initial_image: uri, motion_prompt: MOTION, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite' }),
    });
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 140)}`);
    const bufs = await framesFrom(await res.json(), FRAMES);
    await mkdir(OUT_DIR, { recursive: true });
    for (let i = 0; i < bufs.length; i++) await writeFile(join(OUT_DIR, `${base}_${i}.webp`), await sharp(bufs[i]).resize(W, H, { fit: 'fill' }).webp({ quality: 92 }).toBuffer());
    console.log(`OK — wrote ${bufs.length} frames to Sprites/npc/walk/`);
    process.exit(0);
  } catch (e) {
    lastErr = e; console.log(`FAIL: ${e.message}`);
    if (/\b402\b/.test(e.message)) { console.log('*** OUT OF LUDO CREDITS (402) — stopping. ***'); process.exit(3); }
    if (attempt < 4) await sleep(3000 * attempt);
  }
}
console.error('Giving up:', lastErr && lastErr.message);
process.exit(2);
