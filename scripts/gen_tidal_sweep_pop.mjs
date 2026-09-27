#!/usr/bin/env node
// OCTOBABY TIDAL SWEEP — a grounded, pop-punk wave (ludo.ai still + 9-frame loop).
// ============================================================================
// Per user: "p_tsunami.webp needs to be on a platform / floor, also it needs to
// have a good animation with some pop-punk style feel, generate it and implement it".
// p_tsunami was a free-floating painterly curl with a tapering tail: nothing about
// it sat on the ground the Tidal Sweep rolls along. The new art is its own key
// (Cancer and Aquarius keep p_tsunami) and is authored with a FLAT BASE — a foam
// line along the bottom edge — so the draw path can plant that edge on the floor.
//
//   node scripts/gen_tidal_sweep_pop.mjs --still        roll 4 stills -> scripts/_tmp_tidal/still_N.png
//   node scripts/gen_tidal_sweep_pop.mjs --pick=N       write the seed + Sprites/projectiles/p_tidalsweep.webp
//   node scripts/gen_tidal_sweep_pop.mjs --animate      9 frames -> Sprites/projectiles/anim/tidalSweep_0..8.webp
// After the drop: node scripts/gen_sprite_frame_index.mjs && node scripts/gen_assets_manifest.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY = process.env.LUDO_API_KEY, API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const REVIEW = path.join(ROOT, 'scripts', '_tmp_tidal');
const SEED = path.join(ROOT, 'scripts', 'seeds', 'tidalsweep_pop.png');
const STILL = path.join(ROOT, 'Sprites', 'projectiles', 'p_tidalsweep.webp');
const ANIM = path.join(ROOT, 'Sprites', 'projectiles', 'anim');
const NAME = 'tidalSweep';
const W = 768, H = 432;   // 16:9, the wave's own proportions
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const arg = (k) => { const a = process.argv.find((x) => x.startsWith('--' + k)); return a ? (a.split('=')[1] ?? true) : null; };

const PROMPT = 'A single cartoon ocean wave seen from the side, rolling to the RIGHT: a tall curling crest on the '
  + 'right that curls over forward, the body sloping down to the left. The wave sits FLAT ON THE GROUND: its '
  + 'whole bottom edge is one straight horizontal line of white foam along the very bottom of the image, like a '
  + 'wave rolling along a floor. Pop punk sticker art: thick bold black ink outline, flat cel-shaded teal and deep '
  + 'blue water, white foam, a little halftone dot shading in the shadows, a few chunky white foam droplets and '
  + 'one small ink star splash near the crest, punchy and cute. Not neon. No text, no letters, no ground, no '
  + 'sky, no scenery, transparent background.';
const MOTION = 'The same cartoon wave stays in exactly the same place and the same size in every frame. Its bottom '
  + 'foam line stays flat on the bottom edge and never lifts. The curling crest on the right churns and curls '
  + 'over, the white foam along the top boils and rolls forward, chunky foam droplets and a small ink star pop '
  + 'off the crest and fall back, and the water surface ripples. Bouncy, snappy pop punk cartoon motion with '
  + 'thick black ink outlines kept in every frame. The wave does NOT slide, drift, grow, shrink or flip. Same '
  + 'teal, deep blue and white palette, fully transparent background.';

