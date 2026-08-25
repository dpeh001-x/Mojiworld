#!/usr/bin/env node
// Gravitos IDLE: a ludo.ai breath from gravitos_0, resampled for smoothness.
// =============================================================================
// Per user: "This is not smooth at all, regenerate a fresh set with gravitos_0
// as base, ensure it is very smooth with some breathing movement".
//
// TWO EARLIER ROLLS AND WHY THEY WERE NOT SMOOTH, measured the same way each
// time (mean per-pixel change between adjacent frames, over the union of their
// silhouettes):
//
//   in-place, 9 frames, one anchor    median  82   worst/median 1.65x
//   two-pose morph, 9 sampled frames  median 211   worst/median 1.11x
//
// The morph was EVENER and much worse to watch, which is the lesson: evenness
// is not smoothness. Smoothness is small per-frame change. Nine frames spanning
// arms-down to fists-up can never be small - the motion itself is too big for
// the frame budget - so the brief "breathing" is the fix as much as the request:
// a breath is a small motion, and a small motion over nine frames is smooth.
//
// HOW THIS GETS THERE. Ludo still animates him, from gravitos_0 alone with a
// deliberately tiny motion brief. But its raw frames are independent guesses
// and jitter frame to frame, so they are not used directly: 16 frames are
// generated and the nine shipped frames are RESAMPLED off them with a Gaussian
// kernel in time. Each output frame is a weighted blend of the raw frames
// around its point in the loop, which suppresses the high-frequency guess-noise
// and leaves the low-frequency motion - exactly the breath. Frame 0 is
// gravitos_0 itself, unblended, since it is the base the set is built from.
//
// Blending only works because the motion is small; on the arms-down-to-fists-up
// morph it would have ghosted badly. That constraint is the same one that makes
// the result smooth, so it is not a coincidence.
//
//   node scripts/gen_gravitos_idle_ludo.mjs             # generate + gate
//   node scripts/gen_gravitos_idle_ludo.mjs --install   # ...and install if gates pass
//   node scripts/gen_gravitos_idle_ludo.mjs --from-cache [--install]
//   flags: --sigma=<n> widen/narrow the time kernel (default 0.85 raw frames)
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = join(root, 'Sprites/bosses/idle/gravitos_0.webp');
const RAW = join(root, 'scripts', '_style_pack', 'anim_regen', 'gravitos_idle_ludo', 'raw');
const OUT = join(root, 'scripts', '_style_pack', 'anim_regen', 'gravitos_idle_ludo');
const DEST = join(root, 'Sprites/bosses/idle');
const argv = process.argv.slice(2);
const INSTALL = argv.includes('--install');
const FROM_CACHE = argv.includes('--from-cache');
const SIGMA = +((argv.find((a) => a.startsWith('--sigma=')) || '').split('=')[1]) || 0.7;

const RAW_N = 16, FRAMES = 9, FOOT_Y = 1503;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const key = process.env.LUDO_API_KEY;

const MOTION = 'the cosmic-energy golem takes ONE deep breath and CLENCHES UP, in place. Across the sequence he '
  + 'draws breath and tenses: the chest swells clearly and the shoulders ride up and bunch, the back and neck tighten, '
  + 'both fists close and grip harder, the arm and leg muscles flex and harden, and the star core in his chest flares '
  + 'brighter as he braces. The motion is CLEARLY VISIBLE - a real inhale and a real clench, not a twitch - and it runs '
  + 'CONTINUOUSLY IN ONE DIRECTION: every frame is slightly more tensed than the one before it, building to the hardest '
  + 'clench in the final frame. He never relaxes back partway and never repeats. He stays PLANTED and does NOT change '
  + 'pose or stance: the arms stay where they are and do not raise, lower, cross or swing, the feet never move, he does '
  + 'not step, walk, lean, turn, jump or drift. It is ONE single connected body with EXACTLY two arms and two legs '
  + 'attached to the torso; do NOT add, duplicate, split, mirror or detach any limbs. Keep the EXACT same left/right '
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

async function box(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let t = -1, b = -1, l = W, r = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] > 16) { if (t < 0) t = y; b = y; if (x < l) l = x; if (x > r) r = x; }
  }
  return t < 0 ? null : { W, H, t, b, l, r, w: r - l + 1, h: b - t + 1 };
}

// ---------- 1. generate ----------
await mkdir(RAW, { recursive: true });
if (!FROM_CACHE) {
  if (!key) { console.error('LUDO_API_KEY is not set'); process.exit(2); }
  const small = await sharp(await readFile(BASE)).resize(940, 940, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  console.log('asking ludo for ' + RAW_N + ' breathing frames from idle/gravitos_0.webp ...');
  const data = await post('/assets/sprite/animate', {
    initial_image: 'data:image/png;base64,' + small.toString('base64'),
    motion_prompt: MOTION,
    frames: RAW_N, frame_size: -9, model: 'eagle',
    individual_frames: true, loop: false, image_type: 'sprite',
  });
  let bufs = [];
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
    const cw = Math.floor(meta.width / data.num_cols), ch = Math.floor(meta.height / data.num_rows);
    for (let r = 0; r < data.num_rows && bufs.length < RAW_N; r++)
      for (let c = 0; c < data.num_cols && bufs.length < RAW_N; c++)
        bufs.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
  }
  if (bufs.length < RAW_N && (data.individual_frame_urls || []).length >= RAW_N) {
    bufs = []; for (let i = 0; i < RAW_N; i++) bufs.push(await fetchBuf(data.individual_frame_urls[i]));
  }
  if (bufs.length < RAW_N) { console.error('ludo returned ' + bufs.length + ' usable frames'); process.exit(1); }
  for (let i = 0; i < RAW_N; i++) await writeFile(join(RAW, 'b_' + i + '.png'), bufs[i]);
  console.log('  got ' + bufs.length + ' frames');
} else {
  console.log('re-using the cached roll in ' + RAW);
}

