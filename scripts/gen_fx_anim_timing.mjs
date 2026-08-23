#!/usr/bin/env node
// Per-frame HOLD WEIGHTS for cast-FX animations, so an unevenly authored set
// plays at a steady rate instead of sitting still and then lurching.
//
// WHY. The B-slot ultimate FX are played ONCE across the burst's life -
// Math.floor(t * n) in the spriteBurst draw branch, uniform timing, no frameGap
// on these spawns. That is fine when the frames are evenly spaced and cruel
// when they are not. Doombringer's Calamity Incarnate:
//
//     34 30 101 151 319 250 149 81 21     cv 0.77
//
// Three frames barely change, then one carries fifteen times the motion of
// another. Holding each frame in proportion to what it covers takes that to
// 0.29 with no new art. Cycle length is preserved exactly, so the cast still
// takes as long as it did.
//
// SCOPE IS DELIBERATE. This is NOT applied to every uneven set. A rising step
// profile can be the animation working as designed - shinobi_ult measures the
// same 0.77, but its steps climb 194 -> 1840 because the petal burst
// accelerates outward, and flattening that would fight the design. Only sets
// listed in KEYS are re-timed, and each one is here because its unevenness is
// a fault rather than a shape.
//
//   node scripts/gen_fx_anim_timing.mjs           # print the table + gains
//   node scripts/gen_fx_anim_timing.mjs --check   # exit 1 if the game drifted
import sharp from 'sharp';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'Sprites', 'fx', 'anim');
const CHECK = process.argv.includes('--check');

// Sets whose unevenness is a fault. See SCOPE above before adding one.
const KEYS = ['doombringer_ult'];
const MIN_W = 0.45, MAX_W = 2.2;   // no frame may become a blink or a stall

const cv = (a) => {
  const m = a.reduce((x, y) => x + y, 0) / a.length;
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) / m;
};

const table = {};
const rows = [];
for (const k of KEYS) {
  const bufs = [];
  for (let i = 0; existsSync(join(DIR, `${k}_${i}.webp`)); i++) bufs.push(readFileSync(join(DIR, `${k}_${i}.webp`)));
  if (bufs.length < 4) { console.error(`${k}: only ${bufs.length} frames`); process.exit(1); }
  const small = [];
  for (const b of bufs) small.push(await sharp(b).resize(96, 96, { fit: 'fill' }).ensureAlpha().raw().toBuffer());
  const step = [];
  for (let i = 0; i < small.length; i++) {
    const a = small[i], b = small[(i + 1) % small.length];
    let s = 0;
    for (let q = 0; q < a.length; q += 4) s += Math.abs(a[q] - b[q]) + Math.abs(a[q + 3] - b[q + 3]);
    step.push(s / 1000);
  }
  const before = cv(step);
  const mean = step.reduce((a, b) => a + b, 0) / step.length;
  const w = step.map((x) => Math.max(MIN_W, Math.min(MAX_W, x / mean)));
  const sum = w.reduce((a, b) => a + b, 0);
  // Renormalise to sum === frame count, so the cast takes exactly as long as it
  // does today. This buys smoothness and changes no skill's timing.
  const norm = w.map((x) => +(x * step.length / sum).toFixed(3));
  const after = cv(step.map((s, i) => s / norm[i]));
  table[k] = norm;
  rows.push([k, bufs.length, +before.toFixed(2), +after.toFixed(2), step.map((x) => Math.round(x)).join(' ')]);
}

const literal = 'const _FX_ANIM_WEIGHTS = ' + JSON.stringify(table) + ';';

if (CHECK) {
  // Accept an absolute candidate path so a build can be checked before it ships.
  const t = process.argv.find((a, i) => i > 1 && a !== '--check') || 'mojiworld_game.html';
  const game = readFileSync(isAbsolute(t) ? t : join(ROOT, t), 'utf8');
  const m = game.match(/const _FX_ANIM_WEIGHTS = (\{.*?\});/s);
  if (!m) { console.error('no _FX_ANIM_WEIGHTS in the build'); process.exit(1); }
  if (m[1] !== JSON.stringify(table)) {
    console.error('STALE: the shipped fx-timing table no longer matches the art.');
    console.error('Re-run without --check and update the constant.');
    process.exit(1);
  }
  console.log(`fx timing is current (${Object.keys(table).length} set${Object.keys(table).length === 1 ? '' : 's'})`);
  process.exit(0);
}

console.log('set                     frames   cv before -> after   steps');
for (const [k, n, b, a, s] of rows) console.log(`  ${k.padEnd(22)} ${String(n).padStart(2)}f     ${b.toFixed(2)} -> ${a.toFixed(2)}        ${s}`);
console.log(`\nConstant for mojiworld_game.html:\n`);
console.log(literal);
