#!/usr/bin/env node
// Normalise a monster's ATTACK frames so every frame's body occupies the same
// fraction of its canvas.
// ============================================================================
// Why this is an asset fix and not a renderer fix: the monster draw box is
// targetH x _ATK_FRAME_SCALE[type] and does NOT vary per frame, so the rendered
// creature size is decided by how much of its 640px canvas the body fills. If
// the frames are padded inconsistently, the creature pulses.
//
// A per-frame scale table was tried first and does not work: monsters blit from
// a baked cache keyed by STATE ('attack'), not by frame, so the frame index is
// not available at draw time -- measured, the applied scale never moved off
// entry 0. Normalising the art sidesteps the cache entirely.
//
// Content is scaled about its BOTTOM edge, because the renderer anchors on the
// lowest opaque pixel ("the character's ACTUAL feet land at the monster's foot
// line"), and horizontally about its centre.
//
// STATUS: this WAS applied to fatDragon and then deliberately REVERTED. Shown
// the corrected cycle frame by frame, the user chose the original art ("lets go
// with the before") and asked for a longer attack instead, so Plumpdrake's
// size variation through the swing is intentional. Do not re-apply it to that
// type without asking. The tool itself is unchanged and still correct for any
// type whose padded attack frames genuinely do pulse.
//
//   node scripts/normalise_atk_frames.mjs fatDragon            # report only
//   node scripts/normalise_atk_frames.mjs fatDragon --write
// ============================================================================
import sharp from 'sharp';
import { readdir, writeFile, rename, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const type = process.argv[2];
const WRITE = process.argv.includes('--write');
if (!type) { console.error('usage: normalise_atk_frames.mjs <type> [--write]'); process.exit(1); }

const bbox = async (buf) => {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let top = -1, bot = -1, l = -1, r = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 16) {
      if (top < 0) top = y; bot = y;
      if (l < 0 || x < l) l = x; if (x > r) r = x;
    }
  }
  return { top, bot, l, r, h: bot - top + 1, w: r - l + 1, W: info.width, H: info.height };
};

const idlePath = path.join(ROOT, 'Sprites/monsters', type + '.webp');
const idle = await bbox(await sharp(idlePath).toBuffer());
const idleFrac = idle.h / idle.H;

const atkDir = path.join(ROOT, 'Sprites/monsters/attack');
const files = (await readdir(atkDir)).filter(f => f.startsWith(type + '_')).sort();
if (!files.length) { console.error('no attack frames for ' + type); process.exit(1); }

// The target is whatever makes the SHIPPED per-type scale correct, so the
// constant in the game does not have to move.
const { readFile } = await import('node:fs/promises');
const src = await readFile(path.join(ROOT, 'mojiworld_game.html'), 'utf8');
const m = new RegExp('_ATK_FRAME_SCALE = Object\\.assign\\(Object\\.create\\(null\\), \\{[\\s\\S]*?' + type + ':\\s*([0-9.]+)').exec(src);
const perType = m ? parseFloat(m[1]) : null;
if (!perType) { console.error('could not read _ATK_FRAME_SCALE.' + type); process.exit(1); }
const target = idleFrac / perType;

console.log(`${type}: idle body ${(idleFrac * 100).toFixed(2)}% of frame, _ATK_FRAME_SCALE ${perType}`);
console.log(`target attack body fraction = ${idleFrac.toFixed(4)} / ${perType} = ${target.toFixed(4)}`);
console.log('\nframe                 before   ->  after    rendered vs idle');
let changed = 0;
for (const f of files) {
  const p = path.join(atkDir, f);
  const buf = await sharp(p).toBuffer();
  const b = await bbox(buf);
  const frac = b.h / b.H;
  const k = target / frac;                       // scale content by this
  const before = (frac * perType) / idleFrac;
  if (Math.abs(k - 1) < 0.004) {
    console.log(`${f.padEnd(20)} ${frac.toFixed(4)}  ->  (unchanged)   ${before.toFixed(3)}`);
    continue;
  }
  // Resize the CONTENT, not the whole canvas: a frame that needs to GROW would
  // otherwise produce an image larger than the 640px canvas and sharp refuses to
  // composite it.
  const tgtH = Math.max(1, Math.round(target * b.H));
  const kk = tgtH / b.h;
  const tgtW = Math.max(1, Math.round(b.w * kk));
  const content = await sharp(buf).extract({ left: b.l, top: b.top, width: b.w, height: b.h })
    .resize(tgtW, tgtH, { fit: 'fill' }).ensureAlpha().toBuffer();
  // Keep the feet where they were (the renderer anchors on the lowest opaque
  // pixel) and the body centred on its old centre.
  let top = (b.bot + 1) - tgtH;
  let left = Math.round((b.l + b.r + 1) / 2 - tgtW / 2);
  top = Math.max(0, Math.min(b.H - tgtH, top));
  left = Math.max(0, Math.min(b.W - tgtW, left));
  const out = await sharp({ create: { width: b.W, height: b.H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: content, left, top }])
    .webp({ quality: 92, alphaQuality: 100 }).toBuffer();
  const after = await bbox(out);
  const afterFrac = after.h / after.H;
  console.log(`${f.padEnd(20)} ${frac.toFixed(4)}  ->  ${afterFrac.toFixed(4)}      ${((afterFrac * perType) / idleFrac).toFixed(3)}  (was ${before.toFixed(3)})`);
  if (WRITE) {
    const bak = path.join(ROOT, 'Sprites/monsters/attack/_orig');
    await mkdir(bak, { recursive: true });
    await copyFile(p, path.join(bak, f)).catch(() => {});
    await writeFile(p + '.tmp', out);
    await rename(p + '.tmp', p);
    changed++;
  }
}
console.log(WRITE ? `\nwrote ${changed} frame(s); originals copied to Sprites/monsters/attack/_orig/`
                  : '\n(report only — re-run with --write to apply)');
