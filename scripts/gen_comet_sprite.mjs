#!/usr/bin/env node
// Gravitos's comet, regenerated as a nine-frame set + matching static. Per user: "Using ludo.ai
// Sprites/projectiles/anim/comet sprite and animation has to be regenerated, similar theme but
// should fit the aesthetics of the game better".
//
// Two things were wrong. The animated set NEVER EXISTED - not on disk, not on origin/main - while
// data/sprite_frame_index.js promised "comet": 9, so every comet volley asked for nine frames that
// 404 and fell back to the static. And the static (p_comet, 768px, 459 KB for a ~108 px draw) is a
// cel-outlined sticker: a hard black keyline around the rock that nothing painterly in the game has.
//
//   LUDO_API_KEY=... node scripts/gen_comet_sprite.mjs            # key frame -> 9 frames + static
//   node scripts/gen_comet_sprite.mjs --dry                        # print the prompts
//
// ORIENTATION IS LOAD-BEARING, AGAIN. The draw table has `comet: { mode: 'orient', rot: -0.419 }`
// because the old art was authored ~24 deg nose-down and the code un-tilts it before pointing it
// along velocity. A magic angle is a trap for the next repaint, so this art is authored HORIZONTAL
// - rock on the RIGHT, trail streaming LEFT - and the caller sets rot to 0. That axis is not
// trusted to the prompt: it is MEASURED (alpha-weighted principal axis) and the candidate is
// refused if it tilts more than 10 deg or puts the rock on the wrong side. Every animation frame
// is measured against the key frame the same way, because the animate stage can drift.
// ACCEPT BEFORE WRITE: nothing under Sprites/ is touched until a whole set has passed every gate.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const fs = require('node:fs');
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJ = path.join(ROOT, 'Sprites', 'projectiles');
// FLAT, not a subfolder: the loader builds 'Sprites/projectiles/anim/' + skill + '_' + i, and
// data/assets_manifest.json already precaches anim/comet_0..8 at exactly that path.
const ANIM = path.join(PROJ, 'anim');
const STATIC = path.join(PROJ, 'p_comet.webp');
const SIZE = 512, MARGIN = 0.06, FRAMES = 9;
// EDGE: a frame is cut off when the 2 px border band holds this many visible pixels. Take 4's
// round 3 was refused for one 5 px spark the model flew to the right rim - a cutoff nobody can
// see. A clipped trail puts hundreds of pixels in the band; a stray chip puts a dozen.
const EDGE_PX = 32;
// TAIL FADE: the model ends the trail in a blunt edge - the accepted key frame's tail stops on a
// near-vertical line, and in-game at 2x a down-flying comet showed a flat top. Alpha is ramped to
// zero (smoothstep) over the tail-side share of the set's shared content width, measured from the
// union box so every frame dissolves at the same screen position and the fade cannot flicker.
const TAIL_FADE = 0.30;
// ASPECT is a sanity band, not a composition gate. Take 2 asked for 3:2 (1.25-1.85) and the model
// answered 1.93, 2.75, 2.36, 2.53, 2.14 - five rounds, five refusals, nothing written; it simply
// does not paint a comet with a short tail. The rock-size problem that gate stood in for (a 2.5:1
// streak in the square ~108 px draw box leaves the rock ~35 px) is solved where it belongs: the
// draw table's size, which the ship step solves from the ACCEPTED frame so the rock draws ~60 px.
const MAX_TILT_DEG = 10, MAX_FRAME_DRIFT_DEG = 12, MIN_ASPECT = 1.25, MAX_ASPECT = 2.8;
// MOTION floor: mean consecutive-frame difference over non-transparent pixels. Take 1 measured
// 1.4% - nine copies of one still, because the motion prompt was a list of prohibitions. The old
// set was 10.9%; a set that reads as alive in-game (block_mage) is ~20%.
// The MIN is per consecutive pair and includes the loop seam (frame 8 -> frame 0). Take 3 was
// refused three times at means of 4.7 / 8.4 / 7.1 with seam pairs of 1.8 / 2.5 / 2.7: the model
// closes a loop by steering the last frame back onto the key, so that pair is always the quietest.
// One near-repeated frame at 48 ms is a hold nobody sees; nine of them is what the MEAN catches.
const MIN_MOTION_MEAN = 6, MIN_MOTION_MIN = 2;

