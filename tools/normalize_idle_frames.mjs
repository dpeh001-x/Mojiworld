#!/usr/bin/env node
// Deterministic anti-zoom normalizer for monster idle frames.
// The animate endpoint sometimes "zoom-pulses" an idle loop (content bbox
// balloons ~50% mid-cycle then shrinks back — the mob visibly throbs).
// Prompt-side size-locks don't reliably stop it, so this rescales every
// frame's CONTENT to the base sprite's bbox width, re-composited onto the
// same canvas bottom-anchored (content bottom row preserved at the base's
// bottom row, horizontal sway kept by scaling the offset around centre).
//   node tools/normalize_idle_frames.mjs thornmaw [elderbark ...] [--mode idle]
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const MON = join(repoRoot, 'Sprites', 'monsters');
const argv = process.argv.slice(2);
const mode = (() => { const i = argv.indexOf('--mode'); return i >= 0 ? argv[i + 1] : 'idle'; })();
const types = argv.filter((a) => !a.startsWith('--') && a !== mode);
if (!types.length) { console.error('usage: node tools/normalize_idle_frames.mjs <type> [...] [--mode idle]'); process.exit(1); }

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function bbox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let minx = W, miny = H, maxx = -1, maxy = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (data[(y * W + x) * 4 + 3] > 16) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
  return { W, H, minx, miny, maxx, maxy, bw: maxx - minx + 1, bh: maxy - miny + 1 };
}

for (const type of types) {
  // Base reference: the static sprite's content width + bottom row.
  let basePath = join(MON, type + '.png');
  if (!(await exists(basePath))) basePath = join(MON, type + '.webp');
  if (!(await exists(basePath))) { console.log(`${type}: NO BASE — skipped`); continue; }
  const base = await bbox(await readFile(basePath));
  let fixed = 0;
  for (let i = 0; i < 9; i++) {
    const p = join(MON, mode, `${type}_${i}.webp`);
    if (!(await exists(p))) continue;
    const buf = await readFile(p);
    const fb = await bbox(buf);
    const s = base.bw / fb.bw;
    if (Math.abs(s - 1) < 0.04) continue;   // already within 4% — leave untouched
    const clamped = Math.min(1.6, Math.max(0.5, s));
    // Extract content, rescale, re-composite bottom-anchored on a fresh canvas.
    const content = await sharp(buf).extract({ left: fb.minx, top: fb.miny, width: fb.bw, height: fb.bh })
      .resize(Math.round(fb.bw * clamped), Math.round(fb.bh * clamped), { fit: 'fill' }).png().toBuffer();
    const cw = Math.round(fb.bw * clamped), ch = Math.round(fb.bh * clamped);
    // Horizontal: scale the frame's own centre-offset (preserves sway).
    const oldCx = fb.minx + fb.bw / 2, canvasCx = fb.W / 2;
    let left = Math.round(canvasCx + (oldCx - canvasCx) * clamped - cw / 2);
    // Vertical: plant the content bottom on the BASE's bottom row.
    let top = Math.round((base.maxy / base.H) * fb.H - ch);
    left = Math.max(0, Math.min(fb.W - cw, left));
    top = Math.max(0, Math.min(fb.H - ch, top));
    const out = await sharp({ create: { width: fb.W, height: fb.H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: content, left, top }]).webp({ quality: 92 }).toBuffer();
    await writeFile(p, out);
    fixed++;
    console.log(`  ${type}_${mode}_${i}: ${fb.bw}x${fb.bh} -> x${clamped.toFixed(3)}`);
  }
  console.log(`${type}/${mode}: ${fixed} frame(s) normalized (base bw ${base.bw}).`);
}
