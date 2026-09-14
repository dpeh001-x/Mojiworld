#!/usr/bin/env node
// The Bloodlust crescent as a SONIC BOOM - composited, not generated.
//
// Per user, after v0.30.687: "honestly the animation sprites look rather weird, could you redo it,
// like make it look more shockwave like sonic boom".
//
// Why this is not another ludo roll: ludo's animate route is refused (402, "wait until your
// credits renew"), and more importantly the v1 roll failed in a way a re-roll does not reliably
// fix. Measured with scripts/_tmp_blmetric.mjs, v1 shattered into a mean of 30 disconnected blobs
// per frame, peaking at 82 - the "embers" in its brief. A generative pass cannot promise the
// silhouette survives; this can, because the crescent is never redrawn.
//
// Every frame is the SHIPPED sprite, pixel for pixel, with air drawn around it:
//   - PRESSURE FRONTS. The crescent's own alpha mask, scaled up about its centroid, minus a
//     slightly smaller copy of itself, gives a thin band that hugs the blade's shape. Two of them,
//     half a loop apart, expanding and fading - a wave front, not a circle pasted on top.
//   - RIM FLASH. Pixels whose right-hand neighbour is empty are the leading edge. Lit white-hot
//     once per loop, because that is the face doing the work.
//   - SPEED LINES. Straight horizontal streaks trailing back off the tips, cycling so the eye
//     reads travel rather than twitch.
// Nothing moves the arc: zero drift and exactly one blob per frame are properties of the method,
// not something to hope for in a roll.
//
//   node scripts/gen_bloodlust_wave_boom.mjs            # write frames + a contact sheet to scratch
//   node scripts/gen_bloodlust_wave_boom.mjs --install  # write them into Sprites/projectiles/anim/
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.BLOODLUST_OUT || ROOT;
const KEEP = join(ROOT, 'scripts', '_tmp_bloodlust_boom');
const SRC = join(ROOT, 'Sprites', 'projectiles', 'p_bloodlust_shockwave.webp');
const N = 9, S = 768;
const has = (f) => process.argv.slice(2).includes(f);

