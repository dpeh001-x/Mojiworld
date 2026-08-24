#!/usr/bin/env node
// Give Gravitos an actual WALK.
//
// THE COMPLAINT: "gravitos walk ... looks like he is walking backwards."
//
// THE MEASUREMENT. He does not walk at all. Track each foot's horizontal
// position relative to the torso across the nine frames (160px normalised):
//
//   frame   0      1     2    3     4      5      6      7      8
//   left  -16.5 -16.9   -    -    -11.5 -14.3 -17.9 -16.5 -16.6
//   right  20.0  19.1   -    -     22.6  22.9  18.6  20.1  19.9
//
// Both feet sit at a FIXED offset in every frame where they resolve apart -
// 6.5px and 4.3px of travel over a whole cycle, against 13.7/22.2 for King
// Krook. Frames 2 and 3 are the only change: both legs close together at once.
// So this is a stance-width pulse with the feet planted, not a stride. Nothing
// ever swings through. A figure translating across the screen on planted feet
// reads as sliding, and the close-together frames read as a shuffle backwards.
//
// THE GATE therefore measures a stride directly rather than smoothness: each
// foot must actually travel relative to the torso, and the stance must open and
// close as it does. A roll that is merely pretty is refused.
//
//   node scripts/regen_gravitos_walk.mjs             # measure only
//   node scripts/regen_gravitos_walk.mjs --generate  # needs LUDO_API_KEY
import sharp from 'sharp';
import { writeFile, rename } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WALK = join(ROOT, 'Sprites', 'bosses', 'walk');
const KEY_NAME = process.env.WALK_KEY || 'gravitos';
const BASE = join(ROOT, 'Sprites', 'bosses', `${KEY_NAME}.webp`);
const FRAMES = 9;
const has = (f) => process.argv.slice(2).includes(f);

// Thresholds calibrated against the sets that DO read as walks (kingKrook
// 13.7/22.2/14.0, legosaurus 17.4/15.5/13.5, towerSovereign 9.8/19.6/25.2)
// versus the ones that do not (gravitos 6.5/4.3/3.2, gravitos3 2.3/4.1/2.5).
const MIN_FOOT_TRAVEL = 9;   // px at 160px normalised, best foot
const MIN_GAP_SPREAD  = 9;   // stance must open and close

const MOTION =
  'the armoured cosmic titan WALKS FORWARD in place, seen from the front-three-' +
  'quarter: a full repeating WALK CYCLE across all NINE frames. ' +
  'CRITICAL - HE MUST TAKE REAL STEPS. One leg LIFTS CLEAR OFF THE GROUND, the ' +
  'knee bends and swings FORWARD past the standing leg, the foot plants ahead of ' +
  'him, and then the other leg lifts and swings through in turn - left, right, ' +
  'left, alternating over the cycle. At every moment one foot is planted and the ' +
  'other is somewhere in its swing. His arms swing in opposition to his legs and ' +
  'his body rises and falls once per step. ' +
  'CRITICAL - HE MUST NOT SHUFFLE. Do NOT keep both feet planted on the ground. ' +
  'Do NOT merely widen and narrow his stance in place. Do NOT slide, glide, hover ' +
  'or float. The feet must clearly leave and meet the ground in turn. ' +
  'CRITICAL - EVEN PACING: every frame advances the stride by the same small ' +
  'amount; no lurch, no two consecutive frames that look alike. ' +
  'CRITICAL - SEAMLESS LOOP: the ninth frame flows straight back into the first. ' +
  'CRITICAL - LOCKED FRAMING: he stays the EXACT same size, scale and screen ' +
  'position in every frame, walking on the spot; do NOT zoom, drift, crop closer ' +
  'or resize, and do NOT move him across the frame. The whole body including the ' +
  'shoulder spikes and both feet stays inside the frame with clear margin on ' +
  'every side. Keep the EXACT same left/right facing as the source - never mirror ' +
  'or flip. DO NOT ADD new effects, dust, motion lines, glow or background. Keep ' +
  'the same art style, deep blue and cyan palette, the white chest star, and a ' +
  'fully transparent background.';

const hashOf = (b) => createHash('md5').update(b).digest('hex');

