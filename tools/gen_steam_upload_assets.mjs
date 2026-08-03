#!/usr/bin/env node
// Steam upload-ready store art — exact-spec downscales of the 2x masters.
// =============================================================================
// tools/gen_steam_assets_v2.mjs renders most capsules at 2x (1232x706, 920x430,
// 462x174, 748x896, 3840x1240) as art of record. Steamworks validates capsule
// dimensions EXACTLY on upload and rejects anything off-spec, so those masters
// cannot be uploaded as-is. This emits steam/assets/upload/<name>.png at the
// published sizes, Lanczos-downscaled from the masters, leaving the masters
// untouched. Assets already authored at 1:1 are copied through unchanged.
//
//   node tools/gen_steam_upload_assets.mjs
//
// Exits non-zero if any output misses its spec, so it can gate a release.
// =============================================================================
import sharp from 'sharp';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'steam/assets';
const OUT = 'steam/assets/upload';

// name -> { w, h, label }  — Valve's published store/library dimensions.
const SPEC = {
  store_capsule_main:     { w: 616,  h: 353, label: 'Main capsule' },
  store_capsule_small:    { w: 231,  h: 87,  label: 'Small capsule' },
  store_capsule_header:   { w: 460,  h: 215, label: 'Header capsule' },
  store_capsule_vertical: { w: 374,  h: 448, label: 'Vertical capsule' },
  store_page_background:  { w: 1438, h: 810, label: 'Page background' },
  library_capsule:        { w: 600,  h: 900, label: 'Library capsule' },
  library_header:         { w: 460,  h: 215, label: 'Library header' },
  library_hero:           { w: 1920, h: 620, label: 'Library hero' },
  library_logo:           { w: 1280, h: 720, label: 'Library logo', fit: 'inside' },
};

await mkdir(OUT, { recursive: true });
console.log(`Steam upload assets -> ${OUT}\n`);
console.log('ASSET'.padEnd(24) + 'MASTER'.padEnd(13) + 'OUTPUT'.padEnd(12) + 'SIZE     NOTE');
console.log('-'.repeat(76));

let failed = 0;
for (const [name, spec] of Object.entries(SPEC)) {
  const src = join(SRC, `${name}.png`);
  if (!existsSync(src)) {
    console.log(`${name.padEnd(24)}${'MISSING'.padEnd(13)}${'-'.padEnd(12)}-        master not found`);
    failed++;
    continue;
  }
  const m = await sharp(src).metadata();
  const master = `${m.width}x${m.height}`;

  // The logo is a transparent wordmark sized to fit INSIDE a box — never
  // stretched to fill it, or the mark distorts.
  const img = spec.fit === 'inside'
    ? sharp(src).resize(spec.w, spec.h, { fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
    : sharp(src).resize(spec.w, spec.h, { fit: 'cover', position: 'centre', kernel: 'lanczos3' });

  // Capsules are opaque and must stay opaque; the logo keeps its alpha.
  const buf = spec.fit === 'inside'
    ? await img.png({ compressionLevel: 9 }).toBuffer()
    : await img.flatten({ background: '#100c28' }).png({ compressionLevel: 9 }).toBuffer();

  const dest = join(OUT, `${name}.png`);
  const tmp = dest + '.tmp';
  await writeFile(tmp, buf);
  const { rename } = await import('node:fs/promises');
  await rename(tmp, dest);

  const o = await sharp(dest).metadata();
  const kb = Math.round((await stat(dest)).size / 1024);
  const okDims = spec.fit === 'inside'
    ? (o.width <= spec.w && o.height <= spec.h)
    : (o.width === spec.w && o.height === spec.h);
  if (!okDims) failed++;
  const note = okDims
    ? (master === `${o.width}x${o.height}` ? 'copied 1:1' : `downscaled from ${master}`)
    : `WRONG — expected ${spec.w}x${spec.h}`;
  console.log(`${name.padEnd(24)}${master.padEnd(13)}${`${o.width}x${o.height}`.padEnd(12)}${(kb + 'KB').padEnd(9)}${note}`);
}

console.log('');
if (failed) {
  console.error(`${failed} asset(s) off-spec — do NOT upload.`);
  process.exit(1);
}
console.log('All store/library art matches Valve\'s dimensions. Upload from steam/assets/upload/.');
console.log('Still needed by hand: at least 5 screenshots at 1920x1080, and a trailer.');
