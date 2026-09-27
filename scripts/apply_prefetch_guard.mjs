// A map's neighbour prefetch only runs while the player is still on that map (pre-launch fix follow-up, 2026-09-27).
// ============================================================================
// loadMap schedules a prefetch of every map behind the entered map's portals, 3 s after arrival (v0.27.6). The timer
// never checked that the player was still there: walking through a map in under 3 s still warmed ITS neighbours on
// arrival somewhere else. Since lazy-art / lazy-art2 (v0.30.1196 / v0.30.1205) that warm means real downloads - the
// backdrops, boss frames, monster and NPC sheets of maps two steps away that nobody is about to see. Found by
// lazy_art2_test's streamer check (boot on the mushroom map, then forest: mushroom's timer asked for jadeGrove and
// wildflowerPlains). Now the prefetch is skipped when the player has already left.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(?:x|\d+) prefetch-guard/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

once('const _ns = _lxMapNeighbors(id);',
  "if (typeof game !== 'undefined' && game.currentMap !== id) return;   // v0.30.1206 prefetch-guard - the player already left this map: its neighbours are not next any more" + EOL +
  '      const _ns = _lxMapNeighbors(id);', 'the neighbour prefetch');

const grew = s.length - n0;
if (grew < 100 || grew > 400) die('moved ' + grew);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) die('tmp small');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code);
}
console.log('applied: prefetch-guard (+' + grew + ' chars)');
