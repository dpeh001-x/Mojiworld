// Dash skills reach WIDE enemies: Flurry, Dimensional Warp (both modes), Rush's flame bursts and Smoke Dash (follow-up to
// v0.30.1178 dash-hitbox, which fixed the same skills vertically).
// ============================================================================
// Bug: the SIDEWAYS test in each of these skills still measured the enemy's CENTRE against the skill's reach:
//   - Flurry's slash corridor: the centre within 16 px of the blink path;
//   - Dimensional Warp: the centre within 50 px of the swept path - and in the UP warp, within +-25 px of the player's centre;
//   - Rush's five flame bursts: the centre within 60-100 px of the player's centre;
//   - Smoke Dash: the dash corridor, the centre within 20 px of the path; the lingering cloud, the centre within 90 px.
// That only works for enemies about the player's width (28 px). A boss is 150-400 px wide, so his centre sits far from
// his near edge: King Krook standing 140 px in front of a horizontal Warp was missed while the warp's band covered his
// body, the up Warp only hit a boss if the player stood at his exact middle, and Rush's bursts missed a boss the player
// was running into.
// Fix: the enemy's whole BOX must cross the skill's horizontal span (m.x < right && m.x + m.w > left), the same way
// _lxBodyInBand does vertically. Each span is the old centre window narrowed by half the player's width on each side, so a
// player-sized enemy is hit exactly as before (and a small one outside the reach is still missed), while a wide one is
// hit as soon as his body reaches the band. The reach numbers are unchanged.
// One helper (_lxBodyInSpan) + five one-line call-site swaps. Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxBodyInSpan(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// the sideways twin of _lxBodyInBand, right after it
once('function _lxBodyInBand(m, top, bot) { return m.y < bot && m.y + m.h > top; }', J(
  'function _lxBodyInBand(m, top, bot) { return m.y < bot && m.y + m.h > top; }',
  '// v0.30.1215 dash-wide - DOES THE ENEMY\'S BODY REACH THE SPAN - the sideways twin of _lxBodyInBand. The same four skills still',
  '// measured the enemy\'s CENTRE against their horizontal reach, so a boss (150-400 px wide) was missed while the skill\'s band',
  '// covered half his body, and the up Warp hit him only with the player at his exact middle. Now the box must cross [left, right]',
  '// (world x). Each caller passes its old centre window narrowed by half the player\'s width on each side: a player-sized enemy',
  '// is hit exactly as before, a small one outside the reach is still missed, a wide one is hit once his body is in the band.',
  'function _lxBodyInSpan(m, left, right) { return m.x < right && m.x + m.w > left; }'), '_lxBodyInBand definition');

// Rush flame bursts: centre within _rushReach of the player's centre
once('if (Math.abs((m.x + m.w/2) - cx) < _rushReach && _lxBodyInBand(',
  'if (_lxBodyInSpan(m, cx - _rushReach + player.w / 2, cx + _rushReach - player.w / 2) /* v0.30.1215 dash-wide - body in the span, not the centre */ && _lxBodyInBand(',
  'Rush flame-burst sideways test');

// Smoke Dash cloud: centre within 90 of the cloud
once('if (Math.abs((m.x + m.w/2) - cloudX) < 90 && _lxBodyInBand(',
  'if (_lxBodyInSpan(m, cloudX - 90 + player.w / 2, cloudX + 90 - player.w / 2) /* v0.30.1215 dash-wide - body in the span, not the centre */ && _lxBodyInBand(',
  'Smoke Dash cloud sideways test');

// Smoke Dash dash corridor: centre within 20 of the path
once('      if (mid > a - 20 && mid < b + 20) {',
  '      if (_lxBodyInSpan(m, a - 20 + player.w / 2, b + 20 - player.w / 2)) {   // v0.30.1215 dash-wide - body in the span, not the centre',
  'Smoke Dash corridor sideways test');

// Flurry: centre within 16 of the corridor
once('        if (mid < lo - 16 || mid > hi + 16) continue;',
  '        if (!_lxBodyInSpan(m, lo - 16 + player.w / 2, hi + 16 - player.w / 2)) continue;   // v0.30.1215 dash-wide - body in the span, not the centre',
  'Flurry slashCorridor sideways test');

// Dimensional Warp: centre inside [lo, hi] (the sideways warp's swept path + 50, the up warp's +-25 column)
once('      if (mcx < lo || mcx > hi) continue;',
  '      if (!_lxBodyInSpan(m, lo + player.w / 2, hi - player.w / 2)) continue;   // v0.30.1215 dash-wide - body in the span (the up warp hit a boss only at his exact middle)',
  'Dimensional Warp sideways test');

const grew = s.length - n0;
if (grew < 900 || grew > 3500) die('size moved ' + grew);
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
console.log('applied: dash-wide (+' + grew + ' chars)');
