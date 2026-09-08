#!/usr/bin/env node
// Arcane Burst VFX pack (ludo.ai):
//   0) the BASE detonation sprite itself -> Sprites/fx/arcane_burst.webp
//   1) 9-frame detonation loop from that base
//        -> Sprites/fx/anim/arcane_burst_0..8.webp
//   2) NEW expanding shockwave-ring sprite (static; the engine grows it)
//        -> Sprites/fx/arcane_shockwave.webp
//
//   node scripts/gen_arcane_burst_fx.mjs              # dry run
//   node scripts/gen_arcane_burst_fx.mjs --generate   # needs LUDO_API_KEY
//   flags: --force --only=base|anim|ring|ringanim
//
// v0.30.x — per user: "regenerate arcane_burst sprite and animation to look
// more magical and wizardry also with an incantation ring". The v0.29.946 art
// was an electric star with cyan crystal shards — it read as ice/lightning,
// not as a spell a wizard cast. The base is now a proper INCANTATION SEAL:
// concentric rune rings around a white-hot core, which is what the caster in
// mojiworld_game.html has always called it ("magic-circle sprite over the
// player"). It suits the engine too — spawnSpriteBurst spins this sprite
// 0.6π over its 34-frame life, and a rotating rune circle is the classic
// wizardry read, where a rotating star was just a spinning star.
//
// The base step is NEW. Until now this script only ever animated whatever
// arcane_burst.webp already was, so the look could never be changed here.
//
// v0.29.946 — per user: "Add additional visual special effects sprites and
// animation for arcane burst skill". The burst had one static magic-star
// sprite spun procedurally; the frames animate the detonation itself (flare,
// shards, sparkle churn) while the NEW ring is drawn at the skill's true AoE
// so the player sees exactly what the 320px blast covers.
// NO whole-image rotation in the frames — spawnSpriteBurst applies spin
// procedurally (same smoothness rule as gen_bolt_anim.mjs).
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = join(repoRoot, 'Sprites', 'fx', 'arcane_burst.webp');
const ANIM_DIR = join(repoRoot, 'Sprites', 'fx', 'anim');
const RING_OUT = join(repoRoot, 'Sprites', 'fx', 'arcane_shockwave.webp');
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
  'A wizard\'s ARCANE DETONATION SEAL for a 2D fantasy game, viewed perfectly flat face-on from ' +
  'directly above, radially symmetrical and centred: at the very centre a brilliant white-hot ' +
  'magical core with a small violet starburst flare; surrounding it a complete INCANTATION CIRCLE ' +
  '— a wide ring of glowing pale-gold arcane runes and mystical sigil script, with a second ' +
  'thinner concentric rune ring outside it, the two rings joined by a delicate geometric arcane ' +
  'seal of interlocking triangles and fine radiating spokes; ribbons of deep violet and indigo ' +
  'spell-energy curl and spiral outward past the outer ring, with scattered glowing motes, tiny ' +
  'six-pointed sparkles and drifting embers of light. ' +
  'Palette: deep violet and indigo energy, luminous white-hot centre, pale-gold glowing runes, ' +
  'soft magenta bloom. Flat 2D cartoon game sprite, bold clean vector shapes, crisp cel shading, ' +
  'thick dark outline, high contrast, readable as a silhouette. ' +
  'The runes are INVENTED fantasy glyphs — no real alphabet, no readable words, no Latin letters. ' +
  'Fully TRANSPARENT background (alpha only). NO face, NO character, NO creature, NO hands, ' +
  'NO text banner, NO watermark, NO shadow, NO ground, NO background.';

