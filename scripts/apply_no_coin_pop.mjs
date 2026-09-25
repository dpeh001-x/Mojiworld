// No more "+N" Mojicoin text over the character on a coin pickup.
// ============================================================================
// Per user: "To reduce lag can also omit and not show the gain in mojicoin on the character". Picking up a coin drop
// pushed a yellow "+N" text particle at the drop (under the character): one text raster per pickup, and a coin
// shower is dozens at once. The particle is gone; the coins are still granted, the pickup sound still plays, and
// pickups worth 50+ still show their pill in the coin toast column, exactly as before.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) no-coin-pop/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const count = (a) => s.split(a).length - 1;
const A = [
  '          game.particles.push({ x:d.x, y:d.y, vx:0, vy:-2, life:30,',
  "            color:'#ffdd44', size:3, text:'+' + _granted });",
].join(EOL);
if (count(A) !== 1) die('coin particle matched ' + count(A));
s = s.replace(A, () => "          // v0.30.x no-coin-pop — no \"+N\" text over the character (per user: \"To reduce lag can also omit and not show the gain in" + EOL +
  "          // mojicoin on the character\"); the grant, the sound and the 50+ toast below are unchanged.");
const grew = s.length - n0;
if (grew < -200 || grew > 400) die('size moved ' + grew);
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
console.log('applied: no-coin-pop (' + grew + ' chars)');
