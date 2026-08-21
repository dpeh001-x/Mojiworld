// The Gravitos form-2 STAR attack set has feathered edges and a stable body,
// per user: "regenerate gravitos 2 star animation attack, make sure that the
// edges are feathered well if there is some zoom in cutoff".
//
// What the previous set shipped: the model zoomed ~3x across the charge, so by
// frame 8 the legs were HARD-CUT at the bottom border — 450 fully-opaque
// pixels sitting ON the canvas edge — and the aura ended in a straight boxy
// line. The dark body itself grew 1227 -> 1437px with the feet drifting 105px
// down, so the looping attack snapped in size every cycle.
//
// Contract, graded by pixel measurement on all 9 frames + the static:
//   1. one canvas (1656x1505 — _drawBossSprite derives draw size from it);
//   2. EVERY border row/col is fully transparent (the feather guarantee: any
//      residual overshoot fades out instead of slicing off);
//   3. the dark-armour body (alpha > 200, luminance < 130 — the aura excluded)
//      holds one height with its feet pinned, per the repo's own gravitos
//      convention ("does not pulse across frames").
// Run: node scripts/gravitos_star_edge_test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'Sprites', 'bosses', 'attack');
const KEY = 'gravitos2star';
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  - ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

const files = [];
for (let i = 0; i < 9; i++) files.push(`${KEY}_${i}.webp`);
files.push(`${KEY}.webp`);

const measure = async (f) => {
  const { data, info } = await sharp(path.join(DIR, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const a = (x, y) => data[(y * W + x) * C + 3];
  let edge = 0;
  for (let x = 0; x < W; x++) edge = Math.max(edge, a(x, 0), a(x, H - 1));
  for (let y = 0; y < H; y++) edge = Math.max(edge, a(0, y), a(W - 1, y));
  let y0 = H, y1 = -1, x0 = W, x1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = (y * W + x) * C;
    const lum = 0.299 * data[k] + 0.587 * data[k + 1] + 0.114 * data[k + 2];
    if (data[k + 3] > 200 && lum < 130) { if (y < y0) y0 = y; if (y > y1) y1 = y; if (x < x0) x0 = x; if (x > x1) x1 = x; }
  }
  return { f, W, H, edge, bodyH: y1 - y0 + 1, foot: y1 };
};

const all = [];
for (const f of files) all.push(await measure(f));
const ref = all[0];
console.log('  ' + all.map((m) => `${m.f.replace(KEY, '#').replace('.webp', '')}: ${m.W}x${m.H} edge${m.edge} body${m.bodyH} foot${m.foot}`).join('\n  '));

check(all.every((m) => m.W === 1656 && m.H === 1505), 'CANVAS: all 10 files on the 1656x1505 canvas', all.map((m) => m.W + 'x' + m.H));
check(all.every((m) => m.edge <= 8),
      'FEATHER: no border pixel above alpha 8 on any of the four edges (was 255 on five frames + static)',
      all.filter((m) => m.edge > 8).map((m) => ({ f: m.f, edge: m.edge })));
check(all.every((m) => Math.abs(m.bodyH - ref.bodyH) <= ref.bodyH * 0.02),
      'BODY: dark-armour height uniform within 2% across the whole set (was a 17% swell)',
      all.map((m) => m.bodyH));
check(all.every((m) => Math.abs(m.foot - ref.foot) <= 8),
      'FEET: the body bottom pinned within 8px across the set (was a 105px drift)',
      all.map((m) => m.foot));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
