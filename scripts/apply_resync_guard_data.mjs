// LX_APPLY2 half of resync-guard (2026-10-17): undo the rows a stale re-sync reverted, and stop it happening again.
// ============================================================================
// A stale 0-byte .git/index.lock (2026-10-15 12:01) made every `git checkout TIP -- <path>` in _ship_change.sh's
// LX_EXTRA re-sync fail silently, so chains row-patched stale working-copy tables and shipped them. An audit of all
// 66 ships since (every data/script file, record by record, traced back to 2026-10-08) found ONE reverting ship,
// v0.30.1786 (arbiter-regen). The Sundered Smith rows it reverted were restored by 1607c56ee; what is left:
//  1. data/sprite_edges.js - v0.30.1785 measured the new Pisces swing art (a pearl comet, fx/swing_zodiac_pisces.webp
//     and anim/swing_zodiac_pisces_0..8) as clean on every edge (""). v0.30.1786 dropped the nine anim rows and set
//     the base row BACK to the old purple wave's "6:42:47|14:18:31||", so the game feathered the comet's left and right
//     edges as if they were cut. The art has not changed since v0.30.1785, so its values go back.
//  2. sw.js - the cache-bump notes of v0.30.1782 and v0.30.1785 were deleted; put back (CACHE itself is fine: v175 now).
//  3. scripts/_ship_change.sh - the re-sync stops the chain when a checkout fails (scripts/_ship_resync.sh says why,
//     including a stale index.lock and its age), proves every re-synced path with `git hash-object` == origin's blob
//     before either apply runs, and the confirming test's whole output goes to a log whose path is printed on failure.
// Per file: guarded, atomic, idempotent, EOL-aware. LX_REPO points it at a scratch copy for dry runs.
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import vm from 'node:vm';
const ROOT = process.env.LX_REPO || 'C:/Users/dpeh0/Mojiworld';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const eolOf = (s) => ((s.match(/\r\n/g) || []).length > (s.match(/\n/g) || []).length / 2 ? '\r\n' : '\n');
const put = (rel, s, check) => {   // atomic tmp + check + rename (EPERM/EBUSY retry)
  const F = path.join(ROOT, rel);
  writeFileSync(F + '.tmp', s, 'utf8');
  if (readFileSync(F + '.tmp', 'utf8') !== s) die(rel + ': tmp readback differs');
  check(F + '.tmp');
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die(rel + ': rename kept failing: ' + lastErr.code);
};
const bounds = (rel, grew, lo, hi) => { if (grew < lo || grew > hi) die(rel + ': size moved ' + grew); };
let changed = 0;

// ---- 1. data/sprite_edges.js ------------------------------------------------
{
  const REL = 'data/sprite_edges.js', MARK = 'window.LX_SPRITE_EDGES = ';
  const s = readFileSync(path.join(ROOT, REL), 'utf8'), EOL = eolOf(s);
  if (s.split(MARK).length !== 2) die(REL + ': assignment anchor');
  const i = s.indexOf(MARK) + MARK.length, j = s.indexOf(';' + EOL, i);
  if (j < 0) die(REL + ': payload end');
  const pay = s.slice(i, j), T = JSON.parse(pay);
  const keys = Object.keys(T);
  if (JSON.stringify(T) !== pay || keys.some((k, n) => n && keys[n - 1] > k)) die(REL + ': not the generator\'s sorted compact form');
  const BASE = 'fx/swing_zodiac_pisces.webp', OLD = '6:42:47|14:18:31||';
  const WANT = { [BASE]: '' };
  for (let f = 0; f <= 8; f++) WANT['fx/anim/swing_zodiac_pisces_' + f + '.webp'] = '';
  if (Object.keys(WANT).every((k) => T[k] === WANT[k])) console.log(REL + ': already applied');
  else {
    if (T[BASE] !== OLD && T[BASE] !== '') die(REL + ': ' + BASE + ' is ' + JSON.stringify(T[BASE]) + ' - someone re-measured it, re-audit');
    for (const k of Object.keys(WANT)) if (k !== BASE && T[k] !== undefined && T[k] !== '') die(REL + ': ' + k + ' is ' + JSON.stringify(T[k]));
    const N = Object.assign({}, T, WANT), out = {};
    for (const k of Object.keys(N).sort()) out[k] = N[k];   // gen_sprite_edges.mjs writes files.sort() order
    const s2 = s.slice(0, i) + JSON.stringify(out) + s.slice(j);
    bounds(REL, s2.length - s.length, 300, 700);
    put(REL, s2, (tmp) => {
      const w = {}; vm.runInNewContext(readFileSync(tmp, 'utf8'), { window: w });
      const t2 = w.LX_SPRITE_EDGES, k2 = Object.keys(t2);
      const moved = k2.filter((k) => t2[k] !== T[k]);
      if (k2.length !== keys.length + Object.keys(WANT).filter((k) => T[k] === undefined).length) die(REL + ': key count');
      if (moved.some((k) => !(k in WANT)) || keys.some((k) => !(k in t2))) die(REL + ': touched a row it should not: ' + moved.join(','));
    });
    changed++; console.log(REL + ': Pisces swing rows restored (' + Object.keys(WANT).length + ')');
  }
}