async function ludo(route, body, timeout = 300000) {
  const res = await fetch(`${API}/${route}`, { method: 'POST', headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(timeout), body: JSON.stringify(body) });
  if (res.status === 402) throw new Error('402 OUT OF CREDITS');
  const txt = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${txt.slice(0, 160)}`);
  let j = JSON.parse(txt);
  if (res.status === 202 && j.id) {                      // async job (memory: ludo-api-async-jobs)
    const id = j.id;
    let wait = Number(j.poll_after_ms) || 5000;
    for (let i = 0; ; i++) {
      if (i > 90) throw new Error('job timed out');
      await sleep(Math.max(4000, wait));
      const r = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${KEY}` }, signal: AbortSignal.timeout(45000) });
      if (r.status === 429) { await r.text().catch(() => {}); continue; }
      const k = await r.json();
      if (k.status === 'succeeded') { j = k.result; break; }
      if (k.status === 'failed' || k.status === 'cancelled') throw new Error('job ' + k.status);
      wait = Number(k.poll_after_ms) || wait;
    }
  }
  return j;
}
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(180000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

// Alpha stats that decide whether a roll is usable: the edges must be clear except
// the BOTTOM, which must carry a flat foam base (ink across most of the last rows).
async function grade(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, A = (x, y) => data[(y * w + x) * 4 + 3];
  let x0 = w, x1 = -1, y0 = h, y1 = -1, opaqueCorner = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (A(x, y) > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  for (const [cx, cy] of [[2, 2], [w - 3, 2]]) if (A(cx, cy) > 40) opaqueCorner++;
  if (x1 < 0) return { empty: true };
  // base flatness: ink coverage along the row 3% above the ink bottom, across the ink width
  const row = Math.max(y0, y1 - Math.round((y1 - y0) * 0.03));
  let cov = 0; for (let x = x0; x <= x1; x++) if (A(x, row) > 40) cov++;
  return { box: { x0, y0, x1, y1 }, base: cov / (x1 - x0 + 1), aspect: (x1 - x0 + 1) / (y1 - y0 + 1), transparentBg: opaqueCorner === 0 };
}
// Pop-punk sticker rim: a black ink band then a white sticker edge around the
// whole silhouette (the same white-edge motif as the v0.30.1187 creation stage).
// Grown from the alpha by blur + threshold, so it follows the foam and droplets.
async function grow(alpha, w, h, r) {
  // sharp may hand a 1-channel raw back widened, so read the channel count it reports
  const { data: b, info } = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } }).blur(Math.max(0.3, r / 2)).raw().toBuffer({ resolveWithObject: true });
  const C = info.channels, o = Buffer.alloc(w * h); for (let i = 0; i < o.length; i++) o[i] = b[i * C] > 18 ? 255 : 0; return o;
}
async function sticker(buf, ink = 7, edge = 8) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, a = Buffer.alloc(w * h);
  for (let i = 0; i < a.length; i++) a[i] = data[i * 4 + 3] > 40 ? 255 : 0;
  const black = await grow(a, w, h, ink), white = await grow(black, w, h, edge);
  const layer = (m, v) => { const o = Buffer.alloc(w * h * 4); for (let i = 0; i < m.length; i++) { o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = v; o[i * 4 + 3] = m[i]; } return sharp(o, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer(); };
  return sharp(await layer(white, 250)).composite([{ input: await layer(black, 20) }, { input: await sharp(buf).ensureAlpha().png().toBuffer() }]).png().toBuffer();
}
// Trim to the ink, then pad into a W x H canvas with the base ON the bottom edge.
const rimmed = async (buf) => sticker(await sharp(buf).ensureAlpha().extend({ top: 24, bottom: 24, left: 24, right: 24, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer());
async function plant(buf, rim) {
  if (rim) buf = await rimmed(buf);
  const t = await sharp(buf).ensureAlpha().trim({ threshold: 10 }).png().toBuffer();
  const m = await sharp(t).metadata();
  const s = Math.min((W * 0.96) / m.width, (H * 0.96) / m.height);
  const rw = Math.round(m.width * s), rh = Math.round(m.height * s);
  const r = await sharp(t).resize(rw, rh).png().toBuffer();
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: r, left: Math.round((W - rw) / 2), top: H - rh }]).png().toBuffer();
}

async function still() {
  fs.mkdirSync(REVIEW, { recursive: true });
  for (let n = 1; n <= 4; n++) {
    process.stdout.write(`still ${n} ... `);
    try {
      const d = await ludo('assets/image', { image_type: 'sprite', art_style: 'Illustration', aspect_ratio: 'ar_16_9', n: 1, augment_prompt: false, prompt: PROMPT });
      const url = Array.isArray(d) ? d[0] && d[0].url : d.url;
      if (!url) throw new Error('no url');
      const raw = await fetchBuf(url);
      fs.writeFileSync(path.join(REVIEW, `still_${n}.png`), await sharp(raw).png().toBuffer());
      console.log(JSON.stringify(await grade(raw)));
    } catch (e) { console.log('failed: ' + e.message); if (/402/.test(e.message)) process.exit(3); }
  }
}
async function pick(n) {
  const raw = fs.readFileSync(path.join(REVIEW, `still_${n}.png`));
  const g = await grade(raw);
  if (g.empty || !g.transparentBg || g.base < 0.6) { console.error('REJECTED: ' + JSON.stringify(g)); process.exit(1); }
  const planted = await plant(raw, false);   // ludo animates the plain wave; the rim is added per frame after
  fs.mkdirSync(path.dirname(SEED), { recursive: true });
  fs.writeFileSync(SEED + '.tmp', planted); fs.renameSync(SEED + '.tmp', SEED);
  fs.writeFileSync(STILL + '.tmp', await sharp(await plant(raw, true)).webp({ quality: 92, alphaQuality: 100 }).toBuffer()); fs.renameSync(STILL + '.tmp', STILL);
  console.log('wrote seed + ' + path.relative(ROOT, STILL) + ' ' + JSON.stringify(await grade(planted)));
}

