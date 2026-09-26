#!/usr/bin/env node
// Six regenerated effects (per user, after the sprite audit: "Regenerate those that needs new art", then "Wire them
// all in and ship"): four ultimate bursts that were cut at their canvas edge, the lightning pillar (a square bolt
// stretched 7.5x into its 64x480 column), and the lava pool (square art squashed into a 2.27:1 box). Static and
// deterministic.   node scripts/fx_regen2_test.mjs   (VFX_ROOT)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), ROOT = process.env.VFX_ROOT || HERE;
const sharp = createRequire(path.join(HERE, 'package.json'))('sharp');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const seq = (dir, k) => [`Sprites/${dir}/${k}.webp`, ...Array.from({ length: 9 }, (_, i) => `Sprites/${dir}/anim/${k}_${i}.webp`)];
const SETS = { sage_ult: 'fx', hexmaster_ult: 'fx', ballista_ult: 'fx', doombringer_ult: 'fx', lightning_pillar: 'vfx', lava_pool: 'vfx' };
const px = {};
for (const [k, d] of Object.entries(SETS)) for (const f of seq(d, k)) { if (!existsSync(path.join(ROOT, f))) continue; const { data, info } = await sharp(path.join(ROOT, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); px[f] = { data, W: info.width, H: info.height }; }
const all = Object.entries(SETS).flatMap(([k, d]) => seq(d, k));
ok('all 60 files are present and decode', all.every((f) => px[f]), all.filter((f) => !px[f]).length + ' missing');
const edge = ({ data, W, H }, sides) => { let m = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const e = (sides.includes('l') && x < 2) || (sides.includes('r') && x >= W - 2) || (sides.includes('t') && y < 2) || (sides.includes('b') && y >= H - 2); if (e) m = Math.max(m, data[(y * W + x) * 4 + 3]); } return m; };
for (const k of ['sage_ult', 'hexmaster_ult', 'ballista_ult', 'doombringer_ult']) { const w = Math.max(...seq('fx', k).map((f) => edge(px[f], 'lrtb'))); ok(`${k}: nothing reaches the canvas edge (it used to be cut off)`, w <= 24, 'max edge alpha ' + w); }
const game = readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8');
const P = seq('vfx', 'lightning_pillar'), pw = +((game.match(/_lxVfxFrame\('lightningPillar'\)\)\)\) \{\s*const _pw = (\d+);/) || [])[1]);
ok('the pillar art is tall (1:5), and the game draws it at that shape (_pw / 480)', P.every((f) => Math.abs(px[f].W / px[f].H - 0.2) < 0.01) && Math.abs(pw / 480 - 0.2) < 0.01, `art ${px[P[0]].W}x${px[P[0]].H}, draw ${pw}x480`);
ok('...its side arcs taper off before the column edges (the bottom is the ground strike)', Math.max(...P.map((f) => edge(px[f], 'lr'))) <= 24);
const L = seq('vfx', 'lava_pool');
ok('the lava pool art is the 2.27:1 shape of its draw box (_pw x _pw*0.44)', L.every((f) => Math.abs(px[f].W / px[f].H - 1 / 0.44) < 0.02) && /_pw\*0\.44\)/.test(game), `${px[L[0]].W}x${px[L[0]].H}`);
ok('...and nothing of it is cut off', Math.max(...L.map((f) => edge(px[f], 'lrtb'))) <= 24);
const diff = (a, b) => { let d = 0; for (let p = 0; p < a.data.length; p += 16) d += Math.abs(a.data[p] - b.data[p]) + Math.abs(a.data[p + 3] - b.data[p + 3]); return d / (a.data.length / 16) / 2; };
for (const [k, d] of [['lava_pool', 'vfx'], ['lightning_pillar', 'vfx']]) { const F = seq(d, k).slice(1).map((f) => px[f]), steps = F.slice(1).map((f, i) => diff(F[i], f)).sort((a, b) => a - b), seam = diff(F[8], F[0]);
  ok(`the ${k} loop has no seam (frame 9 -> 1 within 1.6x its median step)`, seam <= 1.6 * steps[4], `seam ${seam.toFixed(1)}, median ${steps[4].toFixed(1)}`); }
const wm = game.match(/const _FX_ANIM_WEIGHTS = (\{.*?\});/s), w = wm ? JSON.parse(wm[1]).doombringer_ult : null;
ok('Doombringer\'s hold weights are re-measured for the new blade (not the old 0.741 table) and keep the cast length', !!w && w[0] !== 0.741 && Math.abs(w.reduce((a, b) => a + b, 0) - 9) < 0.01, w && w.join(','));
const _db = [...game.matchAll(/spawnSpriteBurst\(_ultX, _ultY, 'doombringer_ult',\s*\{([^}]*)\}/g)].map((x) => x[1]);
ok('both Doombringer spawns keep the blade\'s old size and hang point on the new art (x1.22, pivot 0.212)', _db.length === 2 && _db.every((o) => /_ultBlade \* 1\.22/.test(o) && /pivotY: 0\.212/.test(o)), _db.length + ' spawns');
ok('the Sage flame column is spawned at 295 so it keeps its old on-screen size on the new art', /'sage_ult', \{ size: 295, life: 80 \}\)/.test(game));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
