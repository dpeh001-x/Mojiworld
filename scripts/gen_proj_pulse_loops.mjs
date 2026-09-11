#!/usr/bin/env node
// Four projectile "animations" whose nine frames are byte-identical get a real loop, derived.
// ============================================================================
// Found by scripts/art_polish_audit.mjs: bubble, taurus_boulder, voidring and whirl each ship nine
// frames in Sprites/projectiles/anim/ that are the same image nine times. The loader fetches and
// decodes all nine, _bossLoopFrame cycles them, and nothing on screen changes - the only motion is
// the renderer's own spin (they are all mode:'spin' in _PROJ_SPRITE_BLIT).
//
// DERIVED, NOT REDRAWN, for the same reason the mspore squish and the mage ward's turn were: a
// transform of the shipped art cannot drift, closes exactly, and cannot clip once the headroom is
// checked. The motion is chosen to COMPLEMENT the spin the renderer already applies, never to
// duplicate it - a baked rotation on a spinning sprite would double up:
//   bubble          a slow breathing scale pulse, the way a soap bubble wobbles
//   whirl           a scale pulse plus a brightness shimmer, water catching light as it spins
//   voidring        a brightness pulse on the ring plus a faint breath of scale, the void breathing
//   taurus_boulder  a glow pulse (brightness) - a molten rock whose heat breathes as it tumbles
// A second harmonic keeps any two frames from coinciding (see gen_mspore_squish.mjs for why a
// plain cosine over nine frames pairs frame i with 9-i).
//
//   node scripts/gen_proj_pulse_loops.mjs            # measure headroom, report, write nothing
//   node scripts/gen_proj_pulse_loops.mjs --write    # write the frames atomically
//   flags: --only <key>
import sharp from 'sharp';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
sharp.cache(false);
const has = (f) => process.argv.includes(f);
const argOf = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const ONLY = argOf('--only', null);
const DIR = 'Sprites/projectiles/anim', FRAMES = 9, ALPHA_ON = 16;
const SETS = {
  bubble:         { scale: 0.06, bright: 0.00 },
  whirl:          { scale: 0.05, bright: 0.10 },
  voidring:       { scale: 0.04, bright: 0.16 },   // brightness alone moved 0.03%/step on a thin ring - a breath of scale is needed to read
  taurus_boulder: { scale: 0.00, bright: 0.14 },
};
const phase = (i) => (2 * Math.PI * i) / FRAMES;
// -1..1, no two frames equal. The harmonic's weight and phase were searched (a in 0.1..0.6, phase in
// 0..2pi) for the LARGEST smallest step between neighbours: 0.42/1.05 left the 8->0 wrap moving only
// 0.03 of the range - a near-repeat at the loop seam - where 0.22/0.80 moves 0.17 at its quietest.
const wave = (i) => (Math.cos(phase(i)) + 0.22 * Math.cos(2 * phase(i) + 0.80)) / 1.22;

async function px(buf) { const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, w: info.width, h: info.height }; }
function inkBox(p) { let x0 = p.w, y0 = p.h, x1 = -1, y1 = -1; for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.d[(y * p.w + x) * 4 + 3] > ALPHA_ON) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 }; }

async function frame(src, W, H, cfg, i) {
  const s = 1 + cfg.scale * wave(i), b = 1 + cfg.bright * wave(i);
  let img = src;
  if (cfg.scale) {
    const nw = Math.round(W * s), nh = Math.round(H * s);
    const scaled = await sharp(src).resize(nw, nh, { fit: 'fill' }).png().toBuffer();
    const PW = Math.max(W, nw), PH = Math.max(H, nh);
    const padded = await sharp({ create: { width: PW, height: PH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: scaled, gravity: 'centre' }]).png().toBuffer();
    img = await sharp(padded).extract({ left: Math.round((PW - W) / 2), top: Math.round((PH - H) / 2), width: W, height: H }).png().toBuffer();
  }
  if (cfg.bright) {
    // brightness on RGB only, alpha untouched, so the silhouette never breathes when only the light should
    const alpha = await sharp(img).ensureAlpha().extractChannel(3).png().toBuffer();
    const rgb = await sharp(img).removeAlpha().modulate({ brightness: b }).png().toBuffer();
    img = await sharp(rgb).joinChannel(alpha).png().toBuffer();
  }
  return img;
}

let total = 0, written = 0;
for (const [key, cfg] of Object.entries(SETS)) {
  if (ONLY && key !== ONLY) continue;
  const f0 = join(DIR, `${key}_0.webp`);
  let src; try { src = await readFile(f0); } catch { console.log(`  ${key}: no frame 0 at ${f0}`); continue; }
  const p0 = await px(src), b0 = inkBox(p0);
  const margin = Math.min(b0.x0, b0.y0, p0.w - 1 - b0.x1, p0.h - 1 - b0.y1);
  const need = Math.ceil(Math.max(b0.w, b0.h) * cfg.scale / 2);
  const line = `${key.padEnd(15)} ${p0.w}x${p0.h} ink ${b0.w}x${b0.h} margin ${margin}px, pulse needs ${need}px`;
  if (need > margin) { console.log(`  ${line} - REFUSING, it would clip`); continue; }
  const out = [];
  for (let i = 0; i < FRAMES; i++) out.push(await frame(src, p0.w, p0.h, cfg, i));
  // gates: same canvas, no border ink, and every step moves (the point of the exercise)
  const raws = []; for (const b of out) raws.push(await px(b));
  let bad = [], minStep = 1e9;
  for (let i = 0; i < FRAMES; i++) {
    const bb = inkBox(raws[i]);
    if (bb.x0 === 0 || bb.y0 === 0 || bb.x1 >= p0.w - 1 || bb.y1 >= p0.h - 1) bad.push(`frame ${i} touches the border`);
    const a = raws[i], c = raws[(i + 1) % FRAMES]; let diff = 0;
    for (let k = 0; k < a.d.length; k += 4) diff += Math.abs(a.d[k] - c.d[k]) + Math.abs(a.d[k + 1] - c.d[k + 1]) + Math.abs(a.d[k + 2] - c.d[k + 2]) + Math.abs(a.d[k + 3] - c.d[k + 3]);
    minStep = Math.min(minStep, 100 * diff / (255 * 4 * a.w * a.h));
  }
  if (minStep < 0.05) bad.push(`smallest per-step change ${minStep.toFixed(3)}% - a frame repeats`);
  console.log(`  ${line}, smallest step ${minStep.toFixed(2)}%${bad.length ? ' - REJECT: ' + bad.join('; ') : ''}`);
  if (bad.length) continue;
  total++;
  if (!has('--write')) continue;
  for (let i = 0; i < FRAMES; i++) { const f = join(DIR, `${key}_${i}.webp`); await writeFile(f + '.tmp', await sharp(out[i]).webp({ quality: 96, alphaQuality: 100, effort: 6 }).toBuffer()); await rename(f + '.tmp', f); }
  written++;
}
console.log(`\n${total} set(s) pass${has('--write') ? `, ${written} written` : ' - dry run, nothing written (add --write)'}`);
