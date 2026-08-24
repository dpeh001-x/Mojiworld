#!/usr/bin/env node
// Virga's FLIGHT loop — a best-of-N runner with a hard containment gate.
// ============================================================================
// Why this exists and the plain generator does not suffice:
//
// The first roll out of generate_zodiac_anim.mjs --states fly was unusable, and
// unusably in a way the generator cannot see. Measured on the raw frames:
//
//   frame 0  box 1278x981   border-ink 0      <- fine
//   frame 6  box 1332x1259  border-ink 729    <- wings sliced by the canvas
//   frame 7  box 1332x1127  border-ink 636
//
// Two separate failures in one set. (1) CLIPPING: the model let the wingspan run
// off the canvas on 6 of 9 frames, so the widest, most readable pose is the one
// with flat-cut wing tips. (2) SCALE DRIFT: the content box grows 981 -> 1310 px
// tall across the loop, which does not read as flight — it reads as the camera
// shoving toward her, because in-game the frame is drawn at a FIXED box, so a
// swelling content box is a swelling character.
//
// Neither is repairable after the fact. refit() below normalises scale and
// position — it can un-drift a set — but content that left the canvas is gone,
// and shrinking a clipped frame just yields a smaller flat-cut wing. So
// clipping is GATED on the raw roll, not scored, and the fix for a bad roll is
// another roll.
//
//   node scripts/regen_virgo_fly.mjs --rolls 4 --generate
//   node scripts/regen_virgo_fly.mjs --check          # grade what is on disk
// ============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const ZDIR = join(repoRoot, 'Sprites', 'bosses', 'zodiac');
const OUT = join(ZDIR, 'fly');
const FRAMES = 9;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// The prompt earns its length. "wings sweep WIDE" is what the flight read needs
// and is also exactly what pushes the art off the canvas, so every widening
// clause is paired with a containment clause, and the scale is pinned
// explicitly — the previous roll drifted 34% larger with no instruction to.
const MOTION =
  'the winged maiden (Virga the Seraph) flies: her wings beat with a slow, powerful downbeat and sweep '
  + 'open on the upstroke, her body tilts forward into the glide, and her robes and ribbons stream behind '
  + 'her, haloed in warm white-gold light. She is SOARING, clearly airborne and travelling, distinctly '
  + 'more open-winged and more powerful than a gentle hover. '
  + 'CRITICAL FRAMING RULES, these override the motion: she must stay EXACTLY the same SIZE in every '
  + 'frame - no zoom in, no zoom out, no camera push, no dolly, the figure never grows or shrinks. '
  + 'She stays CENTRED and does not drift across the frame. Her wings at their widest, and every ribbon '
  + 'and feather, must remain FULLY INSIDE the frame with clear empty margin on all four sides - nothing '
  + 'may ever touch or cross the frame edge. Keep the EXACT same left/right facing as the source, never '
  + 'mirror or flip. Same character, same colours, same costume in every frame.';

const ALPHA = 24;             // an alpha below this is not ink
const MAX_BORDER = 30;        // px of ink allowed on the 1-px canvas border
const MAX_SCALE_DRIFT = 0.16; // spread of the BODY height across the set

// PAD. Five straight rolls were gated, and the failures came in two flavours
// that are really one:
//
//   r1 border=148 drift=0.087    r2 border=8   drift=0.234
//   r3 border=194 drift=0.183    r4 border=351 drift=0.179
//   r5 border=233 drift=0.078
//
// Either the wings ran off the canvas, or the figure shrank to make room for
// them. That is not five bad rolls, it is one impossible brief: the source art
// already fills its canvas, and "sweep the wings WIDE" has nowhere to go. So
// the input is composited smaller onto a same-size transparent canvas before it
// is sent. frame_size:-9 (True Size) locks the output framing to the input's,
// so the margin travels with it, and refit() scales the figure back up at the
// end — the padding costs nothing in final resolution, it only buys the model
// somewhere to put the wingspan.
const PAD = Number(arg('--pad') || 0.28);

async function boxOf(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let x0 = w, y0 = h, x1 = -1, y1 = -1, border = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * c + 3] <= ALPHA) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border++;
    }
  }
  if (x1 < 0) return null;
  const b = { w, h, x0, y0, x1, y1, bw: x1 - x0 + 1, bh: y1 - y0 + 1, border };
  b.coreH = coreH(b, data, w, h, c);
  return b;
}

