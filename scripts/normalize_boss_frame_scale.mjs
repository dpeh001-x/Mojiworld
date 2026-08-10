#!/usr/bin/env node
// Force every frame of a boss animation set to the BASE sprite's character
// scale, anchored at the feet.
//   node scripts/normalize_boss_frame_scale.mjs gravitos gravitoslaser
//
// The eagle model creeps the camera in as a pose gets bigger. The zoom test
// catches gross cases, but a ~20% drift sits under it and still reads as the
// character changing size mid-attack — which is exactly what "same character
// size" forbids. This measures each frame's ARMOUR height (dark pixels, so
// bright FX above the head does not count as body), scales the frame content
// by base/frame about the bottom-centre, and re-composites on the same canvas.
// Deterministic, no API calls, and it leaves a correctly-scaled frame untouched.
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = join(repoRoot, 'Sprites', 'bosses', 'gravitos.webp');
const DIR = join(repoRoot, 'Sprites', 'bosses', 'attack');
const keys = process.argv.slice(2);
if (!keys.length) { console.error('usage: normalize_boss_frame_scale.mjs <key> [key...]'); process.exit(1); }

async function armour(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, maxX = -1, minY = info.height, maxY = -1;
  for (let i = 0; i < info.width * info.height; i++) {
    const lum = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    if (data[i * 4 + 3] > 200 && lum < 130) {
      const x = i % info.width, y = (i / info.width) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return { W: info.width, H: info.height, minX, maxX, minY, maxY, h: maxY - minY + 1, cx: (minX + maxX) / 2 };
}

const baseA = await armour(await readFile(BASE));
console.log(`base armour height ${baseA.h}px (${Math.round(baseA.h / baseA.H * 100)}% of canvas)\n`);

for (const key of keys) {
  console.log(`--- ${key} ---`);
  for (let i = 0; i < 9; i++) {
    const p = join(DIR, `${key}_${i}.webp`);
    if (!existsSync(p)) continue;
    const buf = await readFile(p);
    const a = await armour(buf);
    const k = baseA.h / a.h;
    if (Math.abs(1 - k) < 0.02) { console.log(`  ${i}: ${Math.round(a.h / a.H * 100)}% — already on scale`); continue; }
    const nw = Math.max(1, Math.round(a.W * k)), nh = Math.max(1, Math.round(a.H * k));
    const scaled = await sharp(buf).resize(nw, nh, { fit: 'fill' }).png().toBuffer();
    // Anchor the FEET: keep the armour's bottom edge and horizontal centre where
    // the base sprite has them, so the boss neither floats nor slides.
    const left = Math.round(baseA.cx - a.cx * k);
    const top = Math.round((baseA.maxY + 1) - (a.maxY + 1) * k);
    const out = await sharp({ create: { width: a.W, height: a.H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: scaled, left, top }]).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
    await writeFile(p, out);
    const after = await armour(out);
    console.log(`  ${i}: ${Math.round(a.h / a.H * 100)}% -> ${Math.round(after.h / after.H * 100)}%  (x${k.toFixed(3)})`);
  }
  // keep the static in step with the frame it mirrors
  const stat = join(DIR, `${key}.webp`);
  const alt = join(repoRoot, 'Sprites', 'bosses', `${key}.webp`);
  const target = existsSync(stat) ? stat : (key !== 'gravitos' && existsSync(alt) ? alt : null);
  if (target && existsSync(join(DIR, `${key}_4.webp`))) {
    await writeFile(target, await readFile(join(DIR, `${key}_4.webp`)));
    console.log(`  static <- ${key}_4`);
  }
}
console.log('\ndone');
