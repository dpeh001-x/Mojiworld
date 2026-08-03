#!/usr/bin/env bash
# Pre-seed commit 31d4203's 2.3GB of blobs onto the Mojiworld remote in two
# sub-2GB pushes (split by directory), so the single oversized commit clears
# GitHub's 2GB HTTP-POST cap. Then push main (now a tiny metadata delta) and
# clean up the temp ref. No account changes, no history rewrite.
set -eu
cd "C:/Users/Xenon/Desktop/Mojiworld"

PARENT="4f8ae66495bae8ebfc5cbdc40e47da48c0a199e7"   # server _sync2 tip (commit 819)
BIG="31d4203e4f75da058830e41498eed70228c81726"      # the 2.3GB commit (820)
SEEDREF="refs/heads/_seedblob"
export GIT_AUTHOR_NAME="seed" GIT_AUTHOR_EMAIL="seed@local"
export GIT_COMMITTER_NAME="seed" GIT_COMMITTER_EMAIL="seed@local"

subset_tree() {   # args: dir1 dir2 ...  -> prints tree hash of {those dirs from BIG}
  local idx; idx="$(mktemp)"
  rm -f "$idx"
  GIT_INDEX_FILE="$idx" git read-tree --empty
  local d
  for d in "$@"; do
    GIT_INDEX_FILE="$idx" git read-tree --prefix="$d/" "${BIG}:${d}"
  done
  GIT_INDEX_FILE="$idx" git write-tree
  rm -f "$idx"
}

push_retry() {   # $1 refspec  $2 label
  local n
  for n in 1 2 3 4 5; do
    if git push -q origin "$1"; then echo "  ok: $2"; return 0; fi
    echo "  [retry $n] $2 — wait ${n}0s"; sleep $(( n * 10 ))
  done
  return 1
}

echo "=== SEED 1: tools/ (~1.16GB) ==="
T1=$(subset_tree tools)
C1=$(git commit-tree "$T1" -p "$PARENT" -m "seed1: tools blobs")
push_retry "+${C1}:${SEEDREF}" "seed1 tools" || { echo "SEED1 FAILED"; exit 1; }

echo "=== SEED 2: Sprites/ + backgrounds/ + audio/ (~1.22GB) ==="
T2=$(subset_tree Sprites backgrounds audio)
C2=$(git commit-tree "$T2" -p "$C1" -m "seed2: sprites/backgrounds/audio blobs")
push_retry "+${C2}:${SEEDREF}" "seed2 media" || { echo "SEED2 FAILED"; exit 1; }

echo "=== all big blobs seeded; pushing main ==="
push_retry "main:refs/heads/main" "main" || { echo "MAIN PUSH FAILED"; exit 2; }
git branch --set-upstream-to=origin/main main 2>/dev/null || true
echo "MAIN PUSHED OK"

echo "=== cleanup temp refs ==="
git push -q origin :"$SEEDREF" 2>/dev/null && echo "  _seedblob deleted" || echo "  (_seedblob cleanup skipped)"
git push -q origin :refs/heads/_sync2 2>/dev/null && echo "  _sync2 deleted" || true

echo "=== FINAL remote main ==="
git ls-remote origin refs/heads/main
echo "ALL DONE"
