#!/usr/bin/env node
// Seven skill FX redrawn pop punk (per user: "These Fx skills need sprite regeneration ... make the skills look like strong
// skills"; "ship it with the ballista resize, and make sure the nozzle is facing the correct direction"). Static.
//   node scripts/skill_fx_pop_test.mjs   (VFX_ROOT)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), ROOT = process.env.VFX_ROOT || HERE;
const sharp = createRequire(path.join(HERE, 'package.json'))('sharp');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const ANIM = ['marksman_oneshot', 'ballista_ult', 'ballista_volley', 'skyhunter_ult'], STILL = ['holy_light', 'hexmaster_darkpulse', 'tg_swing'];
const files = [...ANIM.flatMap((k) => [`Sprites/fx/${k}.webp`, ...Array.from({ length: 9 }, (_, i) => `Sprites/fx/anim/${k}_${i}.webp`)]), ...STILL.map((k) => `Sprites/fx/${k}.webp`)];
ok('all 43 files ship', files.every((f) => existsSync(path.join(ROOT, f))));
let bad = [];
for (const f of files) { if (!existsSync(path.join(ROOT, f))) continue; const { data, info } = await sharp(path.join(ROOT, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height; let e = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) e = Math.max(e, data[(y * W + x) * 4 + 3]); if (e > 24) bad.push(f.split('/').pop() + ' ' + e); }
ok('nothing is cut off at any canvas edge', bad.length === 0, bad.slice(0, 5).join(', '));
// facing: the art faces RIGHT - more of the machine's mass sits on the left, the muzzle/arrow on the right
// the muzzle flash = the bright hot pixels (fire), not the whole machine, whose heavy base carries most of the mass
const massSide = async (f) => { const { data, info } = await sharp(path.join(ROOT, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height; let cx = 0, m = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = (y * W + x) * 4; if (data[p + 3] > 200 && data[p] > 235 && data[p + 1] > 170) { cx += x; m++; } } return m ? cx / m / W : 0.5; };
ok('the ballista ultimate faces right at rest (its muzzle flash sits right of centre)', (await massSide('Sprites/fx/anim/ballista_ult_0.webp')) > 0.5);
const g = readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8');
ok('...and turns with the caster (flipX by facing) at its new 364 size', g.includes("'ballista_ult', { size: 364, life: 80, flipX: player.facing < 0 });"));
ok('the volley flips with its caster or turret instead of rotating upside down', !/'ballista_volley',[\s\S]{0,40}angle: (player|tu)\.facing > 0 \? 0 : Math\.PI/.test(g)
  && g.includes("'ballista_volley', { size: 240, life: 22, flipX: tu.facing < 0 });") && (g.match(/size: 320, life: 28, flipX: player\.facing < 0 \}/g) || []).length === 2);
ok('the marksman bow sits on the canvas shape its spawn squeezes to (452x756 still, 560x938 frames)', await (async () => {
  const a = await sharp(path.join(ROOT, 'Sprites/fx/marksman_oneshot.webp')).metadata(), b = await sharp(path.join(ROOT, 'Sprites/fx/anim/marksman_oneshot_0.webp')).metadata();
  return a.width === 452 && a.height === 756 && b.width === 560 && b.height === 938; })());
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
