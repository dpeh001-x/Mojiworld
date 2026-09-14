#!/usr/bin/env node
// WAR OF BANNERS (warlord_ult) — the Warlord's Lv-50 ultimate, redrawn (ludo.ai).
// ============================================================================
// Per user: "Redo war of banners sprites and animation, make it much more legendary and epic".
// What was there: a gold banner standing over a row of tiny soldiers, nine frames that barely moved
// (the burst read as a still image), and a small flame-pennant for the wave it throws.
//
// Three pieces, each a still that is gated before it is written, then animated into nine frames:
//   cast   Sprites/fx/warlord_ult.webp + fx/anim/warlord_ult_0..8        the rally that opens the enrage
//   wave   Sprites/projectiles/p_ult_warlord.webp + projectiles/anim/…   the banner shockwave it throws
//   icon   Sprites/skills/warlord_ult.webp                               the skill-bar emblem
//
//   LUDO_API_KEY=... node scripts/gen_war_of_banners.mjs --gen [--only=cast,wave,icon] [--n=3]
//   node scripts/gen_war_of_banners.mjs --pick cast=2         # candidate -> the still + its animation
//   node scripts/gen_war_of_banners.mjs --animate --only=cast # still -> nine frames
// After a drop: node scripts/gen_sprite_frame_index.mjs && node scripts/animator_parity_check.mjs
// and bump sw.js CACHE — these replace art under their own names.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REVIEW = path.join(ROOT, 'scripts', '_tmp_wob_review');
const KEY = process.env.LUDO_API_KEY, API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
// accepts --k=v and '--k v': the second form is what anyone types first, and silently listing the
// prompts instead of doing the work (which is what the =-only form did) wastes a generation run.
const arg = (k, d) => { const i = process.argv.findIndex((x) => x === '--' + k); if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1];
  const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const has = (f) => process.argv.includes('--' + f);
const only = (arg('only', '') || '').split(',').filter(Boolean);
const want = (k) => !only.length || only.includes(k);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(REVIEW, { recursive: true });