// What the player will actually see. A set that strides gets re-timed by
// gen_boss_walk_timing.mjs, so judging a roll on its RAW pacing is judging
// something that never reaches the screen. Apply the same clamp-and-normalise
// and report the cv that survives it.
function playedCv(step) {
  const MIN_W = 0.45, MAX_W = 2.2;
  const mean = step.reduce((a, b) => a + b, 0) / step.length;
  const w = step.map((x) => Math.max(MIN_W, Math.min(MAX_W, x / mean)));
  const sum = w.reduce((a, b) => a + b, 0);
  const norm = w.map((x) => x * step.length / sum);
  const v = step.map((x, i) => x / norm[i]);
  const m2 = v.reduce((a, b) => a + b, 0) / v.length;
  return +(Math.sqrt(v.reduce((a, b) => a + (b - m2) ** 2, 0) / v.length) / m2).toFixed(2);
}


// --- containment by construction -------------------------------------------
// The model re-frames: it zooms and drifts the figure to fill the canvas it is
// handed, so cropping the padding back off slices through whatever it moved
// outward. Every roll so far failed on that, not on the motion. So do not crop
// to a fixed box - REFIT.
//
// Take the union of the content boxes across ALL returned frames, apply ONE
// scale and ONE offset to that union, and place it so the figure stands the
// same height and on the same ground line as the source sprite. A single shared
// transform keeps every frame's motion relative to the others intact (per-frame
// fitting would squash a raised leg back down and destroy the walk), and the
// union fitting inside the canvas makes edge bleed impossible rather than
// unlikely.
async function contentBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * C + 3] > 24) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, W, H };
}
async function refit(raw, srcBox, outW, outH) {
  const boxes = [];
  for (const b of raw) { const bx = await contentBox(b); if (!bx) throw new Error('a frame came back empty'); boxes.push(bx); }
  const U = {
    x: Math.min(...boxes.map((b) => b.x)), y: Math.min(...boxes.map((b) => b.y)),
    W: boxes[0].W, H: boxes[0].H,
  };
  U.w = Math.max(...boxes.map((b) => b.x + b.w)) - U.x;
  U.h = Math.max(...boxes.map((b) => b.y + b.h)) - U.y;
  // Height is the stable reference - a walk does not make him taller - then
  // clamp so the union still fits the canvas with a margin either side.
  const scale = Math.min(srcBox.h / U.h, (outW * 0.96) / U.w, (outH * 0.98) / U.h);
  const dw = Math.max(1, Math.round(U.w * scale)), dh = Math.max(1, Math.round(U.h * scale));
  const cx = srcBox.x + srcBox.w / 2, bottom = srcBox.y + srcBox.h;
  const dx = Math.max(0, Math.min(outW - dw, Math.round(cx - dw / 2)));
  const dy = Math.max(0, Math.min(outH - dh, Math.round(bottom - dh)));
  const out = [];
  for (const b of raw) {
    const cropped = await sharp(b).extract({ left: U.x, top: U.y, width: U.w, height: U.h })
      .resize(dw, dh, { fit: 'fill' }).png().toBuffer();
    out.push(await sharp({ create: { width: outW, height: outH, channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: cropped, left: dx, top: dy }]).webp({ quality: 92 }).toBuffer());
  }
  return { finals: out, scale: +scale.toFixed(3), placed: `${dw}x${dh}@${dx},${dy}` };
}


// --- the stride measurement -------------------------------------------------
// Find the two feet in the bottom band of the figure and report how far each
// travels relative to the TORSO centroid over the cycle. Frames where the feet
// merge into one blob are excluded: counting a merge as "both feet jumped to
// the middle" scores a set with zero foot travel as a stride, which is exactly
// how this set slipped through the first time.
async function strideOf(bufs) {
  const W = 160, H = 160, L = [], R = [], gaps = [];
  for (const buf of bufs) {
    const { data } = await sharp(buf).resize(W, H, { fit: 'fill' }).ensureAlpha()
      .raw().toBuffer({ resolveWithObject: true });
    const A = (x, y) => data[(y * W + x) * 4 + 3];
    let minY = H, maxY = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y) > 128) {
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (maxY <= minY) continue;
    let tx = 0, tn = 0; const tb = minY + (maxY - minY) * 0.4;
    for (let y = minY; y <= tb; y++) for (let x = 0; x < W; x++) if (A(x, y) > 128) { tx += x; tn++; }
    const cx = tx / tn;
    const ft = maxY - Math.max(2, Math.round((maxY - minY) * 0.10));
    const cols = [];
    for (let x = 0; x < W; x++) { let c = 0; for (let y = ft; y <= maxY; y++) if (A(x, y) > 128) c++; cols.push(c); }
    const blobs = []; let cur = null;
    for (let x = 0; x < W; x++) {
      if (cols[x] > 0) { if (!cur) cur = { m: 0, mx: 0 }; cur.m += cols[x]; cur.mx += x * cols[x]; }
      else if (cur) { blobs.push(cur); cur = null; }
    }
    if (cur) blobs.push(cur);
    const c = blobs.filter((b) => b.m >= 8).map((b) => b.mx / b.m - cx).sort((a, b) => a - b);
    if (c.length >= 2) { L.push(c[0]); R.push(c[c.length - 1]); gaps.push(c[c.length - 1] - c[0]); }
  }
  const rng = (a) => (a.length ? +(Math.max(...a) - Math.min(...a)).toFixed(1) : 0);
  const foot = Math.max(rng(L), rng(R));
  return { pairs: L.length, left: rng(L), right: rng(R), gap: rng(gaps), foot,
           stride: L.length >= 4 && foot >= MIN_FOOT_TRAVEL && rng(gaps) >= MIN_GAP_SPREAD };
}

