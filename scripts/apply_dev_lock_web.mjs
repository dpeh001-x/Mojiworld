// The dev lock icon is back on the public web, for a tester - still behind its password, still not in the Steam app.
// ============================================================================
// Per user: "can we put back the dev mode with the lock icon for my tester to test".
//
// v0.30.797 made every dev surface local-only: a developer surface is a file:// open, localhost or a LAN address, never
// the packaged Steam app - so on the public link a tester has no lock icon, no ?dev=1, no backtick prompt, nothing.
// Now:
//   1. the lock icon installs on any non-packaged build again (the public web included), exactly as before v0.30.797;
//   2. a browser that has been unlocked with the lock's password (localStorage LX_DEV = '1') counts as a developer
//      surface - so on that browser every dev tool works: the console, ?dev=1, the backtick prompt, the phone's dev
//      button, the developer-only settings rows, the unquiet console.
// Everyone else on the public web is exactly where v0.30.797 left them: a faint lock, and ?dev=1 or the backtick alone
// do nothing. The packaged Steam app still never shows any of it.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) dev-lock-web/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, a, b) => { const c = s.split(a).length - 1; if (c !== 1) { console.error('ABORT ' + label + ': matched ' + c + ', expected 1'); process.exit(1); } s = s.replace(a, b); };

sub('surface note', "// ?dev=1, the lock icon, the typed passphrase, the backtick prompt and the phone's dev button do not exist.",
  J("// ?dev=1, the lock icon, the typed passphrase, the backtick prompt and the phone's dev button do not exist.",
    '// v0.30.894 dev-lock-web - EXCEPT on a browser unlocked with the lock icon\'s password (per user: "put back the dev mode',
    '// with the lock icon for my tester to test"). The lock shows on the public web again (not in the Steam app); once its',
    '// password has been entered, that browser is a developer surface and every tool above works on it. ?dev=1 alone still',
    '// unlocks nothing on the public web.'));
sub('surface', '    if (window.MOJI_PACKAGED === true) return false;',
  J('    if (window.MOJI_PACKAGED === true) return false;',
    "    try { if (localStorage.getItem('LX_DEV') === '1') return true; } catch (e) {}   // v0.30.894 dev-lock-web - unlocked with the lock's password"));
sub('lock icon', '    if (!_lxDevSurface()) return;   // v0.30.797 - no dev icon on a public deploy or in the Steam build',
  "    if (window.MOJI_PACKAGED === true) return;   // v0.30.894 dev-lock-web - the lock is back on the public web for a tester (its password is the gate); never in the Steam app");

const grew = s.length - n0;
if (grew < 400 || grew > 1400) { console.error('ABORT: size moved ' + grew); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000000) { console.error('ABORT: tmp small'); process.exit(1); }
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) { console.error('ABORT: rename kept failing: ' + lastErr.code); process.exit(1); }
}
console.log('applied: dev-lock-web (+' + grew + ' chars)');