// The palette is the skill's: crimson cloth, gold trim and light, on transparency. "Legendary" here
// means SCALE and a clear read at speed - one enormous standard, not a crowd of small things.
const PIECES = {
  cast: {
    out: 'Sprites/fx/warlord_ult.webp', size: 768, aspect: 'ar_1_1', feather: 56, minFill: 0.62,
    prompt: 'A single 2D game VFX sprite on a fully transparent background: a colossal war standard driven into the ground, '
      + 'seen flat from the side. An enormous crimson banner on a dark iron pole with a golden winged crest at its top, the cloth '
      + 'billowing wide and heavy with gold trim and a gold emblem on it, and behind it a blast of golden light - broad rays fanning '
      + 'upward and outward, a bright shockwave ring of gold light snapping outward along the ground at the pole base, streaming '
      + 'embers and gold sparks, and two smaller crimson banners rising at either side. Heroic, triumphant, legendary. Painterly '
      + 'hand-painted game art, rich saturated crimson and gold, bold readable silhouette, soft luminous glow bleeding into the '
      + 'transparency, NO hard black outline. Centred, symmetric left to right, filling the frame. NO character, NO soldiers, NO '
      + 'crowd, NO ground plane, NO scene, NO text, NO watermark, NO background.',
    motion: 'The rally ERUPTS with strong visible change in every frame, spread evenly across all nine, and nothing is still: '
      + 'frames 1-3 the standard drives down and the golden shockwave ring snaps outward along the ground while the light rays '
      + 'flare out to full length; frames 4-6 the banner cloth billows and ripples hard, the side banners rise, embers stream '
      + 'upward, the ring races wider and thins; frames 7-9 the rays retract and fade, the cloth settles into a slow wave, the '
      + 'embers scatter and the whole burst dims toward transparency. CRITICAL - DO NOT ROTATE the image as a whole: no spin, no '
      + 'turn, no mirror, no flip, no zoom, no pan. The pole stays at the same place and angle in every frame. Keep the exact same '
      + 'crimson-and-gold palette, the same painterly style and a fully transparent background in every frame.',
  },
  wave: {
    out: 'Sprites/projectiles/p_ult_warlord.webp', size: 512, aspect: 'ar_1_1', feather: 40, minFill: 0.55,
    prompt: 'A single 2D game VFX sprite on a fully transparent background: a crescent shockwave of war-banner cloth flying to the '
      + 'RIGHT, seen flat from the side. A tall curved blade-like arc of crimson banner cloth with a bright gold leading edge and '
      + 'gold trim, torn and streaming at its trailing edge, with golden speed streaks and sparks trailing behind it to the left '
      + 'and a soft golden glow ahead of it. Powerful, heavy, fast. Painterly hand-painted game art, rich saturated crimson and '
      + 'gold, bold readable silhouette, soft luminous glow, NO hard black outline. Centred, filling the frame, taller than it is '
      + 'wide. NO pole, NO spear, NO character, NO ground, NO text, NO watermark, NO background.',
    motion: 'The banner wave SURGES forward with strong visible change in every frame, spread evenly across all nine: the cloth '
      + 'ripples and snaps along its length, the gold leading edge flares and pulses brighter, the torn trailing edge whips, and '
      + 'the speed streaks and sparks stream backward and renew. CRITICAL - THE SHAPE STAYS PUT: the crescent keeps the same '
      + 'position, size and facing in every frame; nothing rotates, zooms, pans, mirrors or flips - only the cloth and the light '
      + 'move. Keep the exact same crimson-and-gold palette, the same painterly style and a fully transparent background in every frame.',
  },
  icon: {
    out: 'Sprites/skills/warlord_ult.webp', size: 256, aspect: 'ar_1_1', feather: 0, minFill: 0.55, icon: true,
    prompt: 'Mobile game SKILL ICON — a single bold emblem floating FREE on a FULLY TRANSPARENT background (alpha only). '
      + 'ABSOLUTELY NO frame, NO border, NO box, NO rounded-square, NO circle badge, NO panel, NO background fill, NO ground, NO scene. '
      + 'A crimson war banner on a dark iron pole with a golden winged crest finial, the cloth billowing wide with gold trim and a '
      + 'gold emblem, crossed by a burst of golden rally light and a few gold sparks. Chibi anime style: thick dark outline around '
      + 'the emblem, vibrant saturated colours, soft cel shading, bright additive glow. Strong centred composition filling about 85% '
      + 'of the square canvas. ABSOLUTELY NO TEXT: no letters, numbers, words or watermark. Bold, clean, readable at small size.',
  },
};

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
// alpha ramps to zero over the outermost `ramp` px, so a burst fades instead of being guillotined
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
async function normalise(buf, P) {
  if (P.icon) {                                   // icons are trimmed and seated at 86%, like the rest of the bar
    const t = await sharp(buf).ensureAlpha().trim({ threshold: 8 }).png().toBuffer();
    const inner = Math.round(P.size * 0.86);
    const fitted = await sharp(t).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    return sharp({ create: { width: P.size, height: P.size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: fitted, gravity: 'center' }]).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
  }
  const sq = await sharp(buf).resize(P.size, P.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return feather(sq, P.feather);
}

async function makeStills(n) {
  const sheetFiles = [];
  for (const [key, P] of Object.entries(PIECES)) {
    if (!want(key)) continue;
    for (let k = 1, got = 0; got < n && k <= n + 4; k++) {
      process.stdout.write(`${key} candidate ${k} ... `);
      try {
        const raw = await fetchBuf(urlOf(await ludo('assets/image', { image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: P.aspect, n: 1, augment_prompt: false, prompt: P.prompt })));
        const b = await box(raw);
        const fill = Math.max(b.w, b.h) / Math.max(b.W, b.H);
        console.log(`content ${b.w}x${b.h} fill ${(fill * 100) | 0}% cornerA ${b.corner}`);
        if (b.corner > 0) { console.log('  rejected: background is not transparent'); continue; }
        if (fill < P.minFill) { console.log(`  rejected: too small in frame (want >= ${(P.minFill * 100) | 0}%)`); continue; }
        got++;
        const f = path.join(REVIEW, `${key}_${got}.webp`);
        fs.writeFileSync(f, await normalise(raw, P));
        fs.writeFileSync(path.join(REVIEW, `${key}_${got}_raw.png`), raw);
        sheetFiles.push(f);
        console.log('  kept as ' + path.basename(f));
      } catch (e) { console.log('failed: ' + e.message); if (/402/.test(e.message)) process.exit(3); await sleep(2500); }
    }
  }
  if (sheetFiles.length) await sheet(sheetFiles, path.join(REVIEW, 'candidates.png'));
}
async function sheet(files, out) {
  const cells = []; const S = 200;
  for (const [i, f] of files.entries()) cells.push({ input: await sharp(f).resize(S, S, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), left: 10 + i * (S + 10), top: 10 });
  await sharp({ create: { width: 20 + files.length * (S + 10), height: S + 20, channels: 4, background: { r: 32, g: 36, b: 50, alpha: 1 } } }).composite(cells).png().toFile(out);
  console.log('sheet -> ' + path.relative(ROOT, out) + '  (' + files.map((f) => path.basename(f, '.webp')).join(' | ') + ')');
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
// how much the set actually MOVES: mean |frame - previous| over the opaque area. The old set scored
// near zero - nine near-identical frames - which is exactly what "make it epic" has to fix.

// A dark background baked into a frame: flood-fill from the outer BAND (not the outermost ring - the
// frames get feathered, so their edge pixels are already transparent and a ring seed finds nothing)
// across pixels that are dark and nearly colourless. Only background connected to the edge goes, so
// the pole and the outlines inside the art are never reached.
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
// How far the art WANDERS across the set: the alpha bbox centre and size per frame, against the first.
// A burst may fade and shrink at its tail, so only the body of the set (frames 0-5) is held to it.
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
async function animate(key) {
  const P = PIECES[key];
  if (!P.motion) { console.log(key + ': no animation for this piece'); return; }
  const stillPath = path.join(ROOT, P.out);
  const dir = key === 'wave' ? path.join(ROOT, 'Sprites/projectiles/anim') : path.join(ROOT, 'Sprites/fx/anim');
  const name = key === 'wave' ? 'p_ult_warlord' : 'warlord_ult';
  const uri = 'data:image/png;base64,' + (await sharp(fs.readFileSync(stillPath)).resize(990, 990, { fit: 'inside' }).png().toBuffer()).toString('base64');
  let best = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    process.stdout.write(`animate ${name} attempt ${attempt} ... `);
    try {
      let bufs = await framesFrom(await ludo('assets/sprite/animate', { initial_image: uri, motion_prompt: P.motion, frames: 9, frame_size: -9, model: 'eagle', individual_frames: true }, 600000), 9);
      let cleared = 0;
      for (let i = 0; i < bufs.length; i++) { const d = await deBackground(bufs[i]); bufs[i] = d.buf; cleared = Math.max(cleared, d.cleared); }
      const score = await motionScore(bufs);
      const { drift, scale } = await driftOf(bufs);
      console.log(`motion ${score.toFixed(1)} drift ${(drift * 100).toFixed(1)}% scale ${(scale * 100).toFixed(1)}% background-stripped ${(cleared * 100).toFixed(0)}%`);
      if (!best || (score >= 12 && drift <= 0.07 && scale <= 0.18 && !(best.score >= 12 && best.drift <= 0.07 && best.scale <= 0.18))) best = { bufs, score, drift, scale };
      if (score >= 12 && drift <= 0.07 && scale <= 0.18) break;   // moves a lot, stays where it was put
      console.log(score < 12 ? '  rejected: too static' : '  rejected: the art wanders (it should animate in place)');
    } catch (e) { console.log('failed: ' + e.message); if (/402/.test(e.message)) process.exit(3); await sleep(4000 * attempt); }
  }
  if (!best) { console.error('FAILED: no usable animation for ' + key); process.exit(1); }
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < 9; i++) {
    const f = path.join(dir, `${name}_${i}.webp`);
    fs.writeFileSync(f + '.tmp', await normalise(best.bufs[i], P)); fs.renameSync(f + '.tmp', f);
  }
  console.log(`wrote ${path.relative(ROOT, dir)}/${name}_0..8.webp (motion ${best.score.toFixed(1)})`);
}
if (has('gen')) { if (!KEY) { console.error('LUDO_API_KEY is not set'); process.exit(1); } await makeStills(Number(arg('n', 3))); }
if (arg('pick')) {
  for (const spec of arg('pick').split(',')) {
    const [key, k] = spec.split('=');
    const P = PIECES[key]; if (!P) throw new Error('unknown piece ' + key);
    const src = path.join(REVIEW, `${key}_${k}.webp`), dst = path.join(ROOT, P.out);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst + '.tmp'); fs.renameSync(dst + '.tmp', dst);
    console.log(`installed ${P.out} from candidate ${k}`);
  }
}
if (has('animate')) { if (!KEY) { console.error('LUDO_API_KEY is not set'); process.exit(1); } for (const k of Object.keys(PIECES)) if (want(k)) await animate(k); }
if (!has('gen') && !arg('pick') && !has('animate') && !has('bake')) for (const [k, P] of Object.entries(PIECES)) console.log(k + ' -> ' + P.out + '\n  ' + P.prompt.slice(0, 160) + '...\n');

