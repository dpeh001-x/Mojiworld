#!/usr/bin/env node
// Make "same size, same place, nothing cut off" arithmetic instead of a hope.
//
// The ludo animate stage holds the character far better than the old per-frame generation did, but
// "hold still" is a request, not a guarantee, and the old set proved what a few percent of drift
// per frame looks like at boss size. This stage measures all 36 chosen frames and lays them out on
// ONE canvas with ONE scale and ONE offset:
//
//   * ONE SCALE for every frame of every state. Not per-frame: a per-frame fit would iron out the
//     animation itself - the walk's body rock and the stomp's rear-up ARE size changes in the
//     content box, and normalising them away would give back the stiff, sliding sprite this is
//     replacing. What must not change between frames is the CHARACTER's scale, and one global
//     factor preserves exactly that.
//   * ONE OFFSET for every frame, from the union box of all 36. Each frame keeps its own position
//     relative to the others (the rock, the lean, the rear-up all survive); the SET as a whole is
//     centred.
//   * A MARGIN the union box cannot cross, so no frame of any state can be clipped - which every
//     one of the four shipped sets was, against the bottom edge.
//   * The SAME canvas for all four states, so _drawBossSprite's sizeFactor (clamp(0.7..1.6,
//     sourceLongEdge/1024)) is identical in every state. The old sets were 1800/990/940 px, i.e.
//     1.6 / 0.967 / 0.918 - the boss changed size when he changed state, and anim_calib was
//     hand-compensating per state to hide it.
//
//   node scripts/gen_krook_normalise.mjs                 # measure and report, write nothing
//   node scripts/gen_krook_normalise.mjs --write         # write into Sprites/bosses/...
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEEP = join(ROOT, 'scripts', '_tmp_krook_anim');
const argv = process.argv.slice(2), has = (f) => argv.includes(f);

const CANVAS = 960;      // native output of the animate stage - no upscale, no resample softening
const MARGIN = 0.045;    // of the canvas, on every side: the union box may not enter it
const N = 9;

// the chosen rolls, and where each set ships
const SETS = [
  { set: 'idle',   roll: 3, dir: 'Sprites/bosses/idle',   base: 'kingKrook' },
  { set: 'walk',   roll: 1, dir: 'Sprites/bosses/walk',   base: 'kingKrook' },
  { set: 'attack', roll: 1, dir: 'Sprites/bosses/attack', base: 'kingKrook' },
  { set: 'stomp',  roll: 3, dir: 'Sprites/bosses/attack', base: 'kingKrookstomp' },
];

async function boxOf(p) {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ch = info.channels;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * ch + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { W, H, x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

const frames = [];
for (const s of SETS) {
  for (let i = 0; i < N; i++) {
    const p = join(KEEP, `${s.set}_roll${s.roll}_${i}.png`);
    if (!existsSync(p)) { console.error('missing ' + p); process.exit(1); }
    frames.push({ ...s, i, p, box: await boxOf(p) });
  }
}
const bad = frames.filter((f) => !f.box);
if (bad.length) { console.error('empty frames: ' + bad.map((f) => f.set + f.i).join(' ')); process.exit(1); }

// the union box across ALL 36 frames, in source pixels
const U = frames.reduce((a, f) => ({
  x0: Math.min(a.x0, f.box.x0), y0: Math.min(a.y0, f.box.y0),
  x1: Math.max(a.x1, f.box.x1), y1: Math.max(a.y1, f.box.y1),
}), { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 });
const uw = U.x1 - U.x0 + 1, uh = U.y1 - U.y0 + 1;

// one scale: the union box fits the canvas minus the margin, on whichever axis binds
const avail = CANVAS * (1 - 2 * MARGIN);
const SCALE = Math.min(avail / uw, avail / uh);
// one offset: the scaled union box is centred horizontally and sits on the margin line vertically
// (bottom-aligned, because the feet are what the draw path anchors to)
const offX = (CANVAS - uw * SCALE) / 2 - U.x0 * SCALE;
const offY = CANVAS * (1 - MARGIN) - U.y1 * SCALE;

console.log(`36 frames, source ${frames[0].box.W}x${frames[0].box.H}`);
console.log(`union box  ${uw} x ${uh}  at (${U.x0},${U.y0})`);
console.log(`one scale  ${SCALE.toFixed(4)}   offset (${offX.toFixed(1)}, ${offY.toFixed(1)})   canvas ${CANVAS}  margin ${(MARGIN * 100).toFixed(1)}%`);

// per-set spread, before and after (after = before x SCALE; the point is that ONE scale is used)
for (const s of SETS) {
  const fs2 = frames.filter((f) => f.set === s.set);
  const w = fs2.map((f) => f.box.w), h = fs2.map((f) => f.box.h), b = fs2.map((f) => f.box.y1);
  const sp = (a) => Math.max(...a) - Math.min(...a);
  console.log(`  ${s.set.padEnd(7)} roll ${s.roll}  width spread ${String(sp(w)).padStart(3)}px (${(sp(w) / Math.max(...w) * 100).toFixed(1)}%)` +
    `  height spread ${String(sp(h)).padStart(3)}px (${(sp(h) / Math.max(...h) * 100).toFixed(1)}%)  box-bottom spread ${sp(b)}px`);
}

if (!has('--write')) { console.log('\n--write to install'); process.exit(0); }

for (const s of SETS) await mkdir(join(ROOT, s.dir), { recursive: true });
for (const f of frames) {
  const w = Math.max(1, Math.round(f.box.W * SCALE)), h = Math.max(1, Math.round(f.box.H * SCALE));
  const scaled = await sharp(f.p).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
  const left = Math.round(offX), top = Math.round(offY);
  const canvas = sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  const out = await canvas.composite([{ input: scaled, left, top }]).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
  await writeFile(join(ROOT, f.dir, `${f.base}_${f.i}.webp`), out);
}
// the stills the sprite tables point at: a frame of the matching set, on the SAME canvas. The
// attack still was the one file the first pass missed, and it showed immediately - it stayed 940x731
// while everything else became 960x960, so the boss changed size the moment he swung.
await writeFile(join(ROOT, 'Sprites', 'bosses', 'kingKrook.webp'),
  await sharp(join(ROOT, 'Sprites', 'bosses', 'idle', 'kingKrook_0.webp')).webp({ quality: 92, alphaQuality: 100 }).toBuffer());
await writeFile(join(ROOT, 'Sprites', 'bosses', 'kingKrookstomp.webp'),
  await sharp(join(ROOT, 'Sprites', 'bosses', 'attack', 'kingKrookstomp_0.webp')).webp({ quality: 92, alphaQuality: 100 }).toBuffer());
// the attack STILL is mid-swing (frame 4), not frame 0 - frame 0 is the standing pose, and a static
// attack that looks like standing is why a paused swing used to read as a hitch.
await writeFile(join(ROOT, 'Sprites', 'bosses', 'attack', 'kingKrook.webp'),
  await sharp(join(ROOT, 'Sprites', 'bosses', 'attack', 'kingKrook_4.webp')).webp({ quality: 92, alphaQuality: 100 }).toBuffer());
console.log('\nwrote 36 frames + 2 stills at ' + CANVAS + 'x' + CANVAS);
