// Test: the Doombringer ultimate's sword does not rotate, and its cast pacing
// is even.
//
// Per user: "further improve and do not rotate doombringer B skill sword
// animation."
//
// The rotation was entirely PROCEDURAL. Before changing any art, a fixed crop
// across all nine frames showed the hilt, pommel and crossguard sitting at the
// same angle throughout - the art does not turn. Two automated tilt metrics
// disagreed with each other (18.1 deg whole-mask, 14.8 deg connected-component)
// because both were counting white-hot flame highlights as blade; neither was
// measuring the sword. So the fix is spin: 0 on the spawn, and this test pins
// that rather than a number from a metric that could not be trusted.
//   node scripts/doombringer_spin_test.mjs [build.html]
import sharp from 'sharp';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'Sprites', 'fx', 'anim');
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// Accept an absolute candidate path so a build can be tested before it ships.
const TARGET = process.argv[2] || 'mojiworld_game.html';
const game = readFileSync(isAbsolute(TARGET) ? TARGET : join(ROOT, TARGET), 'utf8');

// THE REGRESSION CHECK. Fails on every build before this one.
{
  const m = game.match(/spawnSpriteBurst\([^;]*'doombringer_ult'[^;]*\)/);
  ok('the Doombringer ultimate spawns its burst', !!m, '');
  const spin = m && m[0].match(/spin:\s*([\d.]+)/);
  ok('...with no rotation', !!spin && Number(spin[1]) === 0, { spin: spin ? spin[1] : 'absent' });
}

// The weighted-hold path, and its two fall-throughs.
{
  const m = game.match(/const _FX_ANIM_WEIGHTS = (\{.*?\});/s);
  ok('the cast-FX timing table ships', !!m, '');
  const table = m ? JSON.parse(m[1]) : {};
  ok('Doombringer is re-timed', !!table.doombringer_ult, '');
  const w = table.doombringer_ult || [];
  const sum = w.reduce((a, b) => a + b, 0);
  ok('the cast keeps its original length (weights sum to the frame count)',
     w.length > 0 && Math.abs(sum - w.length) < 0.05, { sum: +sum.toFixed(3), frames: w.length });
  ok('no frame becomes a blink or a stall',
     w.length > 0 && Math.min(...w) >= 0.4 && Math.max(...w) <= 2.3,
     w.length ? { min: Math.min(...w), max: Math.max(...w) } : {});
  let n = 0;
  while (existsSync(join(DIR, `doombringer_ult_${n}.webp`))) n++;
  ok('the table matches the frames on disk', n === w.length, { weights: w.length, onDisk: n });
  ok('a set with no entry falls through to the original uniform timing',
     /_fi < 0\) _fi = Math\.min\(_fn - 1, Math\.max\(0, Math\.floor\(t \* _fn\)\)\)/.test(game), '');
  ok('a frameGap set is untouched',
     /if \(fx\.frameGap\) _fi = Math\.floor\(\(fx\.maxLife - fx\.life\) \/ fx\.frameGap\) % _fn;/.test(game), '');
}

// The smoothing is REAL: recompute the pacing both ways from the actual art.
{
  const m = game.match(/const _FX_ANIM_WEIGHTS = (\{.*?\});/s);
  const w = m ? (JSON.parse(m[1]).doombringer_ult || []) : [];
  const bufs = [];
  for (let i = 0; existsSync(join(DIR, `doombringer_ult_${i}.webp`)); i++)
    bufs.push(readFileSync(join(DIR, `doombringer_ult_${i}.webp`)));
  const small = [];
  for (const b of bufs) small.push(await sharp(b).resize(96, 96, { fit: 'fill' }).ensureAlpha().raw().toBuffer());
  const step = [];
  for (let i = 0; i < small.length; i++) {
    const a = small[i], b = small[(i + 1) % small.length];
    let s = 0;
    for (let q = 0; q < a.length; q += 4) s += Math.abs(a[q] - b[q]) + Math.abs(a[q + 3] - b[q + 3]);
    step.push(s / 1000);
  }
  const cv = (arr) => { const mn = arr.reduce((x, y) => x + y, 0) / arr.length;
    return +(Math.sqrt(arr.reduce((x, y) => x + (y - mn) ** 2, 0) / arr.length) / mn).toFixed(2); };
  const uniform = cv(step);
  const weighted = w.length === step.length ? cv(step.map((s, i) => s / w[i])) : 99;
  ok('weighted timing measurably evens out the cast', weighted < uniform * 0.65,
     { uniform, weighted, steps: step.map((x) => Math.round(x)).join(' ') });
}

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter((q) => q.pass).length}/${results.length} checks passed`);
process.exit(results.every((q) => q.pass) ? 0 : 1);
