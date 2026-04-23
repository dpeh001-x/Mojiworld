# LevelX — project conventions for Claude

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
