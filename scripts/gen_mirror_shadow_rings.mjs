#!/usr/bin/env node
// MIRROR SHADOW rings (ludo.ai) — the clone's strike-radius sigil and its strike nova.
// ============================================================================
// Per user, after the clones were redrawn: "for the purple rings around it make it more artistic as well".
// The rings were canvas strokes: a flat 2px circle at the 110 px strike radius, a haze disc, a pulse ring
// through the body and two full-circle smooth-slash crescents per strike. This paints both as art:
//
//   Sprites/fx/clone_sigil.webp                 the strike-radius sigil (static; the game rotates it)
//   Sprites/fx/clone_strike.webp                the strike nova still (fallback)
//   Sprites/fx/anim/clone_strike_0..8.webp      the nova, played once per strike
//
//   LUDO_API_KEY=... node scripts/gen_mirror_shadow_rings.mjs --stills [--n 2]
//   node scripts/gen_mirror_shadow_rings.mjs --pick sigil=1,strike=2
//   LUDO_API_KEY=... node scripts/gen_mirror_shadow_rings.mjs --animate
// New filenames: no sw.js bump. Then gen_sprite_frame_index + gen_assets_manifest.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REVIEW = path.join(ROOT, 'scripts', '_tmp_ring_review');
const KEY = process.env.LUDO_API_KEY, API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); if (a) return a.slice(k.length + 3); const i = process.argv.indexOf('--' + k); return (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[i + 1] : d; };
const has = (f) => process.argv.includes('--' + f);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(REVIEW, { recursive: true });
const FX = path.join(ROOT, 'Sprites', 'fx'), ANIM = path.join(FX, 'anim');
const SIZE = 512;

const ART = {
  sigil: 'A circular arcane SHADOW SIGIL for a 2D fantasy game, viewed perfectly flat and face-on, radially symmetric: '
    + 'a thin crisp outer ring of glowing violet-magenta light; just inside it a band of small ninja-style shadow runes '
    + 'and tiny crescent moons; a second finer inner ring; eight small shuriken-star points and delicate thorn spikes '
    + 'spaced evenly around the band; faint wisps of dark indigo mist curling along the rim; tiny starlight sparks. '
    + 'The whole middle of the circle is EMPTY and fully transparent. Elegant, ominous, powerful. Glowing neon violet, '
    + 'magenta and lavender linework on a fully transparent background, crisp clean game VFX art, perfectly centred, '
    + 'the ring touching the edges of the frame. NO character, NO text, NO background.',
  strike: 'A 2D game VFX: a circular SHADOW BLADE NOVA viewed flat and face-on - three glowing violet-magenta crescent '
    + 'blade arcs sweeping around the centre in a spiral, trailing dark indigo shadow-flame and lavender sparks, a bright '
    + 'white-violet flash in the very centre. Radially balanced, perfectly centred, the space between the arcs transparent. '
    + 'Crisp glowing neon game effect on a fully transparent background, filling the frame. NO character, NO text, NO background.',
};
const MOTION = 'The three crescent blades sweep a full turn around the centre and spread outward, the central flash bursts '
  + 'and then fades, sparks fly outward and the shadow-flame trails dissipate, so the last frames are thinner and fainter. '
  + 'Perfectly centred throughout: nothing pans, drifts or zooms the whole image. Same colours and style, transparent background.';

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

// Glow art that comes back on an opaque dark background is turned into real alpha: alpha = brightest
// channel, colour un-premultiplied by it. Black becomes transparent and the glow keeps its falloff, so
// it composites correctly over the pale forest maps and the dark ones alike.
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
// alpha ramps to 0 over the outer `ramp` px so nothing ever ends on a hard canvas edge
async function feather(buf, ramp) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const sm = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4 + 3; if (!data[i]) continue;
    const r = sm(Math.min(x, y, W - 1 - x, H - 1 - y) / ramp); if (r < 1) data[i] = Math.round(data[i] * r);
  }
  return sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}
// centre-square the content: one transform per call (the anim uses a union box, see animate())
async function squareTo(buf, b, size, margin) {
  const side = Math.round(Math.max(b.w, b.h) * (1 + margin * 2));
  const cx = b.x0 + b.w / 2, cy = b.y0 + b.h / 2;
  const left = Math.round(cx - side / 2), top = Math.round(cy - side / 2);
  const ext = { top: Math.max(0, -top), left: Math.max(0, -left), bottom: Math.max(0, top + side - b.H), right: Math.max(0, left + side - b.W), background: { r: 0, g: 0, b: 0, alpha: 0 } };
  const padded = await sharp(buf).extend(ext).png().toBuffer();
  return sharp(padded).extract({ left: left + ext.left, top: top + ext.top, width: side, height: side }).resize(size, size).png().toBuffer();
}

async function sheet(files, out, S = 240, bg = { r: 60, g: 90, b: 70 }) {
  const cells = [];
  for (const [i, f] of files.entries()) cells.push({ input: await sharp(f).resize(S, S, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), left: 10 + i * (S + 10), top: 10 });
  await sharp({ create: { width: 20 + files.length * (S + 10), height: S + 20, channels: 4, background: { ...bg, alpha: 1 } } }).composite(cells).png().toFile(out);
  console.log('sheet -> ' + path.relative(ROOT, out));
}

