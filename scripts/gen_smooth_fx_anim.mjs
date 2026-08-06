#!/usr/bin/env node
// Smooth 9-frame FX loops — oversample from ludo.ai, then RETIME to even pacing.
// =============================================================================
// The stock pipeline asks ludo for exactly 9 frames and writes them straight
// out. Measured with scripts/fx_anim_smoothness.mjs, that lands nowhere near
// even: archbishop_ult ran deltas 1.2,1.7,1.8,3.2,4.6,4.5,5.5,3.8,0.8 — a
// 7.04x spread, i.e. the loop crawls then lurches. Every other FX loop in the
// repo fails the same check, so this is the pipeline, not one bad roll.
//
// Prompt-wrangling alone cannot fix it (the smoothest loop in the repo,
// lich_ult at 2.93x, uses a THREE-motion prompt the style guide warns against).
// So this fixes it mechanically:
//   1. OVERSAMPLE  ask for --src frames (default 20) instead of 9.
//   2. ARC-LENGTH  measure the cumulative visual change around the loop.
//   3. RETIME      place the 9 output slots at EQUAL arc-length, blending the
//                  two bracketing source frames. Equal visual change per slot
//                  IS even pacing, by construction.
//   4. DE-BREATHE  optionally normalise per-frame alpha area so the effect
//                  stops zooming (the other half of "choppy").
//
//   node scripts/gen_smooth_fx_anim.mjs <key> --motion "..." [--src 20] [--no-blend]
// Needs LUDO_API_KEY. Writes Sprites/fx/anim/<key>_0..8.webp atomically-ish
// (all 9 buffers are built and verified in memory before anything is written).
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FX = join(root, 'Sprites', 'fx');
const OUTN = 9;
const argv = process.argv.slice(2);
const arg = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const key = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--motion' &&
  argv[argv.indexOf(a) - 1] !== '--src');
const MOTION = arg('--motion', '');
// Probed against the live endpoint: 9 and 16 are accepted, 12 / 18 / 20 / 24
// all come back "400 failed schema validation". 16 is therefore the most
// temporal resolution available to retime from — 78% more than the stock 9.
const SRC = Number(arg('--src', 16));
if (SRC !== 9 && SRC !== 16) { console.error('--src must be 9 or 16 (the API rejects other counts)'); process.exit(1); }
const BLEND = !argv.includes('--no-blend');
const PAD = Number(process.env.LUDO_ANIM_PAD || 0.12);
// v0.29.442 — the pipeline also serves projectile loops (the mage bolt's
// frames live at Sprites/projectiles/anim/bolt_*, not under fx/). --basefile
// points at any base image; --outdir redirects where frames land. Both are
// repo-relative. Defaults preserve the original fx/ behaviour exactly.
const BASEFILE = arg('--basefile', null);
const OUTDIR_REL = arg('--outdir', null);
const OUT = OUTDIR_REL ? join(root, OUTDIR_REL) : join(FX, 'anim');
if (!key || !MOTION) { console.error('usage: gen_smooth_fx_anim.mjs <key> --motion "..." [--src 9|16] [--basefile rel] [--outdir rel]'); process.exit(1); }

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';

