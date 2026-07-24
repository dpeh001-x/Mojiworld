// Build Sprites/bosses/attack/gravitospunch_0..8.webp from a 3x3 magenta-keyed
// sheet. v2 TIGHT ANCHOR: the source generation is camera-locked, so all nine
// frames get ONE shared transform (scale + offset) computed from the guard-
// stance frames (0 & 8) against the IDLE set's calibration. Re-fitting every
// frame to its own content bbox (v1) let the extended fist / impact flash drag
// the bbox around, rescaling and sliding the body between frames — the punch
// "swam". With a shared transform the body flows exactly as generated.
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
const frames = [];   // { png, box }
for (let i = 0; i < 9; i++) {
  const r = Math.floor(i / 3), c = i % 3;
  const cell = await sheet.clone().extract({ left: c * cw, top: r * ch, width: cw, height: ch })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const keyed = keyMagenta(cell.data, cell.info.width, cell.info.height);
  const png = await sharp(keyed, { raw: { width: cell.info.width, height: cell.info.height, channels: 4 } })
    .png().toBuffer();
  const box = await contentBox(png);
  if (!box) { console.log('frame', i, 'EMPTY — abort'); process.exit(1); }
  frames.push({ png, box });
}

// ---- 3. ONE shared transform from the guard-stance frames (0 & 8) ----
const stance = [frames[0].box, frames[8].box];
const stH = (stance[0].h + stance[1].h) / 2;
const stBot = (stance[0].maxY + stance[1].maxY) / 2;
const stCx = (stance[0].minX + stance[0].maxX + stance[1].minX + stance[1].maxX) / 4;
let scale = REF_H / stH;
// safety: with a shared transform an extended-fist frame could overrun the
// canvas; shrink uniformly (never per-frame) if any frame would clip.
for (const f of frames) {
  const offX = () => REF_CX - stCx * scale, offY = () => REF_BOT - stBot * scale;
  const L = offX() + f.box.minX * scale, R = offX() + (f.box.maxX + 1) * scale;
  const T = offY() + f.box.minY * scale, B = offY() + (f.box.maxY + 1) * scale;
  const over = Math.max(L < 0 ? -L / (REF_CX - L) : 0, R > CANVAS_W ? (R - CANVAS_W) / (R - REF_CX) : 0,
    T < 0 ? -T / (REF_BOT - T) : 0, B > CANVAS_H ? (B - CANVAS_H) / (B - 0) : 0);
  if (over > 0) scale *= (1 - over - 0.002);
}
const OFF_X = REF_CX - stCx * scale, OFF_Y = REF_BOT - stBot * scale;
console.log('shared transform: scale', scale.toFixed(4), 'offset', Math.round(OFF_X) + ',' + Math.round(OFF_Y),
  '(stance h', stH, 'bot', stBot, 'cx', Math.round(stCx) + ')');

// ---- 4. apply the SAME transform to every frame ----
for (let i = 0; i < 9; i++) {
  const { png, box } = frames[i];
  const newW = Math.max(1, Math.round(box.w * scale)), newH = Math.max(1, Math.round(box.h * scale));
  const scaled = await sharp(png).extract({ left: box.minX, top: box.minY, width: box.w, height: box.h })
    .resize(newW, newH, { kernel: 'lanczos3' }).png().toBuffer();
  const left = Math.round(OFF_X + box.minX * scale);
  const top = Math.round(OFF_Y + box.minY * scale);
  await sharp({ create: { width: CANVAS_W, height: CANVAS_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: scaled, left: Math.max(0, left), top: Math.max(0, top) }])
    .webp({ quality: 92 }).toFile(`${OUTDIR}/${PREFIX}_${i}.webp`);
  console.log('frame', i, 'content', box.w + 'x' + box.h, 'placed at', left + ',' + top,
    'bottom', top + newH - 1);
}
console.log('DONE — 9 punch frames written, ONE shared transform (tight anchor)');
