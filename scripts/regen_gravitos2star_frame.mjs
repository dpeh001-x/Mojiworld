#!/usr/bin/env node
// Regenerate ONE frame of Gravitos-2's star-charge attack (ludo.ai).
//
//   node scripts/regen_gravitos2star_frame.mjs --report
//   node scripts/regen_gravitos2star_frame.mjs --frame 0 --rolls 3 --generate
//   node scripts/regen_gravitos2star_frame.mjs --frame 0 --bake 2
//
// WHAT THE SET ACTUALLY MEASURES (--report prints it):
//
//   frame   content box
//   _0      878 x 1219
//   _1      874 x 1219
//   _2     1103 x 1354   <- +11% wider, +11% taller, in one frame
//   _3     1127 x 1287
//   _8     1015 x 1260
//
// Nothing is clipped anywhere in the set (border ink is 0 on all nine), so the
// "cutoff" risk is prospective rather than present.
//
// AND NEITHER IS THE ZOOM — a correction to what this comment used to say. The
// content box really does grow 11% at 1->2, and that is the lightning
// sprawling, not the titan. Measured on the dark armour alone (luminance under
// 120, which neither the lightning nor the chest star reaches) the set is
// steady at a 0.7% spread across all nine frames. The follow-up metric that
// seemed to confirm a body zoom, star-to-feet, was contaminated by the same
// lightning: the arcs are blue-white, so on the discharge frames they dragged
// the "star" centroid. Two metrics agreeing is worth nothing when they share a
// blind spot. scripts/gravitos2star_frame_test.mjs now asserts the dark-armour
// stability directly.
//
// That is why a regenerated frame cannot simply be dropped in at whatever scale
// the model returns. Two things are enforced here:
//
//   * PADDING ON THE WAY OUT. The base pose is composited smaller onto a
//     transparent canvas before it is sent. frame_size:-9 (True Size) locks the
//     model's framing to the input's, so the margin travels with it and the
//     wings, horns and raised fists have somewhere to go. Asking for a pose
//     without that margin is how art ends up against the canvas edge.
//   * ANCHORED REFIT ON THE WAY BACK. The winning frame is scaled so its
//     content box matches its NEIGHBOUR frame's, and positioned so its feet sit
//     on the same line. A frame that is 11% larger than the one before it is a
//     zoom, however good the art is.
//
// The candidate is chosen by how well it CONTINUES the neighbour: silhouette
// IoU after the anchored refit. A frame 0 that does not flow into frame 1 is a
// pop, and a pop is more noticeable than slightly nicer pixels.
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const SET = join(repoRoot, 'Sprites', 'bosses', 'attack');
const BASE = join(repoRoot, 'Sprites', 'bosses', 'gravitos2star.webp');
const KEEP = join(repoRoot, 'scripts', '_tmp_grav2star_rolls');
const KEY = 'gravitos2star';
const FRAMES = 9, ALPHA = 12;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const framePath = (i) => join(SET, `${KEY}_${i}.webp`);

// The whole attack, for --set. The single-frame MOTION below describes only the
// wind-up; a nine-frame sequence needs the release too, or the set peaks in the
// middle and then just sits there.
const SET_MOTION =
  'The armoured demon titan CHARGES AND RELEASES the star at its chest, as one continuous attack: it '
  + 'plants its feet and hauls both fists up and outward, the molten orange veins in its plating flare '
  + 'brighter and brighter, the white-blue star on its chest swells and begins to crackle, then arcs of '
  + 'blue-white lightning burst outward from it across the whole body and lash out in jagged '
  + 'bolts, the star blazing to a blinding flare at the peak before the arcs die back down. '
  + 'Every frame should look clearly different from the last - this is a violent build and discharge. '
  + 'CRITICAL FRAMING, these override the motion: the TITAN stays EXACTLY the same SIZE in every frame '
  + '- no zoom in, no zoom out, no camera push, it never grows or shrinks. It stays CENTRED and its '
  + 'FEET STAY ON THE SAME LINE, planted on the ground, in every single frame. Keep the EXACT same '
  + 'character, the same left/right facing, the same armour, the same colours and the same art style '
  + 'throughout. Never mirror or flip.';

