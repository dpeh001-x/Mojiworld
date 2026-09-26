#!/usr/bin/env node
// The Mojiworld app icon's backdrop: pop art, in the game's punk-skin palette.
//
// Per user, in order: "can we have the backdrop be a graffiti punk rock black white yellow with some pink
// background pop style" (v0.30.1074: a graffiti wall, a big pink burst); "make the pink burst smaller so
// more black shows, something more like the background theme of the attached image [a boon card], but more
// comic pop" (v0.30.1077: a black panel, a smaller burst, pink rules across two corners); then "The
// background can still be better, the pink should be more sparse, look at AAA pop art" (v0.30.1083: one
// white shard); then "The white motion slashes at the back is not good, lets use dark hot pink, make guguma
// standout more, improve on aestheticism" - picked from three proofs - "but make the white part of the slash
// black instead".
//
// What AAA pop art does that the last two did not (Persona 5's menus, Spider-Verse, Hi-Fi Rush): ONE bold
// graphic shape carries the composition; the palette is black and white, with yellow as the second colour
// and the accent used in hits, not fields; halftone is SHADING - dots growing in one direction across a
// form - never all-over texture; misregistration is a sliver on one edge, not a second copy of everything.
//
//   plate    ink black, dark-hot-pink halftone ramps into the top-left and bottom-right corners, the boon
//            card's keyline
//   shard    one asymmetric burst behind him - two long spikes on the diagonal, the rest short - filled
//            BLACK, so it reads as a cut through the halftone: drawn by its acid-yellow misprint copy and a
//            dark-hot-pink outline echo (the layered plates of a P5 menu), dark-pink Ben-Day shading inside
//   accents  four dark-hot-pink motion slashes along the diagonal, a yellow star, a hot-pink sliver on one
//            spike and one small hot-pink star
//   sticker  Guguma: a thick paper die-cut border ringed in ink, and a hard ink drop, from his own alpha
//            (assets/mojiworld_icon_guguma.png). He is the only light thing in the icon - the v0.30.1083
//            white shard had 26% of the ring round his sticker as bright as the sticker itself; now 0%.
// Palette: the punk skin (BOONS, PUNK, v0.30.1063): ink #0b0a0e, paper #f4f1ea, pink #ff2d95, yellow #f3f542.
//
// Palette note: dark hot pink #c8106e is the punk skin's pink taken down for the background layers.
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
const INK = '#0b0a0e', PAPER = '#f4f1ea', PK = '#ff2d95', PKD = '#c8106e', AY = '#f3f542', KEY = '#3a3842';
const CX = 256, CY = 262;                              // the shard's centre, 10 px above his (256,272)
// [angle deg, radius]: two long spikes on the up-right / down-left diagonal, the rest short. Valleys sit at
// 150-165, inside his silhouette, so only the spikes show.
const SPIKES = [[-95, 224], [-50, 338], [-12, 214], [26, 232], [64, 206], [104, 222], [140, 340], [178, 214], [218, 230]];

const f1 = (n) => n.toFixed(1);
const pt = (deg, r) => [CX + Math.cos((deg * Math.PI) / 180) * r, CY + Math.sin((deg * Math.PI) / 180) * r];
function shardPts() { const out = [];
  SPIKES.forEach(([a, r], i) => { const [b] = SPIKES[(i + 1) % SPIKES.length], mid = (a + (b < a ? b + 360 : b)) / 2;
    out.push(pt(a, r), pt(mid, 152 + ((i * 7) % 13))); });
  return out; }
const poly = (pts) => pts.map((p) => f1(p[0]) + ',' + f1(p[1])).join(' ');
const star = (x, y, R, rot, col) => { const p = [];
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2 + rot, rr = i % 2 ? R * 0.45 : R;
    p.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  return `<polygon points="${poly(p)}" fill="${col}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`; };
// a Ben-Day ramp: dots on a grid whose radius grows along a direction
function ramp(step, dx, dy, from, span, rmax, fill, op) { let s = '';
  for (let y = 0, row = 0; y < S + step; y += step * 0.866, row++) for (let x = (row % 2) * step / 2; x < S + step; x += step) {
    const t = ((x - CX) * dx + (y - CY) * dy - from) / span, r = Math.min(rmax, t * rmax);
    if (r > 0.45) s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}"/>`; }
  return `<g fill="${fill}" opacity="${op}">${s}</g>`; }

function plateSvg() {
  return `<rect width="${S}" height="${S}" fill="${INK}"/>${ramp(14, -0.707, -0.707, 120, 200, 5.8, PKD, 0.35)}${ramp(14, 0.707, 0.707, 170, 170, 5.8, PKD, 0.35)}
    <rect x="11" y="11" width="${S - 22}" height="${S - 22}" rx="106" fill="none" stroke="${KEY}" stroke-width="3"/>`; }

function shardSvg() { const P = shardPts(), [a, r] = SPIKES[1], i = 1;
  const tip = pt(a, r), l = P[i * 2 - 1], rr = P[i * 2 + 1];                   // the long up-right spike
  return `<defs><clipPath id="sc"><polygon points="${poly(P)}"/></clipPath></defs>
    <polygon points="${poly([l, tip, rr])}" transform="translate(-9 -7)" fill="${PK}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <polygon points="${poly(P)}" transform="translate(${CX} ${CY}) scale(1.16) translate(${-CX} ${-CY})" fill="none" stroke="${PKD}" stroke-width="3" stroke-linejoin="round" opacity="0.9"/>
    <polygon points="${poly(P)}" transform="translate(13 11)" fill="${AY}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
    <polygon points="${poly(P)}" fill="${INK}" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
    <g clip-path="url(#sc)">${ramp(9, 0.707, 0.707, 10, 230, 4.4, PKD, 0.55)}</g>`; }

function accentSvg() { const slash = (x, y, len, w) => { const ux = 0.643, uy = -0.766, nx = -uy, ny = ux;   // along the long spikes, tapering
    const ex = x + ux * len / 2, ey = y + uy * len / 2;
    return `<polygon points="${poly([[x - ux * len / 2, y - uy * len / 2], [ex + nx * w / 2, ey + ny * w / 2], [ex - nx * w / 2, ey - ny * w / 2]])}" fill="${PKD}"/>`; };
  return `${slash(66, 128, 110, 14)}${slash(104, 150, 70, 10)}${slash(438, 402, 110, 14)}${slash(408, 440, 70, 10)}
    ${star(116, 84, 24, -0.25, AY)}${star(452, 330, 13, 0.3, PK)}`; }

// his die-cut: the subject's alpha dilated into a paper border (~9 px), ringed in ink (~4 px), with a hard ink drop
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
  const border = await grow(6, 14), rim = await grow(9, 7);
  return [await tint(rim, INK, 11, 12), await tint(rim, INK, 0, 0), await tint(border, PAPER, 0, 0)];
}

/** The punk plate. Returns a 512x512 PNG Buffer (opaque). */
export async function punkPng() {
  const svg = `<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">${plateSvg()}${shardSvg()}${accentSvg()}</svg>`;
  const plate = await sharp(Buffer.from(svg), { density: 72 }).resize(S, S).png().toBuffer();
  const layers = await stickerLayers();
  return sharp(plate).composite(layers.map((input) => ({ input }))).flatten({ background: INK }).png().toBuffer();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const TMP = join(ROOT, 'scripts', '_tmp_icon_build'); await mkdir(TMP, { recursive: true });
  await writeFile(join(TMP, 'punk.png'), await punkPng()); console.log('wrote ' + join(TMP, 'punk.png'));
}
