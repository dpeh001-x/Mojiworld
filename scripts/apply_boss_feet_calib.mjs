// The tower bosses (and Gravitos) stand in their own idle footprints when they change pose (boss feet calib, 2026-10-16).
// ============================================================================
// Per user: "for the other sprite sequence of the arbiter also calibrate to the foot, then also do the same for the tower sovereign",
// then "ensure the feet calibration for the gravitos forms as well (for the punch just calibrate the back leg)". Measured in the game
// at BOTH facings on EVERY frame of every set (his feet on screen - the drawn art's foot ink in his lowest rows mapped through the
// canvas transform - against his foot point; the Sovereign's robe hides all but the outer toe tips of his pointed shoes):
//   Tower Arbiter: idle, swing, pillar, verdict and lunge already stand in his idle footprints (judged frames within 3 px, each set
//     centred within 1 px) - untouched. His walk is left to its own rework (another package).
//   Tower Sovereign: pillar 23 px behind his idle's feet, collapse 5.5, his plain attack 2, drain 0.7 (one toe 3.5); walk 4.2 and
//     lunge 4.4 ahead - six dx nudges centre each set on the idle's toes. Swing and volley were centred already.
//   Gravitos (each form against its own idle): form 2's supernova (gravitos2star, its own calibration) stood 35 px behind - its dx
//     moves. His other sets share ONE calibration per form (the user's v0.30.1578 rule), so their FRAMES are re-baked instead and
//     forms 1-2's one calibration dy moves (+5 / +6 px, the floor) - both in LX_APPLY2. Form 3 is not in this package.
// The calibration half (LX_APPLY2, scripts/apply_boss_feet_calib_bake.mjs) bakes LX_ANIM_PATCH:1 blobs through scripts/apply_anim_patch.mjs.
// Sizes, feet lines, timings and hit boxes are kept, so no bake base (_lxBossBakeBaseFor) moves.
// Game file: (1) a version marker next to the calibration lookup; (2) Gravitos's calibration glide (v0.30.1333 calib-ease) no longer
// glides dx - a dx is now a foot registration that must land on the same frame as the art it corrects (every Gravitos dx was 0
// until now, so nothing else changes); s and dy still glide.
// What calibration cannot fix (no per-frame offset - only s, dx, dy, a per-frame scale and frame timing): wobble between frames of
// one set (Gravitos's idles drift 3-10 px), and real motion (stepping walks, the lunge brace, punches stepping out).
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('EVERY POSE STANDS IN THE IDLE FOOTPRINTS')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

{
  const A = 'function _lxAnimCalib(type, state) {';
  once(A, J(
    '// v0.30.1821 boss-feet-calib - EVERY POSE STANDS IN THE IDLE FOOTPRINTS (per user: "for the other sprite sequence of the arbiter also',
    '// calibrate to the foot, then also do the same for the tower sovereign", then the same for Gravitos). Measured in the game at both facings',
    '// on every frame: six Tower Sovereign sets stood 0.7-23 px off his idle\'s feet (their dx now centre them). Gravitos: his frames are re-baked',
    '// onto each form\'s idle (feet, body centre, size), forms 1 and 2\'s ONE calibration moved so he stands on the floor (+5 / +6 px; form 3',
    '// is a follow-up) and his form-2 supernova (its own canvas + calibration) placed on idle2\'s body. scripts/apply_boss_feet_calib_bake.mjs.',
    A), '_lxAnimCalib');
}

  {
    const E = '_ee.s += (_ecs - _ee.s) * _ek; _ee.dx += (_ecx - _ee.dx) * _ek; _ee.dy += (_ecy - _ee.dy) * _ek; _ee.t = _en;';
    once(E, '_ee.s += (_ecs - _ee.s) * _ek; _ee.dx = _ecx; _ee.dy += (_ecy - _ee.dy) * _ek; _ee.t = _en; _ee.k = _bk;   // v0.30.1821 boss-feet-calib - dx no longer glides: it is a foot registration and lands with its art', 'Gravitos calib glide');
    // the glide only ever made sense inside one canvas: form 2's supernova keeps its OWN calibration on its OWN canvas (s 0.965, dy 0.114
    // against the form's 1.04 / 0.022), so gliding between them drew its first ~250 ms up to 56 px above the floor at 1.16x and the idle
    // after it up to 67 px under the floor at 0.84x (measured). Entering or leaving that set now lands at once.
    const G = 'if (_ee && _en - _ee.t < 500) {';
    once(G, 'if (_ee && _en - _ee.t < 500 && (_ee.k === _bk || !(_ee.k === \'gravitos2star\' || _bk === \'gravitos2star\'))) {   // v0.30.1821 boss-feet-calib - no glide into / out of the supernova (its own canvas + calibration)', 'Gravitos calib glide gate');
    const H = '} else m._lxCalE = { s: _ecs, dx: _ecx, dy: _ecy, t: _en };';
    once(H, '} else m._lxCalE = { s: _ecs, dx: _ecx, dy: _ecy, t: _en, k: _bk };', 'Gravitos calib glide reset');
  }
const grew = s.length - n0;
if (grew < 400 || grew > 1600) die('size moved ' + grew);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000000) die('tmp small');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code);
}
console.log('applied: boss-feet-calib (+' + grew + ' chars)');
