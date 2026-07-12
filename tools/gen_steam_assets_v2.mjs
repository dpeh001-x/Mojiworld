#!/usr/bin/env node
// gen_steam_assets_v2.mjs — Steam art from Higgsfield (Nano Banana Pro) key art.
// Sources: steam_assets/keyart/keyart_wide.png (5504x3072, cast right-of-centre)
//          steam_assets/keyart/keyart_vertical.png (3392x5056, dragon top / girl low)
// Crops each official template size out of the key art with a tuned focus point,
// then overlays the gold MOJIWORLD logotype (SVG → sharp). Same 9 outputs as v1.
// Run: node tools/gen_steam_assets_v2.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

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

// gold MOJIWORLD logotype (+optional tagline), rendered 2x then downsampled
async function logoArt(width, { tagline = '', star = true } = {}) {
  const W = width * 2;
  const F = Math.round(W / 7.4);
  const tagF = Math.round(F * 0.30), starF = Math.round(F * 0.52);
  const topPad = star ? Math.round(starF * 1.15) : Math.round(F * 0.18);
  const textY = topPad + F;
  const H = textY + Math.round(F * 0.30) + (tagline ? Math.round(tagF * 2.1) : 0);
  const fam = `Segoe UI Black, Arial Black, sans-serif`;
  const t = (fill, stroke) => `<text x="50%" y="${textY}" text-anchor="middle"
      font-family="${fam}" font-weight="900" font-size="${F}" letter-spacing="${Math.round(F * 0.02)}"
      ${stroke ? `stroke="${stroke}" stroke-width="${Math.round(F * 0.17)}" stroke-linejoin="round"` : ''}
      fill="${fill}">MOJIWORLD</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff7d0"/><stop offset="0.45" stop-color="#ffd94a"/>
      <stop offset="1" stop-color="#ff9331"/></linearGradient></defs>
    ${t('#221543', '#221543')}${t('url(#gold)', null)}
    ${star ? `<text x="50%" y="${Math.round(starF * 0.95)}" text-anchor="middle" font-family="Segoe UI Symbol, ${fam}"
        font-size="${starF}" fill="#ffe9a8" stroke="#221543" stroke-width="${Math.round(starF * 0.10)}"
        stroke-linejoin="round">&#10022;</text>` : ''}
    ${tagline ? `<text x="50%" y="${H - Math.round(tagF * 0.55)}" text-anchor="middle" font-family="Segoe UI, sans-serif"
        font-style="italic" font-weight="600" font-size="${tagF}" fill="#fdf3ff" stroke="#221543"
        stroke-width="${Math.round(tagF * 0.14)}" stroke-linejoin="round">${tagline}</text>` : ''}
  </svg>`;
  const buf = await sharp(Buffer.from(svg)).resize(width).png().toBuffer();
  const meta = await sharp(buf).metadata();
  return { buf, w: meta.width, h: meta.height };
}

const placeLogo = (lg, cx, top) => [{ input: lg.buf, left: Math.round(cx - lg.w / 2), top: Math.round(top) }];

async function compose(name, w, h, layers, { transparent = false } = {}) {
  const base = sharp({ create: { width: w, height: h, channels: 4, background: transparent ? { r: 0, g: 0, b: 0, alpha: 0 } : '#1b1440' } });
  await base.composite(layers.flat()).png().toFile(`${OUT}/${name}.png`);
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
    placeLogo(await logoArt(470, { tagline: TAG }), 262, 60),
  ]);

  await compose('store_capsule_small', 462, 174, [
    await cover(WIDE, 462, 174, 0.72, 0.62, { blur: 1.5, darken: 0.28 }),
    placeLogo(await logoArt(430, { star: false }), 231, 32),
  ]);

  // vertical art: keep starry top for the logo, platform cast lower half
  await compose('store_capsule_vertical', 748, 896, [
    await cover(VERT, 748, 896, 0.5, 0.45),
    placeLogo(await logoArt(600), 374, 34),
  ]);

  await compose('store_page_background', 1438, 810, [
    await cover(WIDE, 1438, 810, 0.35, 0.45, { blur: 1.2, darken: 0.5 }),
  ]);

  await compose('library_capsule', 600, 900, [
    await cover(VERT, 600, 900, 0.5, 0.48),
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
