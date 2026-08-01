// v0.29.322 — convert backgrounds/*.png (+ backgrounds/tiles/*.png) to WebP.
// The boot gate gates the world on 212 MB of art, and ~150 MB of that is
// full-screen painterly PNG — the exact content class WebP compresses 85-90%
// with no visible loss at game resolution.
//
// Safety per file: encode → decode the OUTPUT back and check dimensions match
// → require a real size win (webp < 70% of png) → only then keep it. Files
// that fail any check keep their PNG and are reported. The reference rewrite
// in the game file is driven by the list of files that ACTUALLY converted,
// so a skipped file can never leave a dangling path.
//
//   node scripts/convert_backgrounds_webp.mjs          # dry-run report
//   node scripts/convert_backgrounds_webp.mjs --write  # convert + keep webp
import sharp from 'sharp';
import { readdirSync, statSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
sharp.cache(false);

const WRITE = process.argv.includes('--write');
const QUALITY = 82;
const DIRS = ['backgrounds', 'backgrounds/tiles', 'backgrounds/Expedition'];
const results = [];

for (const dir of DIRS) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) {
    if (!/\.png$/i.test(f)) continue;
    const src = join(dir, f);
    const dst = src.replace(/\.png$/i, '.webp');
    const inBytes = statSync(src).size;
    const row = { src, dst, inBytes, outBytes: null, ok: false, reason: '' };
    results.push(row);
    if (!WRITE) continue;
    try {
      const img = sharp(src);
      const meta = await img.metadata();
      // near-lossless for tiles (they repeat side by side — seams would show);
      // standard quality for the big one-off paintings.
      const isTile = dir.endsWith('tiles');
      await img.webp({ quality: isTile ? 90 : QUALITY, effort: 4, alphaQuality: 100 }).toFile(dst);
      const back = await sharp(dst).metadata();
      if (back.width !== meta.width || back.height !== meta.height) {
        row.reason = 'dimension mismatch after encode'; unlinkSync(dst); continue;
      }
      row.outBytes = statSync(dst).size;
      if (row.outBytes >= inBytes * 0.7) {
        row.reason = 'insufficient win (' + Math.round(row.outBytes / inBytes * 100) + '%)';
        unlinkSync(dst); row.outBytes = null; continue;
      }
      row.ok = true;
    } catch (e) {
      row.reason = String(e).slice(0, 80);
      try { if (existsSync(dst)) unlinkSync(dst); } catch (e2) {}
    }
  }
}

let inT = 0, outT = 0, okN = 0;
for (const r of results) {
  inT += r.inBytes;
  if (r.ok) { outT += r.outBytes; okN++; }
}
console.log((WRITE ? 'CONVERTED' : 'DRY RUN') + `: ${okN}/${results.length} files`);
console.log(`png total:  ${(inT / 1048576).toFixed(1)} MB`);
if (WRITE) {
  console.log(`webp total: ${(outT / 1048576).toFixed(1)} MB  (${Math.round(outT / Math.max(1, inT) * 100)}% of original for converted files)`);
  const failed = results.filter(r => !r.ok);
  if (failed.length) {
    console.log('\nNOT converted (kept png):');
    for (const r of failed) console.log('  ' + r.src + '  — ' + r.reason);
  }
  // biggest wins
  console.log('\nsample wins:');
  for (const r of results.filter(x => x.ok).sort((a, b) => b.inBytes - a.inBytes).slice(0, 8)) {
    console.log('  ' + r.src + '  ' + (r.inBytes / 1048576).toFixed(1) + ' MB -> ' + (r.outBytes / 1024).toFixed(0) + ' KB');
  }
}
