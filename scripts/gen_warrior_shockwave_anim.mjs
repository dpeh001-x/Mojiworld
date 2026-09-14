#!/usr/bin/env node
// WARRIOR SHOCKWAVE — the nine frames for Somersault Smash's wave (ludo.ai).
// ============================================================================
// Per user: "Change somersault smash somersault projectile to the new sprite i added:
// warrior_shockwave" and "generate animation sequence for the warrior_shockwave using ludo.ai".
//
// The STILL IS THE USER'S OWN ART and is never regenerated or repainted here — this only animates
// it. Sprites/projectiles/warrior_shockwave.webp in, Sprites/projectiles/anim/warrior_shockwave_0..8
// out, with the same gates the other projectile sets are held to: the crescent has to MOVE
// (frame-to-frame delta) and it has to stay put while it does (ludo will otherwise "animate" a
// sprite by sliding or shrinking it, which in game reads as the projectile drifting off its hitbox).
//
//   LUDO_API_KEY=... node scripts/gen_warrior_shockwave_anim.mjs --animate
// After a drop: node scripts/gen_sprite_frame_index.mjs && node scripts/gen_assets_manifest.mjs
// The frames are NEW filenames, so no sw.js CACHE bump is required for them.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY = process.env.LUDO_API_KEY, API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const has = (f) => process.argv.includes('--' + f);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STILL = 'Sprites/projectiles/warrior_shockwave.webp';
const ANIM = 'Sprites/projectiles/anim';
const NAME = 'warrior_shockwave';
const SIZE = 768, FEATHER = 40;
// The still is a deep-red crescent blade-wave, convex edge leading to the RIGHT (the draw path
// rotates it to its own heading from a right-facing source). The motion has to stay INSIDE that
// silhouette: this is one swing's wave, not a new shape per frame.
const MOTION = 'The crescent blade-wave SURGES forward with strong visible change in every frame, spread '
  + 'evenly across all nine: the energy inside the crescent churns and streams along its length, its bright '
  + 'leading edge flares and pulses hotter, the thin tips at the top and bottom whip and trail, and small '
  + 'sparks and torn wisps of red energy peel off its trailing inner edge and stream backward to the left. '
  + 'CRITICAL - THE CRESCENT STAYS PUT: it keeps the same position, the same size, the same curve and the '
  + 'same rightward facing in every frame; nothing rotates, zooms, pans, mirrors or flips - only the energy '
  + 'and the sparks move. Keep the exact same deep red and crimson palette, the same painterly style and a '
  + 'fully transparent background in every frame.';

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
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(180000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

async function box(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) throw new Error('fully transparent');
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1, W, H };
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
const normalise = async (buf) => feather(await sharp(buf).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), FEATHER);

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
// across pixels that are dark and nearly colourless. The crescent is saturated RED, so its own body
// is never reached by a fill that only takes desaturated near-black.
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
  // The rim the background leaves behind. NOTE the saturation guard: the fill above only ever takes
  // dark and nearly COLOURLESS pixels, and this pass has to agree with it. Without that guard it
  // fades every dark pixel touching transparency — and this crescent is deep crimson (mean rgb
  // 153,33,34), so the first run ate its dark edges and handed back a thinner, pink-washed wave that
  // no longer matched the art the user drew.
  for (let pass = 0; pass < 2; pass++) {
    const kill = [];
    for (let i = 0; i < n; i++) {
      const p = i * 4;
      const r = data[p], g = data[p + 1], b = data[p + 2];
      if (data[p + 3] < 40 || r + g + b > 300) continue;
      if (Math.max(r, g, b) - Math.min(r, g, b) >= 46) continue;   // saturated: the art's own colour
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
// Mean colour over the opaque area. The frames must still be the user's crescent, and the way an
// animate pass (or a bad clean-up) goes wrong quietly is by REPAINTING it — the shape survives, the
// deep crimson comes back a pink wash, and nothing in a motion or drift score notices.
async function meanRGB(buf) {
  const { data } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0, r = 0, g = 0, b = 0;
  for (let p = 0; p < data.length; p += 4) if (data[p + 3] > 12) { n++; r += data[p]; g += data[p + 1]; b += data[p + 2]; }
  return n ? [r / n, g / n, b / n] : [0, 0, 0];
}
const paletteDrift = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));

