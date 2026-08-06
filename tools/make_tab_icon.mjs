#!/usr/bin/env node
// Build a tab icon by mounting an existing creature sprite on the UI badge.
// =============================================================================
// The MojiMon tab kept coming back wrong from text-to-image (faceless heads,
// half-discs) across many rolls, while the game already contains creature art
// that is exactly the right character — petalfly. This composites the REAL
// sprite onto the same deep-violet disc the sibling tabs use, so the result is
// deterministic and the art is the art players already know.
//
// The icon renders at 18x18, so framing is done on the FACE, not the bounding
// box: petalfly's wings stick out top-left, and centring the bbox would push
// the face off-centre and shrink it. The eyes are located automatically (two
// compact dark blobs) and used as the anchor.
//
//   node tools/make_tab_icon.mjs <creature.webp> <out.webp> [--scale 0.92]
//        [--badge #4A1986] [--eyeY 0.44] [--size 768]
// Writes atomically (tmp -> verify -> rename).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync } from 'node:fs';

const [src, out, ...flags] = process.argv.slice(2);
if (!src || !out || !existsSync(src)) {
  console.error('usage: make_tab_icon.mjs <creature.webp> <out.webp> [--scale 0.92] [--eyeY 0.44]');
  process.exit(1);
}
const flag = (f, d) => { const i = flags.indexOf(f); return i >= 0 ? flags[i + 1] : d; };
const SIZE = Number(flag('--size', 768));
const SCALE = Number(flag('--scale', 0.92));      // creature width vs badge diameter
const EYEY = Number(flag('--eyeY', 0.44));        // where the eye line sits, 0=top
const BADGE = flag('--badge', '#4A1986');

// ---- load + trim the creature --------------------------------------------
const trimmed = await sharp(readFileSync(src)).trim({ threshold: 8 }).png().toBuffer();
const tm = await sharp(trimmed).metadata();

// ---- find the eyes (two compact dark blobs) so we can frame on the face ---
const { data, info } = await sharp(trimmed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, C = info.channels;
const A = (x, y) => data[(y * W + x) * C + 3];
const lum = (x, y) => { const i = (y * W + x) * C; return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; };
const dark = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
  if (A(x, y) > 120 && lum(x, y) < 95) dark[y * W + x] = 1;
const seen = new Uint8Array(W * H);
const blobs = [];
for (let i = 0; i < dark.length; i++) {
  if (!dark[i] || seen[i]) continue;
  const q = [i]; seen[i] = 1;
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1, n = 0;
  for (let h = 0; h < q.length; h++) {
    const j = q[h], jx = j % W, jy = (j / W) | 0;
    n++;
    if (jx < minX) minX = jx; if (jx > maxX) maxX = jx;
    if (jy < minY) minY = jy; if (jy > maxY) maxY = jy;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = jx + dx, ny = jy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const k = ny * W + nx;
      if (dark[k] && !seen[k]) { seen[k] = 1; q.push(k); }
    }
  }
  const bwid = maxX - minX + 1, bhei = maxY - minY + 1;
  if (n > W * H * 0.0006 && bwid < W * 0.3 && bhei < H * 0.3 && n / (bwid * bhei) > 0.35)
    blobs.push({ n, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 });
}
blobs.sort((a, b) => b.n - a.n);
let eyes = null;
for (let i = 0; i < blobs.length && !eyes; i++)
  for (let j = i + 1; j < blobs.length && !eyes; j++) {
    const a = blobs[i], b = blobs[j];
    if (Math.abs(a.cy - b.cy) < H * 0.09 && Math.abs(a.cx - b.cx) > W * 0.06 &&
        Math.min(a.n, b.n) / Math.max(a.n, b.n) > 0.4) eyes = [a, b];
  }
const faceX = eyes ? (eyes[0].cx + eyes[1].cx) / 2 : W / 2;
const faceY = eyes ? (eyes[0].cy + eyes[1].cy) / 2 : H * 0.45;
console.log(eyes
  ? `eyes found at (${eyes[0].cx.toFixed(0)},${eyes[0].cy.toFixed(0)}) & (${eyes[1].cx.toFixed(0)},${eyes[1].cy.toFixed(0)}) — framing on the face`
  : 'no eye pair detected — falling back to bbox centre');

// ---- scale + place so the FACE lands where a cute icon wants it ------------
const targetW = Math.round(SIZE * SCALE);
const k = targetW / W;
const scaled = await sharp(trimmed).resize(targetW, Math.round(H * k)).png().toBuffer();
const sm = await sharp(scaled).metadata();
const left = Math.round(SIZE / 2 - faceX * k);
const top = Math.round(SIZE * EYEY - faceY * k);

// ---- badge disc -----------------------------------------------------------
const badgeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
  <circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2 - 2}" fill="${BADGE}"/></svg>`;
const badge = await sharp(Buffer.from(badgeSvg)).png().toBuffer();

// Composite, then clip to the disc so nothing (wings!) spills outside it.
const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
  <circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2 - 2}" fill="#fff"/></svg>`;
const composed = await sharp(badge)
  .composite([{ input: scaled, left, top }])
  .png().toBuffer();
const clipped = await sharp(composed)
  .composite([{ input: Buffer.from(maskSvg), blend: 'dest-in' }])
  .webp({ quality: 95 }).toBuffer();

const tmp = out + '.tmp.webp';
writeFileSync(tmp, clipped);
try {
  const v = await sharp(readFileSync(tmp)).metadata();
  if (v.width !== SIZE || v.height !== SIZE) throw new Error(`size ${v.width}x${v.height}`);
  console.log(`  creature ${tm.width}x${tm.height} -> ${sm.width}x${sm.height} at (${left},${top}) on a ${SIZE}px ${BADGE} disc`);
} catch (e) {
  try { unlinkSync(tmp); } catch {}
  console.error('VERIFY FAILED, target untouched — ' + e.message);
  process.exit(1);
}
for (let t = 0; ; t++) {
  try { renameSync(tmp, out); break; }
  catch (e) {
    if ((e.code !== 'EBUSY' && e.code !== 'EPERM') || t > 12) throw e;
    const until = Date.now() + 200; while (Date.now() < until) { /* spin */ }
  }
}
console.log('  wrote ' + out);
