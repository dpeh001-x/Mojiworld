#!/usr/bin/env node
// Ground Slam's impact (ludo.ai):
//   1) NEW static burst -> staged ground_slam.webp
//   2) 9-frame one-shot -> staged ground_slam_0..8.webp
//
//   node scripts/gen_ground_slam_fx.mjs --generate   # needs LUDO_API_KEY
//   node scripts/gen_ground_slam_fx.mjs --install    # staged -> Sprites/
//
// v0.30.x — per user: "regenerate and rework ground slam skill make it AAA grade skill simple but
// smooth looking, generate a nice animation for it as well".
//
// Two things were wrong with the old plate. It was CLIP-ART — a red-and-white cartoon star burst
// with cyan crystal shards, which is a generic "impact" sticker rather than this skill's impact —
// and its palette fought the skill's own: every particle Ground Slam throws is #ffcc55 amber and
// #aa7733 earth, and the plate was scarlet and ice-blue. It was also a single still frame on a
// skill whose whole read is a shockwave travelling outward.
//
// "Simple but smooth" is the brief, so this is authored as ONE clean idea — a hot core in a
// cracked crater with a single dust ring driven out of it — rather than a pile of shards. Amber
// and earth, matching the particles already in flight around it.
//
// THE CIRCUMFERENCE IS FEATHERED AT AUTHORING TIME. v0.30.734 had to retro-fit that onto War Cry's
// wave after the generated rings were found ending on the square edge of their own canvas; doing it
// here means this set never ships with that seam. The content is scaled into its canvas first so
// the falloff lives in empty margin rather than eating the art, and the caller draws it
// 1/CONTENT_SCALE larger to match.
import sharp from 'sharp';
import { writeFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STAGE = process.env.GS_STAGE || join(ROOT, 'scripts', '_style_pack', 'ground_slam');
const FRAMES = 9, SIZE = 768;
const CONTENT_SCALE = 0.86, FEATHER_IN = 0.80, FEATHER_OUT = 0.985;
const has = (f) => process.argv.includes(f);

const BASE_PROMPT =
  'A HEAVY GROUND-SLAM IMPACT for a 2D fantasy game, seen from a low three-quarter angle. ' +
  'One clean idea, uncluttered: a white-hot amber core low at the centre where the blow landed, ' +
  'radial cracks splitting the ground outward from it in a few bold lines, and a SINGLE smooth ' +
  'dust-and-earth shockwave ring sweeping outward around it, wide and flat like a wave running ' +
  'along the ground. A handful of small earth chunks thrown up at the edges. ' +
  'Palette: warm amber and gold at the core, dusty tan and brown earth in the ring, deep umber ' +
  'shadow. Flat 2D cartoon game sprite, bold clean shapes, smooth crisp cel shading, thick dark ' +
  'outline. Simple and readable — NOT busy, NOT cluttered, few elements. ' +
  'NO red, NO scarlet, NO ice, NO crystals, NO gems, NO blue, NO character, NO weapon, NO text, ' +
  'NO background. Centred and symmetrical. Fully TRANSPARENT background (alpha only).';

const MOTION =
  'A single ground impact played start to finish across the nine frames, with visible change in ' +
  'every frame and NO looping back. Frames 1-3: the core IGNITES white-hot and the ground cracks ' +
  'snap open outward from it. Frames 4-6: the dust ring SURGES outward, widening and flattening as ' +
  'it travels, earth chunks flung up, the core settling to deep amber. Frames 7-9: the ring THINS ' +
  'and DISPERSES into drifting dust, the cracks dimming, so the final frame is almost gone. ' +
  'CRITICAL — LOCKED FRAMING: the impact point stays at the exact same position in every frame; ' +
  'no zoom, pan, crop, drift, mirror or flip. The EXPANSION is drawn within the frame; the camera ' +
  'never moves. Keep the exact same art style, palette (amber, gold, tan, brown, umber), thick ' +
  'dark outline and fully transparent background in every frame. ' +
  'NO red, NO ice, NO crystals, NO character, NO background, NO text.';

// ---------------------------------------------------------------- install ----
if (has('--install')) {
  if (!existsSync(join(STAGE, 'ground_slam.webp'))) { console.error('nothing staged'); process.exit(1); }
  await copyFile(join(STAGE, 'ground_slam.webp'), join(ROOT, 'Sprites', 'fx', 'ground_slam.webp'));
  await mkdir(join(ROOT, 'Sprites', 'fx', 'anim'), { recursive: true });
  for (let i = 0; i < FRAMES; i++) await copyFile(join(STAGE, `ground_slam_${i}.webp`), join(ROOT, 'Sprites', 'fx', 'anim', `ground_slam_${i}.webp`));
  console.log(`installed base + ${FRAMES} frames`);
  console.log('NOW: node scripts/gen_sprite_frame_index.mjs   (nine new frames under fx/anim)');
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
  if (j && j.result && !j.url && !j.spritesheet_url && !j.individual_frame_urls) {
    return Array.isArray(j.result) ? (j.result.length === 1 ? j.result[0] : j.result) : j.result;
  }
  return j;
}

// Shrink into the canvas, then multiply alpha by a smoothstep radial falloff that reaches zero
// INSIDE the square, so no edge and no corner can ever be a hard cut.
async function featherRadial(buf) {
  const inner = Math.round(SIZE * CONTENT_SCALE);
  const padded = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp(buf).ensureAlpha().resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
                  left: Math.round((SIZE - inner) / 2), top: Math.round((SIZE - inner) / 2) }])
    .png().toBuffer();
  const { data, info } = await sharp(padded).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const c = info.width / 2, R = info.width / 2;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4;
    if (!data[i + 3]) continue;
    const d = Math.hypot(x - c, y - c) / R;
    let k;
    if (d <= FEATHER_IN) k = 1;
    else if (d >= FEATHER_OUT) k = 0;
    else { const t = (d - FEATHER_IN) / (FEATHER_OUT - FEATHER_IN); k = 1 - (t * t * (3 - 2 * t)); }
    data[i + 3] = Math.round(data[i + 3] * k);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 94 }).toBuffer();
}
const borderAlpha = async (buf) => {
  const { data, info } = await sharp(buf).ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  let s = 0, n = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++)
    if (x < 2 || y < 2 || x >= info.width - 2 || y >= info.height - 2) { s += data[y * info.width + x]; n++; }
  return s / n;
};

