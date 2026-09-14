#!/usr/bin/env node
// Rebuild the Mojiworld app icon on a backdrop that works at 32 pixels, WITHOUT redrawing Guguma.
//
// Per user: "improve on the background art for the mojiworld icon", then - of the first attempt,
// which shipped as v0.30.723 - "The after looks worse, this can be much better improved" and "it
// needs to be something people are intrigued to click on".
//
// The backdrop now comes from scripts/gen_icon_gate.mjs, which paints it to constraints measured off
// the subject rather than cropping a painted plate. Read that file's header for why the first attempt
// was worse and what the measurements actually demanded.
//
// Why the foreground is lifted out of the shipped PNG rather than re-composited from a sprite:
// scripts/_gen_guguma_icon.mjs (the old one-off) no longer runs - it reads Sprites/ui/mojiworld_logo
// .png, which became a .webp - and its Guguma placement does not match what actually shipped anyway.
// Measured: the bird in assets/mojiworld_icon_512.png has a yellow bounding box of 376x350, aspect
// 1.07, while Sprites/npc/Guguma.webp's is 595x665, aspect 0.90. It is a different pose, drawn for
// the icon. So the safe move is to keep those exact pixels and change only what is behind them.
//
// The mask is a flood fill from the bird's own yellow, expanding through anything that is not the
// old magenta backdrop. Three rules cover every part of him and nothing else:
//   r - b > 40        his yellow body, the orange beak and feet
//   min(r,g,b) > 195  the white belly, which is the one part with as much blue as the backdrop
//   max(r,g,b) < 60   his black keyline and eyes - safe only because the fill has to REACH them,
//                     so the equally dark corners of the old backdrop are never included
//
//   node scripts/gen_app_icon_art.mjs             # measure + write previews, touch nothing tracked
//   node scripts/gen_app_icon_art.mjs --write     # write assets/mojiworld_icon_512.png + _184.jpg
import sharp from 'sharp';
import { gatePng } from './gen_icon_gate.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const S = 512;
const RADIUS = 116;                                   // the shipped icon's corner radius
const SRC_ICON = join(ROOT, 'assets', 'mojiworld_icon_512.png');
// The lifted subject, committed. The mask rules below were written against the ORIGINAL magenta
// backdrop ('r - b > 40' is his yellow there, but it is also a sunrise, and it is the gate's gold
// ring), so re-deriving the mask from the icon this script just wrote would let the flood fill walk
// out of the bird. The lift happens ONCE, from the pre-change art, and is the input from then on;
// pass --lift-from <png> to redo it against a build that predates every backdrop change.
const SUBJECT = join(ROOT, 'assets', 'mojiworld_icon_guguma.png');
const LIFT_FROM = arg('--lift-from');
const TMP = join(ROOT, 'scripts', '_tmp_icon_build');

// ---------------------------------------------------------------- the bird, lifted off its backdrop
async function foregroundMask(src) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ch = info.channels;
  const isFg = new Uint8Array(W * H);
  const seed = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * ch, r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 8) continue;
    if (r - b > 40 || Math.min(r, g, b) > 195 || Math.max(r, g, b) < 60) isFg[y * W + x] = 1;
    if (a > 200 && r > 190 && g > 150 && b < 110 && r - b > 110) seed.push(y * W + x);
  }
  // flood fill from the yellow, through fg-classified pixels only
  const keep = new Uint8Array(W * H);
  const st = seed.slice();
  for (const s of st) keep[s] = 1;
  while (st.length) {
    const p = st.pop(), x = p % W, y = (p / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const q = Y * W + X;
      if (keep[q] || !isFg[q]) continue;
      keep[q] = 1; st.push(q);
    }
  }
  // close pinholes: anything enclosed by the bird belongs to him
  const seen = new Uint8Array(W * H), stack = [];
  for (let x = 0; x < W; x++) { stack.push(x, (H - 1) * W + x); }
  for (let y = 0; y < H; y++) { stack.push(y * W, y * W + W - 1); }
  while (stack.length) {
    const p = stack.pop();
    if (seen[p] || keep[p]) continue;
    seen[p] = 1;
    const x = p % W, y = (p / W) | 0;
    if (x > 0) stack.push(p - 1); if (x < W - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - W); if (y < H - 1) stack.push(p + W);
  }
  // The "dark = his keyline" rule is generous: the fill can walk out of his outline into the soft
  // drop shadow the old backdrop painted under his feet, and drag a smear of old purple with it.
  // His keyline hugs his body, so keep dark pixels only within a short reach of a BRIGHT one.
  const bright = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * ch, r = data[i], g = data[i + 1], b = data[i + 2];
    if (data[i + 3] > 8 && (r - b > 40 || Math.min(r, g, b) > 195)) bright[y * W + x] = 1;
  }
  const REACH = 13;
  const near = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!bright[y * W + x]) continue;
    for (let dy = -REACH; dy <= REACH; dy++) {
      const Y = y + dy; if (Y < 0 || Y >= H) continue;
      const span = Math.floor(Math.sqrt(REACH * REACH - dy * dy));
      for (let dx = -span; dx <= span; dx++) { const X = x + dx; if (X >= 0 && X < W) near[Y * W + X] = 1; }
    }
  }
  let n = 0;
  const mask = Buffer.alloc(W * H);
  for (let i = 0; i < W * H; i++) {
    const on = (keep[i] || !seen[i]) && (bright[i] || near[i]);
    if (on) n++; mask[i] = on ? 255 : 0;
  }
  return { mask, W, H, n };
}

