#!/usr/bin/env node
// Build Aetherion's ASTRAL JUDGEMENT set by COMPOSITING, not by animating him.
//
// Per user, twice: "keep the subject unzoomed with minimal changes". Three
// ludo.ai rolls could not do that. Told to trace the same drawing every frame it
// still re-posed and re-framed him - measured on the last roll, frame 0 is a
// side-on rear-up and frame 8 has turned front-on and grown, and the two before
// that had his legs sliced off by the crop. Animating a character is the wrong
// instrument for "hold absolutely still".
//
// So the dragon is a FIXED LAYER - one image, blitted identically into all nine
// frames - and only the magic is generated. That makes "unzoomed with minimal
// changes" true by construction rather than by request: the subject is
// pixel-identical across the set, and the only thing that can differ is the
// spiral drawn around it.
//
// The spiral is drawn here rather than generated so its colours are the SAME
// ones the engine throws during the telegraph (#c8a8ff violet / #ffe899 gold,
// seeded at radius 520 and pulled inward), and so the inward collapse is an
// exact function of the frame index instead of a hope.
//
//   node scripts/gen_aetherion_astral.mjs           # writes candidates
//   node scripts/gen_aetherion_astral.mjs --install  # ...and installs them
import sharp from 'sharp';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'scripts', '_style_pack', 'anim_regen', 'aetherion_astral_composite');
const DRAGON = join(root, 'Sprites/bosses/attack/aetherion_7.webp');
const FRAMES = 9;

// Measured off the dragon layer: content 892x758 at 417,567 on a 1656x1325
// canvas. The spiral centres on his chest, not on the canvas.
const CX = 917, CY = 961;
const VIOLET = '#c8a8ff', GOLD = '#ffe899';

// One ribbon = a spiral arc sampled into a polyline. `turns` how far it wraps,
// `r0/r1` where it starts and ends. Inward collapse is r0 shrinking with t.
const ribbon = (a0, r0, r1, turns, w, col, op) => {
  const pts = [];
  const N = 64;
  for (let i = 0; i <= N; i++) {
    const f = i / N;
    const a = a0 + f * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * f;
    pts.push((CX + Math.cos(a) * r).toFixed(1) + ',' + (CY + Math.sin(a) * r * 0.62).toFixed(1));
  }
  return `<polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="${w}" `
    + `stroke-linecap="round" opacity="${op.toFixed(3)}"/>`;
};

// The set PEAKS AT FRAME 6, not at frame 8, because that is where the damage
// lands: _aetherionAstralFrame spreads frames 0-6 across the 1500 ms telegraph
// and plays 7-8 afterwards as the aftermath. A curve that simply brightened to
// the last frame would put the climax a fifth of a second after the hit.
const BURST = 6;
const frameSvg = (i) => {
  const t = Math.min(1, i / BURST);           // 0 -> 1 by the moment of the hit
  const after = Math.max(0, (i - BURST) / (FRAMES - 1 - BURST));   // 0 -> 1 over the tail
  const R0 = 520 - 300 * t + 90 * after;      // seeds at 520, pulls in, then blows outward
  const R1 = 150 - 110 * t;                   // inner end closes onto the chest
  const spin = t * 1.9 + after * 0.25;        // the whole spiral winds as it collapses
  const bright = (0.10 + 0.80 * t) * (1 - 0.88 * after);           // brightest ON the hit, then gone fast
  const parts = [];
  for (let k = 0; k < 6; k++) {
    const a0 = spin * Math.PI * 2 + (k / 6) * Math.PI * 2;
    const col = k % 2 ? VIOLET : GOLD;
    parts.push(ribbon(a0, R0 * (0.78 + 0.22 * ((k % 3) / 2)), R1, 0.55 + 0.18 * (k % 2),
      18 + 30 * t, col, bright * (k % 2 ? 0.95 : 0.7)));
  }
  // motes riding the ribbons inward
  for (let k = 0; k < 22; k++) {
    const a = spin * Math.PI * 2 + (k / 22) * Math.PI * 2 * 3;
    const r = R1 + (R0 - R1) * ((k * 7 % 22) / 22);
    const rr = 4 + (k % 3) * 3;
    parts.push(`<circle cx="${(CX + Math.cos(a) * r).toFixed(1)}" cy="${(CY + Math.sin(a) * r * 0.62).toFixed(1)}" `
      + `r="${rr}" fill="${k % 2 ? VIOLET : GOLD}" opacity="${(bright * 0.9).toFixed(3)}"/>`);
  }
  // the gathering core at the chest
  const cr = 40 + 260 * t;
  parts.push(`<circle cx="${CX}" cy="${CY}" r="${cr.toFixed(1)}" fill="url(#core)" opacity="${(Math.min(1, 0.15 + 0.95 * t) * (1 - 0.9 * after)).toFixed(3)}"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1656" height="1325">
    <defs>
      <radialGradient id="core">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
        <stop offset="45%" stop-color="${GOLD}" stop-opacity="0.75"/>
        <stop offset="100%" stop-color="${VIOLET}" stop-opacity="0"/>
      </radialGradient>
      <filter id="glow" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="${(4 + 1.5 * t).toFixed(1)}"/>
      </filter>
    </defs>
    <g filter="url(#glow)">${parts.join('')}</g>
  </svg>`;
};

const dragon = await readFile(DRAGON);
await mkdir(OUT, { recursive: true });
const written = [];
for (let i = 0; i < FRAMES; i++) {
  const fx = await sharp(Buffer.from(frameSvg(i))).png().toBuffer();
  // Behind at full strength, in front at a third: the ribbons read as wrapping
  // around him rather than as a decal stuck on his chest.
  const front = await sharp(fx).ensureAlpha()
    .composite([{ input: Buffer.from([255, 255, 255, 90]), raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: 'dest-in' }])
    .png().toBuffer();
  const out = await sharp({ create: { width: 1656, height: 1325, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fx }, { input: dragon }, { input: front }])
    .webp({ quality: 92 }).toBuffer();
  const f = join(OUT, `aetherionastral_${i}.webp`);
  await writeFile(f, out);
  written.push(f);
}
console.log(`wrote ${FRAMES} composite frames -> ${OUT}`);

if (process.argv.includes('--install')) {
  for (let i = 0; i < FRAMES; i++) {
    await writeFile(join(root, `Sprites/bosses/attack/aetherionastral_${i}.webp`), await readFile(written[i]));
  }
  console.log('installed into Sprites/bosses/attack/');
}