async function steps(bufs) {
  const small = [];
  for (const b of bufs) small.push(await sharp(b).resize(96, 96, { fit: 'fill' }).ensureAlpha().raw().toBuffer());
  const out = [];
  for (let i = 0; i < small.length; i++) {
    const a = small[i], b = small[(i + 1) % small.length];
    let s = 0;
    for (let q = 0; q < a.length; q += 4) s += Math.abs(a[q] - b[q]) + Math.abs(a[q + 3] - b[q + 3]);
    out.push(Math.round(s / 1000));
  }
  return out;
}
async function edgeBleed(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const A = (x, y) => data[(y * W + x) * C + 3];
  let n = 0;
  for (let x = 0; x < W; x++) if (A(x, 0) > 200) n++;
  for (let y = 0; y < H; y++) { if (A(0, y) > 200) n++; if (A(W - 1, y) > 200) n++; }
  return n;
}
const report = (st) => {
  const mean = st.reduce((a, b) => a + b, 0) / st.length;
  const sd = Math.sqrt(st.reduce((a, b) => a + (b - mean) ** 2, 0) / st.length);
  return { jerk: +(sd / mean).toFixed(2) };
};

const cur = [];
for (let i = 0; existsSync(join(WALK, `${KEY_NAME}_${i}.webp`)); i++)
  cur.push(readFileSync(join(WALK, `${KEY_NAME}_${i}.webp`)));
const curStride = await strideOf(cur);
const curSteps = await steps(cur);
console.log(`${KEY_NAME}: ${cur.length} frames, steps ${curSteps.join(' ')}`);
console.log(`  foot travel L ${curStride.left} R ${curStride.right}, stance spread ${curStride.gap}` +
            `  ->  ${curStride.stride ? 'STRIDE' : 'NO STRIDE (planted feet, stance only)'}`);
if (!has('--generate')) {
  console.log(`\n# Re-run with --generate (needs LUDO_API_KEY).`);
  console.log(`# Gate: ${FRAMES} unique frames, foot travel >= ${MIN_FOOT_TRAVEL}px,` +
              ` stance spread >= ${MIN_GAP_SPREAD}px, no edge bleed.`);
  process.exit(0);
}

