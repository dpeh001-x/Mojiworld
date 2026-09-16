#!/usr/bin/env node
// Knight GUARDIAN cast FX (ludo.ai):
//   base  -> <OUT>/knight_guardian_cand<N>.webp   (several candidates, pick one)
//   anim  -> <OUT>/anim/knight_guardian_0..8.webp  (a 9-frame loop from the chosen base)
//
//   node scripts/gen_knight_guardian_fx.mjs --generate --only=base [--n=3]
//   node scripts/gen_knight_guardian_fx.mjs --generate --only=anim --pick=<file>
//
// Per user: "For knight's skill guarding skill sprite and animation need to be larger and grander,
// more grandiose looking, ensure no cutoffs of canvas edges" (using ludo.ai).
//
// Guardian's cast was a single STATIC sprite - a gold cross in a glowing ring - grown 0.5x -> 1.1x
// over 50 frames at size 180. This draws a grander piece and gives it a real loop.
//
// Distinct from Holy Shield on purpose: that is a blue crystal kite shield in a thin ring, so this is
// a gold heraldic tower shield with WINGS and a massive halo - the knight's bulwark, not a barrier.
//
// Output goes to a STAGING folder (OS temp by default), never Sprites/: the working copy is shared
// with parallel sessions, and nothing lands there until the result has been seen and approved.
// The pipeline is scripts/gen_parry_riposte_fx.mjs: job-API polling on every endpoint, the base
// seated at a 0.26 margin before animating so the loop has room to grow, a union crop with one shared
// transform (no per-frame jitter), and a hard refusal of any frame with ink on the canvas border.
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
sharp.cache(false);

const OUT = process.env.KG_OUT || join(tmpdir(), 'kg_stage');
const ANIM_DIR = join(OUT, 'anim');
const FRAMES = 9, SIZE = 768;
const has = (f) => process.argv.includes(f);
const arg = (k) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : ''; };
const only = arg('only');

// Written to sit behind the knight: symmetrical about the vertical axis, centred, everything radiating
// from the shield. No spin in the engine for this one, so it does not need radial symmetry - mirror
// symmetry reads grander for a shield with wings.
const BASE_PROMPT =
  'A GRAND DIVINE AEGIS for a 2D fantasy game, a majestic holy guardian emblem viewed perfectly flat '
  + 'face-on, perfectly mirror-symmetrical left to right and centred: in the middle a tall ornate '
  + 'heraldic TOWER SHIELD of polished gold with white enamel panels and a raised radiant golden cross '
  + 'crest, gleaming gold filigree along its rim; from behind the shield two VAST SPREAD WINGS made of '
  + 'layered feathers of pure golden-white light sweep up and outward; behind everything a colossal '
  + 'HALO RING of interlocking gold rune plates, and long radiant light rays fanning out from the '
  + 'centre between the wings; tiny floating gold motes and four-pointed sparkles around it. '
  + 'Palette: white-hot core glow, rich gold and amber, warm honey bloom, a touch of pale sky-blue in '
  + 'the enamel. Flat 2D cartoon game sprite, bold clean shapes, crisp cel shading, thick dark outline, '
  + 'high contrast, readable silhouette, the whole emblem fully inside the frame with empty space on '
  + 'every side. Fully TRANSPARENT background. NO face, NO character, NO person, NO knight, NO hands, '
  + 'NO creature, NO text, NO letters, NO watermark, NO ground, NO shadow, NO background.';

const MOTION =
  'The holy aegis RADIATES and BREATHES continuously, with strong visible change in EVERY frame and no '
  + 'still or near-identical frames - the motion spread evenly across all nine frames: the two great '
  + 'wings of light slowly flare outward and settle back like a majestic wingbeat, their feather tips '
  + 'shimmering; the halo ring of gold rune plates lights up plate by plate in a travelling pulse that '
  + 'runs around the circle; the light rays behind lengthen and fade in alternating pairs; the golden '
  + 'cross crest on the shield pulses with a bright holy glow; gold motes and sparkles rise and twinkle. '
  + 'CRITICAL - DO NOT ROTATE: the emblem never spins or tilts; its orientation is identical in every frame. '
  + 'CRITICAL - LOCKED FRAMING: centred at the exact same size, position and scale in every frame; no '
  + 'zoom, pan, crop, rescale, drift, mirror or flip; the wing tips must stay well inside the frame. '
  + 'CRITICAL - SEAMLESS LOOP: the last frame flows straight back into the first with no pop. '
  + 'Keep the same art style, palette (white-hot, gold, amber, a touch of sky-blue enamel), thick dark '
  + 'outline and fully transparent background in every frame. No face, no character, no background.';

