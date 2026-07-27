#!/bin/bash
# Seed-push: upload all unpushed blobs to origin in ~150MB batches via
# synthetic parent-chained commits on refs/heads/_seed, so the final
# `git push origin main` pack contains only trees/commits (tiny).
# Uses a TEMP index (GIT_INDEX_FILE) — never touches the real index.
set -u
cd "C:/Users/Xenon/Desktop/Mojiworld" || exit 1
TMP="$(mktemp -d)"
export GIT_INDEX_FILE="$TMP/seedidx"
LIMIT=${LIMIT:-150000000}

echo "[1/4] listing unpushed blobs..."
git rev-list --objects origin/main..main \
  | awk '{print $1}' \
  | git cat-file --batch-check='%(objecttype) %(objectsize) %(objectname)' \
  | awk '$1=="blob"{print $3, $2}' > "$TMP/blobs.txt"
N=$(wc -l < "$TMP/blobs.txt")
TOTBYTES=$(awk '{s+=$2} END{print s}' "$TMP/blobs.txt")
echo "    $N blobs, $TOTBYTES bytes"

# resume support: skip blobs already on a remote _seed tip if present
git fetch origin _seed 2>/dev/null
if git rev-parse --verify origin/_seed >/dev/null 2>&1; then
  echo "    resuming: excluding blobs already reachable from origin/_seed"
  git rev-list --objects origin/_seed | awk '{print $1}' | sort > "$TMP/have.txt"
  sort -k1,1 "$TMP/blobs.txt" | join -v 1 -1 1 -2 1 - "$TMP/have.txt" > "$TMP/blobs2.txt"
  mv "$TMP/blobs2.txt" "$TMP/blobs.txt"
  PARENT=$(git rev-parse origin/_seed)
else
  PARENT=""
fi

echo "[2/4] seeding in batches (limit $LIMIT bytes)..."
git read-tree --empty
i=0; size=0; batch=0
push_batch () {
  local tree c
  tree=$(git write-tree)
  if [ -z "$PARENT" ]; then c=$(git commit-tree "$tree" -m "seed batch $batch"); else c=$(git commit-tree "$tree" -p "$PARENT" -m "seed batch $batch"); fi
  echo "    batch $batch: pushing $c ($size bytes)..."
  for attempt in 1 2 3; do
    if git push origin "$c:refs/heads/_seed" >/dev/null 2>&1; then PARENT="$c"; return 0; fi
    echo "      attempt $attempt failed, retrying..."
    sleep 3
  done
  echo "FATAL: batch $batch failed 3x"; exit 1
}
while read -r sha sz; do
  i=$((i+1))
  git update-index --add --cacheinfo "100644,$sha,f$i" || { echo "FATAL cacheinfo $sha"; exit 1; }
  size=$((size+sz))
  if [ "$size" -ge "$LIMIT" ]; then push_batch; batch=$((batch+1)); size=0; fi
done < "$TMP/blobs.txt"
[ "$size" -gt 0 ] && push_batch

echo "[3/4] pushing main (objects all seeded — pack should be tiny)..."
git push origin main 2>&1 | tail -2 || { echo "FATAL: main push failed"; exit 1; }

echo "[4/4] cleaning up temp remote branches..."
git push origin --delete _seed 2>/dev/null
git push origin --delete _sync-tmp 2>/dev/null
rm -rf "$TMP"
echo "DONE — verifying:"
git ls-remote origin main
