#!/usr/bin/env node
// Regenerate the Hundred-Hand Shadow Dance SKILL ICON.
//
// Per user: "change the skill icon as well." The FX was reworked into a violet
// sakura mandala (v0.30.121-130); the icon was still the crossed red-and-gold
// blades it has always been, which matched neither that art nor the blue art
// before it.
//
// THE ICON IS NOT THE FX, and cannot be a resize of it. The B-slot ult icons
// carry a thick WHITE KEYLINE around the whole silhouette - shinobi_ult,
// shadowlord_ult, nightreaper_ult and phantom_ult all measure 100% of their
// boundary as near-white - while the FX sprite measures 0%, correctly, being a
// different asset class. An icon without it reads as foreign in the skill bar.
//
//   node scripts/gen_shinobi_ult_icon.mjs             # measure what is on disk
//   node scripts/gen_shinobi_ult_icon.mjs --generate  # needs LUDO_API_KEY
import sharp from 'sharp';
import { writeFile, rename } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICON = join(ROOT, 'Sprites', 'skills', 'shinobi_ult.webp');
const PX = 256;
const has = (f) => process.argv.slice(2).includes(f);

const MIN_KEYLINE = 85;   // % of the silhouette boundary that must be near-white
const MIN_RIM_VIOLET = 55;
const MIN_CENTRE_PINK = 25;

const PROMPT =
  'A game SKILL ICON, square, seen head-on: a violet lotus mandala emblem with ' +
  'a single pink SAKURA CHERRY BLOSSOM at its centre - five rounded petals with ' +
  'notched tips. ' +
  'TWO COLOURS, KEPT APART. The lotus petals radiating around the outside are ' +
  'DEEP ROYAL PURPLE AND VIOLET - amethyst and indigo, dark and richly ' +
  'saturated - and they are most of the emblem. ONLY the small blossom at the ' +
  'very centre is PINK: soft rose, a warm pink heart inside the purple. The ' +
  'outer petals must NOT be pink and must NOT fade toward pink at their tips. ' +
  'CRITICAL - THICK WHITE OUTLINE: the whole emblem is bordered by a bold, even, ' +
  'pure WHITE KEYLINE that follows the entire outer silhouette all the way ' +
  'round, like a sticker cut-out. Every outer edge of the emblem carries it. ' +
  'Bold, clean, high-contrast game-UI icon art with crisp shapes that read at ' +
  'small size. Centred, filling the frame with a little margin, nothing cropped. ' +
  'NO hands, NO figure, NO face, NO swords or blades, NO text, NO letters, NO ' +
  'background, NO border box, NO drop shadow. Fully transparent background.';

function hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { if (mx === r) h = 60 * (((g - b) / d) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4); }
  if (h < 0) h += 360;
  return [h, mx ? d / mx : 0, mx / 255];
}

async function measure(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  const A = (x, y) => data[(y * W + x) * C + 3];
  let cx = 0, cy = 0, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y) > 128) { cx += x; cy += y; n++; }
  if (!n) return null;
  cx /= n; cy /= n;
  let maxR = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y) > 128)
    maxR = Math.max(maxR, Math.hypot(x - cx, y - cy));

  // The white keyline: solid pixels within 2px of transparency that are near
  // white. This is the style test - it is what makes an icon look like it
  // belongs on the bar next to shadowlord_ult and phantom_ult.
  const isWhite = (x, y) => {
    const o = (y * W + x) * C, r = data[o], g = data[o+1], b = data[o+2];
    return Math.min(r,g,b) > 180 && Math.max(r,g,b) - Math.min(r,g,b) < 46;
  };
  let edge = 0, white = 0, near = 0;
  for (let y = 5; y < H - 5; y++) for (let x = 5; x < W - 5; x++) {
    if (A(x, y) < 160) continue;
    let bnd = false, nx = 0, ny = 0;
    for (let d = 1; d <= 2 && !bnd; d++) {
      if (A(x-d,y) < 60) { bnd = true; nx = 1; }
      else if (A(x+d,y) < 60) { bnd = true; nx = -1; }
      else if (A(x,y-d) < 60) { bnd = true; ny = 1; }
      else if (A(x,y+d) < 60) { bnd = true; ny = -1; }
    }
    if (!bnd) continue;
    edge++;
    if (isWhite(x, y)) { white++; near++; continue; }
    // Not white AT the boundary - is the keyline simply buried under an outer
    // glow? Step inward and look for it before calling it absent.
    for (let d = 1; d <= 4; d++) {
      const px = x + nx * d, py = y + ny * d;
      if (px < 0 || py < 0 || px >= W || py >= H) break;
      if (isWhite(px, py)) { near++; break; }
    }
  }

  // Hue zones, as for the FX - but over SATURATED pixels only. An icon's white
  // keyline and black linework are style, not colour failure, and counting them
  // in the denominator would score a correctly-styled icon as insufficiently
  // violet purely for having the outline the style demands.
  const Rin = maxR * 0.32, Rout = maxR * 0.5;
  let oVio = 0, oSat = 0, cPink = 0, cSat = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * C;
    if (data[o + 3] < 128) continue;
    const [h, sa, v] = hsv(data[o], data[o+1], data[o+2]);
    if (v < 0.12 || sa <= 0.18) continue;
    const r2 = Math.hypot(x - cx, y - cy);
    if (r2 <= Rin) { cSat++; if (h >= 306 || h < 8) cPink++; }
    else if (r2 >= Rout) { oSat++; if (h >= 250 && h < 298) oVio++; }
  }
  let bleed = 0;
  for (let x = 0; x < W; x++) { if (A(x, 0) > 200) bleed++; if (A(x, H-1) > 200) bleed++; }
  for (let y = 0; y < H; y++) { if (A(0, y) > 200) bleed++; if (A(W-1, y) > 200) bleed++; }
  return {
    keyline: edge ? +(100 * white / edge).toFixed(1) : 0,
    keylineWithin4: edge ? +(100 * near / edge).toFixed(1) : 0,
    rimViolet: oSat ? +(100 * oVio / oSat).toFixed(1) : 0,
    centrePink: cSat ? +(100 * cPink / cSat).toFixed(1) : 0,
    bleed,
  };
}
const fmt = (m) => `keyline ${m.keyline}%` + (m.keylineWithin4 > m.keyline + 5 ? ` (${m.keylineWithin4}% within 4px)` : '') +
  `  rimViolet ${m.rimViolet}%  centrePink ${m.centrePink}%  bleed ${m.bleed}`;

