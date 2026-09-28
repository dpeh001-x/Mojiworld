#!/usr/bin/env node
// v0.30.1369: King Krook wears his monocle on his FAR eye in every frame he has (per user: "king krook's walk animation make his monocole
// appear on his other eye fix it"). Walk frames 5 and 6 had it on his near eye, in the middle of his face, so it jumped between his
// eyes twice per step. No browser - reads the art:
//   - FAR EYE: the steel-blue lens sits right of the crown's centre by >= 7% of the canvas (every frame measures 9.9-11.8%; the old
//     walk 5 and 6 measured 0.3% and 0.2%)
//   - FAR-EYE SIZE: the lens is the small, side-on one, <= 700 px (297-484 in every frame; the near-eye lens of the old 5 and 6 was
//     1284 and 1255 px)
//   - SAME LENS: the lens is the set's steel blue (mean green < 160), not a brighter teal redraw (the image edit's lens was 187)
//   node scripts/krook_monocle_test.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const sharp = require('sharp'); sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const files = [];
for (const d of ['Sprites/bosses', 'Sprites/bosses/idle', 'Sprites/bosses/walk', 'Sprites/bosses/attack'])
  for (const f of fs.readdirSync(path.join(ROOT, d)).sort()) if (/^kingKrook(stomp)?(_\d+)?\.webp$/.test(f)) files.push(d + '/' + f);
const bad = { side: [], size: [], colour: [], none: [] }; const walk = [];
for (const rel of files) {
  const { data: m, info } = await sharp(path.join(ROOT, rel)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; let ln = 0, lx = 0, lg = 0, cn = 0, cx = 0;
  for (let y = 0; y < H / 2; y++) for (let x = 0; x < W; x++) {   // the head band: steel-blue lens, gold crown
    const i = (y * W + x) * 4, R = m[i], G = m[i + 1], B = m[i + 2]; if (m[i + 3] < 200) continue;
    if (B > R + 25 && G > R + 15 && B > 90) { ln++; lx += x; lg += G; }
    if (R > 180 && G > 140 && B < 110 && R - B > 90) { cn++; cx += x; } }
  const name = rel.replace('Sprites/bosses/', '');
  if (ln < 200 || cn < 500) { bad.none.push(`${name} lens ${ln} crown ${cn}`); continue; }
  const dx = (lx / ln - cx / cn) / W * 100, g = lg / ln;
  if (/^walk\//.test(name)) walk.push(`${name.replace('walk/kingKrook_', '').replace('.webp', '')}:${dx.toFixed(1)}%/${ln}`);
  if (dx < 7) bad.side.push(`${name} ${dx.toFixed(1)}%`);
  if (ln > 700) bad.size.push(`${name} ${ln} px`);
  if (g >= 160) bad.colour.push(`${name} G ${g.toFixed(0)}`);
}
ok(`found King Krook's frames (${files.length})`, files.length >= 39 && files.filter((f) => f.includes('/walk/')).length === 9, files.length + ' files');
ok('every frame shows the lens and the crown', !bad.none.length, bad.none.join(', '));
ok('the monocle is on his FAR eye in every frame (lens >= 7% right of the crown)', !bad.side.length, bad.side.join(', ') || 'walk ' + walk.join(' '));
ok('the lens is the small side-on one in every frame (<= 700 px)', !bad.size.length, bad.size.join(', '));
ok('the lens is the set\'s steel blue in every frame', !bad.colour.length, bad.colour.join(', '));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
