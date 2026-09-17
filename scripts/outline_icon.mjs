#!/usr/bin/env node
// Give an icon the HUD set's thick black sticker outline (the look v0.29.37 settled on for Sprites/ui/hud/*).
// Works at 4x the output size so the ring stays smooth: trim the source, fit it into a 512 canvas with room for the ring,
// dilate its alpha (blur + threshold), paint that mask black under the art, then downscale.
//   node scripts/outline_icon.mjs <source.png|webp> <out.webp> [--px 6] [--size 128]
//   --px is the outline width at the output size.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp'); sharp.cache(false);
const [src, out] = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !(i > 0 && all[i - 1].startsWith('--')));
const opt = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? Number(process.argv[i + 1]) : d; };
if (!src || !out) { console.error('usage: outline_icon.mjs <source> <out.webp> [--px 6] [--size 128]'); process.exit(1); }
const SIZE = opt('--size', 128), PX = opt('--px', 6), K = 4, BIG = SIZE * K, R = PX * K;
const trimmed = await sharp(src).ensureAlpha().trim({ threshold: 8 }).png().toBuffer();
const inner = BIG - 2 * (R + 3 * K);   // the art, with room for the ring and a small margin
const art = await sharp(trimmed).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
const canvas = await sharp({ create: { width: BIG, height: BIG, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: art, gravity: 'center' }]).png().toBuffer();
// dilate the silhouette: blur the alpha by ~R/2.3 and keep everything above a low cut, then soften the edge by a pixel
// One operation per pipeline: sharp runs a pipeline's operations in its OWN fixed order, and a second extractChannel
// replaces the first - chained, the mask came from the art's red channel instead of its alpha. Each step is raw and
// single-channel, so joinChannel gets exactly one band to use as the ring's alpha.
const step = async (buf, ch, fn) => {
  const { data, info } = await fn(sharp(buf, ch ? { raw: { width: BIG, height: BIG, channels: ch } } : undefined)).raw().toBuffer({ resolveWithObject: true });
  if (info.channels === 1) return { data, ch: 1 };
  const one = await sharp(data, { raw: { width: BIG, height: BIG, channels: info.channels } }).extractChannel(0).raw().toBuffer();
  return { data: one, ch: 1 };
};
let m = await step(canvas, 0, (p) => p.extractChannel('alpha'));
m = await step(m.data, 1, (p) => p.blur(R / 2.3));
m = await step(m.data, 1, (p) => p.threshold(14));
m = await step(m.data, 1, (p) => p.blur(K * 0.6));
const ring = await sharp({ create: { width: BIG, height: BIG, channels: 3, background: { r: 8, g: 6, b: 14 } } }).joinChannel(m.data, { raw: { width: BIG, height: BIG, channels: 1 } }).png().toBuffer();
const merged = await sharp(ring).composite([{ input: canvas }]).png().toBuffer();
await sharp(merged).resize(SIZE, SIZE, { kernel: 'lanczos3' }).webp({ quality: 92, alphaQuality: 100 }).toFile(out);
console.log(`outlined ${src} -> ${out} (${SIZE}px, ${PX}px ring)`);
