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

// ludo animates the user's ORIGINAL painting, not the carved/translucent still: animating the thin
// see-through version gave it too little to hold and it came back repainted as a veined flame
// (palette 169 off, first two frames nearly empty). The carve and the fade are applied to its output
// afterwards by gen_warrior_shockwave_shape.mjs --frames.
const STILL = 'scripts/seeds/warrior_shockwave_carved.webp';
const ANIM = 'Sprites/projectiles/anim';
const NAME = 'warrior_shockwave';
const TRAIL = 'scripts/seeds/warrior_shockwave_trail.webp';   // the still + its painted flame trail
// --raw-palette keeps ludo's own colour instead of mapping it onto the bare blade's statistics.
// Default ON whenever the source already carries flame (see the note in _tmp history / below).
const RAW_PAL = process.argv.includes('--raw-palette');
const SIZE = 768, FEATHER = 40;
// The still is a deep-red crescent blade-wave, convex edge leading to the RIGHT (the draw path
// rotates it to its own heading from a right-facing source). The motion has to stay INSIDE that
// silhouette: this is one swing's wave, not a new shape per frame.
// v0.30.x — RE-SPEC, and it reverses the previous one. The set used to be authored to
// "a smooth crescent transforming into a fireball" (the user's earlier wording), and the shape gates
// below were deliberately widened to let that through. Measured on the shipped frames, that is
// exactly what it does and it does not read in motion: the hollow inside the crescent fills in from
// frame 4 and by frame 6 the bounding box is 61% solid and square (aspect 0.99) - a ball. Per user:
// "it should stay a crescent throughout but have a trail of flame". So the silhouette is now held
// and the FLAME is what animates.
const MOTION = 'A deep red crescent blade-wave hangs in the frame and NEVER changes its shape. In every single '
  + 'frame it is the SAME crescent: the same curved arc, the same thickness, the same orientation, its convex '
  + 'edge leading to the RIGHT and its hollow concave side open to the LEFT. It does NOT curl up, does NOT '
  + 'close, does NOT roll inward, does NOT thicken, and NEVER becomes a ball, sphere, fireball, ring or disc - '
  + 'the empty space inside the curve stays empty in all nine frames. What MOVES is FIRE: a trail of flame '
  + 'streams backwards off the crescent to the LEFT, long tongues of red and orange fire flowing and flickering '
  + 'and trailing away from the concave side, and the bright hot inner edge of the blade flares and pulses. '
  + 'Think of a burning blade held still in a wind - the blade is rigid, only the flame moves. Keep it SMOOTH '
  + 'and clean: flowing fire and soft glow, NO speckles, NO grain, NO scattered dots, NO torn debris, NO sparks '
  + 'flying off. The crescent stays CENTRED and the same size throughout: it does not slide, pan, drift, grow, '
  + 'shrink, rotate or flip. Keep the exact same deep red and crimson palette, the same smooth painterly style '
  + 'and a fully transparent background in every frame.';

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
// Two numbers per frame, both read inside the frame's own bounding box:
//   fill  ink / bbox area          - a thin arc is sparse, a solid blob is not
//   core  ink in the middle 34%    - THE crescent test: the hollow must stay hollow
async function enclosedOf(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels, n = W * H;
  const clear = new Uint8Array(n); let empty = 0;
  for (let i = 0; i < n; i++) { clear[i] = data[i * C + 3] <= 40 ? 1 : 0; if (clear[i]) empty++; }
  const seen = new Uint8Array(n), st = new Int32Array(n); let t = 0;
  for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { const i = y * W + x; if (clear[i] && !seen[i]) { seen[i] = 1; st[t++] = i; } }
  for (let y = 0; y < H; y++) for (const x of [0, W - 1]) { const i = y * W + x; if (clear[i] && !seen[i]) { seen[i] = 1; st[t++] = i; } }
  let out = 0;
  while (t) {
    const i = st[--t]; out++; const x = i % W, y = (i - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const q = ny * W + nx; if (clear[q] && !seen[q]) { seen[q] = 1; st[t++] = q; }
    }
  }
  return (empty - out) / n;
}
async function shapeOf(bufs) {
  let fill = 0, core = 0, ring = 0;
  for (const b of bufs) {
    const { data, info } = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: W, height: H, channels: C } = info;
    const A = (x, y) => data[(y * W + x) * C + 3];
    let ink = 0, x0 = W, x1 = -1, y0 = H, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (A(x, y) <= 40) continue;
      ink++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0) continue;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    fill = Math.max(fill, ink / (bw * bh));
    const cx0 = Math.round(x0 + bw * 0.33), cx1 = Math.round(x0 + bw * 0.67);
    const cy0 = Math.round(y0 + bh * 0.33), cy1 = Math.round(y0 + bh * 0.67);
    let cInk = 0, cN = 0;
    for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) { cN++; if (A(x, y) > 40) cInk++; }
    if (cN) core = Math.max(core, cInk / cN);
    ring = Math.max(ring, await enclosedOf(b));
  }
  return { fill, core, ring };
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

