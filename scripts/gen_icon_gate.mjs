#!/usr/bin/env node
// The Mojiworld app icon's backdrop: a gate into the world, painted to measured constraints.
//
// Per user, after the first attempt shipped: "The after looks worse, this can be much better
// improved", then "it needs to be something people are intrigued to click on", then "sunburst is
// good but the pale blue bubble needs to be better thought out and redesigned".
//
// WHAT THE MEASUREMENTS SAID, because the first attempt was designed against the wrong number.
// v0.30.723 checked contrast at ONE point - Guguma's white belly against the dawn glow - got 57/255
// and called it done. Measured around his WHOLE outline instead, 55.5% of it sat within 40/255 of the
// backdrop, WORSE than the icon it replaced (42.5%). The cause is a fact about the subject that was
// never checked: his outline is a ~6px near-black keyline, mean luma 22, around a luma-157 body.
//   - a DARK backdrop erases that keyline (the old icon's 5th-percentile contrast was literally 0)
//   - a WARM backdrop is the same hue family as a yellow bird
// So the field his outline touches must be LIGHT and COOL. v0.30.723 was dark and warm: both backwards.
//
// THE GEOMETRY IS MEASURED, NOT CHOSEN. His alpha bbox is 397x415 and every one of his pixels lies
// within 215px of (256,275) - so a disc of r=236 there contains his entire outline with margin while
// still leaving deep night at the edges to give the rounded square a border. A distance transform of
// his alpha then names the four pockets inside that disc where art can live without touching him:
// (120,96) (352,72) (456,376) (104,440). Every island and the sun sit in one of those.
//
// AND A LEGIBLE ICON IS NOT YET A GOOD ONE. A pale bubble behind a mascot measured beautifully and
// said nothing about the game. So the disc is a gate: deep violet night and light petals outside it,
// a notched gold ring, and a floating-island world with a sunrise inside. The value skeleton is
// unchanged - the gate interior IS the light cool field the measurements asked for.
//
//   node scripts/gen_icon_gate.mjs            # write scripts/_tmp_icon_build/gate.png to look at
// Imported by scripts/gen_app_icon_art.mjs, which composites the committed subject over it.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

export const S = 512;
export const DCX = 256, DCY = 275, DR = 236;          // measured: contains every subject pixel + 16px

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const sm = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const mix = (D, i, C, a) => { for (let c = 0; c < 3; c++) D[i + c] += (C[c] - D[i + c]) * a; };
const q = (x, y) => Math.hypot(x - DCX, y - DCY);

function fill(D, top, bot) { const A = hex(top), B = hex(bot);
  for (let y = 0; y < S; y++) { const t = y / (S - 1); for (let x = 0; x < S; x++) { const i = (y * S + x) * 3;
    for (let c = 0; c < 3; c++) D[i + c] = A[c] + (B[c] - A[c]) * t; } } }
// light lobes breaking out of the gate into the night - the part of the first sweep the user picked
function rays(D, n, col, k, from, to) { const C = hex(col);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const r = q(x, y);
    if (r < from || r > to) continue;
    const w = 0.5 + 0.5 * Math.cos(Math.atan2(y - DCY, x - DCX) * n);
    const a = Math.pow(w, 3) * k * (1 - sm((r - from) / (to - from)));
    if (a > 0) mix(D, (y * S + x) * 3, C, a); } }
// the gate interior. Deepest at the top, palest at the bottom, where his legs and feet stand.
function discFill(D, top, bot) { const A = hex(top), B = hex(bot), F = 4.5;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const a = 1 - sm((q(x, y) - (DR - F)) / F); if (a <= 0) continue;
    const t = sm((y - (DCY - DR)) / (2 * DR)), i = (y * S + x) * 3;
    mix(D, i, [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t], a); } }
// form. Without this the disc is a fade with no edge - which is exactly what the user rejected.
function innerVignette(D, col, k, start) { const C = hex(col);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const r = q(x, y); if (r > DR) continue;
    const a = sm((r / DR - start) / (1 - start)) * k; if (a > 0) mix(D, (y * S + x) * 3, C, a); } }
function ring(D, r, w, col, k) { const C = hex(col);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const a = (1 - sm(Math.abs(q(x, y) - r) / w)) * k; if (a > 0) mix(D, (y * S + x) * 3, C, a); } }
function notches(D, n, r, len, col, k) { const C = hex(col);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const d = Math.abs(q(x, y) - r);
    if (d > len) continue;
    const t = Math.pow(Math.max(0, Math.cos(Math.atan2(y - DCY, x - DCX) * n)), 22);
    const a = t * (1 - sm(d / len)) * k; if (a > 0) mix(D, (y * S + x) * 3, C, a); } }
function outGlow(D, spread, col, k) { const C = hex(col);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const r = q(x, y); if (r < DR) continue;
    const a = (1 - sm((r - DR) / spread)) * k; if (a > 0) mix(D, (y * S + x) * 3, C, a); } }
function soft(D, cx, cy, rx, ry, col, k, f, clip) { const C = hex(col), ff = f || 0.35;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (clip && q(x, y) > DR - 2) continue;
    const d = Math.hypot((x - cx) / rx, (y - cy) / ry), a = (1 - sm((d - (1 - ff)) / ff)) * k;
    if (a > 0) mix(D, (y * S + x) * 3, C, Math.min(1, a)); } }
