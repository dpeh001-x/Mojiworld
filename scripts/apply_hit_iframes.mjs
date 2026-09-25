// About 100 ms more immunity after being hit.
// ============================================================================
// Per user: "when being hit, add about 100ms more immunity time".
// There is no single hit function: 37 damage paths each stamp player.lastHitTime and grant their own i-frame window
// (200-2500 ms). Rather than touch every one (and collide with the sessions editing them), the player update adds
// LX_HIT_IFRAME_BONUS_MS once to any FRESH window a hit has just opened - a new lastHitTime within the last two frames
// AND player.invulnerable grew since the previous update. A damage tick that grants no i-frames (a burn, a poison)
// therefore never extends one, and a hit that only tops up a running window (Math.max) adds nothing. It runs before
// each of the four places the window counts down (the normal update and the stunned / frozen / shackled branches).
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) hit-iframes/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const count = (a) => s.split(a).length - 1;

const TICK = 'if (player.invulnerable > 0) player.invulnerable -= dt;';
if (count(TICK) !== 4) die('countdown matched ' + count(TICK) + ', expected 4');
s = s.split(TICK).join('_lxHitIframeBonus(); ' + TICK);

const HELPER = [
  '// v0.30.1053 hit-iframes — about 100 ms more immunity after being hit (per user: "when being hit, add about 100ms more',
  '// immunity time"). Every damage path stamps player.lastHitTime and grants its own window; this adds the bonus once to',
  '// a FRESH window a hit just opened (a new lastHitTime AND invulnerable grew since the last update), so a tick that',
  '// grants no i-frames never extends one. Called before each place the window counts down. See apply_hit_iframes.mjs.',
  'const LX_HIT_IFRAME_BONUS_MS = 100;',
  'function _lxHitIframeBonus() {',
  '  if (typeof player === \'undefined\' || !player) return;',
  '  const inv = player.invulnerable || 0, prev = player._lxInvPrev || 0, hit = player.lastHitTime;',
  '  if (hit !== undefined && hit !== player._lxHitSeen) {',
  '    player._lxHitSeen = hit;',
  '    const recent = typeof game !== \'undefined\' && game && ((game.time | 0) - (hit | 0)) <= 2;',
  '    if (recent && inv > 0 && inv > prev) player.invulnerable = inv + LX_HIT_IFRAME_BONUS_MS;',
  '  }',
  '  player._lxInvPrev = player.invulnerable || 0;',
  '}',
  '',
].join(EOL);
const A = 'function renderLevelUp() {';
if (count(A) !== 1) die('helper anchor matched ' + count(A));
s = s.replace(A, () => HELPER + A);

const grew = s.length - n0;
if (grew < 900 || grew > 2500) die('size moved ' + grew);
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
console.log('applied: hit-iframes (+' + grew + ' chars)');
