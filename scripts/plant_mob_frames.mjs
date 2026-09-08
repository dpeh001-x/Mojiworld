// PLANT A MOB'S FRAMES ON ITS FLOOR ROW.
// The game anchors every animation frame of a monster from the BASE sprite's bbox bottom, so a
// frame whose own ink bottom sits higher than its siblings' renders the creature FLOATING by the
// difference. (See scripts/mob_float_clamp_test.mjs and _BURY_MAX_PX = 6: a healthy mob has zero
// empty rows under its ink.) Found 2026-09-08: thornmaw lifted 10-132 px off the ground on four of
// nine WALK frames and pinechad 81-154 px on three, while both idle sets stayed rooted.
//
// Translation only - no rescale, no resampling. Frame-to-frame SIZE variation is deliberately left
// alone: a plant that sways or rears is legitimately taller on some frames, and normalising that
// (tried, rejected) resamples 7 of 9 frames to flatten real motion. The float is the defect; the
// size is the animation.
//
// Only ever run this on a GROUND mob. A `flies: true` monster hovers by design and the renderer
// gives it its own ground bleed.
//   node scripts/plant_mob_frames.mjs thornmaw walk            # report
//   node scripts/plant_mob_frames.mjs thornmaw walk --install  # write the frames
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
const require = createRequire(import.meta.url); const sharp = require('sharp'); sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [TYPE, STATE] = process.argv.slice(2); const INSTALL = process.argv.includes('--install');
const TOL = Number((process.argv.find((a) => a.startsWith('--tol=')) || '--tol=6').split('=')[1]);
if (!TYPE || !STATE) { console.error('usage: plant_mob_frames.mjs <type> <state> [--install] [--tol=N]'); process.exit(2); }
const raw = async (p) => { const { data, info } = await sharp(readFileSync(p)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, w: info.width, h: info.height }; };
const box = (f) => { let t = -1, b = -1, l = 1e9, r = -1; for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.d[(y * f.w + x) * 4 + 3] > 16) { if (t < 0) t = y; b = y; if (x < l) l = x; if (x > r) r = x; } return { t, b, l, r }; };
const files = []; for (let i = 0; i < 9; i++) { const p = path.join(ROOT, 'Sprites/monsters', STATE, `${TYPE}_${i}.webp`); if (existsSync(p)) files.push({ i, p }); }
if (!files.length) { console.error(`no frames at Sprites/monsters/${STATE}/${TYPE}_*.webp`); process.exit(2); }
const frames = []; for (const f of files) { const r = await raw(f.p); frames.push({ ...f, r, m: box(r) }); }
// The floor row: the deepest row the set itself reaches, cross-checked against a sibling state that
// is already rooted (idle is the honest reference - a creature at rest stands on the ground).
let floor = Math.max(...frames.map((f) => f.m.b));
for (const alt of ['idle', 'walk', 'attack']) {
  if (alt === STATE) continue;
  const p = path.join(ROOT, 'Sprites/monsters', alt, `${TYPE}_0.webp`); if (!existsSync(p)) continue;
  const ref = await raw(p); if (ref.h !== frames[0].r.h) continue;   // different canvas: not comparable
  floor = Math.max(floor, box(ref).b); break;
}
console.log(`${TYPE}.${STATE}: floor row ${floor} (canvas ${frames[0].r.w}x${frames[0].r.h}), ${frames.length} frames`);
const moved = [];
for (const f of frames) {
  const dy = floor - f.m.b;
  console.log(`   frame ${f.i}: ink ${f.m.r - f.m.l + 1}x${f.m.b - f.m.t + 1} at ${f.m.t}..${f.m.b}  ${Math.abs(dy) <= TOL ? 'on the floor' : dy > 0 ? `FLOATING ${dy}px -> planted` : `${-dy}px below the floor -> raised`}`);
  if (Math.abs(dy) <= TOL) continue;
  if (f.m.t + dy < 0) { console.log(`      SKIPPED: planting would clip ${-(f.m.t + dy)}px off the top`); continue; }
  const out = Buffer.alloc(f.r.w * f.r.h * 4);
  for (let y = 0; y < f.r.h; y++) { const Y = y + dy; if (Y < 0 || Y >= f.r.h) continue; out.set(f.r.d.subarray(y * f.r.w * 4, (y + 1) * f.r.w * 4), Y * f.r.w * 4); }
  moved.push({ ...f, out, dy });
}
console.log(moved.length ? `\n${moved.length} frame(s) to plant: ${moved.map((m) => `${m.i} (+${m.dy}px)`).join(', ')}` : '\nnothing to do - every frame is already on the floor row');
if (INSTALL && moved.length) {
  for (const m of moved) { const buf = await sharp(m.out, { raw: { width: m.r.w, height: m.r.h, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toBuffer(); writeFileSync(m.p + '.tmp', buf); renameSync(m.p + '.tmp', m.p); }
  const after = []; for (const m of moved) after.push(box(await raw(m.p)).b);
  console.log(`installed. ink bottoms now: ${after.join(', ')} (target ${floor})`);
  if (after.some((b) => b !== floor)) { console.error('a frame did not land on the floor row'); process.exitCode = 1; }
}
