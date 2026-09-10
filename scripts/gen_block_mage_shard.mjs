#!/usr/bin/env node
// Sprites/fx/block_mage.webp + anim/block_mage_0..8 — the mage's A-key block, redrawn.
// ============================================================================
// Per user: "The mage block needs to be redone better, less complicated, ensure no cutoff",
// after "the current one is too opaque and not good, make it like a magic incantation shard".
//
// A SEPARATE FILE FROM scripts/gen_block_fx_ludo.mjs ON PURPOSE. That script is another session's
// work and is currently MODIFIED-UNCOMMITTED in the tree - it produced the v0.30.487 ward. Per
// user, "ensure not to clobber the parallel agents": this writes the same art paths but leaves
// their generator untouched, so nothing of theirs is lost if they are mid-iteration.
//
// BOTH COMPLAINTS MEASURED ON THE SHIPPED SET FIRST:
//   TOO OPAQUE  block_mage.webp is mean alpha 210/255 with 66% of its ink FULLY opaque, and
//               block_mage_0 is 235 with 85%. A ward the player looks THROUGH was a solid decal.
//   CUT OFF     block_mage_4.webp measures ink 511x512 inside a 512x512 canvas - it runs into
//               the border on two sides. The clip is in the shipped art, not imagined.
//
//   node scripts/gen_block_mage_shard.mjs                # brief + the current measurements
//   node scripts/gen_block_mage_shard.mjs --generate     # needs LUDO_API_KEY
//   flags: --rolls N   --alpha 0.62   --anim-only
import sharp from 'sharp';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STILL = join(ROOT, 'Sprites', 'fx', 'block_mage.webp');
const ANIM = join(ROOT, 'Sprites', 'fx', 'anim');
const S = 512, FRAMES = 9;
const has = (f) => process.argv.includes(f);
const argOf = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const ROLLS = Number(argOf('--rolls', '5'));
const ALPHA = Number(argOf('--alpha', '0.68'));

// LESS COMPLICATED is the whole brief. The shipped ward is two dense rings of script around a
// solid core - at 100px on screen that resolves to a bright blob with texture. One ring, a few
// large glyphs, and a hollow centre reads at size and lets the mage be seen inside it.
const PROMPT =
  'A single magical INCANTATION SHARD sigil for a 2D game: one clean circular rune ring drawn in '
  + 'bright cyan and pale blue light, with SIX large simple angular glyphs spaced evenly around it '
  + 'and three floating crystal shards hovering just outside the ring. '
  + 'The centre of the ring is EMPTY and clear - open space with only a faint haze, no solid disc, '
  + 'no filled core, nothing painted in the middle. '
  + 'Thin bright linework on darkness, like light drawn in the air. Simple and readable: ONE ring, '
  + 'not several; a few big glyphs, not dense script; no fine detail, no clutter, no lettering from '
  + 'any real alphabet. '
  + 'Flat 2D game VFX sprite, glowing edges, fully transparent background, the sigil floating free '
  + 'and drawn COMPLETE with a clear even margin on all four sides - nothing touching, running off '
  + 'or sliced flat by the edge of the frame.';
const MOTION =
  'The rune ring turns slowly and the sigil pulses as it wards. Across the nine frames spread the '
  + 'motion EVENLY so every frame differs clearly from the one before, including the last three: '
  + 'the ring rotates steadily, the six glyphs light up one after another around it, the floating '
  + 'shards drift and turn, and the light brightens to a peak in the middle of the loop then '
  + 'settles. The centre stays EMPTY and clear throughout - never fill it in. '
  + 'The sigil keeps the SAME position and the SAME overall size in every frame: do not travel, '
  + 'tilt, flip or zoom the picture, and do not add letters or new objects. The last frame flows '
  + 'back into the first. Every ring and shard stays COMPLETE and inside the picture with a clear '
  + 'margin - let it brighten rather than grow past the edge, and never draw a flat sliced edge.';

const key = process.env.LUDO_API_KEY;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };
const ALPHA_ON = 8, EDGE_OPAQUE = 180, FLUSH_LIMIT = 10;

