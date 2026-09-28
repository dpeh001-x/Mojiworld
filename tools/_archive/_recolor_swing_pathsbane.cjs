// One-off (v0.30.1406, per user "wire it" after Path's Bane's attack redraw): Sprites/fx/swing_pathsBane.webp recoloured
// from its v0.29.812 crimson reap into the redrawn attack's green trail, by depth inside the crescent.
//   node tools/_archive/_recolor_swing_pathsbane.cjs <old swing_pathsBane.webp> <out.webp> 0.55
// swing_pathsBane.webp in the redrawn attack's trail look: the old crescent's alpha, coloured by DEPTH inside the shape
// (green rim and thin tips, white where it is thick - how the frame-4 trail reads) with the old art's own highlights kept
// on top. Ramp sampled from attack frame 4. node recolor2.cjs <in> <out> [d0frac]
const sharp = require('sharp');
const [inF, outF, dS = '0.55'] = process.argv.slice(2);
const STOPS = [[0, [0, 150, 45]], [0.3, [40, 215, 90]], [0.55, [80, 250, 140]], [0.8, [205, 255, 215]], [1, [255, 255, 255]]];
const ramp = (t) => { for (let i = 1; i < STOPS.length; i++) if (t <= STOPS[i][0]) { const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i], k = (t - a) / (b - a); return ca.map((v, j) => Math.round(v + (cb[j] - v) * k)); } return STOPS[STOPS.length - 1][1]; };
(async () => {
  const { data: d, info } = await sharp(inF).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, INF = 1e9, D = new Float32Array(W * H);
  for (let p = 0; p < W * H; p++) D[p] = d[p * 4 + 3] > 96 ? INF : 0;
  const R2 = Math.SQRT2;   // two-pass chamfer distance to the nearest clear pixel
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = y * W + x; if (!D[p]) continue; let v = D[p];
    v = Math.min(v, x > 0 ? D[p - 1] + 1 : 1); if (y > 0) { v = Math.min(v, D[p - W] + 1); if (x > 0) v = Math.min(v, D[p - W - 1] + R2); if (x < W - 1) v = Math.min(v, D[p - W + 1] + R2); } else v = Math.min(v, 1); D[p] = v; }
  let mx = 0;
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const p = y * W + x; if (!D[p]) continue; let v = D[p];
    v = Math.min(v, x < W - 1 ? D[p + 1] + 1 : 1); if (y < H - 1) { v = Math.min(v, D[p + W] + 1); if (x < W - 1) v = Math.min(v, D[p + W + 1] + R2); if (x > 0) v = Math.min(v, D[p + W - 1] + R2); } else v = Math.min(v, 1); D[p] = v; if (v > mx) mx = v; }
  const D0 = mx * +dS;
  for (let p = 0; p < W * H; p++) { const o = p * 4; if (!d[o + 3]) continue;
    const L = (0.3 * d[o] + 0.59 * d[o + 1] + 0.11 * d[o + 2]) / 255, depth = Math.min(1, D[p] / D0);
    const t = Math.min(1, Math.max(0.05 + 0.9 * Math.pow(depth, 0.8), L > 0.55 ? 0.6 + 0.4 * L : 0));
    const c = ramp(t); d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; }
  const buf = await sharp(d, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toBuffer();
  require('fs').writeFileSync(outF, buf); console.log(outF, W + 'x' + H, buf.length + 'b', 'maxDepth', mx.toFixed(1));
})();
