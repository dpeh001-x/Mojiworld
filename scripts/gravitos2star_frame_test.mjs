#!/usr/bin/env node
// Gravitos-2's star-charge frames — no clipping, and no zoom at the opening.
// ============================================================================
// Per user: "regenerate gravitos2star_0 with ludo.ai, if needed expand the
// canvas so there are no cutoffs or zoomin".
//
// The boss renderer is bbox-bottom anchored and sizes a frame from its content
// box. Two consequences, and both are invariants a regenerated frame can break
// without looking broken in a file browser:
//
//   * A frame whose content box is larger than its neighbour's draws the boss
//     BIGGER. Frame-to-frame box growth is a zoom, whatever the art does.
//   * A frame whose ink bottom sits at a different y draws the boss at a
//     different height. Disagree about where the floor is and the boss hops.
//
// So the opening beat is pinned against its neighbour on both, and the whole
// set is pinned against the canvas edge. What is NOT asserted here is the
// 1->2 step: frames 2..8 really are ~11% larger than 0..1 (body measured star-
// to-feet: 750px at _1, 861px at _2), which is a set-wide retune rather than
// anything this frame can fix, and asserting it would fail on art nobody has
// been asked to change yet.
//
//   node scripts/gravitos2star_frame_test.mjs
// ============================================================================
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SET = join(root, 'Sprites', 'bosses', 'attack');
const KEY = 'gravitos2star';
const ALPHA = 12;

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
};

async function measure(p) {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let x0 = w, y0 = h, x1 = -1, y1 = -1, border = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * c + 3] <= ALPHA) continue;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border++;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  // Star-to-feet is the body's own height, independent of how far the lightning
  // and wings sprawl — the honest way to compare two poses for scale.
  let sy = 0, sn = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * w + x) * c;
    if (data[i + 3] < 160) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (b > 200 && g > 170 && r > 140 && b >= r) { sy += y; sn++; }
  }
  return { w, h, bw: x1 - x0 + 1, bh: y1 - y0 + 1, bottom: y1, border,
    starToFeet: sn ? y1 - sy / sn : null };
}

const F = [];
for (let i = 0; i < 9; i++) {
  const p = join(SET, `${KEY}_${i}.webp`);
  if (!existsSync(p)) { ok(`${KEY}_${i}.webp on disk`, false); F.push(null); continue; }
  F.push(await measure(p));
}
ok('all 9 attack frames present', F.every(Boolean));
if (!F.every(Boolean)) { console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(1); }

// ---- the whole set ---------------------------------------------------------
ok('every frame shares one canvas', new Set(F.map((f) => `${f.w}x${f.h}`)).size === 1,
  [...new Set(F.map((f) => `${f.w}x${f.h}`))].join(', '));
const clipped = F.map((f, i) => [i, f.border]).filter(([, b]) => b > 0);
ok('no frame is cut off by the canvas edge', clipped.length === 0,
  clipped.map(([i, b]) => `_${i}: ${b}px`).join(', '));

// ---- the opening beat, against the neighbour it has to flow into -----------
const a = F[0], b = F[1];
const boxDelta = Math.abs(a.bh - b.bh) / b.bh;
ok('_0 does not zoom against _1', boxDelta <= 0.03,
  `box ${a.bw}x${a.bh} vs ${b.bw}x${b.bh} — ${(boxDelta * 100).toFixed(1)}% (the renderer sizes the boss from this)`);
ok('_0 stands on the same floor line as _1', Math.abs(a.bottom - b.bottom) <= 6,
  `ink bottom ${a.bottom} vs ${b.bottom} — bbox-bottom anchored, so a mismatch is a hop`);
const bodyDelta = (a.starToFeet && b.starToFeet) ? Math.abs(a.starToFeet - b.starToFeet) / b.starToFeet : 1;
ok('_0 and _1 are the same titan, not two sizes of it', bodyDelta <= 0.05,
  `star-to-feet ${Math.round(a.starToFeet)} vs ${Math.round(b.starToFeet)} — ${(bodyDelta * 100).toFixed(1)}%`);

// ---- the generator that made it stays reproducible --------------------------
ok('the regenerator is in the repo', existsSync(join(root, 'scripts', 'regen_gravitos2star_frame.mjs')));

console.log(`\n${pass}/${pass + fail} checks passed`);
// Informational: the set-wide step this frame deliberately does not touch.
const hs = F.map((f) => f.bh);
const jumps = hs.slice(1).map((v, i) => ({ at: `${i}->${i + 1}`, pct: (v - hs[i]) / hs[i] * 100 }));
const worst = jumps.reduce((p, q) => Math.abs(q.pct) > Math.abs(p.pct) ? q : p);
console.log(`note: largest remaining frame-to-frame box step is ${worst.at} at ${worst.pct > 0 ? '+' : ''}${worst.pct.toFixed(1)}% — a set-wide retune, not this frame's to fix`);
process.exit(fail ? 1 : 0);
