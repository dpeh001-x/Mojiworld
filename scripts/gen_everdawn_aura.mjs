#!/usr/bin/env node
// EVERDAWN AURA (ludo.ai) - the post-game aura, painted. Per user: "Make everdawn aura sprite and animation with
// lots of splendor". v0.30.803 drew it as nine canvas strokes; this paints it in three layers:
//
//   Sprites/fx/dawn_halo.webp                a sun-mandala halo behind the hero   (static; the game turns it)
//   Sprites/fx/dawn_sigil.webp               a sunrise sigil on the ground        (static; turned, drawn in perspective)
//   Sprites/fx/dawn_aura.webp                the wings-of-dawn plume, still       (fallback for the loop)
//   Sprites/fx/anim/dawn_aura_0..8.webp      the plume, looping (the game ping-pongs and cross-fades the nine frames)
//
//   LUDO_API_KEY=... node scripts/gen_everdawn_aura.mjs --stills [--n 3] [--only halo,sigil,aura]
//   node scripts/gen_everdawn_aura.mjs --pick halo=1,sigil=2,aura=1
//   LUDO_API_KEY=... node scripts/gen_everdawn_aura.mjs --animate
// OUT_ROOT=<dir> writes under another tree. New filenames: no sw.js bump. Afterwards: gen_sprite_frame_index,
// gen_assets_manifest, gen_sprite_edges.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = process.env.OUT_ROOT ? path.resolve(process.env.OUT_ROOT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REVIEW = process.env.REVIEW_DIR ? path.resolve(process.env.REVIEW_DIR) : path.join(ROOT, 'scripts', '_tmp_dawn_review');
const KEY = process.env.LUDO_API_KEY, API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); if (a) return a.slice(k.length + 3); const i = process.argv.indexOf('--' + k); return (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[i + 1] : d; };
const has = (f) => process.argv.includes('--' + f);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(REVIEW, { recursive: true });
const FX = path.join(ROOT, 'Sprites', 'fx'), ANIM = path.join(FX, 'anim');
const SIZE = 512;
const PALETTE = 'Luminous gold, warm white, rose-gold, soft peach and a touch of dawn pink';
const ART = {
  halo: 'A circular radiant SUN MANDALA halo for a 2D fantasy game, viewed perfectly flat and face-on, radially symmetric: '
    + 'an ornate ring of fine golden filigree carrying a band of tiny sunrise glyphs; sixteen long tapering rays of golden-white '
    + 'light bursting outward from the ring, alternating with shorter rose-gold rays; delicate petal-shaped flares between them; '
    + 'tiny four-point star sparkles along the rays. The whole middle of the circle inside the ring is EMPTY and fully '
    + 'transparent. Majestic, divine, celebratory, a saint\'s halo made of sunrise. ' + PALETTE + ', glowing game VFX art on a '
    + 'fully transparent background, perfectly centred, the ray tips reaching the edges of the frame. NO character, NO face, NO text, NO background.',
  sigil: 'A circular SUNRISE SIGIL magic circle for a 2D fantasy game, viewed perfectly flat and face-on, radially symmetric: '
    + 'two thin concentric rings of golden light; between them a band of small sun glyphs and laurel leaves; a rosette of lotus '
    + 'petals of rose-gold light inside the inner ring; eight small sunburst points on the outer ring; tiny star sparkles. '
    + 'The very centre is EMPTY and fully transparent. Elegant, holy, triumphant. ' + PALETTE + ' linework, crisp clean game VFX '
    + 'art on a fully transparent background, perfectly centred, the outer ring touching the edges of the frame. NO character, NO text, NO background.',
  aura: 'A 2D game VFX aura seen from the front, bilaterally symmetric and perfectly centred: two great WINGS OF DAWN LIGHT made of '
    + 'long golden-white feathers of pure light, sweeping up and outward from the lower centre of the frame; between them a tall '
    + 'crown-shaped flare of rose-gold sunrise flame rising to the top; streaming ribbons of peach and pink aurora curling around '
    + 'the wings; many tiny star motes rising. The lower centre, where a small character would stand, is left EMPTY and transparent. '
    + 'Splendid, triumphant, divine. ' + PALETTE + '. Crisp glowing game effect on a fully transparent background, filling the '
    + 'frame. NO character, NO body, NO face, NO bird, NO text, NO background.',
};
const MOTION = 'The two wings of light slowly beat and shimmer, the long light feathers ripple upward one after another, the central '
  + 'crown flare surges and flickers like a slow holy flame, the aurora ribbons wave, star motes drift upward and twinkle. A gentle, '
  + 'majestic, continuous idle loop. Perfectly centred throughout: nothing pans, drifts or zooms the whole image, the wings stay '
  + 'symmetric. Same colours and style, transparent background.';

