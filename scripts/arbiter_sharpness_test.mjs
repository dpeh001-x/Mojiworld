// THE TOWER ARBITER'S FRAMES STAY SHARP (per user: "Arbiter sprites some of them appear to be blur, could you upscale HD for those sets that are blur"). His idle, walk, attack, dash,
// column and verdict sets carried a fraction of his still's fine detail (mean |laplacian| on solid pixels: still 27.5; sets 6.6-20.0, the dash lunge and the walk the softest); they were
// re-sharpened with the luminance shock filter (the Elderbark / Virga recipe, no credits) with the alpha byte-identical, so no bbox / edges / calib row moved. No browser - reads the art:
//   [1] all 54 frames are on disk at their set's canvas (1500 x 1300; the dash 2100 x 1300);
//   [2] every frame keeps at least 14 fine detail and each set's mean is at least 16 - the build before fails both (idle 13.9, walk 8.1, attack 8.6, dash 5.1 at the low end).
//   node scripts/arbiter_sharpness_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url); const sharp = require('sharp');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const detail = async (f) => { const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height;
  const L = (i) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; let s = 0, n = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = (y * W + x) * 4; if (data[i + 3] >= 250) { s += Math.abs(4 * L(i) - L(i - 4) - L(i + 4) - L(i - W * 4) - L(i + W * 4)); n++; } }
  return { d: s / n, W, H }; };
const SETS = [['idle', 'towerArbiter', 1500], ['walk', 'towerArbiter', 1500], ['attack', 'towerArbiter', 1500], ['attack', 'towerArbiterdash', 2100], ['attack', 'towerArbitercolumn', 1500], ['attack', 'towerArbiterverdict', 1500]];
const miss = [], size = [], soft = [], means = {};
for (const [dir, key, W] of SETS) { let sum = 0, n = 0;
  for (let i = 0; i < 9; i++) { const f = path.join(ROOT, 'Sprites/bosses', dir, key + '_' + i + '.webp'); if (!existsSync(f)) { miss.push(dir + '/' + key + '_' + i); continue; }
    const r = await detail(f); sum += r.d; n++; if (r.W !== W || r.H !== 1300) size.push(key + '_' + i + ' ' + r.W + 'x' + r.H); if (r.d < 14) soft.push(dir + '/' + key + '_' + i + ' ' + r.d.toFixed(1)); }
  means[dir + '/' + key] = n ? +(sum / n).toFixed(1) : 0; }
ok('[1] all 54 frames are on disk at their canvas (1500 x 1300, the dash 2100 x 1300)', miss.length === 0 && size.length === 0, { miss, size });
ok('[2] every frame keeps >= 14 fine detail and each set\'s mean is >= 16', soft.length === 0 && Object.values(means).every((m) => m >= 16), { means, soft: soft.slice(0, 6) });
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