const MOTION =
  'The arcane incantation seal SURGES CONTINUOUSLY, with strong visible change in EVERY single ' +
  'frame and no still or near-identical frames anywhere in the sequence — the motion must be spread ' +
  'evenly across all nine frames, never concentrated into a few: ' +
  'the white-hot core pulses brighter and dimmer like a fast heartbeat and its violet flare breathes ' +
  'in and out, the pale-gold runes around the incantation circle ignite one after another in a ' +
  'travelling pulse that runs all the way around the ring, the fine geometric seal lines flicker and ' +
  'crackle with thin arcs of violet lightning, the indigo spell-energy ribbons coil and unfurl ' +
  'outward, and tiny white six-pointed sparkles pop in and out constantly around the rings. ' +
  'CRITICAL — DO NOT ROTATE: the seal must NOT spin or turn as a whole; its orientation stays ' +
  'identical in every frame (the game engine rotates it procedurally). Only the energy moves, and ' +
  'the runes brighten in place — they must not travel around the circle as moving objects. ' +
  'CRITICAL — LOCKED FRAMING: perfectly centred at the exact same size, position and scale in ' +
  'every frame; no zoom, pan, crop, rescale, drift, wobble, mirror or flip. The rings keep exactly ' +
  'the same diameter throughout. ' +
  'CRITICAL — SEAMLESS LOOP: the last frame flows continuously back into the first with no pop. ' +
  'Keep the exact same art style, palette (deep violet and indigo, white-hot core, pale-gold runes), ' +
  'thick dark outline and fully transparent background in every frame. No face, no character, no background.';

const RING_PROMPT =
  'A thin expanding ARCANE SHOCKWAVE RING for a 2D game explosion: one large perfect circle drawn ' +
  'as a band of electric blue-violet energy with small glowing runes spaced along the band, thin ' +
  'white-hot inner edge, faint pink outer haze, a few tiny cyan crystal shards riding the ring. ' +
  'The centre of the circle is completely EMPTY and transparent — a ring only, band width about ' +
  '8% of the diameter, the ring nearly filling the frame. Flat 2D cartoon game sprite, bold clean ' +
  'vector shapes, crisp cel shading, thick dark outline, matching an electric-blue arcane star ' +
  'explosion set. Fully TRANSPARENT background (alpha only). Viewed flat face-on (no perspective ' +
  'tilt). NO face, NO character, NO text, NO shadow, NO background.';

// v0.29.951 — the ring shipped static. It is the one asset in this effect with
// no animation at all, so it gets its own loop: runes travelling around the
// band, energy pulsing along it. Explicitly NO whole-ring rotation — the burst
// grows the ring via the 0.5->1.1 curve and a rotating circle reads as wobble.
const RING_MOTION =
  'The arcane shockwave ring CRACKLES with energy, changing visibly in EVERY frame: the glowing ' +
  'runes spaced along the band brighten and dim in sequence like a travelling pulse running around ' +
  'the circle, the white-hot inner edge flickers, thin electric arcs snap across the band, the pink ' +
  'outer haze breathes, and the small cyan shards riding the ring shimmer. ' +
  'CRITICAL — DO NOT ROTATE: the ring must NOT spin or turn as a whole and must NOT change size. ' +
  'Only the energy travelling ALONG the band moves. The circle stays exactly the same diameter, ' +
  'position and orientation in every frame. ' +
  'CRITICAL — KEEP THE CENTRE EMPTY: the inside of the circle stays completely transparent in every ' +
  'frame; never fill it. ' +
  'CRITICAL — LOCKED FRAMING: perfectly centred, same scale every frame; no zoom, pan, crop, drift, ' +
  'mirror or flip. ' +
  'CRITICAL — SEAMLESS LOOP: the last frame flows continuously back into the first with no pop. ' +
  'Keep the exact same art style, palette and fully transparent background in every frame. ' +
  'No face, no character, no text, no background, no shadow.';

// v0.30.x — the skill-deck icon, so the button matches the spell it casts. Square, centred, and
// readable at 40px in the deck, which is the size that actually decides whether an icon works.
const ICON_PROMPT =
  'A fantasy RPG SKILL ICON for a spell called Arcane Burst: a wizard\'s glowing incantation circle ' +
  'seen flat face-on — a ring of pale-gold arcane runes around a brilliant white-hot magical core ' +
  'that is detonating outward in a violet starburst, with a thinner concentric rune ring and fine ' +
  'geometric seal lines, and curls of indigo spell-energy escaping the ring. ' +
  'Palette: deep violet and indigo, luminous white centre, pale-gold runes, magenta bloom. ' +
  'Centred square composition, the design filling the frame with a small even margin on all sides ' +
  'and nothing touching or running off the edges. Flat 2D cartoon game icon, bold clean vector ' +
  'shapes, crisp cel shading, thick dark outline, strong silhouette, high contrast so it stays ' +
  'readable when shrunk to a small button. The runes are INVENTED fantasy glyphs — no real ' +
  'alphabet, no readable words, no Latin letters. Fully TRANSPARENT background (alpha only). ' +
  'NO face, NO character, NO hands, NO text, NO watermark, NO frame, NO border, NO background.';