if (!has('--generate')) {
  console.log('# base\n' + BASE_PROMPT + '\n\n# anim\n' + MOTION + '\n\n# Re-run with --generate.');
  process.exit(0);
}
const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

// Job API (2026-09-11): a POST answers {id, status, poll_after_ms}; the payload arrives from
// GET /assets/jobs/<id>. The id is logged before polling so a crash never costs a re-POST.
async function awaitJob(data, label) {
  if (!data || !data.id || data.status === 'succeeded') return data;
  console.log(`  ${label}: job ${data.id} (${data.status})`);
  const t0 = Date.now();
  let wait = Number(data.poll_after_ms) || 5000;
  for (;;) {
    await sleep(Math.max(2500, Math.min(15000, wait)));
    const r = await fetch(`${API}/assets/jobs/${data.id}`, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(30000) });
    if (r.status === 429) { wait = Math.min(30000, wait * 2 + Math.random() * 3000); continue; }
    if (!r.ok) throw new Error(`job ${data.id}: ${r.status}`);
    const j = await r.json();
    if (j.status === 'succeeded') return j;
    if (j.status === 'failed' || j.status === 'cancelled') throw new Error('job ' + j.status + (j.error ? ': ' + String(j.error).slice(0, 120) : ''));
    if (Date.now() - t0 > 900000) throw new Error('job still running after 900 s');
    wait = Number(j.poll_after_ms) || 6000;
  }
}
async function post(path, body, timeoutMs) {
  for (let a = 1; ; a++) {
    const res = await fetch(`${API}${path}`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(timeoutMs), body: JSON.stringify(body) });
    if (res.status === 402) throw new Error('OUT OF CREDITS (402)');
    if (res.status === 429 && a < 8) { await sleep(8000 * a); continue; }   // queue full: wait, never a failure
    if (!res.ok) throw new Error(`${path} ${res.status}: ${(await res.text()).slice(0, 160)}`);
    return res.json();
  }
}
async function framesFrom(raw, n) {
  let data = raw || {};
  if (!data.spritesheet_url && !data.individual_frame_urls && data.result) {
    const r = data.result;
    if (Array.isArray(r) && r.length >= n && r[0] && r[0].url) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(r[i].url)); return o; }
    data = (Array.isArray(r) ? (r[0] || {}) : r) || {};
  }
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const cols = data.num_cols, rows = data.num_rows;
    const sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
    const cw = Math.floor(meta.width / cols), ch = Math.floor(meta.height / rows), o = [];
    for (let r = 0; r < rows && o.length < n; r++) for (let c = 0; c < cols && o.length < n; c++)
      o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  const urls = data.individual_frame_urls || [];
  if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  throw new Error('no usable frames in response; keys=' + Object.keys(raw || {}).join(',') + '|' + Object.keys(data || {}).join(','));
}

const EDGE_MARGIN = 0.045, ALPHA_ON = 8;
async function alphaBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  let x0 = w, y0 = h, x1 = -1, y1 = -1, clear = 0;
  for (let y = 0; y < h; y++) {
    const row = y * w * ch;
    for (let x = 0; x < w; x++) {
      const a = data[row + x * ch + (ch - 1)];
      if (a > ALPHA_ON) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } else clear++;
    }
  }
  if (x1 < 0) throw new Error('a frame is fully transparent');
  return { x0, y0, x1: x1 + 1, y1: y1 + 1, w, h, clearPct: 100 * clear / (w * h) };
}
async function packFrames(bufs) {
  const boxes = []; for (const b of bufs) boxes.push(await alphaBox(b));
  const W = boxes[0].w, H = boxes[0].h;
  if (boxes[0].clearPct < 5) throw new Error(`frame 0 is ${boxes[0].clearPct.toFixed(1)}% transparent - the loop came back without alpha`);
  const u = boxes.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }));
  const touched = [u.x0 <= 1 ? 'left' : null, u.y0 <= 1 ? 'top' : null, u.x1 >= W - 1 ? 'right' : null, u.y1 >= H - 1 ? 'bottom' : null].filter(Boolean);
  if (touched.length) throw new Error(`frames are clipped at the source canvas edge (${touched.join(', ')})`);
  const inner = Math.round(SIZE * (1 - 2 * EDGE_MARGIN));
  const cw = u.x1 - u.x0, chh = u.y1 - u.y0, scale = inner / Math.max(cw, chh);
  const out = [];
  for (const b of bufs) {
    const cropped = await sharp(b).extract({ left: u.x0, top: u.y0, width: cw, height: chh })
      .resize(Math.max(1, Math.round(cw * scale)), Math.max(1, Math.round(chh * scale)), { fit: 'fill' }).png().toBuffer();
    out.push(await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: cropped, gravity: 'centre' }]).webp({ quality: 92 }).toBuffer());
  }
  console.log(`  union ${cw}x${chh} of ${W}x${H} (min margin ${Math.min(u.x0, u.y0, W - u.x1, H - u.y1)}px), packed to ${inner}px`);
  return out;
}
async function assertNoCutoff(files) {
  for (const f of files) {
    const b = await alphaBox(await readFile(f));
    const hit = [b.x0 === 0 ? 'left' : null, b.y0 === 0 ? 'top' : null, b.x1 >= b.w ? 'right' : null, b.y1 >= b.h ? 'bottom' : null].filter(Boolean);
    if (hit.length) throw new Error(`${f} touches the canvas edge (${hit.join(', ')})`);
  }
  console.log(`  verified: ${files.length} file(s), no ink on any border`);
}
async function seat(raw, size, margin) {
  let content; try { content = await sharp(raw).trim({ threshold: 6 }).png().toBuffer(); } catch { content = await sharp(raw).png().toBuffer(); }
  const inner = Math.round(size * (1 - 2 * margin));
  const fitted = await sharp(content).resize(inner, inner, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, gravity: 'centre' }]).webp({ quality: 95 }).toBuffer();
}

