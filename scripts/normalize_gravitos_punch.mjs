// Build Sprites/bosses/attack/gravitospunch_0..8.webp from a 3x3 magenta-keyed
// sheet, normalized to the IDLE set's calibration (content height + baseline +
// center) — same pipeline as normalize_gravitos_walk.mjs. The punch set is the
// 'gravitospunch' attack-frame key drawn during Gravitos form-1's Gravity Crush.
import sharp from 'sharp';
sharp.cache(false);
const SHEET = process.argv[2];
const OUTDIR = 'Sprites/bosses/attack';
const PREFIX = 'gravitospunch';
const CANVAS_W = 2200, CANVAS_H = 2000;

// ---- 1. idle reference metrics (full scan of all 9 idle frames) ----
async function contentBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 16) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return maxY < 0 ? null : { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const idleH = [], idleBot = [], idleCx = [];
for (let i = 0; i < 9; i++) {
  const b = await contentBox(await sharp(`Sprites/bosses/idle/gravitos_${i}.webp`).toBuffer());
  idleH.push(b.h); idleBot.push(b.maxY); idleCx.push((b.minX + b.maxX) / 2);
}
const REF_H = med(idleH), REF_BOT = med(idleBot), REF_CX = med(idleCx);
console.log('idle ref: contentH', REF_H, 'bottomY', REF_BOT, 'centerX', Math.round(REF_CX));
if (!SHEET) process.exit(0);

// ---- 2. slice the 3x3 sheet + chroma-key magenta ----
const sheet = sharp(SHEET);
const meta = await sheet.metadata();
const cw = Math.floor(meta.width / 3), ch = Math.floor(meta.height / 3);
console.log('sheet', meta.width + 'x' + meta.height, 'cell', cw + 'x' + ch);
function keyMagenta(data, w, h) {
  // magenta: r,b high; g low. Soft key with despill on edges.
  for (let i = 0; i < w * h; i++) {
    const o = i * 4, r = data[o], g = data[o + 1], b = data[o + 2];
    const mag = Math.min(r, b) - g;             // magenta-ness
    if (mag > 96 && r > 120 && b > 120) data[o + 3] = 0;                    // hard key
    else if (mag > 40 && r > 100 && b > 100) {                              // soft edge
      data[o + 3] = Math.max(0, Math.min(255, Math.round(255 * (1 - (mag - 40) / 80))));
      const spill = Math.round(mag / 2);                                    // despill toward neutral
      data[o] = Math.max(0, r - spill); data[o + 2] = Math.max(0, b - spill);
    }
  }
  return data;
}
for (let i = 0; i < 9; i++) {
  const r = Math.floor(i / 3), c = i % 3;
  const cell = await sheet.clone().extract({ left: c * cw, top: r * ch, width: cw, height: ch })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const keyed = keyMagenta(cell.data, cell.info.width, cell.info.height);
  let frame = sharp(keyed, { raw: { width: cell.info.width, height: cell.info.height, channels: 4 } });
  const png = await frame.png().toBuffer();
  const box = await contentBox(png);
  if (!box) { console.log('frame', i, 'EMPTY — abort'); process.exit(1); }
  // ---- 3. normalize: content -> REF_H tall, bottom at REF_BOT, centered at REF_CX ----
  const scale = REF_H / box.h;
  const newW = Math.round(box.w * scale), newH = Math.round(box.h * scale);
  const scaled = await sharp(png).extract({ left: box.minX, top: box.minY, width: box.w, height: box.h })
    .resize(newW, newH, { kernel: 'lanczos3' }).png().toBuffer();
  const left = Math.round(REF_CX - newW / 2);
  const top = REF_BOT - newH + 1;
  await sharp({ create: { width: CANVAS_W, height: CANVAS_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: scaled, left: Math.max(0, left), top: Math.max(0, top) }])
    .webp({ quality: 92 }).toFile(`${OUTDIR}/${PREFIX}_${i}.webp`);
  console.log('frame', i, 'content', box.w + 'x' + box.h, '-> scale', scale.toFixed(3), 'placed at', left + ',' + top);
}
console.log('DONE — 9 punch frames written, calibrated to idle ref');
