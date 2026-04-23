#!/usr/bin/env python3
"""
PostToolUse hook on Edit / Write / MultiEdit.

When the current branch is `mobile-ui-pass` and an edit hits
`maple_game.html`, warn if any changed hunk falls outside the
"safe mobile zones". Edits inside those zones are merge-conflict-
resistant against the collaborator's gameplay work; edits outside
them are at risk.

Warnings only. Never blocks — exits 0 always.
"""
import json, os, re, subprocess, sys


# Inclusive line ranges in maple_game.html that are mobile-only.
# Keep this list in sync with CLAUDE.md "Mobile safe zones" section.
SAFE_ZONES = [
    (7, 10),      # mobile meta tags
    (33, 33),     # body touch-action
    (65, 334),    # MOBILE CONTROLS (v5) CSS
    (338, 419),   # #rotate-nag CSS + nag-portrait media query
    (484, 605),   # MOBILE TOUCH CONTROLS CSS
    (1147, 1167), # rotate-to-landscape nag + #mobile-ctrl HUD
    (1476, 1512), # MOBILE CONTROL DECK DOM
    (3612, 3797), # MOBILE / TOUCH CONTROLS JS + FULLSCREEN FIT
]
SAFE_STR = ", ".join(f"{s}-{e}" if s != e else f"{s}" for s, e in SAFE_ZONES)


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    if data.get("tool_name") not in ("Edit", "Write", "MultiEdit", "NotebookEdit"):
        sys.exit(0)

    fp = data.get("tool_input", {}).get("file_path", "")
    if not fp.endswith("maple_game.html"):
        sys.exit(0)

    os.chdir(os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd()))

    try:
        branch = subprocess.check_output(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        sys.exit(0)
    if branch != "mobile-ui-pass":
        sys.exit(0)

    try:
        diff = subprocess.check_output(
            ["git", "diff", "--unified=0", "maple_game.html"],
            text=True, stderr=subprocess.DEVNULL)
    except Exception:
        sys.exit(0)

    hunks = []
    for line in diff.splitlines():
        m = re.match(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@", line)
        if m:
            start = int(m.group(1))
            count = int(m.group(2) or 1)
            if count > 0:
                hunks.append((start, start + count - 1))

    if not hunks:
        sys.exit(0)

    risky = [h for h in hunks
             if not any(ss <= h[0] and h[1] <= se for ss, se in SAFE_ZONES)]

    if risky:
        print(f"⚠ mobile-zone guard: {len(risky)} edit hunk(s) land OUTSIDE "
              "the mobile safe zones", file=sys.stderr)
        for ds, de in risky[:8]:
            span = f"{ds}-{de}" if ds != de else f"{ds}"
            print(f"    • lines {span}", file=sys.stderr)
        if len(risky) > 8:
            print(f"    • … and {len(risky) - 8} more", file=sys.stderr)
        print(f"  safe zones: {SAFE_STR}", file=sys.stderr)
        print(f"  → these regions may conflict with the collaborator's "
              "gameplay edits on main", file=sys.stderr)

    sys.exit(0)


if __name__ == "__main__":
    main()
