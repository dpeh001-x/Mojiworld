#!/usr/bin/env node
// DRAGOON B + G -> BLUE. Per user: "Could you change the colour of dragoon B and G skill sprites to blue".
// ============================================================================
// Most Dragoon art was already blue (Skyfall Dominion's storm, its falling lances, the Sky Lance still).
// What was red: every frame of the Sky Lance loop, the dragoon_impact landing crater, the Sky Lance skill
// icon, and small accents on the Skyfall lance and its icon. This shifts ONLY true reds to the blue the
// existing Dragoon art already uses, pixel by pixel in HSL, so lightness, shading, glow and alpha survive
// and gold, white and the existing blues are untouched. A soft hue window (full at the red core, easing out
// by 24 deg either side) keeps orange-gold trim from picking up a seam.
//
//   node scripts/recolor_dragoon_blue.mjs            # dry run: per-file red share, before -> after
//   node scripts/recolor_dragoon_blue.mjs --write    # atomic in-place rewrite
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = [
  ...Array.from({ length: 9 }, (_, i) => `Sprites/fx/anim/dragoon_skylance_${i}.webp`),
  'Sprites/fx/dragoon_impact.webp', 'Sprites/fx/dragoon_skylance.webp',
  'Sprites/projectiles/p_ult_dragoon.webp',
  'Sprites/skills/dragoon_skylance.webp', 'Sprites/skills/dragoon_ult.webp',
  ...Array.from({ length: 9 }, (_, i) => `Sprites/fx/anim/dragoon_ult_${i}.webp`), 'Sprites/fx/dragoon_ult.webp',
];
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
// signed distance from pure red, in degrees (-180..180)
const fromRed = (h) => ((h + 180) % 360) - 180;
const redWeight = (h, s) => {
  if (s < 0.18) return 0;                        // greys and near-whites stay as they are
  const d = Math.abs(fromRed(h));
  return d <= 14 ? 1 : d >= 30 ? 0 : 1 - (d - 14) / 16;
};

async function measure(buf) {
  const { data } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let red = 0, n = 0;
  for (let p = 0; p < data.length; p += 4) {
    if (data[p + 3] < 60) continue;
    const [h, s] = rgb2hsl(data[p], data[p + 1], data[p + 2]);
    if (s < 0.25) continue; n++;
    if (redWeight(h, s) > 0.5) red++;
  }
  return n ? red / n : 0;
}
// the blue the Dragoon art already uses: mean hue of the saturated blues in its own Skyfall still
async function targetHue() {
  const { data } = await sharp(path.join(ROOT, 'Sprites/fx/dragoon_ult.webp')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x = 0, y = 0;
  for (let p = 0; p < data.length; p += 4) {
    if (data[p + 3] < 60) continue;
    const [h, s] = rgb2hsl(data[p], data[p + 1], data[p + 2]);
    if (s < 0.35 || h < 180 || h > 250) continue;
    x += Math.cos(h * Math.PI / 180); y += Math.sin(h * Math.PI / 180);
  }
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

const TARGET = await targetHue();
console.log(`target blue hue ${TARGET.toFixed(1)} deg (mean of Skyfall Dominion's own blues)`);
for (const rel of FILES) {
  const f = path.join(ROOT, rel);
  const src = fs.readFileSync(f);
  const before = await measure(src);
  if (before < 0.002) { console.log(`${rel.padEnd(42)} red ${(before * 100).toFixed(1)}%  - already blue, untouched`); continue; }
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let p = 0; p < data.length; p += 4) {
    if (!data[p + 3]) continue;
    const [h, s, l] = rgb2hsl(data[p], data[p + 1], data[p + 2]);
    const w = redWeight(h, s); if (!w) continue;
    // keep the red's own spread around the core, so highlights and shadows still vary in hue a little
    const nh = TARGET + fromRed(h) * 0.5;
    const [r2, g2, b2] = hsl2rgb(nh, s, l);
    data[p] = Math.round(data[p] + (r2 - data[p]) * w);
    data[p + 1] = Math.round(data[p + 1] + (g2 - data[p + 1]) * w);
    data[p + 2] = Math.round(data[p + 2] + (b2 - data[p + 2]) * w);
  }
  const out = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
  const after = await measure(out);
  console.log(`${rel.padEnd(42)} red ${(before * 100).toFixed(1)}% -> ${(after * 100).toFixed(1)}%${WRITE ? '  written' : ''}`);
  if (WRITE) { fs.writeFileSync(f + '.tmp', out); fs.renameSync(f + '.tmp', f); }
  else fs.writeFileSync(path.join(ROOT, 'scripts', '_tmp_dragoon_' + path.basename(rel).replace('.webp', '.png')), await sharp(out).png().toBuffer());
}
