// Taxi rides into a tower set you down at its base, not a few jumps from the summit (bug hunt, 2026-09-26).
// ============================================================================
// Both taxi routes - the Taxi Uncle's panel and the world map's "back to" row - called loadMap(id, 200) and then
// overwrote the position with a fixed x=200, y=400. loadMap had already placed the player properly (for an
// isVerticalTower map: on the ground floor, spawnY = ground - 80), and the fixed y=400 put them near the TOP of a
// 14,400-px tower instead: Frozen Peak and Interdimensional Ascension dropped you ~13,600 px above the base, a few
// jumps from the summit portals (Stardust Atrium; Zodiac Hall -> the zodiac arenas and Gravitos), skipping the whole
// climb; Honeycomb Hollow landed you at y 556 over an 1800 floor. The override goes; loadMap's placement stands.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) taxi-tower/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
const NEW = '      player.vx = 0; player.vy = 0;   // v0.30.1135 taxi-tower - loadMap already set you down (a tower: at its BASE); the fixed y=400 that used to follow dropped you near a 14,400-px tower\'s summit';
once(J('      if (typeof loadMap === \'function\') loadMap(id, 200);', '      player.x = 200; player.y = 400; player.vx = 0; player.vy = 0;', "      showToast('The Taxi Uncle drops you at ' + (m.name || id) + '!', 'epic');"),
  J('      if (typeof loadMap === \'function\') loadMap(id, 200);', NEW, "      showToast('The Taxi Uncle drops you at ' + (m.name || id) + '!', 'epic');"), 'the world map "back to" taxi');
once(J('      if (typeof loadMap === \'function\') loadMap(id, 200);', '      player.x = 200; player.y = 400; player.vx = 0; player.vy = 0;', '      showToast(`Arrived at ${m.name}!`, \'epic\');'),
  J('      if (typeof loadMap === \'function\') loadMap(id, 200);', NEW, '      showToast(`Arrived at ${m.name}!`, \'epic\');'), 'the taxi panel');
const grew = s.length - n0;
if (grew < 150 || grew > 700) die('size moved ' + grew);
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
console.log('applied: taxi-tower (+' + grew + ' chars)');