// Paint the flame trail onto the user's crescent. The blade is his art and must survive intact, so
// the gate is the same crescent test the frames are held to (the hollow stays hollow) PLUS proof that
// something new actually appeared on the trailing side - an edit that changes nothing would otherwise
// sail through a shape gate.
const TRAIL_PROMPT = 'Keep this deep red crescent blade EXACTLY as it is: the same curve, the same thickness, '
  + 'the same position, the same size and the same deep red and crimson colour, and the hollow empty space '
  + 'inside the curve must stay COMPLETELY EMPTY. Do not redraw it, do not thicken it, do not close it, do not '
  + 'turn it into a ball, sphere, ring or disc. ADD a trail of fire streaming backwards off its hollow concave '
  + 'side to the LEFT: long smooth tongues of red and orange flame flowing away to the left, brightest and '
  + 'hottest where they leave the blade and fading softly to nothing at the far left. Smooth painterly fire and '
  + 'soft glow only - NO speckles, NO grain, NO scattered dots, NO sparks, NO debris. Fully transparent '
  + 'background.';

async function inkBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let x0 = W, x1 = -1, ink = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * C + 3] <= 40) continue;
    ink++; if (x < x0) x0 = x; if (x > x1) x1 = x;
  }
  return { x0, x1, ink, W };
}

async function trailPick(n) {
  const raw = path.join(ROOT, 'scripts', '_tmp_ws_review', `trail_raw_${n}.png`);
  if (!fs.existsSync(raw)) { console.error('no such roll: ' + raw); process.exit(1); }
  const still = fs.readFileSync(path.join(ROOT, STILL));
  const stillRef = await stats(still), stillMean = await meanRGB(still);
  const base = await inkBox(still);
  const cleaned = (await deBackground(await sharp(fs.readFileSync(raw)).ensureAlpha()
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer())).buf;
  const buf = RAW_PAL ? cleaned : await matchPalette(cleaned, stillRef);
  const { fill, core, ring } = await shapeOf([buf]);
  const bb = await inkBox(buf);
  const grew = (base.x0 / base.W) - (bb.x0 / bb.W);
  const hue = paletteDrift(await meanRGB(buf), stillMean);
  const good = core <= 0.55 && fill <= 0.42 && ring <= 0.02 && grew >= 0.03 && hue <= 40;
  console.log(`roll ${n}: core ${(core * 100).toFixed(0)}% fill ${(fill * 100).toFixed(0)}% ring ${(ring * 100).toFixed(1)}% trail +${(grew * 100).toFixed(1)}% palette ${hue.toFixed(0)} ${good ? 'OK' : 'REJECTED'}`);
  if (!good) process.exit(1);
  const out = path.join(ROOT, TRAIL);
  fs.writeFileSync(out + '.tmp', await sharp(buf).webp({ quality: 94, alphaQuality: 100 }).toBuffer());
  fs.renameSync(out + '.tmp', out);
  console.log('wrote ' + TRAIL);
}

