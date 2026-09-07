#!/usr/bin/env node
// Talent icons (Sprites/talents/<id>.webp, 256x256 die-cut stickers): the white
// sticker rim was baked in by the art model and came out anywhere from 5 to 24 px
// thick, sometimes broken. This strips the baked rim and rebuilds it from the art's
// own silhouette at ONE thickness, anti-aliased, so every icon wears the same rim.
//
// How: the rim is the near-white pixels reachable from the transparent outside
// through near-white pixels (so a white detail inside the art is never touched),
// capped in depth per icon at 1.5x its measured rim so a white glow that happens
// to touch the rim cannot be eaten. What remains is the art. A Euclidean distance
// transform from the art then paints a fresh rim of --rim px with a 1 px soft edge.
//
//   node scripts/normalize_talent_rims.mjs --rim=10            # preview only (writes sheets to --out)
//   node scripts/normalize_talent_rims.mjs --rim=10 --write    # rewrite the icons in place
//   flags: --only=a,b  --out=DIR (default scripts/_tmp_rims)
import sharp from 'sharp';
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'talents');
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const RIM = Number(arg('rim', 10)), WRITE = argv.includes('--write'), OUT = arg('out', join(repoRoot, 'scripts', '_tmp_rims'));
const only = (arg('only', '') || '').split(',').filter(Boolean);
const BIG = (arg('big', 'archon,benediction,bloodrush,bulwark,crusade,cutthroat,darkpact,deadeye') || '').split(',').filter(Boolean);   // the source-size sheet: 8 icons
const WHITE = 190, ALPHA = 40;

