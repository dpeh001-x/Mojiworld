#!/usr/bin/env node
// THE MAP PIN (emoji 1f4cd) — Guguma's own head on a needle.
// ============================================================================
// Per user, twice. First: "regenerate the sprite for this pin, it needs to look more 2D and vertical
// and make sure it has guguma's face imprinted on it" — which produced a ludo.ai disc pin with his
// face stamped into it (v0.30.666). Then: "make the guguma pin cuter and the outlines have to be
// better, the whole head shape should be guguma's shape" — so the disc is gone. The pin head IS his
// head now, silhouette and all, and nothing about him is generated: every pixel of the head comes
// from Sprites/npc/Guguma.webp. Only the needle and the outline are drawn here.
//
// HOW IT IS BUILT (all of it at 1024, downsampled once at the end — that is what keeps the edge clean)
//   1. crop his head (his head is widest at x 233-727 in his sprite; a narrower crop slices his
//      cheeks flat) and round the cut off with an ellipse, so it reads as a pin head and not a block;
//   2. draw the needle under it, centred on where his silhouette actually ends;
//   3. ONE outline for head + needle together: dilate the union's alpha (blur + threshold) and fill
//      it dark underneath. NOTE sharp's 'dest-in' masks by the input's ALPHA, and a thresholded
//      channel is opaque everywhere, so the grown mask is turned into alpha by hand — otherwise the
//      outline fills its bounding box (that bug ate an afternoon);
//   4. rosy cheeks, clipped to his own silhouette;
//   5. trim, fit at 86% into 128x128 (the pipeline every other icon uses), then a light sharpen
//      because the downsample softens the outline.
//
//   node scripts/gen_guguma_pin.mjs --build [--out=<png>] [--ol=80] [--headf=0.76] [--nw=0.25] [--gold]
//   node scripts/gen_guguma_pin.mjs --install [--from=<png>]    # -> Sprites/ui/emoji/1f4cd.webp
// then repack the atlas:  node scripts/pack_emoji_atlas.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REVIEW = path.join(ROOT, 'scripts', '_tmp_pin_review');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const has = (f) => process.argv.includes('--' + f);
const S = 1024;
const HEAD_BOX = { left: Number(arg('bx', 199)), top: Number(arg('by', 183)), width: Number(arg('bw', 560)), height: Number(arg('bh', 540)) };   // how much of him the pin shows: his head is widest at x 233-727, his belly patch starts around y 648
const OVAL = { rx: Number(arg('ovrx', 0.4143)), ry: Number(arg('ovry', 0.4296)), cy: Number(arg('ovcy', 0.530)) };   // ball-bottom: 232 px both ways, a CIRCLE centred on his belly   // the ellipse he is cut to: rounded, so it reads as a pin head

// His two eyes: the dark blobs that do NOT touch the silhouette's edge (the edge-touching dark run is
// his outline). Returns their centres in head-layer pixels, left first.
function findEyes(data, info) {
  const W = info.width, H = info.height, n = W * H;
  const dark = new Uint8Array(n);
  for (let i = 0; i < n; i++) { const p = i * 4; dark[i] = (data[p + 3] > 200 && data[p] + data[p + 1] + data[p + 2] < 210) ? 1 : 0; }
  const seen = new Uint8Array(n), out = [];
  const stack = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    if (!dark[i] || seen[i]) continue;
    let top = 0, count = 0, sx = 0, sy = 0, touches = false;
    stack[top++] = i; seen[i] = 1;
    while (top) {
      const p = stack[--top], x = p % W, y = (p - x) / W;
      count++; sx += x; sy += y;
      if (x <= 1 || y <= 1 || x >= W - 2 || y >= H - 2) touches = true;
      if (data[(p * 4) + 3] < 250) touches = true;            // sitting on the silhouette edge
      for (const q of [p - 1, p + 1, p - W, p + W]) {
        if (q < 0 || q >= n || seen[q] || !dark[q]) continue;
        const qx = q % W; if (Math.abs(qx - x) > 1) continue;  // no wrapping across rows
        seen[q] = 1; stack[top++] = q;
      }
    }
    if (!touches && count > n * 0.0008) out.push({ x: sx / count, y: sy / count, n: count });
  }
  out.sort((a, b) => b.n - a.n);
  return out.slice(0, 2).sort((a, b) => a.x - b.x);
}

