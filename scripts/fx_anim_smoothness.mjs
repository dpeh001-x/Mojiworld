#!/usr/bin/env node
// Objective smoothness check for any Sprites/fx/anim/<key>_0..8.webp loop.
// =============================================================================
// Generalised from scripts/bolt_anim_smoothness.mjs, which measures the same
// things but is hardcoded to Sprites/anim/bolt_*. The eye is bad at judging
// all of these, and "choppy" is usually one of them:
//   1. PACING    uneven change between consecutive frames = a visible stutter.
//                Reported as max/min spread of the per-frame delta.
//   2. LOOP SEAM frame 8 -> frame 0 must be no bigger a step than any other,
//                or the loop pops once per cycle.
//   3. STABILITY the effect must not drift or breathe — alpha centroid and
//                area should hold across all 9 frames.
//   4. DEAD      frames that barely differ read as a frozen sprite; frames
//                that differ hugely read as a slideshow. Both are reported.
//
//   node scripts/fx_anim_smoothness.mjs archbishop_ult [more keys...]
//   node scripts/fx_anim_smoothness.mjs --all          (every key in fx/anim)
// Exit code is the number of keys with at least one failing check.
import sharp from 'sharp';
import { readFile, readdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(root, 'Sprites', 'fx', 'anim');
const N = 9, S = 128;

let keys = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (process.argv.includes('--all')) {
  const seen = new Set();
  for (const f of await readdir(DIR)) {
    const m = f.match(/^(.+)_0\.webp$/);
    if (m) seen.add(m[1]);
  }
  keys = [...seen].sort();
}
if (!keys.length) { console.error('usage: fx_anim_smoothness.mjs <key> [key...] | --all'); process.exit(2); }

const lum = (d, i) => (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) * (d[i + 3] / 255);
const fmt = (x, n = 2) => x.toFixed(n);
let bad = 0;

for (const key of keys) {
  // Missing frames are themselves a defect — a loop that is not 9 frames long
  // either freezes on one image or falls back to the static base.
  const paths = [];
  for (let i = 0; i < N; i++) paths.push(join(DIR, `${key}_${i}.webp`));
  const present = [];
  for (const p of paths) { try { await access(p); present.push(true); } catch { present.push(false); } }
  const missing = present.filter((x) => !x).length;
  console.log(`\n=== ${key} ===`);
  if (missing) {
    console.log(`  FRAMES  ${N - missing}/${N} present — MISSING ${missing}` +
      ` (${present.map((v, i) => v ? null : i).filter((v) => v !== null).join(', ')})`);
    console.log('  FAIL incomplete loop — regenerate the animation');
    bad++;
    if (N - missing < 2) continue;                 // nothing to compare
  }

  const frames = [];
  for (let i = 0; i < N; i++) {
    if (!present[i]) continue;
    const { data } = await sharp(await readFile(paths[i]))
      .resize(S, S, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    frames.push(data);
  }
  const M = frames.length;

  const deltas = [];
  for (let k = 0; k < M; k++) {
    const a = frames[k], b = frames[(k + 1) % M];
    let s = 0;
    for (let i = 0; i < a.length; i += 4) s += Math.abs(lum(a, i) - lum(b, i));
    deltas.push(s / (S * S));
  }
  const mean = deltas.reduce((x, y) => x + y, 0) / M;
  const spread = Math.max(...deltas) / Math.max(1e-6, Math.min(...deltas));
  const wrap = deltas[M - 1];

  const stats = frames.map((d) => {
    let cx = 0, cy = 0, m = 0;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const a = d[(y * S + x) * 4 + 3] / 255; cx += x * a; cy += y * a; m += a;
    }
    return { cx: cx / m, cy: cy / m, area: m };
  });
  const drift = Math.max(...stats.map((s, _, A) => Math.hypot(s.cx - A[0].cx, s.cy - A[0].cy)));
  const areaVar = (Math.max(...stats.map((s) => s.area)) / Math.min(...stats.map((s) => s.area)) - 1) * 100;

  const fPace = spread > 2.5, fSeam = wrap / mean > 2.0, fDrift = drift > 2.0, fArea = Math.abs(areaVar) > 12;
  const fDead = mean < 0.6;
  console.log(`  per-frame delta  ${deltas.map((d) => fmt(d, 1)).join(', ')}`);
  console.log(`  pacing           mean ${fmt(mean, 1)}  spread ${fmt(spread)}x  ${fPace ? 'FAIL uneven — visible stutter' : 'PASS even'}`);
  console.log(`  loop seam        ${fmt(wrap, 1)} vs mean ${fmt(mean, 1)} = ${fmt(wrap / mean)}x  ${fSeam ? 'FAIL pops on wrap' : 'PASS seamless'}`);
  console.log(`  centroid drift   ${fmt(drift)} px of ${S}  ${fDrift ? 'FAIL jitters' : 'PASS stable'}`);
  console.log(`  area variation   ${fmt(areaVar, 1)}%  ${fArea ? 'FAIL breathes/zooms' : 'PASS steady'}`);
  console.log(`  motion amount    ${fmt(mean, 1)}  ${fDead ? 'FAIL barely moves — reads as a frozen sprite' : 'PASS visible motion'}`);
  const fails = [fPace, fSeam, fDrift, fArea, fDead].filter(Boolean).length;
  if (fails && !missing) bad++;
  console.log(`  ${fails ? fails + ' issue(s)' : 'all checks pass'}`);
}
console.log(`\n${bad ? bad + ' key(s) with issues' : 'all keys clean'}`);
process.exit(bad ? 1 : 0);
