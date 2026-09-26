#!/usr/bin/env node
// The sprite audit's fixes (per user: "Housekeeping - delete those not used", "Fix the fixable"). Static and
// deterministic - reads the art and the tables, no browser.   node scripts/sprite_audit_fixes_test.mjs  (VFX_ROOT)
// It also pins the audit's near-miss: forge_success / forge_fail LOOK unused to a literal search, but the forge
// modal builds their path ('Sprites/fx/anim/forge_' + kind + '_' + i), so they must stay.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), ROOT = process.env.VFX_ROOT || HERE;
const sharp = createRequire(path.join(HERE, 'package.json'))('sharp');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const seq = (dir, k) => Array.from({ length: 9 }, (_, i) => `Sprites/${dir}/${k}_${i}.webp`);
const rd = async (f) => { const { data, info } = await sharp(path.join(ROOT, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, W: info.width, H: info.height }; };
const lowest = ({ data, W, H }) => { for (let y = H - 1; y >= 0; y--) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 24) return y; return -1; };
const edge = ({ data, W, H }) => { let m = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) m = Math.max(m, data[(y * W + x) * 4 + 3]); return m; };
const diff = (a, b) => { let d = 0; for (let p = 0; p < a.data.length; p += 16) d += Math.abs(a.data[p] - b.data[p]) + Math.abs(a.data[p + 3] - b.data[p + 3]); return d / (a.data.length / 16) / 2; };
const GW = ['Sprites/vfx/gravity_well.webp', ...seq('vfx/anim', 'gravity_well')];
const man = JSON.parse(readFileSync(path.join(ROOT, 'data', 'assets_manifest.json'), 'utf8'));
const fi = readFileSync(path.join(ROOT, 'data', 'sprite_frame_index.js'), 'utf8'), ed = readFileSync(path.join(ROOT, 'data', 'sprite_edges.js'), 'utf8');
const game = readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8');
ok('the retired gravity_well art is gone (it had been replaced by the cloudburst in v0.29.407)', GW.every((f) => !existsSync(path.join(ROOT, f))));
ok('...and no table still lists it', !GW.some((f) => man.includes(f)) && !/"gravity_well"/.test(fi) && !ed.includes('vfx/gravity_well') && !ed.includes('vfx/anim/gravity_well'));
ok('the forge result frames stay: the forge modal plays them by a built path', ['success', 'fail'].every((k) => seq('fx/anim', 'forge_' + k).every((f) => existsSync(path.join(ROOT, f)))) && game.includes("'Sprites/fx/anim/forge_' + kind + '_'"));
for (const k of ['cascade_fire', 'grav_impact']) {
  const F = await Promise.all(seq('fx/anim', k).map(rd));
  ok(`${k} (drawn anchorBottom) stands on the ground: its frames' lowest pixel is the bottom row`, Math.max(...F.map(lowest)) === F[0].H - 1, F.map(lowest).join(' '));
}
for (const f of ['Sprites/fx/cascade_fire.webp', 'Sprites/fx/grav_impact.webp', 'Sprites/fx/fireball.webp']) { const s = await rd(f); ok(`${path.basename(f)} (the still, also bottom-anchored) stands on the ground`, lowest(s) === s.H - 1, lowest(s) + '/' + (s.H - 1)); }
for (const [dir, k] of [['vfx/anim', 'poison_cloud'], ['projectiles/anim', 'cancerBubble'], ['fx/anim', 'archbishop_ult']]) {
  const F = await Promise.all(seq(dir, k).map(rd)), steps = F.slice(1).map((f, i) => diff(F[i], f)).sort((a, b) => a - b), seam = diff(F[8], F[0]);
  ok(`${k} loops without a seam (frame 9 -> 1 within 1.6x its median step)`, seam <= 1.6 * steps[4], `seam ${seam.toFixed(1)}, median ${steps[4].toFixed(1)}`);
}
for (const k of ['arcane_shockwave', 'beastmaster_pack', 'sage_meteorshower', 'quakeRing', 'qte_break', 'shadowlord_ult']) {
  const F = await Promise.all(seq('fx/anim', k).map(rd)), e = F.map(edge);
  ok(`${k} tapers off before every edge (nothing cut off)`, Math.max(...e) <= 24, 'max edge alpha ' + Math.max(...e));
}
ok('soul_vortex1 keeps its 536x721 aspect instead of stretching into a square', /'soul_vortex1',\s*\{[^}]*keepAspect: true/.test(game));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
