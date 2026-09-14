#!/usr/bin/env node
// King Krook learns to move properly, via ludo.ai.
//
// Per user, with a video of the fight: "Krook animation sprites are all very disjointed and buggy,
// regenerate the necessary sprites using ludo.ai ensuring no cut offs as well, then recalibrate
// them cleanly".
//
// WHAT WAS WRONG, measured off the shipped frames (scripts/_tmp_krook_audit.mjs):
//
//   set      content-box width spread   height spread   feet drift   frames clipped
//   idle          212px (17.6%)            87px (8.1%)      0px       9 of 9 (bottom)
//   walk          159px (20.9%)            27px (4.4%)     18px       3 of 9 (bottom)
//   attack        294px (34.3%)           162px (23.0%)     0px       9 of 9 (bottom)
//   stomp         169px (29.6%)           143px (26.7%)    88px       1 of 9 (bottom)
//
// A third of a body-width of scale change inside one swing is the "disjointed" the user is seeing,
// and every set is cropped hard against the bottom edge - the feet ARE the canvas edge, so any toe
// that reaches lower is simply gone. On top of that the three sets live on three different canvas
// sizes (1800x1400, 990x770, 940x731), and _drawBossSprite scales a boss by its SOURCE long edge
// (sizeFactor = clamp(0.7..1.6, maxDim/1024)), so the boss also changes size when he changes STATE:
// 1.6 idle vs 0.918 attack, a 1.74x jump that anim_calib was hand-compensating per state.
//
// WHY animate AND NOT text->image: the old frames read as nine separate drawings of a crocodile
// king because that is what they are. /assets/sprite/animate is seeded with ONE image and moves
// THAT, so every frame is the same character by construction. The seed is the shipped still
// Sprites/bosses/kingKrook.webp - the art the user has not complained about.
//
// The prompts are written AGAINST the measured failure: no zoom, no camera move, no travel, feet on
// one line, full body inside the frame with margin. gen_krook_normalise.mjs then makes that
// arithmetic rather than a hope - one canvas, one content scale, one foot line, for all 36 frames.
//
//   node scripts/gen_krook_anim_ludo.mjs                       # print the prompts, generate nothing
//   node scripts/gen_krook_anim_ludo.mjs --generate            # needs LUDO_API_KEY
//   node scripts/gen_krook_anim_ludo.mjs --generate --only walk --rolls 2
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEEP = join(ROOT, 'scripts', '_tmp_krook_anim');
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const KEY = process.env.LUDO_API_KEY;
const SEED = join(ROOT, 'Sprites', 'bosses', 'kingKrook.webp');
const N = 9;
const argv = process.argv.slice(2), has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// Every prompt carries this. It is the whole point of the regeneration, so it is stated first and
// stated in the negative as well - "same size" alone did not stop the previous set drifting 34%.
const HOLD = [
  'The SAME red crocodile king in every single frame: identical body, identical proportions, identical',
  'gold crown, identical purple fur-trimmed cape, identical monocle, identical cream belly, identical colours.',
  'He stays exactly the SAME SIZE and in the SAME POSITION in every frame - no zoom, no camera move,',
  'no scaling up or down, no perspective change, he does not travel across the frame.',
  'His FEET stay on the SAME horizontal line in every frame.',
  'His WHOLE BODY - crown tip, snout, tail tip, cape hem and both feet - is fully inside the frame in every',
  'frame, with clear empty margin on all four sides. NOTHING is cropped, cut off or touching an edge.',
  // roll 1 of idle turned him to face the camera from frame 3 on: 'side view, facing RIGHT' was
  // read as a starting pose rather than a constraint. Stated as a ban now, like the scale drift.
  'STRICT SIDE PROFILE facing RIGHT in every frame - the same camera angle throughout.',
  'He NEVER turns, NEVER rotates his body or head toward the camera, NEVER faces the viewer:',
  'no front view, no three-quarter view, no turning around. His snout points RIGHT in all nine frames.',
  'Clean flat cartoon game-sprite art with a dark outline, exactly like the source image.',
  'Fully TRANSPARENT background in every frame - no background, no scene, no floor, no ground shadow,',
  'no text, no watermark, no border. Seamless loop: the last frame flows back into the first.',
].join(' ');

const MOTIONS = {
  idle: 'He is STANDING STILL and BREATHING, jaw closed. Only these move: the chest and belly swell and ' +
        'settle, the cape sways gently, the tail sways slowly side to side. ' +
        'His mouth stays SHUT, his arms stay at his sides, both feet stay planted flat - ' +
        'he does not step, lean, turn, crouch, roar or gesture. A calm breathing loop, nothing more. ' + HOLD,
  walk: 'He WALKS ON THE SPOT with a heavy royal waddle - a treadmill walk cycle. The legs alternate, ' +
        'one foot lifts and plants while the other takes the weight, the body rocks a little side to side, ' +
        'the tail and the cape swing with the steps. He stays in the CENTRE of the frame and does NOT ' +
        'travel, slide or drift in any direction. ' + HOLD,
  attack: 'He SWIPES with one clawed arm to the RIGHT: he draws the arm back across his chest, then swings ' +
        'it forward and across in front of him, claws spread, then brings it back to the standing pose. ' +
        'Only the arm, the shoulders and the head follow the swing - his legs stay planted and his body ' +
        'does not lunge forward or lean out of the frame. ' + HOLD,
  // rolls 1-2 read as a SQUAT, not a stomp: asking for one leg to lift made him fold down onto
  // himself. The skill telegraphs 'TYRANT'S STOMP - get off the ground!', so the pose has to be a
  // rear-up and a drive down, which is also a much clearer silhouette at boss size.
  stomp: 'He REARS UP and SLAMS DOWN. Frames 1-3: he rises onto his hind legs, chest lifted, both front ' +
        'claws raised high above him, jaws open in a roar. Frames 4-6: he drives straight DOWN and both ' +
        'front feet SLAM onto the ground, body compressed over them. Frames 7-9: he pushes back up to the ' +
        'standing pose. He rises and falls ON THE SPOT - he does not step forward, lunge, or lean out of ' +
        'the frame, and his hind feet never leave the same ground line. ' + HOLD,
};

