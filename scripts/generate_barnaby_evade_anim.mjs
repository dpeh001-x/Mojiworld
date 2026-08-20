#!/usr/bin/env node
// Young Confused Barnaby — DUCK + WEAVE evade animations.
// =============================================================================
//   node scripts/generate_barnaby_evade_anim.mjs             # dry-run: prompts
//   node scripts/generate_barnaby_evade_anim.mjs --generate  # call Ludo, write
//   flags: --only duck|weave   --force
//
// Per user: "For barnaby boss he is doing alot of ducking and weaving,
// regenerate new duck and weave sprites animation compliment his fighting
// style." His activeBoss AI hops constantly (jump 8, 1.1s jump cd, 9%/frame
// jump roll) but the renderer only knows attack/walk/idle, so every airborne
// dart played the WALK loop. These two sets give the movement its own art:
//   Sprites/bosses/weave/young_confused_barnaby_0..8.webp  (airborne slip)
//   Sprites/bosses/duck/young_confused_barnaby_0..8.webp   (landing crouch)
//
// GEOMETRY CONTRACT: every existing barnaby set (static, idle, walk, attack)
// ships on a 1200x900 canvas, and _drawBossSprite derives BOTH the on-screen
// size (sourceMaxDim / 1024) AND the foot anchor (the idle set's bbox) from
// canvas geometry — a set on a different canvas makes the boss change size or
// hop vertically when the state switches. Output frames are therefore resized
// to the idle frame's exact canvas before writing.
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOSS_DIR = join(ROOT, 'Sprites', 'bosses');
const TYPE = 'young_confused_barnaby';
const FRAMES = 9;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const exists = (p) => access(p).then(() => true, () => false);

const FACING = ' Keep the EXACT same left/right facing and orientation as the ' +
  'source image — NEVER mirror or flip the character horizontally.';
const SETS = {
  attack: {
    // His signature: "Lashes out in two directions at once" (bigMelee swing +
    // columnStrike). Facing-agnostic by design — a two-sided lash can never
    // read as aimed the wrong way once the game mirrors the sprite.
    motion: 'the character ATTACKS in place with a ferocious two-directional ' +
      'lash — it coils low for a beat, then whips its weapon and limbs out to ' +
      'BOTH sides at once in a wide double strike, energy cracking outward left ' +
      'and right, then recovers to its stance. CRITICAL: it stays the EXACT ' +
      'same size and centered position — do NOT zoom, lunge across the frame, ' +
      'or rescale; feet stay on the same ground line. Keep the whole character ' +
      'and both strikes fully inside the frame.' + FACING,
  },
  weave: {
    motion: 'the character bobs and WEAVES evasively like a boxer slipping ' +
      'punches — the body sways side to side and dips, shoulders rolling, head ' +
      'slipping left then right in a smooth continuous evasive rhythm, cloak or ' +
      'loose parts trailing the sway. CRITICAL: it stays the EXACT same size and ' +
      'centered position in every frame — do NOT zoom, lunge across the frame, ' +
      'or rescale; the sway happens inside its own silhouette. Seamless loop: ' +
      'the last frame flows back into the first. Keep the whole character fully ' +
      'inside the frame.' + FACING,
  },
  duck: {
    motion: 'the character DUCKS: knees bend deep and the whole body drops into ' +
      'a low compact crouch, head tucked between the shoulders, then springs ' +
      'back up to full height — one smooth duck-and-recover cycle. CRITICAL: the ' +
      'feet stay planted on the SAME ground line in every frame, the same size, ' +
      'no zoom, no horizontal travel — only the body compresses downward and ' +
      'rises again. Keep the whole character fully inside the frame.' + FACING,
  },
};
const only = (arg('--only') || 'weave,duck,attack').split(',').map((s) => s.trim()).filter((k) => SETS[k]);

