#!/usr/bin/env node
// Apotheosis element projectiles — 9-frame loops built PROCEDURALLY from the
// authored base sprite.
// =============================================================================
//   node scripts/gen_apo_element_fx.mjs                    # dry run
//   node scripts/gen_apo_element_fx.mjs --write ice lightning
//
// Why procedural rather than the Ludo animate endpoint: the requirement here is
// "hold the silhouette exactly, make the ENERGY violent". A generative roll does
// the opposite by default — the ice roll measured 42% core-size drift and, once
// a size-hold pass corrected it, the mid frames visibly shrank and dissolved,
// because the model had drawn a genuinely larger comet there. Compositing over
// the artist's own sprite cannot drift: the silhouette IS the base, every frame,
// and only light and particles change. It is also free and deterministic, which
// matters with the animate credits exhausted.
//
// Per frame, four effects, all keyed off the base's own alpha:
//   PULSE    the bright interior strobes; the dim outer glow is left alone, so
//            the core flares instead of the whole sprite blinking.
//   SWEEP    a soft band races along the travel axis, adding white where the
//            sprite is solid — energy running through the shard.
//   SHIMMER  low-alpha aura pixels wobble in opacity so the trail crawls.
//   SPARKS   motes thrown off the trailing edge, seeded per frame, additive,
//            drawn only where they will not touch a border.
// A deterministic PRNG keys off (frame, index) so re-running is reproducible.
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROJ = join(ROOT, 'Sprites', 'projectiles');
const ANIM = join(PROJ, 'anim');
const FRAMES = 9, SIDE = 512;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const exists = (p) => access(p).then(() => true, () => false);

// tint = the colour sparks and the sweep take for this element
const SETS = {
  ice:       { key: 'p_apo_ice',       tint: [190, 240, 255], sparks: 18, pulse: 0.30, sweep: 0.58, fork: 0.20 },
  // a bolt should be the most violent of the four — hardest strobe, most motes,
  // and the strongest fork flicker so branches genuinely come and go
  // sweep 0.95 + fork 0.72 washed the gold out to grey - a near-white tint
  // added at that strength blows the hue off the bolt entirely. Saturated tint,
  // gentler sweep, and a fork gate that dims branches without erasing them.
  lightning: { key: 'p_apo_lightning', tint: [255, 188, 66], sparks: 34, pulse: 0.34, sweep: 0.00, fork: 0.26 },
  fire:      { key: 'p_apo_fire',      tint: [255, 210, 140], sparks: 20, pulse: 0.34, sweep: 0.62, fork: 0.30 },
  void:      { key: 'p_apo_void',      tint: [214, 160, 255], sparks: 14, pulse: 0.30, sweep: 0.50, fork: 0.15 },
};

// deterministic: same frame + index always gives the same mote
const rnd = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
const clamp255 = (v) => v < 0 ? 0 : v > 255 ? 255 : v | 0;

