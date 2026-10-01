// GEAR ERASE LEFTOVERS, CLEANED (per user: "yes clean", after the gear audit). Two baked Gear Align erases kept part of what was
// erased: the Skyhunter Longbow a third of its gold sun halo (and two holes punched in it), the Cosmic Wand a faint grey ghost of
// its nebula. Both now keep only the piece. Node only, no browser:
//   [1] both are still 768 x 768 lossless WebP, so the art maps onto the same Gear Align box as before (nothing moves)
//   [2] no see-through texel (alpha 1..229) sits more than 4 px from the solid art (the halo ran to ~150 px, the ghost ~120)
//   [3] the Skyhunter's halo corner holds nothing but the bow: no texel there further than 4 px from the bow's solid art
//   [4] the pieces themselves are whole: solid texels (alpha >= 230) at least 45,000 (bow) and 50,000 (wand)
// The baked erases before fail [2] and [3].   node scripts/gear_erase_cleanup_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import vm from 'node:vm';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const sharp = require('sharp'); const { readFileSync } = require('node:fs');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const sb = { window: {} }; vm.runInNewContext(readFileSync(path.join(ROOT, 'data/gear_erase.js'), 'utf8'), sb); const E = sb.window.LX_EQ_ERASE_DATA;
const POLY = [[60, 110], [345, 110], [345, 205], [292, 330], [252, 600], [60, 600]];   // where the halo sat, 768 px coords
const inPoly = (x, y) => { let c = false; for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) { const [xi, yi] = POLY[i], [xj, yj] = POLY[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const R = {};
for (const sid of ['wpn:skyhunter_longbow', 'wpn:cosmic_wand']) {
  const url = E[sid] || '', buf = Buffer.from(url.split(',')[1] || '', 'base64');
  const meta = await sharp(buf).metadata(), { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const N = info.width, M = info.height, px = N * M, INF = 1e9, D = new Float32Array(px);
  for (let i = 0; i < px; i++) D[i] = data[i * 4 + 3] >= 230 ? 0 : INF;
  const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= M) ? INF : D[y * N + x];
  for (let y = 0; y < M; y++) for (let x = 0; x < N; x++) { const i = y * N + x; if (D[i]) D[i] = Math.min(D[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4); }
  for (let y = M - 1; y >= 0; y--) for (let x = N - 1; x >= 0; x--) { const i = y * N + x; if (D[i]) D[i] = Math.min(D[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4); }
  let far = 0, corner = 0, solid = 0;
  for (let i = 0; i < px; i++) { const a = data[i * 4 + 3]; if (a >= 230) solid++; if (!a) continue; const x = i % N, y = (i - x) / N;
    if (a < 230 && D[i] / 3 > 4) far++; if (sid === 'wpn:skyhunter_longbow' && inPoly(x, y) && D[i] / 3 > 4) corner++; }
  R[sid] = { size: N + 'x' + M, webp: meta.format === 'webp' && url.startsWith('data:image/webp;base64,'), lossless: url.length > 0 && meta.format === 'webp', far, corner, solid };
}
const S = R['wpn:skyhunter_longbow'], C = R['wpn:cosmic_wand'];
ok('[1] both are still 768 x 768 WebP, mapped onto the same Gear Align box', S.size === '768x768' && C.size === '768x768' && S.webp && C.webp, { bow: S.size, wand: C.size });
ok('[2] no see-through texel more than 4 px from the solid art (the leftover glow and ghost are gone)', S.far === 0 && C.far === 0, { bow: S.far, wand: C.far });
ok("[3] the Skyhunter's halo corner holds nothing but the bow", S.corner === 0, { corner: S.corner });
ok('[4] the pieces are whole (solid texels: bow >= 45,000, wand >= 50,000)', S.solid >= 45000 && C.solid >= 50000, { bow: S.solid, wand: C.solid });
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
