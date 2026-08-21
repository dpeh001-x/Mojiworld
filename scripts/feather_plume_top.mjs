#!/usr/bin/env node
// Feather the TOP of the slam-plume frames into transparency.
//
// Per user, on the approved animation: "use this and feather the top
// significantly". The generated art is cel-shaded, so the plume ends in a hard
// outlined cauliflower cap — correct for a character sprite, wrong for smoke,
// which should dissolve at its crown rather than stop at a line.
//
// The ramp is measured PER FRAME against that frame's own content box, not a
// fixed pixel band: the plume grows from 459 px tall on frame 0 to 748 px on
// frame 8, so a fixed band would barely touch the first frames and gut the
// last. Each frame is faded over the top FEATHER_FRAC of its own height with a
// smoothstep, which has zero slope at both ends — a linear ramp leaves a
// visible crease where it meets full opacity.
//
// Applied to the frames in place. It is NOT idempotent (running twice fades
// twice), so it refuses to run on frames that already read as feathered.
//   node scripts/feather_plume_top.mjs            # dry-run: prints the plan
//   node scripts/feather_plume_top.mjs --apply
//   flags: --frac 0.45   --force (re-feather anyway)
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const ANIM_DIR = join(repoRoot, 'Sprites', 'vfx', 'anim');
const BASE = join(repoRoot, 'Sprites', 'vfx', 'quake_plume.webp');
const KEY = 'quake_plume', N = 9;
const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const FRAC = Math.max(0.05, Math.min(0.9, parseFloat(val('--frac', '0.45'))));
const APPLY = argv.includes('--apply'), FORCE = argv.includes('--force');

const targets = [BASE, ...Array.from({ length: N }, (_, i) => join(ANIM_DIR, `${KEY}_${i}.webp`))];
for (const t of targets) if (!existsSync(t)) { console.error('missing: ' + t); process.exit(1); }

const smoothstep = (t) => t * t * (3 - 2 * t);

async function feather(path, write) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  let y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] > 10) { if (y < y0) y0 = y; if (y > y1) y1 = y; break; }
  }
  if (y1 < 0) return { skipped: 'empty' };
  const h = y1 - y0 + 1;
  const band = Math.max(1, Math.round(h * FRAC));

  // Already feathered? A hard-capped plume is near-opaque within a few rows of
  // its top; a feathered one is still nearly clear a tenth of the way down.
  const probe = Math.min(H - 1, y0 + Math.round(band * 0.25));
  let sum = 0, n = 0;
  for (let x = 0; x < W; x++) { const a = data[(probe * W + x) * 4 + 3]; if (a > 0) { sum += a; n++; } }
  const meanAtProbe = n ? Math.round(sum / n) : 0;
  const looksFeathered = meanAtProbe < 70;

  if (write) {
    for (let y = y0; y < Math.min(H, y0 + band); y++) {
      const s = smoothstep((y - y0) / band);
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4 + 3;
        if (data[i]) data[i] = Math.round(data[i] * s);
      }
    }
    const out = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 92 }).toBuffer();
    await writeFile(path, out);
  }
  return { y0, y1, h, band, meanAtProbe, looksFeathered };
}

const plan = [];
for (const t of targets) plan.push({ t, ...(await feather(t, false)) });
const already = plan.filter(p => p.looksFeathered);
console.log(`feather ${FRAC.toFixed(2)} of each frame's own height, smoothstep, top-down\n`);
for (const p of plan) console.log(`  ${p.t.split(/[\\/]/).pop().padEnd(20)} content ${String(p.h).padStart(3)}px  ->  fade over top ${String(p.band).padStart(3)}px   (alpha at 1/4 band: ${p.meanAtProbe})`);

if (!APPLY) { console.log('\n# dry run — re-run with --apply'); process.exit(0); }
if (already.length && !FORCE) {
  console.error(`\nREFUSING: ${already.length}/${targets.length} frames already read as feathered (alpha at the probe row is low).`);
  console.error('Feathering is not idempotent — running twice fades twice. Regenerate the frames, or pass --force if you mean it.');
  process.exit(1);
}
for (const t of targets) await feather(t, true);
console.log('\napplied to ' + targets.length + ' files.');
