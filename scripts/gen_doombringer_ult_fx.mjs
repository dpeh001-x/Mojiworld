#!/usr/bin/env node
// Calamity Incarnate's blade (ludo.ai):
//   1) NEW static sprite -> staged doombringer_ult.webp
//   2) 9-frame one-shot  -> staged doombringer_ult_0..8.webp
//
//   node scripts/gen_doombringer_ult_fx.mjs --generate   # needs LUDO_API_KEY
//   node scripts/gen_doombringer_ult_fx.mjs --install    # staged -> Sprites/
//
// v0.30.x — per user: "the sword animation for calamity incarnate needs to be bigger badder much
// much more stronger like an ultimate final attack".
//
// What was wrong with the old plate is a composition problem, not a rendering one. It drew a
// MEDIUM sword inside a round fireball, and the fireball was the subject: the blade sat at roughly
// a third of the frame with the orb filling the rest, so the more the skill scaled up on screen the
// more it read as "a fire orb with a sword in it" — an item drop, not a verdict. And across its
// nine frames the sword did not move at all; only the flames licked, so the ultimate had no beat.
//
// This one is authored the other way round: the BLADE is the subject and fills the frame
// vertically, point down, and the fire is what it is wearing. The nine frames carry a real strike —
// the blade hangs, gathers, then comes down — so the animation has a downbeat to land the hit on.
//
// Nothing here is left to taste: the frames are checked for the two failure modes this exact
// pipeline has produced before (a set that barely changes, which is what the old plate was, and a
// set that drifts its framing so the sword slides around inside its own hitbox), and the script
// refuses to stage art that fails either.
import sharp from 'sharp';
import { writeFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STAGE = process.env.DOOM_STAGE || join(ROOT, 'scripts', '_style_pack', 'doombringer_ult');
const FRAMES = 9, SIZE = 952;          // 952 matches the frames already shipped for this key
const has = (f) => process.argv.includes(f);

const BASE_PROMPT =
  'A COLOSSAL EXECUTIONER GREATSWORD for a 2D fantasy game, drawn as a single hero sprite. ' +
  'The blade is the subject and DOMINATES the frame: held vertical, point DOWN, tip near the ' +
  'bottom edge and pommel near the top edge, filling almost the full height. It is an enormous ' +
  'black iron doom-blade with a jagged fuller of molten crimson running its length, a heavy ' +
  'cruel crossguard and a dark wrapped grip. Wreathed in violent doom-fire: crimson and orange ' +
  'flame streaming UPWARD along both edges of the blade, violet-black smoke curling at the ' +
  'outside, white-hot heat where the fire meets the steel, and embers thrown off the edge. ' +
  'Palette: black iron, deep crimson, molten orange, white-hot highlights, violet shadow. ' +
  'Flat 2D cartoon game sprite, bold clean shapes, crisp cel shading, thick dark outline, ' +
  'dramatic and heavy. The sword must be LARGE in frame — do NOT draw it small inside a ball of ' +
  'fire, do NOT draw a round fireball. Fully TRANSPARENT background (alpha only). ' +
  'NO character, NO hands, NO face, NO text, NO ground line, NO background, NO circle, NO orb.';

const MOTION =
  'A single executioner\'s strike played start to finish across the nine frames, with visible ' +
  'change in every frame and NO looping back. Frames 1-3: the blade HANGS and GATHERS — the ' +
  'doom-fire draws inward and brightens along the fuller, the crimson in the steel builds toward ' +
  'white-hot, embers begin to rise. Frames 4-6: it ERUPTS — the fire flares out hugely along both ' +
  'edges, the fuller blazes white, a violent surge of flame and embers bursts outward from the ' +
  'blade. Frames 7-9: the fire FALLS AWAY — the flames thin and trail off, the steel cools back ' +
  'toward dark iron, only drifting embers and a dim crimson glow remain. ' +
  'CRITICAL — LOCKED FRAMING: the sword stays at the exact same position, angle and scale in ' +
  'every frame. It does NOT swing, rotate, zoom, pan, crop, drift, mirror or flip. Only the FIRE, ' +
  'the heat in the steel and the embers change. ' +
  'Keep the exact same art style, palette (black iron, crimson, molten orange, white-hot, violet) ' +
  'thick dark outline and fully transparent background in every frame. ' +
  'NO character, NO hands, NO background, NO orb, NO circle, NO text.';

// ---------------------------------------------------------------- install ----
if (has('--install')) {
  const DST_BASE = join(ROOT, 'Sprites', 'fx', 'doombringer_ult.webp');
  const DST_ANIM = join(ROOT, 'Sprites', 'fx', 'anim');
  if (!existsSync(join(STAGE, 'doombringer_ult.webp'))) { console.error('nothing staged'); process.exit(1); }
  await copyFile(join(STAGE, 'doombringer_ult.webp'), DST_BASE);
  for (let i = 0; i < FRAMES; i++) await copyFile(join(STAGE, `doombringer_ult_${i}.webp`), join(DST_ANIM, `doombringer_ult_${i}.webp`));
  console.log(`installed base + ${FRAMES} frames`);
  console.log('NOW: node scripts/gen_fx_anim_timing.mjs   (the weights table is keyed to this art)');
  process.exit(0);
}

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const fetchBuf = async (u) => {
  const r = await fetch(u, { signal: AbortSignal.timeout(180000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
};
// Both endpoints answer with a QUEUED JOB now (the API moved to async on 2026-09-11); the older
// generators in scripts/ still read the response as the finished asset and would throw on the
// queue envelope. Post, then poll the job to completion and hand back the completed payload.
async function pollJob(id) {
  for (let i = 0; i < 200; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const r = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(60000) });
    if (!r.ok) continue;
    const j = await r.json();
    const st = j && (j.status || j.state);
    if (st === 'succeeded' || st === 'completed' || st === 'done') return j;
    if (st === 'failed' || st === 'error') throw new Error('job failed: ' + JSON.stringify(j).slice(0, 200));
  }
  throw new Error('job timed out');
}
async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST', signal: AbortSignal.timeout(600000),
    headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  let j = await res.json();
  const st = j && (j.status || j.state);
  if (st && st !== 'succeeded' && st !== 'completed' && st !== 'done') {
    const id = j.id || j.job_id || j.jobId;
    if (!id) throw new Error('queued with no job id: ' + JSON.stringify(j).slice(0, 200));
    process.stdout.write(`  job ${id} ${st}…\n`);
    j = await pollJob(id);
  }
  // A completed job wraps the payload in `result`; unwrap so callers read one shape.
  if (j && j.result && !j.url && !j.spritesheet_url && !j.individual_frame_urls) {
    return Array.isArray(j.result) ? (j.result.length === 1 ? j.result[0] : j.result) : j.result;
  }
  return j;
}

await mkdir(STAGE, { recursive: true });

// ---- 1. the static base -----------------------------------------------------
const data = await post('/assets/image', {
  image_type: 'sprite', prompt: BASE_PROMPT, art_style: 'Anime/Manga',
  aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false,
});
const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
if (!url) throw new Error('no url in image response: ' + JSON.stringify(data).slice(0, 200));
const base = await sharp(await fetchBuf(url)).ensureAlpha()
  .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .webp({ quality: 94 }).toBuffer();
await writeFile(join(STAGE, 'doombringer_ult.webp'), base);
console.log('base -> doombringer_ult.webp');

// ---- 2. nine one-shot frames ------------------------------------------------
const anim = await post('/assets/sprite/animate', {
  initial_image: `data:image/webp;base64,${base.toString('base64')}`,
  motion_prompt: MOTION, frames: FRAMES, frame_size: -9,
  model: 'eagle', individual_frames: true, loop: false, image_type: 'sprite',
});
let bufs = [];
if (anim.spritesheet_url && anim.num_cols && anim.num_rows) {
  const sheet = await fetchBuf(anim.spritesheet_url), sm = await sharp(sheet).metadata();
  const cw = Math.floor(sm.width / anim.num_cols), ch = Math.floor(sm.height / anim.num_rows);
  for (let r = 0; r < anim.num_rows && bufs.length < FRAMES; r++)
    for (let c = 0; c < anim.num_cols && bufs.length < FRAMES; c++)
      bufs.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).webp({ quality: 94 }).toBuffer());
}
if (bufs.length < FRAMES && Array.isArray(anim.individual_frame_urls)) {
  bufs = []; for (const u of anim.individual_frame_urls.slice(0, FRAMES)) bufs.push(await fetchBuf(u));
}
if (bufs.length < FRAMES) { console.error(`ABORT: got ${bufs.length}/${FRAMES} frames`); process.exit(2); }
const frames = [];
for (let i = 0; i < FRAMES; i++) {
  frames.push(await sharp(bufs[i]).ensureAlpha().resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 94 }).toBuffer());
}

