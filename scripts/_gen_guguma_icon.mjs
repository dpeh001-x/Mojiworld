// Mojiworld app icon: the real Guguma NPC + the MOJIWORLD wordmark on a designed backdrop.
// Outputs assets/mojiworld_icon_512.png (rounded) and assets/mojiworld_icon_184.jpg (full-bleed).
import sharp from 'sharp';
import fs from 'node:fs';

const S = 512;
const CX = 256;
const HALO_Y = 214;      // Guguma body center-ish
const FEET_Y = 372;      // Guguma stands here; wordmark banner sits below

function backdrop(rx) {
  let rays = '';
  for (let i = 0; i < 12; i++) {
    const a = (i * 30) * Math.PI / 180, sp = 2.6 * Math.PI / 180, R = 340;
    const x1 = CX + Math.cos(a - sp) * R, y1 = HALO_Y + Math.sin(a - sp) * R;
    const x2 = CX + Math.cos(a + sp) * R, y2 = HALO_Y + Math.sin(a + sp) * R;
    rays += `<path d="M${CX} ${HALO_Y} L${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} Z"/>`;
  }
  const stars = [
    [66, 84, 3.0, .9], [118, 150, 2, .55], [446, 96, 2.6, .85], [402, 54, 1.8, .5],
    [40, 250, 1.9, .6], [478, 236, 1.9, .6], [452, 320, 1.7, .5], [58, 330, 1.7, .5],
  ].map(([x, y, r, o]) => `<circle cx="${x}" cy="${y}" r="${r}" opacity="${o}"/>`).join('');
  return `<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#8B5CF6"/><stop offset="0.52" stop-color="#4F46E5"/><stop offset="1" stop-color="#06B6D4"/>
      </linearGradient>
      <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#FFF3C0" stop-opacity="0.95"/>
        <stop offset="0.45" stop-color="#FFD86B" stop-opacity="0.5"/>
        <stop offset="1" stop-color="#FFD86B" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="perch" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.5"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="ring" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#FDE68A"/><stop offset="0.5" stop-color="#FBBF24"/><stop offset="1" stop-color="#FDE68A"/>
      </linearGradient>
      <linearGradient id="banner" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1e1b4b" stop-opacity="0"/><stop offset="1" stop-color="#1e1b4b" stop-opacity="0.34"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${S}" height="${S}" rx="${rx}" fill="url(#bg)"/>
    <g fill="#FFE9A8" opacity="0.11">${rays}</g>
    <g fill="#ffffff">${stars}</g>
    <g stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.8">
      <path d="M94 58 v16 M86 66 h16"/>
    </g>
    <g transform="rotate(-18 ${CX} 226)">
      <ellipse cx="${CX}" cy="226" rx="186" ry="48" fill="none" stroke="url(#ring)" stroke-width="7" opacity="0.85"/>
    </g>
    <circle cx="${CX}" cy="${HALO_Y}" r="152" fill="url(#halo)"/>
    <ellipse cx="${CX}" cy="${FEET_Y}" rx="126" ry="24" fill="url(#perch)"/>
    <ellipse cx="${CX}" cy="${FEET_Y + 6}" rx="80" ry="14" fill="#0b1030" opacity="0.22"/>
    <rect x="0" y="360" width="${S}" height="152" fill="url(#banner)"/>
  </svg>`;
}

function foreground() {
  return `<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
    <g fill="#FDE68A"><path d="M404 118 l9 22 22 9 -22 9 -9 22 -9 -22 -22 -9 22 -9 Z"/></g>
    <g fill="#FFFFFF" opacity="0.95"><path d="M116 300 l5 12 12 5 -12 5 -5 12 -5 -12 -12 -5 12 -5 Z"/></g>
  </svg>`;
}

function roundMask(rx) {
  return Buffer.from(`<svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${S}" height="${S}" rx="${rx}" fill="#fff"/></svg>`);
}

// Optional photo/art background (e.g. the candy-forest cinematic). Drop the file at
// assets/icon_bg.png (or set ICON_BG). When present it replaces the cosmic gradient;
// we darken it + add a bottom scrim so Guguma (yellow) and the wordmark stay readable.
const BG_PATH = process.env.ICON_BG || 'assets/icon_bg.png';
const HAS_BG = fs.existsSync(BG_PATH);

