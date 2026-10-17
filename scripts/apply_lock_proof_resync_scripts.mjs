// lock-proof-resync (2026-10-17): the pipeline half (LX_APPLY2) - re-sync without the shared git index, one prefetch,
// a safe stale-lock reaper, and a SessionStart hook whose read-only `git status` takes no lock.
// ============================================================================
// Edits EXISTING files, so it must be re-runnable on origin's copies: _ship_change.sh's LX_EXTRA re-sync puts origin's
// bytes back before this runs. Guarded per file (exact anchors, or - for _ship_resync.sh, replaced whole - origin's
// v0.30.1826 blob hash), idempotent, atomic, and each file keeps its own line endings (CRLF in this checkout).
//   scripts/_ship_resync.sh            replaced by the block at the end of this file
//   scripts/_ship_change.sh            reaper after the helpers load; one prefetch before the per-path re-sync
//   scripts/resync_guard_test.mjs      its stale-lock check now expects the re-sync to work around the lock
//   .claude/hooks/session-start.sh     git --no-optional-locks status
// LX_SCRIPTS_ROOT=<dir> patches a scratch copy instead of the build checkout.
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.LX_SCRIPTS_ROOT || 'C:/Users/dpeh0/Mojiworld';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const load = (rel) => {
  const raw = readFileSync(path.join(ROOT, rel), 'utf8');
  const crlf = (raw.match(/\r\n/g) || []).length, lf = (raw.match(/\n/g) || []).length;
  return { s: raw.replace(/\r\n/g, '\n'), EOL: crlf > lf / 2 ? '\r\n' : '\n' };
};
const save = (rel, s, EOL) => {
  const F = path.join(ROOT, rel);
  writeFileSync(F + '.tmp', EOL === '\r\n' ? s.replace(/\n/g, '\r\n') : s, 'utf8');
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die(rel + ': rename kept failing: ' + lastErr.code);
};
const once = (st, a, b, what) => { const n = st.s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); st.s = st.s.replace(a, () => b); };
const blobSha = (s) => createHash('sha1').update('blob ' + Buffer.byteLength(s) + '\0').update(s).digest('hex');
let changed = 0;

