#!/usr/bin/env node
// Gravitos SOUL DRAIN attack animation (ludo.ai) — 9 frames from the current
// form-1 sprite, on its exact canvas.
//   node scripts/generate_gravitos_soul_anim.mjs --generate [--force]
// Needs LUDO_API_KEY.
//
// Soul Drain (patternState 'soulDrain', 1900 ms window) had no dedicated art
// in any form — it fell back to the generic attack set while a sprite-burst
// ring carried the whole telegraph. Same pipeline as the gravitospunch set:
// animate from the base sprite ALONE (a final_image makes the model morph and
// rescale — v0.26.313), frame_size -9 so position anchors, eagle model.
//
// "No cutoffs or resizing" is enforced, not hoped for: every frame is emitted
// at EXACTLY the base sprite's 1656x1505 canvas (the same dims every other
// gravitos set uses), and the script FAILS — rather than writes — if any
// frame's alpha touches an edge, if the body's centroid drifts, or if its
// silhouette pulses in size across frames.
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = join(repoRoot, 'Sprites', 'bosses', 'gravitos.webp');
const OUT_DIR = join(repoRoot, 'Sprites', 'bosses', 'attack');
const STATIC_OUT = join(repoRoot, 'Sprites', 'bosses', 'gravitossoul.webp');
const FRAMES = 9;
const argv = process.argv.slice(2);

const FACING = ' Keep the EXACT same left/right facing and orientation as the ' +
  'source image — NEVER mirror or flip the character horizontally.';
// Facing-agnostic by design (energy converges on him), same as the mooma /
// aetherion overrides: an inward drain can never read as "aimed the wrong way"
// once the game mirrors the sprite.
// Two rolls failed before this wording: "wisps spiral inward from the
// surrounding air" invited a FULL-FRAME opaque energy explosion (core bbox
// 100%x100% from frame 2 on, every edge clipped). Same failure class the
// aetherion override fixed by demanding the energy stay "concentrated as a
// charge at the mouth" — so the drain is now a small glow AT HIS CHEST and the
// emptiness of the rest of the frame is stated as a hard requirement.
const MOTION =
  'the dark cosmic boss casts a curse IN PLACE — he slowly raises his arms and ' +
  'hunches slightly while a SMALL orb of violet-purple soul energy charges and ' +
  'brightens AT HIS CHEST, his eyes glowing violet. A few THIN whisper-like ' +
  'wisps curl tightly against his silhouette, hugging his outline like a thin ' +
  'shroud. Keep ALL energy effects concentrated ON his body — a compact chest ' +
  'glow and a tight outline shimmer only. ' +
  'CRITICAL: the REST of the frame stays completely EMPTY and TRANSPARENT — ' +
  'no background, no room-filling blast, no energy field, no glow clouds away ' +
  'from his body. At least a third of the image on every side of him remains ' +
  'fully transparent in EVERY frame. ' +
  // Roll 3 held for frames 0-3 then still exploded at the climax. The mooma
  // override beat the same tendency by ENDING SETTLED ("then settles back to
  // its stance") — and absorption is the truer read for a drain anyway: the
  // energy goes INTO him, it does not detonate.
  'Across the animation the chest orb brightens, then in the FINAL frames it ' +
  'is ABSORBED INTO his body and FADES OUT COMPLETELY as he settles back to ' +
  'his exact starting stance — the energy NEVER explodes, NEVER bursts, NEVER ' +
  'flashes outward and NEVER expands beyond his silhouette at ANY point in ' +
  'ANY frame. ' +
  'His body stays the EXACT same size, scale and centered position in EVERY ' +
  'frame — do NOT zoom, enlarge, shrink or reposition him; never clip his ' +
  'head, arms or any part at any edge. ONE single connected body; do not ' +
  'duplicate or detach limbs.' + FACING;

