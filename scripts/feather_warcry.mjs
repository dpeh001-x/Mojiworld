#!/usr/bin/env node
// Feather War Cry's shout-wave at its circumference.
//
//   node scripts/feather_warcry.mjs            # report only
//   node scripts/feather_warcry.mjs --write    # write the feathered plates to OUT_DIR
//
// v0.30.x — per user: "For warcry sprite animation, the edges seem to be abruptly cut off, make
// sure it is feathered smooth radially" / "feathered at the circumference".
//
// They are right, and it is measurable rather than a matter of taste. The generated set draws its
// expanding rings all the way into the corners of its own canvas, so the SQUARE boundary is what
// ends the wave. Measured on the shipped plates, mean alpha along the outermost two-pixel border:
//
//     warcry_0  0.2      (fine - the wave has not reached the edge yet)
//     warcry_4  132.9    (half-opaque, sliced straight off)
//     warcry_8  130.1
//
// Simply multiplying by a radial falloff would fix the cut by eating the outer third of the art.
// So the wave is first SHRUNK into its own canvas (CONTENT_SCALE) to buy transparent margin, and
// the falloff then lives in margin that was empty anyway. The caller compensates by drawing the
// sprite 1/CONTENT_SCALE larger, so nothing changes size on screen - this is a change to where the
// alpha goes, not to how big the roar is.
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
sharp.cache(false);

const IN = process.env.IN_DIR, OUT = process.env.OUT_DIR;
if (!IN) { console.error('IN_DIR required'); process.exit(1); }
const WRITE = process.argv.includes('--write');

const CONTENT_SCALE = 0.86;   // the wave, inside its own canvas
const FEATHER_IN = 0.80;      // fully opaque out to here (fraction of half-width)
const FEATHER_OUT = 0.985;    // fully transparent by here - inside the square, so no corner is cut

const files = ['warcry.webp'];
for (let i = 0; i < 9; i++) files.push(`warcry_${i}.webp`);

// alpha along the outermost 2px border, and the mean alpha per radial band
async function profile(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, cx = W / 2, cy = H / 2, R = W / 2;
  const bands = new Array(10).fill(0), cnt = new Array(10).fill(0);
  let edge = 0, edgeN = 0, ink = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = data[y * W + x];
    const b = Math.min(9, Math.floor((Math.hypot(x - cx, y - cy) / R) * 10));
    bands[b] += a; cnt[b]++;
    if (a > 24) ink++;
    if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) { edge += a; edgeN++; }
  }
  return { border: edge / edgeN, bands: bands.map((s, i) => Math.round(s / Math.max(1, cnt[i]))), ink: ink / (W * H) };
}

if (WRITE) await mkdir(OUT, { recursive: true });
console.log(`content x${CONTENT_SCALE}, feather ${FEATHER_IN} -> ${FEATHER_OUT} of the half-width\n`);
let worstBefore = 0, worstAfter = 0;
for (const f of files) {
  const p = join(IN, f);
  if (!existsSync(p)) { console.error('missing ' + f); process.exit(1); }
  const src = await readFile(p);
  const meta = await sharp(src).metadata();
  const S = meta.width;
  const before = await profile(src);

  // 1. shrink the wave inside its own canvas so the falloff has empty margin to live in
  const inner = Math.round(S * CONTENT_SCALE);
  const padded = await sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp(src).ensureAlpha().resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
                  left: Math.round((S - inner) / 2), top: Math.round((S - inner) / 2) }])
    .png().toBuffer();

  // 2. multiply alpha by a smoothstep radial falloff, zero before the square edge
  const { data: rgba, info } = await sharp(padded).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cx = info.width / 2, cy = info.height / 2, R = info.width / 2;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      if (!rgba[i + 3]) continue;
      const d = Math.hypot(x - cx, y - cy) / R;
      let k;
      if (d <= FEATHER_IN) k = 1;
      else if (d >= FEATHER_OUT) k = 0;
      else { const t = (d - FEATHER_IN) / (FEATHER_OUT - FEATHER_IN); k = 1 - (t * t * (3 - 2 * t)); }   // smoothstep
      rgba[i + 3] = Math.round(rgba[i + 3] * k);
    }
  }
  const outBuf = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 94 }).toBuffer();
  const after = await profile(outBuf);
  worstBefore = Math.max(worstBefore, before.border);
  worstAfter = Math.max(worstAfter, after.border);
  console.log(`${f.padEnd(14)} border ${before.border.toFixed(1).padStart(6)} -> ${after.border.toFixed(2).padStart(5)}   ink ${(before.ink * 100).toFixed(1)}% -> ${(after.ink * 100).toFixed(1)}%`);
  console.log(`               bands ${before.bands.map((b) => String(b).padStart(3)).join(' ')}`);
  console.log(`                  -> ${after.bands.map((b) => String(b).padStart(3)).join(' ')}`);
  if (WRITE) await writeFile(join(OUT, f), outBuf);
}
console.log(`\nworst border alpha: ${worstBefore.toFixed(1)} -> ${worstAfter.toFixed(2)}`);
if (worstAfter > 1) { console.error('REFUSING: the circumference is still not clean.'); process.exit(2); }
console.log(WRITE ? `written to ${OUT}` : '(report only — pass --write)');
