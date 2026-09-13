// A sharper plate for the World Map (v0.30.661). Per user: "make the map background more HD as it
// looks rather blurry".
//
//   node scripts/gen_worldmap_hd.mjs
//
// Where the blur comes from, measured rather than guessed. The painting was generated at 1008x576
// and cover-fitted to 1536x896 before it ever shipped, so the file already carried a 1.5x upscale.
// The game then draws it into a canvas the size of the diagram's user space (~1525 wide) and hands
// the browser that PNG, which the compositor scales again to the element's DEVICE pixels - on a 2x
// display that is 2754 across. Three resamplings, the last one bilinear, from a source with about a
// thousand pixels of real detail.
//
// Two of those three are fixed in the game (the raster is built at device resolution now). This
// fixes the file: one high-quality Lanczos pass to 2x with an unsharp mask tuned for painted art,
// which does not invent detail - nothing can - but it stops the browser doing the enlargement with
// a worse filter, and it restores the edges the original upscale and the webp quantiser softened.
//
// The composition is NOT regenerated and must not be: all eighty pins are placed against THIS
// painting (scripts/gen_worldmap_pins.mjs), and new art would move every landmark out from under
// its marker.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const fs = require('node:fs');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'backgrounds', 'worldmap_bg_v6.webp');
const OUT = path.join(ROOT, 'backgrounds', 'worldmap_bg_v7.webp');
const SCALE = 2;

const meta = await sharp(SRC).metadata();
const W = meta.width * SCALE, H = meta.height * SCALE;
console.log(`source ${meta.width}x${meta.height} ${Math.round(fs.statSync(SRC).size / 1024)} KB`);

const up = await sharp(SRC)
  .resize(W, H, { kernel: 'lanczos3' })
  // Painted art, not a photo: a wide, gentle unsharp mask puts the edge back into the linework and
  // the coastlines without finding grain in the flats, which a tight radius would.
  .sharpen({ sigma: 1.1, m1: 0.4, m2: 2.2, x1: 2.5, y2: 12, y3: 18 })
  .webp({ quality: 90, effort: 6 })
  .toBuffer();

// Verify the BUFFER, not a file on disk: sharp holds a handle on anything it opens, and the rename
// then fails on Windows with EPERM.
const m2 = await sharp(up).metadata();
if (m2.width !== W || m2.height !== H) throw new Error(`made ${m2.width}x${m2.height}, wanted ${W}x${H}`);
if (up.length < 60000) throw new Error('output suspiciously small');
const tmp = OUT + '.tmp';
fs.writeFileSync(tmp, up);
fs.renameSync(tmp, OUT);

// How much edge the pass actually put back: mean gradient magnitude, before and after, on a common
// grid. A number, so the next person does not have to squint at it.
const edge = async (f, w, h) => {
  const { data } = await sharp(f).resize(w, h, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  let s = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    s += Math.abs(data[i] - data[i + 1]) + Math.abs(data[i] - data[i + w]); n++;
  }
  return s / n;
};
const before = await edge(SRC, W, H), after = await edge(OUT, W, H);
console.log(`wrote ${path.relative(ROOT, OUT)}  ${W}x${H}  ${Math.round(fs.statSync(OUT).size / 1024)} KB`);
console.log(`  edge energy at ${W}px: ${before.toFixed(2)} -> ${after.toFixed(2)} (+${(100 * (after / before - 1)).toFixed(0)}%)`);
console.log('OK');