const MOTION =
  'The armoured demon titan BEGINS to charge the star at its chest: it plants its feet, hauls both '
  + 'fists up and outward, its shoulders and wings flare open, the molten orange veins running through '
  + 'its plating pulse brighter, and the white-blue star on its chest swells and starts to crackle. '
  + 'A slow, heavy wind-up full of gathering power. '
  + 'CRITICAL FRAMING, these override the motion: the figure stays EXACTLY the same SIZE in every frame '
  + '- no zoom in, no zoom out, no camera push, the titan never grows or shrinks. It stays CENTRED and '
  + 'its feet stay on the same line. Its horns, wings, fists and every spike must remain FULLY INSIDE '
  + 'the frame with clear empty margin on all four sides - nothing may touch or cross the frame edge. '
  + 'Keep the EXACT same character, the same left/right facing, the same armour, the same colours and '
  + 'the same art style in every frame. Never mirror or flip.';

async function measure(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let x0 = w, y0 = h, x1 = -1, y1 = -1, border = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * c + 3] <= ALPHA) continue;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border++;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  return { w, h, x0, y0, x1, y1, bw: x1 - x0 + 1, bh: y1 - y0 + 1, border, data, c };
}

// Scale the candidate so its content box matches `ref`'s, then place it so the
// two share a bottom line and a horizontal centre. Feet on the same line is the
// whole point: the boss renderer is bbox-bottom anchored, so a frame that
// disagrees about where the floor is makes the boss hop.
async function refitTo(buf, ref) {
  const m = await measure(buf);
  const sc = Math.min(ref.bw / m.bw, ref.bh / m.bh);
  const sw = Math.max(1, Math.round(m.w * sc)), sh = Math.max(1, Math.round(m.h * sc));
  const scaled = await sharp(buf).ensureAlpha().resize(sw, sh, { fit: 'fill' }).png().toBuffer();
  const sm = await measure(scaled);
  const left = Math.round((ref.x0 + ref.bw / 2) - (sm.x0 + sm.bw / 2));
  const top = Math.round((ref.y1) - sm.y1);
  const canvas = sharp({ create: { width: ref.w, height: ref.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  // Composite can only place inside the canvas, so crop the overhang first.
  const cropL = Math.max(0, -left), cropT = Math.max(0, -top);
  const availW = Math.min(sw - cropL, ref.w - Math.max(0, left));
  const availH = Math.min(sh - cropT, ref.h - Math.max(0, top));
  const piece = await sharp(scaled).extract({ left: cropL, top: cropT, width: Math.max(1, availW), height: Math.max(1, availH) }).png().toBuffer();
  return canvas.composite([{ input: piece, left: Math.max(0, left), top: Math.max(0, top) }]).webp({ quality: 94 }).toBuffer();
}

// Silhouette agreement with the neighbour, after the refit.
async function iouWith(buf, refBuf) {
  const a = await measure(buf), b = await measure(refBuf);
  let inter = 0, uni = 0;
  const { w, h } = a;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const pa = a.data[(y * w + x) * a.c + 3] > ALPHA;
    const pb = b.data[(y * w + x) * b.c + 3] > ALPHA;
    if (pa && pb) inter++;
    if (pa || pb) uni++;
  }
  return inter / Math.max(1, uni);
}

// ---------------------------------------------------------------------------
// SET MODE. Regenerate all nine frames from the current frame 0.
//
// The transform is derived from frame 0 ALONE and then applied unchanged to
// every frame. That is the whole anti-zoom mechanism: one scale and one offset
// for the set means the titan cannot grow between frames, while everything the
// animation actually does - leaning, crouching, throwing its arms out, the
// lightning sprawling - survives intact, because those are changes WITHIN the
// shared frame, not changes to it.
//
// Two things it deliberately preserves, because data/anim_calib.js carries a
// hand-tuned "gravitos2star".attack entry (s 0.965, dy 0.0294) fitted to the
// art that is there now:
//   * the PIXEL SCALE of frame 0's body, so that calibration stays valid;
//   * the FLOOR LINE - 147px of canvas below the feet - so the boss does not
//     jump when the new set lands.
//
// And when a frame needs more room than the canvas has (the lightning frames
// sprawl far wider than the body), the canvas GROWS rather than the titan
// shrinking. Shrinking to fit would be a zoom by another name, and would
// silently invalidate the calibration above. Per user: "if needed expand the
// canvas so there are no cutoffs".
async function refitSetAnchoredOnFirst(bufs, anchor) {
  const ms = [];
  for (const b of bufs) ms.push(await measure(b));
  // one scale, from frame 0's body against the anchor's body
  const sc = Math.min(anchor.bw / ms[0].bw, anchor.bh / ms[0].bh);
  const scaled = [];
  for (let i = 0; i < bufs.length; i++) {
    const sw = Math.max(1, Math.round(ms[i].w * sc)), sh = Math.max(1, Math.round(ms[i].h * sc));
    scaled.push(await sharp(bufs[i]).ensureAlpha().resize(sw, sh, { fit: 'fill' }).png().toBuffer());
  }
  const sm = [];
  for (const b of scaled) sm.push(await measure(b));
  // one offset, so frame 0's feet land on the anchor's floor line and its body
  // is centred where the anchor's was
  const dx = (anchor.x0 + anchor.bw / 2) - (sm[0].x0 + sm[0].bw / 2);
  const dy = anchor.y1 - sm[0].y1;
  // where does the whole set reach once transformed?
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const m of sm) {
    minX = Math.min(minX, m.x0 + dx); maxX = Math.max(maxX, m.x1 + dx);
    minY = Math.min(minY, m.y0 + dy); maxY = Math.max(maxY, m.y1 + dy);
  }
  const MARGIN = 24;
  // grow the canvas, never shrink the titan. Bottom margin is held at the
  // anchor's so the floor line is unchanged in canvas-relative terms.
  const bottomMargin = anchor.h - 1 - anchor.y1;
  const growL = Math.max(0, Math.ceil(MARGIN - minX));
  const growR = Math.max(0, Math.ceil(maxX - (anchor.w - 1) + MARGIN));
  const growT = Math.max(0, Math.ceil(MARGIN - minY));
  const growB = Math.max(0, Math.ceil(maxY + bottomMargin - (anchor.h - 1)));
  const grow = Math.max(growL, growR);            // keep it horizontally symmetric
  const outW = anchor.w + 2 * grow, outH = anchor.h + growT + growB;
  const out = [];
  for (let i = 0; i < scaled.length; i++) {
    const left = Math.round(dx + grow), top = Math.round(dy + growT);
    const cropL = Math.max(0, -left), cropT = Math.max(0, -top);
    const availW = Math.min(sm[i].w - cropL, outW - Math.max(0, left));
    const availH = Math.min(sm[i].h - cropT, outH - Math.max(0, top));
    const piece = await sharp(scaled[i])
      .extract({ left: cropL, top: cropT, width: Math.max(1, availW), height: Math.max(1, availH) }).png().toBuffer();
    out.push(await sharp({ create: { width: outW, height: outH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: piece, left: Math.max(0, left), top: Math.max(0, top) }]).webp({ quality: 94 }).toBuffer());
  }
  return { out, grew: { x: grow, top: growT, bottom: growB }, scale: sc };
}

if (has('--report')) {
  console.log('  frame   canvas        content box     at        border');
  const b = await measure(await readFile(BASE));
  console.log(`  base    ${b.w}x${b.h}   ${String(b.bw).padStart(4)} x ${b.bh}    ${b.x0},${b.y0}   ${b.border}`);
  const boxes = [];
  for (let i = 0; i < FRAMES; i++) {
    const m = await measure(await readFile(framePath(i)));
    boxes.push(m);
    console.log(`  _${i}      ${m.w}x${m.h}   ${String(m.bw).padStart(4)} x ${m.bh}    ${m.x0},${m.y0}   ${m.border}`);
  }
  const hs = boxes.map((m) => m.bh);
  console.log(`\n  box height spread: ${Math.min(...hs)} .. ${Math.max(...hs)}  = ${((Math.max(...hs) - Math.min(...hs)) / Math.max(...hs) * 100).toFixed(1)}% swell across the attack`);
  const jumps = hs.slice(1).map((v, i) => ({ at: `${i}->${i + 1}`, pct: ((v - hs[i]) / hs[i] * 100) }));
  const worst = jumps.reduce((p, q) => Math.abs(q.pct) > Math.abs(p.pct) ? q : p);
  console.log(`  biggest single-frame jump: ${worst.at}  ${worst.pct > 0 ? '+' : ''}${worst.pct.toFixed(1)}%`);
  console.log(`  frames with ink on the canvas edge: ${boxes.filter((m) => m.border > 0).length}`);
  process.exit(0);
}

if (has('--set')) {
  const key = process.env.LUDO_API_KEY;
  if (!key || !has('--generate')) { console.error('usage: --set --generate [--rolls N]'); process.exit(1); }
  const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
  const ROLLS = Number(arg('--rolls') || 3);
  const PAD = Number(arg('--pad') || 0.18);
  const hdr = { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' };
  const fetchBuf = async (u) => Buffer.from(await (await fetch(u, { signal: AbortSignal.timeout(180000) })).arrayBuffer());

  // The seed is the CURRENT frame 0 - the one just regenerated - per user.
  const seedBuf = await readFile(framePath(0));
  const anchor = await measure(seedBuf);
  console.log(`seeding from ${KEY}_0 (box ${anchor.bw}x${anchor.bh}, floor at y=${anchor.y1} on a ${anchor.w}x${anchor.h} canvas)`);

  const padded = await sharp({ create: { width: anchor.w, height: anchor.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp(seedBuf).resize(Math.round(anchor.w * (1 - 2 * PAD)), Math.round(anchor.h * (1 - 2 * PAD)), { fit: 'inside' }).png().toBuffer(), gravity: 'centre' }])
    .png().toBuffer();
  const uri = 'data:image/png;base64,'
    + (await sharp(padded).resize(940, 940, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');

  await mkdir(KEEP, { recursive: true });
  let best = null;
  for (let r = 1; r <= ROLLS; r++) {
    process.stdout.write(`roll ${r}/${ROLLS} ... `);
    let bufs;
    try {
      const res = await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST', headers: hdr, signal: AbortSignal.timeout(300000),
        body: JSON.stringify({ initial_image: uri, motion_prompt: SET_MOTION, frames: FRAMES,
          frame_size: -9, model: 'eagle', individual_frames: true, loop: false, image_type: 'sprite' }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
      const d = await res.json();
      const urls = d.individual_frame_urls || [];
      if (urls.length < FRAMES) throw new Error(`got ${urls.length} frames`);
      bufs = await Promise.all(urls.slice(0, FRAMES).map(fetchBuf));
    } catch (e) { console.log('FAIL ' + e.message); continue; }
    for (let i = 0; i < bufs.length; i++) await writeFile(join(KEEP, `set_r${r}_${i}.png`), bufs[i]);

    const { out, grew, scale } = await refitSetAnchoredOnFirst(bufs, anchor);
    const fm = [];
    for (const b of out) fm.push(await measure(b));
    const border = fm.reduce((a2, m) => a2 + m.border, 0);
    // The zoom check, on the BODY rather than the box: the box legitimately
    // grows when lightning sprawls, the body does not.
    const bodies = fm.map((m) => m.bh);
    const spread = (Math.max(...bodies) - Math.min(...bodies)) / Math.max(...bodies);
    // Feet on one line - the renderer is bbox-bottom anchored.
    const feet = fm.map((m) => m.y1);
    const footSpread = Math.max(...feet) - Math.min(...feet);
    // ...and it has to actually animate.
    let motion = 0;
    for (let i = 0; i + 1 < out.length; i++) {
      const a2 = await sharp(out[i]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const b2 = await sharp(out[i + 1]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let sum = 0, n = 0;
      for (let px = 0; px < a2.info.width * a2.info.height; px++) {
        const ia = px * a2.info.channels, ib = px * b2.info.channels;
        if (a2.data[ia + 3] <= 128 || b2.data[ib + 3] <= 128) continue;
        sum += Math.abs((a2.data[ia] * 0.299 + a2.data[ia + 1] * 0.587 + a2.data[ia + 2] * 0.114)
                      - (b2.data[ib] * 0.299 + b2.data[ib + 1] * 0.587 + b2.data[ib + 2] * 0.114));
        n++;
      }
      motion += sum / Math.max(1, n);
    }
    motion /= (out.length - 1);
    const okRoll = border === 0;
    console.log(`canvas ${fm[0].w}x${fm[0].h} (grew x${grew.x} top${grew.top} bot${grew.bottom})  border ${border}  boxSpread ${(spread * 100).toFixed(1)}%  footSpread ${footSpread}px  motion ${motion.toFixed(1)} ${okRoll ? '' : ' CLIPPED'}`);
    if (!okRoll) continue;
    // Prefer the liveliest set that is clean and tight on its feet.
    const score = motion - footSpread * 0.05 - spread * 60;
    if (!best || score > best.score) best = { out, score, border, spread, footSpread, motion, fm, grew };
  }
  if (!best) { console.error('no clean roll - re-run'); process.exit(2); }
  for (let i = 0; i < FRAMES; i++) await writeFile(framePath(i), best.out[i]);
  // The attack-dir base pose mirrors the final frame in this set; keep it so.
  await writeFile(join(SET, `${KEY}.webp`), best.out[FRAMES - 1]);
  console.log(`wrote ${FRAMES} frames + ${KEY}.webp  canvas ${best.fm[0].w}x${best.fm[0].h}  border 0  boxSpread ${(best.spread * 100).toFixed(1)}%  footSpread ${best.footSpread}px  motion ${best.motion.toFixed(1)}`);
  process.exit(0);
}

const FRAME = Number(arg('--frame') ?? 0);
// Continuity is judged against the neighbour that stays: frame 0's is frame 1.
const REF = FRAME === 0 ? 1 : FRAME - 1;

if (has('--bake')) {
  const n = arg('--bake');
  const raw = await readFile(join(KEEP, `f${FRAME}_r${n}.png`));
  const ref = await measure(await readFile(framePath(REF)));
  const out = await refitTo(raw, ref);
  const m = await measure(out);
  if (m.border > 0) { console.error(`baked frame has ${m.border} px of ink on the canvas edge`); process.exit(2); }
  await writeFile(framePath(FRAME), out);
  console.log(`baked roll ${n} -> ${KEY}_${FRAME}.webp  box ${m.bw}x${m.bh} (ref ${ref.bw}x${ref.bh}) border ${m.border}`);
  process.exit(0);
}

const key = process.env.LUDO_API_KEY;
if (!key || !has('--generate')) { console.error('usage: --report | --frame N --generate [--rolls N] | --frame N --bake N'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const ROLLS = Number(arg('--rolls') || 3);
const PAD = Number(arg('--pad') || 0.20);
const hdr = { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' };
const fetchBuf = async (u) => Buffer.from(await (await fetch(u, { signal: AbortSignal.timeout(180000) })).arrayBuffer());

const baseBuf = await readFile(BASE);
const bm = await measure(baseBuf);
// Pad on the way out (see the header): composite the base smaller so the model
// has margin to put horns, wings and fists into.
const padded = await (async () => {
  const iw = Math.round(bm.w * (1 - 2 * PAD)), ih = Math.round(bm.h * (1 - 2 * PAD));
  return sharp({ create: { width: bm.w, height: bm.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp(baseBuf).resize(iw, ih, { fit: 'inside' }).png().toBuffer(), gravity: 'centre' }])
    .png().toBuffer();
})();
const uri = 'data:image/png;base64,'
  + (await sharp(padded).resize(940, 940, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');

const refBuf = await readFile(framePath(REF));
const ref = await measure(refBuf);
console.log(`regenerating ${KEY}_${FRAME}, continuity reference = _${REF} (box ${ref.bw}x${ref.bh})`);

await mkdir(KEEP, { recursive: true });
let best = null, saved = 0;
for (let r = 1; r <= ROLLS; r++) {
  process.stdout.write(`roll ${r}/${ROLLS} ... `);
  let bufs;
  try {
    const res = await fetch(`${API}/assets/sprite/animate`, {
      method: 'POST', headers: hdr, signal: AbortSignal.timeout(300000),
      body: JSON.stringify({ initial_image: uri, motion_prompt: MOTION, frames: FRAMES,
        frame_size: -9, model: 'eagle', individual_frames: true, loop: false, image_type: 'sprite' }),
    });
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
    const d = await res.json();
    const urls = d.individual_frame_urls || [];
    if (urls.length < 2) throw new Error(`got ${urls.length} frames`);
    bufs = await Promise.all(urls.slice(0, FRAMES).map(fetchBuf));
  } catch (e) { console.log('FAIL ' + e.message); continue; }

  // Every candidate frame of the roll is a candidate for OUR frame: the wind-up
  // beat we want may be the model's frame 2 rather than its frame 0.
  let rollBest = null;
  for (let i = 0; i < bufs.length; i++) {
    const m0 = await measure(bufs[i]);
    if (!m0) continue;
    const fitted = await refitTo(bufs[i], ref);
    const fm = await measure(fitted);
    if (fm.border > 0) continue;                       // would be clipped: reject outright
    const iou = await iouWith(fitted, refBuf);
    if (!rollBest || iou > rollBest.iou) rollBest = { fitted, raw: bufs[i], iou, idx: i, fm };
  }
  if (!rollBest) { console.log('every candidate clipped after refit'); continue; }
  saved++;
  await writeFile(join(KEEP, `f${FRAME}_r${saved}.png`), rollBest.raw);
  console.log(`best candidate #${rollBest.idx}  continuity IoU ${rollBest.iou.toFixed(3)}  box ${rollBest.fm.bw}x${rollBest.fm.bh}  border 0`);
  if (!best || rollBest.iou > best.iou) best = rollBest;
}
if (!best) { console.error('no usable candidate — re-run'); process.exit(2); }
await writeFile(framePath(FRAME), best.fitted);
console.log(`wrote ${KEY}_${FRAME}.webp  continuity IoU ${best.iou.toFixed(3)} vs _${REF}  box ${best.fm.bw}x${best.fm.bh} (ref ${ref.bw}x${ref.bh})  border 0`);
