#!/usr/bin/env node
// Does Gravitos form 3 stay one size ACROSS his animation states?
// ============================================================================
// Per user: "fix the gravitos3 pulsing between the different types of animation
// sequence issue". Not the within-a-loop wobble — the size STEP you see when he
// stops idling and starts walking, or drops into a cast.
//
// The drawn body height is the product of three things, and each is set in a
// different place, which is why a mismatch is easy to ship:
//
//   art        the titan's own dark-armour height in the frame
//   calib s    data/anim_calib.js, per STATE  (gravitos3: idle 1.02, walk 1.22,
//              attack 1.06 — a 20% spread before any art is considered)
//   norm       _BOSS_SIZE_STRICT's content-norm, ref / contentHeight, applied
//              per frame at a 2% threshold. It keys on CONTENT — body plus
//              lightning, wings and beams — so it does not hold the BODY still.
//
// Multiply them and you get what the player sees. This measures that product
// per state and reports the spread between states, on the dark armour alone so
// the effects cannot vote on how big the titan is.
//
//   node scripts/gravitos3_state_size_test.mjs
// ============================================================================
import sharp from 'sharp';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const B = join(root, 'Sprites', 'bosses');
const ALPHA = 12;
const STRICT = 0.02;

// per-state s from anim_calib.js, read rather than hard-coded
const calibSrc = readFileSync(join(root, 'data', 'anim_calib.js'), 'utf8');
function calibFor(entity, state) {
  const i = calibSrc.indexOf('"' + entity + '": {');
  if (i < 0) return null;
  const seg = calibSrc.slice(i, i + 1400);
  const j = seg.indexOf('"' + state + '": {');
  if (j < 0) return null;
  const m = seg.slice(j).match(/"s":\s*([\d.]+)/);
  return m ? Number(m[1]) : null;
}

async function scan(p) {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let cy0 = h, cy1 = -1, by0 = h, by1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * c;
    if (data[i + 3] <= ALPHA) continue;
    if (y < cy0) cy0 = y; if (y > cy1) cy1 = y;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum > 140 || (mx && (mx - mn) / mx > 0.45)) continue;   // effect, not armour
    if (y < by0) by0 = y; if (y > by1) by1 = y;
  }
  if (cy1 < 0) return null;
  return { content: cy1 - cy0 + 1, body: by1 < 0 ? 0 : by1 - by0 + 1, canvas: h };
}

const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
const STATES = [
  ['idle', join(B, 'idle'), 'gravitos3'],
  ['walk', join(B, 'walk'), 'gravitos3'],
  ['attack', join(B, 'attack'), 'gravitos3'],
  ['laser', join(B, 'attack'), 'gravitos3laser'],
  ['punch', join(B, 'attack'), 'gravitos3punch'],
  ['soul', join(B, 'attack'), 'gravitos3soul'],
];

// Reference: the idle set's median content height, which is what the engine uses.
const idleFrames = [];
for (let i = 0; i < 9; i++) {
  const p = join(B, 'idle', `gravitos3_${i}.webp`);
  if (existsSync(p)) idleFrames.push(await scan(p));
}
const ref = med(idleFrames.map((f) => f.content));

console.log(`  reference (gravitos3 idle median content) = ${ref}px\n`);
console.log('  state    n   calib s   art body   after norm   DRAWN (relative)');
const drawnByState = [];
for (const [label, dir, key] of STATES) {
  const fr = [];
  for (let i = 0; i < 9; i++) {
    const p = join(dir, `${key}_${i}.webp`);
    if (existsSync(p)) { const r = await scan(p); if (r) fr.push(r); }
  }
  if (!fr.length) continue;
  // The cast sets carry their OWN calib entry (gravitos3laser/punch/soul), so
  // they must be looked up under THAT key. A first version asked gravitos3 for
  // an "attack" scale first, got 1.06, and never fell through — quietly
  // reporting all three at 1.06 when they are 1.0658, 1.0478 and 1.12.
  const s = (key === 'gravitos3')
    ? (calibFor('gravitos3', label) || 1)
    : (calibFor(key, 'attack') || 1);
  // Per frame: the norm scales so CONTENT matches ref, then calib s multiplies.
  const drawn = fr.map((f) => {
    const n = Math.abs(f.content - ref) > ref * STRICT ? Math.max(0.5, Math.min(2, ref / f.content)) : 1;
    return (f.body / f.canvas) * n * s;
  });
  const d = med(drawn);
  drawnByState.push({ label, d });
  console.log('  ' + label.padEnd(8) + String(fr.length).padStart(2) + '   '
    + s.toFixed(2).padStart(7) + '   ' + med(fr.map((f) => f.body)).toString().padStart(8)
    + '   ' + med(fr.map((f) => f.body * (Math.abs(f.content - ref) > ref * STRICT ? ref / f.content : 1))).toFixed(0).padStart(10)
    + '   ' + d.toFixed(4).padStart(10));
}
const vals = drawnByState.map((x) => x.d);
const spread = Math.max(...vals) / Math.min(...vals);
const biggest = drawnByState.find((x) => x.d === Math.max(...vals));
const smallest = drawnByState.find((x) => x.d === Math.min(...vals));
console.log(`\n  cross-state spread: ${spread.toFixed(3)}x  (${biggest.label} is the biggest, ${smallest.label} the smallest)`);
console.log('  1.000 would mean he is the same titan in every state.');
const TOL = 1.06;
if (spread > TOL) {
  console.log(`\n  FAIL — he changes size by ${((spread - 1) * 100).toFixed(0)}% between states.`);
  console.log('  Suggested calib s to put every state on the idle size:');
  const idleD = drawnByState.find((x) => x.label === 'idle');
  for (const x of drawnByState) {
    const ent = ['idle', 'walk', 'attack'].includes(x.label) ? 'gravitos3' : 'gravitos3' + x.label;
    const s = calibFor(ent, ent === 'gravitos3' ? x.label : 'attack') || 1;
    console.log('    ' + x.label.padEnd(8) + (s * (idleD.d / x.d)).toFixed(3));
  }
}
process.exitCode = spread > TOL ? 1 : 0;
