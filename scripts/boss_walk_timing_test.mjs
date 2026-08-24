// Test: boss walk cycles are re-timed for constant apparent velocity, the
// re-timing is safe, and it is applied ONLY where its premise holds.
//
// The original defect was never broken art — King Krook's nine frames are all
// unique and loop cleanly. They are spaced unevenly (351 450 233 835 352 76 581
// 577 125 px of change), so at a constant frame time the apparent speed lurches.
// Holding each frame in proportion to the distance it covers fixes that.
//
// The REGRESSION this also pins: that reasoning assumes a frame-to-frame delta
// IS distance travelled, which is only true of a figure that actually walks.
// Gravitos does not — his feet never leave the ground, so his big deltas are
// jump cuts between a wide stance and a closed one. Re-timing him held two
// poses for ~160ms each and hard-cut between them, and it read as a shuffle
// backwards. A set with no measurable stride must stay on uniform timing.
//   node scripts/boss_walk_timing_test.mjs [build.html]
import sharp from 'sharp';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
sharp.cache(false);
const ROOT = 'C:/Users/dpeh0/Mojiworld';
const DIR = join(ROOT, 'Sprites', 'bosses', 'walk');
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const game = readFileSync(join(ROOT, process.argv[2] || 'mojiworld_game.html'), 'utf8');
const m = game.match(/const _BOSS_WALK_WEIGHTS = (\{.*?\});/s);
ok('the walk-timing table ships', !!m, '');
const table = m ? JSON.parse(m[1]) : {};
ok('it covers the walk cycles that needed it', Object.keys(table).length >= 5, { sets: Object.keys(table).length });

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

// Locate the two feet in the bottom band and measure their travel relative to
// the torso. Merged-foot frames are excluded: counting a merge as "both feet
// jumped to the middle" reports zero foot travel as a stride.
async function strideOf(key) {
  const W = 160, H = 160, L = [], R = [], gaps = [];
  for (let i = 0; existsSync(join(DIR, `${key}_${i}.webp`)); i++) {
    const { data } = await sharp(readFileSync(join(DIR, `${key}_${i}.webp`)))
      .resize(W, H, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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
  const rng = (a) => (a.length ? +(Math.max(...a) - Math.min(...a)).toFixed(1) : 0);
  return { pairs: L.length, foot: Math.max(rng(L), rng(R)), gap: rng(gaps) };
}

// THE REGRESSION CHECK. Fails on v0.30.92, which re-timed all 15 sets.
{
  const bad = [];
  for (const k of Object.keys(table)) {
    const s = await strideOf(k);
    if (s.pairs < 4 || s.foot < 9 || s.gap < 9) bad.push({ set: k, ...s });
  }
  ok('every re-timed set actually has a stride (feet travel, stance opens and closes)',
     bad.length === 0, bad);
}
// Gravitos specifically: the complaint was that he looked like he walked
// backwards, and the cause was that he had no walk. This pins the ART, so a
// revert to the stance-pulse set fails here rather than in play.
{
  const s = await strideOf('gravitos');
  ok('Gravitos actually walks — his feet leave the ground', s.foot >= 9 && s.gap >= 9, s);
  ok('...and is therefore re-timed', !!table.gravitos, { retimed: !!table.gravitos });
}

// The smoothing is REAL: recompute apparent-velocity variance both ways.
{
  const cv = (a) => { const mn = a.reduce((x, y) => x + y, 0) / a.length;
    return Math.sqrt(a.reduce((x, y) => x + (y - mn) ** 2, 0) / a.length) / mn; };
  const rows = [];
  for (const k of ['kingKrook', 'legosaurus', 'towerSovereign']) {
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

// Safety: a set that is not in the table must animate exactly as it did before.
ok('a set with no weights falls back to uniform timing',
   /!_fr \|\| !_w \|\| _w\.length !== _fr\.length\) return _bossLoopFrame/.test(game), '');
ok('a half-decoded set still animates on the old path',
   /_n < _fr\.length\) return _bossLoopFrame/.test(game), '');
ok('one sprite per frame — this is not the rejected crossfade',
   !/globalAlpha[^;]*_bossWalkFrame/.test(game), '');

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter((q) => q.pass).length}/${results.length} checks passed`);
process.exit(results.every((q) => q.pass) ? 0 : 1);