if (!has('--generate')) {
  console.log('DRY RUN — nothing called, nothing written.\n');
  for (const k of only) console.log(`--- ${k} motion ---\n${SETS[k].motion}\n`);
  console.log('Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchBuf = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); };
// <1MP input so frame_size:-9 (True Size) is accepted — same trick as the
// walk/attack generators' smallBaseUri.
const smallBaseUri = async (p) =>
  'data:image/png;base64,' + (await sharp(await readFile(p))
    .resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
// Slice the spritesheet in preference to individual_frame_urls — Ludo squares
// non-square individual frames (890x990 comes back 890x890, cropping legs).
async function framesFrom(data, n) {
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
    const cw = Math.floor(meta.width / data.num_cols), ch = Math.floor(meta.height / data.num_rows), out = [];
    for (let r = 0; r < data.num_rows && out.length < n; r++)
      for (let c = 0; c < data.num_cols && out.length < n; c++)
        out.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (out.length >= n) return out;
  }
  const urls = data.individual_frame_urls || [];
  if (urls.length >= n) { const out = []; for (let i = 0; i < n; i++) out.push(await fetchBuf(urls[i])); return out; }
  throw new Error('no usable frames');
}

// The canvas every frame must land on (see GEOMETRY CONTRACT above).
const idleMeta = await sharp(join(BOSS_DIR, 'idle', `${TYPE}_0.webp`)).metadata();
console.log(`canvas contract: ${idleMeta.width}x${idleMeta.height} (from the idle set)`);

for (const setKey of only) {
  const outDir = join(BOSS_DIR, setKey);
  process.stdout.write(`${setKey} ... `);
  const have = (await Promise.all(Array.from({ length: FRAMES }, (_, i) => exists(join(outDir, `${TYPE}_${i}.webp`))))).every(Boolean);
  if (!has('--force') && have) { console.log('skip (frames exist)'); continue; }
  const res = await fetch(`${API}/assets/sprite/animate`, {
    method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(300000),
    body: JSON.stringify({
      initial_image: await smallBaseUri(join(BOSS_DIR, `${TYPE}.webp`)),
      motion_prompt: SETS[setKey].motion,
      frames: FRAMES, frame_size: -9, model: 'eagle',
      individual_frames: true, loop: true, image_type: 'sprite',
    }),
  });
  if (!res.ok) { const t = await res.text();
    if (/\b402\b/.test(t) || res.status === 402) throw new Error('402 OUT OF CREDITS');
    throw new Error(`${res.status}: ${t.slice(0, 150)}`); }
  const bufs = await framesFrom(await res.json(), FRAMES);
  await mkdir(outDir, { recursive: true });
  for (let i = 0; i < bufs.length; i++) {
    await writeFile(join(outDir, `${TYPE}_${i}.webp`),
      await sharp(bufs[i]).resize(idleMeta.width, idleMeta.height, { fit: 'fill' }).webp({ quality: 92 }).toBuffer());
  }
  console.log(`OK -> ${FRAMES} frames at ${idleMeta.width}x${idleMeta.height}`);
  await sleep(800);
}
// =============================================================================
// NORMALISE — per user "ensure the canvas and character size stays constant
// throughout the idle, walk, attack, duck weave animations".
//
// Equal canvases alone do not give that: the model draws the character at its
// own scale per generation, and _drawBossSprite stretches canvas geometry, so
// a set whose CONTENT is 10% shorter makes the boss visibly shrink on every
// state switch. The reference is the idle set (its bbox is also the canonical
// foot anchor in _drawBossSprite). Each new set gets ONE uniform transform —
// scale = idle frame-0 content height / this set's frame-0 content height,
// then a vertical shift pinning the foot line to idle's. One transform for the
// WHOLE set (never per frame): a duck's compressed frames are SUPPOSED to be
// shorter than its standing frames — per-frame scaling would iron the
// animation flat. Frame 0 anchors the scale because loop generations start at
// the source pose (standing), which is the like-for-like height to compare.
// =============================================================================
const ALPHA = 24;
const bboxOf = async (buf) => {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (data[(y * W + x) * C + 3] > ALPHA) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  return (x1 < 0) ? null : { x0, y0, x1, y1, W, H, h: y1 - y0 + 1 };
};
const refBox = await bboxOf(await readFile(join(BOSS_DIR, 'idle', `${TYPE}_0.webp`)));
console.log(`\nnormalising to idle frame 0: content height ${refBox.h}px, foot line y=${refBox.y1}`);
for (const setKey of only) {
  const outDir = join(BOSS_DIR, setKey);
  const f0 = join(outDir, `${TYPE}_0.webp`);
  if (!(await exists(f0))) continue;
  const box0 = await bboxOf(await readFile(f0));
  if (!box0) { console.log(`  ${setKey}: EMPTY frame 0, skipped`); continue; }
  const sf = refBox.h / box0.h;
  const dy = Math.round(refBox.y1 - box0.y1 * sf);
  const dx = Math.round((idleMeta.width - idleMeta.width * sf) / 2);
  console.log(`  ${setKey}: frame-0 height ${box0.h}px -> scale ${sf.toFixed(3)}, shift (${dx}, ${dy})`);
  if (Math.abs(sf - 1) < 0.02 && Math.abs(dy) < 8) { console.log(`  ${setKey}: within tolerance, untouched`); continue; }
  const { rename } = await import('node:fs/promises');
  for (let i = 0; i < FRAMES; i++) {
    const p = join(outDir, `${TYPE}_${i}.webp`);
    const sw = Math.round(idleMeta.width * sf), shh = Math.round(idleMeta.height * sf);
    const scaled = await sharp(await readFile(p)).resize(sw, shh, { fit: 'fill' }).png().toBuffer();
    // Place the scaled frame at (dx, dy) inside the reference canvas. Offsets
    // can be negative (an upscale overhangs), so pad outward first and then
    // extract the canvas window — sharp's composite cannot place negatively.
    const padded = await sharp(scaled).extend({
      top: Math.max(0, dy),
      left: Math.max(0, dx),
      bottom: Math.max(0, idleMeta.height - (shh + dy)),
      right: Math.max(0, idleMeta.width - (sw + dx)),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }).png().toBuffer();
    const out = await sharp(padded)
      .extract({ left: Math.max(0, -dx), top: Math.max(0, -dy), width: idleMeta.width, height: idleMeta.height })
      .webp({ quality: 92 }).toBuffer();
    await writeFile(p + '.tmp', out);
    await rename(p + '.tmp', p);
  }
  const check0 = await bboxOf(await readFile(f0));
  console.log(`  ${setKey}: normalised — frame-0 height now ${check0.h}px (ref ${refBox.h}), foot y=${check0.y1} (ref ${refBox.y1})`);
}
console.log('\nNEXT: node scripts/gen_sprite_frame_index.mjs  (the loader asks the index)');