// ---------- 2. rebase every raw frame onto the boss canvas ----------
const baseBuf = await readFile(BASE);
const BB = await box(baseBuf);
const meta = await sharp(baseBuf).metadata();
const CW = meta.width, CH = meta.height;
const CX = Math.round((BB.l + BB.r) / 2);
console.log('\ncanvas ' + CW + 'x' + CH + '   base figure ' + BB.w + 'x' + BB.h + '   feet ' + BB.b);

const plant = async (buf, b) => {
  const k = BB.h / b.h;                       // one stature for the whole set
  const w = Math.max(1, Math.round(b.w * k)), h = Math.max(1, Math.round(b.h * k));
  const cropped = await sharp(buf).extract({ left: b.l, top: b.t, width: b.w, height: b.h })
    .resize({ width: w, height: h, fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
  const left = Math.round(CX - w / 2), top = FOOT_Y - h + 1;
  if (left < 0 || top < 0 || left + w > CW || top + h > CH) throw new Error('falls off the canvas');
  return sharp({ create: { width: CW, height: CH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: cropped, left, top }]).png().toBuffer();
};

const planted = [];
for (let i = 0; i < RAW_N; i++) {
  const p = join(RAW, 'b_' + i + '.png');
  if (!(await exists(p))) { console.error('missing ' + p); process.exit(1); }
  const raw = await readFile(p);
  const b = await box(raw);
  if (!b) { console.error('raw frame ' + i + ' is empty'); process.exit(1); }
  planted.push(await plant(raw, b));
}
const basePlanted = await plant(baseBuf, BB);

// ---------- 3. resample nine frames with a Gaussian kernel in time ----------
// Each output frame is a weighted blend of the raw frames around its point in
// the loop. That is the smoothing: the model's per-frame guess-noise averages
// out, the slow breath survives.
const rawPix = await Promise.all(planted.map(async (b) => (await sharp(b).ensureAlpha().raw().toBuffer())));
const px = CW * CH * 4;
const outBufs = [];
for (let i = 0; i < FRAMES; i++) {
  if (i === 0) { outBufs.push(await sharp(basePlanted).webp({ quality: 92, alphaQuality: 100 }).toBuffer()); continue; }
  const centre = (i / (FRAMES - 1)) * (RAW_N - 1);
  const acc = new Float32Array(px);
  let wsum = 0;
  for (let d = -3; d <= 3; d++) {
    const idx = Math.max(0, Math.min(RAW_N - 1, Math.round(centre) + d));
    const dist = Math.abs((Math.round(centre) + d) - centre);
    const w = Math.exp(-(dist * dist) / (2 * SIGMA * SIGMA));
    if (w < 0.02) continue;
    const src = rawPix[idx];
    for (let k = 0; k < px; k++) acc[k] += src[k] * w;
    wsum += w;
  }
  const out = Buffer.allocUnsafe(px);
  for (let k = 0; k < px; k++) out[k] = Math.max(0, Math.min(255, Math.round(acc[k] / wsum)));
  outBufs.push(await sharp(out, { raw: { width: CW, height: CH, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toBuffer());
}

await mkdir(OUT, { recursive: true });
const rows = [];
for (let i = 0; i < FRAMES; i++) {
  await writeFile(join(OUT, 'gravitos_' + i + '.webp'), outBufs[i]);
  const b = await box(outBufs[i]);
  rows.push({ i, t: b.t, b: b.b, h: b.h, w: b.w });
}
console.log('\n frame   top  bottom  height  width');
for (const r of rows) {
  console.log('   ' + r.i + '    ' + String(r.t).padStart(5) + '  ' + String(r.b).padStart(6)
    + '  ' + String(r.h).padStart(6) + '  ' + String(r.w).padStart(6) + (r.i === 0 ? '   <- gravitos_0, unblended' : ''));
}

// ---------- 4. gate + smoothness, including the ping-pong turnaround ----------
const small = await Promise.all(outBufs.map(async (b) => (await sharp(b).resize(414, 376, { fit: 'fill' }).ensureAlpha().raw().toBuffer())));
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
const worst = Math.max(...jumps);
console.log('\nadjacent-frame change: ' + jumps.map((j) => j.toFixed(0)).join(', '));
console.log('  median ' + med.toFixed(1) + '   worst ' + worst.toFixed(1) + '   worst/median ' + (worst / med).toFixed(2) + 'x');
console.log('  for reference: in-place roll median 82, two-pose morph median 211');

const fails = [];
const feet = [...new Set(rows.map((r) => r.b))];
if (feet.length !== 1) fails.push('feet drift: ' + feet.join(','));
if (jumps.some((j) => j === 0)) fails.push('a pair of adjacent frames is identical');
for (const r of rows) if (r.t < 4) fails.push('frame ' + r.i + ' touches the top edge');
console.log('\nfeet pinned  : ' + (feet.length === 1 ? 'yes, bottom=' + feet[0] : 'NO'));
console.log('frame 0      : gravitos_0, unblended');
if (fails.length) {
  console.log('\nGATE FAILED:');
  for (const f of [...new Set(fails)]) console.log('   ' + f);
  process.exit(1);
}
console.log('\ngates passed.');
if (INSTALL) {
  for (let i = 0; i < FRAMES; i++) await writeFile(join(DEST, 'gravitos_' + i + '.webp'), outBufs[i]);
  console.log('installed -> Sprites/bosses/idle/gravitos_0..8.webp');
} else {
  console.log('candidates in ' + OUT + '  (re-run with --install)');
}
