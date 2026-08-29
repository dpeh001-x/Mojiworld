#!/usr/bin/env node
// Level Gravitos-3's PER-FRAME scale on his HEAD AND BODY, not on his wings.
//
// Per user: "Gravitos3 idle sprite pulsates ... gravitos3 has wings so that can
// affect the size calibration, the calibration should be based on the head and
// body".
//
// That is the right diagnosis and it is why the existing machinery could not fix
// it. Gravitos is in _BOSS_SIZE_STRICT, so the engine rescales each frame to put
// its CONTENT height on a reference - but content includes the wings and the
// flame crest. Measured on the idle set the content height is essentially flat
// (902 px on every frame), so the normalisation is a no-op and the head/body
// variation inside that constant box reaches the screen untouched.
//
// The measure here is deliberately narrow:
//   ARMOUR  = opaque AND dark (luminance < 95). The lava veins, the flame crest
//             and the wing membranes are bright; the plate is near-black.
//   CENTRAL = a band of 40% of the armour span around its centre of mass, which
//             keeps head, horns, torso and legs and drops the wings, since wings
//             are what extend laterally.
// Their vertical extent is the head-and-body height the user asked to key on.
//
//   node scripts/gravitos3_headbody_fs.mjs            # report
//   node scripts/gravitos3_headbody_fs.mjs --write    # bake fs[] into anim_calib
import sharp from 'sharp';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const BAND = 0.40, DARK = 95, ALPHA = 160;
export const headBody = async (f) => {
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const arm = (x, y) => {
    const j = (y * W + x) * C;
    if (data[j + 3] < ALPHA) return false;
    return (0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]) < DARK;
  };
  let sx = 0, n = 0, lo = 1e9, hi = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (arm(x, y)) { sx += x; n++; if (x < lo) lo = x; if (x > hi) hi = x; }
  if (!n) return null;
  const cx = sx / n, half = (hi - lo) * BAND / 2;
  const x0 = Math.max(0, Math.round(cx - half)), x1 = Math.min(W - 1, Math.round(cx + half));
  let top = -1, bot = -1;
  for (let y = 0; y < H; y++) for (let x = x0; x <= x1; x++) if (arm(x, y)) { if (top < 0) top = y; bot = y; break; }
  return { h: bot - top, wingSpan: hi - lo };
};

// Importable: gravitos3_idle_pulse_test.mjs reuses headBody() above, and a
// module that prints a report merely because it was imported would corrupt any
// output it is pulled into.
const RUN_DIRECTLY = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
// Everything below is the REPORT and the bake. Guarded so that importing this
// module for headBody() alone does no file I/O and prints nothing.
if (RUN_DIRECTLY) {
const SETS = [
  ['idle', 'Sprites/bosses/idle/gravitos3_'],
  ['walk', 'Sprites/bosses/walk/gravitos3_'],
  ['attack', 'Sprites/bosses/attack/gravitos3_'],
];
const spread = (a) => Math.max(...a) / Math.min(...a);
const out = {};
console.log('  state    head+body heights                              spread   wing-span spread');
for (const [state, pre] of SETS) {
  const hs = [], ws = [];
  for (let i = 0; i < 9; i++) {
    let m = null;
    try { m = await headBody(`${pre}${i}.webp`); } catch (e) { break; }
    if (!m) break;
    hs.push(m.h); ws.push(m.wingSpan);
  }
  if (hs.length !== 9) { console.log(`  ${state.padEnd(8)} (set not found / incomplete)`); continue; }
  // level to the MEDIAN so the boss neither grows nor shrinks overall
  const med = hs.slice().sort((a, b) => a - b)[4];
  out[state] = { fs: hs.map(h => +(med / h).toFixed(4)), before: spread(hs), heights: hs };
  console.log(`  ${state.padEnd(8)} ${hs.join(' ')}   ${spread(hs).toFixed(3)}x   ${spread(ws).toFixed(3)}x`);
}
console.log('');
for (const [state, o] of Object.entries(out)) {
  const after = spread(o.heights.map((h, i) => h * o.fs[i]));
  console.log(`  ${state.padEnd(8)} fs = [${o.fs.join(', ')}]`);
  console.log(`  ${''.padEnd(8)} head+body spread ${o.before.toFixed(3)}x -> ${after.toFixed(3)}x`);
}
console.log('\n  The wing-span column is the point: it moves far more than the head and body,');
console.log('  so any measure that includes the wings is measuring the flap, not the titan.');

if (process.argv.includes('--write')) {
  const CAL = 'data/anim_calib.js';
  const src = readFileSync(CAL, 'utf8');
  const m = src.match(/^([\s\S]*?)window\.LX_ANIM_CALIB = (\{[\s\S]*?\});\r?\nwindow\.LX_ATK_HITBOX = (\{[\s\S]*?\});\r?\n?$/);
  if (!m) { console.error('anim_calib.js did not match the expected shape'); process.exit(1); }
  const calib = JSON.parse(m[2]), hitbox = JSON.parse(m[3]);
  calib.gravitos3 = calib.gravitos3 || {};
  // IDLE ONLY by default, and that restraint is the point. A walk cycle is
  // SUPPOSED to rise and fall and an attack is supposed to crouch and extend -
  // measured head+body spread 1.252x on walk and 1.163x on attack is mostly gait,
  // not error. Levelling those to 1.000x would iron the bob out of the walk and
  // the wind-up out of the swing. Idle is the state that should hold still, and
  // it is the one the user reported. --states=walk,attack to override.
  const want = (process.argv.find(a => a.startsWith("--states=")) || "--states=idle").split("=")[1].split(",");
  for (const [state, o] of Object.entries(out)) {
    if (!want.includes(state)) continue;
    calib.gravitos3[state] = { ...(calib.gravitos3[state] || { s: 1, dx: 0, dy: 0 }), fs: o.fs };
  }
  const body = m[1] + 'window.LX_ANIM_CALIB = ' + JSON.stringify(calib, null, 2) + ';\n'
    + 'window.LX_ATK_HITBOX = ' + JSON.stringify(hitbox, null, 2) + ';\n';
  const tmp = CAL + '.fstmp.js';
  writeFileSync(tmp, body);
  execFileSync('node', ['--check', tmp]);
  renameSync(tmp, CAL);
  const wrote = Object.keys(out).filter(k => want.includes(k));
  const skipped = Object.keys(out).filter(k => !want.includes(k));
  console.log(String.fromCharCode(10) + "  baked fs[] into " + CAL + " for: " + (wrote.join(", ") || "(nothing)"));
  if (skipped.length) console.log("  left alone (gait, not error): " + skipped.join(", "));
}

}