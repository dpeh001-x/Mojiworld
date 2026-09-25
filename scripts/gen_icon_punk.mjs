#!/usr/bin/env node
// The Mojiworld app icon's backdrop, punk: a black comic panel with a pop-art burst behind Guguma.
//
// Per user: "For the Mojiworld Icon can we have the backdrop be a graffiti punk rock black white yellow
// with some pink background pop style" (v0.30.1074: a graffiti wall and a big pink burst), then, of that:
// "make the pink burst smaller so more black shows, something more like the background theme of the
// attached image, but more comic pop" - the attached image being a boon card: an ink-black plate with a
// thin keyline, a hot-pink rule over an acid-yellow one along its edge, a black keycap.
// The palette is the game's own punk skin (BOONS, PUNK, v0.30.1063): ink #0b0a0e, paper #f4f1ea, hot
// pink #ff2d95, acid yellow #f3f542 - so the icon and the UI match.
//
//   plate    ink black with the boon card's keyline, comic focus lines and Ben-Day dots in two corners
//   rules    the card's pink-over-yellow rule, twice, cut diagonally across two corners
//   burst    a SMALL hot-pink starburst behind him - it shows between his head, wings and feet, and the
//            plate shows everywhere else - printed off its acid-yellow copy, cut out as a sticker
//   accents  an acid-yellow bolt and star and a paper star in the pockets his silhouette leaves clear
//   sticker  Guguma himself gets a paper die-cut border and a hard ink drop, read from his own alpha
//            (assets/mojiworld_icon_guguma.png), so his black keyline never sits on the black plate
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
const INK = '#0b0a0e', PAPER = '#f4f1ea', PK = '#ff2d95', PKD = '#c4006a', AY = '#f3f542', KEY = '#3a3842';
const CX = 256, CY = 272;                              // his centre of mass, near the measured (256,275)
// Burst size. v0.30.1074 shipped valleys at 168 / tips at 222 and the pink ate the plate. Proofs at 128 and
// 142: at 128 the spikes barely cleared his outline and the burst stopped reading; at 142 (tips 204, the
// centre 10 px above his) it shows between his head, wings and feet and the black shows everywhere else.
const BIN = 142, BOUT = 204, BCY = 262, MIS = 11;

function rng(seed) { let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f1 = (n) => n.toFixed(1);

// the burst: thirteen irregular spikes around him
function burstPath(seed) { const r = rng(seed), N = 13, pts = [];
  for (let i = 0; i < N * 2; i++) {
    const a = (i / (N * 2)) * Math.PI * 2 - Math.PI / 2 + (r() - 0.5) * 0.09;
    const rad = i % 2 ? BIN + r() * 10 : BOUT + r() * 28;
    pts.push([CX + Math.cos(a) * rad, BCY + Math.sin(a) * rad]); }
  return 'M' + pts.map((p) => f1(p[0]) + ' ' + f1(p[1])).join(' L') + ' Z'; }
const star = (x, y, R, rot, col) => { const p = [];
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2 + rot, rr = i % 2 ? R * 0.45 : R;
    p.push(f1(x + Math.cos(a) * rr) + ',' + f1(y + Math.sin(a) * rr)); }
  return `<polygon points="${p.join(' ')}" fill="${col}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`; };

function plateSvg() { const r = rng(1075); let lines = '', dots = '';
  for (let k = 0; k < 60; k++) {                     // comic focus lines: thin wedges out from behind him
    if (r() < 0.22) continue;
    const a = (k / 60) * Math.PI * 2 + (r() - 0.5) * 0.05, w = 0.008 + r() * 0.016, r0 = 190, r1 = 460;
    const p = (ang, rad) => f1(CX + Math.cos(ang) * rad) + ',' + f1(CY + Math.sin(ang) * rad);
    lines += `<polygon points="${p(a, r0)} ${p(a + w, r1)} ${p(a - w, r1)}" fill="${PAPER}" opacity="${f1(0.10 + r() * 0.16)}"/>`; }
  for (const [ox, oy, sx, sy] of [[S, 0, -1, 1], [0, S, 1, -1]]) for (let j = 0; j < 13; j++) for (let i = 0; i < 13; i++) {
    const x = ox + sx * (7 + i * 12 + (j % 2) * 6), y = oy + sy * (7 + j * 12), d = Math.hypot(x - ox, y - oy);
    const rad = 4.6 * (1 - d / 165); if (rad > 0.6) dots += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(rad)}" fill="${PAPER}" opacity="0.32"/>`; }
  return `<rect width="${S}" height="${S}" fill="${INK}"/>${lines}${dots}
    <rect x="11" y="11" width="${S - 22}" height="${S - 22}" rx="106" fill="none" stroke="${KEY}" stroke-width="3"/>`; }

// the boon card's edge: a hot-pink rule printed over an acid-yellow one, laid diagonally across a corner
function rulesSvg() { const rule = (x1, y1, x2, y2) => {
    const n = Math.hypot(x2 - x1, y2 - y1), ux = -(y2 - y1) / n, uy = (x2 - x1) / n;
    const band = (off, w, col) => `<line x1="${f1(x1 + ux * off)}" y1="${f1(y1 + uy * off)}" x2="${f1(x2 + ux * off)}" y2="${f1(y2 + uy * off)}" stroke="${col}" stroke-width="${w}"/>`;
    return band(15, 10, AY) + band(0, 17, PK); };
  return rule(-20, 176, 176, -20) + rule(338, 532, 532, 338); }

function burstSvg() { const P = burstPath(1063); let dots = '';
  for (let y = 0; y < S; y += 10) for (let x = (y / 10) % 2 ? 5 : 0; x < S; x += 10) {   // Ben-Day, darker at the rim
    const d = Math.hypot(x - CX, y - BCY), rad = Math.max(0, (d - BIN * 0.75) / (BOUT - BIN * 0.75)) * 4.2;
    if (rad > 0.5) dots += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(Math.min(4.2, rad))}"/>`; }
  return `<defs><clipPath id="bc"><path d="${P}"/></clipPath></defs>
    <path d="${P}" transform="translate(${MIS} ${f1(MIS * 0.85)})" fill="${AY}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
    <path d="${P}" fill="none" stroke="${INK}" stroke-width="28" stroke-linejoin="round"/>
    <path d="${P}" fill="none" stroke="${PAPER}" stroke-width="18" stroke-linejoin="round"/>
    <path d="${P}" fill="${PK}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
    <g clip-path="url(#bc)" fill="${PKD}" opacity="0.7">${dots}</g>`; }

function accentSvg() {
  return `${star(96, 440, 26, -0.25, AY)}${star(150, 486, 11, 0.3, PAPER)}${star(472, 318, 15, 0.2, PAPER)}
    <polygon points="372,30 350,78 368,78 352,118 398,62 378,62 394,30" fill="${AY}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`; }

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
  const svg = `<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">${plateSvg()}${rulesSvg()}${burstSvg()}${accentSvg()}</svg>`;
  const plate = await sharp(Buffer.from(svg), { density: 72 }).resize(S, S).png().toBuffer();
  const [drop, border] = await stickerLayers();
  return sharp(plate).composite([{ input: drop }, { input: border }]).flatten({ background: INK }).png().toBuffer();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const TMP = join(ROOT, 'scripts', '_tmp_icon_build'); await mkdir(TMP, { recursive: true });
  await writeFile(join(TMP, 'punk.png'), await punkPng()); console.log('wrote ' + join(TMP, 'punk.png'));
}
