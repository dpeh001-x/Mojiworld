// v0.29.293 — slice the two generated icon sheets into individual transparent
// HUD icons for the mastery bar + world-affix pin.
//
// Keying approach: the sheets are drawn on pure black, and the icons carry
// coloured GLOW that fades to black. A naive luminance-as-alpha key would
// dissolve the dark outlines; a hard threshold would chop the glow into a
// visible disc. So: flood-fill the background inward from the border over
// dark pixels only. Enclosed dark outlines are never reached (the subject
// walls them off) and stay fully opaque, while the filled glow region gets
// alpha proportional to its own brightness — which is exactly the soft halo.
//
//   node scripts/bake_grind_icons.mjs <sheetDir>
import sharp from 'sharp';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
sharp.cache(false);

const SRC = process.argv[2];
const ROOT = 'C:/Users/dpeh0/Mojiworld';
const OUT_M = join(ROOT, 'Sprites/ui/mastery');
const OUT_A = join(ROOT, 'Sprites/ui/affix');
const SIZE = 128;             // final icon size (drawn at ~20px, 6x for retina)
const DARK = 40;              // luma below this is background-candidate
const GLOW_GAIN = 5;          // how fast filled-region glow ramps back to opaque

async function cells(file, cols, rows) {
  const img = sharp(await readFile(file));
  const { width, height } = await img.metadata();
  const cw = Math.floor(width / cols), ch = Math.floor(height / rows);
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    out.push({ left: c * cw, top: r * ch, width: cw, height: ch });
  }
  return { file, out };
}

async function keyCell(file, box) {
  const { data, info } = await sharp(await readFile(file))
    .extract(box).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const luma = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * ch;
    luma[i] = (data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114) | 0;
  }
  // ADAPTIVE threshold. The generator did not paint every cell's background at
  // the same level — the gold-coin cell came back on a noticeably lighter
  // black, so a fixed cutoff stopped the fill early and left a square halo.
  // Take the 90th-percentile luma of the border ring as this cell's true
  // background level and clear it by a margin.
  const ring = [];
  for (let x = 0; x < w; x += 2) { ring.push(luma[x], luma[(h - 1) * w + x]); }
  for (let y = 0; y < h; y += 2) { ring.push(luma[y * w], luma[y * w + w - 1]); }
  ring.sort((p, q) => p - q);
  const bgLevel = ring[Math.floor(ring.length * 0.9)] || 0;
  const dark = Math.max(DARK, bgLevel + 14);
  // Flood fill background from every border pixel that is dark.
  const bg = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (bg[i] || luma[i] >= dark) return;
    bg[i] = 1; stack.push(i);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  // Compose alpha: opaque subject, brightness-proportional glow in the fill.
  // Subtract the cell's own background level first so a lighter-black cell
  // does not leave a uniformly semi-opaque square behind the glow.
  for (let i = 0; i < w * h; i++) {
    data[i * ch + 3] = bg[i]
      ? Math.max(0, Math.min(255, (luma[i] - bgLevel) * GLOW_GAIN))
      : 255;
  }
  return sharp(Buffer.from(data), { raw: { width: w, height: h, channels: ch } })
    .png().toBuffer();
}

// Trim to the visible bbox, then letterbox square so every icon shares a
// baseline and none looks bigger than its neighbours in the HUD row.
async function square(buf) {
  const t = await sharp(buf).trim({ threshold: 6 }).toBuffer();
  const { width, height } = await sharp(t).metadata();
  const side = Math.max(width, height);
  // Two passes on purpose: sharp orders resize BEFORE composite within a
  // single pipeline, so composing and resizing together would shrink the
  // canvas first and then fail to fit the full-size icon onto it.
  const padded = await sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: t, left: ((side - width) / 2) | 0, top: ((side - height) / 2) | 0 }])
    .png().toBuffer();
  return sharp(padded)
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 92, alphaQuality: 100 }).toBuffer();
}

await mkdir(OUT_M, { recursive: true });
await mkdir(OUT_A, { recursive: true });

const MASTERY = ['tier0', 'tier1', 'tier2', 'tier3'];
const AFFIX   = ['gilded', 'teeming', 'lucid', 'hoarded', 'restless', 'none'];

const m = await cells(join(SRC, 'sheet_mastery.png'), 2, 2);
for (let i = 0; i < MASTERY.length; i++) {
  const out = await square(await keyCell(m.file, m.out[i]));
  await sharp(out).toFile(join(OUT_M, MASTERY[i] + '.webp'));
  console.log(`mastery/${MASTERY[i]}.webp  ${(out.length / 1024).toFixed(1)} KB`);
}
const a = await cells(join(SRC, 'sheet_affix.png'), 3, 2);
for (let i = 0; i < AFFIX.length; i++) {
  if (AFFIX[i] === 'none') continue;   // the plain rune is unused — no-affix hides the pin
  const out = await square(await keyCell(a.file, a.out[i]));
  await sharp(out).toFile(join(OUT_A, AFFIX[i] + '.webp'));
  console.log(`affix/${AFFIX[i]}.webp  ${(out.length / 1024).toFixed(1)} KB`);
}
console.log('done');
