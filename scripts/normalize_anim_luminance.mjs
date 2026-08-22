#!/usr/bin/env node
// Flatten a frame set's brightness so a loop stops PULSING.
// ============================================================================
// A ludo-generated loop can come back with the right poses but the wrong
// exposure: one or two frames render a stop darker than the rest, and at 60 fps
// that reads as a flicker or a heartbeat rather than an idle. Measured on
// gravitos3's idle, where frames 4 and 5 sat at 56.5 and 60.5 mean opaque
// luminance against a ~64 baseline — a range of 8.5, where form 1 and form 2's
// idles measure 0.9 and 0.6.
//
// The fix is exposure-only: every frame's RGB is scaled by one constant so its
// mean opaque luminance lands on the SET'S MEDIAN. Poses, silhouette, hue and
// alpha are untouched, so it repairs the flicker without redrawing art anyone
// asked to keep. Frames already near the median are left byte-identical.
//
//   node scripts/normalize_anim_luminance.mjs <dir> <key>          # report only
//   node scripts/normalize_anim_luminance.mjs <dir> <key> --apply
//   e.g. ... Sprites/bosses/idle gravitos3 --apply
// Flags: --frames N (default 9) · --tol N (skip frames within N of median, default 0.5)
import sharp from 'sharp';
import { writeFile, rename } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--frames', '--tol'].includes(argv[i - 1])));
const [dir, key] = positional;
if (!dir || !key) { console.error('usage: normalize_anim_luminance.mjs <dir> <key> [--apply]'); process.exit(2); }
const N = Number(arg('--frames', 9));
const TOL = Number(arg('--tol', 0.5));

// Mean luminance over OPAQUE pixels only — transparent margin must not drag
// the average, or a frame whose figure merely sits wider reads as "brighter".
async function measure(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const C = info.channels;
  let sum = 0, n = 0;
  for (let i = 0; i < data.length; i += C) {
    if (data[i + 3] <= 16) continue;
    sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    n++;
  }
  return { lum: n ? sum / n : 0, data, info };
}

const files = Array.from({ length: N }, (_, i) => join(repoRoot, dir, `${key}_${i}.webp`));
const frames = [];
for (const f of files) frames.push({ f, ...(await measure(f)) });
const lums = frames.map((x) => x.lum);
const sorted = [...lums].sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)];
const range = Math.max(...lums) - Math.min(...lums);

console.log(`${dir}/${key}_0..${N - 1}`);
console.log('  per-frame mean opaque luminance: ' + lums.map((x) => x.toFixed(1)).join('  '));
console.log(`  median ${median.toFixed(2)}   range ${range.toFixed(2)}`);
if (!has('--apply')) { console.log('\n  (report only — pass --apply to rewrite)'); process.exit(0); }

let touched = 0, clippedTotal = 0;
for (const fr of frames) {
  const k = median / (fr.lum || 1);
  if (Math.abs(fr.lum - median) <= TOL) { console.log(`  ${fr.f.split(/[\\/]/).pop()}  x${k.toFixed(4)}  within tolerance — untouched`); continue; }
  const { data, info } = fr;
  const C = info.channels;
  let clipped = 0;
  for (let i = 0; i < data.length; i += C) {
    if (data[i + 3] <= 16) continue;              // leave fully transparent pixels alone
    for (let c = 0; c < 3; c++) {
      const v = data[i + c] * k;
      if (v > 255) clipped++;
      data[i + c] = v > 255 ? 255 : Math.round(v);
    }
  }
  const out = await sharp(data, { raw: { width: info.width, height: info.height, channels: C } })
    .webp({ quality: 92, alphaQuality: 100 }).toBuffer();
  await writeFile(fr.f + '.tmp', out);
  await rename(fr.f + '.tmp', fr.f);
  clippedTotal += clipped;
  touched++;
  console.log(`  ${fr.f.split(/[\\/]/).pop()}  x${k.toFixed(4)}  rewritten (${clipped} channel values clipped)`);
}

// Re-measure so the result is asserted, not assumed.
const after = [];
for (const f of files) after.push((await measure(f)).lum);
const range2 = Math.max(...after) - Math.min(...after);
console.log('\n  after: ' + after.map((x) => x.toFixed(1)).join('  '));
console.log(`  range ${range.toFixed(2)} -> ${range2.toFixed(2)}   (${touched} frames rewritten, ${clippedTotal} channel values clipped)`);
if (range2 > Math.max(TOL * 2, range * 0.25)) { console.error('  FAILED to flatten the set'); process.exit(1); }
console.log('  OK');
