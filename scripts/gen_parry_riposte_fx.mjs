#!/usr/bin/env node
// Riposte / parry VFX pack (ludo.ai):
//   0) the BASE counter-flash sprite  -> Sprites/fx/parry_riposte.webp
//   1) a 9-frame loop from that base  -> Sprites/fx/anim/parry_riposte_0..8.webp
//
//   node scripts/gen_parry_riposte_fx.mjs --generate --only=base
//   node scripts/gen_parry_riposte_fx.mjs --generate --only=anim
//
// Per user: "When the parry does dish damage to monsters make it have its own
// special effect sprite and animation (use ludo.ai)". The parry's damage to
// monsters is the Riposte Nova shockwave, which until now borrowed nova_ring -
// the Nova Step dash effect - so the win moment looked like a movement skill.
// Built from scripts/gen_arcane_burst_fx.mjs, which is the house pipeline for an
// FX base plus a locked-framing loop (the alpha-union crop keeps the frames from
// jittering, and the engine spins the sprite itself, so nothing here rotates).
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = join(repoRoot, 'Sprites', 'fx', 'parry_riposte.webp');
const ANIM_DIR = join(repoRoot, 'Sprites', 'fx', 'anim');
const FRAMES = 9, SIZE = 768;
const has = (f) => process.argv.includes(f);
const only = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1];
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

// v0.29.951 — motion re-specified after measuring the v0.29.946 loop: the
// per-step pixel delta ran 1.28 / 1.77 / 4.12 / 10.31 / 12.77 / 9.92 / 5.86 /
// 2.16 / 0.95 %, i.e. all the movement piled into the middle three frames and
// the head and tail were effectively still. This asks for CONTINUOUS motion
// distributed evenly across all nine frames instead of one mid-loop spike.
// v0.30.x — the base sprite itself. Written to be spun: everything is concentric and radially
// symmetrical about the exact centre, so the engine's 0.6π spin turns the seal rather than
// swinging a lopsided shape around. Runes are invented glyphs — asking for "text" gets Latin
// letters and a watermark-looking result.
const BASE_PROMPT =
  'A RIPOSTE COUNTER-FLASH for a 2D fantasy game, viewed perfectly flat face-on from directly '
  + 'above, radially symmetrical and centred: at the very centre a brilliant white-hot spark where '
  + 'a blow was turned aside, from which four long tapering blade-gleams cross in an X and four '
  + 'shorter ones between them, forming an eight-point parry star; around that a ring of sharp '
  + 'gold chevrons all pointing outward, as if the blocked force is being thrown back; a thin '
  + 'broken ring of hairline cracks in the air outside it, with scattered struck sparks, tiny '
  + 'four-pointed glints and a few curved deflection arcs flying outward. '
  + 'Palette: hot white core, rich gold and amber gleams, a thin pale-cyan edge on the chevrons '
  + 'for steel, soft honey bloom. Flat 2D cartoon game sprite, bold clean vector shapes, crisp cel '
  + 'shading, thick dark outline, high contrast, readable as a silhouette. '
  + 'Fully TRANSPARENT background (alpha only). NO face, NO character, NO creature, NO hands, '
  + 'NO weapon held by anyone, NO text, NO watermark, NO shadow, NO ground, NO background.';

const MOTION =
  'The riposte flash SNAPS and RINGS OUT continuously, with strong visible change in EVERY single '
  + 'frame and no still or near-identical frames anywhere - the motion spread evenly across all '
  + 'nine frames, never concentrated into a few: the white-hot centre spark flares and settles like '
  + 'struck steel, the eight blade-gleams lengthen and retract in alternating pairs, the gold '
  + 'chevrons around the ring brighten one after another in a travelling pulse running around the '
  + 'circle, the hairline cracks in the air flicker in and out, and the struck sparks and glints '
  + 'pop and drift outward constantly. '
  + 'CRITICAL - DO NOT ROTATE: the star must NOT spin or turn as a whole; its orientation stays '
  + 'identical in every frame (the game engine rotates it procedurally). Only the energy moves. '
  + 'CRITICAL - LOCKED FRAMING: perfectly centred at the exact same size, position and scale in '
  + 'every frame; no zoom, pan, crop, rescale, drift, wobble, mirror or flip. '
  + 'CRITICAL - SEAMLESS LOOP: the last frame flows continuously back into the first with no pop. '
  + 'Keep the exact same art style, palette (hot white, gold, amber, a thin steel-cyan edge), thick '
  + 'dark outline and fully transparent background in every frame. No face, no character, no background.';


if (!has('--generate')) {
  console.log('# base -> Sprites/fx/parry_riposte.webp\n' + BASE_PROMPT + '\n');
  console.log('# anim -> Sprites/fx/anim/parry_riposte_0..8.webp\n' + MOTION + '\n# Re-run with --generate.');
  process.exit(0);
}
const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

