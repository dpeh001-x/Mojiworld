#!/usr/bin/env node
// AETHERION'S SHARD LANCE (maeshard) — the Shardfather's own projectile (ludo.ai).
// ============================================================================
// Per user: "Aetherion is shooting projectile that does not match, using ludo.ai generate an epic
// projectile suitable for aetherion". He is a white-and-gold crystal dragon and he was throwing
// `mdark` — the shared dark-purple orb that half the field mobs use — so the shot read as someone
// else's spell. This builds his own: a faceted white-and-gold crystal lance with a violet-white
// core, gated as a still and then animated into nine frames.
//
//   Sprites/projectiles/maeshard.webp             the still the game falls back to
//   Sprites/projectiles/anim/maeshard_0..8.webp   the nine frames it plays
//
//   LUDO_API_KEY=... node scripts/gen_aetherion_shard.mjs --gen [--n=3]
//   node scripts/gen_aetherion_shard.mjs --pick 3      # candidate -> the still
//   LUDO_API_KEY=... node scripts/gen_aetherion_shard.mjs --animate
// After a drop: node scripts/gen_sprite_frame_index.mjs && node scripts/gen_assets_manifest.mjs
// These are NEW filenames, so no sw.js CACHE bump is required for them.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REVIEW = path.join(ROOT, 'scripts', '_tmp_ae_review');
const KEY = process.env.LUDO_API_KEY, API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
// accepts --k=v and '--k v': the second form is what anyone types first, and silently printing the
// prompt instead of doing the work (which is what the =-only form did) wastes a generation run.
const arg = (k, d) => { const i = process.argv.findIndex((x) => x === '--' + k); if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1];
  const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const has = (f) => process.argv.includes('--' + f);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(REVIEW, { recursive: true });

const OUT = 'Sprites/projectiles/maeshard.webp';
const ANIM = 'Sprites/projectiles/anim';
const NAME = 'maeshard';
const SIZE = 512, FEATHER = 36, MIN_FILL = 0.60, MIN_WIDE = 1.15;
// His palette, not the mob orb's: white and pale gold crystal with a violet-white core. It flies to
// the RIGHT because the game draws it mode:'orient' — rotated to its own heading from a right-facing
// source — so a lance drawn pointing any other way would fly sideways.
const PROMPT = 'A single 2D game projectile sprite on a fully transparent background: a long crystal spear-shard '
  + 'flying to the RIGHT, seen flat from the side. A sharply pointed lance of faceted white and pale-gold crystal '
  + 'with a glowing violet-white core running down its length, smaller crystal shards breaking away along its '
  + 'trailing edge, and a soft comet-trail of violet-white light and sparks streaming behind it to the left. '
  + 'Sharp, fast, regal, dangerous. Painterly hand-painted game art, white and pale gold with violet light, bold '
  + 'readable silhouette, bright additive glow bleeding into the transparency, NO hard black outline. Centred, '
  + 'filling the frame, much wider than it is tall, pointing right. NO character, NO dragon, NO hand, NO ground, '
  + 'NO scene, NO text, NO watermark, NO background.';
const MOTION = 'The crystal lance SURGES forward with strong visible change in every frame, spread evenly across all '
  + 'nine: the facets catch and release the light so the crystal glitters, the violet core pulses brighter and dimmer '
  + 'along its length, the small shards around it tumble and stream backward, and the comet-trail of sparks renews '
  + 'behind it. CRITICAL - THE LANCE STAYS PUT: it keeps the same position, the same size and the same rightward '
  + 'facing in every frame; nothing rotates, zooms, pans, mirrors or flips - only the light and the loose shards '
  + 'move. Keep the exact same white, pale-gold and violet palette, the same painterly style and a fully transparent '
  + 'background in every frame.';

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
// alpha ramps to zero over the outermost `ramp` px, so the trail fades instead of being guillotined
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
const normalise = async (buf) => feather(await sharp(buf).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), FEATHER);

async function makeStills(n) {
  const kept = [];
  for (let k = 1, got = 0; got < n && k <= n + 4; k++) {
    process.stdout.write(`shard candidate ${k} ... `);
    try {
      const raw = await fetchBuf(urlOf(await ludo('assets/image', { image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PROMPT })));
      const b = await box(raw);
      const fill = Math.max(b.w, b.h) / Math.max(b.W, b.H), wide = b.w / b.h;
      console.log(`content ${b.w}x${b.h} fill ${(fill * 100) | 0}% aspect ${wide.toFixed(2)} cornerA ${b.corner}`);
      if (b.corner > 0) { console.log('  rejected: background is not transparent'); continue; }
      if (fill < MIN_FILL) { console.log(`  rejected: too small in frame (want >= ${(MIN_FILL * 100) | 0}%)`); continue; }
      if (wide < MIN_WIDE) { console.log('  rejected: that is not a LANCE (want wider than tall)'); continue; }
      got++;
      const f = path.join(REVIEW, `shard_${got}.webp`);
      fs.writeFileSync(f, await normalise(raw));
      kept.push(f);
      console.log('  kept as ' + path.basename(f));
    } catch (e) { console.log('failed: ' + e.message); if (/402/.test(e.message)) process.exit(3); await sleep(2500); }
  }
  if (kept.length) await sheet(kept, path.join(REVIEW, 'candidates.png'));
}
async function sheet(files, out) {
  const cells = []; const S = 200;
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
// A dark background baked into a frame: flood-fill from the outer BAND (not the outermost ring — the
// frames get feathered, so their edge pixels are already transparent and a ring seed finds nothing)
// across pixels that are dark and nearly colourless. Only background connected to the edge goes, so
// the crystal's own dark facets are never reached.
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
  for (let pass = 0; pass < 2; pass++) {                 // the rim the background leaves behind
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
// How far the art WANDERS across the set: the alpha bbox centre and size per frame, against the
// first. Ludo will happily "animate" a sprite by sliding or shrinking it, which in game reads as the
// projectile drifting off its own hitbox.
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
// How much the set actually MOVES: mean |frame - previous| over the opaque area.
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
  const ok = (x) => x.score >= 12 && x.drift <= 0.07 && x.scale <= 0.18;
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
      if (ok(cand)) break;                                // moves a lot, stays where it was put
      console.log(score < 12 ? '  rejected: too static' : '  rejected: the lance wanders (it should animate in place)');
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
  const k = arg('pick'), src = path.join(REVIEW, `shard_${k}.webp`), dst = path.join(ROOT, OUT);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst + '.tmp'); fs.renameSync(dst + '.tmp', dst);
  console.log(`installed ${OUT} from candidate ${k}`);
}
if (has('animate')) { if (!KEY) { console.error('LUDO_API_KEY is not set'); process.exit(1); } await animate(); }
if (!has('gen') && !arg('pick') && !has('animate')) console.log(`${NAME} -> ${OUT}\n  ${PROMPT.slice(0, 200)}...\n`);
