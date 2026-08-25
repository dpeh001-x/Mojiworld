#!/usr/bin/env node
// Every monster: does it change SIZE when it attacks?
// ============================================================================
// Per user, after v0.30.221 fixed forgewight and the smith golem doubling:
// "ensure this does not happen to other monsters as well".
//
// The renderer blits a whole animation frame into a draw box whose height comes
// from the STATIC base sprite, then multiplies it by _ATK_FRAME_SCALE[type] on
// attack frames only. So the character's on-screen height is
//
//     (character height / canvas height) x targetH x (attack ? scale : 1)
//
// which means the attack art draws at the same size as the idle art if and only
// if
//
//     (attackBody / attackCanvas) x scale  ==  (idleBody / idleCanvas)
//
// Seven types author PADDED attack frames - the character sits smaller inside a
// bigger canvas so the weapon arc is not clipped - and carry a scale to undo it.
// Every other type is assumed to need scale 1.
//
// Two ways that assumption breaks, and this audit finds both:
//
//   * PADDED BUT UNREGISTERED. A type whose attack art was authored or
//     regenerated with padding, with no entry added. Its multiplier is 1, so it
//     SHRINKS the moment it swings. This is the mirror of the bug that was just
//     fixed and is exactly as invisible.
//   * REGISTERED WITH A STALE CONSTANT. The entry exists but the art moved
//     under it, so the correction over- or under-shoots.
//   * THE SET DISAGREES WITH ITSELF. Added after the first version of this
//     audit missed exactly that: it compared each attack set's MEDIAN frame
//     against idle, which is blind to a set whose own frames differ. The user
//     spotted two by eye that the median test had waved through - smithgolem
//     swings between 256 and 328 px of character height (1.28x) and
//     deranged_kuro between 547 and 671 (1.23x). A constant multiplier cannot
//     correct a set that is not constant, so the mob grows and shrinks inside
//     its own swing. SWING below is that number, and it is the one that
//     matches what a player actually notices.
//
// The ratio printed below is what the player sees: attack-state character
// height divided by idle-state character height. 1.00 is correct. 0.5 means the
// mob halves when it attacks; 2.0 means it doubles.
//
//   node scripts/mob_attack_padding_audit.mjs            # offenders only
//   node scripts/mob_attack_padding_audit.mjs --all      # every type
// ============================================================================
import sharp from 'sharp';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOB = join(root, 'Sprites', 'monsters');
const ALPHA = 12;
const argv = process.argv.slice(2);
const SHOW_ALL = argv.includes('--all');
const buildPath = argv.find((a) => a.endsWith('.html')) || join(root, 'mojiworld_game.html');

// Tolerance. Idle-vs-walk art on the same mob measures within a few percent, so
// anything beyond 12% is a real, visible size change rather than authoring noise.
const TOL = 0.12;

const src = readFileSync(buildPath, 'utf8');
const scaleBlock = (src.match(/const _ATK_FRAME_SCALE = Object\.assign\(Object\.create\(null\), \{([\s\S]*?)\n\}\);/) || [])[1] || '';
const SCALES = Object.create(null);
for (const m of scaleBlock.matchAll(/^\s*(\w+):\s*([\d.]+)/gm)) SCALES[m[1]] = Number(m[2]);
if (!Object.keys(SCALES).length) { console.error('could not read _ATK_FRAME_SCALE from ' + buildPath); process.exit(1); }

// TWO measures, because neither can be trusted alone.
//
//   HEIGHT is what the renderer's box maths is expressed in - but a mob that
//   rears, lunges or raises a weapon is genuinely taller while attacking, and
//   height alone cannot tell a bigger monster from a taller pose. That exact
//   confusion has already produced two wrong diagnoses in this codebase.
//
//   AREA scales as s^2 and barely moves when a limb does, so sqrt(area) is a
//   pose-robust linear scale.
//
// A type is only reported when BOTH agree, which is what keeps a rearing snail
// out of a list of rendering bugs.
async function charH(p) {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let y0 = h, y1 = -1, area = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * c;
    if (data[i + 3] <= ALPHA) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx && (mx - mn) / mx > 0.40 && r >= g && r > 100) continue;
    area++;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return y1 < 0 ? null : { h: y1 - y0 + 1, canvas: info.height, area };
}