// ludo.ai moved to a JOB API (2026-09-11): a POST answers 202 with {id, status,
// poll_after_ms} and the real payload only arrives from GET /assets/jobs/<id>
// once it succeeds. EVERY endpoint goes through here, not just the image one -
// this generator was copied from a pre-job-API script, and the image half
// reported "no url" while the animate half would have reported "no usable
// frames" for the same reason: it was reading the receipt, not the result.
async function awaitJob(data) {
  if (!data || !data.id || data.status === 'succeeded') return data;
  const t0 = Date.now();
  let wait = Number(data.poll_after_ms) || 5000;
  for (;;) {
    await sleep(Math.max(2500, Math.min(15000, wait)));
    const r = await fetch(`${API}/assets/jobs/${data.id}`, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(30000) });
    if (r.status === 429) { wait = Math.min(30000, wait * 2 + Math.random() * 3000); continue; }   // the status endpoint rate-limits too
    if (!r.ok) throw new Error(`job ${data.id}: ${r.status}`);
    const j = await r.json();
    if (j.status === 'succeeded') return j;
    if (j.status === 'failed' || j.status === 'cancelled') throw new Error('job ' + j.status + (j.error ? ': ' + String(j.error).slice(0, 120) : ''));
    if (Date.now() - t0 > 900000) throw new Error('job still running after 900 s');
    wait = Number(j.poll_after_ms) || 6000;
  }
}
async function framesFrom(raw, n) {
  // A succeeded job wraps the payload in `result` - which is either the frame
  // list itself or the object the old inline response used to be.
  let data = raw || {};
  if (!data.spritesheet_url && !data.individual_frame_urls && data.result) {
    const r = data.result;
    if (Array.isArray(r) && r.length >= n && r[0] && r[0].url) {
      const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(r[i].url)); return o;
    }
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
// Shared canvas, no per-frame trim (per-frame trims re-centre and jitter).
async function normalise(buf) {
  return sharp(buf).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 92 }).toBuffer();
}

// v0.30.x — NO CUT-OFF EDGES (per user). Ludo routinely returns a loop whose effect grows past the
// canvas, and a frame clipped at the border draws a hard straight line across a glow. The game even
// carries a runtime feather (data/sprite_edges.js) to hide exactly this, which is a patch over the
// symptom — these frames should not need it.
//
// Both halves matter and neither works alone:
//   - measure the alpha box of every frame and take the UNION, then apply ONE shared crop+scale to
//     all nine. Per-frame fitting would guarantee margins and destroy the locked framing the motion
//     prompt fights for, making the loop jitter. One transform preserves relative motion exactly.
//   - if the union already touches the source border the model itself clipped the art; no transform
//     can invent the missing pixels, so that throws and the caller re-requests the loop.
const EDGE_MARGIN = 0.045;          // transparent gutter kept on every side of the packed canvas
const ALPHA_ON = 8;                 // treat >8/255 as ink; kills the faint halo Ludo leaves
async function alphaBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * ch;
    for (let x = 0; x < w; x++) {
      if (data[row + x * ch + (ch - 1)] > ALPHA_ON) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < 0) throw new Error('a frame is fully transparent');
  return { x0, y0, x1: x1 + 1, y1: y1 + 1, w, h };
}
async function packFrames(bufs, label) {
  const boxes = []; for (const b of bufs) boxes.push(await alphaBox(b));
  const W = boxes[0].w, H = boxes[0].h;
  const u = boxes.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }));
  const touched = [u.x0 <= 1 ? 'left' : null, u.y0 <= 1 ? 'top' : null, u.x1 >= W - 1 ? 'right' : null, u.y1 >= H - 1 ? 'bottom' : null].filter(Boolean);
  if (touched.length) throw new Error(`frames are clipped at the source canvas edge (${touched.join(', ')}) — regenerating`);
  const inner = Math.round(SIZE * (1 - 2 * EDGE_MARGIN));
  const cw = u.x1 - u.x0, chh = u.y1 - u.y0, span = Math.max(cw, chh);
  const scale = inner / span;
  const out = [];
  for (const b of bufs) {
    const cropped = await sharp(b).extract({ left: u.x0, top: u.y0, width: cw, height: chh })
      .resize(Math.max(1, Math.round(cw * scale)), Math.max(1, Math.round(chh * scale)), { fit: 'fill' }).png().toBuffer();
    out.push(await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: cropped, gravity: 'centre' }]).webp({ quality: 92 }).toBuffer());
  }
  const gut = Math.round((SIZE - inner) / 2);
  console.log(`  ${label}: union ${cw}x${chh} of ${W}x${H}, packed to ${inner}px with a ${gut}px gutter on every side`);
  return out;
}
// Belt and braces: re-measure what was actually written and refuse to leave a clipped frame on disk.
async function assertNoCutoff(files) {
  for (const f of files) {
    const b = await alphaBox(await readFile(f));
    const hit = [b.x0 === 0 ? 'left' : null, b.y0 === 0 ? 'top' : null, b.x1 >= b.w ? 'right' : null, b.y1 >= b.h ? 'bottom' : null].filter(Boolean);
    if (hit.length) throw new Error(`${f} touches the canvas edge (${hit.join(', ')})`);
  }
  console.log(`  verified: ${files.length} frames, no ink on any border`);
}