async function normalise(buf) {
  const t = await sharp(buf).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
  const side = Math.max(t.info.width, t.info.height);
  const inner = Math.round(PX * 0.94);
  const scaled = await sharp(t.data).resize(
    Math.max(1, Math.round(t.info.width / side * inner)),
    Math.max(1, Math.round(t.info.height / side * inner)), { fit: 'fill' }).png().toBuffer();
  const m = await sharp(scaled).metadata();
  return sharp({ create: { width: PX, height: PX, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: scaled, left: Math.round((PX - m.width) / 2), top: Math.round((PX - m.height) / 2) }])
    .webp({ quality: 94 }).toBuffer();
}

if (existsSync(ICON)) console.log('icon on disk :', fmt(await measure(readFileSync(ICON))));
for (const sib of ['shadowlord_ult', 'phantom_ult']) {
  const p = join(ROOT, 'Sprites', 'skills', sib + '.webp');
  if (existsSync(p)) console.log(`  ${sib.padEnd(16)}`, fmt(await measure(readFileSync(p))));
}
if (!has('--generate')) {
  console.log(`\n# Re-run with --generate (needs LUDO_API_KEY).`);
  console.log(`# Gate: white keyline >= ${MIN_KEYLINE}%, rim violet >= ${MIN_RIM_VIOLET}%,` +
              ` centre pink >= ${MIN_CENTRE_PINK}%, nothing on the frame edge.`);
  process.exit(0);
}

const K = process.env.LUDO_API_KEY;
if (!K) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const KEEP = process.env.KEEP_DIR || '';
const ROLLS = Number(process.env.ROLLS || 6);

let best = null;
for (let a = 1; a <= ROLLS; a++) {
  try {
    process.stdout.write(`icon ${a}: `);
    const r = await fetch(API + '/assets/image', { method: 'POST',
      headers: { Authorization: `ApiKey ${K}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(300000),
      body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga',
        aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PROMPT }) });
    if (!r.ok) throw new Error(`image ${r.status}: ${(await r.text().catch(() => '')).slice(0, 140)}`);
    const data = await r.json();
    const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
    if (!url) throw new Error('no url');
    const dl = await fetch(url, { signal: AbortSignal.timeout(180000) });
    if (!dl.ok) throw new Error('download ' + dl.status);
    const out = await normalise(Buffer.from(await dl.arrayBuffer()));
    const m = await measure(out);
    if (!m) throw new Error('empty');
    console.log(fmt(m));
    // Rejected rolls are kept: a gate that discards its evidence cannot be
    // debugged, which cost real rolls on the FX pass.
    if (KEEP) await writeFile(join(KEEP, `icon_${String(a).padStart(2, '0')}.webp`), out);
    if (m.bleed > 0) throw new Error(`touches the frame edge (${m.bleed}px)`);
    if (m.keyline < MIN_KEYLINE) throw new Error(
      m.keylineWithin4 >= MIN_KEYLINE
        ? `the keyline is buried under an outer glow (${m.keyline}% at the edge, ${m.keylineWithin4}% within 4px)` +
          ' - the house icons have no halo outside the line'
        : `no white keyline (${m.keyline}% < ${MIN_KEYLINE}%) - would look foreign on the skill bar`);
    if (m.rimViolet < MIN_RIM_VIOLET) throw new Error(`the outer petals are not violet (${m.rimViolet}%)`);
    if (m.centrePink < MIN_CENTRE_PINK) throw new Error(`the centre is not pink (${m.centrePink}%)`);
    const score = +(m.keyline + m.rimViolet + m.centrePink).toFixed(1);
    console.log(`        accepted — score ${score}` + (best ? ` (incumbent ${best.score})` : ''));
    if (!best || score > best.score) best = { buf: out, m, score };
  } catch (e) {
    console.log('rejected: ' + e.message);
    if (/\b402\b|credit/i.test(e.message)) { console.error('OUT OF CREDITS'); process.exit(3); }
  }
}
if (!best) { console.error('FAILED — icon left untouched'); process.exit(1); }
await writeFile(ICON + '.tmp', best.buf);
await rename(ICON + '.tmp', ICON);
console.log(`WROTE icon — ${fmt(best.m)}`);