const K = process.env.LUDO_API_KEY;
if (!K) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const post = async (p, body) => {
  const r = await fetch(API + p, { method: 'POST',
    headers: { Authorization: `ApiKey ${K}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(600000), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${p} ${r.status}: ${(await r.text().catch(() => '')).slice(0, 160)}`);
  return r.json();
};
const fetchBuf = async (u) => {
  const r = await fetch(u, { signal: AbortSignal.timeout(300000) });
  if (!r.ok) throw new Error('download ' + r.status);
  return Buffer.from(await r.arrayBuffer());
};

const baseBuf = readFileSync(BASE);
const baseMeta = await sharp(baseBuf).metadata();
// Transparent margin given to the model. NOTE: raising this does NOT buy
// containment - it costs it. The model re-frames to fill whatever canvas it is
// handed, so a bigger pad just invites it to zoom, and a bigger zoom bleeds
// harder through the crop: 12% gave 335-1066px of edge bleed, 18% gave 790-973px
// AND degraded the stride (the figure gets fewer pixels to animate). Containment
// is fixed by refit() below, not here.
const PAD = Number(process.env.PAD || 0.12);
const padX = Math.round(baseMeta.width * PAD), padY = Math.round(baseMeta.height * PAD);
const padded = await sharp({ create: { width: baseMeta.width + padX * 2, height: baseMeta.height + padY * 2,
  channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: baseBuf, left: padX, top: padY }]).png().toBuffer();
const padMeta = await sharp(padded).metadata();
const small = await sharp(padded).resize(920, 920, { fit: 'inside' }).png().toBuffer();
// Where the figure stands in the source sprite: refit() puts the animation back
// at this height, on this ground line.
const srcBox = await contentBox(baseBuf);
if (!srcBox) { console.error('base sprite is empty'); process.exit(1); }

const ROLLS = Number(process.env.ROLLS || 5);
let best = null;
for (let attempt = 1; attempt <= ROLLS; attempt++) {
  try {
    process.stdout.write(`attempt ${attempt}: animating ... `);
    const data = await post('/assets/sprite/animate', {
      initial_image: 'data:image/png;base64,' + small.toString('base64'),
      motion_prompt: MOTION, frames: FRAMES, frame_size: -9, model: 'eagle',
      individual_frames: true, loop: true, image_type: 'sprite',
    });
    // Slice the SPRITESHEET, never individual_frame_urls: those square off a
    // non-square frame and the figure comes back stretched.
    let raw = [];
    if (data.spritesheet_url && data.num_cols && data.num_rows) {
      const sheet = await fetchBuf(data.spritesheet_url);
      const m = await sharp(sheet).metadata();
      const cw = Math.floor(m.width / data.num_cols), ch = Math.floor(m.height / data.num_rows);
      for (let r = 0; r < data.num_rows && raw.length < FRAMES; r++)
        for (let c = 0; c < data.num_cols && raw.length < FRAMES; c++)
          raw.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    } else {
      const urls = data.individual_frame_urls || [];
      if (urls.length < FRAMES) throw new Error('too few frames');
      for (let i = 0; i < FRAMES; i++) raw.push(await fetchBuf(urls[i]));
    }
    if (raw.length < FRAMES) throw new Error(`got ${raw.length}`);
    const fit = await refit(raw, srcBox, baseMeta.width, baseMeta.height);
    const finals = fit.finals;
    const uniq = new Set(finals.map(hashOf)).size;
    const sd2 = await strideOf(finals);
    const st = await steps(finals);
    const rep = report(st);
    let bleed = 0;
    for (const f of finals) bleed = Math.max(bleed, await edgeBleed(f));
    console.log(`unique=${uniq}/${FRAMES} foot=${sd2.foot} gap=${sd2.gap} pairs=${sd2.pairs}` +
                ` jerk=${rep.jerk} bleed=${bleed} refit=${fit.placed} x${fit.scale}`);
    if (uniq < FRAMES) throw new Error(`only ${uniq} unique frames`);
    if (bleed > 120) throw new Error(`edge bleed ${bleed}px`);
    if (!sd2.stride) throw new Error(
      `still no stride (foot travel ${sd2.foot} < ${MIN_FOOT_TRAVEL}` +
      ` or stance spread ${sd2.gap} < ${MIN_GAP_SPREAD}) — he is shuffling, not walking`);
    if (sd2.foot <= curStride.foot) throw new Error(`no more stride than the current art`);
    const score = playedCv(st);
    console.log(`         accepted — played cv ${score}` +
      (best ? ` (incumbent ${best.score})` : ''));
    // Keep rolling and keep the BEST. The first roll that merely passes the
    // gate is not the best roll available, and a walk is watched for the whole
    // fight - it is worth the extra credits to pick rather than take.
    if (!best || score < best.score) best = { finals, sd2, st, score };
  } catch (e) {
    console.log('rejected: ' + e.message);
    if (/\b402\b|credit/i.test(e.message)) { console.error('OUT OF CREDITS'); process.exit(3); }
  }
}
if (!best) { console.error('FAILED — art left untouched'); process.exit(1); }
for (let i = 0; i < FRAMES; i++) {
  const p = join(WALK, `${KEY_NAME}_${i}.webp`);
  await writeFile(p + '.tmp', best.finals[i]);
  await rename(p + '.tmp', p);
}
console.log(`WROTE ${FRAMES} frames — foot travel ${best.sd2.foot} (was ${curStride.foot}),` +
            ` stance spread ${best.sd2.gap} (was ${curStride.gap}), played cv ${best.score}`);
console.log(`  steps ${best.st.join(' ')} (was ${curSteps.join(' ')})`);