function photoOverlay(rx) {
  return Buffer.from(`<svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="vig" cx="0.5" cy="0.42" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#0a0a1e" stop-opacity="0.55"/></radialGradient>
      <radialGradient id="halo2" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FFF3C0" stop-opacity="0.9"/><stop offset="0.5" stop-color="#FFD86B" stop-opacity="0.42"/><stop offset="1" stop-color="#FFD86B" stop-opacity="0"/></radialGradient>
      <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140b26" stop-opacity="0"/><stop offset="1" stop-color="#140b26" stop-opacity="0.62"/></linearGradient>
    </defs>
    <rect width="${S}" height="${S}" fill="#000" opacity="0.14"/>
    <rect width="${S}" height="${S}" fill="url(#vig)"/>
    <circle cx="${CX}" cy="${HALO_Y}" r="150" fill="url(#halo2)"/>
    <ellipse cx="${CX}" cy="${FEET_Y + 6}" rx="84" ry="15" fill="#000" opacity="0.3"/>
    <rect x="0" y="330" width="${S}" height="182" fill="url(#scrim)"/>
  </svg>`);
}

async function build() {
  // Guguma sprite — sit on the perch, above the wordmark banner
  const GH = 286;
  const gug = await sharp('Sprites/npc/Guguma.webp').trim().resize({ height: GH }).png().toBuffer({ resolveWithObject: true });
  const gLeft = Math.round((S - gug.info.width) / 2);
  const gTop = Math.round(FEET_Y - gug.info.height);

  // MOJIWORLD wordmark — banner across the bottom
  const LOGO_W = 452;
  const logo = await sharp('Sprites/ui/mojiworld_logo.png').resize({ width: LOGO_W }).png().toBuffer({ resolveWithObject: true });
  const lLeft = Math.round((S - logo.info.width) / 2);
  const lTop = Math.round(490 - logo.info.height);

  const fgPng = await sharp(Buffer.from(foreground()), { density: 300 }).resize(S, S).png().toBuffer();
  const maskPng = await sharp(roundMask(116), { density: 200 }).resize(S, S).png().toBuffer();

  // base backdrop: photo art (if provided) with a darken+scrim overlay, else the cosmic gradient
  let bdRound, bdFull;
  if (HAS_BG) {
    const photo = await sharp(BG_PATH).resize(S, S, { fit: 'cover', position: 'attention' }).toBuffer();
    const ov = await sharp(photoOverlay()).resize(S, S).png().toBuffer();
    bdRound = bdFull = await sharp(photo).composite([{ input: ov, left: 0, top: 0 }]).png().toBuffer();
    console.log('using background image:', BG_PATH);
  } else {
    bdRound = await sharp(Buffer.from(backdrop(116)), { density: 300 }).resize(S, S).png().toBuffer();
    bdFull = await sharp(Buffer.from(backdrop(0)), { density: 300 }).resize(S, S).png().toBuffer();
    console.log('no', BG_PATH, '— using the cosmic-gradient backdrop');
  }

  const layers = [
    { input: gug.data, left: gLeft, top: gTop },
    { input: fgPng, left: 0, top: 0 },
    { input: logo.data, left: lLeft, top: lTop },
  ];

  const OUT512 = process.env.OUT512 || 'assets/mojiworld_icon_512.png';
  const OUT184 = process.env.OUT184 || 'assets/mojiworld_icon_184.jpg';

  // 512 rounded PNG
  await sharp(bdRound).composite([...layers, { input: maskPng, left: 0, top: 0, blend: 'dest-in' }]).png().toFile(OUT512);

  // 184 full-bleed JPG — composite at 512 first (sharp resizes before compositing), then downscale
  const composedFull = await sharp(bdFull).composite(layers).png().toBuffer();
  await sharp(composedFull).flatten({ background: '#4F46E5' }).resize(184, 184)
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toFile(OUT184);

  const p512 = Math.round(fs.statSync(OUT512).size / 1024);
  const p184 = Math.round(fs.statSync(OUT184).size / 1024);
  console.log(`OK  guguma ${gug.info.width}x${gug.info.height}@(${gLeft},${gTop})  logo ${logo.info.width}x${logo.info.height}@(${lLeft},${lTop})  |  512 ${p512}KB  184 ${p184}KB`);
}
build().catch(e => { console.error(e); process.exit(1); });
