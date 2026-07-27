// Mojiworld — Steam launch-argument parsing (plain Node, no Electron deps, so
// it stays unit-testable — same reasoning as static_server.js).
//
// Two ways a friend's click reaches us through Steam:
//   1. Rich-presence "Join Game"  -> our own connect string is appended to
//      argv verbatim:                    --moji-join=<relayEnc>~<CODE>
//   2. Lobby friend-INVITE accepted -> Steam appends its own launch directive:
//      +connect_lobby <lobbyid64>   (or "+connect_lobby=<id>" on some paths)
//      The lobby id is then resolved back to the party code via lobby data.
'use strict';

// Extract the "--moji-join=..." rich-presence connect string from argv.
function extractJoin(argv) {
  try {
    const a = (argv || []).find((x) => typeof x === 'string' && x.startsWith('--moji-join='));
    return a ? a.slice('--moji-join='.length) : '';
  } catch (e) { return ''; }
}

// Extract the Steam "+connect_lobby <id64>" launch directive from argv.
// Steam usually passes it as TWO tokens; tolerate the one-token "=" form too.
function extractConnectLobby(argv) {
  try {
    const a = argv || [];
    for (let i = 0; i < a.length; i++) {
      const t = String(a[i] == null ? '' : a[i]);
      const eq = /^\+connect_lobby=(\d+)$/.exec(t);
      if (eq) return eq[1];
      if (t === '+connect_lobby' && /^\d+$/.test(String(a[i + 1] == null ? '' : a[i + 1]))) return String(a[i + 1]);
    }
  } catch (e) { /* fall through */ }
  return '';
}

module.exports = { extractJoin, extractConnectLobby };
