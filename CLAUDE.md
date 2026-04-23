# LevelX — project conventions for Claude

## Scope + timeout guardrails (READ FIRST — v2, 2026-04-23)

Default to smaller-than-you-think batches. Stream timeouts happen above ~150 lines per write or ~1200 words per response; design chunks well under that.

- **Assess size BEFORE writing or using tools.** Estimate the next chunk's line/word count. If over the thresholds below, split first.
- **Hard thresholds:**
  - File write: **≤ 150 lines per call.** Larger files = skeleton first, then multiple Edit/append calls.
  - Text response to user: **≤ 1,200 words.** Longer = split into follow-up messages or offer an outline first.
  - Single Edit operation: **≤ 100 lines diff per call.** Multi-section replacements = multiple sequential Edits.
- **Commit discipline:**
  - Any meaningful deliverable = **5+ atomic commits**, not 2–4.
  - Each commit: single focused change, ≤ 150 lines diff.
  - Large doc build = 1 skeleton commit + 1 commit per section.
- **Agent delegation (Explore / Plan / general-purpose):**
  - Cap each at ~1,500 words of output (down from 2,000).
  - Explicitly instruct agents to stop early if approaching the cap.
  - Multiple smaller agents > one large agent.
- **On timeout / partial response:** retry at HALF the size, not the same size. Never re-send the whole payload.
- **Default working style:** skeleton → verify → append section 1 → verify → append section 2 → commit. Micro-batches over batches.

## Mobile UI branch (automated)

### Hard rule: never touch non-mobile code on this branch

On `mobile-ui-pass`, **only edit mobile code** — the safe zones in `maple_game.html` listed below, plus mobile-specific files (`MOBILE_CHANGELOG.html`, `.claude/hooks/mobile-*.py`). Do not modify gameplay code, even if it "would fix the bug" or "is only one line". The collaborator's work on `main` moves fast; any mobile-branch edit outside the safe zones risks a rebase conflict.

If a user request cannot be satisfied without touching non-mobile code (gameplay logic, class/job/skill systems, combat, save format, etc.), **stop and explicitly flag it to the user** before doing any work. Describe which file + line range would need to change, why, and offer to either (a) skip that part of the request, or (b) do it on a different branch. Never silently cross the line.

### Automated hooks

The `mobile-ui-pass` branch has two extra hooks (scoped to that branch only — they no-op on other branches):

- `.claude/hooks/mobile-pre-push.py` — PreToolUse on Bash. Before a `git push` runs, auto-fetches origin/main and rebases. Blocks the push with a clear conflict list if the rebase would collide with the collaborator's gameplay changes on main. Skipped if the working tree is dirty.
- `.claude/hooks/mobile-zone-check.py` — PostToolUse on Edit/Write/MultiEdit of `maple_game.html`. Warns (never blocks) when an edit lands outside the mobile "safe zones" — contiguous line ranges where mobile code is isolated from gameplay code. Safe zones live inline in the script; keep them in sync when refactoring.

### Mobile safe zones in `maple_game.html`

These are the only line ranges where mobile work is conflict-resistant against ongoing gameplay edits on main:

| Range | Content |
| --- | --- |
| 7–10 | mobile meta tags |
| 33 | `touch-action: manipulation` on body |
| 65–410 | `MOBILE CONTROLS (v5)` CSS |
| 412–448 | `#rotate-nag` CSS + portrait-nag media query |
| 561–694 | `MOBILE TOUCH CONTROLS` CSS |
| 1343–1363 | rotate-to-landscape nag + `#mobile-ctrl` HUD overlay |
| 1686–1714 | `MOBILE CONTROL DECK` DOM |
| 3641–3888 | `MOBILE / TOUCH CONTROLS` JS + `FULLSCREEN FIT` JS |

Edits outside these ranges still work — the zone hook only warns; it never blocks. But expect a rebase conflict if the collaborator touched the same lines.

### Mobile preview link (durable)

After any push that lands on `mobile-ui-pass`, always surface the playtest URL in the next user-facing reply:

```
▶ Mobile preview: https://raw.githack.com/dpeh001-x/LevelX/mobile-ui-pass/maple_game.html
```

Single-file static HTML + raw.githack serves the latest branch tip with the correct MIME, so the URL never changes — reviewers / iPhone testers bookmark once.

### Mobile changelog (durable)

Mobile-branch changes are documented in `MOBILE_CHANGELOG.html` — **not** in the main `CHANGELOG.html`. This keeps the gameplay release notes focused on gameplay.

Rules:

- Every shipped commit on `mobile-ui-pass` must add an entry to `MOBILE_CHANGELOG.html`.
- Match the existing styling (same palette, pill tags for `bug` / `feat` / `polish`, `<kbd>` for keys).
- Only log mobile-specific work there. If a change touches gameplay code outside the mobile safe zones, it belongs in the main changelog instead (and probably in a different branch).
- Shareable URL: `https://raw.githack.com/dpeh001-x/LevelX/mobile-ui-pass/MOBILE_CHANGELOG.html`.

## Session start (automated)

A `SessionStart` hook (`.claude/hooks/session-start.sh`, registered in `.claude/settings.json`) runs `git fetch origin` and fast-forwards / rebases the current branch onto `origin/main` before the session begins. This compensates for human collaborators pushing to `main` between sessions.

Behaviour:

- Fast-forward when the branch has no unique commits.
- Rebase when it does; auto-aborts on conflict and logs a warning.
- No-op on dirty working tree, detached HEAD, missing `origin/main`, or fetch timeout.
- Opt out per-session with `CLAUDE_DONT_PULL=1`.

If editing the hook, keep it idempotent and always exit 0 so it never blocks session start.

## Changelog policy (durable)

**Always update `CHANGELOG.html` whenever a new implementation lands.**

- Add an entry under the correct section (or create a new section) describing what shipped.
- Keep the HTML self-contained — inline CSS, no external deps. It is shared directly via `raw.githack` / `blob` URLs, so it must render correctly as a standalone document.
- Match the existing styling (dark theme, pill components, `<kbd>` for keys, summary cards, callouts, controls table).
- When a keybind or feature is renamed, update every reference — summary table, controls table, verification checklist, and any inline mentions.
- Do not maintain a `CHANGELOG.md` alongside. `CHANGELOG.html` is the canonical artifact.

## Shipping rhythm

- Develop on the branch specified in the environment instructions.
- Fast-forward `main` from the feature branch when the user explicitly asks to push to main. Never force-push `main`.
- Syntax-check by extracting `<script>` from `maple_game.html` into a temp file and running `node --check` before committing.

## Preview branch

A dedicated `preview` branch holds whatever build is currently under review so reviewers always bookmark the same URL:

- Play URL: `https://raw.githack.com/dpeh001-x/LevelX/preview/maple_game.html`
- Changelog URL: `https://raw.githack.com/dpeh001-x/LevelX/preview/CHANGELOG.html`

Behaviour:
- Only update `preview` when the user explicitly asks (e.g. "push a preview", "update the preview"). Not automatic on every push.
- `preview` is force-overwritten each time — safe to force-push with lease, it carries no durable history.
- Fast-forward `preview` from the current branch tip (or a chosen commit), not via merge commits.

## File layout

- `maple_game.html` — the entire game in one file (canvas, HUD, systems, logic).
- `CHANGELOG.html` — human-facing shareable changelog (see policy above).
- `sprite_*.md`, `character_*.md`, `gear_*.md` — asset-generation notes.
- `sprite_maker.html` — sprite preview tool.