function buildFrame(base, W, H, f, cfg) {
  const out = Buffer.from(base);            // copy, never mutate the source
  const t = f / FRAMES;                     // 0..1 around the loop
  // a loop-safe strobe: two harmonics so consecutive frames differ sharply but
  // frame 8 still leads back into frame 0
  // ONE harmonic, two cycles over the nine frames. Two harmonics are periodic
  // but not evenly SAMPLED at 9 points: the 2x+3x sum put f8 at 0.20 brightness
  // and f0 at 1.29, so the loop seam measured 51% against a 16% per-frame mean.
  // A single sine steps a uniform 80 deg every frame, seam included.
  // A symmetric strobe, deliberately. Brighten-only was tried and is nearly a
  // no-op: the hue cap below refuses to clip, and saturated art is already at
  // the ceiling, so the up-beat has nowhere to go (measured 7.4% / 3.0% motion
  // against 10.6% / 7.6% here). The down-beat is what carries the pulse, so the
  // amplitudes are kept modest instead - deep dimming greys a warm colour.
  const pulse = 1 + cfg.pulse * Math.sin(t * Math.PI * 2 * 2);
  // sine, not a linear march: a linear sweep cannot return to its start, which
  // is what made the f8 -> f0 seam snap
  const band = W * 0.16;

  // find the sprite's horizontal extent once, so sparks can sit off its tail
  let minX = W, maxX = -1, minY = H, maxY = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (base[(y * W + x) * 4 + 3] > 16) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return out;

  // The sweep travels at CONSTANT speed from just left of the sprite to just
  // right of it, so at the wrap it is off the art entirely and the loop closes
  // invisibly. A sine looked periodic but moves fastest as it crosses zero -
  // which is exactly where the seam falls, and it dominated the f8 -> f0 jump.
  const sweepX = (minX - band) + t * ((maxX - minX) + 2 * band);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const a = base[i + 3];
      if (!a) continue;
      const lum = (base[i] * 0.299 + base[i + 1] * 0.587 + base[i + 2] * 0.114) / 255;
      if (a > 90) {
        // PULSE — weighted by how bright the pixel already is, so the core
        // flares and the dim edges stay put
        const w = Math.pow(lum, 1.5);
        let g = 1 + (pulse - 1) * w;
        // HUE-PRESERVING: multiplying an already-bright colour clips the high
        // channels first - gold (255,200,100) x1.4 becomes (255,255,140), a pale
        // wash. Cap the gain so no channel clips and the ratio between channels,
        // and therefore the hue, survives the strobe.
        if (g > 1) {
          const mx = Math.max(base[i], base[i + 1], base[i + 2]);
          if (mx > 0) g = Math.min(g, 255 / mx);
        }
        out[i] = clamp255(base[i] * g);
        out[i + 1] = clamp255(base[i + 1] * g);
        out[i + 2] = clamp255(base[i + 2] * g);
        // SWEEP — a soft band of the element's own colour running along x
        const d = Math.abs(x - sweepX);
        if (d < band) {
          const s = (1 - d / band) * cfg.sweep * (a / 255);
          out[i] = clamp255(out[i] + cfg.tint[0] * s);
          out[i + 1] = clamp255(out[i + 1] + cfg.tint[1] * s);
          out[i + 2] = clamp255(out[i + 2] + cfg.tint[2] * s);
        }
        // FORK FLICKER — branch pixels (bright but not the solid core) gate on
        // and off, so limbs of the arc appear and vanish between frames
        if (cfg.fork && a > 90 && a < 235) {
          const cell = Math.floor(x / 11) * 31 + Math.floor(y / 11) * 17;
          const gate = rnd(cell, f * 5.7);
          if (gate < cfg.fork * 0.5) out[i + 3] = clamp255(a * (0.15 + 0.5 * gate));
          else if (gate > 1 - cfg.fork * 0.3) {
            out[i] = clamp255(out[i] + cfg.tint[0] * 0.35);
            out[i + 1] = clamp255(out[i + 1] + cfg.tint[1] * 0.35);
            out[i + 2] = clamp255(out[i + 2] + cfg.tint[2] * 0.35);
          }
        }
      } else {
        // SHIMMER — the faint aura crawls rather than sitting still
        const n = rnd(x * 0.07 + f * 3.3, y * 0.07 - f * 2.1);
        out[i + 3] = clamp255(a * (0.55 + 0.75 * n));
      }
    }
  }

  // SPARKS — thrown off the trailing (left) edge, never near a border
  for (let s = 0; s < cfg.sparks; s++) {
    // exactly 2 cycles over the 9 frames: a non-integer rate cannot return to
    // its starting arrangement, which is half of why the seam snapped
    const age = ((s * 0.37 + t * 2) % 1);
    const sx = minX - 6 - age * (W * 0.16) + rnd(s, f) * 14;
    const sy = minY + rnd(s + 40, f) * (maxY - minY);
    const r = 1 + rnd(s + 90, f) * 2.2;
    const fade = (1 - age) * (1 - age);
    if (sx < 14 || sx > W - 14 || sy < 14 || sy > H - 14) continue;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const px = (sx + dx) | 0, py = (sy + dy) | 0;
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const dist = Math.hypot(dx, dy);
      if (dist > r) continue;
      const k = (1 - dist / r) * fade;
      const i = (py * W + px) * 4;
      out[i] = clamp255(out[i] + cfg.tint[0] * k);
      out[i + 1] = clamp255(out[i + 1] + cfg.tint[1] * k);
      out[i + 2] = clamp255(out[i + 2] + cfg.tint[2] * k);
      out[i + 3] = clamp255(out[i + 3] + 235 * k);
    }
  }
  return out;
}

const names = argv.filter((a) => !a.startsWith('--'));
const wanted = names.length ? names : Object.keys(SETS);

for (const n of wanted) {
  const cfg = SETS[n];
  if (!cfg) { console.log('unknown set: ' + n); continue; }
  const basePath = join(PROJ, cfg.key + '.webp');
  if (!(await exists(basePath))) { console.log('no base sprite for ' + n); continue; }
  const { data, info } = await sharp(await readFile(basePath))
    .ensureAlpha().resize(SIDE, SIDE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  if (!has('--write')) { console.log(`${n} (${cfg.key}) — would write ${FRAMES} frames at ${W}x${H}`); continue; }
  for (let f = 0; f < FRAMES; f++) {
    const px = buildFrame(data, W, H, f, cfg);
    await writeFile(join(ANIM, `${cfg.key}_${f}.webp`),
      await sharp(px, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 94 }).toBuffer());
  }
  console.log(`${n}: wrote ${FRAMES} frames from ${cfg.key}.webp`);
}
