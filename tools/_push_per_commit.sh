#!/usr/bin/env bash
# Push to dpeh001-x/Mojiworld ONE COMMIT AT A TIME (smallest pack per request,
# to beat GitHub's per-request size limit that 500'd on 10-commit packs).
# Resumes from current remote _sync2; advances commit-by-commit to main, then
# pushes main. Retries each commit on transient hangs; names the exact commit
# if one is permanently un-pushable (i.e. itself over the limit).
set -u
cd "C:/Users/Xenon/Desktop/Mojiworld" || exit 9

# Discover where the remote currently is (last good _sync2), fall back if absent.
REMOTE=$(git ls-remote origin refs/heads/_sync2 2>/dev/null | awk '{print $1}')
[ -z "$REMOTE" ] && REMOTE="da943dbc7e764ce6d6b3e69671b8ade73cace9b8"
echo "remote _sync2 at ${REMOTE:0:7}; advancing to main ($(git rev-parse --short main))"

push_retry() {   # $1 refspec  $2 label
  local spec="$1" lbl="$2" n
  for n in 1 2 3 4 5 6; do
    if git push -q origin "$spec"; then return 0; fi
    echo "  [retry $n] $lbl failed — wait ${n}0s"; sleep $(( n * 10 ))
  done
  return 1
}

mapfile -t commits < <(git rev-list --reverse "${REMOTE}..main")
total=${#commits[@]}
echo "$total commits to push individually"
idx=0
for sha in "${commits[@]}"; do
  idx=$(( idx + 1 ))
  echo "[$idx/$total] ${sha:0:7} $(git log -1 --format=%s "$sha" | cut -c1-46)"
  if ! push_retry "+${sha}:refs/heads/_sync2" "${sha:0:7}"; then
    echo "PERMANENT FAIL at ${sha:0:7} — this single commit exceeds the server limit."
    echo "added size:"; git diff-tree -r --no-commit-id --no-renames "$sha" | wc -l
    exit 1
  fi
done

echo "--- all commits on remote; pushing main ref ---"
push_retry "main:refs/heads/main" "main" || { echo "MAIN PUSH FAILED"; exit 2; }
git branch --set-upstream-to=origin/main main 2>/dev/null || true
echo "MAIN PUSHED OK"
git push -q origin :refs/heads/_sync2 && echo "_sync2 deleted" || echo "(_sync2 cleanup skipped)"
echo "=== FINAL ==="; git ls-remote origin refs/heads/main
echo "ALL DONE"
