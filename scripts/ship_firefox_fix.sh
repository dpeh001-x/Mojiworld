#!/usr/bin/env bash
# Ship the Firefox fix without clobbering parallel sessions.
# =============================================================================
# Per user, repeatedly: "Do not affect my other parallel agents."
#
# This working copy has a large amount of stale index state (staged sprite
# deletions, hook deletions) left over from other sessions and OneDrive lock
# contention, so `git add -A` here would push other people's half-states as if
# they were mine. Instead every commit is built with plumbing against a tree
# read from origin/main, and names EXACTLY the files it means to change.
#
# The loop re-derives onto the live tip on rejection, so a session that pushes
# between the fetch and the push costs a retry rather than a lost commit.
set -u
cd /c/Users/dpeh0/Mojiworld || exit 1

commit_one () {
  local MSG_FILE="$1"; shift
  local FILES=("$@")
  local try
  for try in 1 2 3 4 5; do
    git fetch -q origin || { echo "fetch failed"; return 1; }
    local BASE; BASE=$(git rev-parse origin/main)
    export GIT_INDEX_FILE="$(pwd)/.git/_ship_idx_$$"
    rm -f "$GIT_INDEX_FILE"
    git read-tree "$BASE" || { echo "read-tree failed"; return 1; }
    local f h
    for f in "${FILES[@]}"; do
      [ -f "$f" ] || { echo "missing: $f"; return 1; }
      h=$(git hash-object -w "$f") || return 1
      git update-index --add --cacheinfo 100644,"$h","$f" || return 1
    done
    local TREE C
    TREE=$(git write-tree) || return 1
    C=$(git commit-tree "$TREE" -p "$BASE" -F "$MSG_FILE") || return 1
    unset GIT_INDEX_FILE
    rm -f "$(pwd)/.git/_ship_idx_$$"
    if git push -q origin "$C:refs/heads/main" 2>/dev/null; then
      git update-ref refs/heads/main "$C"
      echo "pushed ${C:0:8}  (base ${BASE:0:8})  files: ${FILES[*]}"
      return 0
    fi
    echo "  push rejected (tip moved), re-deriving onto the new tip — attempt $try"
  done
  echo "gave up after 5 attempts"
  return 1
}

commit_one "$@"
