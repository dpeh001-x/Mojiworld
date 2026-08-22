#!/usr/bin/env node
// Compute per-frame HOLD WEIGHTS for the boss walk cycles.
//
// WHY THIS EXISTS. King Krook's walk was reported as jerky. It was not broken —
// nine unique frames, no ping-pong, clean loop — the frames are just spaced
// unevenly: 351 450 233 835 352 76 581 577 125 pixels of change per step. Played
// at a constant frame time, apparent speed swings with that spacing, which is
// the lurch-then-pause the eye picks up.
//
// EIGHT ludo.ai rolls (four at 9 frames, four at 16) all came back no smoother
// than the art they would have replaced — the model does not produce evenly
// spaced strides on request. So the fix is timing, not art: hold each frame for
// a duration PROPORTIONAL to the distance it covers, and apparent velocity goes
// constant. Cycle length is preserved exactly, so nothing changes pace.
//
// It is not blending. An earlier crossfade attempt was rejected by the user
// ("overlapping sprites ... like a shadow style, I do not like that") — this
// draws one sprite per frame exactly as before and only changes how long each
// is shown.
//
//   node scripts/gen_boss_walk_timing.mjs           # print the table + gains
//   node scripts/gen_boss_walk_timing.mjs --check   # exit 1 if the game drifted
//   node scripts/gen_boss_walk_timing.mjs --check build.html   # check a candidate
import sharp from 'sharp';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
sharp.cache(false);

const ROOT = 'C:/Users/dpeh0/Mojiworld';
const DIR = join(ROOT, 'Sprites', 'bosses', 'walk');
const CHECK = process.argv.includes('--check');
// Only re-time sets that actually swing. A cycle already near-constant gains
// nothing and would only pick up rounding noise.
const NEEDS = 0.35;
// Clamp so no frame becomes a blink or a stall no matter how lopsided the art.
const MIN_W = 0.45, MAX_W = 2.2;

const cv = (a) => {
  const m = a.reduce((x, y) => x + y, 0) / a.length;
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) / m;
};

const keys = [...new Set(readdirSync(DIR).map((f) => (f.match(/^(.*)_\d+\.webp$/) || [])[1]).filter(Boolean))].sort();
const table = {};
const gains = [];
for (const k of keys) {
  const files = [];
  for (let i = 0; ; i++) { const p = join(DIR, `${k}_${i}.webp`); if (!existsSync(p)) break; files.push(p); }
  if (files.length < 4) continue;
  const raw = [];
  for (const p of files) raw.push(await sharp(readFileSync(p)).resize(96, 96, { fit: 'fill' }).ensureAlpha().raw().toBuffer());
  const step = [];
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i], b = raw[(i + 1) % raw.length];
    let s = 0;
    for (let q = 0; q < a.length; q += 4) s += Math.abs(a[q] - b[q]) + Math.abs(a[q + 3] - b[q + 3]);
    step.push(s / 1000);
  }
  const before = cv(step);
  if (before <= NEEDS) continue;
  const mean = step.reduce((a, b) => a + b, 0) / step.length;
  const w = step.map((x) => Math.max(MIN_W, Math.min(MAX_W, x / mean)));
  const sum = w.reduce((a, b) => a + b, 0);
  // Renormalise to sum === frame count, so the cycle takes exactly as long as
  // it does today at the same ms-per-frame.
  const norm = w.map((x) => +(x * step.length / sum).toFixed(3));
  const after = cv(step.map((s, i) => s / norm[i]));
  table[k] = norm;
  gains.push([k, files.length, +before.toFixed(2), +after.toFixed(2)]);
}

const literal = 'const _BOSS_WALK_WEIGHTS = ' + JSON.stringify(table) + ';';

if (CHECK) {
  const target = process.argv.find((a, i) => i > 1 && a !== '--check') || 'mojiworld_game.html';
  const game = readFileSync(join(ROOT, target), 'utf8');
  const m = game.match(/const _BOSS_WALK_WEIGHTS = (\{.*?\});/s);
  if (!m) { console.error('no _BOSS_WALK_WEIGHTS in mojiworld_game.html'); process.exit(1); }
  if (m[1] !== JSON.stringify(table)) {
    console.error('STALE: the shipped walk-timing table no longer matches the art.');
    console.error('Re-run without --check and update the constant.');
    process.exit(1);
  }
  console.log(`walk timing is current (${Object.keys(table).length} sets)`);
  process.exit(0);
}

console.log('set                     frames   apparent-velocity cv');
for (const [k, n, b, a] of gains) console.log(`  ${k.padEnd(22)} ${String(n).padStart(2)}f     ${b.toFixed(2)} -> ${a.toFixed(2)}`);
console.log(`\n${gains.length} sets re-timed. Constant for mojiworld_game.html:\n`);
console.log(literal);
