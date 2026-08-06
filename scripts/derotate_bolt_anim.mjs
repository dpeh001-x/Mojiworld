#!/usr/bin/env node
// De-rotate the bolt animation frames.
//
// The generator baked a rigid spin into the frames despite the prompt saying
// not to (measured: rotating a frame back makes it 4.4x closer to frame 0 than
// its own neighbour is). Left alone that would (a) compound with the
// procedural 0.35 rad/frame spin in drawProjectiles and (b) swap a smooth
// 60 fps rotation for a stepped 20.8 fps one.
//
// Fix: find each frame's best-fit rotation against frame 0 and rotate it back,
// leaving ONLY the internal energy churn. The code spin then supplies the
// rotation, continuously and smoothly, and the frames supply the churn.
//
// The swirl's ~6-fold symmetry does not matter here: rotating by any multiple
// of the symmetry angle maps the shape onto itself, so whichever symmetric
// branch the search locks onto still aligns the frames correctly.
//
//   node scripts/derotate_bolt_anim.mjs            # measure + report only
//   node scripts/derotate_bolt_anim.mjs --write    # rewrite Sprites/anim/bolt_*.webp
import sharp from 'sharp';
import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ANIM = join(root, 'Sprites', 'anim');
const BACKUP = join(root, 'scripts', '_mage_orb_review', '_anim_prerot');
const N = 9, S = 128, SIZE = 768;
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

const lumOf = async (buf) => {
  const { data } = await sharp(buf).resize(S, S, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const o = new Float32Array(S * S);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) o[j] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) * (data[i + 3] / 255);
  return o;
};

const raws = [], lums = [];
for (let i = 0; i < N; i++) { const b = await readFile(join(ANIM, `bolt_${i}.webp`)); raws.push(b); lums.push(await lumOf(b)); }

const diffAt = (src, ref, ang) => {
  const c = (S - 1) / 2, cos = Math.cos(ang), sin = Math.sin(ang);
  let acc = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x - c, dy = y - c;
    const sx = Math.round(c + dx * cos - dy * sin), sy = Math.round(c + dx * sin + dy * cos);
    acc += Math.abs(((sx < 0 || sy < 0 || sx >= S || sy >= S) ? 0 : src[sy * S + sx]) - ref[y * S + x]);
  }
  return acc / (S * S);
};
// coarse 5° sweep, then 1° refine
const bestAngle = (k) => {
  let best = 0, bd = Infinity;
  for (let a = 0; a < 360; a += 5) { const d = diffAt(lums[k], lums[0], a * Math.PI / 180); if (d < bd) { bd = d; best = a; } }
  for (let a = best - 5; a <= best + 5; a++) { const d = diffAt(lums[k], lums[0], ((a + 360) % 360) * Math.PI / 180); if (d < bd) { bd = d; best = (a + 360) % 360; } }
  return { ang: best, resid: bd };
};

const fits = [{ ang: 0, resid: 0 }];
for (let k = 1; k < N; k++) fits.push(bestAngle(k));
console.log('frame  best-fit rotation   residual after de-rotation');
fits.forEach((f, i) => console.log(`  ${i}    ${String(f.ang).padStart(4)}°              ${f.resid.toFixed(2)}`));

if (!process.argv.includes('--write')) {
  console.log('\n(dry run — pass --write to rewrite the frames de-rotated)');
  process.exit(0);
}

await mkdir(BACKUP, { recursive: true });
for (let i = 0; i < N; i++) {
  const f = `bolt_${i}.webp`;
  if (!await exists(join(BACKUP, f))) await copyFile(join(ANIM, f), join(BACKUP, f));
}
for (let i = 0; i < N; i++) {
  const ang = fits[i].ang;
  // rotate BACK by the measured angle, on a transparent bed, then re-fit the
  // shared canvas so every frame keeps an identical box (no per-frame trim,
  // which would re-centre them and reintroduce jitter)
  // sharp.rotate() at a non-90° angle EXPANDS the canvas to fit the rotated
  // bounding box (up to 768*sqrt2 ~= 1086). Resizing that back down would
  // shrink each frame by a different amount depending on its angle — the orb
  // would visibly breathe once per loop. Centre-EXTRACT instead: same scale,
  // same box, every frame.
  let out;
  if (ang === 0) out = raws[i];
  else {
    const rotated = await sharp(raws[i]).rotate(-ang, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const m = await sharp(rotated).metadata();
    out = await sharp(rotated)
      .extract({ left: Math.round((m.width - SIZE) / 2), top: Math.round((m.height - SIZE) / 2), width: SIZE, height: SIZE })
      .webp({ quality: 92 }).toBuffer();
  }
  await writeFile(join(ANIM, `bolt_${i}.webp`), out);
}
console.log(`\nde-rotated ${N} frames (originals in ${BACKUP.replace(root, '.')})`);
