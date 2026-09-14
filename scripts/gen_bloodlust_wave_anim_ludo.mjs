#!/usr/bin/env node
// The Bloodlust crescent learns to move, via ludo.ai.
//
// Per user, with the sprite attached: "using ludo.ai generation animation sequence for this
// projectile sprite and wire in" ... "it should be a shockwave like animation".
//
// The sprite is Sprites/projectiles/p_bloodlust_shockwave.webp - the Bloodlust swing-rider's own
// crescent, authored v0.29.694 and facing RIGHT. It is thrown by the `bloodwave` skill carrying
// bspr:'bloodlust_wave', and that bspr branch of drawProjectiles never consulted _GEN_PROJ_ANIM,
// so this crescent has always been a still image while its neighbours animate.
//
// ONE ludo stage, not two: the art already exists and the user pointed at it, so text->image
// would be the wrong tool - it would invent a DIFFERENT crescent. This seeds
// /assets/sprite/animate with the shipped sprite itself, so what comes back is that same crescent
// in motion.
//
// The motion brief is constrained by what the engine already does to this projectile:
//   - it MIRRORS the sprite for leftward travel (ctx.scale(-1,1)) and does not rotate it, so the
//     frames must not rotate or drift, or the wave will fight its own heading;
//   - the nine frames LOOP for the projectile's whole 40-frame life, so the motion has to return
//     to where it started rather than play once;
//   - it draws at 104x96 from a 768px source, so the movement has to read at thumbnail size -
//     big shape changes on the arc, not fine detail in the spikes.
//
//   node scripts/gen_bloodlust_wave_anim_ludo.mjs                  # print the prompt, generate nothing
//   node scripts/gen_bloodlust_wave_anim_ludo.mjs --generate       # needs LUDO_API_KEY; writes candidates
//   node scripts/gen_bloodlust_wave_anim_ludo.mjs --from N --install
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEEP = join(ROOT, 'scripts', '_tmp_bloodlust_anim');
// BLOODLUST_OUT installs into a scratch dir instead of the shared checkout - parallel sessions
// edit this repo, so writing tracked art here is opt-in rather than automatic.
const OUT = process.env.BLOODLUST_OUT || ROOT;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const KEY = process.env.LUDO_API_KEY;
const SRC = join(ROOT, 'Sprites', 'projectiles', 'p_bloodlust_shockwave.webp');
const N = 9, SIZE = 768;
const argv = process.argv.slice(2), has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// v1 (v0.30.687, REJECTED by the user: "the animation sprites look rather weird"). It asked for
// embers and sparks shedding off the trailing edge, and that is exactly what it delivered - the
// middle frames fizz into speckle, the silhouette breaks up, and the whole thing reads as sparkle
// rather than as a pressure wave. Kept so the next person does not ask for particles again.
const MOTION_EMBERS = [
  'A crimson crescent energy shockwave, seen side-on, flying to the RIGHT.',
  'Only the ENERGY moves: a bright ripple travels the arc, the spikes flare, embers and sparks shed off the trailing edge.',
].join(' ');

// v2 - per user: "make it look more shockwave like sonic boom". The brief is written AGAINST the
// v1 failure: the crescent is a solid object moving through air, so what animates is the AIR -
// pressure rings, speed lines, a rim flash - while the silhouette stays hard-edged and unbroken.
// Particles are banned outright rather than left unmentioned, because unmentioned is how v1 got
// them.
const MOTION = [
  'A crimson crescent blade SHOCKWAVE flying to the RIGHT - a sonic boom. Not fire, not sparkle, not magic dust.',
  'The crescent itself stays PERFECTLY CENTRED, the SAME SIZE and the SAME ANGLE in every frame:',
  'do NOT rotate it, do NOT move it across the frame, no camera move, no zoom, no scaling.',
  'Its silhouette stays CRISP, SOLID and UNBROKEN in every frame - hard clean edges, sharp unbroken points,',
  'the same deep red body and dark outline throughout.',
  'What moves is the AIR around it: a thin translucent white pressure ring expands outward from the crescent',
  'and fades, a second fainter ring follows behind it, straight horizontal speed lines streak backwards off',
  'the tips, and a thin white-hot rim flashes along the leading edge and dims again.',
  'ABSOLUTELY NO sparks, NO embers, NO glitter, NO speckles, NO dust, NO flying debris, NO grain, NO noise,',
  'NO smoke: the frame stays clean and only the rings, the streaks and the rim light change.',
  'Seamless loop - the last frame flows back into the first. Same colours, same art style,',
  'fully transparent background in every frame, no background, no scene, no text, no watermark.',
].join(' ');

