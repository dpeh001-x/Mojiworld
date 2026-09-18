#!/usr/bin/env node
// The Pincer (monster type 'scorpion') grows no antennas.
// ============================================================================
// Per user, from a phone video: "the monster "pincer" is growing antennas out of nowhere, ensure he does not grow
// antennas". Of its 27 animation frames (idle / walk / attack x 9) exactly two have them - idle 5 and idle 6, the
// happy squint in the middle of the idle loop - so for 2 frames in 9 a pair of antennas popped out of his head and
// back in. They are cut out here and the head redrawn under them:
//   1. the top edge of the silhouette across the antennas is rebuilt from the edge either side of them (the body
//      segment's outline on the left, the head's arc between and right of them) - a cubic whose ends match the
//      measured edge in position and slope;
//   2. everything above that edge goes (with an anti-aliased rim), and the outline band under it is repainted at the
//      thickness measured on the clean arc beside it, so no orange of the antenna shows through;
//   3. the two dark roots each antenna pushed down into the head's cream highlight are repainted from the highlight
//      on the same row either side of them.
// Every other pixel is untouched; the squint, the tail and the legs stay as painted.
//
//   node scripts/fix_pincer_antennas.mjs              fix the two frames in place (the ship chain's second apply)
//   node scripts/fix_pincer_antennas.mjs --out <dir>  write the fixed frames to <dir> instead (for a look first)
// Guarded: each frame must be the exact file the fix was measured on (sha256), or already fixed (then it is left
// alone). Anything else aborts - new art needs a new look, not a blind cut.
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp'); sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outIdx = process.argv.indexOf('--out'), OUT = outIdx > 0 ? process.argv[outIdx + 1] : null;
const sha = (b) => createHash('sha256').update(b).digest('hex');

// Per frame: the source it was measured on, the result, and the two root boxes (x0, x1, deepest y) - read off a 4x
// grid of each frame. The edge, the band and the colours are measured from the pixels, not typed in.
const FRAMES = {
  'Sprites/monsters/idle/scorpion_5.webp': { src: '1913444c2915e283e8e64f1f1c15bfb50e2da362af78cfe4ef724ab00f6a8308', out: 'e4456d4e677379d4da950cde41b08a0e9d1ff1ef3b0761ff27c8d0607b3b051a', roots: [[469, 489, 310], [506, 526, 300]] },
  'Sprites/monsters/idle/scorpion_6.webp': { src: '638b2de631d4379cad25c441798d47c45a78cfca6c00dfb5ce4e2c846af6eee1', out: 'c11ed585a00f0e1b253730c3efb5ea0b1b7c2a60642e2a967d731f6abfc83450', roots: [[469, 489, 311], [507, 527, 300]] },
};
const BODY = [405, 440], MID = [476, 516], RIGHT = [573, 603];   // where the silhouette top is clean in both frames