if (!has('--generate') && !has('--from')) {
  console.log('SEED: ' + SEED + '\n');
  for (const [k, v] of Object.entries(MOTIONS)) console.log('=== ' + k + ' ===\n' + v + '\n');
  console.log('--generate [--only <set>] [--rolls N]   (needs LUDO_API_KEY)');
  process.exit(0);
}

const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(180000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };

async function poll(res) {
  if (res.status === 402) { console.error('OUT OF LUDO CREDITS'); process.exit(3); }
  if (!res.ok && res.status !== 202) throw new Error(res.status + ' ' + (await res.text()).slice(0, 200));
  let data = await res.json();
  const id = data && (data.job_id || data.jobId || data.id);
  if (res.status !== 202 && !(data && data.status && id && !data.url && !data.spritesheet_url && !data.individual_frame_urls)) return data;
  if (!id) return data;
  for (let i = 0; i < 180; i++) {
    await new Promise((s) => setTimeout(s, 5000));
    const r = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${KEY}` }, signal: AbortSignal.timeout(120000) });
    if (!r.ok) continue;
    data = await r.json();
    const st = String(data.status || data.state || '').toLowerCase();
    if (st === 'failed' || st === 'error') throw new Error('job failed: ' + JSON.stringify(data));
    if (st === 'completed' || st === 'succeeded' || st === 'done' || data.url || data.spritesheet_url || data.individual_frame_urls) {
      return (data.result && !Array.isArray(data.result)) ? Object.assign({}, data, data.result) : data;
    }
  }
  throw new Error('job did not finish');
}

if (!KEY) { console.error('LUDO_API_KEY required'); process.exit(1); }
await mkdir(KEEP, { recursive: true });
// The seed is padded to a square with margin before it is sent: the shipped still has the body
// almost touching its own bottom edge, and a seed that is already cropped teaches the animator
// that cropping is the framing.
const seedRaw = await sharp(readFileSync(SEED)).trim().toBuffer();
const seed = await sharp(seedRaw)
  // 960x960 = 0.92 MP. The API refuses True Size framing (frame_size -9) above 1 megapixel, and
  // True Size is what keeps the animator from re-framing the character between frames - which is the
  // whole failure being fixed here. So the seed is sized to fit under the limit rather than the limit
  // being worked around with a fixed frame size.
  .resize(768, 768, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: 96, bottom: 96, left: 96, right: 96, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .webp({ quality: 95, alphaQuality: 100 }).toBuffer();
await writeFile(join(KEEP, '_seed.webp'), seed);

const only = arg('--only');
const rolls = Number(arg('--rolls') || 1);
for (const [set, motion] of Object.entries(MOTIONS)) {
  if (only && only !== set) continue;
  let start = 1; while (existsSync(join(KEEP, `${set}_roll${start}_0.png`))) start++;
  for (let roll = start; roll < start + rolls; roll++) {
    process.stdout.write(`${set} roll ${roll}: animate ... `);
    let anim;
    try {
      anim = await poll(await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST', signal: AbortSignal.timeout(900000),
        headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ initial_image: 'data:image/webp;base64,' + seed.toString('base64'),
          motion_prompt: motion, frames: N, frame_size: -9, model: 'eagle', individual_frames: true }),
      }));
    } catch (e) { console.log('FAILED ' + e.message); continue; }
    let pngs = [];
    if (Array.isArray(anim.individual_frame_urls) && anim.individual_frame_urls.length >= N) {
      for (const u of anim.individual_frame_urls.slice(0, N)) pngs.push(await sharp(await fetchBuf(u)).png().toBuffer());
    } else if (anim.spritesheet_url && anim.num_cols && anim.num_rows) {
      const sh = await fetchBuf(anim.spritesheet_url), md = await sharp(sh).metadata();
      const cw = Math.floor(md.width / anim.num_cols), ch = Math.floor(md.height / anim.num_rows);
      for (let r = 0; r < anim.num_rows && pngs.length < N; r++) {
        for (let c = 0; c < anim.num_cols && pngs.length < N; c++) {
          pngs.push(await sharp(sh).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
        }
      }
    }
    if (pngs.length < N) { console.log('only ' + pngs.length + ' frames: ' + JSON.stringify(anim).slice(0, 200)); continue; }
    for (let i = 0; i < N; i++) await writeFile(join(KEEP, `${set}_roll${roll}_${i}.png`), pngs[i]);
    console.log('ok');
  }
}
console.log('candidates in ' + KEEP);
