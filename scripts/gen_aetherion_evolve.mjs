#!/usr/bin/env node
// AETHERION'S ASCENSION (ae_evolve) — the VFX for his form change (ludo.ai).
// ============================================================================
// Per user: "when aetherion transforms to aetherion2 make an animation to show the evolution".
// The form change was instant — one frame he is Aetherion, the next he is the second form, with a
// particle ring over the cut. This is the light he ascends inside: a column of white-gold crystal
// light that swallows him at the break, so the sprite swap happens behind it instead of on screen.
//
//   Sprites/fx/ae_evolve.webp             the still
//   Sprites/fx/anim/ae_evolve_0..8.webp   the nine frames spawnSpriteBurst plays
//
//   LUDO_API_KEY=... node scripts/gen_aetherion_evolve.mjs --gen [--n=3]
//   node scripts/gen_aetherion_evolve.mjs --pick 2
//   LUDO_API_KEY=... node scripts/gen_aetherion_evolve.mjs --animate
// After a drop: node scripts/gen_sprite_frame_index.mjs && node scripts/gen_assets_manifest.mjs
// New filenames, so no sw.js CACHE bump is required for them.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REVIEW = path.join(ROOT, 'scripts', '_tmp_aeevo_review');
const KEY = process.env.LUDO_API_KEY, API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const arg = (k, d) => { const i = process.argv.findIndex((x) => x === '--' + k); if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1];
  const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const has = (f) => process.argv.includes('--' + f);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(REVIEW, { recursive: true });

const OUT = 'Sprites/fx/ae_evolve.webp';
const ANIM = 'Sprites/fx/anim';
const NAME = 'ae_evolve';
const SIZE = 768, FEATHER = 56, MIN_FILL = 0.62;
// His palette: white and pale gold crystal, violet-white core — the same light his lance carries.
// It is TALLER than it is wide because it is a column he rises inside, and it must be hollow enough
// at the middle that the boss reads through it rather than being replaced by a white slab.
const PROMPT = 'A single 2D game VFX sprite on a fully transparent background: a towering vertical column of '
  + 'radiant crystal light, seen flat from the side. A broad pillar of white and pale-gold light rising straight '
  + 'up, its edges made of long faceted crystal shards that spiral upward around it, a violet-white glow burning '
  + 'at its core, a brilliant ring of golden light snapping outward along the ground at its base, and sparks and '
  + 'small crystal fragments streaming upward out of the top. Radiant, sacred, overwhelming, an ascension. '
  + 'Painterly hand-painted game art, white and pale gold with violet light, bright additive glow bleeding into '
  + 'the transparency, NO hard black outline. Centred, symmetric left to right, taller than it is wide, filling '
  + 'the frame, and brightest at its edges so the centre of the column stays open. NO character, NO dragon, NO '
  + 'creature, NO ground plane, NO scene, NO text, NO watermark, NO background.';
const MOTION = 'The pillar ERUPTS with strong visible change in every frame, spread evenly across all nine, and '
  + 'nothing is still: frames 1-3 the column surges upward to full height and the golden ring snaps outward along '
  + 'the ground; frames 4-6 the crystal shards spiral up around it, the violet core pulses at its brightest and '
  + 'the sparks stream out of the top; frames 7-9 the column thins and burns away from the bottom upward, the '
  + 'shards scatter outward and the whole thing dims toward transparency. CRITICAL - DO NOT MOVE THE IMAGE AS A '
  + 'WHOLE: no rotation, no spin, no mirror, no flip, no zoom, no pan. The base of the column stays at the same '
  + 'place in every frame. Keep the exact same white, pale-gold and violet palette, the same painterly style and '
  + 'a fully transparent background in every frame.';