// Per-channel mean and standard deviation over the opaque area.
async function stats(buf) {
  const { data } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = [0, 0, 0], s = [0, 0, 0], q = [0, 0, 0];
  for (let p = 0; p < data.length; p += 4) {
    if (data[p + 3] <= 12) continue;
    for (let c = 0; c < 3; c++) { const v = data[p + c]; n[c]++; s[c] += v; q[c] += v * v; }
  }
  return [0, 1, 2].map((c) => { const m = s[c] / Math.max(1, n[c]); return { m, sd: Math.sqrt(Math.max(1, q[c] / Math.max(1, n[c]) - m * m)) }; });
}
// Put the user's colours back on ludo's motion. Every pass came back the same way — the shape and
// the movement are right, the deep crimson is washed out to pink (mean rgb off by 46-52 on three
// separate jobs), and no amount of "keep the exact same palette" in the prompt changed it. So the
// palette is restored here instead of asked for: a per-channel linear map onto the STILL's own mean
// and spread, which moves the level and keeps the shading (a highlight stays a highlight) rather
// than a flat gain that would crush the bright inner edge into the body colour. RGB only — alpha,
// and therefore the silhouette and the feather, are untouched.
async function matchPalette(buf, ref) {
  const cur = await stats(buf);
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const k = [0, 1, 2].map((c) => Math.max(0.35, Math.min(2.5, ref[c].sd / cur[c].sd)));
  for (let p = 0; p < data.length; p += 4) {
    if (data[p + 3] === 0) continue;
    for (let c = 0; c < 3; c++) {
      const v = (data[p + c] - cur[c].m) * k[c] + ref[c].m;
      data[p + c] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function animate() {
  const src = path.join(ROOT, STILL);
  if (!fs.existsSync(src)) { console.error('missing ' + STILL); process.exit(1); }
  const REVIEW = path.join(ROOT, 'scripts', '_tmp_ws_review');
  fs.mkdirSync(REVIEW, { recursive: true });
  const stillMean = await meanRGB(fs.readFileSync(src));
  const stillRef = await stats(fs.readFileSync(src));
  const uri = 'data:image/png;base64,' + (await sharp(fs.readFileSync(src)).resize(990, 990, { fit: 'inside' }).png().toBuffer()).toString('base64');
  let best = null;
  const ok = (x) => x.score >= 12 && x.drift <= 0.07 && x.scale <= 0.18 && x.hue <= 34;
  for (let attempt = 1; attempt <= 3; attempt++) {
    process.stdout.write(`animate ${NAME} attempt ${attempt} ... `);
    try {
      const raw = await framesFrom(await ludo('assets/sprite/animate', { initial_image: uri, motion_prompt: MOTION, frames: 9, frame_size: -9, model: 'eagle', individual_frames: true }, 600000), 9);
      // keep the untouched frames: when a pass comes back wrong, this is what says whether ludo
      // repainted it or the clean-up did, without paying for another job to find out
      for (let i = 0; i < raw.length; i++) fs.writeFileSync(path.join(REVIEW, `raw_${attempt}_${i}.png`), raw[i]);
      const bufs = [];
      let hueRaw = 0;
      for (let i = 0; i < raw.length; i++) {
        const b = (await deBackground(raw[i])).buf;
        hueRaw = Math.max(hueRaw, paletteDrift(await meanRGB(b), stillMean));
        bufs.push(await matchPalette(b, stillRef));
      }
      const score = await motionScore(bufs);
      const { drift, scale } = await driftOf(bufs);
      let hue = 0;
      for (const b of bufs) hue = Math.max(hue, paletteDrift(await meanRGB(b), stillMean));
      const cand = { bufs, score, drift, scale, hue };
      console.log(`motion ${score.toFixed(1)} drift ${(drift * 100).toFixed(1)}% scale ${(scale * 100).toFixed(1)}% palette ${hue.toFixed(0)} (ludo returned ${hueRaw.toFixed(0)} off, corrected)`);
      if (!best || (ok(cand) && !ok(best))) best = cand;
      if (ok(cand)) break;                                // moves a lot, stays put, still his colours
      console.log(score < 12 ? '  rejected: too static'
        : (drift > 0.07 || scale > 0.18) ? '  rejected: the crescent wanders (it should animate in place)'
        : `  rejected: the palette drifted from the still (mean rgb off by ${hue.toFixed(0)})`);
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
if (has('recolour')) {
  const src = path.join(ROOT, STILL);
  const ref = await stats(fs.readFileSync(src));
  for (let i = 0; i < 9; i++) {
    const f = path.join(ROOT, ANIM, NAME + '_' + i + '.webp');
    if (!fs.existsSync(f)) continue;
    const out = await sharp(await matchPalette(fs.readFileSync(f), ref)).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
    fs.writeFileSync(f + '.tmp', out); fs.renameSync(f + '.tmp', f);
    console.log('recoloured ' + NAME + '_' + i + '.webp');
  }
}
if (has('animate')) { if (!KEY) { console.error('LUDO_API_KEY is not set'); process.exit(1); } await animate(); }
else console.log(`${NAME}: animates ${STILL} (the user's own art — never regenerated here) into ${ANIM}/${NAME}_0..8.webp\n  --animate to run\n`);
