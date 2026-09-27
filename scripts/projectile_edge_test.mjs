#!/usr/bin/env node
// Projectile art no longer cut at its canvas edge (per user: "fix the projectile glow edges too"). Glow, sparks, debris and
// spray fade out before the edge; solid shapes were inset so their outline is whole; a ground-riding wave keeps its floor
// edge. Static: scans every projectile set.   node scripts/projectile_edge_test.mjs   (VFX_ROOT)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { readdirSync, existsSync } from 'node:fs';
const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), ROOT = process.env.VFX_ROOT || HERE;
const sharp = createRequire(path.join(HERE, 'package.json'))('sharp');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const D = path.join(ROOT, 'Sprites', 'projectiles');
const files = [...readdirSync(path.join(D, 'anim')).filter((f) => /_\d+\.webp$/.test(f)).map((f) => 'anim/' + f), ...readdirSync(D).filter((f) => /\.(webp|png)$/.test(f))];
// the waves that roll along the floor: their bottom edge IS the floor, by design
const FLOOR = /^(anim\/)?(tidalSweep|tsunami|p_tidalsweep|p_tsunami)(_\d+)?\./;
const bad = [];
for (const f of files) {
  const { data, info } = await sharp(path.join(D, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height;
  const floor = FLOOR.test(f); let worst = 0, side = '';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = data[(y * W + x) * 4 + 3]; if (a <= 40) continue;
    const s = x < 2 ? 'l' : x >= W - 2 ? 'r' : y < 2 ? 't' : (y >= H - 2 && !floor) ? 'b' : '';
    if (s && a > worst) { worst = a; side = s; }
  }
  if (worst) bad.push(`${f} ${side} ${worst}`);
}
ok(`no projectile frame or still reaches its canvas edge (${files.length} files; floor waves keep their bottom)`, bad.length === 0, bad.slice(0, 6).join(', ') + (bad.length > 6 ? ` +${bad.length - 6}` : ''));
// The tidal sweep is the one that really stands on the floor (~92% of its bottom row is solid water); its floor edge was
// left alone, so it must still be there. (The tsunami's water line sits just above its bottom - only spray touches.)
const sweep = files.filter((f) => /^(anim\/tidalSweep_\d+|p_tidalsweep)\./.test(f));
ok('the tidal sweep still stands on its floor (its bottom row is solid water)', sweep.length > 0 && (await Promise.all(sweep.map(async (f) => {
  const { data, info } = await sharp(path.join(D, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height; let n = 0;
  for (let x = 0; x < W; x++) if (data[((H - 1) * W + x) * 4 + 3] > 40) n++; return n > W * 0.8;
}))).every(Boolean), sweep.length + ' files');
ok('the octopus dart still ships (inset, not removed)', existsSync(path.join(D, 'p_octoleg.webp')) && existsSync(path.join(D, 'anim', 'octoLeg_0.webp')));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
