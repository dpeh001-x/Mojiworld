// Pick a take -> trim -> closed ink edge (an outer halo of black) -> tight canvas with a 24 px clear margin (the edge-feather probe
// reads anything closer as a cut edge) -> _tmp_town_props/out/<key>.webp + meta.json (canvas size and the content rows). picks.json
// gives each key's take, halo (px at 600) and longest side. Copy the .webp files to Sprites/objects, add the keys to LX_OBJECTS_FILES
// (or _LX_SP_ART for the Sanctum's code-drawn pieces) and regenerate the bounds / edges tables.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
// squared Euclidean distance transform (Felzenszwalb), f = 0 at sources, INF elsewhere
function edt1d(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s;
    for (;;) { const p = v[k]; s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p); if (s <= z[k] && k > 0) k--; else break; }
    if (s <= z[k] && k === 0) { v[0] = q; z[0] = -1e20; z[1] = 1e20; continue; }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const p = v[k]; d[q] = (q - p) * (q - p) + f[p]; }
}
function edt(src, w, h) {   // src: Uint8Array 1 = source; returns Float32Array of distances to nearest source pixel
  const INF = 1e12, g = new Float64Array(w * h); for (let i = 0; i < w * h; i++) g[i] = src[i] ? 0 : INF;
  const n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = g[y * w + x]; edt1d(f, h, d, v, z); for (let y = 0; y < h; y++) g[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = g[y * w + x]; edt1d(f, w, d, v, z); for (let x = 0; x < w; x++) g[y * w + x] = d[x]; }
  const out = new Float32Array(w * h); for (let i = 0; i < w * h; i++) out[i] = Math.sqrt(g[i]); return out;
}
// outline width as a share of sqrt(opaque area): depth from the silhouette edge through near-black before the first coloured pixel
function outlinePct(rgba, w, h) {
  const op = new Uint8Array(w * h); let area = 0;
  for (let i = 0; i < w * h; i++) if (rgba[i * 4 + 3] > 128) { op[i] = 1; area++; }
  const inv = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) inv[i] = op[i] ? 0 : 1;
  const dIn = edt(inv, w, h);   // distance of an opaque pixel to the nearest transparent pixel
  const maxD = 40, inkN = new Float64Array(maxD + 1), tot = new Float64Array(maxD + 1);
  for (let i = 0; i < w * h; i++) {
    if (!op[i]) continue; const d = Math.ceil(dIn[i]); if (d < 1 || d > maxD) continue;
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2]; const lum = 0.3 * r + 0.59 * g + 0.11 * b;
    tot[d]++; if (lum < 60) inkN[d]++;
  }
  let width = 0; for (let d = 1; d <= maxD; d++) { const s = tot[d] ? inkN[d] / tot[d] : 0; if (s >= 0.5) width = d; else { width += s; break; } }
  return { pct: (100 * width) / Math.sqrt(area), width, area };
}
async function loadRGBA(file) { const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height }; }


const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const OUT = path.join(HERE, '_tmp_town_props', 'out'); fs.mkdirSync(OUT, { recursive: true });
const PICK = JSON.parse(fs.readFileSync(path.join(HERE, 'town_props_picks.json'), 'utf8'));   // { key: { take, halo(px at 600), maxSide } }
const META = {}; const M = 24;
for (const [key, p] of Object.entries(PICK)) {
  const file = path.join(HERE, '_tmp_town_props', 'raw', `${key}_${p.take}.png`);
  let buf = await sharp(file).trim({ threshold: 10 }).png().toBuffer();
  let m = await sharp(buf).metadata();
  const maxSide = p.maxSide || 640, k = Math.min(1, maxSide / Math.max(m.width, m.height));
  if (k < 1) { buf = await sharp(buf).resize(Math.round(m.width * k), Math.round(m.height * k), { kernel: 'lanczos3' }).png().toBuffer(); m = await sharp(buf).metadata(); }
  const halo = Math.max(0, (p.halo ?? 2) * Math.max(m.width, m.height) / 600);
  const pad = Math.ceil(halo) + 2;
  const padded = await sharp(buf).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const { data, w, h } = await loadRGBA(padded);
  const src = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] > 40) src[i] = 1;
  const dist = halo > 0 ? edt(src, w, h) : null;
  const out = Buffer.from(data);
  if (halo > 0) for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3] / 255, ha = Math.max(0, Math.min(1, halo + 0.5 - dist[i]));
    if (ha <= a) continue;
    // composite black halo under the art: result alpha = a + ha*(1-a), colour = art*a / total
    const ta = a + ha * (1 - a);
    out[i * 4] = Math.round(data[i * 4] * a / ta); out[i * 4 + 1] = Math.round(data[i * 4 + 1] * a / ta); out[i * 4 + 2] = Math.round(data[i * 4 + 2] * a / ta); out[i * 4 + 3] = Math.round(ta * 255);
  }
  const haloed = await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  const t = await sharp(haloed).trim({ threshold: 4 }).png().toBuffer(); const tm = await sharp(t).metadata();
  const CW = tm.width + 2 * M, CH = tm.height + 2 * M;
  const webp = await sharp({ create: { width: CW, height: CH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: t, left: M, top: M }]).webp({ lossless: true, effort: 6 }).toBuffer();
  fs.writeFileSync(path.join(OUT, key + '.webp'), webp);
  META[key] = { cw: CW, ch: CH, bboxTop: M, bboxBottom: M + tm.height - 1, contentH: tm.height, contentW: tm.width };
  console.log(key.padEnd(26), `${CW}x${CH}`, 'content', tm.width + 'x' + tm.height, 'halo', halo.toFixed(1));
}
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(META, null, 1));