async function framesFrom(data, n) {
  const d = Array.isArray(data) ? data[0] : data;
  if (d.spritesheet_url && d.num_cols && d.num_rows) {
    const sheet = await fetchBuf(d.spritesheet_url), meta = await sharp(sheet).metadata();
    const cw = Math.floor(meta.width / d.num_cols), ch = Math.floor(meta.height / d.num_rows), o = [];
    for (let r = 0; r < d.num_rows && o.length < n; r++) for (let c = 0; c < d.num_cols && o.length < n; c++) o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  const urls = d.individual_frame_urls || [];
  if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  throw new Error('no usable frames');
}
// Mean frame-to-frame change over the opaque area (a set that barely moves is rejected).
async function motion(bufs) {
  const raws = []; for (const b of bufs) raws.push(await sharp(b).resize(128, 72, { fit: 'fill' }).ensureAlpha().raw().toBuffer());
  let t = 0;
  for (let i = 1; i < raws.length; i++) {
    let d = 0, n = 0;
    for (let p = 0; p < raws[i].length; p += 4) {
      if (raws[i][p + 3] < 20 && raws[i - 1][p + 3] < 20) continue;
      n++; d += Math.abs(raws[i][p] - raws[i - 1][p]) + Math.abs(raws[i][p + 1] - raws[i - 1][p + 1]) + Math.abs(raws[i][p + 2] - raws[i - 1][p + 2]) + Math.abs(raws[i][p + 3] - raws[i - 1][p + 3]);
    }
    if (n) t += d / n;
  }
  return t / Math.max(1, raws.length - 1);
}
async function animate() {
  if (!fs.existsSync(SEED)) { console.error('no seed - run --pick=N first'); process.exit(1); }
  fs.mkdirSync(REVIEW, { recursive: true });
  const uri = 'data:image/png;base64,' + fs.readFileSync(SEED).toString('base64');
  for (let attempt = 1; attempt <= 3; attempt++) {
    process.stdout.write(`animate attempt ${attempt} ... `);
    try {
      const raw = await framesFrom(await ludo('assets/sprite/animate', { initial_image: uri, motion_prompt: MOTION, frames: 9, frame_size: -9, model: 'eagle', individual_frames: true }, 600000), 9);
      const g = [];
      for (let i = 0; i < 9; i++) { fs.writeFileSync(path.join(REVIEW, `raw_${attempt}_${i}.png`), await sharp(raw[i]).png().toBuffer()); g.push(await grade(raw[i])); }
      const score = await motion(raw);
      const bad = g.findIndex((x) => x.empty || !x.transparentBg || x.base < 0.5);
      // Every frame gets planted the same way, so drift in the raw set cannot move the wave off the floor;
      // what IS gated is that each frame still has its flat base and a clear background.
      console.log(`motion ${score.toFixed(1)} base ${g.map((x) => (x.base || 0).toFixed(2)).join(' ')}${bad >= 0 ? ' rejected: frame ' + bad : ''}`);
      if (bad >= 0 || score < 8) continue;
      // Plant every frame with ONE shared scale (the widest frame's), so the wave does not pulse in size.
      const trims = []; for (const b of raw) trims.push(await sharp(await rimmed(b)).ensureAlpha().trim({ threshold: 10 }).png().toBuffer());
      const metas = []; for (const t of trims) metas.push(await sharp(t).metadata());
      const s = Math.min(...metas.map((m) => Math.min((W * 0.96) / m.width, (H * 0.96) / m.height)));
      fs.mkdirSync(ANIM, { recursive: true });
      for (let i = 0; i < 9; i++) {
        const rw = Math.round(metas[i].width * s), rh = Math.round(metas[i].height * s);
        const r = await sharp(trims[i]).resize(rw, rh).png().toBuffer();
        const out = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
          .composite([{ input: r, left: Math.round((W - rw) / 2), top: H - rh }]).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
        const f = path.join(ANIM, `${NAME}_${i}.webp`);
        fs.writeFileSync(f + '.tmp', out); fs.renameSync(f + '.tmp', f);
      }
      console.log(`wrote ${NAME}_0..8.webp`);
      return;
    } catch (e) { console.log('failed: ' + e.message); if (/402/.test(e.message)) process.exit(3); await sleep(4000 * attempt); }
  }
  console.error('FAILED: no roll passed - nothing written'); process.exit(1);
}

if ((arg('still') || arg('animate')) && !KEY) { console.error('LUDO_API_KEY is not set'); process.exit(1); }
if (arg('still')) await still();
else if (arg('pick')) await pick(arg('pick'));
else if (arg('animate')) await animate();
else console.log('usage: --still | --pick=N | --animate');
