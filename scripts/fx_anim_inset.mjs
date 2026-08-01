#!/usr/bin/env node
// v0.29.392 — Guarantee an FX animation's frames never touch the canvas edge.
//
//   node scripts/fx_anim_inset.mjs <key> [<key>...] [--margin 0.90] [--check]
//
// Ludo's animate pass reframes each roll differently: the same effect came back
// clean at PAD 0.12 and bleeding at 0.22 (and vice-versa for its neighbour), so
// tuning the pad and re-rolling is a coin flip. This does it deterministically.
//
// The important part is that the fix is UNIFORM across the set. Trimming each
// frame independently would re-seat every frame on its own bounding box and the
// effect would jitter as it played. Instead: measure the UNION bbox of all 9
// frames, derive ONE scale factor from it, and apply that same centre-scale to
// every frame — relative motion is preserved exactly, only the whole animation
// shrinks slightly into its margin.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANIM = path.join(ROOT, 'Sprites', 'fx', 'anim');
const argv = process.argv.slice(2);
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const MARGIN = Number(arg('--margin', 0.90));      // content occupies at most this fraction
// v0.29.398 — --feather <frac>: ramp alpha to zero across the outer <frac> of
// the canvas. Insetting alone is NOT enough when the model already drew to its
// own canvas edge: the hard clip line is baked into the pixels, so scaling just
// moves a straight cut inward, which reads as a squarish chop (exactly what
// shinobi_seal's dark aura did — a 318px hard horizontal edge at y=616).
// Feathering turns any such cut into a fade.
const FEATHER = Number(arg('--feather', 0));
const CHECK = argv.includes('--check');
// Skip flag VALUES by index, not by string-compare: `--margin 0.90` stringifies
// to "0.9", so comparing values treated the literal "0.90" as a sprite key and
// the run aborted with "missing frame 0" after doing its work.
const valueIdx = new Set();
for (const f of ['--margin', '--feather']) { const i = argv.indexOf(f); if (i >= 0) valueIdx.add(i + 1); }
const keys = argv.filter((a, i) => !a.startsWith('--') && !valueIdx.has(i));

const ALPHA_MIN = 8;   // treat below this as empty

async function frameInfo(file) {
  const { data, info } = await sharp(fs.readFileSync(file)).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height, C: info.channels };
}
function bbox({ data, W, H, C }) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * C + 3] < ALPHA_MIN) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return (x1 < 0) ? null : { x0, y0, x1, y1 };
}
function edgeMax({ data, W, H, C }) {
  const A = (x, y) => data[(y * W + x) * C + 3];
  let m = 0;
  for (let x = 0; x < W; x++) m = Math.max(m, A(x, 0), A(x, H - 1));
  for (let y = 0; y < H; y++) m = Math.max(m, A(0, y), A(W - 1, y));
  return m;
}

let failed = 0;
for (const key of keys) {
  const files = [];
  for (let i = 0; i < 9; i++) {
    const f = path.join(ANIM, `${key}_${i}.webp`);
    if (!fs.existsSync(f)) { console.error(`ABORT ${key}: missing frame ${i}`); process.exit(1); }
    files.push(f);
  }
  const infos = [];
  for (const f of files) infos.push(await frameInfo(f));
  const W = infos[0].W, H = infos[0].H;
  if (infos.some(i => i.W !== W || i.H !== H)) { console.error(`ABORT ${key}: frames differ in size`); process.exit(1); }

  const before = Math.max(...infos.map(edgeMax));
  // Union bbox across the whole set — the animation's true extent.
  let U = null;
  for (const inf of infos) {
    const b = bbox(inf);
    if (!b) continue;
    U = U ? { x0: Math.min(U.x0, b.x0), y0: Math.min(U.y0, b.y0),
              x1: Math.max(U.x1, b.x1), y1: Math.max(U.y1, b.y1) } : b;
  }
  if (!U) { console.error(`ABORT ${key}: all frames empty`); process.exit(1); }

  // Scale needed so the union fits inside MARGIN of the canvas, measured from
  // the canvas CENTRE (that is the anchor a uniform centre-scale rotates about).
  const halfW = Math.max(U.x1 - W / 2, W / 2 - U.x0);
  const halfH = Math.max(U.y1 - H / 2, H / 2 - U.y0);
  const need = Math.max(halfW / (W / 2), halfH / (H / 2));
  const scale = Math.min(1, MARGIN / need);

  if (CHECK) {
    console.log(`${key.padEnd(20)} edge=${String(before).padStart(3)}  union=${need.toFixed(3)}  wouldScale=${scale.toFixed(3)}`);
    if (before > 25) failed++;
    continue;
  }
  if (scale >= 0.999 && !FEATHER) { console.log(`${key.padEnd(20)} already clear (edge=${before}) — untouched`); continue; }

  const iw = Math.max(1, Math.round(W * scale)), ih = Math.max(1, Math.round(H * scale));
  for (const f of files) {
    const src = fs.readFileSync(f);
    let buf;
    if (scale < 0.999) {
      const inner = await sharp(src).resize(iw, ih, { fit: 'fill' }).png().toBuffer();
      buf = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: inner, gravity: 'center' }]).png().toBuffer();
    } else {
      buf = await sharp(src).png().toBuffer();
    }
    if (FEATHER > 0) {
      // Multiply alpha by a per-axis ramp over the outer FEATHER fraction, so
      // a straight cut near the border fades out instead of ending flat.
      const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const w = info.width, h = info.height, c = info.channels;
      const fx = Math.max(1, Math.round(w * FEATHER)), fy = Math.max(1, Math.round(h * FEATHER));
      const ramp = (d, n) => Math.max(0, Math.min(1, d / n));
      for (let y = 0; y < h; y++) {
        const ky = Math.min(ramp(y, fy), ramp(h - 1 - y, fy));
        for (let x = 0; x < w; x++) {
          const kx = Math.min(ramp(x, fx), ramp(w - 1 - x, fx));
          const k = Math.min(kx, ky);
          if (k >= 1) continue;
          const i = (y * w + x) * c + 3;
          data[i] = Math.round(data[i] * k);
        }
      }
      buf = await sharp(data, { raw: { width: w, height: h, channels: c } }).png().toBuffer();
    }
    fs.writeFileSync(f, await sharp(buf).webp({ quality: 90 }).toBuffer());
  }
  const after = Math.max(...await Promise.all(files.map(async f => edgeMax(await frameInfo(f)))));
  console.log(`${key.padEnd(20)} edge ${before} -> ${after}  (scaled ${scale.toFixed(3)}, uniform across 9 frames)`);
  if (after > 25) failed++;
}
process.exit(failed ? 1 : 0);
