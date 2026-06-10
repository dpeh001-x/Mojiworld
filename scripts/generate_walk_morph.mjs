#!/usr/bin/env node
// MORPH-based WALK cycle for monsters whose in-place walk barely moves the legs.
// =============================================================================
// In-place animateSprite (no final_image) can only SWAY — it has no leg-apart
// keyframe to interpolate toward, so legs barely move. This MORPHS: editImage
// the base into a strong MID-STRIDE pose (one knee high, opposite arm forward),
// then animateSprite(initial=base, final=pose, loop) so the cycle sweeps the
// legs through a real step. Output overwrites Sprites/monsters/walk/<type>_0..8.webp.
// Strict framing: frame_size:-9 + resize to EXACT base dims.
//
//   node scripts/generate_walk_morph.mjs                       # dry-run
//   node scripts/generate_walk_morph.mjs --only echoKnight --generate
//   node scripts/generate_walk_morph.mjs --generate            # all listed
// Needs LUDO_API_KEY.
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const MON_DIR = join(repoRoot, 'Sprites', 'monsters');
const OUT_DIR = join(MON_DIR, 'walk');
const FRAMES = 9;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const TAIL = ' Same character, colours and outline as the source; full body with BOTH feet/legs visible; ONE single connected figure (do not duplicate, detach, or add limbs); stay centered at the EXACT same size, framing and left/right facing; transparent background; do not mirror or flip.';
const WALK = ' Animate a believable HUMAN-style WALK cycle in place (treadmill): the legs ALTERNATE with clear high, bent-knee steps and the opposite arm swings forward with each step, the body bobbing up and down naturally with the gait. The leg motion must be LARGE and obvious across the frames — a real stride, NOT a stiff sway or a tiny twitch. It stays centered and does NOT travel or slide across the frame. ONE single connected body; do not duplicate or detach limbs.';
// type -> editImage prompt producing a strong MID-STRIDE pose.
const POSE = {
  echoKnight: 'the SAME blue-flame armoured knight captured MID-STRIDE in a walk: its RIGHT leg lifted HIGH and forward with the knee sharply bent and the foot off the ground, its LEFT leg straight and planted behind bearing the weight, the torso leaning slightly forward into the step, the LEFT arm swung forward and the RIGHT arm swung back (opposite to the legs).' + TAIL,
  boneGolem: 'the SAME heavy skeleton golem captured MID-STRIDE in a lumbering walk: its RIGHT leg lifted HIGH with the knee strongly bent and the foot well off the ground, its LEFT leg straight and planted behind, the whole heavy body rocking forward over the planted leg, the LEFT arm swung forward and the RIGHT arm back (opposite to the legs).' + TAIL,
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const basePath = async (t) => { for (const e of ['.png', '.webp']) { const p = join(MON_DIR, t + e); if (await exists(p)) return p; } return null; };
const small = async (buf) => 'data:image/png;base64,' + (await sharp(buf).resize(980, 980, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
async function fetchBuf(u) { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }
async function framesFrom(d, n) {
  if (d.spritesheet_url && d.num_cols && d.num_rows) {
    const sheet = await fetchBuf(d.spritesheet_url), m = await sharp(sheet).metadata();
    const cw = Math.floor(m.width / d.num_cols), ch = Math.floor(m.height / d.num_rows), o = [];
    for (let r = 0; r < d.num_rows && o.length < n; r++) for (let c = 0; c < d.num_cols && o.length < n; c++)
      o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  const u = d.individual_frame_urls || []; if (u.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(u[i])); return o; } throw new Error('no frames');
}

let types = Object.keys(POSE);
const only = arg('--only'); if (only) types = only.split(',').filter((t) => POSE[t]);
if (!types.length) { console.error('No matching types. Known: ' + Object.keys(POSE).join(', ')); process.exit(1); }
if (!has('--generate')) { console.log('# walk-morph for: ' + types.join(', ') + '\n# Re-run with --generate.'); process.exit(0); }

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 290000);
async function post(path, body, ms) {
  let last; for (let a = 1; a <= 4; a++) { try {
    const r = await fetch(`${API}${path}`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(ms), body: JSON.stringify(body) });
    if (!r.ok) { const t = await r.text(); if (/\b402\b/.test(t)) throw new Error('402 OUT OF CREDITS'); throw new Error(r.status + ': ' + t.slice(0, 140)); }
    return r.json();
  } catch (e) { last = e; if (/402/.test(e.message)) throw e; if (a < 4) await new Promise(s => setTimeout(s, 4000 * a)); } }
  throw last;
}

let made = 0, failed = 0;
for (const t of types) {
  process.stdout.write(`  ${t} ... `);
  try {
    const bp = await basePath(t); if (!bp) { console.log('NO BASE'); continue; }
    const baseBuf = await readFile(bp); const { width: W, height: H } = await sharp(baseBuf).metadata();
    const baseUri = await small(baseBuf);
    const ed = await post('/assets/image/edit', { image: baseUri, prompt: POSE[t], n: 1, augment_prompt: false }, 150000);
    const poseUrl = Array.isArray(ed) ? ed[0]?.url : ed?.url; if (!poseUrl) throw new Error('no pose url');
    const poseUri = await small(await fetchBuf(poseUrl));
    const an = await post('/assets/sprite/animate', { initial_image: baseUri, final_image: poseUri, motion_prompt: WALK, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite' }, TIMEOUT);
    const bufs = await framesFrom(an, FRAMES);
    await mkdir(OUT_DIR, { recursive: true });
    for (let i = 0; i < bufs.length; i++) await writeFile(join(OUT_DIR, `${t}_${i}.webp`), await sharp(bufs[i]).resize(W, H, { fit: 'fill' }).webp({ quality: 92 }).toBuffer());
    made++; console.log(`OK ${W}x${H}`);
  } catch (e) { failed++; console.log('FAIL: ' + e.message); if (/402/.test(e.message)) { console.log('*** OUT OF CREDITS ***'); process.exit(3); } }
}
console.log(`Done. ${made} made, ${failed} failed.`);
process.exit(failed ? 2 : 0);
