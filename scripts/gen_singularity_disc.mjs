#!/usr/bin/env node
// The Singularity's accretion disc — the living sky behind Gravitos (v0.30.549 drew it procedurally;
// per user "this effect can be much more polished ... generate art sprites if you have to").
//
//   node scripts/gen_singularity_disc.mjs --base       # ludo.ai image -> Sprites/fx/singularity_disc.webp (1024)
//   node scripts/gen_singularity_disc.mjs --animate [--frames 24]   # ludo.ai animate from that base -> Sprites/fx/anim/singularity_0..N-1.webp
//   node scripts/gen_singularity_disc.mjs --contact    # review strip -> scripts/_singularity_review/
// Needs LUDO_API_KEY. After a drop: node scripts/gen_sprite_frame_index.mjs && node scripts/animator_parity_check.mjs
//
// COMPOSITION IS LOAD-BEARING. The sprite is seated over the oculus sphere painted into
// bg_v3_gravitosArena and drawn UNROTATED: the black core must sit at the exact centre of the
// canvas (the game centres the blit on the sphere), the disc must be a tilted ellipse (the
// Interstellar three-quarter view — a rotating face-on ring would just be a wheel), and the
// background must be genuinely transparent. Both steps judge the candidate in memory and write
// nothing until it passes.
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = join(ROOT, 'Sprites', 'fx', 'singularity_disc.webp');
const OUT_DIR = join(ROOT, 'Sprites', 'fx', 'anim');
const REVIEW = join(ROOT, 'scripts', '_singularity_review');
const KEY = 'singularity';
const FRAMES = (() => { const i = process.argv.indexOf('--frames'); const n = i > 0 ? parseInt(process.argv[i + 1], 10) : 16; return (n >= 4 && n <= 16) ? n : 16; })();   // v0.30.x (per user 'more frames to make it look more epic'): 16, the most the animate endpoint accepts (24 fails schema validation)
const BASE_SIZE = 1024, FRAME_SIZE = 768;
const has = (f) => process.argv.includes(f);
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const key = process.env.LUDO_API_KEY;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';

const PROMPT = [
  'Game VFX sprite on a fully transparent background, alpha only - no scene, no floor, no stars, no',
  'character, no text, no watermark, no border. A supermassive black hole with its glowing accretion',
  'disc, seen from a three-quarter angle like a photograph of a real black hole: a perfectly round,',
  'pitch-black event-horizon sphere at the EXACT CENTRE of the image, ringed by a razor-thin white-hot',
  'photon ring, and around it a wide tilted elliptical accretion disc of swirling plasma - white-gold',
  'and pale amber at the inner edge, cooling through hot magenta to deep violet and indigo at the',
  'outer rim - with fine streaming bands, and the far side of the disc lensed up OVER the top of the',
  'sphere and down UNDER it as thin luminous arcs (gravitational lensing). The disc is tilted about',
  '25 degrees from edge-on, wider than it is tall, and centred on the sphere. Painterly hand-painted',
  'game art, rich saturated colour, soft luminous glow bleeding into the transparency, crisp readable',
  'silhouette. NO hard black outline, no keyline, no sticker look, no background gradient, no',
  'starfield. Centred, roughly square overall, filling most of the canvas with clear space around it.',
].join(' ');

const MOTION =
  'Animate this black hole as a seamless, perfectly looping cycle of PLASMA FLOW ONLY. The bright ' +
  'bands of the accretion disc stream steadily around the ring, the inner white-gold edge shimmers ' +
  'and ripples, the lensed arcs over and under the sphere flicker gently, and small sparks drift along ' +
  'the outer rim. CRITICAL - THE SHAPE DOES NOT MOVE: the black sphere stays at exactly the same ' +
  'position and size in every frame, the tilt and outline of the disc stay identical, nothing ' +
  'rotates as a whole, nothing zooms, pans, drifts, wobbles, mirrors or flips. Only the light INSIDE ' +
  'the disc flows. CRITICAL - SEAMLESS LOOP: the last frame flows back into the first with no jump. ' +
  'Keep the exact same painterly style, palette, glow and fully transparent background in every frame. ' +
  'No stars, no background, no text.';

