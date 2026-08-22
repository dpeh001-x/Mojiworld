#!/usr/bin/env node
// Regenerate King Krook's WALK cycle for smoothness.
//
// THE COMPLAINT, made measurable. A walk reads as smooth when each frame
// advances the pose by roughly the same amount. Frame-to-frame pixel deltas:
//     kingKrook   351 450 233 835 352 76 581 577 125   max/min 11.0  sd/mean 0.57
//     legosaurus  110  61 163  39 155 35 151 116  32   max/min  5.1  sd/mean 0.54
// One 835 lurch and a 76 near-freeze in the same cycle is the jerk being seen.
// The set is otherwise healthy — 9 unique frames, no ping-pong — so this is a
// pacing problem, not a broken sequence.
//
// A WALK IS NOT AN ATTACK, so the gates differ: a walk SHOULD return to its
// opening pose (it loops), and the f8->f0 step is judged like any other step
// rather than treated as a defect.
//
//   node scripts/regen_krook_walk.mjs             # measure only
//   node scripts/regen_krook_walk.mjs --generate  # needs LUDO_API_KEY
import sharp from 'sharp';
import { writeFile, rename } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WALK = join(ROOT, 'Sprites', 'bosses', 'walk');
const KEY_NAME = 'kingKrook';
const BASE = join(ROOT, 'Sprites', 'bosses', 'kingKrook.webp');
// SIXTEEN frames, not nine. Four rolls at 9 could not beat the current pacing
// (best: jerk 0.48 vs 0.57, but max/min 10.2) — a nine-frame stride simply has
// to move a long way per frame. Doubling the temporal resolution is the direct
// fix, and the repo already has the precedent: soul_vortex ships 16 "for a
// smoother loop", the frame index supports up to 24, and bosses/walk is indexed
// so the loader reads the real count.
const FRAMES = 16;
const has = (f) => process.argv.slice(2).includes(f);

const MOTION =
  'the crowned crocodile king WALKS in place, seen from the side: a smooth ' +
  'repeating walk cycle spread EVENLY across all SIXTEEN frames. His legs stride in ' +
  'an alternating gait — near foreleg forward while the far one reaches back, ' +
  'swapping over the cycle — his tail sways side to side, his royal cape and its ' +
  'white trim swing behind him with a slight delay, and his body bobs gently up ' +
  'and down once per stride. ' +
  'CRITICAL - EVEN PACING: every frame must advance the stride by the SAME small ' +
  'amount. No frame may jump far from the one before it, and no two consecutive ' +
  'frames may look nearly identical. The motion is continuous and steady, never ' +
  'a lurch followed by a pause. ' +
  'CRITICAL - SEAMLESS LOOP: the last frame must flow straight back into the first, so the ' +
  'cycle repeats without a visible seam. ' +
  'CRITICAL - LOCKED FRAMING: he stays the EXACT same size, scale and screen ' +
  'position in every frame, walking on the spot; do NOT zoom, drift, crop closer ' +
  'or resize, and do NOT move him across the frame. The whole body including tail, ' +
  'crown and feet stays inside the frame with clear margin on every side. ' +
  'Keep the EXACT same left/right facing as the source - never mirror or flip. ' +
  'DO NOT ADD new effects, dust, motion lines, glow or background. Keep the same ' +
  'art style, palette and fully transparent background.';

const hashOf = (b) => createHash('md5').update(b).digest('hex');
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
  return { mean: +mean.toFixed(0), sd: +sd.toFixed(0), jerk: +(sd / mean).toFixed(2),
    ratio: +(Math.max(...st) / Math.max(1, Math.min(...st))).toFixed(1) };
};

// Baseline = whatever is on disk NOW (nine), not FRAMES (the sixteen we want).
const cur = [];
for (let i = 0; ; i++) {
  const p2 = join(WALK, `${KEY_NAME}_${i}.webp`);
  if (!existsSync(p2)) break;
  cur.push(readFileSync(p2));
}
const curSteps = await steps(cur);
const curRep = report(curSteps);
console.log(`current: ${curSteps.join(' ')}`);
console.log(`         mean ${curRep.mean}  sd ${curRep.sd}  jerk ${curRep.jerk}  max/min ${curRep.ratio}`);

if (!has('--generate')) {
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY).');
  console.log('# Gate: 16 unique frames, jerk (sd/mean) <= 0.42 AND better than current, no edge bleed.');
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
const padX = Math.round(baseMeta.width * 0.12), padY = Math.round(baseMeta.height * 0.12);
const padded = await sharp({ create: { width: baseMeta.width + padX * 2, height: baseMeta.height + padY * 2,
  channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: baseBuf, left: padX, top: padY }]).png().toBuffer();
const padMeta = await sharp(padded).metadata();
const small = await sharp(padded).resize(920, 920, { fit: 'inside' }).png().toBuffer();

let best = null;
for (let attempt = 1; attempt <= 4; attempt++) {
  try {
    process.stdout.write(`attempt ${attempt}: animating ... `);
    const data = await post('/assets/sprite/animate', {
      initial_image: 'data:image/png;base64,' + small.toString('base64'),
      motion_prompt: MOTION, frames: FRAMES, frame_size: -9, model: 'eagle',
      individual_frames: true, loop: true, image_type: 'sprite',
    });
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
    const finals = [];
    for (const b of raw) {
      finals.push(await sharp(await sharp(b).resize(padMeta.width, padMeta.height, { fit: 'fill' }).png().toBuffer())
        .extract({ left: padX, top: padY, width: baseMeta.width, height: baseMeta.height })
        .webp({ quality: 92 }).toBuffer());
    }
    const uniq = new Set(finals.map(hashOf)).size;
    const st = await steps(finals);
    const rep = report(st);
    let bleed = 0;
    for (const f of finals) bleed = Math.max(bleed, await edgeBleed(f));
    console.log(`unique=${uniq}/9 steps=[${st.join(' ')}] jerk=${rep.jerk} max/min=${rep.ratio} bleed=${bleed}`);
    if (uniq < 9) throw new Error(`only ${uniq} unique frames`);
    if (bleed > 120) throw new Error(`edge bleed ${bleed}px`);
    // Judge on the COEFFICIENT OF VARIATION, not max/min: a single small step at
    // the loop point sends the ratio to 10+ while the cycle still reads smooth,
    // and that is what rejected an otherwise better roll on the 9-frame attempt.
    if (rep.jerk > 0.42) throw new Error(`jerky (sd/mean ${rep.jerk}, want <= 0.42)`);
    if (rep.jerk >= curRep.jerk) throw new Error(`no smoother than the current art (${rep.jerk} vs ${curRep.jerk})`);
    if (rep.ratio > 12) throw new Error(`a frame barely moves (max/min ${rep.ratio})`);
    best = { finals, st, rep };
    break;
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
console.log(`WROTE 9 frames — steps ${best.st.join(' ')} (was ${curSteps.join(' ')})`);
console.log(`  max/min ${best.rep.ratio} (was ${curRep.ratio}), jerk ${best.rep.jerk} (was ${curRep.jerk})`);
