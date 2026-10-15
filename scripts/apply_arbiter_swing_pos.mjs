// The Arbiter's heavy swing was drawn far out in front of him, and hit beyond it (arbiter swing position, 2026-10-15).
// ============================================================================
// Per user: "for this swing on the left, it should be positioned closer to the arbiter instead of being so far out", then
// (shown the fix) "Ship + shorten reach": his hit area should end where his swing art does.
// Every boss heavy swing is drawn by one shared rule (_lxSwingArtRect): its art is fitted, at its own aspect, inside a box
// for its class and pinned to that class's anchor. The Arbiter swings an overhead CHOP, whose box runs from the middle of
// his body to 0.9 of his reach and whose art is pinned to the FAR end. His reach was immense (swingW 440 x 1.3 = 572 px) and
// the box is only floor - 0.6 x reach tall, so his purple crescent (608x488, fitted by its height: 436 x 350 px) filled the
// far three quarters of the box and left about 140 px of it empty between his drawn body and the crescent's tail. In the
// fight the windup ghost, the orb and starburst, the crescent and its trail all hung clear of his body and blade - measured
// on his strike frame: the crescent's nearest pixel 123-125 screen px in front of his armour with his old frames, 58-107 px
// with the regenerated ones (v0.30.1786), the same on both facings. His drawn body is not the cause: his armour sits on the
// hitbox's near side (5 px behind it .. 45 px past it with his blade, by pose) on both sides.
//   1) A type can now be pinned by its NEAR edge and drawn at a set size (LX_SWING_PIN: near = shares of its body width from
//      its front edge, h = the art's height in body heights; the art keeps the bottom edge its class gave it). The Arbiter's
//      crescent starts at his drawn armour and sweeps out from there, both facings, at the size it had (350 px tall). The
//      windup ghost, the orb, the strike and the trail share _lxDrawSwingArt, so all of them follow.
//   2) With the art pinned at him, its far edge sits 404 px out, and his 572 px hitbox ran 168 px past it - hits landed
//      beyond anything drawn. swingW 440 -> 311 (311 x 1.3 = 404 px): the hit area now ends where the crescent does. Its
//      height, damage, VERDICT and timing are unchanged; the windup zone, the ghost and the orb read the same width
//      (_lxSwingDims). range (360, centre to centre: his trigger) stays - it is pinned by melee_reach_test (290 px past
//      his edge), and a player close enough to set the swing off stands well inside the new 404 px reach.
// Every other swinger, and the shared rule, are untouched.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('const LX_SWING_PIN = ')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// 1) the table: a type pinned by its near edge at a set size, read off the shape (the shape table itself is left as generated)
{
  const A = "function _lxSwingShapeOf(type) { return (type && LX_SWING_SHAPE[type]) || null; }";
  once(A, J(A,
    "// v0.30.1788 arbiter-swing-pos - A SWING THAT STARTS AT ITS SWINGER (per user: \"for this swing on the left, it should be positioned closer to",
    "// the arbiter instead of being so far out\"). A class swing is pinned to its class anchor; a CHOP sits on the FAR end of a box that runs",
    "// from mid-body to 0.9 of the reach. The Arbiter's reach was 572 px and his chop box only floor - 0.6 x reach tall, so his crescent",
    "// (fitted by its height, 436 px wide) left ~140 px of empty box between his drawn armour and its tail: ghost, orb, crescent and trail",
    "// hung clear of his body and blade, both facings. A type listed here is pinned by its NEAR edge instead - near = body widths from the",
    "// front edge F (negative = into the body; his armour sits on F, -5..+45 px with his blade by pose) - and drawn h body heights tall",
    "// (bottom edge where its class put it), so its size no longer follows the reach: his swingW was cut to end the hit area where",
    "// this crescent ends (per user, \"shorten reach\"). Sweep and frames are unchanged; every type not listed keeps the class anchor.",
    "const LX_SWING_PIN = { towerArbiter: { near: -0.13, h: 2.19 } };",
    "for (const _k in LX_SWING_PIN) if (LX_SWING_SHAPE[_k]) LX_SWING_SHAPE[_k].pin = LX_SWING_PIN[_k];   // v0.30.1788 arbiter-swing-pos"), '_lxSwingShapeOf');
}
// 2) the draw: the ghost, the orb, the strike and the trail all come through here
{
  const A = "  if (!r || !(r.w > 0 && r.h > 0)) return false;";
  once(A, J(A, "  { const _pn = shape.pin; if (_pn && !r.rot) { if (_pn.h > 0) { const _b = r.y + r.h, _q = _pn.h * mb.h / r.h; r.w *= _q; r.h *= _q; r.y = _b - r.h; } if (_pn.near != null) r.u = _pn.near * mb.w; } }   // v0.30.1788 arbiter-swing-pos - pinned by its near edge at its set size (LX_SWING_PIN): it starts at the swinger"), '_lxDrawSwingArt rect');
}
// 3) his reach: the hit area ends where the pinned crescent does
{
  const A = "range:360, swingW:440, swingH:190,";
  once(A, "range:360, swingW:311 /* v0.30.1788 arbiter-swing-pos - per user (\"shorten reach\"): x1.3 = 404 px, where his crescent ends now that it starts at him (was 440: 572 px, 168 px past the art) */, swingH:190,", 'towerArbiter swingW');
}

const grew = s.length - n0;
if (grew < 1500 || grew > 3200) die('size moved ' + grew);
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
console.log('applied: arbiter-swing-pos (+' + grew + ' chars)');
