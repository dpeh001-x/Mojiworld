# LevelX — project conventions for Claude

## File-safety rules (HARD, 2026-06-10 — after a 0-byte truncation incident)

`mojiworld_game.html` (5.3MB, single file) was zeroed TWICE by failed writes:
a buffered `open('w')` truncates immediately, and if the write then throws
(e.g. lone-surrogate `\ud8xx` escapes smuggled in via the tool-call JSON
layer), the loss is total. Parallel sessions edit this file concurrently.
Therefore, for EVERY session:

1. **Atomic writes only.** Any scripted write to `mojiworld_game.html` (or any
   file > 100KB) goes: write to `<file>.tmp` → verify (encode succeeds, size
   sane, `node --check` for JS payloads) → `os.replace()` / `mv` over the
   original. Never `open(path, 'w')` directly on the target.
2. **No emoji escapes in heredocs.** Bulk-edit Python with ANY non-ASCII
   content must be written to a `.py` file via the Write tool and executed —
   never inlined in a Bash heredoc. Pre-scan before writing:
   `assert not any(0xD800 <= ord(c) <= 0xDFFF for c in s)`.
3. **Commit after every shipped change, push when a feature lands.** `origin`
   is wired to `dpeh001-x/Mojiworld` (the canonical repo as of 2026-06-11,
   per user — previously `dpeh001-x/LevelX`). **The working copy is
   `C:\Users\dpeh0\Mojiworld` (local disk, as of 2026-07-25 per user)** —
   the old `OneDrive\Desktop\Mojiworld` folder is a git-free static copy
   only; OneDrive sync fought git (lock contention, minutes-long status,
   corrupted fetches), so never re-create a `.git` there. All edits, commits
   and pushes happen in `C:\Users\dpeh0\Mojiworld`. After a feature/fix lands
   and is verified: `git add <your paths> && git commit`, then
   `git push origin main` per the sync-first rule below. Small, frequent
   commits make loss impossible and write races diagnosable.
4. **Match-count guards on every replace.** `s.count(anchor) == expected` or
   abort — a parallel session may have shifted the anchor since you read it.
5. **Stage explicit paths, never `git add -A`** (HARD, 2026-07-28 — after a
   half-applied-refactor incident). `-A` sweeps whatever a *parallel* session
   has staged but not yet committed into YOUR commit. Real case: session A had
   `git mv`'d nine data files into `data/` and was still editing the game's
   `<script src>` tags; session B ran `git add -A && git commit`, capturing
   A's renames while writing `mojiworld_game.html` from its own stale buffer.
   The result was a commit where the files had moved but every reference still
   pointed at the old paths — the game booted with zero calibration data and
   nothing failed loudly. Stage the paths you actually touched.
6. **Re-verify after every reload, not just once.** In the same incident the
   first in-browser check passed and the second, minutes later, showed empty
   tables — because the file had been rewritten underneath. If a check that
   passed starts failing, suspect a concurrent write before your own change:
   compare the served bytes against the file on disk (`git diff`, mtime).

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

## Before every push — sync first (HARD RULE)

Multiple Claude sessions (phone, laptop, web) can push to this repo in parallel. Pushing without syncing risks (a) the push getting rejected as non-fast-forward, or (b) silently clobbering the other session's work via a force-push.

**Before every `git push origin <branch>`, run:**

```bash
git fetch origin
git pull --rebase origin <branch>
# resolve any conflicts (do NOT abort + force-push)
git push origin <branch>
```

This applies to **every branch**, not just the default. Even feature branches drift if a parallel session FF-merged the default into them.

If the rebase hits a conflict, **resolve it** (read both sides, merge the intent — most cross-session conflicts are changelog-style and trivial). Do **NOT** `git rebase --abort` followed by a force-push to "skip" the conflict — that overwrites the other side's work.

Force-pushes are reserved for: (i) feature-branch resyncs after a clean rebase where the only change was rewriting your own commit hashes, and (ii) explicit user instruction. Always use `--force-with-lease`, never bare `--force`. Never force-push the default branch.

## Mobile UI branch (automated)

### Hard rule: never touch non-mobile code on this branch

On `mobile-ui-pass`, **only edit mobile code** — the safe zones in `mojiworld_game.html` listed below, plus mobile-specific files (`MOBILE_CHANGELOG.html`, `.claude/hooks/mobile-*.py`). Do not modify gameplay code, even if it "would fix the bug" or "is only one line". The collaborator's work on `main` moves fast; any mobile-branch edit outside the safe zones risks a rebase conflict.

If a user request cannot be satisfied without touching non-mobile code (gameplay logic, class/job/skill systems, combat, save format, etc.), **stop and explicitly flag it to the user** before doing any work. Describe which file + line range would need to change, why, and offer to either (a) skip that part of the request, or (b) do it on a different branch. Never silently cross the line.

### Automated hooks

The `mobile-ui-pass` branch has two extra hooks (scoped to that branch only — they no-op on other branches):

