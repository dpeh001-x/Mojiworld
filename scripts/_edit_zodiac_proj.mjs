// Deterministic edits to zodiac projectile sprites (all frames + base), per the
// review mark-up. Identical transform per frame keeps the 9-frame animation
// consistent. Ops:
//   removeShadow — drop the detached ground-shadow blob via connected-component
//                  keep-largest (shadow sits below the object with a transparent gap).
//   pointRight   — rotate by a FIXED angle (measured once on frame 0) so the tip
//                  faces +x (canonical for orient-mode; requested for spin too).
//   flipX        — horizontal mirror.
// Dry run writes to scripts/_fx_preview/; --apply writes in place (atomic tmp+rename).
import sharp from 'sharp';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const R = (p) => join(root, p);
const APPLY = process.argv.includes('--apply');
const PREV = R('scripts/_fx_preview');
if (!APPLY && !existsSync(PREV)) mkdirSync(PREV, { recursive: true });

const KEYFILTER = (process.env.KEYS || '').split(',').filter(Boolean);
const JOBS = [
  { key: 'gemini_shard', base: 'p_gemini_shard.png', ops: { removeShadow: true, pointRight: true } },
  { key: 'icePillar',    base: 'p_icepillar.png',    ops: { pointRight: true } },   // shadow removed via ludo first
  { key: 'cancerBubble', base: 'p_cancerbubble.png', ops: { removeShadow: true } },
  { key: 'zodiac',       base: 'p_zodiacbolt.png',   ops: { flipX: true } },
].filter(j => !KEYFILTER.length || KEYFILTER.includes(j.key));

// --- shadow removal by OUTLINE ENCLOSURE. The crystals/bubble carry a dark
// navy outline; the baked drop-shadow has none. Flood the exterior from the
// borders through every non-outline pixel; anything the flood can't reach is
// enclosed by the outline (the object). Clear exterior non-outline pixels —
// that's the shadow (and any detached sparkle debris, acceptable). ---
function removeShadow(data, w, h) {
  const N = w * h;
  const rawOutline = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
    if (a > 110 && r < 82 && g < 82 && b < 108) rawOutline[i] = 1;   // dark navy 2px outline
  }
  // Dilate the outline into a CLOSED barrier (radius R) so flood can't leak
  // through gaps in a shattered outline (e.g. the ice crystal). The barrier is
  // only used to stop the flood; kept pixels use their original color.
  const RAD = 3;
  const barrier = new Uint8Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!rawOutline[y * w + x]) continue;
    for (let dy = -RAD; dy <= RAD; dy++) for (let dx = -RAD; dx <= RAD; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && dx * dx + dy * dy <= RAD * RAD) barrier[ny * w + nx] = 1;
    }
  }
  const isOutline = (i) => barrier[i] === 1;
  const ext = new Uint8Array(N);
  const st = new Int32Array(N); let sp = 0;
  const seed = (p) => { if (!ext[p] && !isOutline(p)) { ext[p] = 1; st[sp++] = p; } };
  for (let x = 0; x < w; x++) { seed(x); seed(x + (h - 1) * w); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (sp > 0) {
    const p = st[--sp], x = p % w, y = (p / w) | 0;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (y > 0) seed(p - w);
    if (y < h - 1) seed(p + w);
  }
  for (let p = 0; p < N; p++) {
    if (ext[p] && !isOutline(p)) { data[p * 4] = 0; data[p * 4 + 1] = 0; data[p * 4 + 2] = 0; data[p * 4 + 3] = 0; }
  }
  return data;
}

