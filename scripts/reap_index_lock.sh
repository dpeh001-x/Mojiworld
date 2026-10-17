#!/usr/bin/env bash
# Move a provably stale .git/index.lock aside, by hand (lock-proof-resync, 2026-10-17). Never deletes it.
#   bash scripts/reap_index_lock.sh            (LX_REAP_MIN_AGE=<seconds>, default 120)
# Same rule _ship_change.sh applies at the start of every chain (lx_reap_stale_lock in scripts/_ship_resync.sh):
# the lock must be 2+ minutes old AND no running git process may have started before it was made - whoever made
# it was running then, so if nothing that old is alive, nobody will ever release it. Otherwise it is left alone.
# Where these locks come from: the Codex desktop app kills its own `git diff` / `git status` runs in this
# checkout while they hold the lock (see scripts/_ship_resync.sh).
set -u
cd "$(dirname "$0")/.." || exit 1
. scripts/_ship_resync.sh || exit 1
[ -e "$(git rev-parse --git-dir)/index.lock" ] || { echo "no .git/index.lock - nothing to do"; exit 0; }
lx_reap_stale_lock
