// Gravitos supernova plays to its last frame (forms 2 and 3) - seen in live previews after v0.30.1821 / v0.30.1822:
// "his Singularity / supernova cast ends when its hazard resolves (about 5.7 s in), before the supernova animation set finishes".
// ============================================================================
// What the player saw: a Singularity's cast ends on the step its hazard resolves (the AI goes idle as the hazard splices
// itself), and the star set was keyed so its blow STARTED on that resolve (v0.30.1363 key-frame). So the blow and every frame
// after it were cut: form 2 (gravitos2star) flickered its chest blast (f6) and never drew the fading arcs and calm pose (f7-8);
// form 3 (gravitos3star) cut from the growing sphere (f3) straight to idle - its sphere, explosion, shards and calm (f4-8)
// never drew.
// What changes: one draw-only helper, _lxGravSingFitIdx, called from _gravitosOnceFrame for 'singularity' only. The set now ENDS
// on the resolve: the blow and the frames after it play their authored lengths (form 2 370 ms, form 3 710 ms) and finish as the
// hazard resolves; the frames before share the rest of the cast in their authored proportions (as before), and his calm last
// frame hands over to idle under the resolve's flash. Clocked on the hazard's own countdown (life, one per step - the counter
// that resolves it), so it lands at every cadence; the pattern clock stands in before the hazard spawns.
// Untouched: the hazard, its 330-step timing, damage, safe zones, his hitbox (_gravStarKey), the AI, the cooldowns, the
// calibration glide gate (v0.30.1821) and the ghost frames (v0.30.1822). Anchors sit in the frame picker, clear of the pending
// gravitos3_hq art/calibration work.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxGravSingFitIdx(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); if (/[^\x09\x0a\x0d\x20-\x7e]/.test(b)) die(what + ': non-ASCII in the insert'); s = s.replace(a, () => b); };

// (1) the helper - a new block in front of _gravitosOnceFrame
{
  const A = 'function _gravitosOnceFrame(m, key) {';
  const B = J(
    "// v0.30.1827 grav-star-fit - THE SUPERNOVA PLAYS TO ITS LAST FRAME (forms 2 and 3). A Singularity's cast ends on the step its hazard resolves (the AI",
    "// goes idle as the hazard splices itself), and its set was keyed so the blow STARTED on that resolve - so the blow and all after it were cut: form 2's",
    "// chest blast (f6) flickered and its fading arcs and calm pose (f7-8) never drew; form 3 cut from the growing sphere (f3) straight to idle.",
    "// The set now ENDS on the resolve: the blow and the frames after it play their authored lengths (form 2 370 ms, form 3 710 ms) and finish as the",
    "// hazard resolves, the frames before share the rest of the cast in their authored proportions, and the calm last frame hands over to idle under",
    "// the resolve's flash. Clocked on the hazard's own countdown (life, one per step - the counter that resolves it), so it lands at every cadence;",
    "// the pattern clock stands in before the hazard spawns. Draw only: the hazard, its timing, damage, his hitbox, the AI and cooldowns are untouched.",
    "function _lxGravSingFitIdx(m, key, n) {   // v0.30.1827 grav-star-fit - the frame index, or null (no authored timing: the old even spread, which already ends early)",
    "  const ft = n > 1 ? _lxCalibFt(key, 'attack') : null;",
    "  if (!ft) return null;",
    "  let h = null;",
    "  for (const q of game.hazards) if (q && q.type === 'gravitos_singularity' && q.life > 0 && q.maxLife > 0 && (!h || q.maxLife > h.maxLife)) h = q;",
    "  const T = (h ? h.maxLife : 330) * 1000 / 60;   // v0.30.1827 grav-star-fit - the cast: the hazard's whole countdown, ms",
    "  // v0.30.1827 grav-star-fit - resolved but not yet idle (the resolve's hitstop): hold the last frame; not yet spawned: the pattern clock",
    "  const e = h ? (h.maxLife - h.life) * 1000 / 60 : m._sgSpawned ? T : (m.patternTimer || 0) / (_gravTeleMs(m, 1) || 1);",
    "  const k = _lxBossKeyFrame(key, n, ft), post = _lxFtTotal(n, ft) - _lxFtPrefix(n, ft, k);   // v0.30.1827 grav-star-fit - the blow and all after it, authored ms",
    "  return _lxKeyedIdx(n, ft, k, e, Math.max(0, T - post), T);",
    "}",
    A);
  once(A, B, '_gravitosOnceFrame head');
}

// (2) the call - Singularity only, after the picker has counted its decoded frames
{
  const L = '  const _dur = _GRAV_ONCE_DUR[m.patternState] || 1400;';
  once(L + EOL, J(L,
    "  if (m.patternState === 'singularity') { const _sfi = _lxGravSingFitIdx(m, key, n); if (_sfi != null) return frames[_sfi]; }   // v0.30.1827 grav-star-fit - the set ends on the resolve",
    ''), '_gravitosOnceFrame _dur');
}

const grew = s.length - n0;
if (grew < 1800 || grew > 3600) die('size moved ' + grew);
const marks = [...s.matchAll(/v0\.30\.(?:x|\d+) grav-star-fit/g)].length;   // the ship chain retags x to the real version, here and in this file
if (marks !== 6) die('markers ' + marks);
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
console.log('applied: grav-star-fit (+' + grew + ' chars)');
