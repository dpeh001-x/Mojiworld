// King Gloopaloo's idle and walk get authored frame timing.
// ============================================================================
// Per user: "improve smoothness of the animations".
//
// 158 of the 159 entities in data/anim_calib.js carry per-frame timing for at
// least one state. He carried it for `attack` only, so his idle and his walk
// fell back to the flat 130 ms step - nine frames at 7.7 fps, which is the
// stepping the user is seeing. Both states get an eased breathing curve now:
// slower at the squash extremes, quicker through the middle, mean 92 ms.
//
// Declarative through the sanctioned route (scripts/apply_anim_patch.mjs), and
// his attack entry and his attack HITBOX block are passed through verbatim -
// the patch format DELETES a hitbox block that a patch omits, which would
// silently drop his tuning.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CALIB = path.join(ROOT, 'data', 'anim_calib.js');

const PATCH = {
  LX_ANIM_PATCH: 1,
  type: 'king',
  calib: {
    idle:   { s: 1, dx: 0, dy: 0, ft: [112, 92, 76, 68, 68, 76, 92, 112, 132] },
    walk:   { s: 1, dx: 0, dy: 0, ft: [84, 72, 62, 58, 58, 62, 72, 84, 96] },
    attack: { s: 1.3152, dx: 0, dy: 0, ft: [72, 60, 60, 60, 60, 90, 132, 90, 96] },
  },
  hitbox: {
    idle:   { w: 0.6623, h: 0.6545, ox: 0, oy: -0.0045 },
    walk:   { w: 0.6896, h: 0.6091, ox: 0.0227, oy: -0.0182 },
    attack: { w: 0.6714, h: 0.6591, ox: 0, oy: 0.0136 },
  },
};

// Decide by PARSING, not by a regex over the text: a loose pattern matched a
// neighbouring entity's "idle" and reported 'already applied' on a file that had
// never been baked, so the timing silently never landed.
const probe = {};
// eslint-disable-next-line no-new-func
new Function('window', readFileSync(CALIB, 'utf8'))(probe);
const k0 = probe.LX_ANIM_CALIB && probe.LX_ANIM_CALIB.king;
const already = !!(k0 && k0.idle && Array.isArray(k0.idle.ft) && k0.walk && Array.isArray(k0.walk.ft));
if (already) { console.log('already applied'); process.exit(0); }
execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'apply_anim_patch.mjs'), JSON.stringify(PATCH)], { cwd: ROOT, stdio: 'inherit' });

// prove the hitbox survived - the patch format drops what it does not carry
const g = {};
const after = readFileSync(CALIB, 'utf8');
// eslint-disable-next-line no-new-func
new Function('window', after)(g);
const hb = g.LX_ATK_HITBOX && g.LX_ATK_HITBOX.king;
const cal = g.LX_ANIM_CALIB && g.LX_ANIM_CALIB.king;
if (!hb || !hb.attack) { console.error('ABORT: his attack hitbox block went missing'); process.exit(1); }
if (!cal || !cal.idle || !cal.idle.ft || !cal.walk || !cal.walk.ft) { console.error('ABORT: idle/walk timing not present'); process.exit(1); }
console.log('applied: his idle and walk carry frame timing (mean ' +
  Math.round(cal.idle.ft.reduce((a, b) => a + b, 0) / cal.idle.ft.length) + ' ms), hitbox intact');