// The MEDIAN frame of a state, so one outlier frame cannot speak for the set.
async function stateFrac(type, state) {
  const byH = [], byA = [];
  for (let i = 0; i < 9; i++) {
    const p = join(MOB, state, `${type}_${i}.webp`);
    if (!existsSync(p)) continue;
    const r = await charH(p);
    if (!r) continue;
    byH.push(r.h / r.canvas);
    byA.push(Math.sqrt(r.area) / r.canvas);
  }
  if (!byH.length) return null;
  const med = (a) => { const q = a.slice().sort((x, y) => x - y); return q[q.length >> 1]; };
  return { med: med(byH), medA: med(byA), n: byH.length,
    // WITHIN-SET swing: biggest frame over smallest, on both measures.
    swingH: Math.max(...byH) / Math.min(...byH),
    swingA: Math.max(...byA) / Math.min(...byA) };
}

const files = await readdir(join(MOB, 'attack'));
const types = [...new Set(files.filter((f) => /_[0-8]\.webp$/.test(f)).map((f) => f.replace(/_[0-8]\.webp$/, '')))].sort();

const rows = [];
for (const t of types) {
  const atk = await stateFrac(t, 'attack');
  const idle = await stateFrac(t, 'idle');
  if (!atk || !idle) continue;
  const scale = SCALES[t] || 1;
  const drawn = (atk.med * scale) / idle.med;           // by HEIGHT
  const drawnA = (atk.medA * scale) / idle.medA;        // by AREA (pose-robust)
  const needed = idle.med / atk.med;
  rows.push({ t, drawn, drawnA, scale, needed,
    swingH: atk.swingH, swingA: atk.swingA, registered: t in SCALES });
}

// OFFSET: the whole attack set sits at the wrong size against idle.
const bad = rows.filter((r) => Math.abs(r.drawn - 1) > TOL && Math.abs(r.drawnA - 1) > TOL)
  .sort((a, b) => Math.abs(b.drawnA - 1) - Math.abs(a.drawnA - 1));
// SWING: the set disagrees with itself, so no constant can correct it. Both
// measures again, so a mob that merely rears mid-swing is not reported.
const SWING_TOL = 1.15;
const swingy = rows.filter((r) => r.swingH > SWING_TOL && r.swingA > SWING_TOL)
  .sort((a, b) => b.swingH - a.swingH);
const poseOnly = rows.filter((r) => Math.abs(r.drawn - 1) > TOL && Math.abs(r.drawnA - 1) <= TOL)
  .sort((a, b) => Math.abs(b.drawn - 1) - Math.abs(a.drawn - 1));
const show = SHOW_ALL ? rows.sort((a, b) => Math.abs(b.drawn - 1) - Math.abs(a.drawn - 1)) : bad;

console.log(`  ${types.length} monster types have attack frames; ${Object.keys(SCALES).length} carry a padding multiplier.\n`);
console.log('  type                 by height   by area   configured   needed   note');
for (const r of show) {
  const note = !r.registered && r.drawnA < 1 - TOL ? 'PADDED BUT UNREGISTERED - shrinks when it attacks'
    : r.registered ? 'registered, constant is off'
    : r.drawnA > 1 + TOL ? 'grows when it attacks'
    : '';
  console.log('  ' + r.t.padEnd(20)
    + (r.drawn.toFixed(2) + 'x').padStart(9)
    + (r.drawnA.toFixed(2) + 'x').padStart(10)
    + (r.scale === 1 ? '         -' : ('   ' + r.scale.toFixed(3)).padStart(13))
    + ('   ' + r.needed.toFixed(3)).padStart(9)
    + '   ' + note);
}
if (!bad.length) console.log('  (none — every monster draws within ' + (TOL * 100).toFixed(0) + '% of its idle size while attacking)');
console.log(`\n  ${bad.length} of ${rows.length} types change size by more than ${(TOL * 100).toFixed(0)}% on BOTH measures.`);
if (poseOnly.length) {
  console.log(`  ${poseOnly.length} more sit off on height but not on area — a taller POSE, not a bigger monster:`);
  console.log('    ' + poseOnly.map((r) => `${r.t} (${r.drawn.toFixed(2)}x h / ${r.drawnA.toFixed(2)}x a)`).join(', '));
}
console.log(`
  SWING — attack sets that disagree with THEMSELVES, on both measures`);
console.log('  (a constant multiplier cannot correct a set that is not constant)');
if (!swingy.length) console.log('    (none)');
for (const r of swingy) {
  console.log('    ' + r.t.padEnd(20) + (r.swingH.toFixed(2) + 'x h').padStart(9) + (r.swingA.toFixed(2) + 'x a').padStart(10)
    + (r.registered ? '   (registered)' : ''));
}
process.exitCode = (bad.length || swingy.length) ? 1 : 0;

