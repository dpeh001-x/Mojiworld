#!/usr/bin/env node
// Kill residual jitter in a generated FX loop by re-centring every frame.
// =============================================================================
// Even with a motion prompt that explicitly says the subject is LOCKED IN PLACE,
// the generator drifts it: archbishop_grail measured 3.07px of alpha-centroid
// wander across its 9 frames (on a 128px yardstick) over two separate rolls.
// That wander is what reads as jitter — the effect appears to wobble even
// though its pacing is even.
//
// This shifts each frame by whole pixels so its alpha centroid matches the
// loop mean. Whole-pixel shifts only: no resampling, so the artwork is never
// softened. Frames live on a padded canvas, so a few px of translation cannot
// push content off the edge — and it is verified afterwards regardless.
//
//   node tools/stabilize_fx_anim.mjs <key> [--max 12] [--dry]
// Operates on Sprites/fx/anim/<key>_0..8.webp in place.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(root, 'Sprites', 'fx', 'anim');
const argv = process.argv.slice(2);
const key = argv.find((a) => !a.startsWith('--'));
const flag = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const MAX = Number(flag('--max', 12));
const DRY = argv.includes('--dry');
const N = 9;
if (!key) { console.error('usage: stabilize_fx_anim.mjs <key> [--max 12] [--dry]'); process.exit(1); }

const paths = [];
for (let i = 0; i < N; i++) {
  const p = join(DIR, `${key}_${i}.webp`);
  if (!existsSync(p)) { console.error(`missing ${p}`); process.exit(1); }
  paths.push(p);
}

// centroid of the alpha channel, in full-resolution px
const load = async (p) => {
  const { data, info } = await sharp(readFileSync(p)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height, C: info.channels };
};
const centroid = ({ data, W, H, C }) => {
  let cx = 0, cy = 0, m = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = data[(y * W + x) * C + 3] / 255;
    cx += x * a; cy += y * a; m += a;
  }
  return { cx: cx / m, cy: cy / m, mass: m };
};

const frames = [];
for (const p of paths) frames.push(await load(p));
const cents = frames.map(centroid);
const meanX = cents.reduce((s, c) => s + c.cx, 0) / N;
const meanY = cents.reduce((s, c) => s + c.cy, 0) / N;
const before = Math.max(...cents.map((c) => Math.hypot(c.cx - cents[0].cx, c.cy - cents[0].cy)));
console.log(`${key}: ${frames[0].W}x${frames[0].H}, centroid spread before ${before.toFixed(2)}px (full-res)`);

const shifts = cents.map((c) => ({
  dx: Math.max(-MAX, Math.min(MAX, Math.round(meanX - c.cx))),
  dy: Math.max(-MAX, Math.min(MAX, Math.round(meanY - c.cy))),
}));
console.log('  shifts ' + shifts.map((s, i) => `${i}:${s.dx >= 0 ? '+' : ''}${s.dx},${s.dy >= 0 ? '+' : ''}${s.dy}`).join('  '));
if (DRY) { console.log('  --dry: nothing written.'); process.exit(0); }

for (let i = 0; i < N; i++) {
  const { dx, dy } = shifts[i];
  const f = frames[i];
  if (dx === 0 && dy === 0) continue;
  const out = Buffer.alloc(f.W * f.H * 4);           // transparent
  for (let y = 0; y < f.H; y++) {
    const sy = y - dy;
    if (sy < 0 || sy >= f.H) continue;
    for (let x = 0; x < f.W; x++) {
      const sx = x - dx;
      if (sx < 0 || sx >= f.W) continue;
      const s = (sy * f.W + sx) * f.C, o = (y * f.W + x) * 4;
      out[o] = f.data[s]; out[o + 1] = f.data[s + 1]; out[o + 2] = f.data[s + 2]; out[o + 3] = f.data[s + 3];
    }
  }
  // guard: a shift must not push artwork off the canvas
  let edge = 0;
  for (let x = 0; x < f.W; x++) { edge = Math.max(edge, out[x * 4 + 3], out[((f.H - 1) * f.W + x) * 4 + 3]); }
  for (let y = 0; y < f.H; y++) { edge = Math.max(edge, out[(y * f.W) * 4 + 3], out[(y * f.W + f.W - 1) * 4 + 3]); }
  if (edge > 12) { console.error(`ABORT: frame ${i} would clip (edge alpha ${edge})`); process.exit(1); }
  const tmp = paths[i] + '.tmp.webp';
  writeFileSync(tmp, await sharp(out, { raw: { width: f.W, height: f.H, channels: 4 } }).webp({ quality: 92 }).toBuffer());
  for (let t = 0; ; t++) {                            // OneDrive EBUSY retry
    try { renameSync(tmp, paths[i]); break; }
    catch (e) {
      if ((e.code !== 'EBUSY' && e.code !== 'EPERM') || t > 12) { try { unlinkSync(tmp); } catch {} throw e; }
      const until = Date.now() + 200; while (Date.now() < until) { /* spin */ }
    }
  }
}

const after = [];
for (const p of paths) after.push(centroid(await load(p)));
const spread = Math.max(...after.map((c) => Math.hypot(c.cx - after[0].cx, c.cy - after[0].cy)));
console.log(`  centroid spread after  ${spread.toFixed(2)}px  (was ${before.toFixed(2)}px)`);
