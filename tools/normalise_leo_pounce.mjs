#!/usr/bin/env node
// Normalise the staged pounce frames: one facing, airborne only, contiguous.
// =============================================================================
// The airborne re-roll produced good frames but two defects that would ship as
// bugs:
//
//   FACING. sprite-animate does not hold a heading, so the set flips direction
//   partway through. The renderer mirrors by m.facing, so an authored flip
//   mid-set makes the lion turn around in mid-air. Detected by silhouette
//   thickness — see the note on measure() for why the obvious colour-based
//   test does not work on this particular lion.
//
//   A REARED FRAME. One frame came back at silhouette aspect 1.00 — the same
//   rear the whole exercise exists to get away from. Frames below the airborne
//   threshold are dropped rather than shipped.
//
// Survivors are renumbered CONTIGUOUSLY, because the loader walks leo_0, leo_1,
// ... and stops at the first gap: a hole at index 3 would silently truncate the
// set to three frames, which is exactly where this started.
//
//   node tools/normalise_leo_pounce.mjs            # report only
//   node tools/normalise_leo_pounce.mjs --write
// =============================================================================
import sharp from 'sharp';
import { readdir, writeFile, rename, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STAGE = join(ROOT, 'scripts', '_style_pack', 'leo_pounce_air');
const WRITE = process.argv.includes('--write');
const AIRBORNE_MIN = 1.15;

// Facing by SILHOUETTE THICKNESS, not colour.
//
// The first version compared the centroid of saturated red/orange pixels (the
// mane) against the body centroid, and it was wrong: Regulus has a FIRE-TIPPED
// TAIL in the same hue family at the opposite end, which dragged the "mane"
// centroid back toward the middle. The two centroids landed 7px apart on a
// 1360px canvas — noise — and it called a visibly left-facing frame "right".
//
// Thickness has no such confound. A maned lion is deep at the head and thin at
// the tail, whatever colour anything is: compare the mean column height of the
// outer third at each end and the heavy end is the head.
const measure = async (file) => {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const colTop = new Int32Array(info.width).fill(-1);
  const colBot = new Int32Array(info.width).fill(-1);
  let top = -1, bot = -1, l = -1, r = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] <= 24) continue;
      if (top < 0) top = y; bot = y;
      if (l < 0 || x < l) l = x; if (x > r) r = x;
      if (colTop[x] < 0) colTop[x] = y;
      colBot[x] = y;
    }
  }
  if (top < 0 || r <= l) return null;
  const span = r - l + 1;
  const third = Math.max(1, Math.floor(span / 3));
  const meanH = (from, to) => {
    let sum = 0, n = 0;
    for (let x = from; x <= to; x++) {
      if (colTop[x] < 0) continue;
      sum += (colBot[x] - colTop[x] + 1); n++;
    }
    return n ? sum / n : 0;
  };
  const leftH = meanH(l, l + third - 1);
  const rightH = meanH(r - third + 1, r);
  return {
    ar: span / (bot - top + 1),
    leftH, rightH,
    facesLeft: leftH > rightH,       // the deep end is the maned end
  };
};

const files = (await readdir(STAGE)).filter(f => /^leo_\d+\.webp$/.test(f))
  .sort((a, b) => (+a.match(/\d+/)[0]) - (+b.match(/\d+/)[0]));
if (!files.length) { console.error('ABORT: no staged frames'); process.exit(1); }

console.log('frame  aspect  leftH  rightH  faces   verdict');
const keep = [];
for (const f of files) {
  const m = await measure(join(STAGE, f));
  if (!m) { console.log(`${f.padEnd(12)} (unreadable)  DROP`); continue; }
  const airborne = m.ar >= AIRBORNE_MIN;
  const verdict = airborne ? (m.facesLeft ? 'keep' : 'keep (mirror)') : 'DROP — reared';
  console.log(`${f.padEnd(12)} ${m.ar.toFixed(2)}  ${m.leftH.toFixed(0).padStart(5)}  ${m.rightH.toFixed(0).padStart(6)}  ${(m.facesLeft ? 'left' : 'right').padEnd(6)} ${verdict}`);
  if (airborne) keep.push({ f, mirror: !m.facesLeft });
}
console.log(`\n${keep.length} of ${files.length} survive; ${keep.filter(k => k.mirror).length} need mirroring`);
if (!WRITE) { console.log('(report only — re-run with --write)'); process.exit(0); }

// Build to temp names first so a half-finished renumber can never leave the
// staged set with a gap in it.
const built = [];
for (let i = 0; i < keep.length; i++) {
  const { f, mirror } = keep[i];
  let img = sharp(join(STAGE, f));
  if (mirror) img = img.flop();
  const buf = await img.webp({ quality: 94 }).toBuffer();
  const tmp = join(STAGE, `_norm_${i}.webp`);
  await writeFile(tmp, buf);
  built.push(tmp);
}
for (const f of files) await unlink(join(STAGE, f)).catch(() => {});
for (let i = 0; i < built.length; i++) await rename(built[i], join(STAGE, `leo_${i}.webp`));
console.log(`wrote leo_0..leo_${built.length - 1}.webp — one facing, contiguous`);

// Fresh contact sheet of the normalised set.
const meta = await sharp(join(STAGE, 'leo_0.webp')).metadata();
const TH = 220, TW = Math.round(meta.width * (TH / meta.height));
const cols = Math.min(5, built.length), rows = Math.ceil(built.length / cols);
const tiles = [];
for (let i = 0; i < built.length; i++) {
  tiles.push({ input: await sharp(join(STAGE, `leo_${i}.webp`)).resize(TW, TH).png().toBuffer(),
               left: (i % cols) * TW, top: Math.floor(i / cols) * TH });
}
await sharp({ create: { width: TW * cols, height: TH * rows, channels: 4, background: { r: 24, g: 20, b: 30, alpha: 255 } } })
  .composite(tiles).png().toFile(join(STAGE, 'contact_sheet.png'));
console.log('contact_sheet.png rebuilt');
