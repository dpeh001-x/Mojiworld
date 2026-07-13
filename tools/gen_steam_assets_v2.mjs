#!/usr/bin/env node
// gen_steam_assets_v2.mjs — Steam art from Higgsfield (Nano Banana Pro) key art.
// Sources: steam_assets/keyart/keyart_wide.png (5504x3072, cast right-of-centre)
//          steam_assets/keyart/keyart_vertical.png (3392x5056, dragon top / girl low)
// Crops each official template size out of the key art with a tuned focus point,
// then overlays the gold MOJIWORLD logotype (SVG → sharp). Same 9 outputs as v1.
// Run: node tools/gen_steam_assets_v2.mjs
import sharp from 'sharp';
import { mkdir, rename } from 'node:fs/promises';

// The real hand-made MOJIWORLD wordmark (art of record) — overlaid on every
// capsule instead of a synthetic SVG logotype so the store art matches the
// in-game title and app icon exactly.
const WORDMARK = 'Sprites/ui/mojiworld_logo.png';

const OUT = 'steam_assets';
const WIDE = 'steam_assets/keyart/keyart_wide.png';
const VERT = 'steam_assets/keyart/keyart_vertical.png';

// cover-crop src to w x h; focusX/focusY are fractions picking the crop window centre
async function cover(src, w, h, focusX = 0.5, focusY = 0.5, { blur = 0, darken = 0 } = {}) {
  const meta = await sharp(src).metadata();
  const scale = Math.max(w / meta.width, h / meta.height);
  const sw = Math.round(meta.width * scale), sh = Math.round(meta.height * scale);
  const left = Math.max(0, Math.min(sw - w, Math.round(focusX * sw - w / 2)));
  const top = Math.max(0, Math.min(sh - h, Math.round(focusY * sh - h / 2)));
  let img = sharp(src).resize(sw, sh).extract({ left, top, width: w, height: h });
  if (blur) img = img.blur(blur);
  let buf = await img.png().toBuffer();
  if (darken) {
    const veil = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <rect width="${w}" height="${h}" fill="#100c28" fill-opacity="${darken}"/></svg>`;
    buf = await sharp(buf).composite([{ input: Buffer.from(veil), left: 0, top: 0 }]).png().toBuffer();
  }
  return { input: buf, left: 0, top: 0 };
}

// Real MOJIWORLD wordmark PNG resized to `width`, optionally with the italic
// "Once upon a time…" tagline stacked beneath it. Returns the combined art.
async function logoArt(width, { tagline = '' } = {}) {
  const mark = await sharp(WORDMARK).resize({ width }).png().toBuffer();
  const mm = await sharp(mark).metadata();
  if (!tagline) return { buf: mark, w: mm.width, h: mm.height };

  // Tagline rendered at 2x for crisp downscaling; storybook serif italic with a
  // dark stroke behind the fill so it reads over busy key art.
  const S = 2;
  const fs = Math.round(width * 0.058);          // final tagline font size (px)
  const gap = Math.round(width * 0.015);         // gap under the wordmark
  const box = Math.round(fs * 1.7);              // tagline row height (descenders + stroke)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * S}" height="${box * S}">
    <text x="50%" y="${Math.round(fs * 1.05 * S)}" text-anchor="middle"
      font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-weight="600"
      font-size="${fs * S}" fill="#fdf3ff" stroke="#221543"
      stroke-width="${Math.round(fs * S * 0.11)}" stroke-linejoin="round"
      paint-order="stroke">${tagline}</text></svg>`;
  const tag = await sharp(Buffer.from(svg)).resize({ width }).png().toBuffer();
  const tm = await sharp(tag).metadata();

  const H = mm.height + gap + tm.height;
  const buf = await sharp({ create: { width, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: mark, left: 0, top: 0 }, { input: tag, left: 0, top: mm.height + gap }])
    .png().toBuffer();
  return { buf, w: width, h: H };
}

const placeLogo = (lg, cx, top) => [{ input: lg.buf, left: Math.round(cx - lg.w / 2), top: Math.round(top) }];

async function compose(name, w, h, layers, { transparent = false } = {}) {
  const base = sharp({ create: { width: w, height: h, channels: 4, background: transparent ? { r: 0, g: 0, b: 0, alpha: 0 } : '#1b1440' } });
  const tmp = `${OUT}/${name}.png.tmp`;
  await base.composite(layers.flat()).png().toFile(tmp);
  await rename(tmp, `${OUT}/${name}.png`);
  console.log(`${name}.png  ${w}x${h}`);
}

const TAG = 'Once upon a time…';

async function main() {
  await mkdir(OUT, { recursive: true });

  // cast in wide art sits ~x 0.55-0.92; calm scenery on the left for the logo
  await compose('store_capsule_main', 1232, 706, [
    await cover(WIDE, 1232, 706, 0.5, 0.5),
    placeLogo(await logoArt(560, { tagline: TAG }), 330, 48),
  ]);

  await compose('store_capsule_header', 920, 430, [
    await cover(WIDE, 920, 430, 0.62, 0.62),
    placeLogo(await logoArt(430, { star: false }), 245, 18),
  ]);

  await compose('store_capsule_small', 462, 174, [
    await cover(WIDE, 462, 174, 0.72, 0.62, { blur: 1.5, darken: 0.28 }),
    placeLogo(await logoArt(430, { star: false }), 231, 32),
  ]);

  // vertical art: keep starry top for the logo, platform cast lower half
  await compose('store_capsule_vertical', 748, 896, [
    await cover(VERT, 748, 896, 0.5, 0.55),
    placeLogo(await logoArt(600, { tagline: TAG }), 374, 34),
  ]);

  await compose('store_page_background', 1438, 810, [
    await cover(WIDE, 1438, 810, 0.35, 0.45, { blur: 1.2, darken: 0.5 }),
  ]);

  await compose('library_capsule', 600, 900, [
    await cover(VERT, 600, 900, 0.5, 0.55),
    placeLogo(await logoArt(500), 300, 40),
  ]);

  await compose('library_header', 920, 430, [
    await cover(WIDE, 920, 430, 0.7, 0.6),
    placeLogo(await logoArt(470, { star: false }), 262, 100),
  ]);

  // hero: no logo (Steam overlays library_logo.png on top of this)
  await compose('library_hero', 3840, 1240, [
    await cover(WIDE, 3840, 1240, 0.5, 0.68),
  ]);

  await compose('library_logo', 1280, 720, [
    placeLogo(await logoArt(1080, { tagline: TAG }), 640, 190),
  ], { transparent: true });

  console.log('done → ' + OUT + '/');
}
main().catch(e => { console.error(e); process.exit(1); });