// His own outline is hand-drawn and uneven - thick on his back, thin under his beak, and gone
// altogether wherever the ellipse cuts him. Adding a stroke on top of that gives an edge whose width
// changes all the way round (per user: "the outline around all aspects of guguma shoukd be
// consistent"). So his outline is REMOVED first and one even stroke is drawn around what is left.
//
// What counts as his outline: dark pixels CONNECTED TO THE SILHOUETTE EDGE. His eyes and the line on
// his beak are dark too, but they are islands inside him, so they stay.
function stripOwnOutline(data, W, H) {
  const n = W * H, dark = new Uint8Array(n), opaque = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    opaque[i] = data[p + 3] > 150 ? 1 : 0;
    dark[i] = (opaque[i] && data[p] + data[p + 1] + data[p + 2] < 260) ? 1 : 0;
  }
  const seen = new Uint8Array(n), stack = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    if (!dark[i] || seen[i]) continue;
    let top = 0, touches = false; const px = [];
    stack[top++] = i; seen[i] = 1;
    while (top) {
      const p = stack[--top], x = p % W, y = (p - x) / W;
      px.push(p);
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) touches = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (!opaque[q]) { touches = true; continue; }
        if (dark[q] && !seen[q]) { seen[q] = 1; stack[top++] = q; }
      }
    }
    if (touches) for (const p of px) data[p * 4 + 3] = 0;
  }
  // the antialiased fringe his outline leaves behind
  for (let pass = 0; pass < 3; pass++) {
    const kill = [];
    for (let i = 0; i < n; i++) {
      const p = i * 4;
      if (data[p + 3] < 60 || data[p] + data[p + 1] + data[p + 2] > 420) continue;
      const x = i % W, y = (i - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || data[(ny * W + nx) * 4 + 3] < 60) { kill.push(p); break; }
      }
    }
    for (const p of kill) data[p + 3] = 0;
  }
  return data;
}
// open (erode then dilate): drops the wing tip that pokes through the ellipse as a nub, and any
// stray speck, without moving the silhouette itself.
async function smoothAlpha(png, r) {
  const eroded = await sharp(png).extractChannel('alpha').blur(r).raw().toBuffer({ resolveWithObject: true });
  const W = eroded.info.width, H = eroded.info.height, ch = eroded.info.channels, n = W * H;
  const m1 = Buffer.alloc(n);
  for (let i = 0; i < n; i++) m1[i] = eroded.data[i * ch] > 205 ? 255 : 0;
  const back = await sharp(m1, { raw: { width: W, height: H, channels: 1 } }).blur(r).raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(n * 4);
  const src = await sharp(png).ensureAlpha().raw().toBuffer();
  for (let i = 0; i < n; i++) {
    const keep = back.data[i * back.info.channels] > 50 ? 1 : 0;
    rgba[i * 4] = src[i * 4]; rgba[i * 4 + 1] = src[i * 4 + 1]; rgba[i * 4 + 2] = src[i * 4 + 2];
    rgba[i * 4 + 3] = keep ? src[i * 4 + 3] : 0;
  }
  return sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}

