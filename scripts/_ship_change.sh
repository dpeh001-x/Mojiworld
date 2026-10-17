#!/usr/bin/env bash
# One guarded ship chain, parameterised - private build, blob guard, retry.
#   LX_APPLY   apply script for mojiworld_game.html (required)
#   LX_APPLY2  a second apply script, run after the first (optional; e.g. a data bake)
#   LX_TEST    confirming test, run against the private build (required)
#   LX_CL      changelog apply script (required)
#   LX_MSG     commit message file, with v0.30.x placeholders (required)
#   LX_TAG     the in-file version tag to retag, e.g. "mooma-slam" (required)
#   LX_EXTRA   extra repo files to re-sync, guard and ship (optional, space separated)
#   LX_LOG_DIR where a failed confirming test leaves its full output (optional; default $TMPDIR/lx_ship_logs)
set -uo pipefail
cd /c/Users/dpeh0/Mojiworld
# resync-guard: lx_resync_one / lx_resync_verify - a re-sync that fails, or leaves bytes that are not origin's, stops the chain.
. scripts/_ship_resync.sh || { echo "ABORT: scripts/_ship_resync.sh is missing"; exit 1; }
# lock-proof-resync: a provably stale .git/index.lock (2+ minutes old, no running git process old enough to own it) is
# moved aside for the other sessions' sake. Nothing below touches the shared index any more, so it never blocks a ship.
lx_reap_stale_lock
: "${LX_APPLY:?}" "${LX_TEST:?}" "${LX_CL:?}" "${LX_MSG:?}" "${LX_TAG:?}"
EXTRA="${LX_EXTRA:-}"
# UNIQUE per run: two chains running at once shared these names once and one pushed the
# other's build under its own message. Never again - the pid keeps every run separate.
ID=$$
G=_sc_${ID}_game.html; L=_sc_${ID}_changelog.html; EXP=scripts/_sc_${ID}_expect.txt; MSG=scripts/_sc_${ID}_msg.txt
export LX_GAME_FILE="$PWD/$G" LX_CHANGELOG_FILE="$PWD/$L"
cleanup () { rm -f "$G" "$L" "$EXP" "$MSG" scripts/_synsc${ID}_*.js; }