async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); }
async function alphaBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; let x0 = W, y0 = H, x1 = -1, y1 = -1, opaque = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const a = data[(y * W + x) * 4 + 3]; if (a > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } if (a > 250) opaque++; }
  if (x1 < 0) throw new Error('fully transparent');
  const corner = data[3] + data[(W - 1) * 4 + 3] + data[((H - 1) * W) * 4 + 3] + data[((H - 1) * W + W - 1) * 4 + 3];
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, W, H, opaqueFrac: opaque / (W * H), cornerAlpha: corner };
}
// The black core: darkest pixels' centroid must sit near the content centre (the game centres the blit).
async function coreCentre(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) { const i = (y * info.width + x) * 4; if (data[i + 3] > 200 && data[i] + data[i + 1] + data[i + 2] < 60) { sx += x; sy += y; n++; } }
  return n > 50 ? { x: sx / n, y: sy / n, n } : null;
}

async function makeBase() {
  if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
  let chosen = null;
  for (let round = 1; round <= 5 && !chosen; round++) {
    process.stdout.write(`base attempt ${round} ... `);
    try {
      const res = await fetch(`${API}/assets/image`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(150000),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PROMPT }) });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
      const j = await res.json();
      const url = Array.isArray(j) ? (j[0] && j[0].url) : (j && (j.url || (j.images && j.images[0] && j.images[0].url)));
      if (!url) throw new Error('no url');
      const raw = await fetchBuf(url);
      const box = await alphaBox(raw), core = await coreCentre(raw);
      const aspect = box.w / box.h, clipped = box.x0 === 0 || box.y0 === 0 || box.x1 === box.W - 1 || box.y1 === box.H - 1;
      const coreOff = core ? Math.hypot(core.x - box.cx, core.y - box.cy) / box.w : 1;
      console.log(`content ${box.w}x${box.h} aspect ${aspect.toFixed(2)} cornerA ${box.cornerAlpha} core ${core ? core.n : 0}px off ${(coreOff * 100).toFixed(1)}%`);
      if (box.cornerAlpha > 0) { console.log('  rejected: background is not transparent'); continue; }
      if (clipped) { console.log('  rejected: clipped at the canvas edge'); continue; }
      if (aspect < 1.2 || aspect > 2.8) { console.log('  rejected: not a wide tilted disc (want 1.2-2.8; the model draws it near edge-on, ~2.3)'); continue; }
      if (!core) { console.log('  rejected: no black core'); continue; }
      if (coreOff > 0.09) { console.log('  rejected: the core is off-centre (the game centres the blit on the sphere)'); continue; }
      chosen = { raw, box };
    } catch (e) { console.log('failed: ' + e.message); await new Promise((r) => setTimeout(r, 2500 * round)); }
  }
  if (!chosen) { console.error('REFUSING: no candidate met the gate in 5 rounds.'); process.exit(1); }
  // seat the CORE at the canvas centre (not the alpha box), so the blit lands on the sphere
  const core = await coreCentre(chosen.raw);
  const inner = Math.round(BASE_SIZE * 0.92);
  const k = inner / Math.max(chosen.box.w, chosen.box.h);
  const scaled = await sharp(chosen.raw).resize(Math.round(chosen.box.W * k), Math.round(chosen.box.H * k)).png().toBuffer();
  const sm = await sharp(scaled).metadata();
  const left = Math.round(BASE_SIZE / 2 - core.x * k), top = Math.round(BASE_SIZE / 2 - core.y * k);
  await mkdir(dirname(BASE), { recursive: true });
  const tmp = BASE + '.tmp';
  await sharp({ create: { width: BASE_SIZE, height: BASE_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: scaled, left, top }]).webp({ quality: 92 }).toFile(tmp);
  await rename(tmp, BASE);
  const chk = await alphaBox(await readFile(BASE));
  console.log(`wrote Sprites/fx/singularity_disc.webp ${BASE_SIZE}x${BASE_SIZE} content ${chk.w}x${chk.h} (scaled ${sm.width}x${sm.height})`);
}

