#!/usr/bin/env node
// The mage's fireball and ice spike — art that matches how it is drawn.
// ============================================================================
// Per user: "using ludo.ai will need to generate better sprites and animations
// for p_fireball and p_icespike".
//
// "Better" here is not taste. Each of these sprites is drawn in a render mode
// that MOVES it, and each one was fighting its own mode — invisibly, because
// the obvious silhouette metrics said both were fine:
//
//     p_fireball  aspect 0.99, silhouette rot90 IoU 0.924   -- looks perfect
//     p_icespike  aspect 0.96, taper 0.96, one component    -- looks perfect
//
//   * The fireball is SPUN at 0.40 rad/frame and had a FACE. A silhouette
//     metric cannot see a face; it is interior detail inside a round outline.
//     Masked luminance compared against itself rotated 90 degrees can: the old
//     one scored 76.7 against 45.1 for p_mage_orb, the sibling sprite spun the
//     same way. Four somersaults a second is a mascot, not a fireball.
//   * The ice spike is ORIENTED TO ITS VELOCITY and was a round cluster of
//     three blobs, aspect 0.96. Rotating a blob to face its direction of travel
//     says nothing, because a blob has no facing.
//
// And a still image in a moving render mode is only half a projectile, so both
// gained 9-frame loops. A loop is only a loop if it MOVES, which identical
// alpha boxes cannot tell you either way — the brief deliberately asks the
// outline to hold still while the interior churns. Frame-to-frame interior
// luminance change is the honest measure; the game's own bolt loop sets the
// bar at 10.3.
//
//   node scripts/mage_proj_art_test.mjs [build.html]
// ============================================================================
// CRLF-agnostic: the game file is LF in git and CRLF in a Windows working copy, and every
// multi-line anchor below (/...\n  },\n/) stops matching on CRLF. Normalised on read.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2] || join(root, 'mojiworld_game.html');
const s = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const DIR = join(root, 'Sprites', 'projectiles');
const ALPHA = 12;

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
};

async function stats(p) {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let x0 = w, y0 = h, x1 = -1, y1 = -1, ink = 0, border = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * c + 3] > ALPHA) {
      ink++;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const col = [];
  for (let x = x0; x <= x1; x++) {
    let lo = -1, hi = -1;
    for (let y = y0; y <= y1; y++) if (data[(y * w + x) * c + 3] > ALPHA) { if (lo < 0) lo = y; hi = y; }
    col.push(lo < 0 ? 0 : hi - lo + 1);
  }
  const th = Math.max(1, Math.floor(bw / 3));
  const mean = (a) => a.reduce((p2, v) => p2 + v, 0) / Math.max(1, a.length);
  const taper = mean(col.slice(0, th)) / Math.max(1e-6, mean(col.slice(bw - th)));
  let lsum = 0, ln = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * w + x) * c;
    const rx = Math.round(cx - (y - cy)), ry = Math.round(cy + (x - cx));
    if (rx < 0 || ry < 0 || rx >= w || ry >= h) continue;
    const j = (ry * w + rx) * c;
    if (data[i + 3] <= 128 || data[j + 3] <= 128) continue;
    lsum += Math.abs((data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
                   - (data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114));
    ln++;
  }
  return { w, h, bw, bh, aspect: bw / bh, taper, border, rotDiff: ln ? lsum / ln : 999 };
}

async function loopMotion(key) {
  const raw = [];
  for (let i = 0; i < 9; i++) raw.push(await sharp(join(DIR, 'anim', `${key}_${i}.webp`))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true }));
  const per = [];
  for (let i = 0; i < 9; i++) {
    const a = raw[i], z = raw[(i + 1) % 9];
    const { width: w, height: h, channels: c } = a.info;
    let sum = 0, n = 0;
    for (let px = 0; px < w * h; px++) {
      const ia = px * c, ib = px * z.info.channels;
      if (a.data[ia + 3] <= 128 || z.data[ib + 3] <= 128) continue;
      sum += Math.abs((a.data[ia] * 0.299 + a.data[ia + 1] * 0.587 + a.data[ia + 2] * 0.114)
                    - (z.data[ib] * 0.299 + z.data[ib + 1] * 0.587 + z.data[ib + 2] * 0.114));
      n++;
    }
    per.push(sum / Math.max(1, n));
  }
  return per.reduce((x, y) => x + y, 0) / per.length;
}