async function ludo(route, body, timeout = 400000) {
  const res = await fetch(`${API}/${route}`, { method: 'POST', headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(timeout), body: JSON.stringify(body) });
  if (res.status === 402) throw new Error('402 OUT OF CREDITS');
  const txt = await res.text(); if (!res.ok) throw new Error(`HTTP ${res.status} ${txt.slice(0, 160)}`);
  let j = JSON.parse(txt);
  if (res.status === 202 && j.id) {
    const id = j.id; let wait = Number(j.poll_after_ms) || 5000;
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
const urlsOf = (d) => { const a = Array.isArray(d) ? d : (d && (d.images || d.result || d.data)) || [d]; return a.map((x) => x && (x.url || x.image_url)).filter(Boolean); };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(180000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

// Glow art that comes back on an opaque dark background is turned into real alpha: alpha = brightest channel,
// colour un-premultiplied by it. Black becomes transparent and the glow keeps its falloff.
async function toAlpha(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const cornerA = data[3] + data[(W - 1) * 4 + 3] + data[((H - 1) * W) * 4 + 3] + data[((H - 1) * W + W - 1) * 4 + 3];
  if (cornerA === 0) return { buf: await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer(), converted: false };
  for (let p = 0; p < data.length; p += 4) {
    const r = data[p], g = data[p + 1], b = data[p + 2], m = Math.max(r, g, b);
    const a = Math.min(255, Math.round((data[p + 3] / 255) * Math.max(0, m - 10) * 1.07));
    if (a <= 0) { data[p + 3] = 0; continue; }
    const k = 255 / Math.max(1, m);
    data[p] = Math.min(255, Math.round(r * k)); data[p + 1] = Math.min(255, Math.round(g * k)); data[p + 2] = Math.min(255, Math.round(b * k)); data[p + 3] = a;
  }
  return { buf: await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer(), converted: true };
}
async function box(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) throw new Error('empty');
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, W, H };
}
// left/right mirror agreement of the alpha mask, 0..1 - the plume is drawn centred on the hero, so it must be symmetric
async function symmetry(buf) {
  const { data, info } = await sharp(buf).resize(128, 128, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; let same = 0, any = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W / 2; x++) { const a = data[(y * W + x) * 4 + 3] > 40, b = data[(y * W + (W - 1 - x)) * 4 + 3] > 40; if (a || b) { any++; if (a === b) same++; } }
  return any ? same / any : 0;
}
async function feather(buf, ramp) {   // alpha ramps to 0 over the outer `ramp` px so nothing ends on a hard canvas edge
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info; const sm = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4 + 3; if (!data[i]) continue; const r = sm(Math.min(x, y, W - 1 - x, H - 1 - y) / ramp); if (r < 1) data[i] = Math.round(data[i] * r); }
  return sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}
// The halo comes back with its middle painted in (a cream sun disc). Behind a hero that reads as a plate, so the
// disc is faded out towards the centre: clear inside r0, full strength from r1 (fractions of the width) - what is
// left is an inner glow hugging the filigree ring.
async function hollow(buf, r0, r1) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info; const sm = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4 + 3; if (!data[i]) continue; const r = Math.hypot(x - (W - 1) / 2, y - (H - 1) / 2) / W; if (r < r1) data[i] = Math.round(data[i] * sm((r - r0) / (r1 - r0))); }
  return sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}
