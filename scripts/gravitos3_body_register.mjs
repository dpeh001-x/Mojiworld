// GRAVITOS FORM 3: HOW BIG IS HIS BODY IN THIS FRAME? Per user: "the calibration needs to be carefully considering the
// boss's head and body" - "especially when it involves the wings the whole measurements gets affected". Every pixel-height
// heuristic breaks on the pop-style art (flames and wing bones carry the same black ink as his armour), so this registers
// the frame against his still: a head-to-waist template (helm, chest core, waist; arms, wings and flame crown outside it),
// normalised cross-correlation over scale and position. Returns { s, x, y, score }: s = body scale vs the still (1 = same),
// x / y = where the template's top-left landed, score = the match (>= 0.6: his head and chest are clearly visible;
// lower: an effect covers him and the reading does not count). The v0.30.1442 re-animation fitted every frame this way.
//   import { bodyScale } from './gravitos3_body_register.mjs'   (frames of any width, 1214 px tall, drawn centred)
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STILL = join(ROOT, 'Sprites', 'bosses', 'gravitos3.webp');   // 1656 x 1214
const TPL = { x0: 794, y0: 490, x1: 994, y1: 800 };                  // head to waist on the still
async function lum(buf, f) {
  const m = await sharp(buf).metadata(), w = Math.round(m.width / f), h = Math.round(m.height / f);
  const { data } = await sharp(buf).ensureAlpha().resize(w, h).raw().toBuffer({ resolveWithObject: true });
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { const a = data[i * 4 + 3] / 255; L[i] = (0.3 * data[i * 4] + 0.59 * data[i * 4 + 1] + 0.11 * data[i * 4 + 2]) * a + 128 * (1 - a); }
  return { L, w, h, W: m.width };
}
function ncc(T, tw, th, F, fw, fx, fy) {
  let st = 0, sf = 0; const n = tw * th;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) { st += T[y * tw + x]; sf += F[(fy + y) * fw + fx + x]; }
  const mt = st / n, mf = sf / n; let a = 0, b = 0, c = 0;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) { const p = T[y * tw + x] - mt, q = F[(fy + y) * fw + fx + x] - mf; a += p * q; b += p * p; c += q * q; }
  return a / Math.sqrt(b * c + 1e-9);
}
const CACHE = new Map();
async function template(f, s) {
  const k = f + ':' + s.toFixed(3); if (CACHE.has(k)) return CACHE.get(k);
  const w = TPL.x1 - TPL.x0, h = TPL.y1 - TPL.y0, tw = Math.round(w * s / f), th = Math.round(h * s / f);
  const crop = await sharp(readFileSync(STILL)).extract({ left: TPL.x0, top: TPL.y0, width: w, height: h }).png().toBuffer();
  const { data } = await sharp(crop).ensureAlpha().resize(tw, th, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const T = new Float32Array(tw * th);
  for (let i = 0; i < tw * th; i++) { const a = data[i * 4 + 3] / 255; T[i] = (0.3 * data[i * 4] + 0.59 * data[i * 4 + 1] + 0.11 * data[i * 4 + 2]) * a + 128 * (1 - a); }
  const r = { T, tw, th }; CACHE.set(k, r); return r;
}
export async function bodyScale(buf) {
  const C = await lum(buf, 4), off = (C.W - 1656) / 2;   // a wider frame is the still's canvas widened symmetrically
  let best = { score: -2 };
  for (let s = 0.8; s <= 1.2501; s += 0.025) {
    const { T, tw, th } = await template(4, s), cx = (TPL.x0 + TPL.x1) / 2 / 4 + off / 4, cy = (TPL.y0 + TPL.y1) / 2 / 4, R = 45;
    for (let fy = Math.max(0, Math.round(cy - th / 2 - R)); fy <= Math.min(C.h - th, Math.round(cy - th / 2 + R)); fy++)
      for (let fx = Math.max(0, Math.round(cx - tw / 2 - R)); fx <= Math.min(C.w - tw, Math.round(cx - tw / 2 + R)); fx++) {
        const v = ncc(T, tw, th, C.L, C.w, fx, fy); if (v > best.score) best = { score: v, s, x: fx * 4, y: fy * 4 }; }
  }
  const F = await lum(buf, 2); let fine = { ...best, score: -2 };
  for (let s = best.s - 0.03; s <= best.s + 0.0301; s += 0.005) {
    const { T, tw, th } = await template(2, s);
    for (let fy = Math.round(best.y / 2) - 6; fy <= Math.round(best.y / 2) + 6; fy++) for (let fx = Math.round(best.x / 2) - 6; fx <= Math.round(best.x / 2) + 6; fx++) {
      if (fx < 0 || fy < 0 || fx + tw > F.w || fy + th > F.h) continue;
      const v = ncc(T, tw, th, F.L, F.w, fx, fy); if (v > fine.score) fine = { score: v, s, x: fx * 2, y: fy * 2 }; }
  }
  return { s: +fine.s.toFixed(3), x: fine.x - off, y: fine.y, score: +fine.score.toFixed(3) };
}
