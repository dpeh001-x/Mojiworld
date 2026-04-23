#!/bin/bash
# SessionStart hook — auto-pull latest from origin/main so a human
# collaborator's pushes land in Claude's working tree before the
# session starts. Synchronous. Exits 0 on every failure path so the
# hook can never block a session start.
#
# Opt out by setting CLAUDE_DONT_PULL=1.

set -euo pipefail

if [ "${CLAUDE_DONT_PULL:-}" = "1" ]; then
  echo "↷ CLAUDE_DONT_PULL=1 — skipping auto-pull"
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Not a git repo? Bail quietly.
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

# Determine current branch. Bail on detached HEAD.
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
if [ -z "$BRANCH" ] || [ "$BRANCH" = "HEAD" ]; then
  echo "↷ Detached HEAD — skipping auto-pull"
  exit 0
fi

# Fetch. 30 s timeout so network hangs don't block session start.
echo "⇣ git fetch origin…"
if ! timeout 30 git fetch origin --quiet 2>&1; then
  echo "‼ git fetch failed or timed out — continuing with stale state"
  exit 0
fi

# origin/main must exist; otherwise we don't know what to sync to.
if ! git rev-parse --verify origin/main >/dev/null 2>&1; then
  echo "↷ origin/main not found — skipping auto-pull"
  exit 0
fi

# Count divergence in both directions.
AHEAD="$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)"
BEHIND="$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)"

if [ "$BEHIND" = "0" ]; then
  echo "✓ $BRANCH already up-to-date with origin/main"
  exit 0
fi

# Dirty tree? Don't rebase — log and bail.
if [ -n "$(git status --porcelain)" ]; then
  echo "‼ Working tree has uncommitted changes — behind origin/main by $BEHIND; run 'git pull' manually"
  exit 0
fi

# No unique local commits → fast-forward. Otherwise → rebase.
if [ "$AHEAD" = "0" ]; then
  echo "⇣ Fast-forwarding $BRANCH (+$BEHIND from origin/main)…"
  if ! git merge --ff-only origin/main --quiet; then
    echo "‼ Fast-forward failed"
    exit 0
  fi
else
  echo "⇣ Rebasing $BRANCH (ahead $AHEAD, behind $BEHIND) onto origin/main…"
  if ! git rebase origin/main --quiet 2>&1; then
    echo "‼ Rebase produced conflicts — aborting; resolve manually"
    git rebase --abort 2>/dev/null || true
    exit 0
  fi
fi

echo "✓ Synced $BRANCH with origin/main"
