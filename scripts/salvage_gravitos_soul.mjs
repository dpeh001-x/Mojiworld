#!/usr/bin/env node
// Salvage the Soul Drain frames from scripts/_tmp_soul_raw/.
//
// Four ludo.ai rolls produced good stance/settle frames but ALWAYS detonated a
// full-frame opaque blast mid-animation, regardless of prompt. Rather than
// roll a fifth time, this masks each frame's alpha with a feathered SHROUD
// built from the union of the CLEAN frames' silhouettes: energy hugging the
// body survives (that is the drain), the room-filling blast fades smoothly to
// nothing. Deterministic — same input, same output, no credits.
//   node scripts/salvage_gravitos_soul.mjs
import sharp from 'sharp';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(repoRoot, 'scripts', '_tmp_soul_raw');
const OUT_DIR = join(repoRoot, 'Sprites', 'bosses', 'attack');
const STATIC_OUT = join(repoRoot, 'Sprites', 'bosses', 'gravitossoul.webp');
const FRAMES = 9;

const files = (await readdir(RAW)).filter(f => /^raw_\d+\.png$/.test(f)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);
if (files.length < FRAMES) { console.error(`only ${files.length} raws`); process.exit(1); }

const raws = [];
for (const f of files.slice(0, FRAMES)) {
  const buf = await readFile(join(RAW, f));
  raws.push(await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true }));
}
const { width: W, height: H } = raws[0].info;
const px = W * H;

// 1. Clean frames = core bbox height under 85% (the blast frames are 100%).
const coreBh = (r) => {
  let minY = H, maxY = -1;
  for (let i = 0; i < px; i++) if (r.data[i * 4 + 3] > 200) { const y = (i / W) | 0; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return (maxY - minY + 1) / H;
};
const clean = [];
raws.forEach((r, i) => { const bh = coreBh(r); if (bh < 0.85) clean.push(i); console.log(`frame ${i}: core bh ${(bh * 100).toFixed(0)}%${bh < 0.85 ? '  (clean)' : ''}`); });
if (clean.length < 2) { console.error('not enough clean frames to build a shroud'); process.exit(1); }
console.log('shroud built from frames:', clean.join(', '));

// 2. Union silhouette of the clean frames -> blur -> gain = feathered shroud.
//    Blur sigma ~4% of width reaches ~120px past the silhouette; the x4 gain
//    turns the gaussian falloff into a wide soft plateau.
const union = Buffer.alloc(px);
for (const ci of clean) { const d = raws[ci].data; for (let i = 0; i < px; i++) if (d[i * 4 + 3] > 16) union[i] = 255; }
// extractChannel(0) is load-bearing: sharp silently promotes 1-channel raw to
// RGB on blur, which tripled the buffer and made every stride-1 read land in
// the wrong row — the first cut of this masked the entire animation to zero.
const blurred = await sharp(union, { raw: { width: W, height: H, channels: 1 } })
  .blur(W * 0.04).extractChannel(0).raw().toBuffer();
if (blurred.length !== px) { console.error(`mask buffer ${blurred.length} != ${px}`); process.exit(1); }
const mask = Buffer.alloc(px);
for (let i = 0; i < px; i++) mask[i] = Math.min(255, blurred[i] * 4);

// 3. Apply: out alpha = min(frame alpha, shroud). Clean frames pass through
//    nearly untouched (their own silhouette IS the mask's core); blast frames
//    keep a tight aura and lose the room.
await mkdir(OUT_DIR, { recursive: true });
const outStats = [];
for (let i = 0; i < FRAMES; i++) {
  const d = Buffer.from(raws[i].data);
  for (let p = 0; p < px; p++) d[p * 4 + 3] = Math.min(d[p * 4 + 3], mask[p]);
  const webp = await sharp(d, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
  await writeFile(join(OUT_DIR, `gravitossoul_${i}.webp`), webp);
  // re-measure the core for the report
  let minX = W, maxX = -1, minY = H, maxY = -1;
  for (let p = 0; p < px; p++) if (d[p * 4 + 3] > 200) { const x = p % W, y = (p / W) | 0; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  outStats.push({ i, bw: Math.round((maxX - minX + 1) / W * 100), bh: Math.round((maxY - minY + 1) / H * 100),
    edges: (minX <= 8 || minY <= 8 || maxX >= W - 9) ? 'TOUCHES L/R/T' : 'ok' });
}
// static = final settled frame
await writeFile(STATIC_OUT, await readFile(join(OUT_DIR, `gravitossoul_${FRAMES - 1}.webp`)));
for (const s of outStats) console.log(`out ${s.i}: core ${s.bw}%x${s.bh}%  ${s.edges}`);
const stillBad = outStats.filter(s => s.edges !== 'ok').length;
console.log(stillBad ? `\n${stillBad} frame(s) still touch an edge — inspect before shipping` : `\nOK -> ${FRAMES} shrouded frames + static at ${W}x${H}`);
process.exit(stillBad ? 2 : 0);
