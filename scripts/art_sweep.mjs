// ART SWEEP (2026-09-08, see docs/reports/ART_SWEEP_2026-09-08.md) - per-file geometry + sharpness metrics for every art file, written as JSON for the report builder.
//   node scripts/art_sweep.mjs <out.json>
import sharp from 'sharp';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).split('\\').join('/').replace(/\/+$/, '');   // the repo root, wherever the checkout lives
const OUT = process.argv[2];
const ROOTS = ['Sprites', 'backgrounds', 'assets'];
const files = [];
const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(webp|png|jpe?g)$/i.test(e.name)) files.push(p); } };
for (const r of ROOTS) walk(join(ROOT, r));
console.log('files:', files.length);
const T = 24;   // alpha threshold for "ink"
async function measure(p) {
  const rel = relative(ROOT, p).replace(/\\/g, '/');
  const o = { p: rel, bytes: statSync(p).size };
  let meta; try { meta = await sharp(p).metadata(); } catch (e) { o.err = 'undecodable'; return o; }
  o.w = meta.width; o.h = meta.height; o.fmt = meta.format; o.alpha = !!meta.hasAlpha;
  if (!(o.w > 0 && o.h > 0)) { o.err = 'no size'; return o; }
  if (o.w * o.h > 20e6) { o.err = 'skipped (>20 MP)'; return o; }
  let raw; try { raw = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); } catch (e) { o.err = 'decode failed'; return o; }
  const { data, info } = raw; const W = info.width, H = info.height;
  let x0 = W, y0 = H, x1 = -1, y1 = -1, n = 0, sx = 0, sy = 0, opaque = 0;
  for (let y = 0; y < H; y++) { const row = y * W; for (let x = 0; x < W; x++) { const a = data[(row + x) * 4 + 3]; if (a > T) { n++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (a === 255) opaque++; } } }
  o.ink = n; o.inkFrac = +(n / (W * H)).toFixed(4);
  if (n === 0) { o.err = 'empty (no ink)'; return o; }
  o.bb = [x0, y0, x1, y1]; o.bw = x1 - x0 + 1; o.bh = y1 - y0 + 1; o.cx = +(sx / n / W).toFixed(4); o.cy = +(sy / n / H).toFixed(4);
  o.bot = +((y1 + 1) / H).toFixed(4); o.top = +(y0 / H).toFixed(4); o.left = +(x0 / W).toFixed(4); o.right = +((x1 + 1) / W).toFixed(4);
  o.edge = { l: x0 === 0, r: x1 === W - 1, t: y0 === 0, b: y1 === H - 1 };
  const c = (x, y) => data[(y * W + x) * 4 + 3]; o.corners = Math.max(c(0, 0), c(W - 1, 0), c(0, H - 1), c(W - 1, H - 1));
  // how much ink sits ON the outermost 2 px ring (a body cut by the canvas leaves a hard, long edge)
  let rt = 0, rb = 0, rl = 0, rr = 0; for (let x = 0; x < W; x++) { if (c(x, 0) > T || c(x, 1) > T) rt++; if (c(x, H - 1) > T || c(x, H - 2) > T) rb++; } for (let y = 0; y < H; y++) { if (c(0, y) > T || c(1, y) > T) rl++; if (c(W - 1, y) > T || c(W - 2, y) > T) rr++; }
  o.ringPx = rt + rb + rl + rr; o.ring = { t: rt, b: rb, l: rl, r: rr };
  // sharpness: Laplacian variance of the body composited on mid-grey and resized to 320 px tall (scale-independent)
  try {
    const g = await sharp(p).extract({ left: x0, top: y0, width: o.bw, height: o.bh }).flatten({ background: '#808080' }).resize({ height: 320 }).greyscale().raw().toBuffer({ resolveWithObject: true });
    const gw = g.info.width, gh = g.info.height, d = g.data; let s1 = 0, s2 = 0, m = 0;
    for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) { const i = y * gw + x; const l = 4 * d[i] - d[i - 1] - d[i + 1] - d[i - gw] - d[i + gw]; s1 += l; s2 += l * l; m++; }
    o.sharp = Math.round(s2 / m - (s1 / m) * (s1 / m));
    // dHash 9x8 of the body for near-duplicate detection
    const hsrc = await sharp(p).extract({ left: x0, top: y0, width: o.bw, height: o.bh }).flatten({ background: '#808080' }).resize(9, 8, { fit: 'fill' }).greyscale().raw().toBuffer();
    let bits = ''; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += hsrc[y * 9 + x] < hsrc[y * 9 + x + 1] ? '1' : '0'; o.dh = bits;
  } catch (e) { o.sharp = null; }
  return o;
}
const results = []; let i = 0; const t0 = Date.now();
const pool = 4; const workers = Array.from({ length: pool }, async () => { while (i < files.length) { const p = files[i++]; try { results.push(await measure(p)); } catch (e) { results.push({ p: relative(ROOT, p).replace(/\\/g, '/'), err: String(e).slice(0, 80) }); } if (results.length % 500 === 0) console.log(results.length, 'done', Math.round((Date.now() - t0) / 1000) + 's'); } });
await Promise.all(workers);
results.sort((a, b) => a.p < b.p ? -1 : 1);
writeFileSync(OUT, JSON.stringify(results));
console.log('wrote', results.length, 'records in', Math.round((Date.now() - t0) / 1000) + 's');
