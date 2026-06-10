#!/usr/bin/env node
// Boss attack-ANIMATION runner — v0.26.311
// =============================================================================
// Two-stage, per boss, both stages UPLOADING the base sprite so results stay
// on-model:
//   1. editImage(base sprite)            -> single attack pose  (<type>.webp)
//   2. animateSprite(base, pose, 4 frames) -> 4 frames (<type>_0..3.webp)
// Output lands in Sprites/bosses/attack/. The game loader/_bossAttackFrame()
// ping-pongs the 4 frames during the attack window; the single pose is the
// fallback when frames are absent.
//
//   node scripts/generate_boss_attack_anim.mjs                 # dry-run list
//   node scripts/generate_boss_attack_anim.mjs --only koopaKing --generate
//   node scripts/generate_boss_attack_anim.mjs --generate      # all (skips done)
//
// Needs LUDO_API_KEY. Skips a boss whose 4 frames already exist (unless --force).
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import { dirname, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = join(__dirname, '..');
const BOSS_DIR  = join(repoRoot, 'Sprites', 'bosses');
const OUT_DIR   = join(BOSS_DIR, 'attack');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// v0.26.313 — animate from the base sprite ALONE (no final_image). Passing an
// attack pose as final_image made animateSprite MORPH idle->pose and rescale
// the body across frames, so the character pulsed in size ("doesn't flow").
// A single source + an explicit "attack IN PLACE, do not rescale" motion prompt
// holds the body at constant scale/position; only effects + mouth/limbs move.
// v0.26.317 — strong anti-flip clause: the model was mirroring side-facing
// bosses (aetherion faced/shot left while its idle faces right), which breaks
// the game's facing logic. Keep the SOURCE's left/right orientation and shoot
// in the direction it already faces.
const FACING = ' Keep the EXACT same left/right facing and orientation as the ' +
  'source image — NEVER mirror or flip the character horizontally. Any breath, ' +
  'beam, or projectile travels in the direction the character already faces.';
const MOTION_PROMPT =
  'the boss performs its attack IN PLACE — it stays the EXACT same size and ' +
  'position, does not zoom, lunge, or rescale; only its mouth/limbs move and ' +
  'elemental energy / effects charge and burst around it.' + FACING;
const MOTION_OVERRIDES = {
  octobaby: 'the octopus stays the EXACT same size and position; only its mouth opens into a roar and four small glowing status orbs (toxic purple, ice cyan, silence amber, shock yellow) charge in around its tentacle tips. Do not zoom or rescale the character.' + FACING,
  koopaKing: 'the turtle-dragon king stays the EXACT same size and position; only its mouth opens to belch a fireball, its fists raise and its crimson mohawk flames flare. Do not zoom or rescale the character.' + FACING,
  // v0.26.317/318 — NO long directional beam (the model aimed it backward / in
  // two directions across frames, which breaks once the game mirrors the
  // sprite). A charge-up at the mouth is facing-agnostic, so it can never read
  // as "shooting the wrong way". Applies to all the projectile/beam bosses.
  aetherion: 'the white-and-gold dragon opens its mouth wide and a radiant golden energy charges and glows AT ITS MOUTH, wings flare and sparks crackle around its body. Do NOT emit a long beam or projectile in any direction — keep the glowing energy concentrated as a charge at the mouth. It stays the EXACT same size, position and facing as the source.' + FACING,
  // v0.26.644 — REWORK. The previous prompt said "wings flare / keep the full
  // WINGSPAN in frame", which made eagle sprout giant spread bat-wings — totally
  // off-model (the source is a compact bipedal dragon-warrior with a swirling
  // golden energy RING around its torso and NO large wings). New prompt forbids
  // wing-spread and keeps the tight ring-caster silhouette: only the mouth/claws
  // charge and the energy ring flares.
  aetherion2: 'the golden dragon-warrior raises its clawed hands and brilliant golden energy charges and glows AT ITS OPEN MOUTH and claws, while the swirling golden energy RING around its torso flares brighter and spins faster; ornate gold armor glints and small sparks crackle CLOSE to its body. It stays STANDING UPRIGHT on two legs in the EXACT same compact pose, size, position and facing as the source. Do NOT grow, spread, unfurl, or flare large wings; do NOT add bat-wings or a wide wingspan; keep the SAME TIGHT SILHOUETTE as the source with arms, claws and tail held close to the body. Do NOT emit a long beam or projectile in any direction — keep the energy as a concentrated charge at the mouth/claws. ONE single connected body; do not duplicate, split, or detach any limbs.' + FACING,
  blockRexy: 'the blocky voxel T-rex opens its jaws wide and roars, a glowing green energy charging AT ITS MOUTH/jaws, tiny pixel sparks around it. Do NOT emit a long beam or projectile in any direction — keep the energy as a charge at the mouth. It stays the EXACT same size, position and facing as the source.' + FACING,
  // v0.26.321 — gravitos (FORM 1 ONLY) was duplicating/detaching legs at the
  // top of the frame. Lock the anatomy to one intact body.
  gravitos: 'the cosmic-energy golem powers up in place — its chest core flares with bright energy and its arms flex and clench. It is ONE single connected body with EXACTLY two arms and two legs, all attached to the torso; do NOT add, duplicate, split, mirror, or detach any limbs, and no floating body parts — the full body stays intact and in one piece.' + FACING,
  // v0.26.362/363/364 — Sundered Smith: full overhead-to-GROUND hammer SMASH.
  // The hammer MUST travel all the way down to ground level (earlier rolls kept
  // it raised); drive the down-stroke explicitly to the bottom of the frame.
  sundered_smith: 'the fiery blacksmith warrior performs a big OVERHEAD-TO-GROUND HAMMER SMASH, a full arc. Early frames: hammer raised high overhead, winding up. Then he swings it ALL THE WAY DOWN and SLAMS the molten hammer head onto the GROUND directly in front of his feet — in the LOWEST frames the hammer head is DOWN at ground level near his boots at the bottom-centre of the frame, body bent forward from the impact, with a burst of white-hot sparks, flying embers and a fiery ground shockwave at the point of impact. Then he hauls it back up to repeat. The hammer head genuinely reaches the GROUND on the downswing (do not keep it up). Keep the hammer just INSIDE the lower edge — at ground level but not clipped past the bottom. ONE single connected body; do not duplicate, split, or detach any limbs or the hammer; same character, colours and outline; stays centered at the EXACT same size and facing.' + FACING,
  // v0.26.x — Gravitos phase-2/3 "MEGA FINAL SUPERNOVA" special attack. A
  // charge-then-erupt cosmic blast; the boss stays the central solid figure while
  // a brilliant supernova bursts around it. Generate with LUDO_ANIM_PAD for room.
  gravitos2star: 'the dark cosmic boss unleashes a MEGA FINAL SUPERNOVA in place. Early frames: it hunches and GATHERS immense cosmic energy, its core and eyes blazing brighter and brighter, swirling violet-and-blue star-energy spiralling inward. Mid frames: it throws its head back and ERUPTS — a brilliant radiant SUPERNOVA of white, electric-blue and violet stellar energy bursts outward all around it, with expanding bright shockwave rings, swirling star-streaks, glittering star sparkles and crackling cosmic lightning, the boss wreathed in blinding stellar fire at the centre. The boss BODY stays the EXACT same size, position and facing the whole time — do NOT zoom, lunge or rescale the body; ONLY the energy charges and bursts around it, and the boss remains clearly visible as the solid figure at the centre. ONE single connected body; do not duplicate, split, or detach any limbs.' + FACING,
  gravitos3star: 'the colossal final cosmic boss unleashes a MEGA FINAL SUPERNOVA in place. Early frames: it gathers overwhelming cosmic power, its core and markings searing brighter, violet-magenta-and-gold galaxy energy spiralling inward. Mid frames: it ERUPTS — an immense radiant SUPERNOVA of white-gold, magenta and violet stellar energy bursts outward all around it, with huge expanding shockwave rings, sweeping star-streaks, glittering starbursts and crackling cosmic lightning, the boss wreathed in blinding stellar fire at the centre. The boss BODY stays the EXACT same size, position and facing the whole time — do NOT zoom, lunge or rescale the body; ONLY the energy charges and bursts around it, and the boss remains clearly visible as the solid figure at the centre. ONE single connected body; do not duplicate, split, or detach any limbs.' + FACING,
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
// frame_size:-9 ("True Size" — anchors the output to the input's framing, so no
// zoom/drift) requires the input < 1MP. Downscale the base to fit within 940px
// and send THAT as the initial frame; output matches its framing (full body,
// stable). The normalizer then re-scales to the idle's real dimensions.
// v0.26.x — optional transparent padding (env LUDO_ANIM_PAD, e.g. 0.4) added
// BEFORE the 940px downscale, so the animate model has headroom and a flaring
// pose (e.g. aetherion2's spread wings) can't clip against the frame edge.
// Off by default (PAD=0) so other bosses' framing is unchanged.
const _ANIM_PAD = Number(process.env.LUDO_ANIM_PAD || 0);
const smallBaseUri = async (p) => {
  let buf = await readFile(p);
  if (_ANIM_PAD > 0) {
    const mm = await sharp(buf).metadata();
    const px = Math.round(mm.width * _ANIM_PAD), py = Math.round(mm.height * _ANIM_PAD);
    buf = await sharp(buf).extend({ top: py, bottom: py, left: px, right: px, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  }
  const small = await sharp(buf).resize(940, 940, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
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
  console.log(`# ${work.length} boss attack ANIMATIONS to generate:\n`);
  for (const w of work) console.log(`  ${w.type}  [${MOTION_OVERRIDES[w.type] ? 'authored' : 'generic'} motion]  -> attack/${w.type}_0..3.webp`);
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
// Get N frame buffers from an animate response. Prefer individual_frame_urls;
// if the server omitted them (happens with eagle on some inputs), slice the
// returned spritesheet into its num_cols x num_rows grid ourselves.
async function framesFrom(data, n) {
  // PREFER slicing the spritesheet — its cells reliably match the input aspect.
  // Ludo's individual_frame_urls wrongly SQUARE non-square frames (e.g. an
  // 890x990 frame comes back 890x890, cropping the legs). Slice first; only
  // fall back to individual URLs if no spritesheet is returned.
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
  throw new Error('no usable frames (no spritesheet, insufficient individual frames)');
}

// v0.26.316 — 9 frames (3x3) for smoothness, with the EAGLE model (Visual
// Quality 8/10 vs the default blitz's 4/10 — blitz looked rough at 9 frames).
// frame_size:0 (max res); the normalizer re-frames to the idle's dimensions.
// (frame_size:-9 "True Size" would anchor position but requires a <1MP input,
// which the large 1276² bosses exceed.)
const FRAMES = 9;
// Per-boss model override (none needed now — the gravitos "detached limbs"
// were Ludo squaring non-square individual frames, fixed in framesFrom).
const MODEL_OVERRIDES = {};
async function animate(w) {
  const data = await post('/assets/sprite/animate', {
    initial_image: await smallBaseUri(join(BOSS_DIR, w.file)),
    motion_prompt: MOTION_OVERRIDES[w.type] || MOTION_PROMPT,
    frames: FRAMES, frame_size: -9, model: MODEL_OVERRIDES[w.type] || 'eagle',
    individual_frames: true, loop: false, image_type: 'sprite',
  });
  const bufs = await framesFrom(data, FRAMES);
  if (bufs.length < FRAMES) throw new Error(`got ${bufs.length} frames`);
  await mkdir(OUT_DIR, { recursive: true });
  for (let i = 0; i < bufs.length; i++) await writeFile(join(OUT_DIR, `${w.type}_${i}.webp`), bufs[i]);
  // Static fallback (shown until frames decode) = last frame (full attack).
  await writeFile(join(OUT_DIR, `${w.type}.webp`), bufs[bufs.length - 1]);
}

console.log(`Generating ${work.length} boss attack animations (skip-existing: ${!force})...`);
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