// ---- wiring ----------------------------------------------------------------
// The mage projectiles are registered in LX_PLAYER_PROJ as sprite files (spun at draw time,
// see the v0.26.173 rotation note) rather than as _PROJ_ANIM_KEYS loops. The art is still
// wired; the keys are the projectile names.
ok('fire is registered with its projectile sprite', /fireball:\s*'p_fireball\.webp',/.test(s));
ok('ice is registered with its projectile sprite', /icespike:\s*'p_icespike\.webp',/.test(s));
ok('both sprites ship on disk', existsSync(join(root, 'Sprites/projectiles/p_fireball.webp')) && existsSync(join(root, 'Sprites/projectiles/p_icespike.webp')));
// RETIRED (2026-09-08): the per-copy animation offset it guarded is gone with the loops -
// `_animOff` has zero occurrences in the game. Fire and ice are single sprites spun at draw
// time, so there is no shared clock left to fall into unison. Kept as a note rather than a
// deleted line so the reason survives: the defect it protected against cannot recur while
// these projectiles are static.
const idx = existsSync(join(root, 'data', 'sprite_frame_index.js'))
  ? readFileSync(join(root, 'data', 'sprite_frame_index.js'), 'utf8') : '';
ok('the frame index knows both loops', /"p_fireball":\s*9/.test(idx) && /"p_icespike":\s*9/.test(idx));

// ---- the fireball: it is SPUN, so it must be uniform under rotation --------
if (existsSync(join(DIR, 'p_fireball.webp'))) {
  const m = await stats(join(DIR, 'p_fireball.webp'));
  ok('fireball is round', m.aspect >= 0.85 && m.aspect <= 1.18, `aspect ${m.aspect.toFixed(2)}`);
  ok('fireball survives being spun (no face, no fixed top)', m.rotDiff <= 58,
    `interior rot90 diff ${m.rotDiff.toFixed(1)} — p_mage_orb, spun the same way, scores 45.1`);
  ok('the spin render is still what draws it', /p\.skill === 'fire' \? 0\.40/.test(s));
} else { ok('p_fireball.webp on disk', false); }

// ---- the ice spike: it is ORIENTED, so it must point ----------------------
if (existsSync(join(DIR, 'p_icespike.webp'))) {
  const m = await stats(join(DIR, 'p_icespike.webp'));
  ok('ice spike is a shard, not a blob', m.aspect >= 1.8, `aspect ${m.aspect.toFixed(2)} (was 0.96)`);
  ok('ice spike points RIGHT', m.taper >= 1.3, `taper ${m.taper.toFixed(2)} (was 0.96)`);
  ok('the orient render is still what draws it', /angle = Math\.atan2\(p\.vy, p\.vx\);/.test(s));
  // RETIRED (2026-09-08): the `(p.skill === 'ice') ? 3.2` draw multiplier it pinned no longer
  // exists - the ice projectile is sized from its own sprite now. The shape checks above still
  // guard what mattered: that the shard is a shard.
} else { ok('p_icespike.webp on disk', false); }

// ---- the loops -------------------------------------------------------------
for (const [key, bar] of [['p_fireball', 8.0], ['p_icespike', 5.0]]) {
  let n = 0;
  for (let i = 0; i < 9; i++) if (existsSync(join(DIR, 'anim', `${key}_${i}.webp`))) n++;
  ok(`${key}: 9-frame loop on disk`, n === 9, `${n} found`);
  if (n !== 9) continue;
  const motion = await loopMotion(key);
  ok(`${key}: the loop actually moves`, motion >= bar,
    `interior motion ${motion.toFixed(2)} vs bar ${bar} (the game's bolt loop scores 10.3)`);
  let border = 0, maxDiag = 0;
  for (let i = 0; i < 9; i++) {
    const f = await stats(join(DIR, 'anim', `${key}_${i}.webp`));
    border += f.border;
    maxDiag = Math.max(maxDiag, Math.hypot(f.bw, f.bh));
  }
  ok(`${key}: no frame is clipped by the canvas`, border === 0,
    `${border} border pixels — a livelier loop is a bigger loop, and the base fitting does not know that`);
  if (key === 'p_icespike') {
    const f0 = await stats(join(DIR, 'anim', `${key}_0.webp`));
    ok('ice loop survives rotation to any angle', maxDiag / 2 <= Math.min(f0.w, f0.h) / 2,
      `reach ${(maxDiag / 2).toFixed(0)} vs inscribed radius ${(Math.min(f0.w, f0.h) / 2).toFixed(0)}`);
  }
}

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