function fix(px, W, H) {
  const A = (x, y) => px[(y * W + x) * 4 + 3];
  const Lum = (x, y) => { const o = (y * W + x) * 4; return 0.3 * px[o] + 0.59 * px[o + 1] + 0.11 * px[o + 2]; };
  const set = (x, y, r, g, b, a) => { const o = (y * W + x) * 4; px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = a; };
  // the top edge of a column, to a fraction of a pixel: the half-covered pixel above the first solid one
  const edge = (x) => { let y = 0; while (y < H && A(x, y) < 128) y++; return y - (y > 0 ? A(x, y - 1) / 255 : 0); };
  const top = []; for (let x = 0; x < W; x++) top[x] = edge(x);
  // clean samples: the body line, the head arc between the antennas (minus the fillets where a stem flares into it -
  // anything more than 1.5 px above the lowest point there), and the arc right of them
  const samples = [];
  for (let x = BODY[0]; x <= BODY[1]; x++) samples.push(x);
  let lowest = 0; for (let x = MID[0]; x <= MID[1]; x++) lowest = Math.max(lowest, top[x]);
  for (let x = MID[0]; x <= MID[1]; x++) if (top[x] >= lowest - 1.5) samples.push(x);
  for (let x = RIGHT[0]; x <= RIGHT[1]; x++) samples.push(x);
  // the rebuilt edge: the samples themselves, and across each gap a cubic Hermite whose end slopes come from a
  // straight-line fit to the six samples beside each end
  const slopeAt = (xs) => { const n = xs.length, mx = xs.reduce((s, x) => s + x, 0) / n, my = xs.reduce((s, x) => s + top[x], 0) / n; let num = 0, den = 0; for (const x of xs) { num += (x - mx) * (top[x] - my); den += (x - mx) * (x - mx); } return den ? num / den : 0; };
  const curve = {}, gaps = [];
  for (let i = 0; i + 1 < samples.length; i++) {
    const a = samples[i], b = samples[i + 1];
    if (b - a <= 1) continue;
    const left = samples.slice(Math.max(0, i - 5), i + 1), right = samples.slice(i + 1, i + 7);
    const m0 = slopeAt(left), m1 = slopeAt(right), y0 = top[a], y1 = top[b], d = b - a;
    for (let x = a + 1; x < b; x++) {
      const t = (x - a) / d, t2 = t * t, t3 = t2 * t;
      curve[x] = { y: (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * d * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * d * m1,
                   s: ((6 * t2 - 6 * t) * y0 + (3 * t2 - 4 * t + 1) * d * m0 + (-6 * t2 + 6 * t) * y1 + (3 * t2 - 2 * t) * d * m1) / d };
    }
    gaps.push([a + 1, b - 1]);
  }
  // the outline: its colour and its thickness across the line, measured on the clean arc
  const thick = [], ink = [];
  for (const x of samples) {
    if (x < MID[0]) continue;
    const y0 = Math.ceil(top[x]); let y = y0; while (y < H && Lum(x, y) < 70) { if (y - y0 >= 3 && y - y0 <= 6) { const o = (y * W + x) * 4; ink.push([px[o], px[o + 1], px[o + 2]]); } y++; }
    const s = x > 1 && x < W - 1 ? (top[x + 1] - top[x - 1]) / 2 : 0;
    thick.push((y - top[x]) / Math.sqrt(1 + s * s));
  }
  const med = (a) => { const b = [...a].sort((p, q) => p - q); return b[b.length >> 1]; };
  const T = med(thick), INK = [0, 1, 2].map((k) => Math.round(med(ink.map((c) => c[k]))));
  // the band's thickness across the line at a clean column (the dark run under the edge, tilted by the local slope)
  const runAt = (x) => { const y0 = Math.ceil(top[x]); let y = y0; while (y < H && Lum(x, y) < 70) y++; const s = (top[x + 2] - top[x - 2]) / 4; return (y - top[x]) / Math.sqrt(1 + s * s); };
  const endT = (xs) => med(xs.map(runAt));
  let cleared = 0, painted = 0, roots = 0;
  // 1 + 2: above the rebuilt edge goes; under it, the band is outline
  // stray antenna ink beside a gap (the faint anti-aliased tip of an antenna overhanging a clean column) goes too
  for (const [g0, g1] of gaps) for (let x = g0 - 8; x <= g1 + 8; x++) { if (curve[x]) continue; for (let y = 0; y < Math.floor(top[x]) - 1; y++) if (A(x, y) > 0) { set(x, y, 0, 0, 0, 0); cleared++; } }
  // the head is round: fit a circle to its outline's inner edge (the dark run's end) on the clean arc - that is the
  // line under which everything is head fill, including under the antennas and across the body junction
  const fitCircle = (pts) => {   // Kasa: x^2 + y^2 + D x + E y + F = 0, least squares
    const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], R = [0, 0, 0];
    for (const [x, y] of pts) { const v = [x, y, 1], z = -(x * x + y * y); for (let i = 0; i < 3; i++) { R[i] += v[i] * z; for (let j = 0; j < 3; j++) S[i][j] += v[i] * v[j]; } }
    const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const d = det(S), sol = [0, 1, 2].map((k) => det(S.map((row, i) => row.map((v, j) => (j === k ? R[i] : v)))) / d);
    const cx = -sol[0] / 2, cy = -sol[1] / 2; return { cx, cy, r: Math.sqrt(cx * cx + cy * cy - sol[2]) };
  };
  const innerPts = [];
  for (const x of samples) { if (x < MID[0] || x > 590) continue; let y = Math.ceil(top[x]); while (y < H && Lum(x, y) < 70) y++; if (y - top[x] < 26) innerPts.push([x, y - 0.5]); }   // (past x 590 the arc turns steep and a column runs down the outline)
  const head = fitCircle(innerPts);
  const headIn = (x) => { const d = head.r * head.r - (x - head.cx) * (x - head.cx); return d > 0 ? head.cy - Math.sqrt(d) : Infinity; };
  const fitErr = Math.max(...innerPts.map(([x, y]) => Math.abs(headIn(x) - y)));
  const bandT = {};
  for (const [g0, g1] of gaps) { const t0 = endT([g0 - 3, g0 - 2, g0 - 1]), t1 = endT([g1 + 1, g1 + 2, g1 + 3]); for (let x = g0; x <= g1; x++) bandT[x] = t0 + (t1 - t0) * (x - g0 + 1) / (g1 - g0 + 2); }
  for (const [g0, g1] of gaps) for (let x = g0; x <= g1; x++) {
    const { y: e, s } = curve[x], ye = Math.floor(e);
    let yi = e + bandT[x] * Math.sqrt(1 + s * s);
    if (headIn(x) - e < bandT[x] * 2.2 && headIn(x) > yi) yi = headIn(x);   // over the head (not over the body's own fill): outline down to the head fill
    for (let y = 0; y < ye; y++) if (A(x, y) > 0) { set(x, y, 0, 0, 0, 0); cleared++; }
    set(x, ye, INK[0], INK[1], INK[2], Math.round(255 * (1 - (e - ye))));
    for (let y = ye + 1; y < Math.floor(yi); y++) { set(x, y, INK[0], INK[1], INK[2], 255); painted++; }
    const yl = Math.floor(yi), f = 1 - (yi - yl), o = (yl * W + x) * 4;   // the band's inner rim, blended onto what is below it
    for (let k = 0; k < 3; k++) px[o + k] = Math.round(INK[k] * f + px[o + k] * (1 - f));
  }
  return { T: +T.toFixed(2), INK, cleared, painted, gaps, curve, head: { cx: +head.cx.toFixed(1), cy: +head.cy.toFixed(1), r: +head.r.toFixed(1), err: +fitErr.toFixed(2) }, fixRoots: (boxes) => {
    // 3: each root is the dark ink in its box below the band, plus a one-pixel ring (its anti-aliased rim). It is
    // filled by diffusion from the pixels around it that are head fill - never from the outline - so the cream
    // highlight closes over it smoothly. The band's own inner rim is left to the band.
    const below = (x, y) => y > headIn(x) + 1;   // inside the head, clear of its outline
    for (const [x0, x1, yMax] of boxes) {
      const inBox = (x, y) => x >= x0 && x <= x1 && y <= yMax && below(x, y);
      const mask = new Set(), key = (x, y) => y * W + x;
      for (let y = 0; y <= yMax; y++) for (let x = x0; x <= x1; x++) if (inBox(x, y) && Lum(x, y) < 150) mask.add(key(x, y));
      for (const k of [...mask]) { const x = k % W, y = (k / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inBox(x + dx, y + dy)) mask.add(key(x + dx, y + dy)); }
      const ok = (x, y) => !mask.has(key(x, y)) && A(x, y) === 255 && Lum(x, y) >= 110 && y > headIn(x) + 1;
      const cells = [...mask].map((k) => ({ x: k % W, y: (k / W) | 0, c: null }));
      // onion peel: seed each cell from its valid neighbours, outside in; then relax
      let pending = cells.slice();
      for (let pass = 0; pass < 60 && pending.length; pass++) {
        const next = [];
        for (const cell of pending) {
          let n = 0; const acc = [0, 0, 0];
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
            const xx = cell.x + dx, yy = cell.y + dy, o = (yy * W + xx) * 4;
            const nb = mask.has(key(xx, yy)) ? cells.find((q) => q.x === xx && q.y === yy) : null;
            if (nb ? nb.c : ok(xx, yy)) { const c = nb ? nb.c : [px[o], px[o + 1], px[o + 2]]; for (let k = 0; k < 3; k++) acc[k] += c[k]; n++; }
          }
          if (n) cell.nc = acc.map((v) => v / n); else next.push(cell);
        }
        for (const cell of pending) if (cell.nc) { cell.c = cell.nc; delete cell.nc; }
        pending = next;
      }
      const at = new Map(cells.map((c) => [key(c.x, c.y), c]));
      for (let it = 0; it < 200; it++) for (const cell of cells) {
        let n = 0; const acc = [0, 0, 0];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = cell.x + dx, yy = cell.y + dy, nb = at.get(key(xx, yy)), o = (yy * W + xx) * 4;
          if (nb && nb.c) { for (let k = 0; k < 3; k++) acc[k] += nb.c[k]; n++; } else if (!nb && ok(xx, yy)) { acc[0] += px[o]; acc[1] += px[o + 1]; acc[2] += px[o + 2]; n++; }
        }
        if (n) cell.c = acc.map((v) => v / n);
      }
      for (const cell of cells) if (cell.c) { set(cell.x, cell.y, Math.round(cell.c[0]), Math.round(cell.c[1]), Math.round(cell.c[2]), 255); roots++; }
    }
    return roots;
  } };
}