await mkdir(STAGE, { recursive: true });

const d0 = await post('/assets/image', { image_type: 'sprite', prompt: BASE_PROMPT, art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false });
const url = Array.isArray(d0) ? d0[0]?.url : (d0?.url || d0?.images?.[0]?.url);
if (!url) throw new Error('no url: ' + JSON.stringify(d0).slice(0, 200));
const raw = await sharp(await fetchBuf(url)).ensureAlpha().resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 94 }).toBuffer();
await writeFile(join(STAGE, 'ground_slam.webp'), await featherRadial(raw));
console.log('base -> ground_slam.webp');

const anim = await post('/assets/sprite/animate', {
  initial_image: `data:image/webp;base64,${raw.toString('base64')}`,   // animate from the UNfeathered plate
  motion_prompt: MOTION, frames: FRAMES, frame_size: -9,
  model: 'eagle', individual_frames: true, loop: false, image_type: 'sprite',
});
let bufs = [];
if (anim.spritesheet_url && anim.num_cols && anim.num_rows) {
  const sheet = await fetchBuf(anim.spritesheet_url), sm = await sharp(sheet).metadata();
  const cw = Math.floor(sm.width / anim.num_cols), ch = Math.floor(sm.height / anim.num_rows);
  for (let r = 0; r < anim.num_rows && bufs.length < FRAMES; r++)
    for (let c2 = 0; c2 < anim.num_cols && bufs.length < FRAMES; c2++)
      bufs.push(await sharp(sheet).extract({ left: c2 * cw, top: r * ch, width: cw, height: ch }).webp({ quality: 94 }).toBuffer());
}
if (bufs.length < FRAMES && Array.isArray(anim.individual_frame_urls)) {
  bufs = []; for (const u of anim.individual_frame_urls.slice(0, FRAMES)) bufs.push(await fetchBuf(u));
}
if (bufs.length < FRAMES) { console.error(`ABORT: got ${bufs.length}/${FRAMES} frames`); process.exit(2); }
const rawFrames = [];
for (const b of bufs.slice(0, FRAMES)) rawFrames.push(await sharp(b).ensureAlpha().resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 94 }).toBuffer());