async function stills(n) {
  for (const k of (arg('only') ? arg('only').split(',') : Object.keys(ART))) {
    const kept = [];
    for (let a = 1; a <= n + 2 && kept.length < n; a++) {
      process.stdout.write(`${k}: candidate ${a} ... `);
      try {
        const raw = await fetchBuf(urlsOf(await ludo('assets/image', { image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: ART[k] }))[0]);
        const { buf, converted } = await toAlpha(raw);
        const b = await box(buf);
        const fill = Math.max(b.w, b.h) / Math.max(b.W, b.H), round = Math.min(b.w, b.h) / Math.max(b.w, b.h);
        console.log(`fill ${(fill * 100) | 0}% roundness ${round.toFixed(2)}${converted ? ' (dark bg -> alpha)' : ''}`);
        if (fill < 0.55) { console.log('  rejected: too small in frame'); continue; }
        if (round < 0.85) { console.log('  rejected: not circular'); continue; }
        const f = path.join(REVIEW, `${k}_${kept.length + 1}.png`);
        fs.writeFileSync(f, await feather(await squareTo(buf, b, SIZE, 0.03), 10));
        kept.push(f); console.log('  kept ' + path.basename(f));
      } catch (e) { console.log('failed: ' + e.message); if (/402/.test(e.message)) process.exit(3); await sleep(3000); }
    }
    if (kept.length) { await sheet(kept, path.join(REVIEW, `${k}_candidates.png`)); await sheet(kept, path.join(REVIEW, `${k}_candidates_dark.png`), 240, { r: 40, g: 30, b: 56 }); }
  }
}

async function pick(spec) {
  for (const kv of spec.split(',')) {
    const [k, i] = kv.split('='); const src = path.join(REVIEW, `${k}_${i}.png`);
    if (!ART[k] || !fs.existsSync(src)) throw new Error('no candidate ' + kv);
    const dst = path.join(FX, `clone_${k}.webp`);
    fs.writeFileSync(dst + '.tmp', await sharp(src).webp({ quality: 92, alphaQuality: 100 }).toBuffer()); fs.renameSync(dst + '.tmp', dst);
    console.log(`installed Sprites/fx/clone_${k}.webp from candidate ${i}`);
  }
}

async function frames(data, n) {
  const d = Array.isArray(data) ? data[0] : data;
  const urls = d.individual_frame_urls || [];
  if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  if (d.spritesheet_url && d.num_cols && d.num_rows) {
    const s = await fetchBuf(d.spritesheet_url), m = await sharp(s).metadata(), cw = Math.floor(m.width / d.num_cols), ch = Math.floor(m.height / d.num_rows), o = [];
    for (let r = 0; r < d.num_rows && o.length < n; r++) for (let c = 0; c < d.num_cols && o.length < n; c++) o.push(await sharp(s).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  throw new Error('no usable frames');
}
async function animate() {
  const still = fs.readFileSync(path.join(FX, 'clone_strike.webp'));
  // seat the nova at 70% of the canvas so the outward spread has room before the edge
  const seat = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp(still).resize(716, 716).png().toBuffer(), gravity: 'centre' }]).png().toBuffer();
  const uri = 'data:image/png;base64,' + (await sharp(seat).resize(990, 990).png().toBuffer()).toString('base64');
  let bufs = null;
  for (let a = 1; a <= 3 && !bufs; a++) {
    process.stdout.write(`strike: animate attempt ${a} ... `);
    try {
      const raw = await frames(await ludo('assets/sprite/animate', { initial_image: uri, motion_prompt: MOTION, frames: 9, frame_size: -9, model: 'eagle', individual_frames: true }, 600000), 9);
      const conv = []; for (const r of raw) conv.push((await toAlpha(await sharp(r).resize(1024, 1024, { fit: 'fill' }).png().toBuffer())).buf);
      // centre drift across the set: a burst that slides off its clone reads as a miss
      const bs = []; for (const c of conv) bs.push(await box(c));
      let drift = 0; for (const b of bs) drift = Math.max(drift, Math.hypot((b.x0 + b.w / 2) - (bs[0].x0 + bs[0].w / 2), (b.y0 + b.h / 2) - (bs[0].y0 + bs[0].h / 2)) / 1024);
      console.log(`centre drift ${(drift * 100).toFixed(1)}%`);
      if (drift > 0.08) { console.log('  rejected: the nova wanders'); continue; }
      // ONE union box for every frame, so the spread is real and nothing jitters
      const u = bs.reduce((o, b) => ({ x0: Math.min(o.x0, b.x0), y0: Math.min(o.y0, b.y0), x1: Math.max(o.x1, b.x1), y1: Math.max(o.y1, b.y1) }), { x0: 1e9, y0: 1e9, x1: -1, y1: -1 });
      const U = { ...u, w: u.x1 - u.x0 + 1, h: u.y1 - u.y0 + 1, W: 1024, H: 1024 };
      bufs = []; for (const c of conv) bufs.push(await feather(await squareTo(c, U, SIZE, 0.03), 14));
    } catch (e) { console.log('failed: ' + e.message); if (/402/.test(e.message)) process.exit(3); await sleep(4000 * a); }
  }
  if (!bufs) { console.error('no usable strike animation'); process.exit(1); }
  fs.mkdirSync(ANIM, { recursive: true });
  const outs = [];
  for (let i = 0; i < 9; i++) {
    const f = path.join(ANIM, `clone_strike_${i}.webp`);
    fs.writeFileSync(f + '.tmp', await sharp(bufs[i]).webp({ quality: 90, alphaQuality: 100 }).toBuffer()); fs.renameSync(f + '.tmp', f); outs.push(f);
  }
  await sheet(outs, path.join(REVIEW, 'strike_anim.png'), 150);
}

if (has('stills')) { if (!KEY) { console.error('LUDO_API_KEY is not set'); process.exit(1); } await stills(Number(arg('n', 2))); }
if (arg('pick')) await pick(arg('pick'));
if (has('animate')) { if (!KEY) { console.error('LUDO_API_KEY is not set'); process.exit(1); } await animate(); }
if (!has('stills') && !arg('pick') && !has('animate')) console.log('usage: --stills [--n 2] [--only sigil] | --pick sigil=1,strike=1 | --animate');
