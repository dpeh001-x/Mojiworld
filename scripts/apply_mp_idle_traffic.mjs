// Co-op idle traffic (mp-idle-traffic): stop sending the same presence frame 14 times a second.
// ============================================================================
// _mpTick sent a full 'state' frame every 70 ms whether anything had changed or not - standing in town, sitting in a
// menu, or in a hidden tab (the 500 ms lifeline kept it going). With the ping carrier every 2.5 s that is ~14.7 frames/s
// per connected player, all day: on the Cloudflare relay every inbound message is billed (20:1) and the Free plan's
// 100k requests/day lasted about 1.6 player-days.
// Now the state frame is gated, nothing else (the host's monster frames, combat events, chat, emotes and pings go out
// exactly as before):
//   * a frame that differs from the last one sent goes out at once (moving, jumping, a hit, a gear swap...);
//   * the first repeat after a change is still sent, so every receiver marks the player as standing still (its
//     "peer-statue" check) and stops dead-reckoning - a player pushing against a wall does not drift into it;
//   * then only a heartbeat: every 1.25 s when idle on the ground, every 2 s while paused or in a hidden tab (a change
//     made while parked in a menu waits for that beat), and every 200 ms where a receiver would move a silent player:
//     off the ground, or on a spot where its platform guess is wrong (below).
// The receivers' 400 ms "stall settle" (_mpDrawPeers) was written for a peer frozen MID-JUMP by packet loss: it drops a
// silent peer onto the platform it guesses is under it (_mpPeerRestY). At 14 frames/s it never met a standing peer; with
// a heartbeat it would, and the guess is wrong on some spots (probe: 0 of 25 spots in town, 5 of 25 in the Mushroom map
// by up to 240 px, 1 in the underpass lobby by 140 px) - an idle partner would drop through the floor on every beat.
// So the SENDER runs the same guess (unchanged since v0.29.x, older builds guess alike) and keeps a 200 ms beat (under 400 ms even at a low frame rate) where it
// is off, which covers partners on older builds too; and new receivers skip the settle for a peer standing still.
// Timeouts need no change: 5 s (host gone), 6 s (partner alive), 15 s (party bonus), 30 s (dropped) - all well above
// the 2 s beat, and the 2.5 s ping refreshes them too. Works with the old and the new relay (no new wire fields).
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _mpStateDue(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

once('function _mpTick() {', J(
  '// v0.30.1199 mp-idle-traffic - is a presence (\'state\') frame due this tick? A change goes out at once, then one repeat (so',
  '// receivers mark the player still and stop dead-reckoning), then only a heartbeat: 1.25 s idle on the ground, 2 s paused or',
  '// hidden (a change made while parked waits for the beat), 200 ms where receivers would move a silent player (they settle',
  '// a peer silent for 400 ms onto the platform _mpPeerRestY guesses). Receivers time a peer out at 5 s at the earliest.',
  'const LX_MP_IDLE_HB_MS = 1250, LX_MP_STILL_HB_MS = 2000, LX_MP_AIR_HB_MS = 200;',
  'function _mpHoldBeat(p) {   // off the ground, or standing where a receiver\'s platform guess would move me',
  '  if (!p.onGround) return true;',
  "  try { const ry = (typeof _mpPeerRestY === 'function') ? _mpPeerRestY(p.x, p.y) : null; return ry != null && ry > p.y - 4 && Math.abs(ry - p.y) > 0.5; } catch (e) { return false; }",
  '}',
  'function _mpStateDue(still, now, avStr) {',
  '  const p = player;',
  "  const anim = still ? 'idle' : (p.attacking ? 'attack' : (Math.abs(p.vx) > 0.5 ? 'run' : 'idle'));",
  '  const sig = [Math.round(p.x * 10), Math.round(p.y * 10), still ? 0 : Math.round((p.vx || 0) * 100), still ? 0 : Math.round((p.vy || 0) * 100),',
  "    p.facing, game.currentMap, Math.round(p.hp || 0), (typeof getMaxHp === 'function') ? getMaxHp() : p.maxHp, Math.round(p.mp || 0),",
  "    (typeof getMaxMp === 'function') ? getMaxMp() : p.maxMp, p.level, p.cls, p.job, p.master, anim, avStr].join('|');",
  '  const gap = now - (net._stAt || 0), same = sig === net._stSig;',
  '  let due;',
  '  if (!same) due = !(still && net._stStill && net._stSame > 0 && gap < LX_MP_STILL_HB_MS && !_mpHoldBeat(p));',
  '  else if (!(net._stSame > 0)) due = true;',
  '  else due = gap >= LX_MP_AIR_HB_MS && (gap >= (still ? LX_MP_STILL_HB_MS : LX_MP_IDLE_HB_MS) || _mpHoldBeat(p));',
  '  if (due) { net._stSame = same ? (net._stSame | 0) + 1 : 0; net._stSig = sig; net._stAt = now; net._stStill = still; net._stSent = (net._stSent | 0) + 1; }',
  '  return due;',
  '}',
  'function _mpTick() {'), '_mpTick');

once(J("  const _still = !!(game.paused || (typeof document !== 'undefined' && document.hidden));",
       '  try {',
       '    net.ws.send(JSON.stringify({',
       "      t: 'state',"), J(
  "  const _still = !!(game.paused || (typeof document !== 'undefined' && document.hidden));",
  '  // v0.30.1199 mp-idle-traffic - only when something changed, or its heartbeat is due (see _mpStateDue); the rest of the tick runs as before',
  '  if (_mpStateDue(_still, now, _avStr)) try {',
  '    net.ws.send(JSON.stringify({',
  "      t: 'state',"), 'the state send');

once('    if (p._snapAt && _ageMs > 400 && !p._downed && _restY != null && _restY > (p.y || 0) - 4) {', J(
  '    // v0.30.1199 mp-idle-traffic - not for a peer standing still: its snapshot IS where it stands (a heartbeat 1-2 s apart',
  '    // would otherwise drop it onto the guessed platform - a few px off on some maps - on every beat)',
  '    if (p._snapAt && _ageMs > 400 && !_stillPeer && !p._downed && _restY != null && _restY > (p.y || 0) - 4) {'), "the peers' stall settle");

const grew = s.length - n0;
if (grew < 2000 || grew > 4000) die('size moved ' + grew);
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
console.log('applied: mp-idle-traffic (+' + grew + ' chars)');