// A still image request, retried; returns the raw bytes of the first result.
async function makeImage(prompt, label) {
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      process.stdout.write(`${label} attempt ${a} ... `);
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(150000),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt }),
      });
      if (res.status === 402) throw new Error('OUT OF CREDITS (402)');
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      let data = await res.json();
      const urlOf = (d) => (Array.isArray(d) ? (d[0] && d[0].url)
        : (d && (d.url || (d.images && d.images[0] && d.images[0].url) || (Array.isArray(d.result) && d.result[0] && d.result[0].url))));
      if (!urlOf(data)) data = await awaitJob(data);
      const url = urlOf(data);
      if (!url) throw new Error('no url');
      console.log('ok');
      return await fetchBuf(url);
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  throw new Error(`${label} FAILED: ${last && last.message}`);
}
// Trim to ink, then re-seat on a square canvas with a real gutter, so the still assets obey the
// same no-cut-off rule as the frames.
async function seat(raw, size, margin) {
  let content; try { content = await sharp(raw).trim({ threshold: 6 }).png().toBuffer(); } catch { content = await sharp(raw).png().toBuffer(); }
  const inner = Math.round(size * (1 - 2 * margin));
  const fitted = await sharp(content).resize(inner, inner, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, gravity: 'centre' }]).webp({ quality: 95 }).toBuffer();
}

if (!only || only === 'base') {
  if (!has('--force') && await exists(BASE) && only !== 'base') { console.log('base: skip (exists; --only=base or --force to redraw)'); }
  else {
    const raw = await makeImage(BASE_PROMPT, 'base');
    await writeFile(BASE, await seat(raw, SIZE, EDGE_MARGIN));
    await assertNoCutoff([BASE]);
    console.log('base -> Sprites/fx/parry_riposte.webp');
  }
}

if (!only || only === 'anim') {
  const baseBuf = await readFile(BASE);
  // ROOM TO GROW. The first four attempts all came back with the alpha union
  // touching every border, because the base star already fills its canvas to a
  // 4.5% gutter and the motion prompt asks the gleams to LENGTHEN and the sparks
  // to drift OUTWARD - so the loop grew straight off the edge and packFrames
  // (rightly) refused it. Feeding the animator a base seated in the middle half
  // of the canvas leaves the effect somewhere to expand into. It costs nothing
  // in final size: packFrames re-crops to the union and rescales to fill, so the
  // shipped frames are just as large either way.
  const ANIM_IN_MARGIN = 0.26;
  const seated = await seat(baseBuf, SIZE, ANIM_IN_MARGIN);
  const uri = 'data:image/png;base64,' + (await sharp(seated).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
  let last, ok = false;
  for (let a = 1; a <= 4 && !ok; a++) {
    try {
      process.stdout.write(`animate attempt ${a} ... `);
      const res = await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(600000),
        body: JSON.stringify({ initial_image: uri, motion_prompt: MOTION, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
      const bufs = await framesFrom(await awaitJob(await res.json()), FRAMES);
      console.log('frames in');
      // Keep the evidence: "clipped on all four sides" reads the same whether the
      // art really ran off the canvas or the frames came back with no alpha at
      // all (ensureAlpha then makes every pixel opaque and the union is the whole
      // frame). Guessing between those two wastes credits; one dumped frame does not.
      try {
        const b0 = await sharp(bufs[0]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        let clear = 0; for (let i = 3; i < b0.data.length; i += b0.info.channels) if (b0.data[i] <= ALPHA_ON) clear++;
        const px = b0.info.width * b0.info.height;
        console.log(`  frame 0: ${b0.info.width}x${b0.info.height}, ${b0.info.channels}ch, ${(100 * clear / px).toFixed(1)}% transparent`);
        await writeFile(join(tmpdir(), 'parry_raw0.png'), await sharp(bufs[0]).png().toBuffer());   // OS temp, never the shipped sprite folder
      } catch (e) { console.log('  (probe failed: ' + e.message + ')'); }
      const packed = await packFrames(bufs, 'riposte');   // throws on a clipped loop -> this attempt retries
      await mkdir(ANIM_DIR, { recursive: true });
      const written = [];
      for (let i = 0; i < FRAMES; i++) { const p = join(ANIM_DIR, `parry_riposte_${i}.webp`); await writeFile(p, packed[i]); written.push(p); }
      await assertNoCutoff(written);
      console.log('OK — 9 frames');
      ok = true;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  if (!ok) { console.error('ANIM FAILED: ' + (last && last.message)); process.exit(1); }
}