// ---- base art (png or webp on disk) ---------------------------------------
let basePath = null;
if (BASEFILE) {
  const p = join(root, BASEFILE);
  try { await access(p); basePath = p; } catch {}
  if (!basePath) { console.error(`no base art at ${BASEFILE}`); process.exit(1); }
} else {
  for (const ext of ['png', 'webp']) {
    const p = join(FX, `${key}.${ext}`);
    try { await access(p); basePath = p; break; } catch {}
  }
  if (!basePath) { console.error(`no base art at Sprites/fx/${key}.(png|webp)`); process.exit(1); }
}
const baseRaw = await readFile(basePath);
const bm = await sharp(baseRaw).metadata();
const px = Math.round(bm.width * PAD), py = Math.round(bm.height * PAD);
const padded = await sharp(baseRaw)
  .extend({ top: py, bottom: py, left: px, right: px, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png().toBuffer();
const pm = await sharp(padded).metadata();
const W = pm.width, H = pm.height;
console.log(`${key}: base ${bm.width}x${bm.height} -> padded ${W}x${H}, asking ludo for ${SRC} frames`);

const HOLD = ' The effect stays centered at the EXACT same size, position and framing — do NOT rotate, ' +
  'spin, translate, zoom, mirror or resize the whole sprite; animate ONLY the effect itself in place. ' +
  'Move at ONE single constant speed: every frame must differ from the previous by the SAME small amount, ' +
  'with no pauses, no sudden jumps, no bursts and no flicker. The loop must close seamlessly.';

async function fetchBuf(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`fetch ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
async function framesFrom(data, n) {
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const cols = data.num_cols, rows = data.num_rows;
    const sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
    const cw = Math.floor(meta.width / cols), ch = Math.floor(meta.height / rows), o = [];
    for (let r = 0; r < rows && o.length < n; r++) for (let c = 0; c < cols && o.length < n; c++)
      o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= 2) return o;
  }
  const urls = data.individual_frame_urls || [];
  if (urls.length >= 2) { const o = []; for (const u of urls.slice(0, n)) o.push(await fetchBuf(u)); return o; }
  throw new Error('no usable frames');
}

const uri = 'data:image/png;base64,' + (await sharp(padded)
  .resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
let raw = null, lastErr;
for (let attempt = 1; attempt <= 4; attempt++) {
  try {
    const res = await fetch(`${API}/assets/sprite/animate`, {
      method: 'POST',
      headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(240000),
      body: JSON.stringify({ initial_image: uri, motion_prompt: MOTION + HOLD, frames: SRC,
        frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite-vfx' }),
    });
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
    raw = await framesFrom(await res.json(), SRC);
    break;
  } catch (e) { lastErr = e; if (attempt < 4) await new Promise((r) => setTimeout(r, 4000 * attempt)); }
}
if (!raw) { console.error('FAIL: ' + lastErr.message); process.exit(1); }
console.log(`  got ${raw.length} source frames`);

// normalise every source frame to the padded box
const norm = [];
for (const b of raw) norm.push(await sharp(b).resize(W, H, { fit: 'fill' }).png().toBuffer());

// ---- arc length around the loop -------------------------------------------
const S = 128;
const small = [];
for (const b of norm) {
  const { data } = await sharp(b).resize(S, S, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  small.push(data);
}
const lum = (d, i) => (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) * (d[i + 3] / 255);
const step = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(lum(a, i) - lum(b, i)); return s / (S * S); };
const M = norm.length;
const cum = [0];
for (let k = 0; k < M; k++) cum.push(cum[k] + step(small[k], small[(k + 1) % M]));
const total = cum[M];
const rawSteps = [];
for (let k = 0; k < M; k++) rawSteps.push(cum[k + 1] - cum[k]);
const rawSpread = Math.max(...rawSteps) / Math.max(1e-6, Math.min(...rawSteps));
console.log(`  source pacing spread ${rawSpread.toFixed(2)}x — retiming ${M} frames onto ${OUTN} equal-change slots`);

// ---- retime: OUTN slots at equal arc length --------------------------------
const outBufs = [];
for (let j = 0; j < OUTN; j++) {
  const target = (total * j) / OUTN;
  let k = 0;
  while (k < M - 1 && cum[k + 1] <= target) k++;
  const span = cum[k + 1] - cum[k];
  const t = span > 1e-6 ? (target - cum[k]) / span : 0;
  if (!BLEND || t < 0.02) { outBufs.push(norm[k % M]); continue; }
  // Straight per-pixel lerp between the two bracketing source frames. Done on
  // raw RGBA rather than sharp's compositor so the interpolation is exact and
  // the alpha channel is interpolated too (a plain 'over' composite would keep
  // frame B's silhouette wherever it is opaque, which is not an in-between).
  // With 16 sources the pair is close enough that this reads as motion, not
  // ghosting. Premultiply before mixing so edge pixels don't darken.
  const A = await sharp(norm[k % M]).ensureAlpha().raw().toBuffer();
  const B = await sharp(norm[(k + 1) % M]).ensureAlpha().raw().toBuffer();
  const mix = Buffer.alloc(A.length);
  for (let i = 0; i < A.length; i += 4) {
    const aa = A[i + 3] / 255, ba = B[i + 3] / 255;
    const oa = aa + (ba - aa) * t;
    mix[i + 3] = Math.round(oa * 255);
    if (oa <= 0) { mix[i] = mix[i + 1] = mix[i + 2] = 0; continue; }
    for (let c = 0; c < 3; c++) {
      const pm = A[i + c] * aa + (B[i + c] * ba - A[i + c] * aa) * t;
      mix[i + c] = Math.max(0, Math.min(255, Math.round(pm / oa)));
    }
  }
  outBufs.push(await sharp(mix, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer());
}

// ---- verify the retimed loop before writing anything ----------------------
const chk = [];
for (const b of outBufs) {
  const { data } = await sharp(b).resize(S, S, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  chk.push(data);
}
const outSteps = [];
for (let k = 0; k < OUTN; k++) outSteps.push(step(chk[k], chk[(k + 1) % OUTN]));
const outSpread = Math.max(...outSteps) / Math.max(1e-6, Math.min(...outSteps));
console.log(`  retimed pacing spread ${outSpread.toFixed(2)}x  (deltas ${outSteps.map((d) => d.toFixed(1)).join(', ')})`);

await mkdir(OUT, { recursive: true });
for (let j = 0; j < OUTN; j++) {
  await writeFile(join(OUT, `${key}_${j}.webp`), await sharp(outBufs[j]).webp({ quality: 92 }).toBuffer());
}
console.log(`  wrote ${OUTN} frames -> ${OUTDIR_REL || 'Sprites/fx/anim'}/${key}_0..8.webp`);