async function trail() {
  const src = path.join(ROOT, STILL);
  const still = fs.readFileSync(src);
  const stillRef = await stats(still), stillMean = await meanRGB(still);
  const base = await inkBox(still);
  const uri = 'data:image/png;base64,' + (await sharp(still).resize(990, 990, { fit: 'inside' }).png().toBuffer()).toString('base64');
  const REVIEW = path.join(ROOT, 'scripts', '_tmp_ws_review');
  fs.mkdirSync(REVIEW, { recursive: true });
  let best = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    process.stdout.write(`trail attempt ${attempt} ... `);
    try {
      const d = await ludo('assets/image/edit', { image: uri, prompt: TRAIL_PROMPT, n: 1, augment_prompt: false }, 300000);
      const url = Array.isArray(d) ? (d[0] && d[0].url) : (d.url || (d.images && d.images[0] && d.images[0].url));
      if (!url) throw new Error('no url from image/edit');
      fs.writeFileSync(path.join(REVIEW, `trail_raw_${attempt}.png`), await fetchBuf(url));
      const cleaned = (await deBackground(await sharp(await fetchBuf(url)).ensureAlpha().resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer())).buf;
      const buf = RAW_PAL ? cleaned : await matchPalette(cleaned, stillRef);
      const { fill, core, ring } = await shapeOf([buf]);
      const bb = await inkBox(buf);
      // the trail has to reach further LEFT than the bare blade did, in canvas fractions
      const grew = (base.x0 / base.W) - (bb.x0 / bb.W);
      const hue = paletteDrift(await meanRGB(buf), stillMean);
      const good = core <= 0.55 && fill <= 0.42 && ring <= 0.02 && grew >= 0.03 && hue <= 40;
      console.log(`core ${(core * 100).toFixed(0)}% fill ${(fill * 100).toFixed(0)}% ring ${(ring * 100).toFixed(1)}% trail +${(grew * 100).toFixed(1)}% palette ${hue.toFixed(0)} ${good ? 'OK' : 'rejected'}`);
      if (!best || (good && !best.good) || (good === best.good && core < best.core)) best = { buf, core, fill, grew, hue, good };
      if (good) break;
    } catch (e) { console.log('failed: ' + e.message); if (/402/.test(e.message)) process.exit(3); await sleep(3000 * attempt); }
  }
  if (!best || !best.good) { console.error('FAILED: no usable trail seed'); process.exit(1); }
  const out = path.join(ROOT, TRAIL);
  fs.writeFileSync(out + '.tmp', await sharp(best.buf).webp({ quality: 94, alphaQuality: 100 }).toBuffer());
  fs.renameSync(out + '.tmp', out);
  console.log(`wrote ${TRAIL} (core ${(best.core * 100).toFixed(0)}%, trail +${(best.grew * 100).toFixed(1)}%)`);
}

