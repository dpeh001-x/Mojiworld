// Tiny RGBA layer toolkit for cut-out sprite animation (no deps beyond sharp for I/O).
// Layers are raw RGBA buffers of one square canvas. warp() applies a forward affine
// (2x3, canvas coords) by inverse-mapping every destination pixel with bilinear
// sampling in PREMULTIPLIED space, so rotated edges keep their outline colour.
export const I = () => [1, 0, 0, 0, 1, 0];                       // [a b c d e f]: x' = a x + b y + c ; y' = d x + e y + f
export const mul = (m, n) => [m[0] * n[0] + m[1] * n[3], m[0] * n[1] + m[1] * n[4], m[0] * n[2] + m[1] * n[5] + m[2],
  m[3] * n[0] + m[4] * n[3], m[3] * n[1] + m[4] * n[4], m[3] * n[2] + m[4] * n[5] + m[5]];
export const translate = (dx, dy) => [1, 0, dx, 0, 1, dy];
// rotate (deg, clockwise on screen) + scale about a pivot
export const about = (px, py, deg, sx = 1, sy = 1) => { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return mul(translate(px, py), mul([c * sx, -s * sy, 0, s * sx, c * sy, 0], translate(-px, -py))); };
export const apply = (m, x, y) => [m[0] * x + m[1] * y + m[2], m[3] * x + m[4] * y + m[5]];
export const invert = (m) => { const det = m[0] * m[4] - m[1] * m[3]; const a = m[4] / det, b = -m[1] / det, d = -m[3] / det, e = m[0] / det;
  return [a, b, -(a * m[2] + b * m[5]), d, e, -(d * m[2] + e * m[5])]; };

export function warp(src, W, H, m, alphaMul = 1) {
  const inv = invert(m); const out = Buffer.alloc(W * H * 4);
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    const sx = inv[0] * X + inv[1] * Y + inv[2], sy = inv[3] * X + inv[4] * Y + inv[5];
    const x0 = Math.floor(sx), y0 = Math.floor(sy); if (x0 < -1 || y0 < -1 || x0 >= W || y0 >= H) continue;
    const fx = sx - x0, fy = sy - y0; let r = 0, g = 0, b = 0, a = 0;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const xx = x0 + i, yy = y0 + j; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const w = (i ? fx : 1 - fx) * (j ? fy : 1 - fy); const o = (yy * W + xx) * 4, pa = src[o + 3] / 255 * w;
      r += src[o] * pa; g += src[o + 1] * pa; b += src[o + 2] * pa; a += pa;
    }
    if (a <= 0.002) continue; const o = (Y * W + X) * 4;
    out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a); out[o + 3] = Math.round(Math.min(1, a * alphaMul) * 255);
  }
  return out;
}
export function over(dst, src, W, H) {   // src OVER dst, in place
  for (let o = 0; o < W * H * 4; o += 4) { const sa = src[o + 3] / 255; if (!sa) continue; const da = dst[o + 3] / 255, oa = sa + da * (1 - sa);
    for (let k = 0; k < 3; k++) dst[o + k] = Math.round((src[o + k] * sa + dst[o + k] * da * (1 - sa)) / oa); dst[o + 3] = Math.round(oa * 255); }
  return dst;
}
export function measure(buf, W, H) {     // ink box (a>16), edge px, stone-body rows (bright, low-sat, a>=200)
  let t = -1, b = -1, l = -1, r = -1, edge = 0, st = -1, sb = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4, a = buf[o + 3];
    if (a > 16) { if (t < 0) t = y; b = y; if (l < 0 || x < l) l = x; if (x > r) r = x; if (y === 0 || y === H - 1 || x === 0 || x === W - 1) edge++; }
    if (a >= 200) { const R = buf[o], G = buf[o + 1], B = buf[o + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B); if ((mx ? (mx - mn) / mx : 0) < 0.25 && (R + G + B) / 3 > 120) { if (st < 0) st = y; sb = y; } } }
  return { t, b, l, r, edge, stoneH: sb - st + 1, stoneTop: st, margin: Math.min(l, W - 1 - r, t) };
}
// red "eye" blobs in a row band: clusters of saturated red columns >= 8px wide
export function eyeBlobs(buf, W, y0, y1, x0 = 0, x1 = W) {
  const cols = new Uint8Array(W);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const o = (y * W + x) * 4; if (buf[o + 3] > 128 && buf[o] > 170 && buf[o + 1] < 110 && buf[o + 2] < 100) cols[x] = 1; }
  let n = 0, run = 0; for (let x = x0; x <= x1; x++) { if (x < x1 && cols[x]) run++; else { if (run >= 8) n++; run = 0; } } return n;
}
