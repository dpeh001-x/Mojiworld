#!/usr/bin/env node
// Gravitos IDLE: a ludo.ai MORPH between two chosen poses, both pinned.
// =============================================================================
// Per user: "can you do a smoother animation, 1st image will be the 1st frame,
// 2nd image will be the 4th frame, regenerate the idle animation accordingly".
//
//   frame 1 (index 0) = Sprites/bosses/gravitos.webp        arms down, fists at the hips
//   frame 4 (index 3) = Sprites/bosses/attack/gravitos.webp fists up, planted
//
// WHY THIS IS A MORPH AND THE LAST ONE WAS NOT. The first roll used
// animateSprite with a single image, which is what every in-place idle runner
// here does - and generate_walk_morph.mjs records exactly why that is limited:
// "In-place animateSprite (no final_image) can only SWAY". With one anchor the
// model invents nine independent poses, so adjacent frames jitter: measured on
// that roll, frame-to-frame change ranged 22 to 116 with no relation to
// neighbours, and pinning a pristine pose into the middle of it cost a step
// 1.65x the median.
//
// Two anchors change the instrument. initial_image + final_image makes the
// model interpolate ONE continuous motion between them, which is precisely the
// morph the other runners warn about when they do NOT want it
// ("a final_image makes the model morph and rescale") - and precisely what is
// wanted when the request is "get from this pose to that one".
//
// SO: one 16-frame morph is generated base -> fists-up, and the nine idle
// frames are SAMPLED from it - out along the morph to the fists-up pose at
// index 3, then back down toward the base by index 8. Every frame therefore
// comes from the same continuous motion instead of nine separate guesses, and
// the two anchors are composited exactly rather than hoped for.
//
// Idle PING-PONGS in the engine (0->8->0), so ending near the base pose makes
// the turnaround read as a flex-and-settle rather than a snap.
//
//   node scripts/gen_gravitos_idle_ludo.mjs             # generate + gate
//   node scripts/gen_gravitos_idle_ludo.mjs --install   # ...and install if gates pass
//   node scripts/gen_gravitos_idle_ludo.mjs --from-cache --install
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const POSE_A = join(root, 'Sprites/bosses/gravitos.webp');          // frame 1
const POSE_B = join(root, 'Sprites/bosses/attack/gravitos.webp');   // frame 4
const RAW = join(root, 'scripts', '_style_pack', 'anim_regen', 'gravitos_idle_ludo', 'raw');
const OUT = join(root, 'scripts', '_style_pack', 'anim_regen', 'gravitos_idle_ludo');
const DEST = join(root, 'Sprites/bosses/idle');
const argv = process.argv.slice(2);
const INSTALL = argv.includes('--install');
const FROM_CACHE = argv.includes('--from-cache');

const MORPH_N = 16;          // perfect square the API accepts; fine granularity to sample from
const FRAMES = 9, A_AT = 0, B_AT = 3, FOOT_Y = 1503;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const key = process.env.LUDO_API_KEY;

const MOTION = 'the cosmic-energy golem braces in place. His arms travel STRAIGHT UP from hanging at his sides '
  + 'into a raised guard with both fists closed in front of him, and they move CONTINUOUSLY in one direction across the '
  + 'sequence - each frame is slightly further along that same raise than the one before it, never going back down and '
  + 'never overshooting. He NEVER folds or crosses his arms over his chest, never tucks a hand behind his back, and never '
  + 'brings the two fists together. The elbows stay out to the sides. He stays PLANTED on the same spot: the feet never '
  + 'leave the ground and the legs do not change stance. It is ONE single connected body with EXACTLY two arms and two '
  + 'legs attached to the torso; do NOT add, duplicate, split, mirror or detach any limbs. Keep the EXACT same left/right '
  + 'facing as the source. He stays the EXACT same size and position in frame: no zoom, no camera move, nothing cropped.';

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
const fetchBuf = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };
const uri = async (p) => 'data:image/png;base64,' + (await sharp(await readFile(p))
  .resize(940, 940, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');

async function box(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let t = -1, b = -1, l = W, r = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] > 16) { if (t < 0) t = y; b = y; if (x < l) l = x; if (x > r) r = x; }
  }
  return t < 0 ? null : { W, H, t, b, l, r, w: r - l + 1, h: b - t + 1 };
}

// ---------- 1. one continuous morph ----------
await mkdir(RAW, { recursive: true });
if (!FROM_CACHE) {
  if (!key) { console.error('LUDO_API_KEY is not set'); process.exit(2); }
  console.log('asking ludo to morph ' + MORPH_N + ' frames: gravitos.webp -> attack/gravitos.webp ...');
  const data = await post('/assets/sprite/animate', {
    initial_image: await uri(POSE_A),
    final_image: await uri(POSE_B),
    motion_prompt: MOTION,
    frames: MORPH_N, frame_size: -9, model: 'eagle',
    individual_frames: true, loop: false, image_type: 'sprite',
  });
  let bufs = [];
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
    const cw = Math.floor(meta.width / data.num_cols), ch = Math.floor(meta.height / data.num_rows);
    for (let r = 0; r < data.num_rows && bufs.length < MORPH_N; r++)
      for (let c = 0; c < data.num_cols && bufs.length < MORPH_N; c++)
        bufs.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
  }
  if (bufs.length < MORPH_N && (data.individual_frame_urls || []).length >= MORPH_N) {
    bufs = []; for (let i = 0; i < MORPH_N; i++) bufs.push(await fetchBuf(data.individual_frame_urls[i]));
  }
  if (bufs.length < MORPH_N) { console.error('ludo returned ' + bufs.length + ' usable frames'); process.exit(1); }
  for (let i = 0; i < MORPH_N; i++) await writeFile(join(RAW, 'morph_' + i + '.png'), bufs[i]);
  console.log('  got ' + bufs.length + ' morph frames');
} else {
  console.log('re-using the cached morph in ' + RAW);
}

