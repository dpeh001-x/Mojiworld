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
// WHY THE STRIDE GATE (added after a regression). The model's premise is that a
// frame-to-frame delta IS distance travelled. That only holds for a set whose
// figure actually walks. The first version re-timed all 15 sets on delta size
// alone and made Gravitos worse — his feet never leave the ground (6.5px and
// 4.3px of travel over a whole cycle, against 13.7/22.2 for King Krook), so his
// big deltas are not travel, they are jump cuts between a wide stance and a
// closed one. Weighting by them held two poses for ~160ms each and hard-cut
// between them, which read as a shuffle backwards. Where no stride is
// measurable the deltas mean something else, so the set is left on uniform
// timing rather than re-timed on a premise that does not apply to it.
//
// It is not blending. An earlier crossfade attempt was rejected by the user
// ("overlapping sprites ... like a shadow style, I do not like that") — this
// draws one sprite per frame exactly as before and only changes how long each
// is shown.
//
//   node scripts/gen_boss_walk_timing.mjs                      # table + gains
//   node scripts/gen_boss_walk_timing.mjs --all                # show rejects too
//   node scripts/gen_boss_walk_timing.mjs --check              # exit 1 if drifted
//   node scripts/gen_boss_walk_timing.mjs --check build.html   # check a candidate
import sharp from 'sharp';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
sharp.cache(false);

const ROOT = 'C:/Users/dpeh0/Mojiworld';
const DIR = join(ROOT, 'Sprites', 'bosses', 'walk');
const CHECK = process.argv.includes('--check');
const ALL = process.argv.includes('--all');
// Only re-time sets that actually swing. A cycle already near-constant gains
// nothing and would only pick up rounding noise.
const NEEDS = 0.35;
// Clamp so no frame becomes a blink or a stall no matter how lopsided the art.
const MIN_W = 0.45, MAX_W = 2.2;
// A stride is required before the weighting means anything — see above.
// Calibrated against the sets that read as walks (kingKrook 22.2/14.0,
// legosaurus 17.4/13.5, towerSovereign 19.6/25.2) versus the ones that do not
// (gravitos 6.5/3.2, gravitos3 4.1/2.5, young_confused_barnaby 1.4/1.4).
const MIN_FOOT_TRAVEL = 9, MIN_GAP_SPREAD = 9, MIN_FOOT_PAIRS = 4;

const cv = (a) => {
  const m = a.reduce((x, y) => x + y, 0) / a.length;
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) / m;
};
const rng = (a) => (a.length ? +(Math.max(...a) - Math.min(...a)).toFixed(1) : 0);

// Does this set contain a real stride? Locate the two feet in the bottom band
// of the figure and measure how far each travels relative to the TORSO across
// the cycle. Frames where the feet merge into a single blob are EXCLUDED —
// scoring a merge as "both feet jumped to the middle" reports a set with zero
// foot travel as a stride, which is how Gravitos slipped through the first time.
async function strideOf(files) {
  const W = 160, H = 160, L = [], R = [], gaps = [];
  for (const p of files) {
    const { data } = await sharp(readFileSync(p)).resize(W, H, { fit: 'fill' })
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const A = (x, y) => data[(y * W + x) * 4 + 3];
    let minY = H, maxY = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y) > 128) {
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (maxY <= minY) continue;
    let tx = 0, tn = 0; const tb = minY + (maxY - minY) * 0.4;
    for (let y = minY; y <= tb; y++) for (let x = 0; x < W; x++) if (A(x, y) > 128) { tx += x; tn++; }
    const cx = tx / tn;
    const ft = maxY - Math.max(2, Math.round((maxY - minY) * 0.10));
    const cols = [];
    for (let x = 0; x < W; x++) { let c = 0; for (let y = ft; y <= maxY; y++) if (A(x, y) > 128) c++; cols.push(c); }
    const blobs = []; let cur = null;
    for (let x = 0; x < W; x++) {
      if (cols[x] > 0) { if (!cur) cur = { m: 0, mx: 0 }; cur.m += cols[x]; cur.mx += x * cols[x]; }
      else if (cur) { blobs.push(cur); cur = null; }
    }
    if (cur) blobs.push(cur);
    const c = blobs.filter((b) => b.m >= 8).map((b) => b.mx / b.m - cx).sort((a, b) => a - b);
    if (c.length >= 2) { L.push(c[0]); R.push(c[c.length - 1]); gaps.push(c[c.length - 1] - c[0]); }
  }
  const foot = Math.max(rng(L), rng(R)), gap = rng(gaps);
  return { pairs: L.length, foot, gap,
    stride: L.length >= MIN_FOOT_PAIRS && foot >= MIN_FOOT_TRAVEL && gap >= MIN_GAP_SPREAD };
}

const keys = [...new Set(readdirSync(DIR).map((f) => (f.match(/^(.*)_\d+\.webp$/) || [])[1]).filter(Boolean))].sort();
const table = {};
const rows = [];
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
  const sd = await strideOf(files);
  if (before <= NEEDS) { rows.push([k, files.length, +before.toFixed(2), null, 'already even']); continue; }
  if (!sd.stride) {
    rows.push([k, files.length, +before.toFixed(2), null,
      `no stride (foot ${sd.foot}, stance ${sd.gap}) — left on uniform timing`]);
    continue;
  }
  const mean = step.reduce((a, b) => a + b, 0) / step.length;
  const w = step.map((x) => Math.max(MIN_W, Math.min(MAX_W, x / mean)));
  const sum = w.reduce((a, b) => a + b, 0);
  // Renormalise to sum === frame count, so the cycle takes exactly as long as
  // it does today at the same ms-per-frame.
  const norm = w.map((x) => +(x * step.length / sum).toFixed(3));
  const after = cv(step.map((s, i) => s / norm[i]));
  table[k] = norm;
  rows.push([k, files.length, +before.toFixed(2), +after.toFixed(2), `stride (foot ${sd.foot}, stance ${sd.gap})`]);
}

const literal = 'const _BOSS_WALK_WEIGHTS = ' + JSON.stringify(table) + ';';

if (CHECK) {
  const target = process.argv.find((a, i) => i > 1 && a !== '--check' && a !== '--all') || 'mojiworld_game.html';
  const game = readFileSync(join(ROOT, target), 'utf8');
  const m = game.match(/const _BOSS_WALK_WEIGHTS = (\{.*?\});/s);
  if (!m) { console.error('no _BOSS_WALK_WEIGHTS in ' + target); process.exit(1); }
  if (m[1] !== JSON.stringify(table)) {
    console.error('STALE: the shipped walk-timing table no longer matches the art.');
    console.error('Re-run without --check and update the constant.');
    process.exit(1);
  }
  console.log(`walk timing is current (${Object.keys(table).length} sets re-timed)`);
  process.exit(0);
}

console.log('set                     frames   cv before -> after   why');
for (const [k, n, b, a, why] of rows) {
  if (!ALL && a === null) continue;
  console.log(`  ${k.padEnd(22)} ${String(n).padStart(2)}f     ` +
    `${b.toFixed(2)} -> ${a === null ? ' -  ' : a.toFixed(2)}   ${why}`);
}
console.log(`\n${Object.keys(table).length} of ${rows.length} sets re-timed` +
            `${ALL ? '' : '  (--all to list the rest)'}. Constant for mojiworld_game.html:\n`);
console.log(literal);
