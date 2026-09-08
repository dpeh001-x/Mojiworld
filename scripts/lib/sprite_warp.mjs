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
// The two red eyes as a PAIR: saturated-red components (4px grid), roughly square,
// side by side at one height, spacing 1.4-3.0x their height, in the upper half of
// the ink box. Returns {x1,x2,y,h,spacing} or null. The spacing is a rigid facial
// measure: invariant to arms, hammer and lean, it changes only with scale or a turn.
export function findEyes(buf, W, H) {
  const g = 4, GW = Math.ceil(W / g), GH = Math.ceil(H / g); const red = new Uint8Array(GW * GH); let inkT = H, inkB = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; if (buf[o + 3] > 128) { if (y < inkT) inkT = y; if (y > inkB) inkB = y; if (buf[o] > 170 && buf[o + 1] < 110 && buf[o + 2] < 100) red[(y / g | 0) * GW + (x / g | 0)] = 1; } }
  const seen = new Uint8Array(GW * GH), comps = [];
  for (let i = 0; i < GW * GH; i++) { if (!red[i] || seen[i]) continue; const st = [i]; seen[i] = 1; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, n = 0;
    while (st.length) { const c = st.pop(); const cx = c % GW, cy = (c / GW) | 0; n++; if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue; const j = ny * GW + nx; if (red[j] && !seen[j]) { seen[j] = 1; st.push(j); } } }
    const w = (x1 - x0 + 1) * g, h = (y1 - y0 + 1) * g; if (w < 12 || h < 12 || w / h < 0.55 || w / h > 1.8 || n * g * g < 0.5 * w * h) continue; comps.push({ cx: (x0 + x1 + 1) / 2 * g, cy: (y0 + y1 + 1) / 2 * g, w, h }); }
  let best = null; const half = inkT + (inkB - inkT) * 0.5;
  for (const a of comps) for (const b of comps) { if (a === b || a.cx >= b.cx) continue; const h = Math.max(a.h, b.h); if (Math.abs(a.cy - b.cy) > 0.5 * h || a.cy > half || b.cy > half) continue;
    // the static's eyes: 48px squares 146px apart -> ratio 3.04; window 1.6-4.4, scored around 3.0
    const dx = b.cx - a.cx, r = dx / h; if (r < 1.6 || r > 4.4) continue; const sim = Math.max(a.w * a.h, b.w * b.h) / Math.min(a.w * a.h, b.w * b.h); if (sim > 2) continue;
    const score = Math.abs(r - 3.0) + (sim - 1) * 0.5; if (!best || score < best.score) best = { x1: a.cx, x2: b.cx, y: (a.cy + b.cy) / 2, h, spacing: dx, score }; }
  return best;
}
// red "eye" blobs in a row band: clusters of saturated red columns >= 8px wide
export function eyeBlobs(buf, W, y0, y1, x0 = 0, x1 = W) {
  const cols = new Uint8Array(W);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const o = (y * W + x) * 4; if (buf[o + 3] > 128 && buf[o] > 170 && buf[o + 1] < 110 && buf[o + 2] < 100) cols[x] = 1; }
  let n = 0, run = 0; for (let x = x0; x <= x1; x++) { if (x < x1 && cols[x]) run++; else { if (run >= 8) n++; run = 0; } } return n;
}
