// Co-op relay launch hardening, the game's half (mp-relay): "that party is full" instead of "connection lost", and a
// full PUBLIC lobby channel hands the player on to the next channel.
// ============================================================================
// The relay now caps rooms (scripts/apply_mp_relay.mjs): 5 players per party code (LX_PARTY_MAX_ALLIES 4 + you) and 50
// per public lobby channel (lobby__ch1..5 - where the Multi window lands when no code is typed; everybody starts on
// Channel 1 unless they tap another pill). A refused player gets { t:'error', code:'room_full', message } and the socket
// closes - the frame the Node relay (server/server.js) has sent at its own cap for a long time. The game printed that
// frame into the co-op chat log only; the close looked like a dropped line, so the banner read "Co-op connection lost -
// reconnecting..." and the game re-dialled the full room 10 times over ~105 s before "Could not reconnect to your
// party." Nothing on screen said why, and a full lobby channel would strand everybody who defaults to it.
// Now a room_full frame stops the reconnect loop at once, and:
//   * in the public lobby the player moves on to the next channel by itself (each channel tried once, starting from
//     theirs; the channel pill follows), and only when all five are full does the banner say so;
//   * with a party code there is no hop (friends must stay on one channel): the banner says the party is full, with a
//     Retry button for when a slot frees up.
// Every other error frame behaves as before. Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes("msg.code === 'room_full'")) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

once(J("    case 'error':",
       "      _mpPushLog('[server] ' + escapeHtml(msg.message || msg.code || 'error'), 'sys');",
       '      break;'), J(
  "    case 'error':",
  "      _mpPushLog('[server] ' + escapeHtml(msg.message || msg.code || 'error'), 'sys');",
  '      // v0.30.1198 mp-relay - a full room is an answer, not a dropped line: the relay closes the socket right after this',
  '      // frame, and re-dialling it (10 tries over ~105 s under "connection lost - reconnecting") cannot help.',
  "      if (msg.code === 'room_full') {",
  '        net._userClosed = true;',
  '        if (net._reconnectTimer) { clearTimeout(net._reconnectTimer); net._reconnectTimer = null; }',
  '        net._reconnectTries = 0;',
  '        const _fullCh = _clampChannel(net.channel || 1);',
  '        // v0.30.1198 mp-relay - the public lobby: move on to the next channel by itself, each channel once (starting from',
  '        // where this run began). A party code never hops - friends would end up on different channels.',
  "        if (net.baseRoom === 'lobby') {",
  '          const _hop = net._fullHop, _from = (_hop && Date.now() - _hop.at < 30000) ? _hop.from : _fullCh;',
  '          const _next = (_fullCh % CHANNEL_COUNT) + 1;',
  '          if (_next !== _from) {',
  '            net._fullHop = { from: _from, at: Date.now() };',
  '            if (typeof player !== \'undefined\' && player) player.channel = _next;',
  '            try { localStorage.setItem(MP_CHANNEL_KEY, String(_next)); } catch (e) {}',
  "            try { if (typeof _renderChannelPills === 'function') _renderChannelPills(_next); } catch (e) {}",
  "            _mpBanner('Lobby channel ' + _fullCh + ' is full - trying channel ' + _next + '...', 'work', { dismiss: false });",
  '            const _u = net._lastUrl, _n = net._lastName, _r = net._lastRoom;',
  '            net._reconnectTimer = setTimeout(() => { net._reconnectTimer = null; mpConnect(_u, _n, _r); }, 300);',
  '            break;',
  '          }',
  '          net._fullHop = null;',
  '        }',
  "        const _fullWhat = net.baseRoom === 'lobby' ? 'Every lobby channel is full - try again soon, or play with a party code.'",
  "          : 'Party ' + String(net.baseRoom || net.roomId || '').toUpperCase() + ' (Ch ' + _fullCh + ') is full - try another channel or party code.';",
  "        _mpStatus(_fullWhat, '#ff8888');",
  "        _mpBanner(_fullWhat, 'bad', { retry: () => mpConnect(net._lastUrl, net._lastName, net._lastRoom) });",
  '      }',
  '      break;'), "_mpHandle's error case");

const grew = s.length - n0;
if (grew < 1500 || grew > 3500) die('size moved ' + grew);
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
console.log('applied: mp-relay game (+' + grew + ' chars)');
