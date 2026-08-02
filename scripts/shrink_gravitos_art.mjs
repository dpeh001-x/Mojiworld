#!/usr/bin/env node
// v0.29.391 — Downscale the Gravitos source art to the DPR-2 bake target.
//
//   node scripts/shrink_gravitos_art.mjs [--apply]
//
// WHY. Gravitos ships the largest art in the game (2200x2000 .. 3000x2200,
// 4.4-6.6 MP/frame) across FIVE sprite forms. Two synchronous costs scale with
// that area and both land in one frame at a phase swap:
//   1. the first drawImage of each frame = ~110 ms of synchronous decode;
//   2. _spriteContentBox's getImageData readback (capped at 1100 px in
//      v0.29.388, but the decode above is untouched by that cap).
// Measured: _deriveBossRefHeight('gravitos3') blocked 1,036 ms, 3.7 s across
// the five forms — per state. On a slower machine that crosses the browser's
// "page unresponsive" threshold and the tab hard-freezes mid-fight.
//
// TARGET = long edge 1656, and that number is not arbitrary. The engine already
// bakes boss frames down to _lxShrinkCap(720) = ceil(720 * min(3,DPR) * 1.15):
//   DPR 1 -> 828    DPR 1.5 -> 1242    DPR 2 -> 1656    DPR 3 -> 2484
// Shipping at 1656 means every display up to DPR 2 gets a source that is at or
// above what the engine would have baked anyway — _lxBakeToLong early-returns
// ("already small enough"), so those users lose NOTHING and additionally skip
// the bake work entirely. Only DPR-3 (phones, which have their own reductions)
// sees any softening, and only 2484 -> 1656.
//
// SAFETY. Every file of a form shares one canvas across static/idle/walk/attack
// — that is the invariant gen_anim_manifest.mjs validates, and breaking it makes
// the character drift between states. So the scale is derived per FORM and every
// file of that form gets byte-identical output dimensions, asserted below.
// data/anim_calib.js is fractional (dy: 0.045, w: 0.4589) and therefore
// scale-invariant; data/anim_calib_manifest.js carries pixel dims and MUST be
// regenerated afterwards (scripts/gen_anim_manifest.mjs).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');
const LONG_EDGE = 1656;
const BOSSES = path.join(ROOT, 'Sprites', 'bosses');
const BACKUP = path.join(BOSSES, '_backup_gravitos', 'pre_1656');

const DIRS = ['', 'idle', 'walk', 'attack'];
const isGrav = (f) => /^gravitos/i.test(f) && /\.(webp|png)$/i.test(f);

// Collect every Gravitos file, grouped by form (the shared-canvas unit).
const forms = new Map();   // formKey -> [{abs, rel, dir, file}]
for (const d of DIRS) {
  const dir = path.join(BOSSES, d);
  for (const file of fs.readdirSync(dir)) {
    if (!isGrav(file)) continue;
    const abs = path.join(dir, file);
    if (fs.statSync(abs).isDirectory()) continue;
    const form = file.replace(/_\d+\.(webp|png)$/i, '').replace(/\.(webp|png)$/i, '');
    if (!forms.has(form)) forms.set(form, []);
    forms.get(form).push({ abs, rel: path.relative(ROOT, abs), dir: d, file });
  }
}

let totalBefore = 0, totalAfter = 0, wrote = 0, failed = 0;

for (const [form, files] of [...forms].sort()) {
  // 1. Every file of the form must share one canvas — verify before scaling.
  // Read to a Buffer and hand sharp the BYTES, never the path: on Windows a
  // path-backed sharp pipeline keeps a read handle open on the file, and the
  // atomic rename over it then fails EPERM.
  const metas = [];
  for (const f of files) {
    const buf = fs.readFileSync(f.abs);
    metas.push({ f, buf, m: await sharp(buf).metadata() });
  }
  const canvases = [...new Set(metas.map(({ m }) => `${m.width}x${m.height}`))];
  if (canvases.length !== 1) {
    console.error(`  !! ${form}: MIXED canvases ${canvases.join(', ')} — skipped (would drift)`);
    failed++;
    continue;
  }
  const { width: sw, height: sh } = metas[0].m;
  const scale = LONG_EDGE / Math.max(sw, sh);
  if (scale >= 1) { console.log(`  -- ${form}: ${sw}x${sh} already <= target, skipped`); continue; }
  const dw = Math.round(sw * scale), dh = Math.round(sh * scale);

  const beforeMP = (sw * sh) / 1e6, afterMP = (dw * dh) / 1e6;
  console.log(`${form}: ${sw}x${sh} -> ${dw}x${dh}  (${beforeMP.toFixed(2)} -> ${afterMP.toFixed(2)} MP, ${(beforeMP / afterMP).toFixed(2)}x fewer px, ${files.length} files)`);

  for (const { f, buf: srcBuf } of metas) {
    totalBefore += srcBuf.length;
    if (!APPLY) { totalAfter += 0; continue; }

    // Back up the original once, preserving the state subdir.
    const bdir = path.join(BACKUP, f.dir);
    fs.mkdirSync(bdir, { recursive: true });
    const bak = path.join(bdir, f.file);
    if (!fs.existsSync(bak)) fs.writeFileSync(bak, srcBuf);

    const isPng = /\.png$/i.test(f.file);
    // lanczos3 = highest-quality reduction sharp offers; it premultiplies alpha
    // internally so edge pixels do not pick up a halo. Re-encode ABOVE the
    // source's quality (webp q95 / alphaQuality 100) so a lossy source is not
    // compounded by a second lossy pass; PNG stays lossless.
    let pipe = sharp(srcBuf).resize(dw, dh, { kernel: 'lanczos3', fit: 'fill' });
    pipe = isPng ? pipe.png({ compressionLevel: 9 })
                 : pipe.webp({ quality: 95, alphaQuality: 100, effort: 6 });
    const buf = await pipe.toBuffer();

    // Atomic write (CLAUDE.md rule 1): verify the encode decodes back to the
    // exact target dims WITH alpha before it replaces the original.
    const check = await sharp(buf).metadata();
    if (check.width !== dw || check.height !== dh || !check.hasAlpha) {
      console.error(`  !! ${f.rel}: bad re-encode (${check.width}x${check.height} alpha=${check.hasAlpha}) — kept original`);
      failed++;
      continue;
    }
    const tmp = f.abs + '.tmp';
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, f.abs);
    totalAfter += buf.length;
    wrote++;
  }
}

const mb = (b) => (b / 1048576).toFixed(1) + ' MB';
console.log(`\n${APPLY ? 'WROTE' : 'DRY RUN'}: ${wrote} files, ${failed} failed`);
if (APPLY) console.log(`bytes on disk: ${mb(totalBefore)} -> ${mb(totalAfter)}`);
else console.log(`bytes on disk today: ${mb(totalBefore)}  (re-run with --apply to write)`);
if (APPLY && wrote) console.log('\nNEXT: node scripts/gen_anim_manifest.mjs   (manifest carries pixel dims)');