async function ludo(route, body, timeout = 240000) {
  const res = await fetch(`${API}/${route}`, { method: 'POST', headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(timeout), body: JSON.stringify(body) });
  if (res.status === 402) throw new Error('402 OUT OF CREDITS');
  const txt = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${txt.slice(0, 140)}`);
  let j = JSON.parse(txt);
  if (res.status === 202 && j.id) {                      // async job (see memory: ludo-api-async-jobs)
    const id = j.id;
    for (let i = 0; ; i++) {
      if (i > 80) throw new Error('job timed out');
      await sleep(Math.max(4000, Number(j.poll_after_ms) || 5000));
      const r = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${KEY}` }, signal: AbortSignal.timeout(45000) });
      if (r.status === 429) { await r.text().catch(() => {}); continue; }
      j = await r.json();
      if (j.status === 'succeeded') { j = j.result; break; }
      if (j.status === 'failed' || j.status === 'cancelled') throw new Error('job ' + j.status);
    }
  }
  return j;
}
const urlOf = (d) => Array.isArray(d) ? (d[0] && d[0].url) : (d && (d.url || (d.images && d.images[0] && d.images[0].url) || (Array.isArray(d.result) && d.result[0] && d.result[0].url)));
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(180000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

async function box(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) throw new Error('fully transparent');
  const corner = data[3] + data[(W - 1) * 4 + 3] + data[((H - 1) * W) * 4 + 3] + data[((H - 1) * W + W - 1) * 4 + 3];
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1, W, H, corner };
}
// How solid the MIDDLE of the column is. The boss stands inside this thing; art that is a filled
// white slab hides him completely and the form change happens behind a blank, which is the one way
// this VFX can be worse than no VFX at all.
async function coreOpacity(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const x0 = Math.round(W * 0.36), x1 = Math.round(W * 0.64);
  const y0 = Math.round(H * 0.30), y1 = Math.round(H * 0.80);
  let sum = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { sum += data[(y * W + x) * 4 + 3]; n++; }
  return sum / Math.max(1, n) / 255;
}
async function feather(buf, ramp) {
  if (!ramp) return sharp(buf).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const sm = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
  const rr = new Float32Array(H), cr = new Float32Array(W);
  for (let y = 0; y < H; y++) rr[y] = Math.min(sm(y / ramp), sm((H - 1 - y) / ramp));
  for (let x = 0; x < W; x++) cr[x] = Math.min(sm(x / ramp), sm((W - 1 - x) / ramp));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * C + 3; if (!data[i]) continue; const r = Math.min(rr[y], cr[x]); if (r < 1) data[i] = Math.round(data[i] * r); }
  return sharp(data, { raw: { width: W, height: H, channels: C } }).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
}
// The column is taller than the canvas can hold, so it comes back with a FLAT CUT across the top —
// a bright rectangle sitting on the end of the pillar, which is exactly what it looks like in game.
// The 56px edge feather is far too short to hide it, so the top quarter gets its own long ramp and
// the light streams out of frame instead of stopping dead.
async function topFade(buf, frac) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const band = Math.max(1, Math.round(H * frac));
  const sm = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
  for (let y = 0; y < band; y++) {
    const r = sm(y / band);
    for (let x = 0; x < W; x++) { const i = (y * W + x) * C + 3; if (data[i]) data[i] = Math.round(data[i] * r); }
  }
  return sharp(data, { raw: { width: W, height: H, channels: C } }).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
}
const TOP_FADE = 0.26;
const normalise = async (buf) => topFade(await feather(await sharp(buf).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), FEATHER), TOP_FADE);

