#!/usr/bin/env node
// pincer: build the 9-frame snap DETERMINISTICALLY from the restyled base.
//
// Two ludo /assets/sprite/animate rolls were tried first and both drifted at
// the tail: roll 1 was coherent for frames 0-6 then zoomed in and cropped the
// claw on 7-8; roll 2 additionally collapsed frame 2 into a vertical blob that
// lost the C silhouette. A projectile that changes shape mid-flight is worse
// than one that simply pulses, and every extra roll is another spend on the
// same failure mode — so the snap is derived from the authored base instead.
//
// It is a squash-and-stretch chomp: the claw narrows as it clamps (scaleX
// down, scaleY up to conserve mass) and springs back with a small overshoot.
// Guaranteed on-model, because every frame IS the base art, and guaranteed
// stable — no frame can ever break the silhouette.
//   node scripts/gen_pincer_snap_anim.mjs            # candidates
//   node scripts/gen_pincer_snap_anim.mjs --install  # write shipped frames
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = join(repoRoot, 'Sprites/projectiles/p_pincer.webp');
const install = process.argv.includes('--install');
const OUT = install ? join(repoRoot, 'Sprites/projectiles/anim')
                    : join(repoRoot, 'scripts/_style_pack/anim_regen/pincer');
const N = 9;
const meta = await sharp(BASE).metadata();
const W = meta.width, H = meta.height;

// One clamp cycle over the 9 frames: wide open -> shut -> spring back open.
// A plain raised cosine: 0 at the loop seam, 1 fully shut at the midpoint.
// The first draft added a sin(4pi t) "recoil" on top, which at i=1 cancelled the
// clamp almost exactly (0.117 - 0.118 = 0) and produced two identical opening
// frames. Not worth the cleverness — the cosine alone reads as a snap.
const curve = (i) => (1 - Math.cos(2 * Math.PI * (i / N))) / 2;
// The art is laid out at 95% of the box so the vertical bulge below has
// headroom: at peak clamp 0.95 * 1.05 = 0.9975, so no frame can ever exceed
// the canvas. The first draft let sy push past H, and the re-centre crop then
// threw "bad extract area".
const FIT = 0.95;
await mkdir(OUT, { recursive: true });
for (let i = 0; i < N; i++) {
  const k = curve(i);
  const sx = FIT * (1 - 0.16 * k);  // clamp shut horizontally
  const sy = FIT * (1 + 0.05 * k);  // bulge vertically: mass is conserved
  const w = Math.max(1, Math.round(W * sx)), h = Math.max(1, Math.round(H * sy));
  const scaled = await sharp(BASE).resize(w, h, { fit: 'fill' }).png().toBuffer();
  // Re-centre in the shipped 768x768 box. One shared box, no per-frame trim —
  // trimming each frame independently re-centres them and makes the loop jitter.
  const left = Math.round((W - w) / 2), top = Math.round((H - h) / 2);
  const buf = await sharp({ create: { width: W, height: H, channels: 4,
                                      background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: scaled, left, top }])
    .webp({ quality: 92 }).toBuffer();
  await writeFile(join(OUT, `pincer_${i}.webp`), buf);
  console.log(`  pincer_${i}: scaleX ${sx.toFixed(3)} scaleY ${sy.toFixed(3)}  ${(buf.length / 1024).toFixed(1)}KB`);
}
console.log(install ? `\ninstalled -> ${OUT}` : `\ncandidates -> ${OUT} (re-run with --install)`);
