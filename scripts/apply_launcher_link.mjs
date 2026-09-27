// Launcher link, game half (pre-launch infra follow-up to v0.30.1180 launch-meta, 2026-09-27). Repo half:
// apply_launcher_link_files.mjs.
// ============================================================================
// launch-meta moved the "Node.js is missing" fallback of Mojiworld.cmd and PLAY_ME_FIRST.txt to the real web address,
// https://play.moji-studios.com/. The third launcher, the Mojiworld.exe stub built from tools/launcher/MojiworldLauncher.cs,
// still offered the old raw.githack developer preview. The files half points it at the same address; this half only
// leaves a marker comment beside the page's own og:url (the one place the game names its public address), so the next
// person who moves that address finds every launcher that repeats it.
// Nothing in the game's behaviour changes. Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(?:x|\d+) launcher-link/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

once('<meta property="og:url" content="https://play.moji-studios.com/">', J(
  '<meta property="og:url" content="https://play.moji-studios.com/">',
  '<!-- v0.30.1208 launcher-link - the same address is the "Node.js is missing" fallback of every Windows launcher: Mojiworld.cmd,',
  '     PLAY_ME_FIRST.txt (scripts/build_portable_zip.mjs) and the Mojiworld.exe stub (tools/launcher/MojiworldLauncher.cs,',
  '     HOSTED). The exe used to offer the raw.githack developer preview. Move them together. -->'), 'the og:url meta');

const grew = s.length - n0;
if (grew < 250 || grew > 700) die('size moved ' + grew);
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
console.log('applied: launcher-link (+' + grew + ' chars)');