if (!has('--generate') && !has('--from')) {
  console.log('SEED: ' + SRC + '\n\nMOTION:\n' + MOTION + '\n\n--generate (LUDO_API_KEY) | --from N --install');
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
    if (st === 'failed' || st === 'error') throw new Error('job failed: ' + JSON.stringify(data).slice(0, 200));
    if (st === 'completed' || st === 'succeeded' || st === 'done' || data.url || data.spritesheet_url || data.individual_frame_urls) {
      // the finished job may nest the payload under result
      return (data.result && !Array.isArray(data.result)) ? Object.assign({}, data, data.result) : data;
    }
  }
  throw new Error('job did not finish');
}

if (has('--generate')) {
  if (!KEY) { console.error('LUDO_API_KEY required'); process.exit(1); }
  await mkdir(KEEP, { recursive: true });
  const rolls = Number(arg('--rolls') || 2);
  let start = 1; while (existsSync(join(KEEP, `roll${start}_0.png`))) start++;
  const seed = await sharp(readFileSync(SRC)).resize(512, 512, { fit: 'inside' }).webp({ quality: 95 }).toBuffer();
  for (let roll = start; roll < start + rolls; roll++) {
    process.stdout.write(`roll ${roll}: animate ... `);
    let anim;
    try {
      anim = await poll(await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST', signal: AbortSignal.timeout(900000),
        headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ initial_image: 'data:image/webp;base64,' + seed.toString('base64'),
          motion_prompt: MOTION, frames: N, frame_size: -9, model: 'eagle', individual_frames: true }),
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
    if (pngs.length < N) { console.log('only ' + pngs.length + ' frames: ' + JSON.stringify(anim).slice(0, 160)); continue; }
    for (let i = 0; i < N; i++) await writeFile(join(KEEP, `roll${roll}_${i}.png`), pngs[i]);
    console.log('ok');
  }
  console.log('candidates in ' + KEEP);
}

if (has('--install') || has('--from')) {
  const roll = arg('--from') || '1';
  // NO CROP, deliberately. Measured against the source: the shipped sprite's crescent fills
  // 0.935 of its 768 canvas, and the generated frame's fills 0.934 of its 512 - the animate
  // stage handed back the same framing it was seeded with. A union crop would have padded the
  // box out to fit the embers frames 3-5 fling to the canvas edge and shrunk the crescent by
  // ~7%, so the wave would visibly SHRINK the moment its frames finished decoding. Straight
  // 512 -> 768 keeps the animated crescent the same size as the still one it replaces.
  if (has('--install')) await mkdir(join(OUT, 'Sprites', 'projectiles', 'anim'), { recursive: true });
  for (let i = 0; i < N; i++) {
    const src = readFileSync(join(KEEP, `roll${roll}_${i}.png`));
    const out = await sharp(src).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 92, alphaQuality: 100 }).toBuffer();
    const dst = has('--install')
      ? join(OUT, 'Sprites', 'projectiles', 'anim', `bloodlust_wave_${i}.webp`)
      : join(KEEP, `final_roll${roll}_${i}.webp`);
    await writeFile(dst, out);
  }
  console.log((has('--install') ? 'installed' : 'wrote') + ` ${N} frames from roll ${roll} at ${SIZE}px, uncropped`);
}
