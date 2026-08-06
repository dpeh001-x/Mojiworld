#!/usr/bin/env node
// Fade a directional FX sprite's trailing edge so it can never read as "cut off".
// =============================================================================
// Speed-trail art keeps coming back from the generator with its tails ending on
// a flat vertical boundary â€” the canvas edges measure clean, so it is not
// clipping, the streaks are simply DRAWN with blunt ends. Re-rolling the prompt
// is a dice throw; this is deterministic.
//
// Applies a smoothstep alpha ramp across the first `--ramp` px of the content,
// on the chosen side, so the trail dissolves into nothing. Pixels beyond the
// ramp are untouched, so the solid part of the effect (chevrons, core shapes)
// is never dimmed.
//
//   node tools/feather_fx_tail.mjs <png|webp> [--side left|right|top|bottom]
//                                             [--ramp 80] [--out FILE]
// Writes atomically (tmp -> verify -> rename).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
import { renameSync, unlinkSync, existsSync, readFileSync } from 'node:fs';
// This repo lives under OneDrive, which intermittently holds a handle on a file
// just after it is written â€” a bare renameSync onto the target throws EBUSY.
// Retry briefly rather than leaving a .tmp behind and the fix unapplied.
const renameRetry = (from, to, tries = 12) => {
  for (let i = 0; ; i++) {
    try { renameSync(from, to); return; }
    catch (e) {
      if (e.code !== 'EBUSY' && e.code !== 'EPERM') throw e;
      if (i >= tries) throw e;
      const until = Date.now() + 200;
      while (Date.now() < until) { /* brief spin */ }
    }
  }
};

const [src, ...flags] = process.argv.slice(2);
if (!src || !existsSync(src)) { console.error('usage: feather_fx_tail.mjs <file> [--side left] [--ramp 80]'); process.exit(1); }
const flag = (f, d) => { const i = flags.indexOf(f); return i >= 0 ? flags[i + 1] : d; };
const SIDE = flag('--side', 'left');
const RAMP = Number(flag('--ramp', 80));
const OUT = flag('--out', src);
const isWebp = /\.webp$/i.test(OUT);

const { data, info } = await sharp(readFileSync(src)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, C = info.channels;
const A = (x, y) => data[(y * W + x) * C + 3];

// content bbox â€” the ramp is measured from the ART, not the canvas
let x0 = W, y0 = H, x1 = -1, y1 = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y) > 8) {
  if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
}
if (x1 < 0) { console.error('empty image'); process.exit(1); }

// coordinate along the fade axis, 0 at the outermost content edge
const axis = (x, y) => SIDE === 'left' ? x - x0 : SIDE === 'right' ? x1 - x
  : SIDE === 'top' ? y - y0 : y1 - y;
const smooth = (t) => t * t * (3 - 2 * t);          // smoothstep, no hard knee

const out = Buffer.alloc(W * H * 4);
let touched = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * C, o = (y * W + x) * 4;
  out[o] = data[i]; out[o + 1] = data[i + 1]; out[o + 2] = data[i + 2];
  const d = axis(x, y);
  if (d >= RAMP || data[i + 3] === 0) { out[o + 3] = data[i + 3]; continue; }
  const k = smooth(Math.max(0, d) / RAMP);
  const na = Math.round(data[i + 3] * k);
  if (na !== data[i + 3]) touched++;
  out[o + 3] = na;
}

const tmp = OUT + '.tmp.' + (isWebp ? 'webp' : 'png');
let img = sharp(out, { raw: { width: W, height: H, channels: 4 } });
await (isWebp ? img.webp({ quality: 92 }) : img.png()).toFile(tmp);
try {
  const tmpBuf = readFileSync(tmp);
  const m = await sharp(tmpBuf).metadata();
  if (m.width !== W || m.height !== H) throw new Error('size changed');
  const { data: vd, info: vi } = await sharp(tmpBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // nothing beyond the ramp may have changed
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (axis(x, y) < RAMP) continue;
    const a = data[(y * W + x) * C + 3], b = vd[(y * W + x) * vi.channels + 3];
    if (Math.abs(a - b) > 2) throw new Error(`pixel outside the ramp changed at ${x},${y}`);
  }
  // and the outermost content column/row must now be (near) transparent
  let edgeMax = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (axis(x, y) === 0) edgeMax = Math.max(edgeMax, vd[(y * W + x) * vi.channels + 3]);
  if (edgeMax > 12) throw new Error(`trailing edge still opaque (alpha ${edgeMax})`);
  console.log(`${src}`);
  console.log(`  content bbox x ${x0}-${x1} y ${y0}-${y1}   ramp ${RAMP}px from the ${SIDE}`);
  console.log(`  verified: ${touched} px faded, nothing beyond the ramp altered, trailing edge alpha ${edgeMax}`);
} catch (e) {
  try { unlinkSync(tmp); } catch {}
  console.error('VERIFY FAILED, target untouched â€” ' + e.message);
  process.exit(1);
}
renameRetry(tmp, OUT);
console.log(`  wrote ${OUT}`);