async function buildPin({ ol = 80, headf = 0.76, nw = 0.25, gold = false, cheeks = true, sharpen = true } = {}) {
  // 1. his head, rounded off
  const src = path.join(ROOT, 'Sprites/npc/Guguma.webp');
  const cut0 = await sharp(src).extract(HEAD_BOX).png().toBuffer();
  const m0 = await sharp(cut0).metadata();
  // ball-bottom - per user: "more spherical from the mid and bottom section". The cut is a circle,
  // but it only rules BELOW its own centre: the rect unions everything above it, so his head, his
  // tuft and his crown stay his own shape while the mid and the underside become one round arc.
  // (A plain ellipse cannot do both - closing the bottom arc inside the crop closes the top too and
  // shears the tuft off. Measured: 8.1% rms deviation from a circle before, 1.2% after.)
  const ellCy = m0.height * OVAL.cy;
  const ell = Buffer.from(`<svg width="${m0.width}" height="${m0.height}" xmlns="http://www.w3.org/2000/svg">`
    + `<ellipse cx="${m0.width / 2}" cy="${ellCy}" rx="${m0.width * OVAL.rx}" ry="${m0.height * OVAL.ry}" fill="#fff"/>`
    + (has('legacytop') ? '' : `<rect x="0" y="0" width="${m0.width}" height="${ellCy}" fill="#fff"/>`)
    + '</svg>');
  const cut = await sharp(cut0).composite([{ input: ell, blend: 'dest-in' }]).png().toBuffer();
  const { data: cd, info: ci } = await sharp(cut).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bareBuf = await sharp(stripOwnOutline(cd, ci.width, ci.height), { raw: { width: ci.width, height: ci.height, channels: 4 } }).png().toBuffer();
  const bare = await smoothAlpha(bareBuf, Math.max(3, Math.round(ci.width * (Number(arg('open', 0.028))))));
  const trimmed = await sharp(bare).trim({ threshold: 10 }).png().toBuffer();
  const tm = await sharp(trimmed).metadata();
  const headH = Math.round(S * headf), headW = Math.round(tm.width * (headH / tm.height));
  const head = await sharp(trimmed).resize(headW, headH).png().toBuffer();
  const headX = Math.round((S - headW) / 2), headY = Math.round(S * 0.03);

  // 2. the needle, centred on the bottom of his silhouette
  const { data: hd, info: hi } = await sharp(head).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let bottomY = 0, bMin = hi.width, bMax = -1;
  for (let y = hi.height - 1; y >= 0 && bMax < 0; y--) {
    for (let x = 0; x < hi.width; x++) if (hd[(y * hi.width + x) * 4 + 3] > 60) { if (x < bMin) bMin = x; if (x > bMax) bMax = x; }
    if (bMax >= 0) bottomY = y;
  }
  const ncx = headX + (bMin + bMax) / 2, nTop = headY + bottomY - Math.round(headH * 0.05);
  const nW = Math.round(headW * nw), nBot = Math.round(S * 0.985);
  const stops = gold
    ? '<stop offset="0" stop-color="#a5670f"/><stop offset="0.35" stop-color="#ffd98a"/><stop offset="0.7" stop-color="#e8a63a"/><stop offset="1" stop-color="#9a5f0d"/>'
    : '<stop offset="0" stop-color="#6f7787"/><stop offset="0.35" stop-color="#f2f5fa"/><stop offset="0.7" stop-color="#a8b1c0"/><stop offset="1" stop-color="#666d7c"/>';
  const needle = (fill) => Buffer.from(`<svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="n" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient></defs>
    <path d="M ${ncx - nW / 2} ${nTop} L ${ncx + nW / 2} ${nTop} L ${ncx + nW * 0.09} ${nBot - 8} Q ${ncx} ${nBot} ${ncx - nW * 0.09} ${nBot - 8} Z" fill="${fill}"/></svg>`);

  // 3. one outline around head + needle
  const union = await sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: needle('#000') }, { input: head, left: headX, top: headY }]).png().toBuffer();
  // sharp's threshold() did NOT come back binary here (70k in-between values), and a soft mask reads as a
  // blurry halo instead of a line - so the blurred alpha is binarised by hand: that is what makes the edge crisp.
  const grown = await sharp(await sharp(union).extractChannel('alpha').png().toBuffer()).blur(ol * 0.5).raw().toBuffer({ resolveWithObject: true });
  const olRaw = Buffer.alloc(S * S * 4);
  for (let i = 0; i < S * S; i++) { olRaw[i * 4] = 20; olRaw[i * 4 + 1] = 13; olRaw[i * 4 + 2] = 6; olRaw[i * 4 + 3] = grown.data[i * grown.info.channels] > 26 ? 255 : 0; }
  const outline = await sharp(olRaw, { raw: { width: S, height: S, channels: 4 } }).png().toBuffer();

  // 4. cheeks, clipped to him
  let headLayer = await sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: head, left: headX, top: headY }]).png().toBuffer();
  if (cheeks) {
    // his face sits right of centre, so fixed fractions put a cheek on his beak: find his eyes instead.
    const eyes = findEyes(hd, hi);
    const r = Math.round(headW * 0.085);
    // outward and below each eye, but clamped well inside his silhouette - a cheek that runs off the
    // edge gets clipped flat and reads as a brown smudge.
    const clampX = (x) => Math.max(headX + headW * 0.14, Math.min(headX + headW * 0.86, x));
    const spots = eyes.length === 2
      ? [[clampX(headX + eyes[0].x - headW * 0.10), headY + eyes[0].y + headH * 0.10], [clampX(headX + eyes[1].x + headW * 0.08), headY + eyes[1].y + headH * 0.10]]
      : [[headX + headW * 0.24, headY + headH * 0.64], [headX + headW * 0.82, headY + headH * 0.64]];
    const blush = Buffer.from(`<svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg">`
      + spots.map(([cx, cy]) => `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.70}" fill="#ff8fa0" opacity="0.60"/>`).join('') + '</svg>');
    const clipped = await sharp(blush).composite([{ input: headLayer, blend: 'dest-in' }]).png().toBuffer();
    headLayer = await sharp(headLayer).composite([{ input: clipped }]).png().toBuffer();
  }

  // 5. the icon pipeline
  const full = await sharp(outline).composite([{ input: needle('url(#n)') }, { input: headLayer }]).png().toBuffer();
  const t = await sharp(full).trim({ threshold: 8 }).png().toBuffer();
  const inner = Math.round(128 * 0.86);
  let fitted = await sharp(t).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  if (sharpen) fitted = await sharp(fitted).sharpen({ sigma: 0.7, m1: 0.6, m2: 2.2 }).png().toBuffer();
  return sharp({ create: { width: 128, height: 128, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, gravity: 'center' }]).png().toBuffer();
}

