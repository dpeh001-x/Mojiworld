#!/usr/bin/env node
// Summon WALK + ATTACK animations — strict no-drift / no-cutoff rules.
// =============================================================================
// For each sprite in Sprites/summons/, 9-frame loops via Ludo /assets/sprite/
// animate. SAME framework as the boss/projectile anims:
//   • frame_size:-9 (True-Size) + resize frames to the EXACT padded base dims
//     → pixel-accurate framing, identical aspect, NO cutoff.
//   • PAD transparent border → headroom so a frame can't clip the subject.
//   • HOLD prompt locks the subject: feet planted at the SAME spot, SAME size,
//     do NOT translate/drift/bob/zoom/rescale — animate ONLY the limbs in place.
//     → positionally accurate, no frameshift.
// Output -> Sprites/summons/anim/<key>_walk_0..8.webp + <key>_attack_0..8.webp
//
//   node scripts/generate_summon_anim.mjs                          # dry-run
//   node scripts/generate_summon_anim.mjs --only wolf --generate
//   node scripts/generate_summon_anim.mjs --only skeleton,zombie --state attack --generate
//   node scripts/generate_summon_anim.mjs --generate               # all
// Needs LUDO_API_KEY. Resumable: skips a (summon,state) whose 9 frames exist.
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUM_DIR = join(repoRoot, 'Sprites', 'summons');
const OUT_DIR = join(SUM_DIR, 'anim');
const FRAMES = 9;
const PAD = 0.16;                 // transparent border each side (anti-cutoff headroom)
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const HOLD = ' The character stays centered with its FEET planted at the EXACT same spot and the SAME size, position and framing, fully inside the frame with empty margins around it — do NOT translate, walk across the frame, drift, bob away, zoom, crop, mirror or rescale it. Animate ONLY the described motion, looping smoothly back to the start.';
// key -> { file, walk, attack }  (walk:null = attack-only summon)
const SUMMONS = {
  wolf:        { file: 'wolf.webp',         walk: 'a grey wolf companion trotting in place — its four legs cycle through a brisk walk gait, body bobbing slightly, tail swaying, ears flicking.', attack: 'a grey wolf companion biting in place — it rears its head back then lunges its snapping jaws forward and back, fur bristling, a quick snarl.' },
  wolf_alpha:  { file: 'wolf_alpha.webp',   walk: 'an alpha war-wolf (white chest mane, red flower marking) trotting in place — four legs cycling a brisk walk gait, body bobbing, tail swaying.', attack: 'an alpha war-wolf biting in place — head rears back then jaws snap forward and back, mane bristling, a fierce snarl.' },
  wolf_sky:    { file: 'wolf_sky.webp',     walk: 'a cream sky-spirit wolf (cyan feather markings) trotting in place — four legs cycling a brisk walk gait, feathers and tail fluttering.', attack: 'a cream sky-spirit wolf biting in place — head rears then jaws snap forward and back, cyan feathers flaring with a faint wind shimmer.' },
  // v0.26.x — Beastmaster "Apex Bond" Lv-50 ultimate werewolf companion.
  werewolf:    { file: 'werewolf.webp',     walk: 'a hulking muscular werewolf war-companion WALKING forward in place (treadmill) — a smooth, full, continuous walk cycle with EVEN spacing between frames: powerful legs stride with clear high steps, the heavy body bobs and shoulders roll, arms swing in opposition, fur ruffles and the tail sways, looping seamlessly with no jitter or skipped poses. Stays centered and does NOT travel; keep the WHOLE body (ears to feet, tail and claws) fully within the frame.', attack: 'a hulking muscular werewolf war-companion ATTACKING in place — it rears back then SLASHES a big clawed arm forward in a savage swipe while its jaws snap, then recovers smoothly to a ready stance, fur bristling; a fluid loop with even spacing and no jitter. Stays centered; keep the WHOLE body and the swiping claw fully within the frame, no cutoff.' },
  skeleton:    { file: 'skeleton.webp',     walk: 'a helmeted skeletal minion marching in place, holding its SPEAR upright at its side — its bony legs step in a stiff walk cycle, the free arm swinging slightly, jaw clattering, bones rattling; the spear stays in hand and the whole spear stays within the frame.', attack: 'a helmeted skeletal minion THRUSTING its SPEAR forward in place — gripping the spear, it draws the weapon back to a ready guard then lunges the spearpoint straight forward in a quick, controlled forward thrust, then retracts it back to guard, jaw clattering and bones rattling; only the arms and spear extend and retract — keep the FULL spear and spearpoint within the frame with no cutoff.' },
  zombie:      { file: 'zombie.webp',       walk: 'a shambling zombie minion walking in place — it lurches with a slow uneven walk cycle, arms hanging and swaying, shoulders rolling.', attack: 'a shambling zombie minion LUNGE-BITING in place — it snaps its head and gaping jaws FORWARD in a quick bite and reaches its arms out to grab, then pulls back to its hunched rest stance, looping smoothly. CRITICAL: the zombie BODY stays the EXACT same HEIGHT and SIZE in every frame — it does NOT rear up, rise, stretch, grow or shrink, and there is NO projectile, NO vomit, NO spew, NO wide spray (nothing large extends out from the body). Only the head/jaws and arms move a short distance; the overall silhouette stays compact and the same height. Feet planted, body centered, same size and framing throughout; keep the whole zombie within the frame.' },
  sword:       { file: 'sword.webp',        walk: null, attack: 'a floating Blade of Calamity sword striking in place — it spins/slashes a quick arc with a crackling dark-energy edge, then settles back to a hovering ready pose.' },
  clone_left:  { file: 'clone_left.webp',   walk: null, attack: 'a violet shadow-clone ninja striking in place — it snaps from a ready crouch into a fast dagger slash and back, spectral after-images flickering, no position change.' },
  clone_center:{ file: 'clone_center.webp', walk: null, attack: 'a violet shadow-clone ninja striking in place — a fast forward dagger thrust then recoil to ready, dark wisps trailing, no position change.' },
  clone_right: { file: 'clone_right.webp',  walk: null, attack: 'a violet shadow-clone ninja striking in place — a fast crossing dagger slash and back to ready, spectral after-images flickering, no position change.' },
  // v0.26.x — Skyhunter "Eye of the Tempest" eagle summon. It HOVERS (flies),
  // so its "walk" is a wing-flap flight cycle (no legs); "attack" is a dive-thrust.
  eagle:       { file: 'eagle.webp',        walk: 'a majestic golden eagle HOVERING in place — its broad wings beat in an ULTRA-SMOOTH, fluid, perfectly EVEN-SPACED continuous flap cycle: from the level mid-flap pose the wings sweep gently UP, then smoothly back DOWN through level to slightly below, then back up, looping seamlessly. Generate clean IN-BETWEEN poses so EVERY consecutive frame is only a SMALL, EQUAL step apart from the next — no large jumps, no jitter, no popping, no skipped, doubled or held frames, no sudden direction snaps. Use a graceful MODERATE amplitude (do NOT slam the wings to extreme up or extreme down — keep the motion controlled and silky). Tail fans and primary feathers ruffle gently with each beat, talons tucked. Airborne, does NOT walk or use legs. Stays centered at the EXACT same size and position; keep the full symmetrical wingspan within the frame at all times.', attack: 'a majestic golden eagle attacking from a hover in place — from the level mid-flap pose it beats its wings down hard and thrusts its head and talons forward in a swift but SMOOTH diving strike, then glides smoothly back to the hovering pose in a seamless loop. Even-spaced in-between frames, no jitter or popping; airborne, stays centered, full wingspan within the frame.' },
};