// Scale drift has to be measured on the BODY, not on the bounding box.
//
// The first version of this gate used the box diagonal, and it was measuring
// the wrong thing in the most misleading way available: a wing sweeping open
// grows the box, so the metric could not tell "she is flying" from "the camera
// is pushing in" — and flying is the entire brief. coreH looks only at the
// middle 22% of the width, which is torso and head on every frame; wings leave
// it, zoom does not.
function coreH(b, data, w, h, c) {
  const cx = (b.x0 + b.x1) / 2, half = Math.max(2, Math.round((b.x1 - b.x0 + 1) * 0.11));
  const lo = Math.max(0, Math.round(cx - half)), hi = Math.min(w - 1, Math.round(cx + half));
  let y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = lo; x <= hi; x++) {
    if (data[(y * w + x) * c + 3] > ALPHA) { if (y < y0) y0 = y; if (y > y1) y1 = y; break; }
  }
  return y1 < 0 ? 0 : y1 - y0 + 1;
}

function grade(boxes) {
  const border = Math.max(...boxes.map((b) => b.border));
  const cores = boxes.map((b) => b.coreH).filter((v) => v > 0);
  const drift = cores.length ? (Math.max(...cores) - Math.min(...cores)) / Math.max(...cores) : 1;
  const diags = boxes.map((b) => Math.hypot(b.bw, b.bh));
  // Motion is what makes it an animation rather than a still: how much the box
  // MOVES once scale is out of the picture (centroid travel, box-normalised).
  const cx = boxes.map((b) => (b.x0 + b.x1) / 2), cy = boxes.map((b) => (b.y0 + b.y1) / 2);
  const span = (a) => Math.max(...a) - Math.min(...a);
  const motion = Math.hypot(span(cx), span(cy)) / Math.max(...diags);
  return { border, drift, motion, ok: border <= MAX_BORDER && drift <= MAX_SCALE_DRIFT };
}

// ONE scale + ONE offset for the whole set, derived from the UNION of every
// frame's content box. Per-frame fitting would cancel the animation: each frame
// would be re-centred and re-scaled to the same box, so the wings would appear
// not to move at all.
async function refit(bufs, W, H, margin = 0.05) {
  const boxes = await Promise.all(bufs.map(boxOf));
  const u = { x0: Math.min(...boxes.map((b) => b.x0)), y0: Math.min(...boxes.map((b) => b.y0)),
              x1: Math.max(...boxes.map((b) => b.x1)), y1: Math.max(...boxes.map((b) => b.y1)) };
  const uw = u.x1 - u.x0 + 1, uh = u.y1 - u.y0 + 1;
  const s = Math.min((W * (1 - 2 * margin)) / uw, (H * (1 - 2 * margin)) / uh);
  // Expressed as a WINDOW on the source rather than a composite of a scaled
  // copy: with the padded input s is > 1, and compositing an image larger than
  // the canvas is an error rather than a crop. A window works either way, and
  // the extend() makes it legal even when it reaches past the source edge.
  const sw = Math.max(1, Math.round(W / s)), sh = Math.max(1, Math.round(H / s));
  const srcW = boxes[0].w, srcH = boxes[0].h;
  const x0 = Math.round(u.x0 + uw / 2 - sw / 2), y0 = Math.round(u.y0 + uh / 2 - sh / 2);
  const padL = Math.max(0, -x0), padT = Math.max(0, -y0);
  const padR = Math.max(0, x0 + sw - srcW), padB = Math.max(0, y0 + sh - srcH);
  const clear = { r: 0, g: 0, b: 0, alpha: 0 };
  return Promise.all(bufs.map(async (b) => sharp(b).ensureAlpha()
    .extend({ top: padT, bottom: padB, left: padL, right: padR, background: clear })
    .extract({ left: x0 + padL, top: y0 + padT, width: sw, height: sh })
    .resize(W, H, { fit: 'fill' })
    .webp({ quality: 92 }).toBuffer()));
}

if (has('--check')) {
  const bufs = [];
  for (let i = 0; i < FRAMES; i++) bufs.push(await readFile(join(OUT, `virgo_${i}.webp`)));
  const boxes = await Promise.all(bufs.map(boxOf));
  const g = grade(boxes);
  for (let i = 0; i < FRAMES; i++) console.log(`  ${i}  box ${boxes[i].bw}x${boxes[i].bh}  body ${boxes[i].coreH}  border ${boxes[i].border}`);
  console.log(`border=${g.border} (<=${MAX_BORDER})  bodyDrift=${g.drift.toFixed(3)} (<=${MAX_SCALE_DRIFT})  motion=${g.motion.toFixed(3)}  ${g.ok ? 'PASS' : 'FAIL'}`);
  process.exit(g.ok ? 0 : 1);
}

