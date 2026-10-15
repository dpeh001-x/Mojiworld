// The Tower Arbiter's verdict pose stands in his idle footprints (arbiter verdict calib, 2026-10-15).
// ============================================================================
// Per user: "calibrate the verdict sprites such that the foot is in the same position as the idle". When the Arbiter goes
// from his idle into his verdict pose (attack/towerArbiterverdict - the greatsword held inverted, fire running down the
// blade) his boots must not move. Measured in the game at BOTH facings, frame by frame (his boot soles on screen, from the
// drawn art mapped through the canvas transform, against his foot point): the verdict drew him at the idle's size on the
// idle's feet line, but ~40 px BEHIND the idle's boots (rear boot -40.8 px, front boot -38.5 px, the same on all nine
// frames - the pose has no step), so idle -> verdict slid him back a boot length and verdict -> idle slid him forward again.
// His walk stood ~13 px AHEAD the same way (its art is the idle's canvas with the boots on the same spot; only its x nudge
// differed). His swing (<= 1 px), pillar (<= 1 px) and lunge brace (<= 2 px) already stand in the idle's footprints.
// The fix is calibration only (the LX_APPLY2 half, scripts/apply_arbiter_verdict_calib_bake.mjs, bakes LX_ANIM_PATCH:1
// blobs through scripts/apply_anim_patch.mjs): towerArbiterverdict.attack dx 0.0975 -> 0.1632 (solved so the midpoint of his
// two boot soles lands on the idle's: each boot within ~1.2 px) and towerArbiter.walk dx 0.0664 -> 0.045 (the idle's own); sizes,
// feet lines, timings and hit boxes are kept. The verdict's bake base is unchanged (its draw size does not move).
// Game file: a version marker next to the calibration lookup only.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('THE VERDICT STANDS IN HIS IDLE FOOTPRINTS')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

{
  const A = 'function _lxAnimCalib(type, state) {';
  once(A, J(
    '// v0.30.1787 arbiter-verdict-calib - THE VERDICT STANDS IN HIS IDLE FOOTPRINTS (per user: "calibrate the verdict sprites such that the foot is',
    '// in the same position as the idle"). Measured in the game at both facings, the Tower Arbiter\'s verdict (towerArbiterverdict) drew his boots',
    '// ~40 px behind the idle\'s and his walk ~13 px ahead; their dx in data/anim_calib.js now put the midpoint of his two boot soles on the',
    '// idle\'s (each boot within ~1.2 px, every frame). s, dy, timings and hit boxes are unchanged; scripts/apply_arbiter_verdict_calib_bake.mjs.',
    A), '_lxAnimCalib');
}

const grew = s.length - n0;
if (grew < 300 || grew > 1200) die('size moved ' + grew);
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
console.log('applied: arbiter-verdict-calib (+' + grew + ' chars)');
