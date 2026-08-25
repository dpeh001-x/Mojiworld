#!/usr/bin/env node
// Boss attack sets — nine real frames, feet on the ground, one size throughout.
// ============================================================================
// Per user: "regenerate for gravitos3punch and gravitos3soul animation sprites".
//
// Both sets were broken in ways that a file listing cannot show, and the checks
// below are exactly those two failures turned into assertions:
//
//   * FOUR IMAGES PRETENDING TO BE NINE. Hashing the frames gave
//     0,1,2,3,3,3,2,1,0 — byte-identical palindromes, for both sets. Frame 3
//     was held for three beats and then frames 2,1,0 were replayed, so the
//     attack ran forwards and then rewound: the punch un-punched. Nine files
//     existed, so nothing downstream noticed.
//   * EVERY FRAME CLIPPED. Feet sat at y=1213 on a 1214-tall canvas, with
//     33-56 px of ink on the canvas edge in every frame — the titan's feet cut
//     off by the canvas boundary, in all eighteen frames across both sets.
//
// Body height is measured on the DARK ARMOUR (luminance <= 120), never on the
// silhouette. These bosses are wrapped in flame and, for the soul attack, in
// pale spirits; a silhouette metric tracks the effects, which is precisely the
// mistake that produced a false "the boss is zooming" report on gravitos2star
// and cost a wasted regeneration to catch.
//
//   node scripts/boss_attack_set_test.mjs
// ============================================================================
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SET = join(root, 'Sprites', 'bosses', 'attack');
const KEYS = ['gravitos3punch', 'gravitos3soul'];
const ALPHA = 12, BODY_LUM = 120, FRAMES = 9;

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
};

async function measure(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let x1 = -1, y1 = -1, border = 0, by0 = h, by1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * c;
    if (data[i + 3] <= ALPHA) continue;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border++;
    if (x > x1) x1 = x; if (y > y1) y1 = y;
    if (data[i + 3] >= 160 && data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114 <= BODY_LUM) {
      if (y < by0) by0 = y; if (y > by1) by1 = y;
    }
  }
  return { w, h, border, feet: y1, body: by1 < 0 ? null : by1 - by0 + 1 };
}

for (const key of KEYS) {
  console.log(`\n${key}`);
  const paths = [];
  for (let i = 0; i < FRAMES; i++) paths.push(join(SET, `${key}_${i}.webp`));
  if (!paths.every(existsSync)) { ok(`${key}: all 9 frames present`, false); continue; }
  const bufs = [];
  for (const p of paths) bufs.push(await readFile(p));
  const ms = [];
  for (const b of bufs) ms.push(await measure(b));

  // THE PALINDROME. Nine files is not nine frames.
  const distinct = new Set(bufs.map((b) => createHash('sha1').update(b).digest('hex'))).size;
  ok('nine DISTINCT frames, not four padded out', distinct === FRAMES,
    `${distinct} of ${FRAMES} — a repeated frame means the attack holds or rewinds`);

  // THE CLIPPING.
  const border = ms.reduce((a, m) => a + m.border, 0);
  ok('nothing is cut off by the canvas', border === 0, `${border} px of ink on the canvas edge`);

  // Scale, on the armour rather than the flame.
  const bodies = ms.map((m) => m.body);
  const spread = (Math.max(...bodies) - Math.min(...bodies)) / Math.max(...bodies);
  ok('the titan is one size all the way through', spread <= 0.03,
    `dark-armour body ${Math.min(...bodies)}..${Math.max(...bodies)} = ${(spread * 100).toFixed(1)}%`);

  // The renderer is bbox-bottom anchored: disagree about the floor and it hops.
  const feet = ms.map((m) => m.feet);
  const footSpread = Math.max(...feet) - Math.min(...feet);
  ok('the feet stay on one line', footSpread <= 6, `${footSpread} px spread`);

  ok('every frame shares one canvas', new Set(ms.map((m) => `${m.w}x${m.h}`)).size === 1,
    [...new Set(ms.map((m) => `${m.w}x${m.h}`))].join(', '));
}

ok('the set regenerator is in the repo', existsSync(join(root, 'scripts', 'regen_boss_attack_set.mjs')));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