// tip via PCA: principal axis of the opaque mass, then the NARROWER extremal
// end (the pointy tip has less perpendicular spread than the broad end).
async function tipAngle(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const pts = [];
  let cx = 0, cy = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 120) { pts.push(x, y); cx += x; cy += y; }
  }
  const n = pts.length / 2; cx /= n; cy /= n;
  let sxx = 0, syy = 0, sxy = 0;
  for (let k = 0; k < pts.length; k += 2) { const dx = pts[k] - cx, dy = pts[k + 1] - cy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  // principal eigenvector of [[sxx,sxy],[sxy,syy]]
  const tr = sxx + syy, det = sxx * syy - sxy * sxy;
  const l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det));
  let ax = sxy, ay = l1 - sxx;
  if (Math.abs(ax) < 1e-6 && Math.abs(ay) < 1e-6) { ax = 1; ay = 0; }
  const al = Math.hypot(ax, ay); ax /= al; ay /= al;
  // project onto axis; gather perpendicular spread near each extreme
  let pMin = 1e9, pMax = -1e9;
  for (let k = 0; k < pts.length; k += 2) { const t = (pts[k] - cx) * ax + (pts[k + 1] - cy) * ay; if (t < pMin) pMin = t; if (t > pMax) pMax = t; }
  const band = (pMax - pMin) * 0.22;
  let wMinSum = 0, wMinN = 0, wMaxSum = 0, wMaxN = 0;
  for (let k = 0; k < pts.length; k += 2) {
    const dx = pts[k] - cx, dy = pts[k + 1] - cy;
    const t = dx * ax + dy * ay, perp = Math.abs(-dx * ay + dy * ax);
    if (t <= pMin + band) { wMinSum += perp; wMinN++; }
    if (t >= pMax - band) { wMaxSum += perp; wMaxN++; }
  }
  const wMin = wMinSum / Math.max(1, wMinN), wMax = wMaxSum / Math.max(1, wMaxN);
  // tip = narrower end
  const sgn = (wMax <= wMin) ? 1 : -1;
  const tx = cx + ax * sgn, ty = cy + ay * sgn;
  return Math.atan2(ty - cy, tx - cx) * 180 / Math.PI;
}

async function processBuf(buf, ops, rotDeg, W, H) {
  let img = sharp(buf).ensureAlpha();
  if (ops.removeShadow) {
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    removeShadow(data, info.width, info.height);
    img = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
  }
  if (ops.flipX) img = img.flop();
  if (ops.pointRight) {
    const trimmed = await img.trim({ threshold: 8 }).png().toBuffer();
    img = sharp(trimmed).rotate(rotDeg, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
  }
  // normalize back to the original square canvas, centered
  const out = await img.trim({ threshold: 8 }).png().toBuffer();
  const m = await sharp(out).metadata();
  const scale = Math.min(1, (W * 0.94) / m.width, (H * 0.94) / m.height);
  const rw = Math.max(1, Math.round(m.width * scale)), rh = Math.max(1, Math.round(m.height * scale));
  const resized = await sharp(out).resize(rw, rh, { fit: 'fill' }).toBuffer();
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, gravity: 'center' }]);
}

for (const job of JOBS) {
  const frame0 = R('Sprites/projectiles/anim/' + job.key + '_0.webp');
  const meta = await sharp(frame0).metadata();
  const W = meta.width, H = meta.height;
  let rotDeg = 0;
  if (job.ops.pointRight) {
    // measure tip on frame 0 AFTER shadow removal, rotate so tip -> 0deg (right)
    let b0 = readFileSync(frame0);
    if (job.ops.removeShadow) {
      const { data, info } = await sharp(b0).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      removeShadow(data, info.width, info.height);
      b0 = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
    }
    const a = await tipAngle(b0);
    rotDeg = -a;                          // sharp rotate is CW-positive; -a brings tip to 0deg
    console.log(job.key + ': tip at ' + a.toFixed(1) + 'deg -> rotate ' + rotDeg.toFixed(1) + 'deg');
  }
  // all 9 frames (webp) + base (png)
  for (let i = 0; i < 9; i++) {
    const src = R('Sprites/projectiles/anim/' + job.key + '_' + i + '.webp');
    const pipe = await processBuf(readFileSync(src), job.ops, rotDeg, W, H);
    const dst = APPLY ? src : join(PREV, job.key + '_' + i + '.webp');
    const tmp = dst + '.tmp';
    await pipe.webp({ quality: 92 }).toFile(tmp); renameSync(tmp, dst);
  }
  const bsrc = R('Sprites/projectiles/' + job.base);
  const bmeta = await sharp(bsrc).metadata();
  const bpipe = await processBuf(readFileSync(bsrc), job.ops, rotDeg, bmeta.width, bmeta.height);
  const bdst = APPLY ? bsrc : join(PREV, job.base);
  const btmp = bdst + '.tmp';
  await bpipe.png().toFile(btmp); renameSync(btmp, bdst);
  console.log(job.key + ': ' + (APPLY ? 'APPLIED' : 'preview') + ' 9 frames + base');
}
console.log(APPLY ? '\nDone (in place).' : '\nPreview in scripts/_fx_preview/ — verify, then --apply.');