await mkdir(ANIM_DIR, { recursive: true });

if (only === 'base') {
  const n = Math.max(1, Math.min(4, Number(arg('n')) || 3));
  // Candidates run side by side: each is its own 0.5-credit job, and a bad draw costs one of them, not a rerun.
  const results = await Promise.allSettled(Array.from({ length: n }, async (_, i) => {
    const label = `cand${i + 1}`;
    const receipt = await post('/assets/image', { image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: BASE_PROMPT }, 150000);
    const data = await awaitJob(receipt, label);
    const urlOf = (d) => (Array.isArray(d) ? (d[0] && d[0].url) : (d && (d.url || (d.images && d.images[0] && d.images[0].url) || (Array.isArray(d.result) && d.result[0] && d.result[0].url))));
    const url = urlOf(data); if (!url) throw new Error('no url');
    const raw = await fetchBuf(url);
    const box = await alphaBox(raw);
    const rawEdge = [box.x0 <= 1, box.y0 <= 1, box.x1 >= box.w - 1, box.y1 >= box.h - 1].some(Boolean);
    const p = join(OUT, `knight_guardian_${label}.webp`);
    await writeFile(p, await seat(raw, SIZE, EDGE_MARGIN));
    await writeFile(join(OUT, `knight_guardian_${label}_raw.png`), await sharp(raw).png().toBuffer());
    console.log(`  ${label}: ${box.clearPct.toFixed(1)}% transparent, raw art ${rawEdge ? 'TOUCHES its source edge (clipped by the model)' : 'clear of its source edges'} -> ${p}`);
    return p;
  }));
  for (const r of results) if (r.status === 'rejected') console.log('  candidate failed: ' + r.reason.message);
  const okPaths = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (okPaths.length) await assertNoCutoff(okPaths);
  process.exit(okPaths.length ? 0 : 1);
}

if (only === 'anim') {
  const pick = arg('pick');
  if (!pick) { console.error('--pick=<base file> required'); process.exit(1); }
  const baseBuf = await readFile(pick);
  // Seated in the middle half so the wingbeat has somewhere to grow into; packFrames re-crops to the
  // union afterwards, so the shipped frames are just as large.
  const seated = await seat(baseBuf, SIZE, 0.26);
  const uri = 'data:image/png;base64,' + (await sharp(seated).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
  let last, ok = false;
  for (let a = 1; a <= 4 && !ok; a++) {
    try {
      console.log(`animate attempt ${a}`);
      const receipt = await post('/assets/sprite/animate', { initial_image: uri, motion_prompt: MOTION, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true }, 600000);
      const bufs = await framesFrom(await awaitJob(receipt, 'animate'), FRAMES);
      await writeFile(join(OUT, 'anim_raw0.png'), await sharp(bufs[0]).png().toBuffer());
      const packed = await packFrames(bufs);   // throws on a clipped or alpha-less loop -> retry
      const written = [];
      for (let i = 0; i < FRAMES; i++) { const p = join(ANIM_DIR, `knight_guardian_${i}.webp`); await writeFile(p, packed[i]); written.push(p); }
      await assertNoCutoff(written);
      // the static fallback is the loop's own frame 0, so the pre-decode flash matches the animation
      await writeFile(join(OUT, 'knight_guardian.webp'), packed[0]);
      await assertNoCutoff([join(OUT, 'knight_guardian.webp')]);
      console.log('OK — 9 frames + static fallback in ' + OUT);
      ok = true;
    } catch (e) { last = e; console.log('  fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  if (!ok) { console.error('ANIM FAILED: ' + (last && last.message)); process.exit(1); }
}