let changed = 0;
for (const [rel, cfg] of Object.entries(FRAMES)) {
  const F = path.join(ROOT, rel), raw = readFileSync(F), h = sha(raw);
  if (!OUT && h === cfg.out) { console.log(rel + ': already fixed'); continue; }
  if (h !== cfg.src && !process.argv.includes('--measure')) { console.error('ABORT ' + rel + ': not the frame this fix was measured on (sha256 ' + h.slice(0, 16) + ')'); process.exit(1); }
  const { data, info } = await sharp(raw).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const r = fix(data, info.width, info.height);
  const roots = r.fixRoots(cfg.roots);
  const webp = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 92, alphaQuality: 100, effort: 6 }).toBuffer();
  const dst = OUT ? path.join(OUT, path.basename(rel)) : F;
  if (OUT) mkdirSync(OUT, { recursive: true });
  writeFileSync(dst + '.tmp', webp); renameSync(dst + '.tmp', dst);
  console.log(rel + ': ' + r.cleared + ' antenna px cleared, ' + r.painted + ' outline px repainted (band ' + r.T + ' px, ink ' + r.INK + '), ' + roots + ' root px repainted, gaps ' + JSON.stringify(r.gaps) + ', head circle ' + JSON.stringify(r.head) + ' -> ' + dst + '  sha256 ' + sha(webp));
  changed++;
}
console.log(changed ? 'fixed ' + changed + ' frame(s)' : 'nothing to do');