// --bake N: refit and ship a roll that is already on disk, no credits spent.
// Every roll is kept (see KEEP below) precisely so a refit bug — and there was
// one — costs a re-run of sharp rather than a re-run of the model.
const BAKE = arg('--bake');
if (BAKE) {
  const KEEP = join(repoRoot, 'scripts', '_tmp_virgo_fly_rolls');
  const bufs = [];
  for (let i = 0; i < FRAMES; i++) bufs.push(await readFile(join(KEEP, `r${BAKE}_${i}.webp`)));
  const g = grade(await Promise.all(bufs.map(boxOf)));
  if (!g.ok) { console.error(`roll ${BAKE} does not clear the gate: border=${g.border} bodyDrift=${g.drift.toFixed(3)}`); process.exit(2); }
  const base0 = await readFile(join(ZDIR, 'virgo.png')).catch(() => readFile(join(ZDIR, 'virgo.webp')));
  const md = await sharp(base0).metadata();
  await mkdir(OUT, { recursive: true });
  const fitted = await refit(bufs, md.width, md.height);
  for (let i = 0; i < FRAMES; i++) await writeFile(join(OUT, `virgo_${i}.webp`), fitted[i]);
  console.log(`baked roll ${BAKE} -> ${FRAMES} frames ${md.width}x${md.height}  border=${g.border} bodyDrift=${g.drift.toFixed(3)} motion=${g.motion.toFixed(3)}`);
  process.exit(0);
}

const key = process.env.LUDO_API_KEY;
if (!key || !has('--generate')) { console.error('usage: --generate (needs LUDO_API_KEY) | --bake N | --check'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const ROLLS = Number(arg('--rolls') || 4);

const base = await readFile(join(ZDIR, 'virgo.png')).catch(() => readFile(join(ZDIR, 'virgo.webp')));
const { width: W, height: H } = await sharp(base).metadata();
const small = await (async () => {
  // Pad first (see PAD above), then downscale to the <1MP the API needs.
  const iw = Math.max(1, Math.round(W * (1 - 2 * PAD))), ih = Math.max(1, Math.round(H * (1 - 2 * PAD)));
  let b = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp(base).resize(iw, ih, { fit: 'inside' }).png().toBuffer(), gravity: 'centre' }])
    .png().toBuffer();
  let m = await sharp(b).metadata();
  while (m.width * m.height > 900000) { b = await sharp(b).resize(Math.round(m.width * 0.8)).png().toBuffer(); m = await sharp(b).metadata(); }
  return `data:image/png;base64,${b.toString('base64')}`;
})();

const fetchBuf = async (u) => Buffer.from(await (await fetch(u)).arrayBuffer());
async function roll() {
  const res = await fetch(`${API}/assets/sprite/animate`, {
    method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ initial_image: small, motion_prompt: MOTION, frames: FRAMES,
      frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite' }),
  });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
  const d = await res.json();
  const urls = d.individual_frame_urls || [];
  if (urls.length < FRAMES) throw new Error(`got ${urls.length} frames`);
  return Promise.all(urls.slice(0, FRAMES).map(fetchBuf));
}

// Every roll is kept, passed or not. The first version of this script threw
// rejects away and then five straight gates left nothing to look at and no way
// to re-grade without spending credits again.
const KEEP = join(repoRoot, 'scripts', '_tmp_virgo_fly_rolls');
await mkdir(KEEP, { recursive: true });

let best = null;
for (let r = 0; r < ROLLS; r++) {
  process.stdout.write(`roll ${r + 1}/${ROLLS} ... `);
  let bufs;
  try { bufs = await roll(); } catch (e) { console.log(`FAIL ${e.message}`); continue; }
  for (let i = 0; i < bufs.length; i++) await writeFile(join(KEEP, `r${r + 1}_${i}.webp`), bufs[i]);
  const boxes = await Promise.all(bufs.map(boxOf));
  const g = grade(boxes);
  console.log(`border=${g.border} bodyDrift=${g.drift.toFixed(3)} motion=${g.motion.toFixed(3)} ${g.ok ? 'pass' : 'GATED'}`);
  if (!g.ok) continue;
  // Among rolls that are contained and un-drifted, the most ANIMATED wins.
  if (!best || g.motion > best.g.motion) best = { bufs, g };
}
if (!best) { console.error('no roll cleared the containment gate — re-run'); process.exit(2); }
await mkdir(OUT, { recursive: true });
const fitted = await refit(best.bufs, W, H);
for (let i = 0; i < FRAMES; i++) await writeFile(join(OUT, `virgo_${i}.webp`), fitted[i]);
console.log(`wrote ${FRAMES} frames ${W}x${H}  border=${best.g.border} drift=${best.g.drift.toFixed(3)} motion=${best.g.motion.toFixed(3)}`);