round () {
  echo "== 1. re-sync into private copies"
  git fetch -q origin || return 1
  local TIP; TIP=$(git rev-parse origin/main)
  git show "$TIP:mojiworld_game.html" > "$G" || return 1
  git show "$TIP:CHANGELOG.html" > "$L" || return 1
  if [ -n "$EXTRA" ]; then
    # PER PATH. `git checkout TIP -- a b` fails ENTIRELY if any one pathspec is
    # unknown to that tree - and this call swallowed its own failure, so a chain
    # whose LX_EXTRA mixed a tracked data file with a brand-new asset would skip
    # the re-sync of BOTH and ship whatever stale copy the working tree happened
    # to hold. That is the exact clobber this pipeline exists to prevent. A path
    # that does not exist on origin yet is normal (new art) and is left alone;
    # the expect file below already records it as NONE and guards it.
    # lock-proof-resync: every blob the re-sync needs, in one fetch (one lazy fetch per file was 69 for one boss form).
    lx_resync_prefetch "$TIP" $EXTRA
    local a p
    for p in $EXTRA; do
      if git rev-parse -q --verify "$TIP:$p" >/dev/null 2>&1; then
        # resync-guard: this was `git checkout ... 2>/dev/null && break` three times, then carry on regardless - so a stale
        # .git/index.lock (2026-10-15) had every chain row-patch and ship STALE tables for two days (v0.30.1786 reverted
        # the Sundered Smith and the Pisces swing rows). A checkout that still fails after three tries now stops the chain.
        # lock-proof-resync: it writes origin's bytes without the shared index now - no checkout, no index.lock to trip on.
        lx_resync_one "$TIP" "$p" || return 1
      else
        echo "   (new on this branch, not re-synced: $p)"
      fi
    done
  fi
  { printf 'mojiworld_game.html %s\nCHANGELOG.html %s\n' "$(git rev-parse "$TIP:mojiworld_game.html")" "$(git rev-parse "$TIP:CHANGELOG.html")"
    local p; for p in $EXTRA; do echo "$p $(git rev-parse -q --verify "$TIP:$p" 2>/dev/null || echo NONE)"; done; } > "$EXP"
  # resync-guard: prove every re-synced path holds origin's exact bytes BEFORE either apply runs (LX_APPLY2 patches
  # those files in place). git hash-object applies the CRLF filter, so the autocrlf checkout still compares true.
  lx_resync_verify "$TIP" $EXTRA || return 1
  echo "   base ${TIP:0:8}"

  echo "== 2. apply (guarded, idempotent)"
  node "$LX_APPLY" || return 1
  if [ -n "${LX_APPLY2:-}" ]; then node "$LX_APPLY2" || return 1; fi

  echo "== 3. version bump"
  local CUR NEXT
  CUR=$(sed -n "s/.*GAME_VERSION = 'v0\.30\.\([0-9]*\)'.*/\1/p" "$G" | head -1)
  [ -n "$CUR" ] || { echo "no GAME_VERSION"; return 1; }
  NEXT=$((CUR+1)); export LX_VER="v0.30.$NEXT"
  node - "$CUR" "$NEXT" "$G" "$LX_TAG" "$LX_APPLY" <<'NODEEOF' || return 1
const fs = require('fs');
const [cur, next] = process.argv.slice(2, 4).map((n) => 'v0.30.' + n);
const F = process.argv[4], TAG = process.argv[5], APPLY = process.argv[6];
let s = fs.readFileSync(F, 'utf8');
const key = "GAME_VERSION = '" + cur + "'";
if (s.split(key).length - 1 !== 1) { console.error('version anchor miss for ' + cur); process.exit(1); }
const re = new RegExp('v0\\.30\\.(?:x|\\d+) ' + TAG, 'g');
s = s.split(key).join("GAME_VERSION = '" + next + "'").replace(re, next + ' ' + TAG);
fs.writeFileSync(F + '.tmp', s, 'utf8'); fs.renameSync(F + '.tmp', F);
fs.writeFileSync(APPLY, fs.readFileSync(APPLY, 'utf8').replace(re, next + ' ' + TAG));
console.log('game ' + cur + ' -> ' + next);
NODEEOF
  node --check "$LX_APPLY" || return 1

  echo "== 4. changelog"
  node "$LX_CL" || return 1
  grep -q ">$LX_VER <" "$L" || { echo "changelog entry missing"; return 1; }

  echo "== 5. syntax check"
  node - "$G" "$ID" <<'NODEEOF' || return 1
const fs = require('fs');
const s = fs.readFileSync(process.argv[2], 'utf8');
const id = process.argv[3];
const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
let m, i = 0;
while ((m = re.exec(s))) { i++; fs.writeFileSync('scripts/_synsc' + id + '_' + i + '.js', m[1]); }
console.log('   ' + i + ' blocks');
NODEEOF
  local f; for f in scripts/_synsc${ID}_*.js; do node --check "$f" || return 1; done
  rm -f scripts/_synsc${ID}_*.js; echo "   syntax clean"

  echo "== 6. confirming test on the private build (a failure aborts before the push)"
  # resync-guard: the whole run goes to a log (only its last 3 lines are shown here); a failure prints the log's path.
  local ok=0 a log logdir="${LX_LOG_DIR:-${TMPDIR:-/tmp}/lx_ship_logs}"
  mkdir -p "$logdir" || return 1
  for a in 1 2; do
    log="$logdir/${LX_TAG}_${ID}_r${r:-0}_t$a.log"
    PORT=$((12870 + RANDOM % 60)) MOJI_GAME_FILE="$G" node "$LX_TEST" > "$log" 2>&1
    tail -3 "$log" >&2
    if tail -3 "$log" | grep -q "^all [0-9]* passed"; then ok=1; rm -f "$log"; break; fi
    echo "   confirming test did not pass (attempt $a) - full output: $(cygpath -w "$log" 2>/dev/null || echo "$log")"; sleep 4
  done
  [ "$ok" = 1 ] || { echo "confirming test failed twice - full output in the logs named above"; return 1; }

  echo "== 7. guarded ship"
  sed "s/v0\.30\.x/$LX_VER/g" "$LX_MSG" > "$MSG"
  LX_SHIP_EXPECT="$EXP" bash scripts/ship_guarded.sh "$MSG" "mojiworld_game.html=$G" "CHANGELOG.html=$L" \
    "$LX_APPLY" "$LX_TEST" "$LX_CL" ${LX_APPLY2:-} $EXTRA
}

for r in 1 2 3; do
  round; rc=$?
  if [ "$rc" -eq 0 ]; then break; fi
  if [ "$rc" -eq 2 ]; then echo "== origin moved under us: round $((r+1)) from the re-sync"; continue; fi
  echo "ABORT (rc $rc): nothing pushed"; cleanup; exit 1
done
[ "$rc" -eq 0 ] || { echo "ABORT: origin kept moving; nothing pushed"; cleanup; exit 1; }
cleanup

echo "== 8. verify on origin"
git fetch -q origin
echo "on origin: $(git show origin/main:mojiworld_game.html | grep -o "GAME_VERSION = 'v0[^']*'" | head -1) | $LX_TAG marks: $(git show origin/main:mojiworld_game.html | grep -c "$LX_TAG") | changelog has $LX_VER: $(git show origin/main:CHANGELOG.html | grep -c ">$LX_VER <")"