- `.claude/hooks/mobile-pre-push.py` — PreToolUse on Bash. Before a `git push` runs, auto-fetches origin/main and rebases. Blocks the push with a clear conflict list if the rebase would collide with the collaborator's gameplay changes on main. Skipped if the working tree is dirty.
- `.claude/hooks/mobile-zone-check.py` — PostToolUse on Edit/Write/MultiEdit of `mojiworld_game.html`. Warns (never blocks) when an edit lands outside the mobile "safe zones" — contiguous line ranges where mobile code is isolated from gameplay code. Safe zones live inline in the script; keep them in sync when refactoring.

### Mobile safe zones in `mojiworld_game.html`

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
▶ Mobile preview: https://raw.githack.com/dpeh001-x/Mojiworld/mobile-ui-pass/mojiworld_game.html
```

Single-file static HTML + raw.githack serves the latest branch tip with the correct MIME, so the URL never changes — reviewers / iPhone testers bookmark once.

### Mobile changelog (durable)

Mobile-branch changes are documented in `MOBILE_CHANGELOG.html` — **not** in the main `CHANGELOG.html`. This keeps the gameplay release notes focused on gameplay.

Rules:

- Every shipped commit on `mobile-ui-pass` must add an entry to `MOBILE_CHANGELOG.html`.
- Match the existing styling (same palette, pill tags for `bug` / `feat` / `polish`, `<kbd>` for keys).
- Only log mobile-specific work there. If a change touches gameplay code outside the mobile safe zones, it belongs in the main changelog instead (and probably in a different branch).
- Shareable URL: `https://raw.githack.com/dpeh001-x/Mojiworld/mobile-ui-pass/MOBILE_CHANGELOG.html`.

## Session start (automated)

A `SessionStart` hook (`.claude/hooks/session-start.sh`, registered in `.claude/settings.json`) runs `git fetch origin` and fast-forwards / rebases the current branch onto `origin/main` before the session begins. This compensates for human collaborators pushing to `main` between sessions.

Behaviour:

- Fast-forward when the branch has no unique commits.
- Rebase when it does; auto-aborts on conflict and logs a warning.
- No-op on dirty working tree, detached HEAD, missing `origin/main`, or fetch timeout.
- Opt out per-session with `CLAUDE_DONT_PULL=1`.

If editing the hook, keep it idempotent and always exit 0 so it never blocks session start.

## Animator canonical link (durable)

The bookmarkable animator entry point is the **launcher**:
`https://raw.githack.com/dpeh001-x/Mojiworld/main/animator.html`
It resolves main's current commit via the GitHub API and redirects to that
build's pinned `rawcdn.githack.com/<sha>/monster_animator.html` — immutable,
so there is no CDN/browser cache window at all. Surface THIS link (not the
`/main/monster_animator.html` one, which lags ~5 min behind pushes) whenever
giving the user an animator URL. The animator's build badge links to it
("latest↗") and must be bumped on every animator change.

## Animator calibration patches (durable)

