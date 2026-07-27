#!/usr/bin/env node
// Restore the black sticker outline on eagle_walk_5..7 (the outline pass that
// produced the rest of the set missed/lost these three — compare walk_4).
// Method: classic offset-dilation — stamp a black-tinted copy of the frame's
// alpha silhouette at 16 angles x 3 radii, then composite the art on top.
//   node scripts/outline_eagle_fix.mjs
import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'Sprites', 'summons', 'anim');
const FRAMES = ['eagle_walk_5', 'eagle_walk_6', 'eagle_walk_7'];
const R = [3, 6, 9];        // dilation radii (px) — matches the ~9px ring on walk_4
const ANGLES = 16;

for (const name of FRAMES) {
  const src = join(DIR, `${name}.webp`);
  const img = sharp(src);
  const meta = await img.metadata();
  const rgba = await img.ensureAlpha().raw().toBuffer();
  // black-tinted silhouette: RGB→0, alpha preserved (hard edge at a>32)
  const sil = Buffer.alloc(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) sil[i + 3] = rgba[i + 3] > 32 ? 255 : 0;
  const silPng = await sharp(sil, { raw: { width: meta.width, height: meta.height, channels: 4 } }).png().toBuffer();
  const stamps = [];
  for (const r of R) for (let a = 0; a < ANGLES; a++) {
    const th = (a / ANGLES) * Math.PI * 2;
    stamps.push({ input: silPng, left: Math.round(Math.cos(th) * r), top: Math.round(Math.sin(th) * r) });
  }
  // stamp offsets can be negative — composite onto a canvas via extend+extract
  const PAD = 12;
  const base = sharp({ create: { width: meta.width + PAD * 2, height: meta.height + PAD * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  const outline = await base.composite(stamps.map(s => ({ input: s.input, left: s.left + PAD, top: s.top + PAD }))).png().toBuffer();
  // soften the ring edge a touch (walk_4's ring has a soft falloff)
  const softOutline = await sharp(outline).blur(1.2).png().toBuffer();
  const orig = await sharp(src).png().toBuffer();
  const out = await sharp(softOutline)
    .composite([{ input: orig, left: PAD, top: PAD }])
    .extract({ left: PAD, top: PAD, width: meta.width, height: meta.height })
    .webp({ quality: 92 })
    .toBuffer();
  const { writeFileSync, renameSync } = await import('node:fs');
  writeFileSync(src + '.tmp', out);
  renameSync(src + '.tmp', src);
  console.log(`${name}: outlined (${meta.width}x${meta.height})`);
}
console.log('done');