// ---------------------------------------------------------------- build
await mkdir(TMP, { recursive: true });
let birdPng;
if (!LIFT_FROM && existsSync(SUBJECT)) {
  birdPng = await sharp(SUBJECT).png().toBuffer();
  console.log('subject: assets/mojiworld_icon_guguma.png (already lifted)');
} else {
const { mask, W, H, n } = await foregroundMask(LIFT_FROM || SRC_ICON);
console.log(`foreground mask: ${n} px (${(n / (W * H) * 100).toFixed(1)}% of the icon)`);
await sharp(mask, { raw: { width: W, height: H, channels: 1 } }).png().toFile(join(TMP, 'mask.png'));

// A sub-pixel feather so the lifted edge does not read as a cut-out against a different backdrop.
// The stride is read back from the result rather than assumed: sharp hands a blurred single-channel
// raw buffer back as THREE channels, and indexing it as one is a striped, colour-shifted bird.
const softOut = await sharp(mask, { raw: { width: W, height: H, channels: 1 } })
  .blur(0.8).raw().toBuffer({ resolveWithObject: true });
const sc = softOut.info.channels;
const birdRaw = await sharp(LIFT_FROM || SRC_ICON).ensureAlpha().raw().toBuffer();
const bird = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) {
  bird[i * 4] = birdRaw[i * 4]; bird[i * 4 + 1] = birdRaw[i * 4 + 1]; bird[i * 4 + 2] = birdRaw[i * 4 + 2];
  bird[i * 4 + 3] = Math.min(birdRaw[i * 4 + 3], softOut.data[i * sc]);
}
birdPng = await sharp(bird, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
await writeFile(join(TMP, 'bird.png'), birdPng);
}

// The backdrop is PAINTED, not cropped. A painted plate has to be framed by hand and every reframe
// moves its content somewhere new relative to the bird - the v0.30.723 plate needed zoom 1.34 and a
// 16% downward shift just to keep its horizon off his shins, and its glow still landed behind his
// legs. scripts/gen_icon_gate.mjs instead draws the gate around the geometry measured FROM the
// subject (disc r=236 at 256,275; decoration only in the four pockets his distance transform leaves
// clear), so there is nothing left to frame and nothing to tone-correct after the fact.
const flat = await sharp(await gatePng()).flatten({ background: '#141024' }).png().toBuffer();
console.log(`backdrop: painted gate ${S}x${S} (scripts/gen_icon_gate.mjs)`);

const roundMask = await sharp(Buffer.from(
  `<svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg"><rect width="${S}" height="${S}" rx="${RADIUS}" fill="#fff"/></svg>`),
  { density: 200 }).resize(S, S).png().toBuffer();

const out512 = await sharp(flat)
  .composite([{ input: birdPng, left: 0, top: 0 }, { input: roundMask, left: 0, top: 0, blend: 'dest-in' }])
  .png().toBuffer();
await writeFile(join(TMP, 'icon512.png'), out512);

// The 184 variant is full-bleed (no rounding) - it is used where the platform draws its own frame.
// Composited at 512 and downscaled as a SECOND pipeline on purpose: sharp resizes before it
// composites, so doing both in one chain would shrink the plate to 184 and then refuse the 512 bird.
const full512 = await sharp(flat).composite([{ input: birdPng, left: 0, top: 0 }])
  .flatten({ background: '#141024' }).png().toBuffer();
const out184 = await sharp(full512).resize(184, 184, { kernel: 'lanczos3' })
  .jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toBuffer();
await writeFile(join(TMP, 'icon184.jpg'), out184);

if (has('--write')) {
  await writeFile(SUBJECT, birdPng);
  await writeFile(SRC_ICON, out512);
  await writeFile(join(ROOT, 'assets', 'mojiworld_icon_184.jpg'), out184);
  console.log('wrote assets/mojiworld_icon_512.png, assets/mojiworld_icon_184.jpg, assets/mojiworld_icon_guguma.png (subject)');
} else {
  console.log('previews in ' + TMP + '  (--write to install)');
}