if (!has('--generate')) {
  console.log('# base -> Sprites/fx/arcane_burst.webp\n' + BASE_PROMPT + '\n');
  console.log('# icon -> Sprites/skills/arcaneBurst.webp\n' + ICON_PROMPT + '\n');
  console.log('# anim -> Sprites/fx/anim/arcane_burst_0..8.webp\n' + MOTION + '\n');
  console.log('# ring -> Sprites/fx/arcane_shockwave.webp\n' + RING_PROMPT + '\n');
  console.log('# ringanim -> Sprites/fx/anim/arcane_shockwave_0..8.webp\n' + RING_MOTION + '\n# Re-run with --generate.');
  process.exit(0);
}
const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }
async function framesFrom(data, n) {
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
  throw new Error('no usable frames in response');
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
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
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
    console.log('base -> Sprites/fx/arcane_burst.webp');
  }
}

if (only === 'icon' || (!only && has('--icon'))) {
  const ICON_OUT = join(repoRoot, 'Sprites', 'skills', 'arcaneBurst.webp');
  const raw = await makeImage(ICON_PROMPT, 'icon');
  await writeFile(ICON_OUT, await seat(raw, 256, 0.03));   // 256 is the size every other skill icon is
  await assertNoCutoff([ICON_OUT]);
  console.log('icon -> Sprites/skills/arcaneBurst.webp');
}

if (!only || only === 'anim') {
  const baseBuf = await readFile(BASE);
  const uri = 'data:image/png;base64,' + (await sharp(baseBuf).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
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
      const bufs = await framesFrom(await res.json(), FRAMES);
      console.log('frames in');
      const packed = await packFrames(bufs, 'burst');   // throws on a clipped loop -> this attempt retries
      await mkdir(ANIM_DIR, { recursive: true });
      const written = [];
      for (let i = 0; i < FRAMES; i++) { const p = join(ANIM_DIR, `arcane_burst_${i}.webp`); await writeFile(p, packed[i]); written.push(p); }
      await assertNoCutoff(written);
      console.log('OK — 9 frames');
      ok = true;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  if (!ok) { console.error('ANIM FAILED: ' + (last && last.message)); process.exit(1); }
}

if (!only || only === 'ring') {
  if (!has('--force') && await exists(RING_OUT)) { console.log('ring: skip (exists)'); process.exit(0); }
  let last, ok = false;
  for (let a = 1; a <= 4 && !ok; a++) {
    try {
      process.stdout.write(`ring attempt ${a} ... `);
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(150000),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: RING_PROMPT }),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      const raw = await fetchBuf(url);
      let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
      await writeFile(RING_OUT, await normalise(content));
      console.log('ok -> arcane_shockwave.webp');
      ok = true;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  if (!ok) { console.error('RING FAILED: ' + (last && last.message)); process.exit(1); }
}

// v0.29.951 — ring animation pass (--only=ringanim, or part of a full run).
if (!only || only === 'ringanim') {
  const ringBuf = await readFile(RING_OUT);
  const rUri = 'data:image/png;base64,' + (await sharp(ringBuf).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
  let last, ok = false;
  for (let a = 1; a <= 4 && !ok; a++) {
    try {
      process.stdout.write(`ring-anim attempt ${a} ... `);
      const res = await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(600000),
        body: JSON.stringify({ initial_image: rUri, motion_prompt: RING_MOTION, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
      const bufs = await framesFrom(await res.json(), FRAMES);
      const packed = await packFrames(bufs, 'ring');
      await mkdir(ANIM_DIR, { recursive: true });
      const written = [];
      for (let i = 0; i < FRAMES; i++) { const p = join(ANIM_DIR, `arcane_shockwave_${i}.webp`); await writeFile(p, packed[i]); written.push(p); }
      await assertNoCutoff(written);
      console.log('OK — 9 ring frames');
      ok = true;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  if (!ok) { console.error('RING-ANIM FAILED: ' + (last && last.message)); process.exit(1); }
}
