#!/usr/bin/env node
// Do the gravitos3 animation sets PULSE?
// ============================================================================
// Per user: "There is pulsations for gravitos3 animations".
//
// A pulse is the titan changing SIZE across frames of a loop that should hold
// it steady. The measurement is not as simple as "ink bbox per frame", and two
// specific traps have already produced wrong answers on this exact boss:
//
//   * THE EFFECT IS NOT THE MONSTER. gravitos2star was reported as swelling and
//     was not - the LIGHTNING sprawled while the dark-armoured titan held to
//     0.7%. Any measure that lets glow vote reports motion as growth.
//   * HEIGHT CANNOT SEE A FLARE. The smith golem's idle erupted in flame while
//     its body height stayed flat at 1.019x; the silhouette WIDTH read 1.234x.
//     A pulse that brightens outward is invisible to a height-only check.
//
// So each frame is measured three ways and all three are printed:
//   ink    - every opaque pixel, effects included
//   body   - DARK ARMOUR only: the titan is near-black plate, the effects are
//            bright and saturated. Dropping bright/saturated pixels leaves the
//            silhouette that actually has to hold still.
//   area   - sqrt of the body pixel count, which scales linearly with size and
//            barely moves when a limb does, so it separates pose from scale.
//
// An ATTACK set legitimately changes shape; a set that is meant to loop must
// not. The gate is therefore applied to the BODY measures only, and reported
// per set so a genuine swing is not confused with a pulse.
//
//   node scripts/gravitos3_pulse_check.mjs
//   node scripts/gravitos3_pulse_check.mjs --frames    # per-frame numbers
// ============================================================================
import sharp from 'sharp';
import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(root, 'Sprites', 'bosses', 'attack');
const ALPHA = 12;
const SHOW_FRAMES = process.argv.includes('--frames');

// The titan is dark plate. A pixel is EFFECT (not body) when it is bright, or
// strongly saturated — lightning, soul-fire and rim glow are both.
function isEffect(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const sat = mx ? (mx - mn) / mx : 0;
  return lum > 140 || sat > 0.45;
}

async function frame(p) {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let ix0 = w, ix1 = -1, iy0 = h, iy1 = -1;
  let bx0 = w, bx1 = -1, by0 = h, by1 = -1, barea = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * c;
    if (data[i + 3] <= ALPHA) continue;
    if (x < ix0) ix0 = x; if (x > ix1) ix1 = x;
    if (y < iy0) iy0 = y; if (y > iy1) iy1 = y;
    if (isEffect(data[i], data[i + 1], data[i + 2])) continue;
    barea++;
    if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
    if (y < by0) by0 = y; if (y > by1) by1 = y;
  }
  if (ix1 < 0) return null;
  return {
    canvas: `${w}x${h}`,
    inkH: iy1 - iy0 + 1, inkW: ix1 - ix0 + 1,
    bodyH: bx1 < 0 ? 0 : by1 - by0 + 1,
    bodyW: bx1 < 0 ? 0 : bx1 - bx0 + 1,
    bodyArea: barea, bodyBottom: by1,
  };
}

const files = await readdir(DIR);
const sets = [...new Set(files.filter((f) => /^gravitos3.*_[0-8]\.webp$/.test(f))
  .map((f) => f.replace(/_[0-8]\.webp$/, '')))].sort();

const spread = (a) => (Math.min(...a) > 0 ? Math.max(...a) / Math.min(...a) : Infinity);
let worst = 0;
const rows = [];
for (const set of sets) {
  const fr = [];
  for (let i = 0; i < 9; i++) {
    const p = join(DIR, `${set}_${i}.webp`);
    if (existsSync(p)) { const r = await frame(p); if (r) fr.push({ i, ...r }); }
  }
  if (fr.length < 2) continue;
  const r = {
    set, n: fr.length, canvas: fr[0].canvas,
    ink: spread(fr.map((f) => f.inkH)),
    inkW: spread(fr.map((f) => f.inkW)),
    bodyH: spread(fr.map((f) => f.bodyH)),
    bodyW: spread(fr.map((f) => f.bodyW)),
    area: spread(fr.map((f) => Math.sqrt(f.bodyArea))),
    frames: fr,
  };
  rows.push(r);
  worst = Math.max(worst, Math.max(r.bodyH, r.bodyW, r.area));
}

console.log('  set                 n   canvas        ink H    ink W   BODY H   BODY W   BODY area');
for (const r of rows) {
  const f = (x) => (x.toFixed(3) + 'x').padStart(9);
  console.log('  ' + r.set.padEnd(20) + String(r.n).padStart(2) + '   ' + r.canvas.padEnd(12)
    + f(r.ink) + f(r.inkW) + f(r.bodyH) + f(r.bodyW) + f(r.area));
}
// Body measures must agree before a set is called a pulse — a pose can move one
// of them, only a size change moves all three.
const PULSE = 1.08;
const bad = rows.filter((r) => r.bodyH > PULSE && r.bodyW > PULSE && r.area > PULSE);
console.log(`\n  a PULSE is all three BODY measures above ${PULSE}x (a pose moves one; only size moves all three)`);
if (!bad.length) console.log('  (none — every gravitos3 set holds its body size)');
for (const r of bad) console.log(`  PULSE  ${r.set}: body ${r.bodyH.toFixed(3)}x h / ${r.bodyW.toFixed(3)}x w / ${r.area.toFixed(3)}x area`);

if (SHOW_FRAMES) for (const r of rows) {
  console.log(`\n  ${r.set}`);
  console.log('    frame   inkH   inkW   bodyH   bodyW   bodyArea   bodyBottom');
  for (const f of r.frames) console.log('    ' + String(f.i).padStart(5) + String(f.inkH).padStart(7)
    + String(f.inkW).padStart(7) + String(f.bodyH).padStart(8) + String(f.bodyW).padStart(8)
    + String(f.bodyArea).padStart(11) + String(f.bodyBottom).padStart(13));
}
process.exitCode = bad.length ? 1 : 0;
