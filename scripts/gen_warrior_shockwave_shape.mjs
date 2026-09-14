#!/usr/bin/env node
// WARRIOR SHOCKWAVE — thinner, sharper, see-through.
// ============================================================================
// Per user, on the crescent they drew: "make the crescent bigger, more crescent shaped, less
// opaque", then "more transluscent".
//
// The art is CARVED, never repainted. Everything that survives is still the user's own paint:
//   shape   subtract a disc from the inner (concave) side. That deepens the bite and tapers the
//           horns, turning a thick lens into a proper crescent. The disc is fitted to the art's own
//           outer arc, so the cut follows the curve he drew instead of a straight chord.
//   alpha   falls off with LUMINANCE, not flat. A flat cut greys the whole wave into the background
//           (the flat variants went brown on a light map); weighting by luminance keeps the hot
//           leading edge crisp while the body goes see-through, so it reads as energy rather than
//           as a faded sticker.
// BIGGER is not done here: the projectile is drawn into a square box from p.w, so size belongs to
// the spawn's sprScale, where it changes the DRAWN size and leaves the hitbox alone.
//
// ORDER MATTERS, and it is the whole reason this is a separate step from the animator. ludo is
// asked to animate the user's ORIGINAL painting — thick and opaque, which it holds together
// reasonably — and the carve and the fade are applied to its output afterwards. Animating the
// already-carved, already-translucent still instead gave it too little to hold: it came back
// repainted as a veined flame with a palette 169 off, and its first two frames nearly empty.
//
// The user's untouched painting is the seed and is committed alongside, so this is reproducible and
// his original can never be carved twice or lost:
//   scripts/seeds/warrior_shockwave_orig.webp  ->  Sprites/projectiles/warrior_shockwave.webp
//
//   node scripts/gen_warrior_shockwave_shape.mjs              # the still
//   node scripts/gen_warrior_shockwave_shape.mjs --frames     # the same carve + fade on the 9 frames
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const has = (f) => process.argv.includes('--' + f);

const SEED = 'scripts/seeds/warrior_shockwave_orig.webp';
const OUT = 'Sprites/projectiles/warrior_shockwave.webp';
const ANIM = 'Sprites/projectiles/anim';
const NAME = 'warrior_shockwave';
// Chosen off the contact sheets AT THE SIZE THE GAME DRAWS IT: 0.55 is the bite where it reads as a
// crescent rather than a lens without the horns going to thread. 0.68 is the alpha level - 0.50 was
// tried first and, composited at the real 184px box over a real frame of a LIGHT map, it was a pale
// smear rather than a weapon. 0.68 is still plainly see-through and still reads as a red blade.
const BITE = 0.55, LEVEL = 0.68;
// alpha *= LEVEL * (FLOOR + GAIN * luminance)
const FLOOR = 0.45, GAIN = 1.25;
const CUT_SOFTEN = 6;                                  // px of feather on the newly cut inner edge

async function raw(p) {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height };
}
function contentBox(data, W, H) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
// The cutting disc, fitted ONCE to the seed's own geometry and then used for the still and for every
// frame — so the whole set is cut to exactly the same crescent and cannot breathe between frames.
async function mask() {
  const { data, W, H } = await raw(path.join(ROOT, SEED));
  const b = contentBox(data, W, H);
  const cy = (b.y0 + b.y1) / 2;
  let waist = 0;
  for (let y = b.y0; y <= b.y1; y++) {
    let l = -1, r = -1;
    for (let x = b.x0; x <= b.x1; x++) if (data[(y * W + x) * 4 + 3] > 10) { if (l < 0) l = x; r = x; }
    if (l >= 0 && r - l + 1 > waist) waist = r - l + 1;
  }
  const R = Math.max(b.h / 2, b.w), outerCx = b.x1 - R;   // outer arc through the art's rightmost point
  return { cx: outerCx, cy, innerR: R - (waist - Math.round(waist * BITE)), W, H, box: b, waist };
}
function shape(data, W, H, m) {
  // the mask is fitted on the seed's canvas; a frame on another canvas is scaled to it
  const sx = W / m.W, sy = H / m.H;
  const cx = m.cx * sx, cy = m.cy * sy, innerR = m.innerR * ((sx + sy) / 2);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = (y * W + x) * 4;
    if (!data[p + 3]) continue;
    const d = Math.hypot((x - cx) / 1, (y - cy) / 1);
    if (d < innerR) { data[p + 3] = 0; continue; }
    const edge = d - innerR;
    if (edge < CUT_SOFTEN) data[p + 3] = Math.round(data[p + 3] * (edge / CUT_SOFTEN));
  }
}
function translucent(data) {
  for (let p = 0; p < data.length; p += 4) {
    if (!data[p + 3]) continue;
    const lum = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255;
    const a = data[p + 3] * LEVEL * (FLOOR + GAIN * lum);
    data[p + 3] = a < 0 ? 0 : a > 255 ? 255 : Math.round(a);
  }
}
const write = async (file, data, W, H) => {
  fs.writeFileSync(file + '.tmp', await sharp(data, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toBuffer());
  fs.renameSync(file + '.tmp', file);
};

async function still() {
  const src = path.join(ROOT, SEED);
  if (!fs.existsSync(src)) { console.error('missing seed ' + SEED); process.exit(1); }
  const m = await mask();
  const { data, W, H } = await raw(src);
  shape(data, W, H, m);
  translucent(data);
  const after = contentBox(data, W, H);
  await write(path.join(ROOT, OUT), data, W, H);
  console.log(`${OUT}: content ${m.box.w}x${m.box.h} (waist ${m.waist}) -> ${after.w}x${after.h}, bite ${BITE}, alpha level ${LEVEL}`);
}

async function frames() {
  const m = await mask();
  let n = 0;
  for (let i = 0; i < 9; i++) {
    const f = path.join(ROOT, ANIM, `${NAME}_${i}.webp`);
    if (!fs.existsSync(f)) continue;
    const { data, W, H } = await raw(f);
    translucent(data);   // fade ONLY: the crescent was carved before ludo saw it, and a fireball must not be cut by a crescent mask
    const b = contentBox(data, W, H);
    await write(f, data, W, H);
    console.log(`  ${NAME}_${i}: content ${b.w}x${b.h}`);
    n++;
  }
  console.log(`carved and faded ${n} frames to the same crescent as the still`);
}

async function source() {
  const m = await mask();
  const { data, W, H } = await raw(path.join(ROOT, SEED));
  shape(data, W, H, m);                       // shape only - no fade, ludo needs the material
  const dst = path.join(ROOT, 'scripts/seeds/warrior_shockwave_carved.webp');
  await write(dst, data, W, H);
  const b = contentBox(data, W, H);
  console.log('scripts/seeds/warrior_shockwave_carved.webp: content ' + b.w + 'x' + b.h + ' (carved, still opaque - this is what ludo animates)');
}
if (has('source')) await source();
else if (has('frames')) await frames(); else await still();
