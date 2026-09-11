#!/usr/bin/env bash
# Guarded plumbing push: never overwrite a file another session changed.
# =============================================================================
# Same plumbing as ship_firefox_fix.sh (commit built on a tree read from the
# live origin tip, naming exactly the files it changes), plus the guard that
# script lacks. ship_firefox_fix.sh hashes the local file onto whatever tip it
# finds, so a session that pushed mojiworld_game.html after our re-sync would
# have its change silently reverted. Here:
#
#   LX_SHIP_EXPECT=<file>   lines "<repo path> <blob sha | NONE>": the origin
#                           blob each shipped file had when we re-synced. If
#                           the tip we would commit onto holds anything else,
#                           nothing is pushed and we exit 2 ("re-sync, re-apply,
#                           re-test, try again").
#   dest=src                ship the bytes of src at repo path dest, so a chain
#                           can build and test in a private file and never
#                           touch the shared working copy's mojiworld_game.html.
#
# Exit 0 pushed, 1 error, 2 guard tripped (origin moved under us).
set -u
cd /c/Users/dpeh0/Mojiworld || exit 1

commit_one () {
  local MSG_FILE="$1"; shift
  local FILES=("$@")
  local try
  for try in 1 2 3 4 5; do
    git fetch -q origin || { echo "fetch failed"; return 1; }
    local BASE; BASE=$(git rev-parse origin/main)
    if [ -n "${LX_SHIP_EXPECT:-}" ]; then
      [ -f "$LX_SHIP_EXPECT" ] || { echo "expect file missing: $LX_SHIP_EXPECT"; return 1; }
      local p want got
      while read -r p want; do
        [ -z "$p" ] && continue
        got=$(git rev-parse -q --verify "$BASE:$p" 2>/dev/null || echo NONE)
        if [ "$got" != "$want" ]; then
          echo "GUARD: $p changed on origin since the re-sync (${want:0:8} -> ${got:0:8}); nothing pushed"
          return 2
        fi
      done < "$LX_SHIP_EXPECT"
    fi
    export GIT_INDEX_FILE="$(pwd)/.git/_shipg_idx_$$"
    rm -f "$GIT_INDEX_FILE"
    git read-tree "$BASE" || { echo "read-tree failed"; unset GIT_INDEX_FILE; return 1; }
    local f dest src h
    for f in "${FILES[@]}"; do
      if [[ "$f" == *=* ]]; then dest="${f%%=*}"; src="${f#*=}"; else dest="$f"; src="$f"; fi
      [ -f "$src" ] || { echo "missing: $src"; unset GIT_INDEX_FILE; return 1; }
      h=$(git hash-object -w "$src") || { unset GIT_INDEX_FILE; return 1; }
      git update-index --add --cacheinfo 100644,"$h","$dest" || { unset GIT_INDEX_FILE; return 1; }
    done
    local TREE C
    TREE=$(git write-tree) || { unset GIT_INDEX_FILE; return 1; }
    C=$(git commit-tree "$TREE" -p "$BASE" -F "$MSG_FILE") || { unset GIT_INDEX_FILE; return 1; }
    unset GIT_INDEX_FILE
    rm -f "$(pwd)/.git/_shipg_idx_$$"
    if git push -q origin "$C:refs/heads/main" 2>/dev/null; then
      git update-ref refs/heads/main "$C"
      echo "pushed ${C:0:8}  (base ${BASE:0:8})  files: ${FILES[*]}"
      return 0
    fi
    echo "  push rejected (tip moved), re-checking the guard on the new tip - attempt $try"
  done
  echo "gave up after 5 attempts"
  return 1
}

commit_one "$@"