if (has('build') || (!has('install') && !has('build'))) {
  fs.mkdirSync(REVIEW, { recursive: true });
  const out = arg('out', path.join(REVIEW, 'pin.png'));
  fs.writeFileSync(out, await buildPin({ ol: Number(arg('ol', 80)), headf: Number(arg('headf', 0.76)), nw: Number(arg('nw', 0.25)), gold: has('gold') }));
  console.log('built', path.relative(ROOT, out));
}
if (has('install')) {
  const from = arg('from', path.join(REVIEW, 'pin.png'));
  const png = fs.existsSync(from) ? fs.readFileSync(from) : await buildPin();
  const dst = path.join(ROOT, 'Sprites/ui/emoji/1f4cd.webp');
  await sharp(png).webp({ quality: 90, alphaQuality: 100 }).toFile(dst + '.tmp');   // same encode as gen_emoji_icons.mjs
  fs.renameSync(dst + '.tmp', dst);
  const rawDir = path.join(ROOT, 'Sprites/ui/emoji/raw');   // kept out of git; refreshed only when present
  if (fs.existsSync(rawDir)) fs.writeFileSync(path.join(rawDir, '1f4cd.png'), png);
  console.log('installed Sprites/ui/emoji/1f4cd.webp — now run: node scripts/pack_emoji_atlas.mjs');
}
