#!/usr/bin/env node
// Inset a sprite and its animation frames so nothing touches the canvas edge.
//
//   node scripts/fit_sprite_frames.mjs <base.webp> <framesDir> <key> [--margin=0.06] [--write]
//
// Why this exists. ludo.ai composes to fill the frame, so a generated sprite
// routinely runs to the canvas edge — and every engine that draws it fitted to
// a box then shows a shaved outline. On mwrap the user could see it directly:
// "there seems to be a bit of cutoff". Re-prompting for "clear space on all
// four sides" does not reliably work (four candidates in a row came back at
// margin 0), so the framing is fixed here instead of asked for.
//
// The important part is that ONE transform is computed from the UNION of the
// base and every frame, then applied to all of them identically. Insetting each
// image on its own bbox would normalise away the very differences that make the
// animation — the ball would pulse in size as the loop played.
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
sharp.cache(false);

const [BASE, DIR, KEY, ...rest] = process.argv.slice(2);
if (!BASE || !DIR || !KEY) {
  console.error('usage: fit_sprite_frames.mjs <base.webp> <framesDir> <key> [--margin=0.06] [--write]');
  process.exit(2);
}
const opt = (n, d) => Number((rest.find(a => a.startsWith(`--${n}=`)) || `--${n}=${d}`).split('=')[1]);
const MARGIN = opt('margin', 0.06);          // fraction of the canvas to keep clear on every side
const WRITE = rest.includes('--write');

const bboxOf = async (p) => {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (data[(y * W + x) * C + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { W, H, x0, y0, x1, y1 };
};

const files = [BASE];
for (let i = 0; i < 9; i++) { const f = `${DIR}/${KEY}_${i}.webp`; if (existsSync(f)) files.push(f); }
const boxes = [];
for (const f of files) boxes.push({ f, b: await bboxOf(f) });
const W = boxes[0].b.W, H = boxes[0].b.H;
// the union box: what the whole set occupies across the loop
const U = boxes.reduce((a, { b }) => ({
  x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0),
  x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1),
}), { x0: W, y0: H, x1: -1, y1: -1 });
const uw = U.x1 - U.x0 + 1, uh = U.y1 - U.y0 + 1;
const availW = W * (1 - 2 * MARGIN), availH = H * (1 - 2 * MARGIN);
const scale = Math.min(1, availW / uw, availH / uh);
// centre the SCALED union in the canvas; every image gets this same map
const offX = (W - uw * scale) / 2 - U.x0 * scale;
const offY = (H - uh * scale) / 2 - U.y0 * scale;
console.log(`canvas ${W}x${H} | union ${uw}x${uh} at (${U.x0},${U.y0})`);
console.log(`shared transform: scale ${scale.toFixed(4)}, offset (${offX.toFixed(1)}, ${offY.toFixed(1)}), target margin ${(MARGIN * 100).toFixed(0)}%`);
if (scale >= 0.999) { console.log('already fits with margin — nothing to do'); process.exit(0); }

for (const { f } of boxes) {
  const scaled = await sharp(f).ensureAlpha()
    .resize(Math.max(1, Math.round(W * scale)), Math.max(1, Math.round(H * scale)), { fit: 'fill' })
    .png().toBuffer();
  // where the scaled full canvas must land so the union ends up centred
  const left = Math.round(offX), top = Math.round(offY);
  const out = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: scaled, left, top }])
    .webp({ quality: 92, alphaQuality: 100, effort: 6 }).toBuffer();
  if (WRITE) await writeFile(f, out);
  const probe = WRITE ? await bboxOf(f) : null;
  console.log(`  ${WRITE ? 'wrote' : 'would write'} ${f.split('/').pop()}`
    + (probe ? `  margins l${probe.x0} r${W - 1 - probe.x1} t${probe.y0} b${H - 1 - probe.y1}` : ''));
}
if (!WRITE) console.log('\ndry run — re-run with --write to apply.');
