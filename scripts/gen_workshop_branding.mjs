// Steam Workshop "Custom Branding Image" — exactly 948x203 JPG.
//
//   node scripts/gen_workshop_branding.mjs
//
// Valve's brief: recognizable artwork + the game logo, with NEUTRAL SPACE ON THE
// RIGHT because Steam overlays a title and a sentence about Workshop use there.
// So the composition is deliberately left-weighted: art bleeds from the left
// edge and dissolves into flat panel colour by ~55% across, and the logo sits in
// the lit left third rather than centred.
//
// Source art is the store hero (steam/assets/upload/library_hero.png, 1920x620).
// Its left half is the bright, friendly side — hero character, ninja, the three
// creatures — which reads far better at 203px tall than the dark boss half.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const W = 948, H = 203;
const OUT = 'steam/assets/upload';
const HERO = 'steam/assets/upload/library_hero.png';
const LOGO = 'steam/assets/library_logo.png';

// Panel colour picked to sit with the hero's cool left-hand palette rather than
// a generic grey, so the fade reads as one image instead of art glued to a box.
const PANEL = { r: 26, g: 22, b: 40 };

const meta = await sharp(HERO).metadata();

// Crop a 4.67:1 slice (the target aspect) from the LEFT of the hero so nothing
// is squashed, then downscale once. Vertical window chosen to keep the hero's
// face and the creatures both in frame.
// left:150 skips the dead scenery column at the very edge so the characters sit
// further left and clear the logo. top:44 keeps the hero's hat un-clipped — at
// top:110 the crown of the hat was cut off.
const cropW = Math.min(1460, meta.width - 150);
const cropH = Math.round(cropW * H / W);
const top = Math.max(0, Math.min(meta.height - cropH, 44));
const art = await sharp(HERO)
  .extract({ left: 150, top, width: cropW, height: cropH })
  .resize(W, H, { fit: 'fill' })
  .toBuffer();                            // no global dim — the logo gets its own scrim

// Horizontal dissolve: art at full strength on the left, flat panel from ~58%.
const fade = Buffer.from(
`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
   <defs>
     <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
       <stop offset="0.00" stop-color="rgb(${PANEL.r},${PANEL.g},${PANEL.b})" stop-opacity="0"/>
       <stop offset="0.46" stop-color="rgb(${PANEL.r},${PANEL.g},${PANEL.b})" stop-opacity="0.06"/>
       <stop offset="0.60" stop-color="rgb(${PANEL.r},${PANEL.g},${PANEL.b})" stop-opacity="0.70"/>
       <stop offset="0.70" stop-color="rgb(${PANEL.r},${PANEL.g},${PANEL.b})" stop-opacity="0.97"/>
       <stop offset="1.00" stop-color="rgb(${PANEL.r},${PANEL.g},${PANEL.b})" stop-opacity="1"/>
     </linearGradient>
     <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
       <stop offset="0" stop-color="#000" stop-opacity="0.26"/>
       <stop offset="0.35" stop-color="#000" stop-opacity="0"/>
       <stop offset="0.72" stop-color="#000" stop-opacity="0"/>
       <stop offset="1" stop-color="#000" stop-opacity="0.30"/>
     </linearGradient>
     <!-- Local scrim behind the logo only. Dimming the whole frame (first
          attempt) muddied the art; this keeps the illustration bright and buys
          contrast just where the wordmark needs it. -->
     <!-- Diagonal so it weights the BOTTOM-left where the wordmark now sits,
          leaving the character's face in the upper left at full brightness. -->
     <linearGradient id="s" x1="0" y1="1" x2="0.85" y2="0">
       <stop offset="0.00" stop-color="#0d0a16" stop-opacity="0.66"/>
       <stop offset="0.34" stop-color="#0d0a16" stop-opacity="0.34"/>
       <stop offset="0.60" stop-color="#0d0a16" stop-opacity="0"/>
     </linearGradient>
   </defs>
   <rect width="${W}" height="${H}" fill="url(#s)"/>
   <rect width="${W}" height="${H}" fill="url(#g)"/>
   <rect width="${W}" height="${H}" fill="url(#v)"/>
 </svg>`);

// Logo: trim the transparent margin off the 1280x720 source before scaling, or
// it shrinks to nothing inside its own padding.
const logoTrimmed = await sharp(LOGO).trim().toBuffer();
const lm = await sharp(logoTrimmed).metadata();
const logoW = 330;
const logoH = Math.round(lm.height * logoW / lm.width);
const logo = await sharp(logoTrimmed).resize(logoW, logoH).png().toBuffer();
// Bottom-left, not centred: centred it landed straight across the hero
// character's face. Dropping it to the baseline keeps her expression readable
// above the wordmark, which is the whole point of using her as the hero art.
const logoTop = H - logoH - 16;
const logoLeft = 26;

mkdirSync(OUT, { recursive: true });
await sharp(art)
  .composite([
    { input: fade, top: 0, left: 0 },
    { input: logo, top: logoTop, left: logoLeft },
  ])
  .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
  .toFile(`${OUT}/workshop_branding.jpg`);

const out = await sharp(`${OUT}/workshop_branding.jpg`).metadata();
console.log(`workshop_branding.jpg  ${out.width}x${out.height}  ${out.format}`);
console.log(out.width === W && out.height === H ? 'dimensions match Valve spec (948x203)' : 'WRONG SIZE');
console.log(`logo ${logoW}x${logoH} at x=34; neutral panel from ~${Math.round(W * 0.62)}px rightward`);
