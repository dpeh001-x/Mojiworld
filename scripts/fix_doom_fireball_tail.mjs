#!/usr/bin/env node
// P_DOOM_FIREBALL — stop the tail ending in a straight line.
// ============================================================================
// Per user: "The tail end of the p_doom_fireball looks abruptly cut off".
//
// It is: the art is 640 wide and its content spans 625-638 of that in every frame, so the flame
// trail runs into the canvas edge and stops dead. Frame 5 even carries a FULLY OPAQUE pixel on the
// border (edge alpha 255). The projectile is drawn rotated to its heading, so that flat edge shows
// up on whichever side of the screen the shot happens to be travelling away from.
//
// The fix is a ramp, not a repaint: alpha falls to nothing across a band at the TRAILING end (the
// core sits on the right, the trail streams left), so the flames dissolve instead of being
// guillotined. Nothing is redrawn and no colour is touched — only alpha, only at the tail.
//
//   node scripts/fix_doom_fireball_tail.mjs --preview    # compare band widths, writes a sheet
//   node scripts/fix_doom_fireball_tail.mjs --apply      # ramp the still + all nine frames
// These REPLACE art under its own names, so bump the sw.js CACHE generation with the drop.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const has = (f) => process.argv.includes('--' + f);
const REVIEW = path.join(ROOT, 'scripts', '_tmp_doom');
const SEEDS = path.join(ROOT, 'scripts', 'seeds');
const FILES = ['Sprites/projectiles/p_doom_fireball.webp']
  .concat([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `Sprites/projectiles/anim/p_doom_fireball_${i}.webp`));
const BAND = 0.30;          // fraction of the canvas width the tail dissolves across

const smooth = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };

async function ramp(buf, band) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const n = Math.max(1, Math.round(W * band));
  // column weights: 0 at the canvas edge, 1 by the end of the band
  const w = new Float32Array(W).fill(1);
  for (let x = 0; x < n; x++) w[x] = smooth(x / n);
  for (let y = 0; y < H; y++) for (let x = 0; x < n; x++) {
    const p = (y * W + x) * 4;
    if (data[p + 3]) data[p + 3] = Math.round(data[p + 3] * w[x]);
  }
  return sharp(data, { raw: { width: W, height: H, channels: 4 } });
}
// the widest opaque run touching the trailing edge — what "abruptly cut off" measures as
async function edgeBite(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let mx = 0, rows = 0;
  for (let y = 0; y < H; y++) { const a = data[(y * W) * 4 + 3]; if (a > 8) { rows++; if (a > mx) mx = a; } }
  return { maxAlpha: mx, rows };
}

if (has('preview')) {
  fs.mkdirSync(REVIEW, { recursive: true });
  const src = path.join(ROOT, FILES[0]);
  const BANDS = [0, 0.18, 0.30, 0.42];
  const CELL = 420, cells = [];
  for (const b of BANDS) {
    const buf = b === 0 ? await sharp(src).png().toBuffer() : await (await ramp(fs.readFileSync(src), b)).png().toBuffer();
    cells.push({ input: await sharp(buf).resize(CELL - 8, CELL - 8, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), left: BANDS.indexOf(b) * CELL + 4, top: 4 });
  }
  await sharp({ create: { width: CELL * BANDS.length, height: CELL + 8, channels: 4, background: { r: 20, g: 18, b: 26, alpha: 1 } } })
    .composite(cells).png().toFile(path.join(REVIEW, 'bands.png'));
  console.log('bands ' + BANDS.join(' / ') + ' -> scripts/_tmp_doom/bands.png');
}

if (has('apply')) {
  fs.mkdirSync(SEEDS, { recursive: true });
  for (const rel of FILES) {
    const f = path.join(ROOT, rel);
    if (!fs.existsSync(f)) { console.log('missing ' + rel); continue; }
    // keep the pre-ramp art once, so this is reproducible and cannot be applied twice by accident
    const seed = path.join(SEEDS, 'doom_fireball_' + path.basename(rel));
    if (!fs.existsSync(seed)) fs.copyFileSync(f, seed);
    const before = await edgeBite(seed);
    const out = await (await ramp(fs.readFileSync(seed), BAND)).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
    fs.writeFileSync(f + '.tmp', out); fs.renameSync(f + '.tmp', f);
    const after = await edgeBite(f);
    console.log(`${path.basename(rel).padEnd(26)} trailing-edge alpha ${String(before.maxAlpha).padStart(3)} -> ${after.maxAlpha}   (${before.rows} rows touching the edge -> ${after.rows})`);
  }
  console.log(`\nramped the tail over the leading ${Math.round(BAND * 100)}% of the canvas. Bump sw.js CACHE: these replace art under their own names.`);
}

if (!has('preview') && !has('apply')) console.log('p_doom_fireball tail ramp: --preview to compare band widths, --apply to write');