const stateArg = (arg('--state') || 'both').toLowerCase();   // walk | attack | both
let keys = Object.keys(SUMMONS);
const only = arg('--only'); if (only) keys = only.split(',').filter((k) => SUMMONS[k]);
if (!keys.length) { console.error('No matching summons.'); process.exit(1); }
const jobs = [];
for (const k of keys) for (const st of ['walk', 'attack']) {
  if ((stateArg === 'walk' && st !== 'walk') || (stateArg === 'attack' && st !== 'attack')) continue;
  if (SUMMONS[k][st]) jobs.push({ k, st });
}

if (!has('--generate')) {
  console.log(`# ${jobs.length} summon anims (9-frame, ${PAD * 100}% pad) -> Sprites/summons/anim/<key>_<state>_0..8.webp:\n`);
  for (const j of jobs) console.log(`  ${j.k}_${j.st}  (${SUMMONS[j.k].file})`);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 280000);
const force = has('--force');
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); }
async function padBuf(buf) {
  const m = await sharp(buf).metadata();
  const px = Math.round(m.width * PAD), py = Math.round(m.height * PAD);
  return sharp(buf).extend({ top: py, bottom: py, left: px, right: px, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}
const smallUri = async (buf) => 'data:image/png;base64,' + (await sharp(buf).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
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
async function fetchTimed(url, opts) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), TIMEOUT);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  catch (e) { if (ac.signal.aborted) throw new Error('timeout'); throw e; } finally { clearTimeout(t); }
}

async function genOne(k, st) {
  const tag = `${k}_${st}`;
  const done = (await Promise.all(Array.from({ length: FRAMES }, (_, i) => exists(join(OUT_DIR, `${tag}_${i}.webp`))))).every(Boolean);
  if (!force && done) return 'skip';
  const bp = join(SUM_DIR, SUMMONS[k].file);
  if (!(await exists(bp))) return 'nobase';
  const padded = await padBuf(await readFile(bp));
  const { width: W, height: H } = await sharp(padded).metadata();
  const uri = await smallUri(padded);
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetchTimed(`${API}/assets/sprite/animate`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ initial_image: uri, motion_prompt: SUMMONS[k][st] + HOLD, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite' }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 140)}`);
      const bufs = await framesFrom(await res.json(), FRAMES);
      await mkdir(OUT_DIR, { recursive: true });
      for (let i = 0; i < bufs.length; i++) await writeFile(join(OUT_DIR, `${tag}_${i}.webp`), await sharp(bufs[i]).resize(W, H, { fit: 'fill' }).webp({ quality: 92 }).toBuffer());
      return `${W}x${H}`;
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(3000 * attempt); }
  }
  throw lastErr;
}

console.log(`Generating ${jobs.length} summon anims (skip-existing: ${!force})...`);
let made = 0, skipped = 0, failed = 0;
for (const j of jobs) {
  process.stdout.write(`  ${j.k}_${j.st} ... `);
  try { const r = await genOne(j.k, j.st); if (r === 'skip') { skipped++; console.log('skip'); } else if (r === 'nobase') { console.log('NO BASE'); } else { made++; console.log(`OK ${r}`); await sleep(800); } }
  catch (e) { failed++; console.log(`FAIL: ${e.message}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
