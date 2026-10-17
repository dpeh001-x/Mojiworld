// resync-guard (2026-10-17): the game half - one marker comment at the edge-table reader. The fix itself is data + pipeline.
// ============================================================================
// A stale 0-byte .git/index.lock silently disabled scripts/_ship_change.sh's LX_EXTRA re-sync for ~2 days, so ships
// row-patched stale working-copy tables. The audit found one reverting ship, v0.30.1786; among what it reverted, the Pisces
// swing rows of data/sprite_edges.js are still wrong on origin (nine frames missing, so they probe live; the still frame
// carrying the OLD purple wave's cut edges, so the pearl comet was feathered as if sliced). The LX_APPLY2 half
// (scripts/apply_resync_guard_data.mjs) restores those rows and the two lost sw.js notes, and hardens the pipeline
// (scripts/_ship_resync.sh). Nothing in the game's code changes: this marks where the table is read and points at the
// proof (scripts/resync_guard_test.mjs compares the rows with live probes of the shipped art).
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('ROWS A STALE SHIP REVERTED')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

{
  const A = 'function _lxEdgesFromTable(img) {';
  once(A, J(
    '// v0.30.1826 resync-guard - ROWS A STALE SHIP REVERTED. v0.30.1786 shipped data/sprite_edges.js from a working copy its',
    '// re-sync had silently failed to refresh: the Pisces swing\'s nine anim frames lost their rows (unknown = probed live) and',
    '// its still frame got the old purple wave\'s cut edges back (the pearl comet was feathered as if sliced). Restored to',
    '// the values v0.30.1785 measured on that art; scripts/resync_guard_test.mjs re-proves them against live probes, and',
    '// scripts/_ship_change.sh now stops a chain whose re-sync fails (scripts/_ship_resync.sh) instead of shipping stale rows.',
    A), '_lxEdgesFromTable');
}

const grew = s.length - n0;
if (grew < 400 || grew > 1200) die('size moved ' + grew);
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
console.log('applied: resync-guard (+' + grew + ' chars)');
