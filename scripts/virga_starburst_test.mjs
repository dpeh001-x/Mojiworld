#!/usr/bin/env node
// Virga's STARBURST — centre of the screen, eight ways, three times.
// ============================================================================
// Per user: "add an additional starburst skill whereby virga flies to the
// centre of the screen and shoots projectiles in 8 directions".
//
// The checks that earn their place are the arithmetic ones:
//
//   * THE WAVES MUST NOT REPEAT. Eight rays are 45 degrees apart, so a
//     half-wedge step (22.5) puts wave three back on wave one's rays exactly.
//     Measured on the first build: the burst fired 0, 22.5, 0. The offsets are
//     recomputed here from the constants in the source and asserted distinct
//     modulo the ray spacing, so any future retune of the wave count is caught.
//   * THE ART MUST POINT RIGHT. _PROJ_SPRITE_BLIT draws it in mode:'orient',
//     which rotates the sprite to its velocity vector assuming forward is +x.
//     A tip facing the wrong way is wrong in all eight directions at once.
//   * IT MUST NOT CLIP WHEN ROTATED. Content has to fit inside the canvas's
//     inscribed circle or the corners are shaved at the diagonals.
//
//   node scripts/virga_starburst_test.mjs [build.html]
// ============================================================================
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2] || join(root, 'mojiworld_game.html');
const s = readFileSync(file, 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
};

// ---- the projectile is registered everywhere it has to be ------------------
const art = join(root, 'Sprites', 'projectiles', 'p_virga_lance.webp');
ok('p_virga_lance.webp on disk', existsSync(art));
ok('LX_MOB_PROJ knows radiantLance', /radiantLance:\s*'p_virga_lance\.webp'/.test(s));
ok('it renders oriented to its velocity', /radiantLance:\s*\{\s*mode:\s*'orient'/.test(s),
  'the burst fires on all eight compass points; a static sprite would face one way in all of them');
ok('holy light tests MDEF, not DEF', /p\.skill === 'radiantLance'/.test(s)
  && /isMagic[\s\S]{0,400}?p\.skill === 'radiantLance'/.test(s));

// ---- the AI: fly to the CENTRE OF THE SCREEN --------------------------------
const ai = s.match(/\n  virgo\(m, dt, dist, phase, z\) \{[\s\S]*?\n  \},\n/);
ok('the virgo AI block was found', !!ai);
const V = ai ? ai[0] : '';
ok('a starburst state exists', /m\._sbPhase = 1;/.test(V));
// "the centre of the screen" is a promise about what the player can see, so it
// is the CAMERA's centre, not the arena's midpoint.
ok('the target is the camera centre, not the arena centre',
  /_sbTx = _sbCamX \+ W \/ 2 - m\.w \/ 2/.test(V) && /_sbCamX = \(game\.camera \? game\.camera\.x : 0\)/.test(V));
ok('she climbs to it rather than teleporting', /_sbT < _SB_CLIMB/.test(V) && /_sbEase/.test(V));
ok('there is a telegraph before anything fires', /_sbT < _sbFireAt/.test(V) && /_SB_AIM = \d+/.test(V));
ok('the telegraph draws all eight rays', /for \(let _si = 0; _si < 8; _si\+\+\)[\s\S]{0,200}?_budgetedParticlePush/.test(V));

// ---- eight directions, evenly ----------------------------------------------
ok('the volley is eight lances', /for \(let _si = 0; _si < 8; _si\+\+\) \{[\s\S]{0,120}?game\.projectiles\.push/.test(V));
ok('evenly spaced around the full circle', /_sa = \(_si \/ 8\) \* Math\.PI \* 2 \+ _sbOff/.test(V));
ok('the lances fly straight', /skill: 'radiantLance',[\s\S]{0,120}?noGravity: true/.test(V));

// THE ARITHMETIC: recompute the wave offsets from the source and prove no two
// waves land on the same rays.
const waves = Number((V.match(/_SB_WAVES = (\d+)/) || [])[1] || 0);
ok('more than one wave', waves >= 2, `_SB_WAVES=${waves}`);
const offExpr = V.match(/const _sbOff = ([^;]+);/);
ok('the wave offset subdivides one wedge', !!offExpr && /_wave \/ _SB_WAVES\) \* \(Math\.PI \/ 4\)/.test(offExpr[1]),
  offExpr ? offExpr[1].trim() : 'not found');
if (waves >= 2 && offExpr) {
  const deg = [];
  for (let w = 0; w < waves; w++) deg.push(+(((w / waves) * 45) % 45).toFixed(3));
  const uniq = new Set(deg.map((d) => d.toFixed(3)));
  ok('no two waves fire the same rays', uniq.size === waves, `offsets ${deg.join(', ')} deg (mod 45)`);
}

// ---- it owns the body while it runs ----------------------------------------
ok('the ordinary soar cannot start mid-starburst', /!m\._zFlying && !m\._sbPhase && m\._zFlyCd <= 0/.test(V));
ok('the soar arc yields the body', /if \(m\._zFlying && !m\._sbPhase\) \{/.test(V),
  'both write m.y, and their targets are opposites');
ok('her pillars stand down for the duration', /if \(m\._columnCd < \d+\) m\._columnCd = \d+;/.test(V));
ok('the flight animation plays throughout', /m\._zFlying = true;\s*\/\/ airborne/.test(V));
// The trap: mid-soar she is already 200px up, so landing on m.y would strand
// her a little higher after every burst.
ok('she lands on the real ground, not on her hover height',
  /_sbGroundY = \(m\._zFlying && m\._zFlyGroundY != null\) \? m\._zFlyGroundY : m\.y;/.test(V));
ok('the burst clears _noGravity when it ends', /m\._noGravity = false; m\._zFlying = false;/.test(V));

// ---- the art contract -------------------------------------------------------
if (existsSync(art)) {
  const { data, info } = await sharp(art).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * c + 3] > 12) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const colH = [];
  for (let x = x0; x <= x1; x++) {
    let lo = -1, hi = -1;
    for (let y = y0; y <= y1; y++) if (data[(y * w + x) * c + 3] > 12) { if (lo < 0) lo = y; hi = y; }
    colH.push(lo < 0 ? 0 : hi - lo + 1);
  }
  const t = Math.max(1, Math.floor(bw / 3));
  const mean = (a) => a.reduce((p, v) => p + v, 0) / Math.max(1, a.length);
  const taper = mean(colH.slice(0, t)) / Math.max(1e-6, mean(colH.slice(bw - t)));
  ok('the lance is longer than it is tall', bw / bh >= 1.45, `aspect ${(bw / bh).toFixed(2)}`);
  ok('the lance points RIGHT', taper >= 1.3, `taper ${taper.toFixed(2)} (thick left / thin right)`);
  const reach = Math.hypot(bw, bh) / 2, radius = Math.min(w, h) / 2;
  ok('it cannot clip when rotated to a diagonal', reach <= radius,
    `reach ${reach.toFixed(0)} vs canvas radius ${radius.toFixed(0)}`);
}

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
