#!/usr/bin/env node
// Normalise Taur's charge set onto the True-Size box the other states obey.
// ============================================================================
// Per user (video): "ensure that the size of the taurus is consistent".
// Measured: walk/attack/idle all hold 0.98-1.05x the portrait's opaque body
// area with content bottom on the canvas floor (1401-1417 of 1417); the charge
// set ships at 0.74-0.77x AREA (~87% linear) with its content floating at
// 1342-1356 — so the instant the brace-dash started, the bull shrank ~13% and
// lifted ~65px, and popped back at the end.
//
// ONE shared scale and ONE shared translate for the whole set — per-frame
// snapping would normalise away the authored gallop bounce (the frames
// deliberately lift the body between strides; the 14px spread across their
// bottoms IS the bounce). x1.15 lands the mean area at ~1.00x and provably
// fits: max content width 1230 x 1.15 = 1414.5 <= 1417, and the shared
// translate puts the set's LOWEST content bottom on the walk set's floor.
//
//   node scripts/normalise_taurus_charge.mjs            # report only
//   node scripts/normalise_taurus_charge.mjs --write    # atomic in-place
import sharp from 'sharp';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'Sprites', 'bosses', 'zodiac', 'charge');
const WRITE = process.argv.includes('--write');
const SCALE = 1.15;
const FLOOR = 1417;          // the walk/idle sets' content bottom = canvas bottom
const N = 9;

const box = async (buf) => {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0, x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++)
    if (data[(y * info.width + x) * 4 + 3] > 24) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { area: n, x0, y0, x1, y1, W: info.width, H: info.height };
};

const frames = [];
for (let i = 0; i < N; i++) {
  const p = join(DIR, `taurus_${i}.webp`);
  const buf = await readFile(p);
  frames.push({ p, buf, m: await box(buf) });
}
const maxBot = Math.max(...frames.map((f) => f.m.y1 + 1));
const W0 = frames[0].m.W, H0 = frames[0].m.H;
// shared transform: ONE left/top for every frame. Horizontally, centre the
// UNION of the scaled content (the set is right-heavy — centring the canvas
// clipped six frames on the right edge); vertically, the set's lowest scaled
// bottom lands on FLOOR. Relative inter-frame motion is untouched.
const minX0s = Math.min(...frames.map((f) => f.m.x0)) * SCALE;
const maxX1s = Math.max(...frames.map((f) => f.m.x1 + 1)) * SCALE;
const left = Math.round((W0 - (maxX1s - minX0s)) / 2 - minX0s);
const top = Math.round(FLOOR - maxBot * SCALE);
console.log(`set: maxBot ${maxBot}, scale ${SCALE}, shared left ${left}, top ${top}`);
let fits = true;
for (const f of frames) {
  const sx0 = Math.round(f.m.x0 * SCALE + left), sx1 = Math.round((f.m.x1 + 1) * SCALE + left);
  const sy0 = Math.round(f.m.y0 * SCALE + top), sy1 = Math.round((f.m.y1 + 1) * SCALE + top);
  const ok = sx0 >= 0 && sx1 <= W0 && sy0 >= 0 && sy1 <= H0;
  if (!ok) fits = false;
  console.log(`${f.p.split(/[\\/]/).pop()}  content -> [${sx0},${sy0}]..[${sx1},${sy1}]  ${ok ? 'ok' : 'CLIPS'}`);
}
if (!fits) { console.error('ABORT: a frame would clip — lower SCALE'); process.exit(1); }
if (!WRITE) { console.log('(report only — re-run with --write)'); process.exit(0); }

for (const f of frames) {
  // the scaled image is LARGER than the canvas and sharp's composite refuses
  // oversized inputs — so cut the canvas-sized window out of the scaled image
  // (left/top are negative, so the window is interior; the fit check above
  // already proved no content lives outside it).
  const sw = Math.round(W0 * SCALE), sh = Math.round(H0 * SCALE);
  const out = await sharp(f.buf).ensureAlpha()
    .resize(sw, sh, { fit: 'fill' })
    .extract({ left: -left, top: -top, width: W0, height: H0 })
    .webp({ quality: 94, alphaQuality: 100, effort: 6 }).toBuffer();
  await writeFile(f.p + '.tmp', out);
  await rename(f.p + '.tmp', f.p);
}
console.log('rewritten in place (atomic). Verify: re-run without --write, expect area ~1.0x of portrait via the audit that found this.');