// ---- 3. the gate ------------------------------------------------------------
// Two failure modes this pipeline has actually produced, both checked rather than eyeballed.
//   MOTION: the old plate's nine frames were nearly identical — an ultimate with no beat. Measure
//           the mean absolute alpha difference between consecutive frames; a set that barely moves
//           fails.
//   DRIFT:  a set whose framing wanders makes the sword slide inside its own hitbox. Measure the
//           alpha centroid of every frame; a set whose centroid wanders far fails.
const stats = [];
for (const f of frames) {
  const { data: a, info } = await sharp(f).ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  let sx = 0, sy = 0, n = 0;
  for (let p = 0; p < a.length; p++) { if (a[p] > 24) { sx += p % info.width; sy += (p / info.width) | 0; n++; } }
  stats.push({ a, w: info.width, cx: n ? sx / n : 0, cy: n ? sy / n : 0, n });
}
let motion = 0;
for (let i = 1; i < stats.length; i++) {
  let d = 0; const A = stats[i - 1].a, B = stats[i].a;
  for (let p = 0; p < A.length; p += 7) d += Math.abs(A[p] - B[p]);
  motion += d / (A.length / 7);
}
motion /= (stats.length - 1);
const cxs = stats.map((s) => s.cx), cys = stats.map((s) => s.cy);
const drift = Math.max(Math.max(...cxs) - Math.min(...cxs), Math.max(...cys) - Math.min(...cys));
// Coverage: the blade has to be BIG in frame. The old plate's sword was ~a third of the height
// inside an orb; a set whose ink barely covers the canvas is that same mistake again.
const cover = stats.reduce((s, x) => s + x.n, 0) / stats.length / (SIZE * SIZE);
const MOTION_MIN = 4, DRIFT_MAX = 46, COVER_MIN = 0.12;
console.log(`  motion ${motion.toFixed(2)} (min ${MOTION_MIN}) · drift ${drift.toFixed(1)}px (max ${DRIFT_MAX}) · coverage ${(cover * 100).toFixed(1)}% (min ${COVER_MIN * 100}%)`);
const bad = [];
if (motion < MOTION_MIN) bad.push('frames barely change — this is the old plate\'s problem again');
if (drift > DRIFT_MAX) bad.push('framing drifts — the sword would slide inside its own hitbox');
if (cover < COVER_MIN) bad.push('blade too small in frame — likely drawn inside an orb again');
if (bad.length) { console.error('REFUSING:\n  - ' + bad.join('\n  - ')); process.exit(3); }

for (let i = 0; i < FRAMES; i++) await writeFile(join(STAGE, `doombringer_ult_${i}.webp`), frames[i]);
console.log(`${FRAMES} frames staged`);

// contact sheet
const TH = 200;
const all = ['doombringer_ult.webp']; for (let i = 0; i < FRAMES; i++) all.push(`doombringer_ult_${i}.webp`);
const tiles = [];
for (let i = 0; i < all.length; i++) {
  tiles.push({ input: await sharp(join(STAGE, all[i])).resize(TH, TH, { fit: 'contain', background: { r: 22, g: 18, b: 28, alpha: 255 } }).png().toBuffer(),
               left: (i % 5) * TH, top: Math.floor(i / 5) * TH });
}
await sharp({ create: { width: TH * 5, height: TH * Math.ceil(all.length / 5), channels: 4, background: { r: 22, g: 18, b: 28, alpha: 255 } } })
  .composite(tiles).png().toFile(join(STAGE, 'contact_sheet.png'));
console.log(`staged in ${STAGE} — review contact_sheet.png, then --install`);
