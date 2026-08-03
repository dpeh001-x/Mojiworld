#!/usr/bin/env bash
# Resume the chunked push to dpeh001-x/Mojiworld. Remote _sync2 is at the last
# good chunk; advance it to main in small steps, then push main. Real exit-code
# checks (NO pipe masking) + per-chunk retry on transient "remote hung up".
set -u
cd "C:/Users/Xenon/Desktop/Mojiworld" || exit 9

REMOTE_BASE="14cb5f16d4831eb8293987f980ea686233e08dee"   # current remote _sync2 tip

push_with_retry() {   # $1 = refspec
  local spec="$1" n
  for n in 1 2 3 4 5; do
    if git push -q origin "$spec"; then return 0; fi
    echo "  [retry $n] push failed for $spec — backing off ${n}0s"
    sleep $(( n * 10 ))
  done
  return 1
}

# Build the chunk boundaries: every 10th commit from REMOTE_BASE..main.
mapfile -t commits < <(git rev-list --reverse "${REMOTE_BASE}..main")
total=${#commits[@]}
echo "resuming: $total commits from ${REMOTE_BASE:0:7} to main"

i=9
while [ "$i" -lt "$total" ]; do
  sha="${commits[$i]}"
  echo "chunk -> ${sha:0:7}  ($((i+1))/$total)"
  if ! push_with_retry "+${sha}:refs/heads/_sync2"; then
    echo "CHUNK FAILED PERMANENTLY at ${sha:0:7}"; exit 1
  fi
  i=$(( i + 10 ))
done

echo "--- all chunks landed; pushing main ---"
if ! push_with_retry "main:refs/heads/main"; then
  echo "MAIN PUSH FAILED"; exit 2
fi
# set upstream now that the branch exists
git branch --set-upstream-to=origin/main main 2>/dev/null || true
echo "MAIN PUSHED OK"

echo "--- deleting staging _sync2 ---"
git push -q origin :refs/heads/_sync2 && echo "staging _sync2 deleted" || echo "(_sync2 delete skipped/failed — harmless)"

echo "=== FINAL REMOTE main ==="
git ls-remote origin refs/heads/main
echo "DONE"