// ---- BAKE ------------------------------------------------------------------------------------
// A fallback for when the animate endpoint is unavailable (it ran out of credits mid-pass) or when
// its frames wander. The nine frames are built from art we already have and NOTHING moves that should
// not: the standard is the still, planted, at one place and one size in every frame. The beat is
//   plant (a stretch, then a squash) -> the burst frames -> settle back to the planted standard -> fade.
// --keepBurst=1,2 names the animated frames worth keeping as the burst.
async function bakeCast() {
  // Built from the STILL alone. Blending the animated burst frames back toward the still ghosted into
  // a double banner (their standard sits at a different size), so the light is drawn here instead: an
  // impact flash and a ring running out along the ground, over a plant squash. Nothing drifts, nothing
  // changes size but the light, and the pole foot stays on the ground line in all nine frames.
  const P = PIECES.cast, S = P.size;
  const dir = path.join(ROOT, 'Sprites/fx/anim');
  const still = await sharp(path.join(ROOT, P.out)).resize(S, S, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().raw().toBuffer();
  const fade = (a, k) => { const o = Buffer.from(a); for (let p = 3; p < o.length; p += 4) o[p] = Math.round(o[p] * k); return o; };
  const squash = async (raw, sy) => {
    if (sy === 1) return raw;
    const h = Math.max(1, Math.round(S * sy));
    let scaled = await sharp(raw, { raw: { width: S, height: S, channels: 4 } }).resize(S, h, { fit: 'fill' }).png().toBuffer();
    if (h > S) scaled = await sharp(scaled).extract({ left: 0, top: h - S, width: S, height: S }).png().toBuffer();   // a stretch keeps its FOOT
    return sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: scaled, left: 0, top: h > S ? 0 : S - h }]).ensureAlpha().raw().toBuffer();
  };
  const light = (flash, ring, ringA) => {
    const rx = S * 0.10 + S * 0.40 * ring, ry = rx * 0.17, w = Math.max(2, 16 * (1 - ring));
    return Buffer.from('<svg width="' + S + '" height="' + S + '" xmlns="http://www.w3.org/2000/svg">'
      + '<defs><radialGradient id="f" cx="0.5" cy="0.84" r="0.5">'
      + '<stop offset="0" stop-color="#fff6d5" stop-opacity="' + flash + '"/>'
      + '<stop offset="0.45" stop-color="#ffc848" stop-opacity="' + (flash * 0.5) + '"/>'
      + '<stop offset="1" stop-color="#ffa02a" stop-opacity="0"/></radialGradient></defs>'
      + '<rect width="' + S + '" height="' + S + '" fill="url(#f)"/>'
      + '<ellipse cx="' + (S / 2) + '" cy="' + (S * 0.86) + '" rx="' + rx + '" ry="' + ry + '" fill="none" stroke="#ffd86b" stroke-opacity="' + ringA + '" stroke-width="' + w + '"/>'
      + '</svg>');
  };
  //            sy    flash  ring  ringA  alpha
  const plan = [[1.06, 0.00, 0.00, 0.00, 0.90],   // coming down
                [0.94, 0.62, 0.16, 0.95, 1.00],   // the hit
                [0.99, 0.34, 0.42, 0.85, 1.00],
                [1.01, 0.18, 0.66, 0.62, 1.00],
                [1.00, 0.08, 0.85, 0.38, 0.99],
                [1.00, 0.02, 1.00, 0.18, 0.92],   // planted; the ring has run past
                [1.00, 0.00, 0.00, 0.00, 0.74],
                [1.00, 0.00, 0.00, 0.00, 0.50],
                [1.00, 0.00, 0.00, 0.00, 0.26]];  // gone
  for (const [i, [sy, flash, ring, ringA, a]] of plan.entries()) {
    const body = await squash(still, sy);
    let png = await sharp(body, { raw: { width: S, height: S, channels: 4 } }).png().toBuffer();
    if (flash > 0 || ringA > 0) png = await sharp(png).composite([{ input: await sharp(light(flash, ring, ringA)).png().toBuffer(), blend: 'screen' }]).png().toBuffer();
    const lit = await sharp(png).ensureAlpha().raw().toBuffer();
    for (let p = 3; p < lit.length; p += 4) lit[p] = body[p];   // the light brightens the art; it does not add to its silhouette
    const out = fade(lit, a);
    const f = path.join(dir, 'warlord_ult_' + i + '.webp');
    fs.writeFileSync(f + '.tmp', await sharp(out, { raw: { width: S, height: S, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toBuffer());
    fs.renameSync(f + '.tmp', f);
  }
  console.log('baked Sprites/fx/anim/warlord_ult_0..8.webp from the still: plant squash + impact flash + ground ring, nothing drifts');
}
if (has('bake')) await bakeCast();