async function makeStills(n) {
  const kept = [];
  for (let k = 1, got = 0; got < n && k <= n + 4; k++) {
    process.stdout.write(`evolve candidate ${k} ... `);
    try {
      const raw = await fetchBuf(urlOf(await ludo('assets/image', { image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PROMPT })));
      const b = await box(raw);
      const fill = Math.max(b.w, b.h) / Math.max(b.W, b.H), core = await coreOpacity(raw);
      console.log(`content ${b.w}x${b.h} fill ${(fill * 100) | 0}% core ${(core * 100) | 0}% cornerA ${b.corner}`);
      if (b.corner > 0) { console.log('  rejected: background is not transparent'); continue; }
      if (fill < MIN_FILL) { console.log(`  rejected: too small in frame (want >= ${(MIN_FILL * 100) | 0}%)`); continue; }
      if (b.h < b.w) { console.log('  rejected: that is not a COLUMN (want taller than wide)'); continue; }
      if (core > 0.72) { console.log('  rejected: the middle is a solid slab — the boss would vanish behind it'); continue; }
      got++;
      const f = path.join(REVIEW, `evolve_${got}.webp`);
      fs.writeFileSync(f, await normalise(raw));
      kept.push(f);
      console.log('  kept as ' + path.basename(f));
    } catch (e) { console.log('failed: ' + e.message); if (/402/.test(e.message)) process.exit(3); await sleep(2500); }
  }
  if (kept.length) await sheet(kept, path.join(REVIEW, 'candidates.png'));
}
async function sheet(files, out) {
  const cells = []; const S = 220;
  for (const [i, f] of files.entries()) cells.push({ input: await sharp(f).resize(S, S, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), left: 10 + i * (S + 10), top: 10 });
  await sharp({ create: { width: 20 + files.length * (S + 10), height: S + 20, channels: 4, background: { r: 40, g: 30, b: 56, alpha: 1 } } }).composite(cells).png().toFile(out);
  console.log('sheet -> ' + path.relative(ROOT, out));
}
async function framesFrom(data, n) {
  const d = Array.isArray(data) ? data[0] : data;
  if (d.spritesheet_url && d.num_cols && d.num_rows) {
    const sheetBuf = await fetchBuf(d.spritesheet_url), meta = await sharp(sheetBuf).metadata();
    const cw = Math.floor(meta.width / d.num_cols), ch = Math.floor(meta.height / d.num_rows), o = [];
    for (let r = 0; r < d.num_rows && o.length < n; r++) for (let c = 0; c < d.num_cols && o.length < n; c++) o.push(await sharp(sheetBuf).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  const urls = d.individual_frame_urls || [];
  if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  throw new Error('no usable frames');
}
async function deBackground(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, n = W * H;
  const bg = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * 4, r = data[p], g = data[p + 1], b = data[p + 2];
    bg[i] = (data[p + 3] > 0 && r + g + b < 250 && Math.max(r, g, b) - Math.min(r, g, b) < 46) ? 1 : 0;
  }
  const seen = new Uint8Array(n), stack = new Int32Array(n);
  let top = 0, killed = 0;
  const band = Math.round(Math.min(W, H) * 0.16);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!(x < band || y < band || x >= W - band || y >= H - band)) continue;
    const i = y * W + x; if (bg[i] && !seen[i]) { seen[i] = 1; stack[top++] = i; }
  }
  while (top) {
    const i = stack[--top], x = i % W, y = (i - x) / W;
    data[i * 4 + 3] = 0; killed++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const q = ny * W + nx; if (bg[q] && !seen[q]) { seen[q] = 1; stack[top++] = q; }
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    const kill = [];
    for (let i = 0; i < n; i++) {
      const p = i * 4;
      if (data[p + 3] < 40 || data[p] + data[p + 1] + data[p + 2] > 300) continue;
      const x = i % W, y = (i - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || data[(ny * W + nx) * 4 + 3] === 0) { kill.push(p); break; }
      }
    }
    for (const p of kill) data[p + 3] = Math.round(data[p + 3] * 0.25);
  }
  return { buf: await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer(), cleared: killed / n };
}
async function driftOf(bufs) {
  const boxes = [];
  for (const b of bufs) { const bb = await box(b); boxes.push({ cx: (bb.x0 + bb.w / 2) / bb.W, cy: (bb.y0 + bb.h / 2) / bb.H, s: Math.max(bb.w, bb.h) / Math.max(bb.W, bb.H) }); }
  let drift = 0, scale = 0;
  for (let i = 1; i < Math.min(6, boxes.length); i++) {
    drift = Math.max(drift, Math.hypot(boxes[i].cx - boxes[0].cx, boxes[i].cy - boxes[0].cy));
    scale = Math.max(scale, Math.abs(boxes[i].s - boxes[0].s) / Math.max(0.01, boxes[0].s));
  }
  return { drift, scale };
}
async function motionScore(bufs) {
  let total = 0;
  const raws = [];
  for (const b of bufs) raws.push(await sharp(b).resize(128, 128, { fit: 'fill' }).ensureAlpha().raw().toBuffer());
  for (let i = 1; i < raws.length; i++) {
    let diff = 0, n = 0;
    for (let p = 0; p < raws[i].length; p += 4) {
      const a = raws[i][p + 3], b2 = raws[i - 1][p + 3];
      if (a < 20 && b2 < 20) continue;
      n++; diff += Math.abs(raws[i][p] - raws[i - 1][p]) + Math.abs(raws[i][p + 1] - raws[i - 1][p + 1]) + Math.abs(raws[i][p + 2] - raws[i - 1][p + 2]) + Math.abs(a - b2);
    }
    if (n) total += diff / n;
  }
  return total / Math.max(1, raws.length - 1);
}
async function animate() {
  const uri = 'data:image/png;base64,' + (await sharp(fs.readFileSync(path.join(ROOT, OUT))).resize(990, 990, { fit: 'inside' }).png().toBuffer()).toString('base64');
  let best = null;
  // A column that burns away at its tail legitimately shrinks, so the drift/scale gate is held to
  // the body of the set (frames 0-5) — same as every other burst here.
  const ok = (x) => x.score >= 12 && x.drift <= 0.07 && x.scale <= 0.20;
  for (let attempt = 1; attempt <= 3; attempt++) {
    process.stdout.write(`animate ${NAME} attempt ${attempt} ... `);
    try {
      let bufs = await framesFrom(await ludo('assets/sprite/animate', { initial_image: uri, motion_prompt: MOTION, frames: 9, frame_size: -9, model: 'eagle', individual_frames: true }, 600000), 9);
      for (let i = 0; i < bufs.length; i++) bufs[i] = (await deBackground(bufs[i])).buf;
      const score = await motionScore(bufs);
      const { drift, scale } = await driftOf(bufs);
      const cand = { bufs, score, drift, scale };
      console.log(`motion ${score.toFixed(1)} drift ${(drift * 100).toFixed(1)}% scale ${(scale * 100).toFixed(1)}%`);
      if (!best || (ok(cand) && !ok(best))) best = cand;
      if (ok(cand)) break;
      console.log(score < 12 ? '  rejected: too static' : '  rejected: the column wanders (it should erupt in place)');
    } catch (e) { console.log('failed: ' + e.message); if (/402/.test(e.message)) process.exit(3); await sleep(4000 * attempt); }
  }
  if (!best) { console.error('FAILED: no usable animation'); process.exit(1); }
  const dir = path.join(ROOT, ANIM);
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < 9; i++) {
    const f = path.join(dir, `${NAME}_${i}.webp`);
    fs.writeFileSync(f + '.tmp', await normalise(best.bufs[i])); fs.renameSync(f + '.tmp', f);
  }
  console.log(`wrote ${ANIM}/${NAME}_0..8.webp (motion ${best.score.toFixed(1)})`);
}
if (has('gen')) { if (!KEY) { console.error('LUDO_API_KEY is not set'); process.exit(1); } await makeStills(Number(arg('n', 3))); }
if (arg('pick')) {
  const k = arg('pick'), src = path.join(REVIEW, `evolve_${k}.webp`), dst = path.join(ROOT, OUT);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst + '.tmp'); fs.renameSync(dst + '.tmp', dst);
  console.log(`installed ${OUT} from candidate ${k}`);
}
if (has('animate')) { if (!KEY) { console.error('LUDO_API_KEY is not set'); process.exit(1); } await animate(); }
// Re-apply the top ramp to art already on disk, without spending another animation. A fresh --gen
// /--animate run bakes it in normalise(), so this leaves the files in the same state either way.
if (has('refade')) {
  const files = [path.join(ROOT, OUT)];
  for (let i = 0; i < 9; i++) files.push(path.join(ROOT, ANIM, `${NAME}_${i}.webp`));
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    fs.writeFileSync(f + '.tmp', await topFade(fs.readFileSync(f), TOP_FADE));
    fs.renameSync(f + '.tmp', f);
    console.log('refaded ' + path.relative(ROOT, f));
  }
}
if (!has('gen') && !arg('pick') && !has('animate') && !has('refade')) console.log(`${NAME} -> ${OUT}\n  ${PROMPT.slice(0, 200)}...\n`);
