// v0.30.804 - Virga's three redrawn idle frames clear the feather probe again.
// =============================================================================
// v0.30.293 (apply_virga_repad.mjs) recomposed all 27 idle / walk / attack frames so nothing sits within a probe
// cell (1332 / 48 = 27.75 px) of the canvas edge; an hour later 13501e88 dropped redrawn idle frames 3, 5 and 7
// with longer wings and checked canvas size, frame count and manifest - never the margin. Measured: R margin
// 61 -> 46 (frame 3), 63 -> 44 (frame 5), and frame 7 L 59 -> 44 / R 60 -> 23. 23 px is inside the probe cell, so
// the engine feathers that wing again: the bug v0.30.293 fixed (data/sprite_edges.js flags virgo_7 "|2:17:18||").
//
// THE FIX - move, do not redraw. Frames 3 and 5 are only off-centre: the content is slid sideways to the middle
// of the same canvas (no rescale, feet and height untouched) -> 54 px each side. Frame 7's wingspan (1265 px of
// 1332) cannot clear 50 px by centring alone, so that one frame is also inset by the smallest uniform scale that
// does (k = (W - 2 * 52) / span, about 0.971), with the content's bottom pinned exactly where it was, the same
// anchor the repad and the calib use. Do NOT re-run apply_virga_repad.mjs for this: it would apply k = 0.913 to
// exactly these frames although their body is already at post-recompose scale, shrinking it 8.7% in 3 of 9 frames.
//
// Idempotent: a frame that already clears 50 px on both sides is skipped. Verifies before replacing; atomic write.
// Afterwards: gen_sprite_edges.mjs, gen_sprite_bbox.mjs, gen_anim_manifest.mjs, animator_parity_check.mjs.
import sharp from 'sharp';
import { renameSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const FRAMES = [3, 5, 7];
const A = 24;        // alpha threshold - identical to the probe's
const MIN = 50;      // what scripts/virga_wings_test.mjs asks for
const TARGET = 52;   // what an inset aims at, so rounding cannot land under MIN
const bbox = (buf, W, H) => {
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (buf[(y * W + x) * 4 + 3] > A) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { x0, x1, y0, y1 };
};
let changed = 0, skipped = 0;
for (const i of FRAMES) {
  const f = `${ROOT}/Sprites/bosses/zodiac/idle/virgo_${i}.webp`;
  const src = sharp(f).ensureAlpha();
  const { width: W, height: H } = await src.metadata();
  const b = bbox(await src.raw().toBuffer(), W, H);
  const mL = b.x0, mR = W - 1 - b.x1;
  if (Math.min(mL, mR) >= MIN) { skipped++; console.log(`  idle/virgo_${i}: already clear (L ${mL} / R ${mR})`); continue; }
  const span = b.x1 - b.x0 + 1;
  const k = Math.min(1, (W - 2 * TARGET) / span);
  const sw = Math.round(W * k), sh = Math.round(H * k);
  const ox = Math.round((W - k * (b.x0 + b.x1 + 1)) / 2);     // centre the CONTENT horizontally
  const oy = Math.round((b.y1 + 1) * (1 - k));                // pin the content's bottom where it was
  const layer = k === 1 ? await sharp(f).ensureAlpha().png().toBuffer()
    : await sharp(f).ensureAlpha().resize(sw, sh, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
  // a sideways slide can push transparent canvas past the edge: crop the layer to what lands inside
  const cl = Math.max(0, -ox), ct = Math.max(0, -oy), cw = Math.min(sw - cl, W - Math.max(0, ox)), ch = Math.min(sh - ct, H - Math.max(0, oy));
  const part = await sharp(layer).extract({ left: cl, top: ct, width: cw, height: ch }).png().toBuffer();
  const out = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: part, left: Math.max(0, ox), top: Math.max(0, oy) }])
    .webp({ quality: 92, alphaQuality: 100, effort: 5 }).toBuffer();
  const chk = sharp(out).ensureAlpha(); const cm = await chk.metadata();
  const nb = bbox(await chk.raw().toBuffer(), cm.width, cm.height);
  const nL = nb.x0, nR = cm.width - 1 - nb.x1;
  if (cm.width !== W || cm.height !== H) { console.error(`ABORT idle/${i}: canvas changed`); process.exit(1); }
  if (Math.min(nL, nR) < MIN) { console.error(`ABORT idle/${i}: margin still L ${nL} / R ${nR}`); process.exit(1); }
  if (Math.abs(nb.y1 - b.y1) > 1) { console.error(`ABORT idle/${i}: the feet moved (${b.y1} -> ${nb.y1})`); process.exit(1); }
  if (k === 1 && Math.abs((nb.y1 - nb.y0) - (b.y1 - b.y0)) > 1) { console.error(`ABORT idle/${i}: height changed on a pure slide`); process.exit(1); }
  const tmp = `${f}.tmp`;
  writeFileSync(tmp, out);                                    // the verified bytes, not a second encode
  if (statSync(tmp).size < 8000) { console.error(`ABORT idle/${i}: output suspiciously small`); process.exit(1); }
  renameSync(tmp, f);
  changed++;
  console.log(`  idle/virgo_${i}: L ${mL} / R ${mR} -> L ${nL} / R ${nR}   k=${k.toFixed(4)}  height ${b.y1 - b.y0 + 1} -> ${nb.y1 - nb.y0 + 1}  feet ${b.y1} -> ${nb.y1}`);
}
console.log(`recentre done: ${changed} frame(s) rewritten, ${skipped} already clear`);