const { data: src } = await sharp(SRC).ensureAlpha()
  .resize(S, S, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .raw().toBuffer({ resolveWithObject: true });

// the blade's own alpha, and the centroid the fronts expand about
const A = new Uint8Array(S * S);
let cx = 0, cy = 0, n = 0, minx = S, maxx = -1, miny = S, maxy = -1;
for (let p = 0; p < S * S; p++) {
  const a = src[p * 4 + 3]; A[p] = a;
  if (a > 10) { const x = p % S, y = (p / S) | 0; cx += x; cy += y; n++;
    if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
}
cx /= n; cy /= n;

// A[] sampled as if the blade were scaled by k about the centroid. Nearest-neighbour is enough:
// the result is a band a few pixels wide that then gets feathered by the band subtraction itself.
const maskAt = (k) => {
  const m = new Uint8Array(S * S), inv = 1 / k;
  for (let y = 0; y < S; y++) {
    const sy = ((y - cy) * inv + cy) | 0;
    if (sy < 0 || sy >= S) continue;
    for (let x = 0; x < S; x++) {
      const sx = ((x - cx) * inv + cx) | 0;
      if (sx < 0 || sx >= S) continue;
      m[y * S + x] = A[sy * S + sx];
    }
  }
  return m;
};

// leading edge = opaque pixel whose right-hand neighbour is not. The blade is authored facing
// right, so this is the face meeting the air.
// A naive "opaque pixel whose right neighbour is empty" also lights the INNER face of the C,
// because the crescent opens to the left and its inner wall has empty space beside it too - the
// first render washed the whole blade pale pink. The outer edge is the one with OPEN AIR beyond
// it, so the test is the length of the empty run to the right, not the single next pixel.
const RIM_D = 14, RIM_OPEN = 110;
const rim = new Uint8Array(S * S);
for (let y = 0; y < S; y++) {
  const run = new Int32Array(S + 1);
  for (let x = S - 1; x >= 0; x--) run[x] = (A[y * S + x] < 40) ? run[x + 1] + 1 : 0;
  for (let x = 0; x < S - RIM_D; x++) {
    const p = y * S + x;
    if (A[p] > 120 && A[p + RIM_D] < 40 && run[x + RIM_D] >= RIM_OPEN) rim[p] = 255;
  }
}

const rimThin = new Uint8Array(S * S);
for (let y = 0; y < S; y++) {
  const run = new Int32Array(S + 1);
  for (let x = S - 1; x >= 0; x--) run[x] = (A[y * S + x] < 40) ? run[x + 1] + 1 : 0;
  for (let x = 0; x < S - 6; x++) {
    const p = y * S + x;
    if (A[p] > 120 && A[p + 6] < 40 && run[x + 6] >= RIM_OPEN) rimThin[p] = 255;
  }
}
const smooth = (t) => 0.5 - 0.5 * Math.cos(t * Math.PI * 2);   // 0..1..0 across the loop
const frames = [];
for (let i = 0; i < N; i++) {
  const out = Buffer.alloc(S * S * 4);
  // --- motion ghosts first, so the crisp blade lands on top of them ---
  {
    const GH = [[30, 0.42], [62, 0.26], [96, 0.14]];
    const wob = smooth(((i / N) + 0.3) % 1);
    for (const [dxBase, aBase] of GH) {
      const dx = Math.round(dxBase * (0.82 + 0.36 * wob));
      const al = aBase * (0.75 + 0.5 * wob);
      for (let y = 0; y < S; y++) for (let x = 0; x < S - dx; x++) {
        const sp = y * S + (x + dx);
        if (A[sp] < 20) continue;
        const o = (y * S + x) * 4, so = sp * 4;
        const ia = al * (A[sp] / 255);
        const prev = out[o + 3] / 255;
        const na = Math.max(prev, ia);
        if (na > prev) { out[o] = src[so]; out[o + 1] = src[so + 1]; out[o + 2] = src[so + 2]; }
        out[o + 3] = Math.round(255 * na);
      }
    }
    // then the blade itself, opaque, unchanged
    for (let q = 0; q < S * S; q++) {
      if (A[q] < 1) continue;
      const o = q * 4;
      out[o] = src[o]; out[o + 1] = src[o + 1]; out[o + 2] = src[o + 2];
      out[o + 3] = Math.max(out[o + 3], A[q]);
    }
  }
  // --- the blade itself pulses: hot at the strike, deep crimson as the wave passes ---
  // Gamma on the existing pixels rather than a white overlay, so the art keeps its own shading
  // and never goes pink. This is the part that survives the 7x downscale.
  {
    const heat = smooth(((i / N) + 0.12) % 1);        // 0 deep .. 1 hot
    const gain = 1 + 0.30 * heat, lift = 26 * heat;
    for (let q = 0; q < S * S; q++) {
      if (A[q] < 10) continue;
      const o = q * 4;
      out[o]     = Math.min(255, out[o] * gain + lift);
      out[o + 1] = Math.min(255, out[o + 1] * (1 + 0.16 * heat) + lift * 0.45);
      out[o + 2] = Math.min(255, out[o + 2] * (1 + 0.16 * heat) + lift * 0.45);
    }
  }
  const add = (p, r, g, b, a) => {
    if (a <= 0) return;
    const o = p * 4, ia = Math.min(1, a);
    const dst = out[o + 3] / 255;
    // premultiplied-ish over: light lies on top of the blade and on empty canvas alike
    out[o]     = Math.min(255, out[o]     * (1 - ia) + r * ia);
    out[o + 1] = Math.min(255, out[o + 1] * (1 - ia) + g * ia);
    out[o + 2] = Math.min(255, out[o + 2] * (1 - ia) + b * ia);
    out[o + 3] = Math.max(out[o + 3], Math.round(255 * Math.max(dst, ia)));
  };
  // --- ONE pressure front, traced from the LEADING edge only ---
  // Scaling the whole silhouette (passes 1-3) drew a band around the inner face too, which at the
  // 104px blit read as grey haze rather than as a wave. The rim set is the outer curve alone, so
  // pushing THAT outward gives a front with the blade shape and nothing behind it.
  for (const phase of [0, 0.5]) {
    const t = ((i / N) + phase) % 1;
    const k = 1.04 + t * 0.30;
    const fade = Math.pow(1 - t, 0.85) * (phase ? 0.55 : 1.0);
    if (fade < 0.03) continue;
    const inv = 1 / k;
    for (let y = 0; y < S; y++) {
      const sy = ((y - cy) * inv + cy) | 0;
      if (sy < 0 || sy >= S) continue;
      for (let x = 0; x < S; x++) {
        const p2 = y * S + x;
        if (A[p2] > 60) continue;
        const sx = ((x - cx) * inv + cx) | 0;
        if (sx < 0 || sx >= S) continue;
        if (rim[sy * S + sx]) add(p2, 255, 236, 240, fade);
      }
    }
  }
  // --- rim flash: thin and bright, so the edge glints instead of the blade going pink ---
  const rf = 0.3 + 0.7 * smooth(i / N);
  for (let p2 = 0; p2 < S * S; p2++) if (rimThin[p2]) add(p2, 255, 250, 244, 0.5 * rf);
  // --- three speed lines, short and high-contrast ---
  const LINES = [0.28, 0.5, 0.72];
  for (let li = 0; li < LINES.length; li++) {
    const y = Math.round(miny + (maxy - miny) * LINES[li]);
    const ph = ((i / N) + li * 0.33) % 1;
    const len = 150 + 70 * (li % 2);
    const x1 = Math.max(0, minx - Math.round(10 + ph * 70));
    const x0 = Math.max(0, x1 - len);
    for (let x = x0; x < x1; x++) {
      const u = (x - x0) / Math.max(1, x1 - x0);
      const a2 = Math.pow(u, 1.6) * 0.85 * (1 - ph * 0.6);
      for (let dy = -3; dy <= 3; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= S) continue;
        add(yy * S + x, 255, 190, 202, a2 * (1 - Math.abs(dy) / 4));
      }
    }
  }
  frames.push(await sharp(out, { raw: { width: S, height: S, channels: 4 } })
    .webp({ quality: 92, alphaQuality: 100 }).toBuffer());
}

await mkdir(KEEP, { recursive: true });
if (has('--install')) await mkdir(join(OUT, 'Sprites', 'projectiles', 'anim'), { recursive: true });
for (let i = 0; i < N; i++) {
  await writeFile(has('--install')
    ? join(OUT, 'Sprites', 'projectiles', 'anim', `bloodlust_wave_${i}.webp`)
    : join(KEEP, `boom_${i}.webp`), frames[i]);
  await writeFile(join(KEEP, `boom_${i}.png`), await sharp(frames[i]).png().toBuffer());
}
console.log((has('--install') ? 'installed ' : 'wrote ') + N + ` frames (blade centroid ${cx.toFixed(0)},${cy.toFixed(0)}; rim ${rim.reduce((s, v) => s + (v ? 1 : 0), 0)} px)`);
