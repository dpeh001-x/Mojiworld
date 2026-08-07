#!/usr/bin/env node
// STICKER PASS for skill-bar icons.
// =============================================================================
// The 72 icons in Sprites/skills share one look: subject trimmed to its own
// bounds, sized to ~80% of a 256px square, wrapped in a thick cream outline
// with a darker rim outside it, over a soft drop shadow. Raw generator output
// has none of that, so a freshly generated icon looks foreign next to the set
// even when the artwork itself is right.
//
// Dilation is done the standard way for sharp: blur the alpha channel, then
// threshold it. Blur radius r with a low threshold grows the mask by roughly r
// pixels in every direction, which is what an outline needs.
//
//   node tools/sticker_icon.mjs <in.png> <out.png> [--cream 8] [--rim 4] [--fill 0.80]
// =============================================================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
import { readFileSync } from 'node:fs';

const SIZE = 256;
const argv = process.argv.slice(2);
const [inPath, outPath] = argv.filter((a) => !a.startsWith('--'));
const num = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? Number(argv[i + 1]) : d; };
if (!inPath || !outPath) { console.error('usage: sticker_icon.mjs <in.png> <out.png>'); process.exit(1); }
const CREAM = num('--cream', 8);      // px of cream outline
const RIM = num('--rim', 4);          // px of dark rim outside the cream
const FILL = num('--fill', 0.80);     // fraction of the 256 box the art occupies

// 1. trim to the artwork's own alpha bounds, then scale into the fill box
const trimmed = await sharp(readFileSync(inPath)).ensureAlpha().trim({ threshold: 10 }).toBuffer();
const inner = Math.round(SIZE * FILL) - 2 * (CREAM + RIM);
const art = await sharp(trimmed)
  .resize(inner, inner, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer();
const meta = await sharp(art).metadata();
const left = Math.round((SIZE - meta.width) / 2), top = Math.round((SIZE - meta.height) / 2);
// place the art on the full canvas so every later mask shares one coordinate space
const placed = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: art, left, top }]).png().toBuffer();

// 2. grow the alpha to build each outline ring.
// joinChannel needs RAW pixel data — handing it an encoded PNG silently yields a
// fully-opaque alpha, which floods the whole 256 square with the outline colour.
// TRUE dilation, done explicitly. The usual sharp trick (blur then threshold)
// was measured here and barely moved the edge — art covered 21.0% of the canvas
// and the supposedly 12px- and 15px-dilated masks came back at 21.6% and 21.5%,
// i.e. no ring at all, and the larger radius produced the SMALLER mask. At
// 256x256 a separable max-filter is ~65k cheap operations and is exact, so the
// outline width is the number asked for rather than whatever a blur curve gives.
const baseAlpha = await sharp(placed).extractChannel('alpha').raw().toBuffer();
const dilate = (src, r) => {
  const w = SIZE, h = SIZE;
  const tmp = Buffer.alloc(w * h), out = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) {                    // horizontal pass
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = Math.max(0, x - r), e = Math.min(w - 1, x + r); k <= e; k++) {
        const v = src[row + k]; if (v > m) { m = v; if (m === 255) break; }
      }
      tmp[row + x] = m;
    }
  }
  for (let x = 0; x < w; x++) {                    // vertical pass
    for (let y = 0; y < h; y++) {
      let m = 0;
      for (let k = Math.max(0, y - r), e = Math.min(h - 1, y + r); k <= e; k++) {
        const v = tmp[k * w + x]; if (v > m) { m = v; if (m === 255) break; }
      }
      out[y * w + x] = m;
    }
  }
  return out;
};
// binarise first so semi-transparent generator glow does not smear the ring
const solid = Buffer.from(baseAlpha.map((v) => (v > 120 ? 255 : 0)));
const growRaw = async (radius) => dilate(solid, radius);
// Build each ring as an explicit RGBA raw buffer: flat colour, dilated mask as
// the alpha. Going through create()+joinChannel here produced a layer that
// never showed up in the composite, and the whole point of the outline is that
// it is visible — so the bytes are assembled directly, where nothing is implied.
const layer = async (radius, rgb) => {
  const mask = await growRaw(radius);
  const buf = Buffer.alloc(SIZE * SIZE * 4);
  for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
    buf[p] = rgb.r; buf[p + 1] = rgb.g; buf[p + 2] = rgb.b; buf[p + 3] = mask[i];
  }
  return sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 4 } }).png().toBuffer();
};
const rimLayer = await layer(CREAM + RIM, { r: 26, g: 19, b: 48 });     // dark navy rim
const creamLayer = await layer(CREAM, { r: 255, g: 246, b: 224 });      // cream sticker edge

// 3. soft drop shadow under everything, then stack
const shadowMask = await sharp(placed).extractChannel('alpha').blur(7).raw().toBuffer();
const shadowBuf = Buffer.alloc(SIZE * SIZE * 4);
for (let i = 0, p = 0; i < shadowMask.length; i++, p += 4) {
  shadowBuf[p + 3] = Math.min(255, shadowMask[i] * 0.55);   // soft, not a hard slab
}
const shadow = await sharp(shadowBuf, { raw: { width: SIZE, height: SIZE, channels: 4 } }).png().toBuffer();

const out = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([
    { input: shadow, top: 5, left: 0, blend: 'over' },
    { input: rimLayer }, { input: creamLayer }, { input: placed },
  ])
  .png().toBuffer();
// modest saturation lift so the subject holds up at 46px
await sharp(out).modulate({ saturation: 1.12 }).png().toFile(outPath);
console.log(`sticker: ${inPath.split(/[\\/]/).pop()} -> ${outPath.split(/[\\/]/).pop()} (cream ${CREAM}px, rim ${RIM}px, fill ${FILL})`);
