// AETHERION'S SHARD LANCE HAS A THIN BLACK OUTLINE (v0.30.1473). Per user: "Aetherion shard lance should have thin black
// outline outside". Picked from four candidates: an 8 px ring (about 0.9 screen px at the 57 px the game draws it) round
// the crystal, fading out along the flame so the trail's tail stays soft. The still and all nine frames.
//   1. the crystal (the front 55% of the solid silhouette) is ringed: the pixels 2-5 px outside it are near-black;
//   2. the flame's tail (the rear 10%) is not: its ring stays open, the glow soft;
//   3. nothing reaches within 2 px of the canvas edge (the edge-feather probe would call it a cut edge).
// Static: reads the art.   node scripts/aetherion_lance_outline_test.mjs   (MOJI_SERVE_ROOT overrides the tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharp = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'package.json'))('sharp');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + JSON.stringify(x) : '')); };
const FILES = ['Sprites/projectiles/maeshard.webp', ...Array.from({ length: 9 }, (_, i) => `Sprites/projectiles/anim/maeshard_${i}.webp`)];
const rows = [];
for (const f of FILES) {
  const { data, info } = await sharp(path.join(ROOT, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height;
  const A = (x, y) => data[(y * W + x) * 4 + 3];
  // the solid silhouette the ring is drawn round: alpha >= 96 in the ORIGINAL art sits inside the ring, so find it as
  // "not near-black and alpha >= 96" (the ring itself is near-black)
  const dark = (x, y) => { const q = (y * W + x) * 4; return data[q + 3] > 200 && data[q] < 70 && data[q + 1] < 70 && data[q + 2] < 70; };
  // ...minus loose specks (components under 120 px): sparkles are left unoutlined on purpose
  const M = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) M[y * W + x] = (A(x, y) >= 96 && !dark(x, y)) ? 1 : 0;
  { const seen = new Uint8Array(W * H); for (let k = 0; k < W * H; k++) { if (!M[k] || seen[k]) continue; const comp = [k], st = [k]; seen[k] = 1;
      while (st.length) { const p = st.pop(), px = p % W, py = (p / W) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = px + dx, ny = py + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const q = ny * W + nx; if (M[q] && !seen[q]) { seen[q] = 1; st.push(q); comp.push(q); } } }
      if (comp.length < 120) for (const p of comp) M[p] = 0; } }
  const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && M[y * W + x] === 1;
  let x0 = W, x1 = -1; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (solid(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  const L = x1 - x0; let front = 0, frontDark = 0, tail = 0, tailDark = 0, edge = 0;
  for (let y = 5; y < H - 5; y++) for (let x = 5; x < W - 5; x++) {
    if (solid(x, y)) continue;
    // a pixel 2..5 px outside the solid silhouette (Chebyshev), measured to its nearest solid pixel
    let near = 99; for (let dy = -5; dy <= 5 && near > 1; dy++) for (let dx = -5; dx <= 5; dx++) if (solid(x + dx, y + dy)) near = Math.min(near, Math.max(Math.abs(dx), Math.abs(dy)));
    if (near < 2 || near > 5) continue;
    const t = (x - x0) / L;
    if (t > 0.45) { front++; if (dark(x, y)) frontDark++; } else if (t < 0.10) { tail++; if (dark(x, y)) tailDark++; }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x < 2 || y < 2 || x >= W - 2 || y >= H - 2) && A(x, y) > 24) edge++;
  rows.push({ f: f.split('/').pop(), front: +(frontDark / Math.max(1, front)).toFixed(2), tail: +(tailDark / Math.max(1, tail)).toFixed(2), edge });
}
ok('the crystal is ringed in black in the still and every frame (>= 85% of the band 2-5 px outside it is near-black)', rows.every((r) => r.front >= 0.85), rows.map((r) => r.f + ' ' + r.front));
ok('the flame\'s tail stays soft (<= 25% of its band dark)', rows.every((r) => r.tail <= 0.25), rows.map((r) => r.f + ' ' + r.tail));
ok('nothing reaches within 2 px of the canvas edge', rows.every((r) => r.edge === 0), rows.filter((r) => r.edge).map((r) => r.f + ' ' + r.edge));
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
