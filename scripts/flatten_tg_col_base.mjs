// FLAT SIDE-VIEW BASES for the column-strike warning pillars (Sprites/fx/tg_col_*.webp).
//
// Per user: "the bottom of the warning pillar can look more flat 2d, the current angle looks wrong for a side
// scroller". Every warning was drawn standing in a rune ring seen from above at three-quarters - an ellipse 60-86 px
// tall under a 512 px pillar - while the world around it is a flat side view. Asking ludo for a side-view base gave
// flat bands but plain stripe pillars (the pedestals, bones, crowns and motes all went), so this keeps the approved
// art and redraws only the base, the way an orthographic side view would see it:
//   - the pillar and its pedestal are kept down to the ring's widest row (its centre line - the ground plane), which
//     cuts the pedestal's curved 3/4 bottom edge into a straight one, and the ring's back arc beside the pedestal is
//     removed;
//   - the ring's FRONT half is squashed into a thin band (BAND of the frame height) across the full width - a disc
//     seen edge-on - so the pillar stands on a flat strip of its own rune light that still marks the danger footprint.
// The result is re-fit to the frame. A file whose base is already flat (no wide ring in its bottom 40%) is skipped,
// so a re-run is a no-op.
//   node scripts/flatten_tg_col_base.mjs [--out <dir>] [--check] [tg_col_a.webp ...]
import { readdir, readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'fx');
const BAND = 0.036;   // band height, fraction of the frame
const A = 40;         // alpha that counts as drawn
const argv = process.argv.slice(2);
const opt = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const outDir = opt('--out'), check = argv.includes('--check');
const named = argv.filter((a, i) => /\.webp$/.test(a) && argv[i - 1] !== '--out');

// per row: [left, right] of the drawn pixels, or null
function extents(px, W, H) {
  const r = [];
  for (let y = 0; y < H; y++) {
    let l = -1, rt = -1;
    for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3] > A) { if (l < 0) l = x; rt = x; }
    r.push(l < 0 ? null : [l, rt]);
  }
  return r;
}
const wid = (e) => (e ? e[1] - e[0] + 1 : 0);

// the ring: the first row of the bottom 40% drawn at least half the frame wide. Returns null when there is none.
export function findRing(px, W, H) {
  const ex = extents(px, W, H);
  let y0 = -1;
  for (let y = Math.floor(H * 0.6); y < H; y++) if (wid(ex[y]) >= W * 0.5) { y0 = y; break; }
  if (y0 < 0) return null;
  let yB = H - 1; while (yB > y0 && !ex[yB]) yB--;
  // centre line = the middle of the widest plateau (within 1.5% of the max width)
  let mx = 0; for (let y = y0; y <= yB; y++) mx = Math.max(mx, wid(ex[y]));
  const plateau = []; for (let y = y0; y <= yB; y++) if (wid(ex[y]) >= mx * 0.985) plateau.push(y);
  const yC = plateau[Math.floor(plateau.length / 2)];
  return { ex, y0, yC, yB, depth: yB - y0 };
}

export async function flatten(buf) {
  const { data: px, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const ring = findRing(px, W, H);
  // a 3/4 ring has a deep FRONT half below its widest row (24-52 px of 512 across the seventeen); a flat band has
  // next to none (1-9 px). Depth alone is not enough: a wide pedestal above the band reads as a deep "ring".
  if (!ring || ring.yB - ring.yC < H * 0.03) return { skipped: true, W, H, ring };
  const { ex, y0, yC, yB } = ring;
  // the pedestal's span: the widest drawn row a little above the ring (the ring's back arc starts at y0)
  let pl = W, pr = 0;
  for (let y = Math.max(0, y0 - 24); y < y0 - 10; y++) if (ex[y]) { pl = Math.min(pl, ex[y][0]); pr = Math.max(pr, ex[y][1]); }
  if (pl >= pr) { pl = 0; pr = W - 1; }
  pl = Math.max(0, pl - 3); pr = Math.min(W - 1, pr + 3);
  // upper layer: rows [0, yC), the ring's back arc removed beside the pedestal
  const up = Buffer.from(px.subarray(0, yC * W * 4));
  for (let y = Math.max(0, y0 - 10); y < yC; y++) for (let x = 0; x < W; x++) if (x < pl || x > pr) up[(y * W + x) * 4 + 3] = 0;
  // band: the ring's front rim UNROLLED - in every column, the T rows up from the ring's bottom edge - so the rune band
  // comes out straight with a flat top and a flat bottom on the floor (a plain vertical squash left a curved saucer
  // underside whose ends floated above the floor)
  const bh = Math.max(8, Math.round(H * BAND));
  const T = Math.max(4, Math.round((yB - yC) * 0.45));
  const rim = Buffer.alloc(W * T * 4);
  for (let x = 0; x < W; x++) {
    let yb = -1;
    for (let y = yB; y >= yC; y--) if (px[(y * W + x) * 4 + 3] > A) { yb = y; break; }
    if (yb < 0) continue;
    for (let k = 0; k < T; k++) {
      const sy = yb - (T - 1) + k; if (sy < 0) continue;
      px.copy(rim, (k * W + x) * 4, (sy * W + x) * 4, (sy * W + x) * 4 + 4);
    }
  }
  const front = await sharp(rim, { raw: { width: W, height: T, channels: 4 } })
    .resize(W, bh, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer();
  const H2 = yC + bh + (H - 1 - yB);   // keeps the art's own bottom margin (the zodiac signs feather theirs clear)
  const out = Buffer.alloc(W * H2 * 4);
  up.copy(out, 0);
  front.copy(out, yC * W * 4);
  const img = await sharp(out, { raw: { width: W, height: H2, channels: 4 } })
    .resize(W, H, { fit: 'fill', kernel: 'lanczos3' }).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
  return { skipped: false, img, W, H, y0, yC, yB, bh, pedestal: [pl, pr] };
}

async function main() {
  const files = named.length ? named : (await readdir(DIR)).filter((n) => /^tg_col_.*\.webp$/.test(n)).sort();
  let bad = 0;
  for (const n of files) {
    const r = await flatten(await readFile(join(DIR, n)));
    if (check) { if (!r.skipped) { bad++; console.log(`RING  ${n}: a three-quarter ring, its front half ${r.yB - r.yC} px deep (rows ${r.yC}-${r.yB})`); } continue; }
    if (r.skipped) { console.log(`flat  ${n} (skipped)`); continue; }
    const dest = join(outDir || DIR, n);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest + '.tmp', r.img); await rename(dest + '.tmp', dest);
    console.log(`ok    ${n}: ring rows ${r.y0}-${r.yB} (centre ${r.yC}) -> ${r.bh} px band, pedestal x ${r.pedestal.join('-')}`);
  }
  if (check) { console.log(bad ? `${bad} warning(s) still stand in a 3/4 ring` : 'every warning base is flat'); process.exit(bad ? 1 : 0); }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