// ---------- 2. sample the nine idle frames off the morph ----------
// out to the fists-up pose by index 3, then back down toward the base by 8, so
// the engine's ping-pong turnaround settles instead of snapping.
const T = [0, 1 / 3, 2 / 3, 1, 0.86, 0.66, 0.45, 0.26, 0.10];
const bufA = await readFile(POSE_A), bufB = await readFile(POSE_B);
const A = await box(bufA), B = await box(bufB);
const meta = await sharp(bufA).metadata();
const CW = meta.width, CH = meta.height;
const CX = Math.round((B.l + B.r) / 2);      // centre on the braced pose
const TARGET_H = B.h;                         // one stature for the whole set
console.log('\ncanvas ' + CW + 'x' + CH + '   pose A ' + A.w + 'x' + A.h + '   pose B ' + B.w + 'x' + B.h);

const plant = async (buf, srcBox) => {
  const k = TARGET_H / srcBox.h;
  const w = Math.max(1, Math.round(srcBox.w * k)), h = Math.max(1, Math.round(srcBox.h * k));
  const cropped = await sharp(buf).extract({ left: srcBox.l, top: srcBox.t, width: srcBox.w, height: srcBox.h })
    .resize({ width: w, height: h, fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
  const left = Math.round(CX - w / 2), top = FOOT_Y - h + 1;
  if (left < 0 || top < 0 || left + w > CW || top + h > CH) throw new Error('falls off the canvas');
  return sharp({ create: { width: CW, height: CH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: cropped, left, top }]).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
};

await mkdir(OUT, { recursive: true });
const rows = [];
for (let i = 0; i < FRAMES; i++) {
  let out, from;
  if (i === A_AT) { out = await plant(bufA, A); from = 'pose A, composited'; }
  else if (i === B_AT) { out = await plant(bufB, B); from = 'pose B, composited'; }
  else {
    const idx = Math.max(0, Math.min(MORPH_N - 1, Math.round(T[i] * (MORPH_N - 1))));
    const p = join(RAW, 'morph_' + idx + '.png');
    if (!(await exists(p))) { console.error('missing ' + p); process.exit(1); }
    const raw = await readFile(p);
    const R = await box(raw);
    if (!R) { console.error('morph frame ' + idx + ' is empty'); process.exit(1); }
    out = await plant(raw, R);
    from = 'morph ' + idx + '/' + (MORPH_N - 1) + '  (t=' + T[i].toFixed(2) + ')';
  }
  await writeFile(join(OUT, 'gravitos_' + i + '.webp'), out);
  const bx = await box(out);
  rows.push({ i, from, t: bx.t, b: bx.b, h: bx.h, w: bx.w });
}

console.log('\n frame   source                       top  bottom  height  width');
for (const r of rows) {
  console.log('   ' + r.i + '    ' + r.from.padEnd(26) + String(r.t).padStart(5) + '  ' + String(r.b).padStart(6)
    + '  ' + String(r.h).padStart(6) + '  ' + String(r.w).padStart(6));
}

// ---------- 3. gate + smoothness ----------
const bufs = [];
for (let i = 0; i < FRAMES; i++) bufs.push(await readFile(join(OUT, 'gravitos_' + i + '.webp')));
const small = await Promise.all(bufs.map(async (b) => (await sharp(b).resize(414, 376, { fit: 'fill' }).ensureAlpha().raw().toBuffer())));
const diff = (a, b) => {
  let s = 0, n = 0;
  for (let k = 0; k < a.length; k += 4) {
    const aa = a[k + 3], bb = b[k + 3];
    if (aa > 16 || bb > 16) { s += Math.abs(aa - bb) + Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2]); n++; }
  }
  return n ? s / n : 0;
};
const jumps = [];
for (let i = 0; i < FRAMES - 1; i++) jumps.push(diff(small[i], small[i + 1]));
const sorted = jumps.slice().sort((x, y) => x - y);
const med = sorted[Math.floor(sorted.length / 2)];
console.log('\nadjacent-frame change: ' + jumps.map((j) => j.toFixed(0)).join(', '));
console.log('  median ' + med.toFixed(1) + '   worst ' + Math.max(...jumps).toFixed(1)
  + '   worst/median ' + (Math.max(...jumps) / med).toFixed(2) + 'x');

const fails = [];
const feet = [...new Set(rows.map((r) => r.b))];
if (feet.length !== 1) fails.push('feet drift: ' + feet.join(','));
if (jumps.some((j) => j === 0)) fails.push('a pair of adjacent frames is identical');
for (const r of rows) {
  if (r.t < 4) fails.push('frame ' + r.i + ' touches the top edge');
  if (Math.round(CX - r.w / 2) < 4) fails.push('frame ' + r.i + ' touches the left edge');
}
console.log('\nfeet pinned          : ' + (feet.length === 1 ? 'yes, bottom=' + feet[0] : 'NO'));
console.log('frame 1 is pose A    : ' + (rows[A_AT].h === TARGET_H));
console.log('frame 4 is pose B    : ' + (rows[B_AT].h === B.h && rows[B_AT].w === B.w));
if (fails.length) {
  console.log('\nGATE FAILED:');
  for (const f of [...new Set(fails)]) console.log('   ' + f);
  process.exit(1);
}
console.log('\ngates passed.');
if (INSTALL) {
  for (let i = 0; i < FRAMES; i++) await writeFile(join(DEST, 'gravitos_' + i + '.webp'), bufs[i]);
  console.log('installed -> Sprites/bosses/idle/gravitos_0..8.webp');
} else {
  console.log('candidates in ' + OUT + '  (re-run with --install)');
}