if (!argv.includes('--generate')) {
  console.log('# 1 animation: gravitos (form 1) SOUL DRAIN -> attack/gravitossoul_0..8.webp + gravitossoul.webp static');
  console.log('# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}
const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';

async function post(path, body) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(300000) });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${(await res.text()).slice(0, 180)}`);
  return res.json();
}
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); }

const baseMeta = await sharp(BASE).metadata();
console.log(`base: ${baseMeta.width}x${baseMeta.height}`);
// Pad the input 12% per side before animating (the generator's LUDO_ANIM_PAD
// trick): the converging-wisp effect needs headroom, and the first roll's
// frames hard-clipped on every edge without it. The pad is cropped back off
// after, so the emitted canvas is still exactly the base's.
const PAD = 0.12;
const _padX = Math.round(baseMeta.width * PAD), _padY = Math.round(baseMeta.height * PAD);
const padded = await sharp(await readFile(BASE))
  .extend({ top: _padY, bottom: _padY, left: _padX, right: _padX, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png().toBuffer();
const padMeta = await sharp(padded).metadata();
const small = await sharp(padded).resize(940, 940, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();

console.log('animating (eagle, 9 frames, frame_size -9, pad 12%)...');
const data = await post('/assets/sprite/animate', {
  initial_image: 'data:image/png;base64,' + small.toString('base64'),
  motion_prompt: MOTION,
  frames: FRAMES, frame_size: -9, model: 'eagle',
  individual_frames: true, loop: false, image_type: 'sprite',
});

// Slice the SPRITESHEET (individual_frame_urls wrongly square non-square
// frames — the exact bug that once gave gravitos "detached limbs").
let bufs = [];
if (data.spritesheet_url && data.num_cols && data.num_rows) {
  const sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
  const cw = Math.floor(meta.width / data.num_cols), ch = Math.floor(meta.height / data.num_rows);
  for (let r = 0; r < data.num_rows && bufs.length < FRAMES; r++)
    for (let c = 0; c < data.num_cols && bufs.length < FRAMES; c++)
      bufs.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
} else {
  const urls = data.individual_frame_urls || [];
  if (urls.length < FRAMES) throw new Error('no spritesheet and too few frames');
  for (let i = 0; i < FRAMES; i++) bufs.push(await fetchBuf(urls[i]));
}
if (bufs.length < FRAMES) throw new Error(`got ${bufs.length} frames`);

// ---- normalize to the PADDED canvas, crop the pad off, then gate ----------
// Cells share the padded aspect, so fill-resize to the padded dims, then
// extract the original canvas region: canvas-exact output, body anchored where
// the base sprite has it, and effects that used the pad's headroom crop like
// any other gravitos frame's effects would.
const finals = [];
for (const b2 of bufs) {
  finals.push(await sharp(await sharp(b2).resize(padMeta.width, padMeta.height, { fit: 'fill' }).png().toBuffer())
    .extract({ left: _padX, top: _padY, width: baseMeta.width, height: baseMeta.height })
    .png().toBuffer());
}

// ---- QUALITY GATE (calibrated against the shipped punch set) --------------
// Measured on the opaque CORE (alpha > 200): the soft aura is allowed to reach
// edges, the body is not. Bottom contact is ALLOWED — gravitos.webp itself and
// every shipped punch frame sit with feet on the canvas floor (B = 1-3 px).
// The punch precedent grows its bbox 41% -> 59% mid-swing, so size tolerance
// is on HEIGHT (18%), not width — an attack extending an arm is motion, a body
// inflating is a defect.
const stats = [];
for (let i = 0; i < FRAMES; i++) {
  const { data: px, info } = await sharp(finals[i]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, maxX = -1, minY = info.height, maxY = -1, sx = 0, sy = 0, n = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (px[(y * info.width + x) * 4 + 3] > 200) {
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      sx += x; sy += y; n++;
    }
  }
  stats.push({ i, w: info.width, h: info.height, minX, maxX, minY, maxY,
    cx: sx / n / info.width, cy: sy / n / info.height,
    bh: (maxY - minY + 1) / info.height, bw: (maxX - minX + 1) / info.width });
}
let bad = 0;
const mgX = Math.ceil(stats[0].w * 0.005), mgY = Math.ceil(stats[0].h * 0.005);
for (const s2 of stats) {
  const clip = s2.minX <= mgX || s2.minY <= mgY || s2.maxX >= s2.w - 1 - mgX;   // bottom exempt
  const cxd = Math.abs(s2.cx - stats[0].cx), cyd = Math.abs(s2.cy - stats[0].cy);
  const szd = Math.abs(s2.bh - stats[0].bh) / stats[0].bh;
  const flag = [];
  if (clip) flag.push('CLIPS-EDGE');
  if (cxd > 0.06 || cyd > 0.06) flag.push('DRIFTS');
  if (szd > 0.18) flag.push('PULSES');
  if (flag.length) bad++;
  console.log(`frame ${s2.i}: core centroid (${s2.cx.toFixed(3)},${s2.cy.toFixed(3)}) bbox ${Math.round(s2.bw * 100)}%x${Math.round(s2.bh * 100)}%  ${flag.join(' ') || 'ok'}`);
}
if (bad) {
  // Keep the raw frames: four rolls in, the eagle model ALWAYS detonates a
  // full-frame blast mid-animation no matter how the prompt forbids it, and
  // every re-roll costs credits. scripts/salvage_gravitos_soul.mjs builds a
  // feathered silhouette shroud from the CLEAN frames and masks the blast down
  // to a body-hugging aura — deterministic, instead of another dice roll.
  const RAW = join(repoRoot, 'scripts', '_tmp_soul_raw');
  await mkdir(RAW, { recursive: true });
  for (let i = 0; i < FRAMES; i++) await writeFile(join(RAW, `raw_${i}.png`), finals[i]);
  console.error(`\n${bad} frame(s) failed the gate — raws kept in scripts/_tmp_soul_raw for salvage.`);
  process.exit(2);
}

await mkdir(OUT_DIR, { recursive: true });
for (let i = 0; i < FRAMES; i++) {
  await writeFile(join(OUT_DIR, `gravitossoul_${i}.webp`),
    await sharp(finals[i]).webp({ quality: 92, alphaQuality: 100 }).toBuffer());
}
// Static fallback (drawn until frames decode) = the full-cast final frame.
await writeFile(STATIC_OUT, await sharp(finals[FRAMES - 1]).webp({ quality: 92, alphaQuality: 100 }).toBuffer());
console.log(`\nOK -> ${FRAMES} frames + static, all ${baseMeta.width}x${baseMeta.height}`);