// ---- 2. sw.js -------------------------------------------------------------------
{
  const REL = 'sw.js', s = readFileSync(path.join(ROOT, REL), 'utf8'), EOL = eolOf(s);
  if (s.includes('resync-guard')) console.log(REL + ': already applied');
  else {
    const A = '// arbiter-regen - v171 -> v172.';
    if (s.split(A).length !== 2) die(REL + ': arbiter-regen note matched ' + (s.split(A).length - 1));
    const NOTE = [
      '// resync-guard - the next two notes were lost to v0.30.1786\'s stale re-sync (which also re-used v172; v0.30.1798 then re-used v173). Restored for the record.',
      '// v0.30.1782 - v171 -> v172. Pisces\'s bullet-hell shot (p_whirl.webp and anim/whirl_0-8.webp) is REPLACED under',
      '// their own names (the cyan wave ring becomes a twin-koi disc), so a returning browser would keep drawing the old art for a session.',
      '// v0.30.1785 - v172 -> v173. Pisces\'s swing strike (fx/swing_zodiac_pisces.webp) is REPLACED under',
      '// their own names (the purple wave becomes a pearl comet), so a returning browser would keep drawing the old art for a session.',
      ''].join(EOL);
    const s2 = s.replace(A, () => NOTE + A);
    bounds(REL, s2.length - s.length, 400, 1200);
    put(REL, s2, (tmp) => { new vm.Script(readFileSync(tmp, 'utf8')); });
    changed++; console.log(REL + ': cache notes restored');
  }
}

// ---- 3. scripts/_ship_change.sh -----------------------------------------------
{
  const REL = 'scripts/_ship_change.sh';
  let s = readFileSync(path.join(ROOT, REL), 'utf8');
  const n0 = s.length, EOL = eolOf(s), J = (...L) => L.join(EOL);
  const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(REL + ': ' + what + ' matched ' + n); s = s.replace(a, () => b); };
  if (s.includes('resync-guard')) console.log(REL + ': already applied');
  else {
    if (!existsSync(path.join(ROOT, 'scripts/_ship_resync.sh'))) die('scripts/_ship_resync.sh is missing - it ships with this package');
    once(J('#   LX_EXTRA   extra repo files to re-sync, guard and ship (optional, space separated)', 'set -uo pipefail', 'cd /c/Users/dpeh0/Mojiworld'), J(
      '#   LX_EXTRA   extra repo files to re-sync, guard and ship (optional, space separated)',
      '#   LX_LOG_DIR where a failed confirming test leaves its full output (optional; default $TMPDIR/lx_ship_logs)',
      'set -uo pipefail',
      'cd /c/Users/dpeh0/Mojiworld',
      '# resync-guard: lx_resync_one / lx_resync_verify - a re-sync that fails, or leaves bytes that are not origin\'s, stops the chain.',
      '. scripts/_ship_resync.sh || { echo "ABORT: scripts/_ship_resync.sh is missing"; exit 1; }'), 'header + cd');
    once('        for a in 1 2 3; do git checkout "$TIP" -- "$p" 2>/dev/null && break; sleep 2; done', J(
      '        # resync-guard: this was `git checkout ... 2>/dev/null && break` three times, then carry on regardless - so a stale',
      '        # .git/index.lock (2026-10-15) had every chain row-patch and ship STALE tables for two days (v0.30.1786 reverted',
      '        # the Sundered Smith and the Pisces swing rows). A checkout that still fails after three tries now stops the chain.',
      '        lx_resync_one "$TIP" "$p" || return 1'), 're-sync checkout loop');
    once(J('  echo "   base ${TIP:0:8}"', '', '  echo "== 2. apply (guarded, idempotent)"'), J(
      '  # resync-guard: prove every re-synced path holds origin\'s exact bytes BEFORE either apply runs (LX_APPLY2 patches',
      '  # those files in place). git hash-object applies the CRLF filter, so the autocrlf checkout still compares true.',
      '  lx_resync_verify "$TIP" $EXTRA || return 1',
      '  echo "   base ${TIP:0:8}"', '', '  echo "== 2. apply (guarded, idempotent)"'), 'verify before apply');
    once(J(
      '  local ok=0 a',
      '  for a in 1 2; do',
      '    if PORT=$((12870 + RANDOM % 60)) MOJI_GAME_FILE="$G" node "$LX_TEST" 2>&1 | tail -3 | tee /dev/stderr | grep -q "^all [0-9]* passed"; then ok=1; break; fi',
      '    echo "   confirming test did not pass (attempt $a) - once more"; sleep 4',
      '  done',
      '  [ "$ok" = 1 ] || { echo "confirming test failed twice"; return 1; }'), J(
      '  # resync-guard: the whole run goes to a log (only its last 3 lines are shown here); a failure prints the log\'s path.',
      '  local ok=0 a log logdir="${LX_LOG_DIR:-${TMPDIR:-/tmp}/lx_ship_logs}"',
      '  mkdir -p "$logdir" || return 1',
      '  for a in 1 2; do',
      '    log="$logdir/${LX_TAG}_${ID}_r${r:-0}_t$a.log"',
      '    PORT=$((12870 + RANDOM % 60)) MOJI_GAME_FILE="$G" node "$LX_TEST" > "$log" 2>&1',
      '    tail -3 "$log" >&2',
      '    if tail -3 "$log" | grep -q "^all [0-9]* passed"; then ok=1; rm -f "$log"; break; fi',
      '    echo "   confirming test did not pass (attempt $a) - full output: $(cygpath -w "$log" 2>/dev/null || echo "$log")"; sleep 4',
      '  done',
      '  [ "$ok" = 1 ] || { echo "confirming test failed twice - full output in the logs named above"; return 1; }'), 'confirming test step');
    bounds(REL, s.length - n0, 1000, 3000);
    put(REL, s, (tmp) => { execFileSync('bash', ['-n', tmp], { stdio: 'pipe' }); });
    changed++; console.log(REL + ': re-sync guarded, verified, test logged');
  }
}
console.log(changed ? 'applied: resync-guard data (' + changed + ' file' + (changed > 1 ? 's' : '') + ')' : 'already applied');
