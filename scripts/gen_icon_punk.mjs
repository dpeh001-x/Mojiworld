#!/usr/bin/env node
// The Mojiworld app icon's backdrop, punk: a graffiti wall with a pop-art burst behind Guguma.
//
// Per user: "For the Mojiworld Icon can we have the backdrop be a graffiti punk rock black white yellow
// with some pink background pop style". The palette is the game's own punk skin (BOONS, PUNK, v0.30.1063):
// ink #0b0a0e, paper #f4f1ea, hot pink #ff2d95, acid yellow #f3f542 - so the icon and the UI match.
//
//   wall     ink black, spray grain, white tags and scratches, a white halftone fade in two corners
//   burst    a hot-pink pop-art starburst behind him, printed a little off its acid-yellow copy (the
//            same misregistration as the loadout's heading), cut out as a sticker - black keyline,
//            paper border - with Ben-Day dots darkening toward its edge and pink paint running off it
//   accents  acid-yellow stars and a bolt in the pockets his silhouette leaves clear, hazard tape
//   sticker  Guguma himself gets a paper die-cut border and a hard ink drop, read from his own alpha
//            (assets/mojiworld_icon_guguma.png), so the yellow bird never sits on yellow paint
//
//   node scripts/gen_icon_punk.mjs            # write scripts/_tmp_icon_build/punk.png to look at
// Imported by scripts/gen_app_icon_art.mjs, which composites the committed subject over it.
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

export const S = 512;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUBJECT = join(ROOT, 'assets', 'mojiworld_icon_guguma.png');
const INK = '#0b0a0e', PAPER = '#f4f1ea', PK = '#ff2d95', PKD = '#c4006a', AY = '#f3f542';
const CX = 256, CY = 272;                              // his centre of mass, near the measured (256,275)
// Burst size, chosen from three proofs (valleys at 150 / 168 / 186 px). At 186 the burst filled the
// icon and the wall - the black, white and yellow the user asked for first - was gone; at 150 he hid
// nearly all of it and the pink stopped reading at 32 px. At 168 he breaks out of it: the spikes show
// between his wings and feet, and a band of wall survives all round. MIS is the yellow copy's offset.
const BIN = 168, BOUT = 222, MIS = 14;

