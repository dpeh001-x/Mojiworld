#!/usr/bin/env node
// Eight effects that were still cut at their canvas edge (per user: "Lets work on the cut off canvas edge fix").
// Loose glow / flame / sparks / particles now fade out before the edge; the gloop puddle - a whole rounded shape with
// no margin - was inset so its ends are not cut; the forge's bottom is its floor and stays. Static.
//   node scripts/edge_fix_test.mjs   (VFX_ROOT)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), ROOT = process.env.VFX_ROOT || HERE;
const sharp = createRequire(path.join(HERE, 'package.json'))('sharp');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const files = (d, k) => [`Sprites/${d}/${k}.webp`, ...Array.from({ length: 9 }, (_, i) => `Sprites/${d}/anim/${k}_${i}.webp`)];
const rd = async (f) => { const { data, info } = await sharp(path.join(ROOT, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, W: info.width, H: info.height }; };
const side = ({ data, W, H }, s) => { let m = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if ((s === 'l' && x < 2) || (s === 'r' && x >= W - 2) || (s === 't' && y < 2) || (s === 'b' && y >= H - 2)) m = Math.max(m, data[(y * W + x) * 4 + 3]); } return m; };
const SETS = [['fx', 'block_warrior', 'lrtb'], ['fx', 'ballista_volley', 'lrtb'], ['fx', 'fx_leo_slam', 'lrtb'], ['fx', 'qte_molten', 'lrtb'], ['fx', 'qte_spore', 'lrtb'], ['vfx', 'void_tear', 'lrtb'], ['fx', 'forge_success', 'lrt'], ['vfx', 'gloop_puddle', 'lrtb']];
for (const [d, k, sides] of SETS) {
  const L = files(d, k); if (!L.every((f) => existsSync(path.join(ROOT, f)))) { ok(`${k}: all 10 files present`, false); continue; }
  const F = await Promise.all(L.map(rd)); let worst = 0, where = '';
  for (let i = 0; i < F.length; i++) for (const s of sides) { const v = side(F[i], s); if (v > worst) { worst = v; where = L[i].split('/').pop() + ' ' + s; } }
  ok(`${k}: nothing reaches the ${sides.split('').join('/')} edge of any frame`, worst <= 24, worst ? `${where} alpha ${worst}` : '');
}
{ const F = await Promise.all(files('vfx', 'gloop_puddle').map(rd)); let x0 = 1e9, x1 = -1;
  for (const { data, W, H } of F) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  const W = F[0].W; ok('the gloop puddle keeps its rounded ends: its outline sits inside the canvas on both sides', x0 >= W * 0.02 && x1 <= W * 0.98, `x ${x0}-${x1} of ${W}`); }
// The anvil's solid feet (the lowest row that is >8% solid) sit at 95% of the still and 86% of the frames. The still's
// feet are inside the bottom 10%, so a taper on the floor edge would thin them and fail this.
{ const F = await Promise.all(files('fx', 'forge_success').map(rd)); const feet = F.map(({ data, W, H }) => { for (let y = H - 1; y >= 0; y--) { let n = 0; for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 200) n++; if (n > W * 0.08) return y / H; } return 0; });
  ok('the forge anvil still stands on its floor (its bottom was not faded)', feet[0] >= 0.94 && feet.slice(1).every((v) => v >= 0.85), feet.map((v) => v.toFixed(2)).join(' ')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
