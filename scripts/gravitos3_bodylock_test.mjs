#!/usr/bin/env node
// Does the gravitos3 BODY hold still on screen?
// ============================================================================
// Per user: "There is pulsations for gravitos3 animations".
//
// The pulse is not in the art. It is manufactured at draw time, by a rule the
// codebase already documents as doing exactly this (v0.26.351):
//
//   "the content-norm keys on each frame's CONTENT height (body + weapon), so a
//    boss whose attack art swings a big weapon gets scaled per-frame by how far
//    the weapon extends - the BODY then visibly pulses ~20% through the swing"
//
// Gravitos is in _BOSS_SIZE_STRICT, so every frame is rescaled to put its
// CONTENT height on the reference at a tight 2% threshold. Content includes the
// lightning, the wings, the laser and the soul tendrils. When those extend, the
// titan is scaled DOWN to keep the total constant - so the body shrinks exactly
// when the effect blooms, and springs back when it fades.
//
// _key is m._phaseSprite, i.e. 'gravitos3' for every one of these sets, so the
// reference is gravitos3's own idle median.
//
// This compares the two normalisations the engine already supports:
//   CONTENT  - _spriteContentBox, alpha > 12. What ships today.
//   BODYLOCK - _spriteBodyBox, alpha > 235: the SOLID core. Already used for
//              the Aetherion family, whose flared wings are the same problem.
//              Glows and beams are feathered, so they fall out of the mask and
//              stop voting on how big the titan is.
//
// The truth column is the titan measured directly - dark armour only, effects
// excluded - which is what the player perceives as "his size".
//
//   node scripts/gravitos3_bodylock_test.mjs
// ============================================================================
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const B = join(root, 'Sprites', 'bosses');
const STRICT = 0.02;

async function scan(p) {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let cy0 = h, cy1 = -1, sy0 = h, sy1 = -1, by0 = h, by1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * c, a = data[i + 3];
    if (a <= 12) continue;
    if (y < cy0) cy0 = y; if (y > cy1) cy1 = y;
    if (a > 235) { if (y < sy0) sy0 = y; if (y > sy1) sy1 = y; }
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum > 140 || (mx && (mx - mn) / mx > 0.45)) continue;
    if (y < by0) by0 = y; if (y > by1) by1 = y;
  }
  if (cy1 < 0) return null;
  return { content: cy1 - cy0 + 1, solid: sy1 < 0 ? 0 : sy1 - sy0 + 1, body: by1 < 0 ? 0 : by1 - by0 + 1 };
}

const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
const norm = (ref, cur) => (Math.abs(cur - ref) > ref * STRICT ? Math.max(0.5, Math.min(2.0, ref / cur)) : 1);
const spread = (a) => Math.max(...a) / Math.min(...a);

// Reference = gravitos3's own IDLE set median, which is what _key resolves to.
const idle = [];
for (let i = 0; i < 9; i++) {
  const p = join(B, 'idle', `gravitos3_${i}.webp`);
  if (existsSync(p)) idle.push(await scan(p));
}
if (!idle.length) { console.error('no gravitos3 idle frames'); process.exit(1); }
const refContent = med(idle.map((f) => f.content));
const refSolid = med(idle.map((f) => f.solid));
console.log(`  reference (gravitos3 idle median): content ${refContent}px, solid core ${refSolid}px\n`);

const sets = ['gravitos3', 'gravitos3laser', 'gravitos3punch', 'gravitos3soul', 'gravitos3star'];
console.log('  set                 n   body pulse TODAY   with BODYLOCK   art itself');
let worstNow = 0, worstLock = 0;
for (const s of sets) {
  const fr = [];
  for (let i = 0; i < 9; i++) {
    const p = join(B, 'attack', `${s}_${i}.webp`);
    if (existsSync(p)) { const r = await scan(p); if (r && r.body > 0) fr.push(r); }
  }
  if (fr.length < 2) continue;
  const now = fr.map((f) => f.body * norm(refContent, f.content));
  const lock = fr.map((f) => f.body * norm(refSolid, f.solid));
  const raw = fr.map((f) => f.body);
  const a = spread(now), b = spread(lock), c = spread(raw);
  worstNow = Math.max(worstNow, a); worstLock = Math.max(worstLock, b);
  const f = (x) => (x.toFixed(3) + 'x').padStart(11);
  console.log('  ' + s.padEnd(20) + String(fr.length).padStart(2) + f(a) + '     ' + f(b) + '  ' + f(c));
}
console.log(`\n  worst body pulse today ${worstNow.toFixed(3)}x  ->  with bodylock ${worstLock.toFixed(3)}x`);
console.log('  "art itself" is the raw drawn body before any normalisation, for reference.');
process.exitCode = worstLock < worstNow ? 0 : 1;