const BASE = [
  'Game VFX projectile sprite on a fully transparent background, alpha only - no scene, no floor,',
  'no character, no text, no watermark, no border, no ground shadow. A single cosmic asteroid in',
  'flight: a dense dark rock of deep indigo and blue-black stone, fractured by wide glowing fissures',
  'of electric cyan and white-blue light, a bright white-blue core burning through the cracks at the',
  'centre, the cracks dimming to deep sapphire at the rim. Streaming straight back from it, a long',
  'trail of cyan-blue plasma and pale white-blue energy - flowing, luminous, clearly ATTACHED to the',
  'rock and dragged by its motion - with small chips of rock and cyan sparks tumbling away and',
  'fading along the tail.',
  'ORIENTATION IS FIXED AND MATTERS: the asteroid flies from LEFT to RIGHT. The rock sits on the',
  'RIGHT side of the image and the trail streams straight LEFT from it, horizontally aligned with',
  'the canvas. Not diagonal, not tilted, not falling - a horizontal streak, rock right, trail left.',
  'COMPOSITION: the rock is the hero. It is a BIG round asteroid filling about 55 percent of the',
  'image HEIGHT, with a blazing white-blue core flaring out through its cracks. The trail is SHORT',
  'and broad - about as long as the rock is wide, never longer - so the whole shape is roughly',
  'three units wide by two tall, NOT a long thin streak.',
  'Painterly hand-painted game art, rich saturated cool colour, soft luminous glow,',
  'crisp readable silhouette. NO hard black outline, no thick dark keyline, no cel-shaded sticker',
  'border - the edges are painted light and shadow, not ink. Centred, filling most of the canvas.',
].join(' ');
// Asked for MOTION, not just the absence of the wrong motion. Take 1 led with four prohibitions
// and the model obeyed them by changing nothing. The rock is still held; the energy is told to
// be visibly different on every frame.
const MOTION = [
  'A burning comet in flight, animated like living blue fire. The rock stays centred and the same',
  'size, but the plasma trail is a DIFFERENT SHAPE on every frame: tongues of cyan flame stretch',
  'out and snap back, bright ripples travel down the tail from the rock to its tip, the tail',
  'flares wide then narrows, the glowing fissures and the white-blue core pulse bright and dim,',
  'and rock chips and sparks fly off the tail and fade. Strong, clearly visible change between',
  'consecutive frames, like flickering fire. Seamless loop, fully transparent background,',
  'consistent painterly style on every frame.',
].join(' ');
if (process.argv.includes('--dry')) { console.log('# base\n' + BASE + '\n\n# motion\n' + MOTION); process.exit(0); }
// --replay <dumpdir> <keyRound> <animRound>: re-run the gates and the write on a round that was
// dumped by an earlier run, so a gate fix does not cost a fresh generation.
const REPLAY = (() => { const i = process.argv.indexOf('--replay'); return i < 0 ? null : { dir: process.argv[i + 1], key: Number(process.argv[i + 2] || 1), anim: Number(process.argv[i + 3] || 1) }; })();
const DUMP = REPLAY ? null : process.env.COMET_DUMP_DIR; if (DUMP) fs.mkdirSync(DUMP, { recursive: true });
const key = process.env.LUDO_API_KEY; if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };
async function post(p, body, ms) { for (let a = 1; ; a++) { try {
  const r = await fetch(`${API}${p}`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(ms), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${p} ${r.status}: ${(await r.text()).slice(0, 120)}`); return await r.json();
} catch (e) { console.error(`  attempt ${a}: ${e.message}`); if (a >= 4) throw e; await sleep(4000 * a); } } }

// Alpha-weighted geometry: bbox, mass, centroid, and the principal-axis tilt in degrees
// (0 = horizontal). Two rock-side readings: rockX is the centroid of near-opaque pixels (the
// trail is translucent, the rock is not), stoneX the centroid of near-opaque DARK pixels - the
// stone itself, since the trail is bright cyan. stoneX separates a centred rock from a rock on
// the right (old art 0.57, take 1 0.68) where rockX put them at 0.52 / 0.60 and take 3 spent four
// rounds refusing 0.54 against a 0.55 line that was noise.
async function geo(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; let x0 = W, y0 = H, x1 = -1, y1 = -1, m = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, om = 0, ox = 0, sm = 0, sxs = 0, eb = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i4 = (y * W + x) * 4, a = data[i4 + 3]; if (a <= 24) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (x <= 1 || y <= 1 || x >= W - 2 || y >= H - 2) eb++;
    m += a; sx += a * x; sy += a * y; sxx += a * x * x; syy += a * y * y; sxy += a * x * y;
    if (a > 240) { om += 1; ox += x; if (data[i4] + data[i4 + 1] + data[i4 + 2] < 360) { sm += 1; sxs += x; } } }
  if (m === 0) return null;
  const cx = sx / m, cy = sy / m, cxx = sxx / m - cx * cx, cyy = syy / m - cy * cy, cxy = sxy / m - cx * cy;
  const tilt = Math.abs(0.5 * Math.atan2(2 * cxy, cxx - cyy)) * 180 / Math.PI;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  return { x0, y0, x1, y1, bw, bh, aspect: bw / bh, mass: m, tilt: Math.min(tilt, 180 - tilt), rockX: om ? (ox / om) / W : 0.5, stoneX: sm ? (sxs / sm) / W : 0.5,
    edge: eb >= EDGE_PX, edgePx: eb };
}
const fmt = (g) => `content ${g.bw}x${g.bh} aspect ${g.aspect.toFixed(2)} tilt ${g.tilt.toFixed(1)}deg rockX ${g.rockX.toFixed(2)} stoneX ${g.stoneX.toFixed(2)}${g.edge ? ` EDGE(${g.edgePx}px)` : g.edgePx ? ` rim ${g.edgePx}px` : ''}`;
// Mean absolute RGBA difference between consecutive frames (looping), as % of full scale, over
// pixels non-transparent in either frame - how much the animation actually moves.
async function motionOf(pngs) {
  const fr = []; for (const p of pngs) fr.push(await sharp(p).resize(256, 256).ensureAlpha().raw().toBuffer({ resolveWithObject: true }));
  const out = [];
  for (let i = 0; i < fr.length; i++) { const A = fr[i].data, B = fr[(i + 1) % fr.length].data; let s = 0, n = 0;
    for (let p = 0; p < A.length; p += 4) { if (A[p + 3] < 16 && B[p + 3] < 16) continue; n++; s += Math.abs(A[p] - B[p]) + Math.abs(A[p + 1] - B[p + 1]) + Math.abs(A[p + 2] - B[p + 2]) + Math.abs(A[p + 3] - B[p + 3]); }
    out.push(n ? s / n / 4 / 255 * 100 : 0); }
  return out;
}
function judgeKey(g) { if (!g) return 'empty'; if (g.aspect < MIN_ASPECT || g.aspect > MAX_ASPECT) return `aspect ${g.aspect.toFixed(2)} outside ${MIN_ASPECT}-${MAX_ASPECT}`;
  if (g.tilt > MAX_TILT_DEG) return `tilted ${g.tilt.toFixed(1)}deg`; if (g.stoneX < 0.62) return `rock not on the right (stone x=${g.stoneX.toFixed(2)})`; return null; }
async function fadeTail(png, U) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, fw = (U.x1 - U.x0 + 1) * TAIL_FADE, xs = U.x0;
  for (let y = 0; y < H; y++) for (let x = 0; x < Math.min(W, xs + fw); x++) { const t = x < xs ? 0 : (x - xs) / fw, k = t * t * (3 - 2 * t); const i = (y * W + x) * 4 + 3; data[i] = Math.round(data[i] * k); }
  return sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}
async function framesFrom(d, n) {
  if (d.spritesheet_url && d.num_cols && d.num_rows) { const sheet = await fetchBuf(d.spritesheet_url), mt = await sharp(sheet).metadata();
    const cw = Math.floor(mt.width / d.num_cols), ch = Math.floor(mt.height / d.num_rows), o = [];
    for (let r = 0; r < d.num_rows && o.length < n; r++) for (let c = 0; c < d.num_cols && o.length < n; c++) o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o; }
  const urls = d.individual_frame_urls || []; if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  throw new Error('no usable frames');
}

// ---- stage 1: a key frame that passes the gates, or nothing ----------------------------------
let base = null, baseGeo = null;
if (REPLAY) { base = fs.readFileSync(path.join(REPLAY.dir, `key_r${REPLAY.key}.png`)); baseGeo = await geo(base); const why = judgeKey(baseGeo);
  console.log(`replay key round ${REPLAY.key}: ${fmt(baseGeo)} -> ${why ? 'REJECTED: ' + why : 'accepted'}`); if (why) process.exit(1); }
for (let round = 1; round <= 5 && !base; round++) {
  console.log(`key frame, round ${round}`);
  const img = await post('/assets/image', { image_type: 'sprite-vfx', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: BASE }, 150000);
  const url = Array.isArray(img) ? img[0]?.url : (img?.url || img?.images?.[0]?.url); if (!url) throw new Error('no url');
  const trimmed = await sharp(await fetchBuf(url)).trim().png().toBuffer(); const tm = await sharp(trimmed).metadata();
  const inner = Math.round(SIZE * (1 - 2 * MARGIN)), sc = Math.min(inner / tm.width, inner / tm.height);
  const cw = Math.max(1, Math.round(tm.width * sc)), ch = Math.max(1, Math.round(tm.height * sc));
  const cand = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp(trimmed).resize(cw, ch, { fit: 'fill' }).png().toBuffer(), left: Math.round((SIZE - cw) / 2), top: Math.round((SIZE - ch) / 2) }]).png().toBuffer();
  if (DUMP) fs.writeFileSync(path.join(DUMP, `key_r${round}.png`), cand);
  const g = await geo(cand), why = judgeKey(g);
  console.log(`  ${g ? fmt(g) : 'no content'}  -> ${why ? 'REJECTED: ' + why : 'accepted'}`);
  if (!why) { base = cand; baseGeo = g; }
}
if (!base) { console.error('REFUSING: no key frame met the gates in 5 rounds. Nothing written.'); process.exit(1); }

// ---- stage 2: nine frames that hold the axis, or nothing --------------------------------------
let frames = null;
for (let round = 1; round <= (REPLAY ? 1 : 3) && !frames; round++) {
  console.log(REPLAY ? `replay animate round ${REPLAY.anim}` : `animate, round ${round}`);
  const anim = REPLAY ? null : await post('/assets/sprite/animate', { initial_image: 'data:image/png;base64,' + base.toString('base64'), motion_prompt: MOTION, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: true }, 300000);
  const raw = REPLAY ? Array.from({ length: FRAMES }, (_, i) => fs.readFileSync(path.join(REPLAY.dir, `anim_r${REPLAY.anim}_${i}.png`))) : await framesFrom(anim, FRAMES);
  const norm = []; for (const b of raw) norm.push(await sharp(b).resize(SIZE, SIZE, { fit: 'fill' }).ensureAlpha().png().toBuffer());
  if (DUMP) norm.forEach((b, i) => fs.writeFileSync(path.join(DUMP, `anim_r${round}_${i}.png`), b));
  const gs = []; let bad = null;
  for (let i = 0; i < norm.length; i++) { const g = await geo(norm[i]); gs.push(g);
    const why = !g ? 'empty' : g.mass < baseGeo.mass * 0.25 ? 'lost most of the effect' : Math.abs(g.tilt - baseGeo.tilt) > MAX_FRAME_DRIFT_DEG ? `drifted to ${g.tilt.toFixed(1)}deg` : g.stoneX < 0.55 ? 'rock crossed to the left' : null;
    console.log(`  frame ${i}: ${g ? fmt(g) : 'no content'}${why ? '  <- ' + why : ''}`); if (why && !bad) bad = `frame ${i} ${why}`; }
  if (bad) { console.log(`  REJECTED: ${bad}`); continue; }
  const mot = await motionOf(norm), motMean = mot.reduce((a, b) => a + b, 0) / mot.length, motMin = Math.min(...mot);
  console.log(`  motion %: ${mot.map((d) => d.toFixed(1)).join(' ')}  (mean ${motMean.toFixed(1)}, min ${motMin.toFixed(1)})`);
  if (motMean < MIN_MOTION_MEAN || motMin < MIN_MOTION_MIN) { console.log(`  REJECTED: too still - mean ${motMean.toFixed(1)}% / min ${motMin.toFixed(1)}% under ${MIN_MOTION_MEAN}/${MIN_MOTION_MIN}`); continue; }
  // ONE shared crop for the whole set (the union box + margin), so nothing jitters frame to frame
  // and no frame can be cut at the canvas edge.
  const U = gs.concat([baseGeo]).reduce((a, c) => ({ x0: Math.min(a.x0, c.x0), y0: Math.min(a.y0, c.y0), x1: Math.max(a.x1, c.x1), y1: Math.max(a.y1, c.y1) }));
  const side = Math.min(SIZE, Math.round(Math.max(U.x1 - U.x0, U.y1 - U.y0) * (1 + 2 * MARGIN)));
  const left = Math.max(0, Math.min(SIZE - side, Math.round((U.x0 + U.x1) / 2 - side / 2))), top = Math.max(0, Math.min(SIZE - side, Math.round((U.y0 + U.y1) / 2 - side / 2)));
  const reframe = (png) => sharp(png).extract({ left, top, width: side, height: side }).resize(SIZE, SIZE, { fit: 'fill' }).webp({ quality: 90 }).toBuffer();
  const out = []; for (const p of norm) out.push(await reframe(await fadeTail(p, U))); const outBase = await reframe(await fadeTail(base, U));
  // re-measure what will actually be written: the no-cutoff rule is checked on the bytes, not assumed
  let touch = null; for (let i = 0; i < out.length; i++) { const g = await geo(out[i]); if (g && g.edge) { touch = i; break; } }
  if (touch != null) { console.log(`  REJECTED: written frame ${touch} would touch the canvas edge`); continue; }
  frames = { out, outBase, side, left, top };
}
if (!frames) { console.error('REFUSING: no animation held the axis in 3 rounds. Nothing written.'); process.exit(1); }

fs.mkdirSync(ANIM, { recursive: true });
for (let i = 0; i < frames.out.length; i++) fs.writeFileSync(path.join(ANIM, `comet_${i}.webp`), frames.out[i]);
fs.writeFileSync(STATIC, frames.outBase);
const kb = (b) => (b.length / 1024).toFixed(0) + 'KB';
console.log(`\nwrote ${frames.out.length} frames ${SIZE}x${SIZE} (${kb(frames.out[0])} each) -> Sprites/projectiles/anim/comet_0..8.webp  and p_comet.webp (${kb(frames.outBase)})`);
console.log(`shared crop ${frames.side}px at (${frames.left},${frames.top}); key frame ${fmt(baseGeo)}`);
console.log('NEXT: measure the written set (mean signed tilt -> rot = -tilt rad; content height -> size so the rock draws ~60 px; see the comet entry in _PROJ_SPRITE_BLIT), then node scripts/gen_sprite_frame_index.mjs --check, node scripts/animator_parity_check.mjs, and MOJI_SERVE_ROOT=<tree> node scripts/comet_orientation_test.mjs. data/assets_manifest.json already lists these ten paths.');