// exact Euclidean distance transform (Felzenszwalb & Huttenlocher), squared distances to the nearest "on" pixel
function edt(on, W, H) {
  const INF = 1e12; const f = new Float64Array(Math.max(W, H)), d = new Float64Array(Math.max(W, H)), v = new Int32Array(Math.max(W, H)), z = new Float64Array(Math.max(W, H) + 1);
  const g = new Float64Array(W * H);
  const dt1 = (n) => { let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF; for (let q = 1; q < n; q++) { let s; while (true) { s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); if (s <= z[k]) k--; else break; } k++; v[k] = q; z[k] = s; z[k + 1] = INF; } k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; } };
  for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) f[y] = on[y * W + x] ? 0 : INF; dt1(H); for (let y = 0; y < H; y++) g[y * W + x] = d[y]; }
  const out = new Float64Array(W * H);
  for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) f[x] = g[y * W + x]; dt1(W); for (let x = 0; x < W; x++) out[y * W + x] = d[x]; }
  return out;
}
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function flood(seedTest, passTest, W, H) {   // BFS over passTest pixels from seedTest pixels
  const m = new Uint8Array(W * H); const q = [];
  for (let i = 0; i < W * H; i++) if (seedTest(i)) { m[i] = 1; q.push(i); }
  for (let qi = 0; qi < q.length; qi++) { const i = q[qi], x = i % W, y = (i / W) | 0; for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (!m[j] && passTest(j)) { m[j] = 1; q.push(j); } } }
  return m;
}
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function components(mask, W, H) {   // 8-connected components: label array + sizes
  const lab = new Int32Array(W * H); const sizes = [0]; let n = 0;
  for (let s = 0; s < W * H; s++) { if (!mask[s] || lab[s]) continue; n++; lab[s] = n; const q = [s]; let sz = 0;
    for (let qi = 0; qi < q.length; qi++) { const i = q[qi]; sz++; const x = i % W, y = (i / W) | 0; for (const [dx, dy] of N8) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (mask[j] && !lab[j]) { lab[j] = n; q.push(j); } } }
    sizes.push(sz); }
  return { lab, sizes };
}
export async function analyse(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  // A: anything visible (for the outside flood); S: SOLID pixels (the fringe of anti-aliasing is neither art nor rim)
  const A = new Uint8Array(N), S = new Uint8Array(N);
  for (let i = 0; i < N; i++) { const a = data[i * 4 + 3]; A[i] = a > ALPHA ? 1 : 0; S[i] = a >= 128 ? 1 : 0; }
  const border = (i) => { const x = i % W, y = (i / W) | 0; return x === 0 || y === 0 || x === W - 1 || y === H - 1; };
  const out = flood((i) => !A[i] && border(i), (j) => !A[j], W, H);
  const dOut = edt(out, W, H);
  const nearOut = (i, r) => Math.sqrt(dOut[i]) <= r;
  // "rim-white": strictly white by default; when an icon has no white band at all (its baked rim is a light GREY,
  // like Cursework's), fall back to light achromatic pixels. The strict pass decides, so a steel shield's grey is never
  // mistaken for rim on an icon that has a real white band.
  const mask = (loose) => { const M = new Uint8Array(N); for (let i = 0; i < N; i++) { if (!S[i]) continue; const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], mn = Math.min(r, g, b), mx = Math.max(r, g, b); M[i] = loose ? (mn >= 120 && mx - mn <= 40 ? 1 : 0) : (mn >= WHITE ? 1 : 0); } return M; };
  const band = (Wm) => { const NW = new Uint8Array(N); for (let i = 0; i < N; i++) NW[i] = (S[i] && !Wm[i]) ? 1 : 0; const dArt = edt(NW, W, H);
    const depths = []; for (let i = 0; i < N; i++) if (S[i] && dOut[i] <= 1) depths.push(Math.sqrt(dArt[i]));   // the baked rim's depth at each outer perimeter pixel
    depths.sort((a, b) => a - b); const per = depths.length; return { NW, dArt, per, thick: per ? depths[per >> 1] : 0, p10: per ? depths[Math.floor(per * 0.1)] : 0 }; };   // the median: streaks and glows do not skew it
  // grey mode when the rim is grey or part-grey: the grey band is modestly deeper than the white one (a rim's worth,
  // never a steel body's - the art's own black outline stops the grey band on a shield at the same depth as the white)
  let Wh = mask(false), st = band(Wh), greyMode = false;
  { const Wg = mask(true), sg = band(Wg); if (sg.thick <= 20 && sg.thick >= st.thick + 2) { Wh = Wg; st = sg; greyMode = true; } }
  const { NW, dArt, per, thick, p10 } = st;
  const rimAll = flood((i) => Wh[i] && dOut[i] <= 2, (j) => Wh[j], W, H);   // rim-white reachable from the outside through rim-white (seeds: the outermost solid pixels)
  // strip depth: the median band plus two pixels, measured from the outside. Tight on purpose - a white streak that
  // protrudes through the rim loses only its outermost two pixels; a thick pocket of rim between two lobes keeps its
  // deeper white, which only rounds the sticker the way a real die-cut does, and never leaves an island outside the band.
  const cap = Math.min(30, Math.round(thick) + 2);
  const rimC = new Uint8Array(N); for (let i = 0; i < N; i++) if (rimAll[i] && nearOut(i, cap)) rimC[i] = 1;
  const { lab, sizes } = components(rimC, W, H); const touchesArt = new Uint8Array(sizes.length);
  for (let i = 0; i < N; i++) { if (!rimC[i]) continue; const x = i % W, y = (i / W) | 0; for (const [dx, dy] of N8) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (S[j] && !Wh[j]) { touchesArt[lab[i]] = 1; break; } } }
  const rim = new Uint8Array(N); for (let i = 0; i < N; i++) if (rimC[i] && touchesArt[lab[i]]) rim[i] = 1;
  // the art: solid and not rim; rim debris (specks of a few pixels sitting in the old rim band) is dropped
  const core0 = new Uint8Array(N); for (let i = 0; i < N; i++) core0[i] = (S[i] && !rim[i]) ? 1 : 0;
  // debris = a small piece that touches the transparent outside; a small piece enclosed by art is detail and stays
  const cc = components(core0, W, H); const drop = new Uint8Array(cc.sizes.length);
  for (let i = 0; i < N; i++) { const c = cc.lab[i]; if (c && cc.sizes[c] < 40 && nearOut(i, 1.5)) drop[c] = 1; }
  const core = new Uint8Array(N); let coreN = 0; for (let i = 0; i < N; i++) { core[i] = (core0[i] && !drop[cc.lab[i]]) ? 1 : 0; coreN += core[i]; }
  // holes: not solid and not outside-connected - pinholes and torn pixels inside the art (the "glitches"); the rebuild inpaints them
  const hole = new Uint8Array(N); let holeN = 0; for (let i = 0; i < N; i++) if (!S[i] && !out[i] && !rim[i] && !nearOut(i, cap + 1)) { hole[i] = 1; holeN++; }
  return { data, W, H, A, S, out, dOut, rim, core, hole, holeN, thick, p10, per, coreN, greyMode };
}
export async function rebuild(buf, rimPx) {
  const a = await analyse(buf); const { data, W, H, core, hole } = a; const N = W * H;
  // inpaint the holes from their neighbours (nearest art colour), a ring at a time; a hole too deep to reach stays as it was
  const fill = Buffer.from(data); const filled = new Uint8Array(core); let todo = 0; for (let i = 0; i < N; i++) if (hole[i]) todo++;
  for (let it = 0; it < 24 && todo > 0; it++) {
    const next = [];
    for (let i = 0; i < N; i++) { if (!hole[i] || filled[i]) continue; const x = i % W, y = (i / W) | 0; for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (filled[j]) { next.push([i, j]); break; } } }
    if (!next.length) break;
    for (const [i, j] of next) { fill[i * 4] = fill[j * 4]; fill[i * 4 + 1] = fill[j * 4 + 1]; fill[i * 4 + 2] = fill[j * 4 + 2]; fill[i * 4 + 3] = 255; filled[i] = 1; core[i] = 1; todo--; }
  }
  const dCore = edt(core, W, H); const outBuf = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    if (core[i]) { outBuf[o] = fill[o]; outBuf[o + 1] = fill[o + 1]; outBuf[o + 2] = fill[o + 2]; outBuf[o + 3] = 255; continue; }
    const t = Math.max(0, Math.min(1, rimPx + 0.5 - Math.sqrt(dCore[i])));   // 1 px soft edge
    outBuf[o] = 255; outBuf[o + 1] = 255; outBuf[o + 2] = 255; outBuf[o + 3] = Math.round(t * 255);
  }
  return { png: await sharp(outBuf, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer(), before: a };
}
// uniformity, measured geometrically on the rebuilt image: every art pixel sits at least RIM-0.5 px from
// transparency, and every solid white non-art pixel sits within RIM+0.5 px of the art
export async function uniformity(png, rimPx) {
  const a = await analyse(png); const { W, H, core, S, out, dOut, data } = a; const N = W * H;
  const dCore = edt(core, W, H); let thin = 0, thick = 0, artN = 0, rimN = 0;
  for (let i = 0; i < N; i++) {
    if (core[i]) { artN++; if (Math.sqrt(dOut[i]) < rimPx - 0.5) thin++; }
    else if (S[i] && data[i * 4] >= WHITE && data[i * 4 + 1] >= WHITE && data[i * 4 + 2] >= WHITE) { rimN++; if (Math.sqrt(dCore[i]) > rimPx + 0.5) thick++; }
  }
  return { artN, rimN, thin, thick };
}
// the tool body runs only when this file is the entry point; tests import analyse/rebuild/uniformity
const isMain = (() => { try { return import.meta.url === pathToFileURL(process.argv[1]).href; } catch { return false; } })();
const files = isMain ? readdirSync(DIR).filter((f) => /\.webp$/i.test(f) && !/starfield/.test(f) && (!only.length || only.includes(f.replace('.webp', '')))) : [];
if (isMain) mkdirSync(OUT, { recursive: true });
const rows = [], tiles = [], tilesBig = []; let k = 0;
for (const f of files) {
  const src = join(DIR, f); const buf = await sharp(src).toBuffer();
  const { png, before } = await rebuild(buf, RIM);
  const after = await analyse(png); const u = await uniformity(png, RIM);
  rows.push({ f, was: +before.thick.toFixed(1), now: +after.thick.toFixed(1), core: before.coreN, coreNow: after.coreN, u });
  if (u.thin > 3 || u.thick > 3) console.log(`  ${f}: rim not uniform - ${u.thin} art px under ${RIM - 0.5} px of rim, ${u.thick} white px past ${RIM + 0.5} px`);
  if (WRITE) writeFileSync(src, await sharp(png).webp({ quality: 95, alphaQuality: 100, effort: 5 }).toBuffer());
  if (k < 30) {   // preview: before | after, at the 52 px card size x4 and at source
    const bA = await sharp(buf).resize(52, 52).resize(156, 156, { kernel: 'nearest' }).png().toBuffer(), bB = await sharp(png).resize(52, 52).resize(156, 156, { kernel: 'nearest' }).png().toBuffer();
    tiles.push({ input: bA, left: (k % 5) * 330, top: Math.floor(k / 5) * 160 }, { input: bB, left: (k % 5) * 330 + 160, top: Math.floor(k / 5) * 160 });
  }
  const bi = BIG.indexOf(f.replace('.webp', ''));
  if (bi >= 0 && bi < 8) { tilesBig.push({ input: buf, left: (bi % 2) * 520, top: Math.floor(bi / 2) * 260 }, { input: png, left: (bi % 2) * 520 + 260, top: Math.floor(bi / 2) * 260 });
  }
  k++;
}
if (isMain) {
await sharp({ create: { width: 1650, height: 960, channels: 4, background: { r: 30, g: 34, b: 48, alpha: 1 } } }).composite(tiles).png().toFile(join(OUT, 'sheet_card52.png'));
await sharp({ create: { width: 1040, height: 1040, channels: 4, background: { r: 30, g: 34, b: 48, alpha: 1 } } }).composite(tilesBig).png().toFile(join(OUT, 'sheet_source.png'));
const now = rows.map((r) => r.now).sort((x, y) => x - y);
console.log(`${rows.length} icons, rim ${RIM} px: baked rim was ${rows.map((r) => r.was).sort((x, y) => x - y)[0]}..${rows.map((r) => r.was).sort((x, y) => x - y).pop()} px`);
console.log('art pixels changed by >1%: ' + (rows.filter((r) => Math.abs(r.coreNow - r.core) > r.core * 0.01).map((r) => `${r.f} ${r.core}->${r.coreNow}`).join('  ') || 'none'));
console.log((WRITE ? 'WROTE ' : 'preview only; ') + 'sheets -> ' + OUT);
}