// ---- the gate, measured on the RAW frames (before the feather masks the evidence) -------------
const stats = [];
for (const f of rawFrames) {
  const { data: a, info } = await sharp(f).ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  let sx = 0, sy = 0, n = 0;
  for (let p = 0; p < a.length; p++) if (a[p] > 24) { sx += p % info.width; sy += (p / info.width) | 0; n++; }
  stats.push({ a, cx: n ? sx / n : 0, cy: n ? sy / n : 0, n });
}
let motion = 0;
for (let i = 1; i < stats.length; i++) {
  let d = 0; const A = stats[i - 1].a, B = stats[i].a;
  for (let p = 0; p < A.length; p += 7) d += Math.abs(A[p] - B[p]);
  motion += d / (A.length / 7);
}
motion /= (stats.length - 1);
// Drift over frames that still hold a wave. A dispersing ring is SUPPOSED to end almost empty, and
// the centroid of a nearly-empty frame is noise — that false signal refused a good War Cry roll.
const peak = Math.max(...stats.map((s) => s.n));
const solid = stats.filter((s) => s.n >= peak * 0.25);
const drift = Math.max(Math.max(...solid.map((s) => s.cx)) - Math.min(...solid.map((s) => s.cx)),
                       Math.max(...solid.map((s) => s.cy)) - Math.min(...solid.map((s) => s.cy)));
const MOTION_MIN = 4, DRIFT_MAX = 46;
console.log(`  motion ${motion.toFixed(2)} (min ${MOTION_MIN}) · drift ${drift.toFixed(1)}px (max ${DRIFT_MAX}, over ${solid.length}/${stats.length} solid frames)`);
const bad = [];
if (motion < MOTION_MIN) bad.push('frames barely change — a still picture of an impact');
if (drift > DRIFT_MAX) bad.push('framing drifts — the impact would slide off the landing point');
if (bad.length) { console.error('REFUSING:\n  - ' + bad.join('\n  - ')); process.exit(3); }

let worstBorder = 0;
for (let i = 0; i < FRAMES; i++) {
  const out = await featherRadial(rawFrames[i]);
  worstBorder = Math.max(worstBorder, await borderAlpha(out));
  await writeFile(join(STAGE, `ground_slam_${i}.webp`), out);
}
worstBorder = Math.max(worstBorder, await borderAlpha(await sharp(join(STAGE, 'ground_slam.webp')).toBuffer()));
console.log(`  worst border alpha after feather: ${worstBorder.toFixed(2)}`);
if (worstBorder > 1) { console.error('REFUSING: the circumference is not clean.'); process.exit(4); }
console.log(`${FRAMES} frames staged`);

const TH = 200;
const all = ['ground_slam.webp']; for (let i = 0; i < FRAMES; i++) all.push(`ground_slam_${i}.webp`);
const tiles = [];
for (let i = 0; i < all.length; i++) {
  tiles.push({ input: await sharp(join(STAGE, all[i])).resize(TH, TH, { fit: 'contain', background: { r: 96, g: 100, b: 112, alpha: 255 } }).png().toBuffer(),
               left: (i % 5) * TH, top: Math.floor(i / 5) * TH });
}
await sharp({ create: { width: TH * 5, height: TH * Math.ceil(all.length / 5), channels: 4, background: { r: 96, g: 100, b: 112, alpha: 255 } } })
  .composite(tiles).png().toFile(join(STAGE, 'contact_sheet.png'));
console.log(`staged in ${STAGE} — review contact_sheet.png, then --install`);
