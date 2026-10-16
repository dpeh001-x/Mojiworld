// The Sovereign of the Spire lunged past the hero, away from them (sovereign lunge direction, 2026-10-16).
// ============================================================================
// Per user: "Tower sovereign lunges in the wrong direction".
// Measured in the game (B10, 1600 px), with the hero still, to his left and to his right, in open floor and by the walls: the lunge always
// set off toward the hero, his dash art faces the way he travels (it is authored facing right like his idle) and nothing flips mid-dash.
// What goes wrong is WHERE it goes. His hourglass lunge is a fixed 460 px (the shared default), opened whenever the hero's centre is more
// than 130 px from his - and he is 255 px wide, so 130 px is the hero standing against his own edge. Worse, his chase walked him straight
// through the hero: its arrival deadband (stop accelerating within ~150 px, the generic chase's cure for "overshot, turned and sawed
// back") only applies when boss and hero are "co-elevated", judged centre to centre within 90 px, and his 300 px height puts his centre
// 128 px above a hero on the same floor. So he paced back and forth through the hero, and each time he cleared them by 130 px his lunge
// fired from point-blank and carried him 460 px - 270-330 px past the hero in a 40 s fight, every time, then walking on away from them.
// To the player he lunges away from them.
//   1) His lunge is AIMED (traits.hourglassAim): it opens only when the hero stands clear of his body by a stride (centre gap > half his
//      width + 60 px = 188 px), and it carries him to the hero (his leading edge ends 60 px past where the hero stood when he began to
//      brace, so the hero is in front of him, never behind him), capped by the authored
//      460 px. The lane telegraph draws that same length, so the tell stays honest; the direction is still locked at the brace.
//   2) His chase judges "co-elevated" by the feet, so on the same floor its arrival deadband holds and he stops in front of the hero
//      instead of walking through them (a hero on a platform above or below still keeps him walking, as before).
// Other hourglass lungers (Arbiter, Mira, Path's Bane, Stalker, Conductor) and every other chaser are unchanged; no art, calibration or
// frame changes.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('hourglassAim:{ gap:60, reach:60 }')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
const TAG = 'v0.30.1799 sovereign-lunge-dir';

// 1) the trait on the Sovereign
once("hourglassCharge:1500, hourglassEase:true, echoStrike:480 } },",
  "hourglassCharge:1500, hourglassEase:true, hourglassAim:{ gap:60, reach:60 } /* " + TAG + " - per user (\"lunges in the wrong direction\"): his lunge opens only with the hero clear of his body by a stride and ends with the hero at his front, never past them */, echoStrike:480 } },", 'Sovereign traits');
// 2) the lunge's length: the aimed distance while a lunge locked one
once("      const _hgDist = m.traits.hourglassDistance || 460;",
  "      const _hgDist = (m._hgCharging && m._hgAimDist > 0) ? m._hgAimDist : (m.traits.hourglassDistance || 460);   // " + TAG + " - an aimed lunge (traits.hourglassAim) runs the length it locked at its brace", 'hourglass distance');
// 3) the opening gap: past his body by a stride for an aimed lunger (130 px is the hero against a 255 px boss's own edge)
once("          && Math.abs(_hgDx) < 640 && Math.abs(_hgDx) > 130) {",
  "          && Math.abs(_hgDx) < 640 && Math.abs(_hgDx) > (m.traits.hourglassAim ? Math.max(130, m.w / 2 + (m.traits.hourglassAim.gap || 60)) : 130)) {   // " + TAG + " - an aimed lunger needs the hero clear of its body", 'hourglass open gap');
// 4) lock the aimed length with the direction, at the brace
{
  const A = "        m._hgDir = _hgDx > 0 ? 1 : -1;   // locked at brace start — the tell is honest";
  once(A, J(A,
    "        m._hgAimDist = m.traits.hourglassAim ? Math.max(60, Math.min(_hgDist, Math.abs(_hgDx) - m.w / 2 + (m.traits.hourglassAim.reach || 60))) : 0;   // " + TAG + " - his leading edge to just past where the hero stands now, never further (the lane draws this length)"), 'hourglass brace lock');
}
// 5) the lane telegraph draws the locked length
once(J(
  "      const _hpad = Math.ceil(((m.traits.hourglassDistance || 460) / _hgFr) * 1.2);",
  "      const _hdist = (m.traits.hourglassDistance || 460) + _hpad;"), J(
  "      const _hgLen = (m._hgAimDist > 0) ? m._hgAimDist : (m.traits.hourglassDistance || 460);   // " + TAG + " - an aimed lunge's lane is its own length",
  "      const _hpad = Math.ceil((_hgLen / _hgFr) * 1.2);",
  "      const _hdist = _hgLen + _hpad;"), 'hourglass lane');
// 6) the Sovereign's chase: co-elevated by the feet (centre to centre, his 300 px height read the same floor as 128 px apart)
once("    const _coEl = Math.abs(dyA) < 90;",
  "    const _coEl = Math.abs(dyA) < 90 || (m.type === 'towerSovereign' && Math.abs((player.y + player.h) - (m.y + m.h)) < 90);   // " + TAG + " - the same floor by the feet: he stops in front of the hero instead of pacing through them", 'generic chase co-elevation');

const grew = s.length - n0;
if (grew < 900 || grew > 2200) die('size moved ' + grew);
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
console.log('applied: sovereign-lunge-dir (+' + grew + ' chars)');