async function squareTo(buf, b, size, margin) {   // centre-square the content box
  const side = Math.round(Math.max(b.w, b.h) * (1 + margin * 2)), cx = b.x0 + b.w / 2, cy = b.y0 + b.h / 2;
  const left = Math.round(cx - side / 2), top = Math.round(cy - side / 2);
  const ext = { top: Math.max(0, -top), left: Math.max(0, -left), bottom: Math.max(0, top + side - b.H), right: Math.max(0, left + side - b.W), background: { r: 0, g: 0, b: 0, alpha: 0 } };
  const padded = await sharp(buf).extend(ext).png().toBuffer();
  return sharp(padded).extract({ left: left + ext.left, top: top + ext.top, width: side, height: side }).resize(size, size).png().toBuffer();
}
async function sheet(files, out, S = 240, bg = { r: 96, g: 150, b: 110 }) {
  const cells = [];
  for (const [i, f] of files.entries()) cells.push({ input: await sharp(f).resize(S, S, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), left: 10 + i * (S + 10), top: 10 });
  await sharp({ create: { width: 20 + files.length * (S + 10), height: S + 20, channels: 4, background: { ...bg, alpha: 1 } } }).composite(cells).png().toFile(out);
  console.log('sheet -> ' + out);
}
async function stills(n) {
  for (const k of (arg('only') ? arg('only').split(',') : Object.keys(ART))) {
    const kept = [];
    for (let a = 1; a <= n + 2 && kept.length < n; a++) {
      process.stdout.write(`${k}: candidate ${a} ... `);
      try {
        const raw = await fetchBuf(urlsOf(await ludo('assets/image', { image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: ART[k] }))[0]);
        const { buf, converted } = await toAlpha(raw); const b = await box(buf);
        const fill = Math.max(b.w, b.h) / Math.max(b.W, b.H), round = Math.min(b.w, b.h) / Math.max(b.w, b.h), sym = await symmetry(buf);
        console.log(`fill ${(fill * 100) | 0}% roundness ${round.toFixed(2)} symmetry ${sym.toFixed(2)}${converted ? ' (dark bg -> alpha)' : ''}`);
        if (fill < 0.55) { console.log('  rejected: too small in frame'); continue; }
        if (k !== 'aura' && round < 0.85) { console.log('  rejected: not circular'); continue; }
        if (k === 'aura' && sym < 0.72) { console.log('  rejected: not symmetric'); continue; }
        const f = path.join(REVIEW, `${k}_${kept.length + 1}.png`);
        fs.writeFileSync(f, await feather(await squareTo(buf, b, SIZE, 0.03), 10));
        kept.push(f); console.log('  kept ' + path.basename(f));
      } catch (e) { console.log('failed: ' + e.message); if (/402/.test(e.message)) process.exit(3); await sleep(3000); }
    }
    if (kept.length) { await sheet(kept, path.join(REVIEW, `${k}_candidates.png`)); await sheet(kept, path.join(REVIEW, `${k}_candidates_dark.png`), 240, { r: 30, g: 26, b: 52 }); }
  }
}
async function pick(spec) {
  fs.mkdirSync(FX, { recursive: true });
  for (const kv of spec.split(',')) {
    const [k, i] = kv.split('='); const src = path.join(REVIEW, `${k}_${i}.png`);
    if (!ART[k] || !fs.existsSync(src)) throw new Error('no candidate ' + kv);
    const dst = path.join(FX, `dawn_${k}.webp`);
    const art = k === 'halo' ? await hollow(fs.readFileSync(src), 0.10, 0.19) : fs.readFileSync(src);
    fs.writeFileSync(dst + '.tmp', await sharp(art).webp({ quality: 92, alphaQuality: 100 }).toBuffer()); fs.renameSync(dst + '.tmp', dst);
    console.log(`installed Sprites/fx/dawn_${k}.webp from candidate ${i}${k === 'halo' ? ' (centre hollowed)' : ''}`);
  }
}
async function frames(data, n) {
  const d = Array.isArray(data) ? data[0] : data; const urls = d.individual_frame_urls || [];
  if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  if (d.spritesheet_url && d.num_cols && d.num_rows) {
    const s = await fetchBuf(d.spritesheet_url), m = await sharp(s).metadata(), cw = Math.floor(m.width / d.num_cols), ch = Math.floor(m.height / d.num_rows), o = [];
    for (let r = 0; r < d.num_rows && o.length < n; r++) for (let c = 0; c < d.num_cols && o.length < n; c++) o.push(await sharp(s).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  throw new Error('no usable frames');
}
async function animate() {
  const still = fs.readFileSync(path.join(FX, 'dawn_aura.webp'));
  // seat the plume at 84% of the canvas so the beating wings have room before the edge
  const seat = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp(still).resize(860, 860).png().toBuffer(), gravity: 'centre' }]).png().toBuffer();
  const uri = 'data:image/png;base64,' + (await sharp(seat).resize(990, 990).png().toBuffer()).toString('base64');
  let bufs = null;
  for (let a = 1; a <= 3 && !bufs; a++) {
    process.stdout.write(`aura: animate attempt ${a} ... `);
    try {
      const raw = await frames(await ludo('assets/sprite/animate', { initial_image: uri, motion_prompt: MOTION, frames: 9, frame_size: -9, model: 'eagle', individual_frames: true }, 600000), 9);
      const conv = []; for (const r of raw) conv.push((await toAlpha(await sharp(r).resize(1024, 1024, { fit: 'fill' }).png().toBuffer())).buf);
      const bs = []; for (const c of conv) bs.push(await box(c));
      let drift = 0; for (const b of bs) drift = Math.max(drift, Math.abs((b.x0 + b.w / 2) - (bs[0].x0 + bs[0].w / 2)) / 1024);
      console.log(`sideways drift ${(drift * 100).toFixed(1)}%`);
      if (drift > 0.06) { console.log('  rejected: the plume wanders off the hero'); continue; }
      // ONE union box for every frame, so the beat is real and nothing jitters
      const u = bs.reduce((o, b) => ({ x0: Math.min(o.x0, b.x0), y0: Math.min(o.y0, b.y0), x1: Math.max(o.x1, b.x1), y1: Math.max(o.y1, b.y1) }), { x0: 1e9, y0: 1e9, x1: -1, y1: -1 });
      const U = { ...u, w: u.x1 - u.x0 + 1, h: u.y1 - u.y0 + 1, W: 1024, H: 1024 };
      bufs = []; for (const c of conv) bufs.push(await feather(await squareTo(c, U, SIZE, 0.03), 14));
    } catch (e) { console.log('failed: ' + e.message); if (/402/.test(e.message)) process.exit(3); await sleep(4000 * a); }
  }
  if (!bufs) { console.error('no usable aura animation'); process.exit(1); }
  fs.mkdirSync(ANIM, { recursive: true }); const outs = [];
  for (let i = 0; i < 9; i++) { const f = path.join(ANIM, `dawn_aura_${i}.webp`); fs.writeFileSync(f + '.tmp', await sharp(bufs[i]).webp({ quality: 90, alphaQuality: 100 }).toBuffer()); fs.renameSync(f + '.tmp', f); outs.push(f); }
  await sheet(outs, path.join(REVIEW, 'aura_anim.png'), 150); await sheet(outs, path.join(REVIEW, 'aura_anim_dark.png'), 150, { r: 30, g: 26, b: 52 });
}
if (has('stills')) { if (!KEY) { console.error('LUDO_API_KEY is not set'); process.exit(1); } await stills(Number(arg('n', 3))); }
if (arg('pick')) await pick(arg('pick'));
if (has('animate')) { if (!KEY) { console.error('LUDO_API_KEY is not set'); process.exit(1); } await animate(); }
if (!has('stills') && !arg('pick') && !has('animate')) console.log('usage: --stills [--n 3] [--only halo,sigil,aura] | --pick halo=1,sigil=1,aura=1 | --animate');