// a floating island that reads at 32px: a solid silhouette, canopies, and a sunlit crown along the top.
// Supersampled 2x2 - a hard-edged shape is what survives the downsample; the first pass used soft
// blobs and they turned to blue smudges.
function island(D, cx, cy, w, h, body, lit, k, trees) {
  const B = hex(body), hw = w / 2, dome = h * 0.42, keel = h * 1.25;
  const cov = (x, y) => { let n = 0;
    for (const ox of [-0.25, 0.25]) for (const oy of [-0.25, 0.25]) {
      const u = (x + ox - cx) / hw, v = y + oy - cy;
      if (v <= 0) { if (u * u + (v / dome) * (v / dome) <= 1) n++; }
      else { const t = Math.max(0, 1 - v / keel); if (Math.abs(u) <= Math.pow(t, 0.62)) n++; } }
    return n / 4; };
  for (let y = Math.max(0, Math.floor(cy - h - 6)); y < Math.min(S, Math.ceil(cy + keel + 2)); y++)
    for (let x = Math.max(0, Math.floor(cx - hw - 2)); x < Math.min(S, Math.ceil(cx + hw + 2)); x++) {
      if (q(x, y) > DR - 2) continue;
      const a = cov(x, y) * k; if (a > 0) mix(D, (y * S + x) * 3, B, a); }
  for (let t = 0; t < trees; t++) soft(D, cx + (t - (trees - 1) / 2) * (w * 0.30), cy - dome * 0.80,
    w * 0.11, h * 0.20, body, k, 0.42, true);
  soft(D, cx, cy - dome * 0.80, hw * 0.92, h * 0.115, lit, k * 0.85, 0.5, true);
}
function stars(D, n, seed, col) { let s = seed, left = n; const c = col || '#ffffff';
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let k = 0; k < n * 8 && left > 0; k++) { const x = rnd() * S, y = rnd() * S;
    if (q(x, y) < DR + 16) continue;                   // night only; nothing competes inside the gate
    soft(D, x, y, 2.2 + rnd() * 2.0, 2.2 + rnd() * 2.0, c, 0.5 + rnd() * 0.5, 0.9); left--; } }
function edge(D, k) { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const e = Math.min(Math.min(x, S - 1 - x), Math.min(y, S - 1 - y)) / S;
    const a = (1 - sm(e / 0.13)) * k; if (a <= 0) continue;
    const i = (y * S + x) * 3; for (let c = 0; c < 3; c++) D[i + c] *= (1 - a); } }

/** The gateViolet plate, as chosen by the user from three frames. Returns a 512x512 RGB Buffer. */
export function paintGate() {
  const D = new Float32Array(S * S * 3);
  fill(D, '#241552', '#0c0726');                       // the night outside the gate
  stars(D, 18, 4242, '#ffe9b0');
  rays(D, 12, '#8f7ff0', 0.34, DR - 10, 310);

  discFill(D, '#3aa0d8', '#e8f9ff');                   // the world seen through it
  soft(D, 150, 214, 210, 30, '#9fd4ef', 0.30, 0.6, true);   // a far range, for depth
  soft(D, 392, 236, 180, 26, '#9fd4ef', 0.26, 0.6, true);
  soft(D, 368, 72, 27, 27, '#fff4d2', 1.0, 0.14, true);     // a crisp sun, in the (352,72) pocket
  soft(D, 368, 72, 66, 66, '#fff4d2', 0.34, 0.75, true);
  soft(D, 368, 150, 44, 150, '#fff4d2', 0.16, 0.85, true);  // its shaft falling into the world
  island(D, 118, 106, 134, 40, '#1f4f80', '#7fd0b0', 0.72, 2);
  island(D, 452, 372, 152, 46, '#1f4f80', '#7fd0b0', 0.88, 3);
  island(D, 100, 440, 118, 36, '#1f4f80', '#7fd0b0', 0.78, 2);
  innerVignette(D, '#1a5a96', 0.50, 0.64);

  outGlow(D, 36, '#a98ff5', 0.40);                     // the gate bleeding light into the night
  notches(D, 16, DR + 5, 13, '#ffd98a', 0.85);
  ring(D, DR, 5.5, '#ffcf6b', 0.92);
  ring(D, DR - 9, 2.2, '#fff6dc', 0.40);
  edge(D, 0.30);

  const b = Buffer.alloc(S * S * 3);
  for (let i = 0; i < S * S * 3; i++) b[i] = Math.max(0, Math.min(255, Math.round(D[i])));
  return b;
}
export const gatePng = () => sharp(paintGate(), { raw: { width: S, height: S, channels: 3 } }).png().toBuffer();

if (import.meta.url === 'file://' + process.argv[1].replace(/\\/g, '/')) {
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
  const TMP = join(ROOT, 'scripts', '_tmp_icon_build');
  await mkdir(TMP, { recursive: true });
  await sharp(await gatePng()).toFile(join(TMP, 'gate.png'));
  console.log('wrote ' + join(TMP, 'gate.png'));
}
