#!/usr/bin/env node
// DRAGOON G (SKY LANCE) -> DARKER NAVY. Per user, after v0.30.810 turned it blue: "G skill sprites can be a
// darker navy". Skyfall Dominion (B) keeps its bright storm blue; only Sky Lance's own art moves.
// ============================================================================
// Blues only (saturation >= 0.18, hue 175-265): hue pulled onto navy, lightness scaled down, saturation nudged
// up so the darker colour stays rich instead of going grey. Whites, glints, the white wind wisps and alpha are
// untouched, which is what keeps a dark spear readable - the highlights still pop against it.
//
//   node scripts/recolor_dragoon_skylance_navy.mjs [--dark 0.62]            # preview sheet only
//   node scripts/recolor_dragoon_skylance_navy.mjs --dark 0.62 --write      # atomic in-place rewrite
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = [
  ...Array.from({ length: 9 }, (_, i) => `Sprites/fx/anim/dragoon_skylance_${i}.webp`),
  'Sprites/fx/dragoon_skylance.webp', 'Sprites/fx/dragoon_impact.webp', 'Sprites/skills/dragoon_skylance.webp',
];
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const DARK = Number(arg('dark', 0.62));          // lightness multiplier for blue pixels
const NAVY = 222;                                 // target hue
const WRITE = process.argv.includes('--write');

const rgb2hsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
const hsl2rgb = (h, s, l) => {
  h = ((h % 360) + 360) % 360 / 360;
  if (!s) return [l, l, l].map((v) => Math.round(v * 255));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const t = (x) => { x = (x + 1) % 1; return x < 1 / 6 ? p + (q - p) * 6 * x : x < 1 / 2 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p; };
  return [t(h + 1 / 3), t(h), t(h - 1 / 3)].map((v) => Math.round(v * 255));
};
// weight: full inside the blue band, easing out over 15 deg at each edge; greys and whites excluded
const blueWeight = (h, s) => {
  if (s < 0.18) return 0;
  const lo = 175, hi = 265, ease = 15;
  if (h < lo - ease || h > hi + ease) return 0;
  if (h < lo) return (h - (lo - ease)) / ease;
  if (h > hi) return ((hi + ease) - h) / ease;
  return 1;
};

async function navy(src) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let p = 0; p < data.length; p += 4) {
    if (!data[p + 3]) continue;
    const [h, s, l] = rgb2hsl(data[p], data[p + 1], data[p + 2]);
    const w = blueWeight(h, s); if (!w) continue;
    // very light blues (glow edges, near-white highlights) darken less, so the rim light survives
    const k = l > 0.8 ? DARK + (1 - DARK) * ((l - 0.8) / 0.2) * 0.7 : DARK;
    const [r2, g2, b2] = hsl2rgb(NAVY + (h - 205) * 0.35, Math.min(1, s * 1.08), l * k);
    data[p] = Math.round(data[p] + (r2 - data[p]) * w);
    data[p + 1] = Math.round(data[p + 1] + (g2 - data[p + 1]) * w);
    data[p + 2] = Math.round(data[p + 2] + (b2 - data[p + 2]) * w);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
}

const before = [], after = [];
for (const rel of FILES) {
  const f = path.join(ROOT, rel);
  const src = fs.readFileSync(f);
  const out = await navy(src);
  before.push(src); after.push(out);
  if (WRITE) { fs.writeFileSync(f + '.tmp', out); fs.renameSync(f + '.tmp', f); console.log('written ' + rel); }
}
// preview: rows = before on light, after on light, after on dark (the dark maps are where navy could vanish)
const pick = [0, 4, 9, 10, 11];
const S = 190, cells = [];
for (const [ci, i] of pick.entries()) {
  for (const [ri, buf] of [[0, before[i]], [1, after[i]], [2, after[i]]].entries()) {
    cells.push({ input: await sharp(buf[1]).resize(S, S, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), left: 10 + ci * (S + 10), top: 10 + ri * (S + 10) });
  }
}
const W = 20 + pick.length * (S + 10), H = 20 + 3 * (S + 10);
const bgRows = [
  { input: await sharp({ create: { width: W, height: 2 * (S + 10) + 10, channels: 4, background: { r: 170, g: 200, b: 170, alpha: 1 } } }).png().toBuffer(), left: 0, top: 0 },
  { input: await sharp({ create: { width: W, height: S + 20, channels: 4, background: { r: 28, g: 22, b: 40, alpha: 1 } } }).png().toBuffer(), left: 0, top: 2 * (S + 10) + 0 },
];
const out = path.join(ROOT, 'scripts', `_tmp_skylance_navy_${DARK}.png`);
await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }).composite([...bgRows, ...cells]).png().toFile(out);
console.log('preview -> ' + path.relative(ROOT, out));