function rng(seed) { let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f1 = (n) => n.toFixed(1);

// the burst: thirteen irregular spikes around him
function burstPath(seed) { const r = rng(seed), N = 13, pts = [];
  for (let i = 0; i < N * 2; i++) {
    const a = (i / (N * 2)) * Math.PI * 2 - Math.PI / 2 + (r() - 0.5) * 0.09;
    const rad = i % 2 ? BIN + r() * 12 : BOUT + r() * 30;
    pts.push([CX + Math.cos(a) * rad, CY + Math.sin(a) * rad]); }
  return { pts, d: 'M' + pts.map((p) => f1(p[0]) + ' ' + f1(p[1])).join(' L') + ' Z' }; }

// a spray-paint tag: a looping scribble with round caps, drawn in a box
function tag(seed, x, y, w, h, width, col, op) { const r = rng(seed); let d = `M${f1(x)} ${f1(y + h * r())}`;
  for (let i = 0; i < 6; i++) { const px = x + (w * (i + 1)) / 6;
    d += ` C${f1(px - w / 7)} ${f1(y - h * 0.3 + r() * h * 0.6)} ${f1(px - w / 12)} ${f1(y + h * 0.7 + r() * h * 0.6)} ${f1(px)} ${f1(y + r() * h)}`; }
  return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`; }
const drip = (x, y, len, w, col, key) => `<path d="M${f1(x - w / 2)} ${f1(y)} v${f1(len)} a${f1(w / 2)} ${f1(w / 2)} 0 0 0 ${f1(w)} 0 v${f1(-len)} Z" fill="${col}"${key ? ` stroke="${INK}" stroke-width="3"` : ''}/>`;
const star = (x, y, R, rot, col) => { const p = [];
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2 + rot, rr = i % 2 ? R * 0.45 : R;
    p.push(f1(x + Math.cos(a) * rr) + ',' + f1(y + Math.sin(a) * rr)); }
  return `<polygon points="${p.join(' ')}" fill="${col}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`; };

function wallSvg() { const r = rng(1066); let g = '';
  for (let i = 0; i < 900; i++) { const x = r() * S, y = r() * S;          // spray grain
    g += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(0.6 + r() * 1.3)}" fill="#fff" opacity="${f1(0.03 + r() * 0.07)}"/>`; }
  let dots = '';                                                              // halftone fades, two corners
  for (const [ox, oy, sx, sy] of [[0, 0, 1, 1], [S, S, -1, -1]]) for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) {
    const x = ox + sx * (8 + i * 13 + (j % 2) * 6.5), y = oy + sy * (8 + j * 13), d = Math.hypot(x - ox, y - oy);
    const rad = 5.2 * (1 - d / 170); if (rad > 0.6) dots += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(rad)}" fill="${PAPER}" opacity="0.55"/>`; }
  return `<rect width="${S}" height="${S}" fill="${INK}"/>${g}${dots}
    ${tag(7, 18, 330, 150, 60, 9, PAPER, 0.9)}${tag(21, 330, 20, 170, 46, 8, PAPER, 0.85)}
    ${tag(33, 360, 440, 140, 40, 6, PK, 0.9)}${tag(45, 10, 150, 90, 40, 5, AY, 0.8)}
    ${drip(60, 380, 60, 6, PAPER)}${drip(128, 372, 34, 5, PAPER)}${drip(402, 52, 38, 5, PAPER)}
    <g stroke="${PAPER}" stroke-width="5" stroke-linecap="round" opacity="0.8">
      <path d="M470 150 l26 26 M496 150 l-26 26"/><path d="M26 470 l18 -22 M40 480 l18 -22 M54 490 l18 -22"/></g>`; }

function burstSvg() { const { d: P, pts } = burstPath(1063), r = rng(99); let dots = '';
  for (let y = 0; y < S; y += 11) for (let x = (y / 11) % 2 ? 5.5 : 0; x < S; x += 11) {   // Ben-Day, darker at the rim
    const d = Math.hypot(x - CX, y - CY), rad = Math.max(0, (d - 150) / 140) * 4.6;
    if (rad > 0.5) dots += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(Math.min(4.6, rad))}"/>`; }
  // paint running off the spike tips that sit on the wall's lower half, where the drip has room to fall
  let drips = '';
  for (const [x, y] of pts.filter((p, i) => i % 2 === 0 && p[1] > 250 && p[1] < 470 && (p[0] < 140 || p[0] > 372)))
    drips += drip(x + (r() - 0.5) * 6, y - 14, 30 + r() * 46, 11 + r() * 4, PK, true);
  let splat = '';
  for (let i = 0; i < 60; i++) { const a = r() * Math.PI * 2, d = 250 + r() * 120, x = CX + Math.cos(a) * d, y = CY + Math.sin(a) * d;
    splat += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(1 + r() * r() * 7)}" fill="${i % 3 ? PK : PAPER}"/>`; }
  return `<defs><clipPath id="bc"><path d="${P}"/></clipPath>
      <filter id="os" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16"/></filter></defs>
    <path d="${P}" fill="${PK}" opacity="0.55" filter="url(#os)"/>${splat}
    <path d="${P}" transform="translate(${CX} ${CY}) scale(1.04) translate(${-CX + MIS} ${-CY + MIS * 0.85})" fill="${AY}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
    ${drips}
    <path d="${P}" fill="none" stroke="${INK}" stroke-width="30" stroke-linejoin="round"/>
    <path d="${P}" fill="none" stroke="${PAPER}" stroke-width="19" stroke-linejoin="round"/>
    <path d="${P}" fill="${PK}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
    <g clip-path="url(#bc)" fill="${PKD}" opacity="0.7">${dots}</g>
    <g stroke="#fff" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.85">
      <path d="M92 222 q10 -44 44 -70"/></g>`; }

function accentSvg() {
  return `${star(118, 96, 30, -0.25, AY)}${star(168, 52, 13, 0.3, PAPER)}${star(470, 318, 17, 0.2, AY)}
    <polygon points="372,30 350,78 368,78 352,118 398,62 378,62 394,30" fill="${AY}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <g transform="translate(420 468) rotate(-38)"><defs><pattern id="hz" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="22" height="22" fill="${AY}"/><rect width="11" height="22" fill="${INK}"/></pattern></defs>
      <rect x="-150" y="-17" width="300" height="34" fill="url(#hz)" stroke="${INK}" stroke-width="4"/></g>`; }

// his die-cut: the subject's alpha dilated into a paper border, and a hard ink drop under it
async function stickerLayers() {
  const { data, info } = await sharp(SUBJECT).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  const grow = async (sig, thr) => { const b = await sharp(data, { raw: { width: info.width, height: info.height, channels: 1 } })
    .blur(sig).raw().toBuffer({ resolveWithObject: true }); const c = b.info.channels, m = Buffer.alloc(S * S);
    for (let i = 0; i < S * S; i++) m[i] = b.data[i * c] > thr ? 255 : Math.round((b.data[i * c] / thr) * 255 * (b.data[i * c] > thr * 0.6 ? 1 : 0));
    return m; };
  const tint = (m, hex, dx, dy) => { const o = Buffer.alloc(S * S * 4), C = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const sx = x - dx, sy = y - dy; if (sx < 0 || sy < 0 || sx >= S || sy >= S) continue;
      const a = m[sy * S + sx]; if (!a) continue; const i = (y * S + x) * 4; o[i] = C[0]; o[i + 1] = C[1]; o[i + 2] = C[2]; o[i + 3] = a; }
    return sharp(o, { raw: { width: S, height: S, channels: 4 } }).png().toBuffer(); };
  const border = await grow(4.5, 18);
  return [await tint(border, INK, 11, 12), await tint(border, PAPER, 0, 0)];
}

/** The punk plate. Returns a 512x512 PNG Buffer (opaque). */
export async function punkPng() {
  const svg = `<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">${wallSvg()}${burstSvg()}${accentSvg()}</svg>`;
  const plate = await sharp(Buffer.from(svg), { density: 72 }).resize(S, S).png().toBuffer();
  const [drop, border] = await stickerLayers();
  return sharp(plate).composite([{ input: drop }, { input: border }]).flatten({ background: INK }).png().toBuffer();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const TMP = join(ROOT, 'scripts', '_tmp_icon_build'); await mkdir(TMP, { recursive: true });
  await writeFile(join(TMP, 'punk.png'), await punkPng()); console.log('wrote ' + join(TMP, 'punk.png'));
}
