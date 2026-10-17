// lock-proof-resync (2026-10-17): the game half - one marker comment by GAME_VERSION. The fix itself is pipeline only.
// ============================================================================
// Stale 0-byte .git/index.lock files (10-15 12:01, 10-17 03:07, 10-17 11:17) kept stopping ship chains in the build
// checkout. Source: the Codex desktop app, open on that checkout, kills its own `git diff <commit>` / `git status`
// runs while they hold the lock. The LX_APPLY2 half (scripts/apply_lock_proof_resync_scripts.mjs) makes the chain's
// re-sync index-free (scripts/_ship_resync.sh), adds a one-fetch prefetch and a safe stale-lock reaper, and stops the
// SessionStart hook's status from taking the lock. Nothing in the game's code changes: this marks the version line
// every chain bumps and points at the proof (scripts/lock_proof_resync_test.mjs).
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('LOCK-PROOF RE-SYNC')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

{
  const A = EOL + "const GAME_VERSION = 'v0.30.";
  once(A, EOL + J(
    '// v0.30.1830 lock-proof-resync - LOCK-PROOF RE-SYNC (build tooling only, no game change). Ship chains bump the line',
    '// below; their re-sync no longer touches the shared git index, so a stale .git/index.lock (the Codex app leaves one',
    '// when it kills its own git diff mid-refresh) can neither stop nor spoil a ship. Proof: scripts/lock_proof_resync_test.mjs.',
    "const GAME_VERSION = 'v0.30."), 'GAME_VERSION line');
}

const grew = s.length - n0;
if (grew < 250 || grew > 900) die('size moved ' + grew);
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
console.log('applied: lock-proof-resync (+' + grew + ' chars)');
