#!/usr/bin/env node
// gen_steam/assets.mjs — compose Steam store/library art from in-game assets.
// Sizes follow Valve's official "Steam Game Templates" PSD set (2024+ specs):
//   store_capsule_main     1232x706    store_capsule_header  920x430
//   store_capsule_small    462x174     store_capsule_vertical 748x896
//   store_page_background  1438x810    library_capsule       600x900
//   library_header         920x430     library_hero          3840x1240 (no logo)
//   library_logo           1280x720 transparent
// Run: node tools/gen_steam/assets.mjs   → writes PNGs into steam/assets/
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const OUT = 'steam/assets';
const BG = {
  atrium: 'backgrounds/bg_v3_celestialAtrium.png',
  galaxy: 'backgrounds/bg_v3_galaxy.png',
  town:   'backgrounds/bg_v3_everdawn_central.png',
};
const SPR = {
  dragon: 'Sprites/bosses/aetherion.png',
  hero:   'Sprites/npc/bravo.png',
  bun:    'Sprites/monsters/cloudbun.webp',
  mochi:  'Sprites/monsters/cosmicMochi.webp',
};

// ---------- layer helpers ----------
async function bgLayer(src, w, h, { blur = 0, pos = 'centre' } = {}) {
  let img = sharp(src).resize(w, h, { fit: 'cover', position: pos });
  if (blur) img = img.blur(blur);
  return { input: await img.png().toBuffer(), left: 0, top: 0 };
}

// trim transparent margins, scale to target height, return placeable sprite
async function prepSprite(src, targetH) {
  const trimmed = await sharp(src).trim({ threshold: 12 }).toBuffer();
  const meta = await sharp(trimmed).metadata();
  const w = Math.round(meta.width * (targetH / meta.height));
  const buf = await sharp(trimmed).resize(w, targetH).png().toBuffer();
  return { buf, w, h: targetH };
}

