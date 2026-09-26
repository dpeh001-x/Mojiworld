// Dash skills reach tall enemies: Flurry, Dimensional Warp, Rush's flame bursts and the Smoke Dash cloud (combat audit #1, 2026-09-26).
// ============================================================================
// Bug: four skills decided "is this enemy at my height?" by comparing ONE point of the enemy with the player's:
//   - Flurry's slash corridor: the enemy's CENTRE within 70 px of the corridor line;
//   - Dimensional Warp (blink): the enemy's CENTRE inside the 50 px tall band around the warp path (+-25 px);
//   - Rush's five flame bursts: the enemy's TOP within 60 px of the player's top;
//   - Smoke Dash's lingering cloud (3 ticks): the enemy's TOP within 80 px of the player's top.
// That only works for enemies about the player's height (44 px). A boss standing on the player's floor has its centre
// 93-150 px and its top 186-300 px above the player's, so Flurry and Warp did NOTHING to King Gloopaloo, Mooma or King Krook,
// Rush landed only its body hit (1 of 6), and the smoke cloud never ticked on them. Same for every ordinary monster taller
// than ~95 px (Warp), ~105 px (Rush), ~125 px (cloud) or ~185 px (Flurry) - 56 of the 122 monster types are over 94 px.
// Fix: the enemy's whole BOX must cross a vertical band (m.y < bot && m.y + m.h > top). The band is the old window narrowed
// by the player's own height, so a player-sized enemy is hit exactly as before and a small one on a platform above or below
// is still out of reach, while a tall one standing on the player's floor is hit. Horizontal tests are untouched.
// One helper (_lxBodyInBand) + four one-line call-site swaps. Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxBodyInBand(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// the shared test, ahead of castSkill (every skill body below runs after it is defined)
once('function castSkill(id) {', J(
  '// v0.30.1178 dash-hitbox - DOES THE ENEMY\'S BODY REACH THE BAND. Flurry, Dimensional Warp, Rush\'s flame bursts and the Smoke',
  '// Dash cloud measured ONE point of the enemy (its centre or its top) against the player\'s, within 25-80 px. That only works',
  '// for enemies about the player\'s height: a boss on the player\'s floor has its centre 93+ px and its top 186+ px above the',
  '// player\'s, so the four skills passed straight through King Gloopaloo, Mooma or King Krook (and any monster taller than',
  '// ~95-185 px). Now the enemy\'s whole box must cross a vertical band [top, bot] (world y, down is +). Each caller passes the',
  '// old window narrowed by the player\'s own height, so a player-sized enemy is hit exactly as before and a small one on a',
  '// platform above or below is still out of reach, while a tall one standing on the player\'s floor is hit.',
  'function _lxBodyInBand(m, top, bot) { return m.y < bot && m.y + m.h > top; }',
  'function castSkill(id) {'), 'castSkill signature');

// Flurry: centre within corridorH (70) of the corridor line -> body crosses the line +-(70 - half the player's height)
once('        if (Math.abs((m.y + m.h / 2) - (ay + by) / 2) > corridorH) continue;', J(
  '        // v0.30.1178 dash-hitbox - body in the band, not centre distance (a boss\'s centre sits 93+ px above the corridor line)',
  '        if (!_lxBodyInBand(m, (ay + by) / 2 - corridorH + player.h / 2, (ay + by) / 2 + corridorH - player.h / 2)) continue;'),
  'Flurry slashCorridor vertical test');

// Dimensional Warp: centre inside [top, bot] -> body crosses [top, bot] narrowed by half the player's height (both warp modes)
once('      if (mcy < top || mcy > bot) continue;', J(
  '      // v0.30.1178 dash-hitbox - body in the band, not centre in the rect (any monster over ~94 px tall was never hit)',
  '      if (!_lxBodyInBand(m, top + player.h / 2, bot - player.h / 2)) continue;'),
  'Dimensional Warp vertical test');

// Rush flame bursts: top within 60 of the player's top -> feet at most 60 above the player's feet, top at most 60 below the player's top
once('if (Math.abs((m.x + m.w/2) - cx) < _rushReach && Math.abs(m.y - player.y) < 60) {',
  'if (Math.abs((m.x + m.w/2) - cx) < _rushReach && _lxBodyInBand(m, player.y + player.h - 60, player.y + 60)) {   // v0.30.1178 dash-hitbox - body in the band (a tall enemy\'s top is far above the player\'s)',
  'Rush flame-burst vertical test');

// Smoke Dash cloud: the same, with its 80 px window
once('if (Math.abs((m.x + m.w/2) - cloudX) < 90 && Math.abs(m.y - player.y) < 80) {',
  'if (Math.abs((m.x + m.w/2) - cloudX) < 90 && _lxBodyInBand(m, player.y + player.h - 80, player.y + 80)) {   // v0.30.1178 dash-hitbox - body in the band (a tall enemy\'s top is far above the player\'s)',
  'Smoke Dash cloud vertical test');

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
console.log('applied: dash-hitbox (+' + grew + ' chars)');
