// Arrivals: no portal sets you down on another portal, and no boss arena keeps you in (world audit, 2026-09-26).
// ============================================================================
// Found by the pre-launch world audit, which walked every portal through the real tryPortal():
//   1) EVERDAWN CENTRAL FROM THE VOID. When the destination has no door leading back to the map you came from, tryPortal
//      set you down at a flat x = 100. In town that is inside the Bastion door's 50 px trigger (x = 153), so the first
//      Up press (Up is also climb) sent you on to The Bastion. Every new game and every death respawn walks in from the
//      Void, and the Clockwork Spire's abandon door and the Inner Dimension land the same way.
//   2) THE HALL OF ECHOES. Interdimensional Ascension -> boss_rush used the same x = 100, inside the trigger of the hall's
//      only exit (x = 90, to the Void): one Up press threw you out before the rush began.
//   3) THE SINGULARITY. Its only exit (to the Zodiac Sanctum) carried a hard Lv-70 gate, while the way in only warns (entering
//      a boss arena is never hard-gated, Confused Vigil excepted). A player under 70 who walked in could not walk out.
// Now: 1) + 2) the fallback arrival is the nearest spot to x = 100 whose centre clears every door's trigger on the
// destination (looking into the map first); paired doors (town <-> forest and the rest) are untouched. 3) a level gate
// never applies to a door that leads OUT of a boss arena to an ordinary map - you can always leave an arena you are in.
// The Barnaby gate (a boss arena's door INTO Confused Vigil) is unchanged.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxClearArrivalX(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// 1) + 2) the helper, ahead of tryPortal
once(J('function tryPortal() {', '  if (_lxPlayerHeld()) return false;'), J(
  '// v0.30.1175 arrivals - WHERE A HERO LANDS WHEN THE DESTINATION HAS NO DOOR BACK to the map they left. tryPortal used a flat',
  '// x = 100: in Everdawn Central that is inside the Bastion door\'s trigger (every new game and every respawn walks in from the',
  '// Void), and in the Hall of Echoes inside its only exit - one Up press (Up is also climb) and you were through it. Now the',
  '// nearest spot to the preferred x whose centre clears every door on the map by the trigger (50 px) plus a margin, searching',
  '// into the map first. The margin also covers loadMap\'s portal spacer, which may nudge a door a little after this runs.',
  'function _lxClearArrivalX(destMap, prefX) {',
  "  const pw = (typeof player !== 'undefined' && player && player.w) || 28;",
  '  const ww = (destMap && destMap.worldWidth) || 2000;',
  '  const lo = 8, hi = ww - pw - 8, CLEAR = 50 + 26;',
  "  const doors = ((destMap && destMap.portals) || []).map((p) => p && p.x).filter((x) => typeof x === 'number' && isFinite(x));",
  '  const clear = (x) => doors.every((dx) => Math.abs(x + pw / 2 - dx) >= CLEAR);',
  '  const inward = prefX < ww / 2 ? 1 : -1;',
  '  for (const dir of [inward, -inward]) {',
  '    for (let d = 0; d <= ww; d += 8) {',
  '      const x = prefX + dir * d;',
  '      if (x < lo || x > hi) break;',
  '      if (clear(x)) return x;',
  '    }',
  '  }',
  '  return prefX;   // v0.30.1175 arrivals - a map packed with doors end to end: keep the old spot',
  '}',
  'function tryPortal() {', '  if (_lxPlayerHeld()) return false;'), 'tryPortal head');

// 1) + 2) the fallback arrival x
once(J('        ? (backPortal.x + (backPortal.x < destMap.worldWidth / 2 ? _entryOffset : -_entryOffset))', '        : 100;'), J(
  '        ? (backPortal.x + (backPortal.x < destMap.worldWidth / 2 ? _entryOffset : -_entryOffset))',
  '        : _lxClearArrivalX(destMap, 100);   // v0.30.1175 arrivals - was a flat 100, inside the Bastion door / the Hall of Echoes exit'),
  'the no-back-door fallback');

// 3) a gate never keeps you inside a boss arena
once(J("      const _hardGateBoss = (po.dest === 'confusedVigil');",
  '      if (po.levelGate && (player.level || 0) < po.levelGate && (_hardGateBoss || !(dest && dest.isBossArena))) {'), J(
  "      const _hardGateBoss = (po.dest === 'confusedVigil');",
  '      // v0.30.1175 arrivals - NO GATE ON THE WAY OUT OF A BOSS ARENA. The way into an arena only warns (the next line;',
  '      // Confused Vigil excepted), so a gate on the exit trapped an under-levelled player: the Singularity\'s only door (to',
  '      // the Zodiac Sanctum, Lv 70) refused anyone under 70 who had walked in. A door from an arena to an ORDINARY map is',
  '      // open to all; a door into another arena (Sundered Forge -> Confused Vigil) keeps its gate.',
  '      const _arenaExit = !!(MAPS[game.currentMap] && MAPS[game.currentMap].isBossArena) && !(dest && dest.isBossArena);',
  '      if (po.levelGate && !_arenaExit && (player.level || 0) < po.levelGate && (_hardGateBoss || !(dest && dest.isBossArena))) {'),
  'the level-gate check');

const grew = s.length - n0;
if (grew < 1500 || grew > 4500) die('size moved ' + grew);
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
console.log('applied: arrivals (+' + grew + ' chars)');
