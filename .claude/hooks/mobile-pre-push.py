#!/usr/bin/env python3
"""
PreToolUse hook on Bash. When the current branch is `mobile-ui-pass`
and Claude is about to run a `git push`, automatically rebase onto
origin/main first. Blocks the push with a clear message if the rebase
would conflict, so mobile work never lands on top of an unclean state.

No-op on:
  - tools other than Bash
  - commands other than `git push`
  - branches other than `mobile-ui-pass`
  - fetch failures / detached HEAD

Exit codes:
  0  = proceed (push will run)
  2  = block the tool call (conflict or explicit safety abort)
"""
import json, os, re, subprocess, sys


def run(args, timeout=None):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout)


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    if data.get("tool_name") != "Bash":
        sys.exit(0)

    cmd = data.get("tool_input", {}).get("command", "")
    if not re.search(r"(?:^|[\s;&|])git\s+push\b", cmd):
        sys.exit(0)

    os.chdir(os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd()))

    branch = run(["git", "rev-parse", "--abbrev-ref", "HEAD"]).stdout.strip()
    if branch != "mobile-ui-pass":
        sys.exit(0)

    status = run(["git", "status", "--porcelain"]).stdout
    if status.strip():
        print("⚠ mobile auto-rebase skipped (uncommitted changes — commit or stash first)",
              file=sys.stderr)
        sys.exit(0)

    print("⇣ mobile auto-rebase: fetching origin/main…", file=sys.stderr)
    try:
        fetch = run(["git", "fetch", "origin", "main", "--quiet"], timeout=30)
    except subprocess.TimeoutExpired:
        print("⚠ fetch timed out — proceeding without rebase", file=sys.stderr)
        sys.exit(0)
    if fetch.returncode != 0:
        print("⚠ fetch failed — proceeding without rebase", file=sys.stderr)
        sys.exit(0)

    behind = run(["git", "rev-list", "--count", "HEAD..origin/main"]).stdout.strip()
    ahead = run(["git", "rev-list", "--count", "origin/main..HEAD"]).stdout.strip()
    if behind == "0":
        print("✓ already up-to-date with origin/main", file=sys.stderr)
        sys.exit(0)

    print(f"⇣ rebasing ({ahead} ahead, {behind} behind) onto origin/main…",
          file=sys.stderr)
    rebase = run(["git", "rebase", "origin/main", "--quiet"])
    if rebase.returncode == 0:
        print("✓ rebased cleanly — proceeding with push", file=sys.stderr)
        sys.exit(0)

    conflicts = run(["git", "diff", "--name-only", "--diff-filter=U"]).stdout.strip()
    run(["git", "rebase", "--abort"])

    print("", file=sys.stderr)
    print("‼ REBASE CONFLICT — push blocked by mobile-pre-push hook", file=sys.stderr)
    if conflicts:
        print("  Conflicting file(s):", file=sys.stderr)
        for f in conflicts.split("\n"):
            print(f"    • {f}", file=sys.stderr)
    print("", file=sys.stderr)
    print("  Resolve manually:", file=sys.stderr)
    print("    git fetch origin main", file=sys.stderr)
    print("    git rebase origin/main   # fix conflicts, git add, git rebase --continue", file=sys.stderr)
    print("    git push", file=sys.stderr)
    sys.exit(2)


if __name__ == "__main__":
    main()