async function framesFrom(data, n) {
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const cols = data.num_cols, rows = data.num_rows, sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
    const cw = Math.floor(meta.width / cols), ch = Math.floor(meta.height / rows), o = [];
    for (let r = 0; r < rows && o.length < n; r++) for (let c = 0; c < cols && o.length < n; c++) o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  const urls = data.individual_frame_urls || [];
  if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  throw new Error('no usable frames');
}
async function makeAnim() {
  if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
  await mkdir(OUT_DIR, { recursive: true });
  const uri = 'data:image/png;base64,' + (await sharp(await readFile(BASE)).resize(990, 990, { fit: 'inside' }).png().toBuffer()).toString('base64');
  let last;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      process.stdout.write(`animate ${KEY} attempt ${attempt} ... `);
      const res = await fetch(`${API}/assets/sprite/animate`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(600000),
        body: JSON.stringify({ initial_image: uri, motion_prompt: MOTION, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true }) });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
      const bufs = await framesFrom(await res.json(), FRAMES);
      const outs = []; for (const b of bufs) outs.push(await sharp(b).resize(FRAME_SIZE, FRAME_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 92 }).toBuffer());
      const b0 = await alphaBox(outs[0]); let drift = 0, swing = 0;
      for (let i = 1; i < FRAMES; i++) { const b = await alphaBox(outs[i]); drift = Math.max(drift, Math.hypot(b.cx - b0.cx, b.cy - b0.cy) / FRAME_SIZE); swing = Math.max(swing, Math.abs(b.w - b0.w) / b0.w, Math.abs(b.h - b0.h) / b0.h); }
      console.log(`candidate: frame0 ${b0.w}x${b0.h}, worst drift ${(drift * 100).toFixed(1)}%, worst size swing ${(swing * 100).toFixed(1)}%`);
      if (drift > 0.05 || swing > 0.10) throw new Error('set wanders (the sphere must hold still) - rejected before writing');
      for (let i = 0; i < FRAMES; i++) { const f = join(OUT_DIR, `${KEY}_${i}.webp`); await writeFile(f + '.tmp', outs[i]); await rename(f + '.tmp', f); }
      console.log(`OK - wrote Sprites/fx/anim/${KEY}_0..${FRAMES - 1}.webp`); return;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (attempt < 4) await new Promise((s) => setTimeout(s, 4000 * attempt)); }
  }
  console.error('FAILED: ' + (last && last.message)); process.exit(1);
}
async function doContact() {
  await mkdir(REVIEW, { recursive: true });
  const BIG = FRAMES > 12 ? 72 : 118, PAD = 8, HDR = 40, LBL = 18, W = FRAMES * (BIG + PAD) + PAD + 220, H = HDR + 200 + LBL + PAD;
  const svg = (t, s, c, w, h) => Buffer.from(`<svg width="${w}" height="${h}"><text x="0" y="${s}" font-family="Segoe UI,Arial" font-size="${s}" font-weight="700" fill="${c}">${t}</text></svg>`);
  const layers = [{ input: svg(`${KEY}: base (left) + 9 loop frames`, 16, '#fff', W, HDR), left: PAD, top: 10 }];
  if (await exists(BASE)) layers.push({ input: await sharp(await readFile(BASE)).resize(200, 200, { fit: 'inside' }).png().toBuffer(), left: PAD, top: HDR });
  for (let i = 0; i < FRAMES; i++) { const f = join(OUT_DIR, `${KEY}_${i}.webp`); if (!await exists(f)) continue; const x = 220 + PAD + i * (BIG + PAD);
    layers.push({ input: await sharp(await readFile(f)).resize(BIG, BIG, { fit: 'inside' }).png().toBuffer(), left: x, top: HDR + 40 });
    layers.push({ input: svg(String(i), 14, '#ffd870', BIG, LBL), left: x, top: HDR + 40 + BIG + 2 }); }
  const out = join(REVIEW, `${KEY}_strip.png`);
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 22, g: 26, b: 42, alpha: 1 } } }).composite(layers).png().toFile(out);
  console.log('wrote ' + out);
}
if (has('--base')) await makeBase();
else if (has('--animate')) await makeAnim();
else if (has('--contact')) await doContact();
else { console.log(PROMPT); console.log('\n--base | --animate | --contact'); }