// ---- 1. scripts/_ship_resync.sh: replaced whole, but only over the exact v0.30.1826 version ---------------------
{
  const me = readFileSync(fileURLToPath(import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const B = '/*__LX_RESYNC_SH__\n', E = '__LX_RESYNC_SH_END__*/';
  const i = me.lastIndexOf(B), j = me.lastIndexOf(E);
  if (i < 0 || j < i) die('embedded _ship_resync.sh block missing');
  const NEW = me.slice(i + B.length, j);
  if (!NEW.includes('lx_reap_stale_lock () {') || !NEW.endsWith('}\n')) die('embedded _ship_resync.sh block looks cut');
  const st = load('scripts/_ship_resync.sh');
  if (st.s === NEW) console.log('_ship_resync.sh: already applied');
  else if (blobSha(st.s) !== '692f115e88f74b3b2675cce8fad0b1d5381dc3df') die('_ship_resync.sh is not the v0.30.1826 version (' + blobSha(st.s).slice(0, 12) + ') - someone changed it; re-base this package');
  else { save('scripts/_ship_resync.sh', NEW, st.EOL); changed++; console.log('_ship_resync.sh: replaced'); }
}

// ---- 2. scripts/_ship_change.sh ------------------------------------------------------------------------------
{
  const st = load('scripts/_ship_change.sh');
  if (st.s.includes('\nlx_reap_stale_lock\n')) console.log('_ship_change.sh: already applied');
  else {
    const A1 = '. scripts/_ship_resync.sh || { echo "ABORT: scripts/_ship_resync.sh is missing"; exit 1; }\n';
    once(st, A1, A1 + [
      '# lock-proof-resync: a provably stale .git/index.lock (2+ minutes old, no running git process old enough to own it) is',
      '# moved aside for the other sessions\' sake. Nothing below touches the shared index any more, so it never blocks a ship.',
      'lx_reap_stale_lock', ''].join('\n'), '_ship_change.sh helper load');
    const A2 = '    local a p\n    for p in $EXTRA; do\n';
    once(st, A2, [
      '    # lock-proof-resync: every blob the re-sync needs, in one fetch (one lazy fetch per file was 69 for one boss form).',
      '    lx_resync_prefetch "$TIP" $EXTRA', ''].join('\n') + A2, '_ship_change.sh per-path loop');
    const A3 = '        lx_resync_one "$TIP" "$p" || return 1\n';
    once(st, A3, '        # lock-proof-resync: it writes origin\'s bytes without the shared index now - no checkout, no index.lock to trip on.\n' + A3, '_ship_change.sh re-sync call');
    save('scripts/_ship_change.sh', st.s, st.EOL); changed++; console.log('_ship_change.sh: patched');
  }
}

// ---- 3. scripts/resync_guard_test.mjs: a stale lock no longer stops the re-sync (still 24 checks) ----------------
{
  const st = load('scripts/resync_guard_test.mjs');
  if (st.s.includes('a stale index.lock no longer blocks the re-sync')) console.log('resync_guard_test.mjs: already applied');
  else {
    const OLD = String.raw`    const r1 = sh(R, '. "' + HELPER + '"; LX_RESYNC_SLEEP=0 lx_resync_one HEAD t.txt');
    check(r1.status !== 0 && /RE-SYNC FAILED/.test(r1.stderr) && /index\.lock exists: 0 bytes/.test(r1.stderr) && /Nothing applied, nothing pushed/.test(r1.stderr),
      'scratch repo: a checkout blocked by a stale index.lock fails loudly and names the lock', { status: r1.status, err: r1.stderr.slice(0, 300) });
    const r2 = sh(R, '. "' + HELPER + '"; lx_resync_verify HEAD t.txt');
    check(r2.status !== 0 && /VERIFY FAILED: t\.txt/.test(r2.stderr), 'scratch repo: the stale file fails the hash check against origin', { status: r2.status, err: r2.stderr.slice(0, 200) });
    unlinkSync(path.join(R, '.git', 'index.lock'));
    const r3 = sh(R, '. "' + HELPER + '"; LX_RESYNC_SLEEP=0 lx_resync_one HEAD t.txt && lx_resync_verify HEAD t.txt brand_new.webp');
    const body = readFileSync(path.join(R, 't.txt'), 'utf8');
    check(r3.status === 0 && body.includes('row B') && body.includes('\r\n'), 'scratch repo: with the lock gone it re-syncs, the CRLF checkout verifies, a new path is skipped', { status: r3.status, err: r3.stderr.slice(0, 200), body });
`;
    const NEW = String.raw`    const r2 = sh(R, '. "' + HELPER + '"; lx_resync_verify HEAD t.txt');
    check(r2.status !== 0 && /VERIFY FAILED: t\.txt/.test(r2.stderr), 'scratch repo: the stale file fails the hash check against origin', { status: r2.status, err: r2.stderr.slice(0, 200) });
    // lock-proof-resync: the re-sync no longer goes through the index, so a stale lock neither stops it nor is touched by it
    // (scripts/lock_proof_resync_test.mjs covers the rest: the cause reproduced, checkout-identical bytes, the reaper).
    const r1 = sh(R, '. "' + HELPER + '"; LX_RESYNC_SLEEP=0 lx_resync_one HEAD t.txt');
    check(r1.status === 0 && existsSync(path.join(R, '.git', 'index.lock')), 'scratch repo: a stale index.lock no longer blocks the re-sync, and is left where it is', { status: r1.status, err: r1.stderr.slice(0, 300) });
    unlinkSync(path.join(R, '.git', 'index.lock'));
    const r3 = sh(R, '. "' + HELPER + '"; lx_resync_verify HEAD t.txt brand_new.webp');
    const body = readFileSync(path.join(R, 't.txt'), 'utf8');
    check(r3.status === 0 && body.includes('row B') && body.includes('\r\n'), 'scratch repo: the re-synced CRLF copy verifies, a new path is skipped', { status: r3.status, err: r3.stderr.slice(0, 200), body });
`;
    once(st, OLD, NEW, 'resync_guard_test.mjs stale-lock block');
    save('scripts/resync_guard_test.mjs', st.s, st.EOL); changed++; console.log('resync_guard_test.mjs: patched');
  }
}

// ---- 4. .claude/hooks/session-start.sh: its read-only status takes no lock --------------------------------------
{
  const rel = '.claude/hooks/session-start.sh';
  if (!existsSync(path.join(ROOT, rel))) die(rel + ' missing');
  const st = load(rel);
  if (st.s.includes('git --no-optional-locks status --porcelain')) console.log('session-start.sh: already applied');
  else {
    const A = 'if [ -n "$(git status --porcelain --untracked-files=no)" ]; then\n';
    once(st, A, [
      '# --no-optional-locks: a read-only question must not take .git/index.lock - a git killed while it holds the lock',
      '# (a hook timeout; the Codex app cancelling its own runs) leaves a stale lock that blocks every later git command.',
      'if [ -n "$(git --no-optional-locks status --porcelain --untracked-files=no)" ]; then', ''].join('\n'), rel + ' status line');
    save(rel, st.s, st.EOL); changed++; console.log('session-start.sh: patched');
  }
}
console.log('applied: lock-proof-resync scripts (' + changed + ' file(s) changed)');

// The new scripts/_ship_resync.sh, verbatim (LF; written with the target file's own line endings).
/*__LX_RESYNC_SH__
# shellcheck shell=bash
# Re-sync helpers for scripts/_ship_change.sh (resync-guard, 2026-10-17). Sourced, not run.
# =============================================================================
# Why: a stale 0-byte .git/index.lock (left 2026-10-15 12:01, and again
# 2026-10-17 03:07) made every `git checkout TIP -- <path>` in the LX_EXTRA
# re-sync fail. The old loop sent git's error to /dev/null, tried three times
# and carried on, so LX_APPLY2 row-patched whatever stale copy the working tree
# held and the chain shipped it: v0.30.1786 put back the Sundered Smith's old
# calibration and dropped the Pisces swing rows from data/sprite_edges.js.
# Now a failed re-sync stops the chain with git's own message, and every
# re-synced path is proved byte for byte against origin before anything
# applies. Both work on the repo in the current directory, so
# scripts/resync_guard_test.mjs drives them in a scratch repo.
#
# lock-proof-resync (2026-10-17) - WHERE THE LOCKS CAME FROM, and why the re-sync no
# longer goes near the shared index. The Codex desktop app has this checkout
# open. While files change, its review pane re-runs `git diff <commit> --numstat
# -- <paths>` and `git status` about once a second and kills each superseded
# run. A porcelain `git diff` against the work tree refreshes the WHOLE index
# while it holds .git/index.lock, and a killed process (TerminateProcess) never
# removes its lock: each of the three locks was made 0.2-0.9 s after Codex
# logged a canceled diff, and a ship's own re-sync - dozens of rewritten files -
# is exactly when Codex fires fastest (the 11:17 lock). The re-sync now writes
# origin's bytes with `git cat-file --filters` (no index, no lock), one fetch
# brings every missing blob first, and lx_reap_stale_lock moves a provably dead
# lock aside for everyone else. scripts/lock_proof_resync_test.mjs proves it all.

# Say what is holding the index, if anything.
lx_lock_note () {
  local gd L now mt
  gd=$(git rev-parse --git-dir 2>/dev/null) || return 0
  L="$gd/index.lock"
  [ -e "$L" ] || return 0
  now=$(date +%s); mt=$(date -r "$L" +%s 2>/dev/null || echo "$now")
  echo "!!   $L exists: $(wc -c < "$L" | tr -d ' ') bytes, $((now - mt))s old."
  echo "!!   A live git command holds it for seconds. A stale one (a killed git left it) is moved aside by"
  echo "!!     bash scripts/reap_index_lock.sh"
  echo "!!   which never deletes it and leaves it alone while any git process old enough to own it runs."
}

# lx_git_starts - the start time (epoch seconds) of every running git.exe, one per line. A start time
# that cannot be read prints 0 (it could own any lock). Returns 1 when the processes cannot be listed.
lx_git_starts () {
  local out
  out=$(powershell.exe -NoProfile -NonInteractive -Command '@(Get-Process -Name git -ErrorAction SilentlyContinue) | ForEach-Object { try { ([DateTimeOffset]$_.StartTime).ToUnixTimeSeconds() } catch { 0 } }; exit 0' 2>/dev/null) || return 1
  printf '%s\n' "$out" | tr -d '\r'
}

# lx_reap_stale_lock - move .git/index.lock aside when it is provably stale. Never deletes, never fails.
# Stale = at least LX_REAP_MIN_AGE seconds old (default 120) AND no running git process started before it
# was made: whoever created the lock was running at that instant, so if nothing that old is alive, nobody
# will ever release it. Any doubt (processes not listable, the lock changed meanwhile) leaves it alone.
lx_reap_stale_lock () {
  local gd L id mt age starts s dest min="${LX_REAP_MIN_AGE:-120}"
  gd=$(git rev-parse --git-dir 2>/dev/null) || return 0
  L="$gd/index.lock"
  [ -e "$L" ] || return 0
  id=$(stat -c '%y|%s' "$L" 2>/dev/null) || return 0
  mt=$(stat -c %Y "$L" 2>/dev/null) || return 0
  age=$(( $(date +%s) - mt ))
  if [ "$age" -lt "$min" ]; then echo "   $L is ${age}s old: left alone (a live git command may hold it)"; return 0; fi
  if ! starts=$(lx_git_starts); then echo "   $L is ${age}s old: left alone (cannot list the running git processes)"; return 0; fi
  for s in $starts; do
    if [ "$s" -le $((mt + 2)) ]; then echo "   $L is ${age}s old: left alone (a git process that started before it is still running)"; return 0; fi
  done
  [ "$(stat -c '%y|%s' "$L" 2>/dev/null)" = "$id" ] || { echo "   $L changed while it was checked: left alone"; return 0; }
  dest="$L.stale-$(date -d "@$mt" +%Y%m%d-%H%M%S)"
  [ -e "$dest" ] && dest="$dest-$$"
  if mv -- "$L" "$dest" 2>/dev/null; then
    echo "   moved a stale $L aside (${age}s old, no running git process old enough to own it): $dest"
  fi
  return 0
}

# lx_resync_prefetch TIP PATH... - fetch, in ONE round trip, every blob of TIP's PATHs that this blobless
# clone does not hold yet (one lazy fetch per file meant 69 fetches for the Gravitos form-3 frames).
# Best effort: if it fails, lx_resync_one still fetches each blob on its own.
lx_resync_prefetch () {
  local tip="$1" p missing n; shift
  missing=$(for p in "$@"; do git rev-parse -q --verify "$tip:$p" 2>/dev/null; done |
    GIT_NO_LAZY_FETCH=1 git cat-file --batch-check 2>/dev/null | awk '$2 == "missing" { print $1 }')
  [ -n "$missing" ] || return 0
  n=$(printf '%s\n' $missing | wc -l | tr -d ' ')
  if printf '%s\n' $missing | git -c fetch.negotiationAlgorithm=noop fetch -q origin --no-tags --no-write-fetch-head \
      --recurse-submodules=no --filter=blob:none --stdin 2>/dev/null; then
    echo "   prefetched $n missing blob(s) in one fetch"
  else
    echo "   (prefetch of $n blob(s) failed: each file fetches its own)"
  fi
  return 0
}

# lx_resync_one TIP PATH - make PATH on disk exactly what `git checkout TIP -- PATH` would write, WITHOUT
# the shared index: `git cat-file --filters` applies the same smudge / CRLF conversion a checkout does, and
# the bytes go to a temp file beside PATH that is renamed over it (never half-written). Three tries (a lazy
# blob fetch can fail on a bad connection); then say why and return 1.
lx_resync_one () {
  local tip="$1" p="$2" a err="" tmp="$2.lxsync.$$"
  for a in 1 2 3; do
    mkdir -p -- "$(dirname -- "$p")" 2>/dev/null
    if err=$(git cat-file --filters "$tip:$p" 2>&1 > "$tmp") && err=$(mv -f -- "$tmp" "$p" 2>&1); then return 0; fi
    rm -f -- "$tmp"
    if [ "$a" -lt 3 ]; then sleep "${LX_RESYNC_SLEEP:-2}"; fi
  done
  {
    echo "!! RE-SYNC FAILED: git cat-file --filters ${tip:0:8}:$p (3 tries)"
    printf '%s\n' "$err" | sed 's/^/!!   git: /'
    echo "!!   Shipping now would push the working tree's STALE $p over other sessions' rows."
    echo "!!   Nothing applied, nothing pushed."
  } >&2
  return 1
}

# lx_resync_verify TIP PATH... - each PATH that TIP has must hash, on disk, to TIP's blob.
# git hash-object runs the same clean filter as `git add`, so a CRLF checkout of an LF blob
# still matches (it never consults the index). A path TIP does not have (new art, a new script) is skipped.
lx_resync_verify () {
  local tip="$1" p want got bad=0; shift
  for p in "$@"; do
    want=$(git rev-parse -q --verify "$tip:$p" 2>/dev/null) || continue
    got=$(git hash-object -- "$p" 2>/dev/null) || got=unreadable
    if [ "$got" != "$want" ]; then
      echo "!! RE-SYNC VERIFY FAILED: $p on disk is ${got:0:12}, origin ${tip:0:8} has ${want:0:12}" >&2
      bad=1
    fi
  done
  [ "$bad" = 0 ] && return 0
  {
    echo "!!   The working copy does not hold origin's bytes, so an apply would patch a stale file."
    echo "!!   Nothing applied, nothing pushed."
  } >&2
  return 1
}
__LX_RESYNC_SH_END__*/
