#!/usr/bin/env node
// NPC idle animation runner — v0.26.360
// =============================================================================
// 9-frame gentle idle loop per NPC, same strict framework as monsters/zodiac:
// eagle, frame_size:-9 (True-Size), sliced from the spritesheet, resized to the
// EXACT base dimensions (pixel-accurate framing, no frame shifts). NPCs just
// stand and idle — idle mode only. EXTRA constraint: the motion is kept compact
// so NOTHING (hair, arms, props, robe) extends past the frame edge — no canvas
// cutoffs. Output -> Sprites/npc/idle/<basename>_0..8.webp (basename = on-disk
// filename without extension; the renderer maps npc.name -> file -> basename).
//
//   node scripts/generate_npc_anim.mjs                 # dry-run list
//   node scripts/generate_npc_anim.mjs --only milo --generate
//   node scripts/generate_npc_anim.mjs --generate      # all NPCs (skips done)
// Needs LUDO_API_KEY. Resumable; stops cleanly on 402 (out of credits).
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import { dirname, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const NPC_DIR = join(repoRoot, 'Sprites', 'npc');
const OUT_DIR = join(NPC_DIR, 'idle');
const FRAMES = 9;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const MOTION =
  'the character stands and idles in place — subtle, gentle living motion: slow ' +
  'breathing, a slight sway/shift of weight, a soft idle gesture and an occasional ' +
  'blink. CRITICAL: keep ALL parts of the character (head, hair, arms, hands, held ' +
  'props, cloak/robe, tail) FULLY INSIDE the frame at ALL times — keep the motion ' +
  'compact and contained so nothing ever reaches, touches, or extends past the frame ' +
  'edges or gets clipped. Stay centered at the EXACT same size, position and framing; ' +
  'do not zoom, pan, crop, step, or rescale, and never mirror or flip the character.';

// v0.26.x — Per-NPC motion overrides (keyed by on-disk basename). NPCs without
// an entry use the generic gentle-idle MOTION above.
const MOTION_OVERRIDES = {
  // Kuro (sniper ninja) — per user: a SMOOTH, seamlessly-looping dagger-throw
  // flourish instead of a plain idle.
  kuro:
    'the masked chibi ninja performs a SMOOTH, fluid dagger-throwing flourish that loops seamlessly: he winds one glowing purple dagger back, then flicks it forward in a crisp throwing motion and smoothly draws it back to repeat — a continuous, graceful wrist-and-arm flick, the other dagger held ready, the purple scarf flowing with the motion. Ease the motion evenly across frames so it is FLUID with no jerky jumps or pops, and the last frame flows naturally back into the first. CRITICAL: keep the daggers, hands, scarf and ALL body parts FULLY INSIDE the frame at all times — the throw is a COMPACT in-place flick, the dagger never leaves or touches the frame edge. Stay centered at the EXACT same size, position and framing; do not zoom, pan, crop, step, rescale, mirror or flip.',
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const smallBaseUri = async (buf) => 'data:image/png;base64,' + (await sharp(buf).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); }
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

// Discover NPC base sprites on disk (basename = filename without extension).
let npcs = (await readdir(NPC_DIR, { withFileTypes: true }))
  .filter((d) => d.isFile() && /\.(png|webp)$/i.test(d.name))
  .map((d) => ({ name: basename(d.name, extname(d.name)), file: d.name }));
const only = arg('--only'); if (only) { const set = new Set(only.split(',')); npcs = npcs.filter((n) => set.has(n.name)); }
if (!npcs.length) { console.error('No NPC sprites found.'); process.exit(1); }

if (!has('--generate')) {
  console.log(`# ${npcs.length} NPCs -> idle/<name>_0..8.webp (9-frame, no-cutoff):\n`);
  for (const n of npcs) console.log(`  ${n.name}  (${n.file})`);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function genOne(n) {
  const done = (await Promise.all(Array.from({ length: FRAMES }, (_, i) => exists(join(OUT_DIR, `${n.name}_${i}.webp`))))).every(Boolean);
  if (!force && done) return 'skip';
  const buf = await readFile(join(NPC_DIR, n.file));
  const { width: W, height: H } = await sharp(buf).metadata();
  const uri = await smallBaseUri(buf);
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(280000),
        body: JSON.stringify({ initial_image: uri, motion_prompt: MOTION_OVERRIDES[n.name] || MOTION, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite' }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 140)}`);
      const bufs = await framesFrom(await res.json(), FRAMES);
      await mkdir(OUT_DIR, { recursive: true });
      for (let i = 0; i < bufs.length; i++) await writeFile(join(OUT_DIR, `${n.name}_${i}.webp`), await sharp(bufs[i]).resize(W, H, { fit: 'fill' }).webp({ quality: 92 }).toBuffer());
      return `${W}x${H}`;
    } catch (e) { lastErr = e; if (/\b402\b/.test(e.message)) throw e; if (attempt < 4) await sleep(3000 * attempt); }
  }
  throw lastErr;
}

console.log(`Generating idle for ${npcs.length} NPC(s) (skip-existing: ${!force})...`);
let made = 0, skipped = 0, failed = 0;
for (const n of npcs) {
  process.stdout.write(`  ${n.name} ... `);
  try { const r = await genOne(n); if (r === 'skip') { skipped++; console.log('skip'); } else { made++; console.log(`OK ${r}`); await sleep(800); } }
  catch (e) { failed++; console.log(`FAIL: ${e.message}`); if (/\b402\b/.test(e.message)) { console.log('\n*** OUT OF LUDO CREDITS (402) — stopping. Re-run once credits renew. ***'); process.exit(3); } }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
