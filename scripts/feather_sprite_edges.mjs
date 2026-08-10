#!/usr/bin/env node
// Feather a sprite's edges all the way round (per user, for qte_break).
//
// The existing tools/feather_fx_tail.mjs ramps ONE side — right for a speed
// trail with a blunt tail, wrong for a radial burst whose every shard ends on
// a hard alpha cliff. This softens the whole silhouette: blur the alpha, then
// take min(original, blurred) so the edge fades OUT without the shape growing
// (a bare blur would bloom the sprite outward by the blur radius).
//
// Colour is untouched — only alpha moves — so the art keeps its saturation.
//   node scripts/feather_sprite_edges.mjs <files...> [--radius 3] [--measure-only]
// Writes atomically (tmp -> verify -> rename), with an EBUSY retry.
import sharp from 'sharp';
import fs from 'node:fs';
sharp.cache(false);
const argv = process.argv.slice(2);
const files = argv.filter((a) => !a.startsWith('--'));
const RADIUS = Number((argv.find((a) => a.startsWith('--radius=')) || '--radius=3').split('=')[1]);
const MEASURE = argv.includes('--measure-only');
if (!files.length) { console.error('usage: feather_sprite_edges.mjs <files...> [--radius=3] [--measure-only]'); process.exit(1); }

// A "hard edge" pixel: nearly opaque, but touching nearly-transparent. That is
// exactly the stair-stepped cliff a feather is meant to remove.
async function hardEdges(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const A = (x, y) => data[(y * W + x) * C + 3];
  let hard = 0, opaque = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const a = A(x, y);
    if (a < 200) continue;
    opaque++;
    if (A(x - 1, y) < 40 || A(x + 1, y) < 40 || A(x, y - 1) < 40 || A(x, y + 1) < 40) hard++;
  }
  return { hard, opaque, pct: opaque ? (hard / opaque) * 100 : 0 };
}

const renameRetry = (from, to, tries = 20) => {
  for (let i = 0; ; i++) {
    try { fs.renameSync(from, to); return; }
    catch (e) {
      if ((e.code !== 'EBUSY' && e.code !== 'EPERM') || i >= tries) throw e;
      const until = Date.now() + 150; while (Date.now() < until) { /* spin */ }
    }
  }
};

let totBefore = 0, totAfter = 0;
for (const f of files) {
  const src = fs.readFileSync(f);
  const before = await hardEdges(src);
  if (MEASURE) { console.log(`  ${f.split('/').pop().padEnd(22)} hard-edge ${before.hard.toString().padStart(6)} px (${before.pct.toFixed(1)}% of opaque)`); totBefore += before.hard; continue; }

  const meta = await sharp(src).metadata();
  const { width: W, height: H } = meta;
  // Stay in RAW the whole way. The first version encoded the extracted alpha
  // to a buffer and re-decoded it with .raw(): sharp handed back a 3-channel
  // greyscale, so the per-byte min() below compared misaligned data and
  // scrambled the alpha (hard-edge pixels went 4,213 -> 1,969,961 — caught
  // because the measurement runs before AND after, not on faith).
  const aRaw = await sharp(src).ensureAlpha().extractChannel(3)
    .raw().toBuffer();                                   // exactly W*H bytes
  // toColourspace('b-w') is load-bearing: blur() on a 1-channel raw input
  // hands back THREE channels otherwise, and the byte loop below would read
  // the blurred plane at 3x stride. The length guard caught exactly that.
  const sRaw = await sharp(aRaw, { raw: { width: W, height: H, channels: 1 } })
    .blur(RADIUS).toColourspace('b-w').raw().toBuffer();
  if (aRaw.length !== W * H || sRaw.length !== W * H) {
    throw new Error(`${f}: alpha plane ${aRaw.length}/${sRaw.length} bytes, expected ${W * H}`);
  }
  // min(original, blurred): softens the cliff, never expands the silhouette
  const out = Buffer.allocUnsafe(W * H);
  for (let i = 0; i < out.length; i++) out[i] = aRaw[i] < sRaw[i] ? aRaw[i] : sRaw[i];

  const rgb = await sharp(src).removeAlpha().raw().toBuffer();   // W*H*3
  const rgba = Buffer.allocUnsafe(W * H * 4);
  for (let p = 0; p < W * H; p++) {
    rgba[p * 4] = rgb[p * 3]; rgba[p * 4 + 1] = rgb[p * 3 + 1];
    rgba[p * 4 + 2] = rgb[p * 3 + 2]; rgba[p * 4 + 3] = out[p];
  }
  const feathered = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .webp({ quality: 92 }).toBuffer();

  const after = await hardEdges(feathered);
  fs.writeFileSync(f + '.tmp', feathered);
  const chk = await sharp(f + '.tmp').metadata();
  if (chk.width !== W || chk.height !== H) throw new Error(f + ': dims changed');
  if (!chk.hasAlpha) throw new Error(f + ': lost alpha');
  renameRetry(f + '.tmp', f);
  totBefore += before.hard; totAfter += after.hard;
  console.log(`  ${f.split('/').pop().padEnd(22)} hard-edge ${before.hard} -> ${after.hard} px  (${before.pct.toFixed(1)}% -> ${after.pct.toFixed(1)}%)`);
}
if (!MEASURE) console.log(`\ntotal hard-edge pixels ${totBefore} -> ${totAfter}  (${totBefore ? (100 - totAfter / totBefore * 100).toFixed(1) : 0}% removed, radius ${RADIUS})`);
