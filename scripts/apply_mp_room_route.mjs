// MP room route: each party / lobby channel gets its own relay Durable Object (v0.30.1225 mp-room-route).
// ============================================================================
// Bug: the co-op relay (mp-cf, since mp-relay v0.30.1198) gives a socket its own room Durable Object when it dials
// wss://<relay>/?room=<room id>, but the game dialled the bare URL and named its room only inside 'hello' - after the
// socket is bound to a DO, and a WebSocket cannot move between DOs. So every party, every lobby channel and every account
// login (PBKDF2, /api) queued on the one 'global' DO: one busy lobby or a burst of logins stalled everyone's co-op.
// Fix (game half): mpConnect dials _mpDialUrl(url, net.roomId) = the relay URL + ?room=<the exact room the hello names>.
// Every room / channel switch, lobby-channel hop, invite join and reconnect is already a fresh mpConnect, so it dials the
// new room's URL. net._lastUrl stays the bare URL (reconnects rebuild the query; nothing doubles it). A relay that does
// not know ?room= ignores it: the live relay until its redeploy, the node relays (mp/, server/: no ws path filter).
// The relay half (scripts/apply_mp_room_route_relay.mjs, LX_APPLY2) keeps "respawn where you logged off" on 'global' for
// every DO, so moving rooms loses or splits no saved position; it needs a wrangler deploy.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _mpDialUrl(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

once('function mpConnect(url, name, room) {', J(
  '// v0.30.1225 mp-room-route - the URL a co-op socket dials: the relay URL plus ?room=<room id>, the exact room its hello names',
  '// (the relay cuts both to 64 characters). The relay gives each room its own Durable Object then - no party, lobby channel',
  '// or login queues behind another on one global DO. A relay that does not know ?room= ignores it.',
  'function _mpDialUrl(url, roomId) {',
  '  try {',
  '    const u = new URL(url);',
  '    if (!/^wss?:$/.test(u.protocol) || !roomId) return url;',
  "    u.searchParams.set('room', String(roomId).slice(0, 64));",
  '    return u.toString();',
  '  } catch (e) { return url; }   // not a URL the page can parse: dial it as given, like before',
  '}',
  'function mpConnect(url, name, room) {'), 'mpConnect');
once('    ws = new WebSocket(url);',
  '    ws = new WebSocket(_mpDialUrl(url, net.roomId));   // v0.30.1225 mp-room-route - ?room=: this room\'s own relay DO (net._lastUrl stays bare)',
  "mpConnect's dial");

const grew = s.length - n0;
if (grew < 700 || grew > 1600) die('size moved ' + grew);
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
console.log('applied: mp-room-route (+' + grew + ' chars)');
