// Test: boss walk cycles are re-timed for constant apparent velocity, and the
// re-timing is safe.
//
// The defect was never broken art — King Krook's nine frames are all unique and
// loop cleanly. They are spaced unevenly (351 450 233 835 352 76 581 577 125 px
// of change), so at a constant frame time the apparent speed lurches. Holding
// each frame in proportion to the distance it covers fixes that, and the tests
// below pin BOTH halves: the smoothing is real, and the cycle still takes
// exactly as long as it used to.
//   node scripts/boss_walk_timing_test.mjs [build.html]
import sharp from 'sharp';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
sharp.cache(false);
const ROOT = 'C:/Users/dpeh0/Mojiworld';
const DIR = join(ROOT, 'Sprites', 'bosses', 'walk');
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const game = readFileSync(join(ROOT, process.argv[2] || 'mojiworld_game.html'), 'utf8');
const m = game.match(/const _BOSS_WALK_WEIGHTS = (\{.*?\});/s);
ok('the walk-timing table ships', !!m, '');
const table = m ? JSON.parse(m[1]) : {};
ok('it covers the walk cycles that needed it', Object.keys(table).length >= 10, { sets: Object.keys(table).length });

// Weights must sum to the frame count, or the cycle speeds up / slows down.
{
  const bad = [];
  for (const [k, w] of Object.entries(table)) {
    const sum = w.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - w.length) > 0.05) bad.push({ set: k, sum: +sum.toFixed(3), frames: w.length });
  }
  ok('every cycle keeps its original duration (weights sum to the frame count)', bad.length === 0, bad.slice(0, 4));
}

// No frame may become a blink or a stall.
{
  const bad = [];
  for (const [k, w] of Object.entries(table)) {
    const lo = Math.min(...w), hi = Math.max(...w);
    if (lo < 0.4 || hi > 2.3) bad.push({ set: k, min: lo, max: hi });
  }
  ok('no frame is held too briefly or too long', bad.length === 0, bad.slice(0, 4));
}

// The table must match the art it was computed from.
{
  const bad = [];
  for (const [k, w] of Object.entries(table)) {
    let n = 0;
    while (existsSync(join(DIR, `${k}_${n}.webp`))) n++;
    if (n !== w.length) bad.push({ set: k, weights: w.length, framesOnDisk: n });
  }
  ok('every table entry matches the frames actually on disk', bad.length === 0, bad.slice(0, 4));
}

// The smoothing is REAL: recompute apparent-velocity variance both ways.
{
  const cv = (a) => { const mn = a.reduce((x, y) => x + y, 0) / a.length;
    return Math.sqrt(a.reduce((x, y) => x + (y - mn) ** 2, 0) / a.length) / mn; };
  const rows = [];
  for (const k of ['kingKrook', 'gravitos', 'legosaurus']) {
    const w = table[k]; if (!w) continue;
    const raw = [];
    for (let i = 0; i < w.length; i++) raw.push(await sharp(readFileSync(join(DIR, `${k}_${i}.webp`)))
      .resize(96, 96, { fit: 'fill' }).ensureAlpha().raw().toBuffer());
    const step = [];
    for (let i = 0; i < raw.length; i++) {
      const a = raw[i], b = raw[(i + 1) % raw.length];
      let s = 0;
      for (let q = 0; q < a.length; q += 4) s += Math.abs(a[q] - b[q]) + Math.abs(a[q + 3] - b[q + 3]);
      step.push(s / 1000);
    }
    rows.push({ set: k, uniform: +cv(step).toFixed(2), weighted: +cv(step.map((s, i) => s / w[i])).toFixed(2) });
  }
  const worse = rows.filter((r) => r.weighted >= r.uniform);
  ok('weighted timing measurably evens out apparent velocity', rows.length >= 2 && worse.length === 0, rows);
}

// Safety: an art change that lengthens a set must fall back, not misindex.
ok('a length mismatch falls back to uniform timing',
   /_w\.length !== _fr\.length\) return _bossLoopFrame/.test(game), '');
ok('a half-decoded set still animates on the old path',
   /_n < _fr\.length\) return _bossLoopFrame/.test(game), '');
ok('one sprite per frame — this is not the rejected crossfade',
   !/globalAlpha[^;]*_bossWalkFrame/.test(game), '');

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter((q) => q.pass).length}/${results.length} checks passed`);
process.exit(results.every((q) => q.pass) ? 0 : 1);
