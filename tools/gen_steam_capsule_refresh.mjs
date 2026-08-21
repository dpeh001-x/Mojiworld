#!/usr/bin/env node
// Steam capsule refresh — title-only capsules and a bare wordmark logo.
// =============================================================================
// Store review rejected the Header Capsule, Main Capsule and Library Logo for
// "additional text": Valve allows ONLY game artwork, the game name, and an
// official subtitle on capsules, and the Library Logo may carry the title and
// nothing else.
//
// This installs a capsule set composed purely from live game art plus the
// MOJIWORLD wordmark, and rebuilds library_logo.png as the wordmark alone on
// transparency — trimmed to its own ink so no padding, plate or backing box
// travels with it.
//
//   node tools/gen_steam_capsule_refresh.mjs [variant]     (default: showdown)
//
// Then re-emit the exact upload sizes:
//   node tools/gen_steam_upload_assets.mjs
// =============================================================================
import sharp from 'sharp';
import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const VARIANT = process.argv[2] || 'showdown';
const GEN = 'steam/assets/gen';
const SRC = 'steam/assets';
const WORDMARK = 'Sprites/ui/mojiworld_logo.webp';

const need = (p) => { if (!existsSync(p)) { console.error('missing: ' + p); process.exit(1); } return p; };

// ── capsules: straight from the generator's live-asset composites ───────────
// header and library_header share the 920x430 master; main is its own.
const COPIES = [
  [`${GEN}/header__${VARIANT}.png`,             `${SRC}/store_capsule_header.png`],
  [`${GEN}/header__${VARIANT}.png`,             `${SRC}/library_header.png`],
  [`${GEN}/store_capsule_main__${VARIANT}.png`, `${SRC}/store_capsule_main.png`],
];
for (const [from, to] of COPIES) {
  need(from);
  await copyFile(from, to);
  const m = await sharp(to).metadata();
  console.log(`${to.padEnd(40)} <- ${from.split('/').pop().padEnd(34)} ${m.width}x${m.height}`);
}

// ── library logo: the wordmark, alone, trimmed to its ink ───────────────────
// `trim` removes the fully-transparent margin so Steam's own padding is the
// only padding. Fit INSIDE 1280x720 — never stretched, or the mark distorts.
need(WORDMARK);
const logo = await sharp(WORDMARK)
  .ensureAlpha()
  .trim()
  .resize(1280, 720, { fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
  .png()
  .toBuffer();
await sharp(logo).toFile(`${SRC}/library_logo.png`);
const lm = await sharp(`${SRC}/library_logo.png`).metadata();
const la = await sharp(`${SRC}/library_logo.png`).extractChannel(3).stats();
console.log(`${(SRC + '/library_logo.png').padEnd(40)} <- ${WORDMARK.split('/').pop().padEnd(34)} ${lm.width}x${lm.height}  alpha mean ${Math.round(la.channels[0].mean)} (transparent bg)`);

console.log('\nNow run:  node tools/gen_steam_upload_assets.mjs');