async function animate() {
  // animate the TRAIL seed once it has been painted; the bare still is the fallback
  const src = fs.existsSync(path.join(ROOT, TRAIL)) ? path.join(ROOT, TRAIL) : path.join(ROOT, STILL);
  if (!fs.existsSync(src)) { console.error('missing ' + STILL); process.exit(1); }
  console.log('animating ' + path.relative(ROOT, src).replace(/\\/g, '/'));
  const REVIEW = path.join(ROOT, 'scripts', '_tmp_ws_review');
  fs.mkdirSync(REVIEW, { recursive: true });
  const stillMean = await meanRGB(fs.readFileSync(src));
  const stillRef = await stats(fs.readFileSync(src));
  const uri = 'data:image/png;base64,' + (await sharp(fs.readFileSync(src)).resize(990, 990, { fit: 'inside' }).png().toBuffer()).toString('base64');
  let best = null;
  // The widened shape gates are GONE with the fireball spec that needed them. The silhouette must
  // now hold, so scale is pulled back in (0.45 -> 0.22 — a flame trail may lengthen the box, the
  // blade may not swell) and the crescent test is added outright. core <= 0.30 is the one that
  // matters: the shipped fireball frames score 0.83-1.00 on it and would be rejected on sight.
  // Thresholds set against measured examples of each failure, not picked round:
  //   fill <= 0.40  a solid ball measures 0.42-0.61; the trailed crescent 0.32
  //   core <= 0.55  a ball measures 0.83-1.00; the trailed crescent 0.41 (a trail widens the bbox,
  //                 so the old 0.30 - right for a bare blade - rejected a good crescent outright)
  //   ring <= 0.02  a closed donut traps 0.15 of the canvas; a crescent traps 0.000-0.001
  const ok = (x) => x.score >= 12 && x.drift <= 0.14 && x.scale <= 0.22 && x.hue <= 34
    && x.core <= 0.55 && x.fill <= 0.40 && x.ring <= 0.02;
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
        bufs.push(RAW_PAL ? b : await matchPalette(b, stillRef));
      }
      const score = await motionScore(bufs);
      const { drift, scale } = await driftOf(bufs);
      const { fill, core, ring } = await shapeOf(bufs);
      let hue = 0;
      for (const b of bufs) hue = Math.max(hue, paletteDrift(await meanRGB(b), stillMean));
      const cand = { bufs, score, drift, scale, hue, fill, core, ring };
      console.log(`motion ${score.toFixed(1)} drift ${(drift * 100).toFixed(1)}% scale ${(scale * 100).toFixed(1)}% palette ${hue.toFixed(0)} (ludo returned ${hueRaw.toFixed(0)} off, corrected) | crescent: fill ${(fill * 100).toFixed(0)}% core ${(core * 100).toFixed(0)}% ring ${(ring * 100).toFixed(1)}%`);
      if (!best || (ok(cand) && !ok(best)) || (ok(cand) === ok(best) && cand.core < best.core)) best = cand;
      if (ok(cand)) break;                                // moves a lot, stays put, still his colours
      console.log(score < 12 ? '  rejected: too static'
        : ring > 0.02 ? `  rejected: the blade closed into a RING (traps ${(ring * 100).toFixed(1)}% of the canvas)`
        : (core > 0.55 || fill > 0.40) ? `  rejected: it stops being a crescent — the hollow fills in (core ${(core * 100).toFixed(0)}%, fill ${(fill * 100).toFixed(0)}%)`
        : (drift > 0.14 || scale > 0.22) ? '  rejected: it wanders or swells off its own hitbox'
        : `  rejected: the palette drifted from the still (mean rgb off by ${hue.toFixed(0)})`);
    } catch (e) { console.log('failed: ' + e.message); if (/402/.test(e.message)) process.exit(3); await sleep(4000 * attempt); }
  }
  // It used to keep the FIRST candidate as 'best' and write it even when every roll was rejected —
  // this run shipped a core-99% ball over the live frames after printing three rejections. A set that
  // fails the gates is not written at all now.
  if (!best) { console.error('FAILED: no usable animation'); process.exit(1); }
  if (!ok(best)) {
    console.error(`FAILED: no roll passed the gates (best: core ${(best.core * 100).toFixed(0)}%, ` +
      `fill ${(best.fill * 100).toFixed(0)}%, motion ${best.score.toFixed(1)}) — nothing written`);
    process.exit(1);
  }
  const dir = path.join(ROOT, ANIM);
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < 9; i++) {
    const f = path.join(dir, `${NAME}_${i}.webp`);
    fs.writeFileSync(f + '.tmp', await normalise(best.bufs[i])); fs.renameSync(f + '.tmp', f);
  }
  console.log(`wrote ${ANIM}/${NAME}_0..8.webp (motion ${best.score.toFixed(1)}, crescent core ${(best.core * 100).toFixed(0)}%)`);
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
const _pick = process.argv.find((a) => a.startsWith('--trail-pick='));
if (_pick) { await trailPick(_pick.split('=')[1]); }
else if (has('trail')) { if (!KEY) { console.error('LUDO_API_KEY is not set'); process.exit(1); } await trail(); }
if (has('animate')) { if (!KEY) { console.error('LUDO_API_KEY is not set'); process.exit(1); } await animate(); }
else console.log(`${NAME}: animates ${STILL} (the user's own art — never regenerated here) into ${ANIM}/${NAME}_0..8.webp\n  --animate to run\n`);