The animator's **📋 Copy patch** button copies a one-monster JSON blob tagged
`LX_ANIM_PATCH:1` (the selected entity's calib + attack hitboxes). When the
user pastes such a blob in chat, hardbake it with:

```bash
node scripts/apply_anim_patch.mjs '<pasted json>'
```

The patch is declarative for its entity (calib block replaced, pure-default
states dropped; hitbox block replaced, or removed when absent); all other
entities are untouched. After baking: `node --check anim_calib.js`, commit,
push per the sync-first rule. Never hand-edit the values in transit.

## Changelog policy (durable)

**Always update `CHANGELOG.html` whenever a new implementation lands.**

- Add an entry under the correct section (or create a new section) describing what shipped.
- Keep the HTML self-contained — inline CSS, no external deps. It is shared directly via `raw.githack` / `blob` URLs, so it must render correctly as a standalone document.
- Match the existing styling (dark theme, pill components, `<kbd>` for keys, summary cards, callouts, controls table).
- When a keybind or feature is renamed, update every reference — summary table, controls table, verification checklist, and any inline mentions.
- Do not maintain a `CHANGELOG.md` alongside. `CHANGELOG.html` is the canonical artifact.
- **Newest entries always go on top.** New H2 sections are inserted directly under the `<header>` block (top of the entry list). The oldest entry stays at the bottom. Same convention for `MOBILE_CHANGELOG.html`. Never append to the bottom.

## Reply format after changelog edits (durable)

**After every edit that lands a changelog entry, surface the full running changelog since day 1 in the user-facing reply.** Preferred format:

1. The rendered raw.githack URL (canonical artifact).
2. A compact HTML table listing every entry since day 1 — columns: `Tag` (bug / feat / polish), `Title`, `Summary` (one line). New-on-top, oldest-at-bottom.
3. The full H2/H3/P blocks for entries added in the current session inline, so the user can read the shipped prose without navigating away.

The 1,200-word response cap still applies; if the summary table would blow past it, keep the table compact (≤ 8 words per summary cell) and link to the rendered URL for the full prose. Never skip the table — "see the file" is not enough.

## Animator build badge (durable, 2026-07-23)

`monster_animator.html` shows a green **build vX.Y.Z** badge in its sidebar
header so the user can tell at a glance whether raw.githack is serving a stale
cached copy. **Every commit that touches `monster_animator.html` must update
the badge to the same version as the `GAME_VERSION` bump for that change.**
It is a plain static string in the header markup (search for `build v0.`).

## Shipping rhythm

- Develop on the branch specified in the environment instructions.
- Fast-forward `main` from the feature branch when the user explicitly asks to push to main. Never force-push `main`.
- Syntax-check by extracting `<script>` from `mojiworld_game.html` into a temp file and running `node --check` before committing.

## Preview branch

A dedicated `preview` branch holds whatever build is currently under review so reviewers always bookmark the same URL:

- Play URL: `https://raw.githack.com/dpeh001-x/Mojiworld/preview/mojiworld_game.html`
- Changelog URL: `https://raw.githack.com/dpeh001-x/Mojiworld/preview/CHANGELOG.html`

Behaviour:
- Only update `preview` when the user explicitly asks (e.g. "push a preview", "update the preview"). Not automatic on every push.
- `preview` is force-overwritten each time — safe to force-push with lease, it carries no durable history.
- Fast-forward `preview` from the current branch tip (or a chosen commit), not via merge commits.

## File layout (tightened 2026-07-28)

Root holds ONLY entry points and files a fixed URL or external tool must find
there. Everything else lives in a bucket. **Adding a file to root needs a
reason from the list below** — otherwise it belongs in `data/`, `tools/`,
`scripts/`, or `docs/`.

Root files (17), and why each one has to be there:

- `mojiworld_game.html` — the entire game in one file (canvas, HUD, systems, logic).
- `CHANGELOG.html` / `MOBILE_CHANGELOG.html` — shareable changelogs (raw.githack-linked, never move).
- `animator.html` / `monster_animator.html` — animator launcher + tool (raw.githack-linked, never move).
- `sw.js` — service worker; its cache scope is the directory it is served from, so it CANNOT move.
- `Mojiworld.cmd` / `Mojiworld.exe` / `serve.js` / `serve.bat` — desktop launchers + the static server they spawn. The launchers `cd` to their own folder and run `node serve.js`, so these four travel together at root.
- `render.yaml` — Render reads the blueprint from the repo root only.
- `package.json`, `package-lock.json`, `.gitignore`, `README.md`, `LICENSE`, `CLAUDE.md` — conventional root files.

Buckets:

- `data/` — runtime tables loaded by the game and animator: `anim_calib.js`, `anim_calib_manifest.js`, `gear_calibration.js`, `gear_erase.js`, `mob_offsets.js`, `npc_offsets.js`, `monster_hitboxes.js`, `sfx_manifest.js`, `assets_manifest.json`. Referenced as `data/<file>` from `mojiworld_game.html`, `monster_animator.html` and `steam/package.json`'s `extraResources` filter — **update all three when adding one.**
- `tools/` — dev tools: the six standalone pages (`sprite_maker`, `sprite_preview`, `map_editor`, `map_placement_tool`, `monster_sound_review`, `zodiac_vfx_review`) plus calibration/asset utilities and `tools/launcher/` (the csc source for `Mojiworld.exe`). A tool page that reads repo-root art needs `<base href="../">` in its `<head>` — that is how `zodiac_vfx_review` keeps its 430 `Sprites/` URLs working from a subdirectory.
- `tools/_archive/` — 104 one-off scripts (`_patch_*`, `_chlog_*`, `_b60_*`, `_bake_*`, `_gen_*`, `_forge_ui_*`, `_dev_*`) archived 2026-08-03. Each ran once; none is wired into the game, the build or any test. They were 68% of `tools/`, so finding a real tool meant reading past them. Most `_patch_*` files are already unrunnable — they hardcode `C:/Users/Xenon/Desktop/Mojiworld/…`, a machine this repo has not lived on. **Do not add new one-offs to `tools/` root** — either write them under `tools/_archive/` or use `scripts/_tmp_*` (gitignored). See `tools/_archive/README.md`.
- `scripts/` — build, bake and test utilities. `_tmp_*` is gitignored scratch.
- `docs/prompts/` — asset-generation prompt libraries (ludo.ai, Gemini, audio) + production .docx.
- `docs/design/` — specs, lore, balance, roadmaps.
- `docs/reports/` — audits, playtest reports, session summaries.
- `docs/guides/` — SETUP / DEPLOY / STEAM / co-op notes.
- `docs/_REORG_MANIFEST.txt` — the 2026-07-27 and 2026-07-28 move maps (old → new paths).
- `Sprites/`, `audio/`, `backgrounds/`, `assets/` — art. Streamed from jsDelivr on the Pages deploy, so their root-relative paths are load-bearing; do not move them.
- `steam/` — Electron desktop build, `steam/assets/` (store art), `steam/higgsfield/cinematics/` (**runtime**: the game `<video>`-plays 15 of these).
- `mp/`, `mp-cf/`, `server/` — three independently deployable relay services, each with its own lockfile and deploy target (Render blueprint / Cloudflare Worker / container). They look redundant but are not; merging them breaks live deploys.
