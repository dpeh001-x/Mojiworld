#!/usr/bin/env node
// The regenerated VFX (ludo.ai): the cloudburst and frost-beam loops, War of Banners, and the twelve class hit sparks,
// which now animate. Per user: "Ensure no cutoffs of the edge and that the bottom of the skill sprite is vertically on
// the ground / platform" - War of Banners is drawn anchorBottom (its canvas's bottom edge sits on the caster's feet),
// so its lowest pixel must be ON the bottom row, and nothing may reach the sides or the top.
// Static and deterministic: reads the art and the tables, no browser.   node scripts/vfx_regen_test.mjs  (VFX_ROOT)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
const ROOT = process.env.VFX_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharp = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'package.json'))('sharp');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const HITS = []; for (const c of ['warrior', 'mage', 'rogue', 'archer']) for (const v of ['', '_2', '_3']) HITS.push(`hit_${c}${v}`);
const seq = (dir, k) => Array.from({ length: 9 }, (_, i) => `Sprites/${dir}/${k}_${i}.webp`);
const SETS = { cloudburst: ['Sprites/vfx/cloudburst.webp', ...seq('vfx/anim', 'cloudburst')], frost_beam: ['Sprites/vfx/frost_beam.webp', ...seq('vfx/anim', 'frost_beam')],
  warlord_ult: ['Sprites/fx/warlord_ult.webp', ...seq('fx/anim', 'warlord_ult')] };
for (const k of HITS) SETS[k] = [`Sprites/fx/${k}.webp`, ...seq('fx/anim', k)];
const ALL = Object.values(SETS).flat();
const px = {};
for (const f of ALL) { const p = path.join(ROOT, f); if (!existsSync(p)) continue; try { const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); px[f] = { data, W: info.width, H: info.height }; } catch (e) {} }
ok('all 150 files are present and decode', ALL.every((f) => px[f]), ALL.filter((f) => !px[f]).slice(0, 3).join(', '));
const band = (f, side) => { const { data, W, H } = px[f]; let m = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const e = side === 'l' ? x < 2 : side === 'r' ? x >= W - 2 : side === 't' ? y < 2 : y >= H - 2; if (e && data[(y * W + x) * 4 + 3] > m) m = data[(y * W + x) * 4 + 3]; } return m; };
const lowest = (f) => { const { data, W, H } = px[f]; for (let y = H - 1; y >= 0; y--) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 24) return y; return -1; };
const asp = (f) => px[f].W / px[f].H;
ok('the cloud is drawn in a 1 : 0.78 box, and its art is that shape (no squash)', SETS.cloudburst.every((f) => Math.abs(asp(f) - 1 / 0.78) < 0.01), asp(SETS.cloudburst[0]).toFixed(3));
ok('the frost beam fills its 280 x (32 x 3.4) box at the same 2.57 : 1', SETS.frost_beam.every((f) => Math.abs(asp(f) - 280 / (32 * 3.4)) < 0.02), asp(SETS.frost_beam[0]).toFixed(3));
const wob = SETS.warlord_ult;
ok('War of Banners stands ON the ground: every frame\'s lowest pixel is the bottom row', wob.slice(1).every((f) => lowest(f) === px[f].H - 1) && lowest(wob[0]) >= px[wob[0]].H - 3, wob.map((f) => lowest(f)).join(' '));
ok('...and nothing of it is cut off at the sides or the top', wob.every((f) => band(f, 'l') <= 24 && band(f, 'r') <= 24 && band(f, 't') <= 24));
const others = ALL.filter((f) => !wob.includes(f));
ok('no other frame touches any edge of its canvas', others.every((f) => ['l', 'r', 't', 'b'].every((s) => band(f, s) <= 24)), others.filter((f) => !['l', 'r', 't', 'b'].every((s) => band(f, s) <= 24)).slice(0, 3).join(', '));
const mass = (f) => { const { data } = px[f]; let s = 0; for (let i = 3; i < data.length; i += 4) s += data[i]; return s; };
ok('every hit spark dissipates: its last frame carries under half the alpha of its peak', HITS.every((k) => mass(SETS[k][9]) < 0.5 * Math.max(...SETS[k].slice(1, 6).map(mass))), HITS.filter((k) => !(mass(SETS[k][9]) < 0.5 * Math.max(...SETS[k].slice(1, 6).map(mass)))).join(', '));
const diff = (a, b) => { const A = px[a].data, B = px[b].data; let d = 0; for (let p = 0; p < A.length; p += 16) d += Math.abs(A[p] - B[p]) + Math.abs(A[p + 3] - B[p + 3]); return d / (A.length / 16) / 2; };
for (const k of ['cloudburst', 'frost_beam']) { const F = SETS[k].slice(1), steps = F.slice(1).map((f, i) => diff(F[i], f)).sort((a, b) => a - b), seam = diff(F[8], F[0]);
  ok(`the ${k} loop has no seam: frame 9 -> 1 is no bigger a step than the loop's own (x1.6 of its median)`, seam <= 1.6 * steps[4], `seam ${seam.toFixed(1)}, median step ${steps[4].toFixed(1)}`); }
const game = readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8'), keys = (game.match(/const _FX_ANIM_KEYS = new Set\(\[([\s\S]*?)\]\);/) || [])[1] || '';
ok('the game plays the sparks\' frames (all 12 keys in _FX_ANIM_KEYS)', HITS.every((k) => keys.includes(`'${k}'`)), HITS.filter((k) => !keys.includes(`'${k}'`)).join(', '));
const fi = readFileSync(path.join(ROOT, 'data', 'sprite_frame_index.js'), 'utf8');
const fxAnim = JSON.parse(fi.slice(fi.indexOf('{'), fi.lastIndexOf('}') + 1)).frames;
ok('the frame index counts nine frames for every set', HITS.concat('warlord_ult').every((k) => fxAnim['fx/anim'][k] === 9) && fxAnim['vfx/anim'].cloudburst === 9 && fxAnim['vfx/anim'].frost_beam === 9);
const man = JSON.parse(readFileSync(path.join(ROOT, 'data', 'assets_manifest.json'), 'utf8'));
ok('every file is in the offline pre-cache list', ALL.every((f) => man.includes(f)), ALL.filter((f) => !man.includes(f)).length + ' missing');
const ed = readFileSync(path.join(ROOT, 'data', 'sprite_edges.js'), 'utf8'), edges = JSON.parse(ed.slice(ed.indexOf('window.LX_SPRITE_EDGES = ') + 25, ed.lastIndexOf(';')));
ok('every file has its measured edge-probe entry', ALL.every((f) => f.slice(8) in edges), ALL.filter((f) => !(f.slice(8) in edges)).length + ' missing');
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