async function px(buf) { const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, w: info.width, h: info.height }; }
function inkBox(p) {
  let x0 = p.w, y0 = p.h, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.d[(y * p.w + x) * 4 + 3] > ALPHA_ON) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; n++; }
  if (x1 < 0) throw new Error('fully transparent');
  return { x0, y0, x1, y1, n, w: x1 - x0 + 1, h: y1 - y0 + 1, W: p.w, H: p.h };
}
// the same two cut-off checks the dash loops use: the canvas border, and a straight sliced edge
// INSIDE the art that the border check cannot see (measured on near-opaque pixels only, because
// a soft glow lights a whole perimeter faintly without being a slice)
function flushWorst(p) {
  const b = inkBox(p), A = (x, y) => p.d[(y * p.w + x) * 4 + 3];
  let L = 0, R = 0, T = 0, B = 0;
  for (let y = b.y0; y <= b.y1; y++) { if (A(b.x0, y) > EDGE_OPAQUE) L++; if (A(b.x1, y) > EDGE_OPAQUE) R++; }
  for (let x = b.x0; x <= b.x1; x++) { if (A(x, b.y0) > EDGE_OPAQUE) T++; if (A(x, b.y1) > EDGE_OPAQUE) B++; }
  return Math.max(100 * L / b.h, 100 * R / b.h, 100 * T / b.w, 100 * B / b.w);
}
function alphaStats(p) {
  let s = 0, n = 0, op = 0, mid = 0, midN = 0;
  const cx = p.w / 2, cy = p.h / 2, r2 = (p.w * 0.17) ** 2;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const a = p.d[(y * p.w + x) * 4 + 3];
    if ((x - cx) ** 2 + (y - cy) ** 2 < r2) { mid += a; midN++; }
    if (a > ALPHA_ON) { s += a; n++; if (a > 240) op++; }
  }
  const px = p.w * p.h;
  // COVER is the honest reading of "too opaque": how much of the 512-box this actually paints over,
  // area times alpha. The share of the INK that is opaque is a trap - a rune ring is meant to be
  // crisp bright linework, and gating on that rejects exactly the readable art the brief asked for.
  // What the player complained about is a ward they cannot see themselves through, which is cover.
  return { mean: s / Math.max(1, n), opaquePct: 100 * op / Math.max(1, n), core: mid / Math.max(1, midN), cover: 100 * s / (255 * px), inkPct: 100 * n / px };
}
function gateArt(p, label) {
  const bad = [], b = inkBox(p), a = alphaStats(p), f = flushWorst(p);
  if (b.x0 === 0 || b.y0 === 0 || b.x1 >= b.W - 1 || b.y1 >= b.H - 1) bad.push(`${label}: ink on the canvas border — the shipped block_mage_4 does exactly this at 511x512`);
  if (f > FLUSH_LIMIT) bad.push(`${label}: sliced flat inside the art (${f.toFixed(0)}% near-opaque along one side of the ink box, limit ${FLUSH_LIMIT}%)`);
  if (a.cover > 26) bad.push(`${label}: too opaque — it paints over ${a.cover.toFixed(0)}% of the box (the shipped frames are 40-44%; want <= 26% before the fade below)`);
  // "less complicated" and "not a solid core", made checkable: the middle 34% must stay clear
  if (a.core > 90) bad.push(`${label}: the centre is filled in (mean alpha ${a.core.toFixed(0)} in the middle, want <= 90) — the mage has to be visible inside the ward`);
  // shipped block_mage_8.webp is 0% ink - a blank last frame, so the current ward ends on nothing
  if (a.inkPct < 4) bad.push(`${label}: all but empty (${a.inkPct.toFixed(1)}% ink) — the shipped frame 8 is blank exactly like this`);
  return bad;
}
async function fade(buf, mul) {
  if (!(mul > 0) || mul === 1) return buf;
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * mul);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 94, alphaQuality: 100 }).toBuffer();
}
async function seat(raw) {
  let content; try { content = await sharp(raw).trim({ threshold: 6 }).png().toBuffer(); } catch { content = await sharp(raw).png().toBuffer(); }
  const inner = Math.round(S * 0.86);
  const fitted = await sharp(content).resize(inner, inner, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, gravity: 'centre' }]).webp({ quality: 95, alphaQuality: 100 }).toBuffer();
}
// ONE shared crop across the loop, and a union already on the source border means the model
// clipped it - no transform invents pixels back.
async function packFrames(bufs) {
  const boxes = []; for (const b of bufs) boxes.push(inkBox(await px(b)));
  const W = boxes[0].W, H = boxes[0].H;
  const u = boxes.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }));
  const touched = [u.x0 <= 1 && 'left', u.y0 <= 1 && 'top', u.x1 >= W - 2 && 'right', u.y1 >= H - 2 && 'bottom'].filter(Boolean);
  if (touched.length) throw new Error(`the loop is clipped at the source edge (${touched.join(', ')})`);
  const inner = Math.round(S * 0.86), cw = u.x1 - u.x0 + 1, chh = u.y1 - u.y0 + 1;
  const scale = inner / Math.max(cw, chh), out = [];
  for (const b of bufs) {
    const crop = await sharp(b).extract({ left: u.x0, top: u.y0, width: cw, height: chh })
      .resize(Math.max(1, Math.round(cw * scale)), Math.max(1, Math.round(chh * scale)), { fit: 'fill' }).png().toBuffer();
    out.push(await sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: crop, gravity: 'centre' }]).webp({ quality: 93, alphaQuality: 100 }).toBuffer());
  }
  console.log(`  union ${cw}x${chh} of ${W}x${H} -> ${inner}px, ${Math.round((S - inner) / 2)}px gutter every side`);
  return out;
}
async function post(url, body, label) {
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      process.stdout.write(`  ${label} attempt ${a} ... `);
      const res = await fetch(url, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(600000), body: JSON.stringify(body) });
      if (res.status === 402) { console.log('OUT OF CREDITS'); process.exit(3); }
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 120)}`);
      console.log('ok'); return await res.json();
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  throw new Error(`${label} FAILED: ${last && last.message}`);
}
async function framesFrom(data) {
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
    const cw = Math.floor(meta.width / data.num_cols), ch = Math.floor(meta.height / data.num_rows), o = [];
    for (let r = 0; r < data.num_rows && o.length < FRAMES; r++) for (let c = 0; c < data.num_cols && o.length < FRAMES; c++)
      o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= FRAMES) return o;
  }
  const urls = data.individual_frame_urls || [];
  if (urls.length >= FRAMES) { const o = []; for (let i = 0; i < FRAMES; i++) o.push(await fetchBuf(urls[i])); return o; }
  throw new Error('no usable frames in the response');
}

if (!has('--generate')) {
  console.log('DRY RUN.\n\n' + PROMPT + '\n\n' + MOTION + '\n');
  console.log('what is shipped today, measured:');
  for (const f of ['Sprites/fx/block_mage.webp', 'Sprites/fx/anim/block_mage_0.webp', 'Sprites/fx/anim/block_mage_4.webp']) {
    const p = await px(await readFile(join(ROOT, f))), b = inkBox(p), a = alphaStats(p);
    const touch = (b.x0 === 0 || b.y0 === 0 || b.x1 >= b.W - 1 || b.y1 >= b.H - 1);
    console.log(`  ${f.split('/').pop().padEnd(20)} ink ${b.w}x${b.h}  meanAlpha ${a.mean.toFixed(0)}  fullyOpaque ${a.opaquePct.toFixed(0)}%  core ${a.core.toFixed(0)}  ${touch ? 'TOUCHES THE BORDER' : 'margin ok'}`);
  }
  process.exit(0);
}
if (!key && !has('--spin')) { console.error('LUDO_API_KEY required'); process.exit(1); }
let chosen = null;
if (has('--anim-only') || has('--regate') || has('--spin')) chosen = await readFile(STILL);
else for (let roll = 1; roll <= ROLLS && !chosen; roll++) {
  const d = await post(`${API}/assets/image`, { image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PROMPT }, `still roll ${roll}`);
  const url = Array.isArray(d) ? d[0] && d[0].url : (d && (d.url || (d.images && d.images[0] && d.images[0].url)));
  if (!url) { console.log('  no url'); continue; }
  const seated = await seat(await fetchBuf(url));
  const p = await px(seated), bad = gateArt(p, 'the still'), a = alphaStats(p);
  console.log(`  roll ${roll}: cover ${a.cover.toFixed(0)}%% of the box, core ${a.core.toFixed(0)}, flush ${flushWorst(p).toFixed(0)}% - ${bad.length ? 'REJECT: ' + bad.join('; ') : 'PASSES every gate'}`);
  if (!bad.length) { chosen = seated; await writeFile(STILL + '.tmp', await fade(seated, ALPHA)); await rename(STILL + '.tmp', STILL); console.log('  still -> Sprites/fx/block_mage.webp'); }
}
if (!chosen) { console.error('no roll passed the gates'); process.exit(2); }
// a smaller seed than the still, so a flare has somewhere to go instead of clipping at source
const seed = await sharp({ create: { width: 990, height: 990, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: await sharp(chosen).resize(640, 640, { fit: 'inside' }).png().toBuffer(), gravity: 'centre' }]).png().toBuffer();
// --spin: BUILD THE LOOP OUT OF THE STILL INSTEAD OF ASKING FOR A REDRAW.
// The animate call was tried first and its frames passed every gate - and were worse art. It
// re-rendered the sigil from scratch each frame, so the cyan glow flattened to grey, the crystal
// shards lost their facets, and the six glyphs changed SHAPE frame to frame, which reads as
// flicker rather than as a turning ring. A rune circle's motion is a rotation; rotating is exactly
// the thing a transform does perfectly and a redraw does badly.
// 60 degrees across nine frames is one glyph position: the ring turns steadily and the loop closes
// seamlessly on six-fold symmetry, without the strobe a full 360 would give at this frame count.
if (has('--spin')) {
  const TURN = 60;
  // INSCRIBE IT IN A CIRCLE FIRST. seat() fits the art to a SQUARE, so the crystal shards sit out
  // at the corners of a 439px box - radius 276 in a 512 canvas whose half-width is 256. Rotating
  // that swings the shards straight through the border, which is the exact cut-off the user
  // complained about. Shrinking until the furthest lit pixel is inside a 250px radius makes the
  // whole loop rotation-safe by construction, and the STILL is rewritten from the same shrunk base
  // so the static sprite and frame 0 are the same picture - no pop when the frames finish decoding.
  const p0 = await px(chosen);
  let maxR = 0;
  const cx0 = p0.w / 2, cy0 = p0.h / 2;
  for (let y = 0; y < p0.h; y++) for (let x = 0; x < p0.w; x++) if (p0.d[(y * p0.w + x) * 4 + 3] > ALPHA_ON) { const r = Math.hypot(x - cx0, y - cy0); if (r > maxR) maxR = r; }
  const k = Math.min(1, 250 / maxR), inner = Math.round(S * k);
  console.log(`  furthest lit pixel at r=${maxR.toFixed(0)} of 256 — shrinking ${(100 * k).toFixed(0)}% so the shards clear the border through a full turn`);
  const base = await sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp(chosen).resize(inner, inner, { fit: 'inside' }).png().toBuffer(), gravity: 'centre' }]).png().toBuffer();
  await writeFile(STILL + '.tmp', await sharp(base).webp({ quality: 95, alphaQuality: 100 }).toBuffer());
  await rename(STILL + '.tmp', STILL);
  const out = [];
  for (let i = 0; i < FRAMES; i++) {
    const deg = (TURN * i) / FRAMES;
    // the ward brightens to a peak mid-loop and settles, the pulse the motion brief asked for
    const pulse = 0.86 + 0.14 * (1 - Math.cos((2 * Math.PI * i) / FRAMES)) / 2;
    const spun = await sharp(base).rotate(deg, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const m = await sharp(spun).metadata();
    const off = Math.round((m.width - S) / 2);
    const cropped = await sharp(spun).extract({ left: off, top: Math.round((m.height - S) / 2), width: S, height: S }).png().toBuffer();
    out.push(await fade(cropped, pulse));
  }
  const badSpin = [];
  for (let i = 0; i < out.length; i++) badSpin.push(...gateArt(await px(out[i]), `frame ${i}`));
  if (badSpin.length) { console.error('REJECT:\n  ' + badSpin.join('\n  ')); process.exit(2); }
  await mkdir(ANIM, { recursive: true });
  for (let i = 0; i < FRAMES; i++) { const f = join(ANIM, `block_mage_${i}.webp`); await writeFile(f + '.tmp', out[i]); await rename(f + '.tmp', f); }
  console.log(`\n  ${FRAMES} frames spun from the still, ${TURN} degrees across the loop — same art, real motion, no redraw.`);
  process.exit(0);
}
// CACHE THE ROLL. The first animate came back clean on every gate that mattered and was thrown away
// by a gate of mine that was wrong; re-deciding that cost a second paid call. Raw frames now land on
// disk before anything judges them, so --regate re-runs the packing and the gates for free.
const CACHE = join(ROOT, 'scripts', '_tmp_blockmage_frames');
let rawFrames;
if (has('--regate')) {
  rawFrames = []; for (let i = 0; i < FRAMES; i++) rawFrames.push(await readFile(join(CACHE, `raw_${i}.png`)));
  console.log(`  re-gating the ${FRAMES} cached frames — no API call`);
} else {
  const d2 = await post(`${API}/assets/sprite/animate`, { initial_image: 'data:image/png;base64,' + seed.toString('base64'), motion_prompt: MOTION, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite' }, 'animate');
  rawFrames = await framesFrom(d2);
  await mkdir(CACHE, { recursive: true });
  for (let i = 0; i < rawFrames.length; i++) await writeFile(join(CACHE, `raw_${i}.png`), rawFrames[i]);
}
const packed = await packFrames(rawFrames);
const bad = [];
for (let i = 0; i < packed.length; i++) bad.push(...gateArt(await px(packed[i]), `frame ${i}`));
if (bad.length) { console.error('REJECT:\n  ' + bad.join('\n  ')); process.exit(2); }
await mkdir(ANIM, { recursive: true });
for (let i = 0; i < FRAMES; i++) { const f = join(ANIM, `block_mage_${i}.webp`); await writeFile(f + '.tmp', await fade(packed[i], ALPHA)); await rename(f + '.tmp', f); }
console.log(`\n  ${FRAMES} frames written, none touching a border, none sliced, none opaque.`);
