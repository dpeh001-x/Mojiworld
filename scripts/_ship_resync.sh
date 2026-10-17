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
