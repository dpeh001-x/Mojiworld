# shellcheck shell=bash
# Re-sync helpers for scripts/_ship_change.sh (resync-guard, 2026-10-17). Sourced, not run.
# =============================================================================
# Why: a stale 0-byte .git/index.lock (left 2026-10-15 12:01, and again
# 2026-10-17 03:07) made every `git checkout TIP -- <path>` in the LX_EXTRA
# re-sync fail. The old loop sent git's error to /dev/null, tried three times
# and carried on, so LX_APPLY2 row-patched whatever stale copy the working tree
# held and the chain shipped it: v0.30.1786 put back the Sundered Smith's old
# calibration and dropped the Pisces swing rows from data/sprite_edges.js.
# Now a failed checkout stops the chain with git's own message, and every
# re-synced path is proved byte for byte against origin before anything
# applies. Both work on the repo in the current directory, so
# scripts/resync_guard_test.mjs drives them in a scratch repo.

# Say what is holding the index, if anything.
lx_lock_note () {
  local gd L now mt
  gd=$(git rev-parse --git-dir 2>/dev/null) || return 0
  L="$gd/index.lock"
  [ -e "$L" ] || return 0
  now=$(date +%s); mt=$(date -r "$L" +%s 2>/dev/null || echo "$now")
  echo "!!   $L exists: $(wc -c < "$L" | tr -d ' ') bytes, $((now - mt))s old."
  echo "!!   A live git command holds it for seconds. Minutes old with no git process running"
  echo "!!   (tasklist | grep -i git) means it is stale: move it aside rather than deleting it -"
  echo "!!     mv \"$L\" \"$L.stale-\$(date +%Y%m%d-%H%M)\""
  echo "!!   and run the chain again."
}

# lx_resync_one TIP PATH - check PATH out of TIP (three tries). On failure say why and return 1.
lx_resync_one () {
  local tip="$1" p="$2" a err=""
  for a in 1 2 3; do
    if err=$(git checkout "$tip" -- "$p" 2>&1); then return 0; fi
    if [ "$a" -lt 3 ]; then sleep "${LX_RESYNC_SLEEP:-2}"; fi
  done
  {
    echo "!! RE-SYNC FAILED: git checkout ${tip:0:8} -- $p (3 tries)"
    printf '%s\n' "$err" | sed 's/^/!!   git: /'
    lx_lock_note
    echo "!!   Shipping now would push the working tree's STALE $p over other sessions' rows."
    echo "!!   Nothing applied, nothing pushed."
  } >&2
  return 1
}

# lx_resync_verify TIP PATH... - each PATH that TIP has must hash, on disk, to TIP's blob.
# git hash-object runs the same clean filter as `git add`, so a CRLF checkout of an LF blob
# still matches. A path TIP does not have (new art, a new script) is skipped.
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
    lx_lock_note
    echo "!!   Nothing applied, nothing pushed."
  } >&2
  return 1
}