// place a prepped sprite by anchor: {cx, bottom} → composite entry (+shadow)
function place(sp, cx, bottom, { shadow = true, shadowW = 0.72 } = {}) {
  const left = Math.round(cx - sp.w / 2);
  const top = Math.round(bottom - sp.h);
  const out = [];
  if (shadow) {
    const sw = Math.round(sp.w * shadowW), sh = Math.max(14, Math.round(sw * 0.16));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sw}" height="${sh}">
      <ellipse cx="${sw / 2}" cy="${sh / 2}" rx="${sw / 2}" ry="${sh / 2}" fill="rgba(20,16,50,0.38)"/></svg>`;
    out.push({ input: Buffer.from(svg), left: Math.round(cx - sw / 2), top: Math.round(bottom - sh / 2) });
  }
  out.push({ input: sp.buf, left, top });
  return out;
}

// full-canvas vertical gradient scrim, e.g. darkened bottom for readability
function scrim(w, h, stops) {
  const s = stops.map(([off, col, op]) => `<stop offset="${off}" stop-color="${col}" stop-opacity="${op}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">${s}</linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/></svg>`;
  return { input: Buffer.from(svg), left: 0, top: 0 };
}

// gold MOJIWORLD logotype (+optional tagline); returns {buf,w,h} at 2x supersample
async function logoArt(width, { tagline = '', star = true } = {}) {
  const W = width * 2;
  const F = Math.round(W / 7.4);              // font-size for 9 glyphs of Segoe UI Black
  const tagF = Math.round(F * 0.30);
  const starF = Math.round(F * 0.52);
  const topPad = star ? Math.round(starF * 1.15) : Math.round(F * 0.18);
  const textY = topPad + F;                   // baseline
  const H = textY + Math.round(F * 0.30) + (tagline ? Math.round(tagF * 2.1) : 0);
  const fam = `Segoe UI Black, Arial Black, sans-serif`;
  const t = (fill, stroke) => `<text x="50%" y="${textY}" text-anchor="middle"
      font-family="${fam}" font-weight="900" font-size="${F}" letter-spacing="${Math.round(F * 0.02)}"
      ${stroke ? `stroke="${stroke}" stroke-width="${Math.round(F * 0.17)}" stroke-linejoin="round"` : ''}
      fill="${fill}">MOJIWORLD</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff7d0"/><stop offset="0.45" stop-color="#ffd94a"/>
        <stop offset="1" stop-color="#ff9331"/>
      </linearGradient>
    </defs>
    ${t('#221543', '#221543')}
    ${t('url(#gold)', null)}
    ${star ? `<text x="50%" y="${Math.round(starF * 0.95)}" text-anchor="middle" font-family="Segoe UI Symbol, ${fam}"
        font-size="${starF}" fill="#ffe9a8" stroke="#221543" stroke-width="${Math.round(starF * 0.10)}"
        stroke-linejoin="round">&#10022;</text>` : ''}
    ${tagline ? `<text x="50%" y="${H - Math.round(tagF * 0.55)}" text-anchor="middle" font-family="Segoe UI, sans-serif"
        font-style="italic" font-weight="600" font-size="${tagF}" fill="#fdf3ff" stroke="#221543"
        stroke-width="${Math.round(tagF * 0.14)}" stroke-linejoin="round" paint-order="stroke">${tagline}</text>` : ''}
  </svg>`;
  const buf = await sharp(Buffer.from(svg)).resize(width).png().toBuffer();
  const meta = await sharp(buf).metadata();
  return { buf, w: meta.width, h: meta.height };
}

function placeLogo(lg, cx, top) {
  return [{ input: lg.buf, left: Math.round(cx - lg.w / 2), top: Math.round(top) }];
}

async function compose(name, w, h, layers, { transparent = false } = {}) {
  const base = sharp({ create: { width: w, height: h, channels: 4, background: transparent ? { r: 0, g: 0, b: 0, alpha: 0 } : '#1b1440' } });
  await base.composite(layers.flat()).png().toFile(`${OUT}/${name}.png`);
  console.log(`${name}.png  ${w}x${h}`);
}

// ---------- asset builders ----------
const TAG = 'Once upon a time…';

async function main() {
  await mkdir(OUT, { recursive: true });

  // 1. Main capsule 1232x706 — dreamy atrium, dragon right, party left, logo upper-left
  await compose('store_capsule_main', 1232, 706, [
    await bgLayer(BG.atrium, 1232, 706),
    scrim(1232, 706, [[0, '#1b1440', 0.25], [0.45, '#1b1440', 0], [1, '#1b1440', 0.45]]),
    place(await prepSprite(SPR.dragon, 500), 950, 690),
    place(await prepSprite(SPR.hero, 300), 400, 686),
    place(await prepSprite(SPR.bun, 170), 175, 680),
    place(await prepSprite(SPR.mochi, 140), 585, 678),
    placeLogo(await logoArt(660, { tagline: TAG }), 400, 60),
  ]);

  // 2. Store header capsule 920x430 — galaxy hall, logo centre-left, dragon right
  await compose('store_capsule_header', 920, 430, [
    await bgLayer(BG.galaxy, 920, 430),
    scrim(920, 430, [[0, '#141031', 0.35], [0.5, '#141031', 0.05], [1, '#141031', 0.5]]),
    place(await prepSprite(SPR.dragon, 330), 745, 424),
    place(await prepSprite(SPR.bun, 110), 545, 420),
    placeLogo(await logoArt(520, { tagline: TAG }), 300, 90),
  ]);

  // 3. Small capsule 462x174 — logo-dominant per Steam readability rules
  await compose('store_capsule_small', 462, 174, [
    await bgLayer(BG.galaxy, 462, 174, { blur: 2 }),
    scrim(462, 174, [[0, '#141031', 0.45], [0.5, '#141031', 0.25], [1, '#141031', 0.55]]),
    placeLogo(await logoArt(430, { star: false }), 231, 32),
  ]);

  // 4. Vertical capsule 748x896 — tall galaxy, dragon looming, hero front, logo top
  await compose('store_capsule_vertical', 748, 896, [
    await bgLayer(BG.galaxy, 748, 896, { pos: 'left' }),
    scrim(748, 896, [[0, '#141031', 0.4], [0.35, '#141031', 0], [1, '#141031', 0.55]]),
    place(await prepSprite(SPR.dragon, 470), 470, 700, { shadow: false }),
    place(await prepSprite(SPR.hero, 340), 300, 880),
    place(await prepSprite(SPR.mochi, 160), 590, 872),
    place(await prepSprite(SPR.bun, 190), 105, 868),
    placeLogo(await logoArt(640, { tagline: TAG }), 374, 48),
  ]);

  // 5. Store page background 1438x810 — ambient art only, darkened, no text
  await compose('store_page_background', 1438, 810, [
    await bgLayer(BG.atrium, 1438, 810, { blur: 1.2 }),
    scrim(1438, 810, [[0, '#100c28', 0.55], [0.5, '#100c28', 0.42], [1, '#100c28', 0.62]]),
  ]);

  // 6. Library capsule 600x900 — pastel town, hero + mascots, logo top
  await compose('library_capsule', 600, 900, [
    await bgLayer(BG.town, 600, 900, { pos: 'centre' }),
    scrim(600, 900, [[0, '#1b1440', 0.42], [0.35, '#1b1440', 0], [1, '#1b1440', 0.5]]),
    place(await prepSprite(SPR.hero, 400), 300, 850),
    place(await prepSprite(SPR.bun, 200), 120, 862),
    place(await prepSprite(SPR.mochi, 175), 490, 858),
    placeLogo(await logoArt(540, { tagline: TAG }), 300, 60),
  ]);

  // 7. Library header 920x430 — same family as store header, atrium variant
  await compose('library_header', 920, 430, [
    await bgLayer(BG.atrium, 920, 430),
    scrim(920, 430, [[0, '#1b1440', 0.35], [0.5, '#1b1440', 0.08], [1, '#1b1440', 0.5]]),
    place(await prepSprite(SPR.hero, 250), 730, 424),
    place(await prepSprite(SPR.mochi, 120), 585, 420),
    placeLogo(await logoArt(520, { star: false }), 310, 120),
  ]);

  // 8. Library hero 3840x1240 — pure key art, logo overlays separately per Steam
  await compose('library_hero', 3840, 1240, [
    await bgLayer(BG.atrium, 3840, 1240),
    scrim(3840, 1240, [[0, '#1b1440', 0.2], [0.5, '#1b1440', 0], [1, '#1b1440', 0.42]]),
    place(await prepSprite(SPR.dragon, 900), 2760, 1225),
    place(await prepSprite(SPR.hero, 520), 1930, 1218),
    place(await prepSprite(SPR.bun, 300), 1520, 1205),
    place(await prepSprite(SPR.mochi, 250), 2255, 1200),
  ]);

  // 9. Library logo 1280x720 transparent — logotype only, centred safe area
  await compose('library_logo', 1280, 720, [
    placeLogo(await logoArt(1080, { tagline: TAG }), 640, 190),
  ], { transparent: true });

  console.log('done → ' + OUT + '/');
}
main().catch(e => { console.error(e); process.exit(1); });
