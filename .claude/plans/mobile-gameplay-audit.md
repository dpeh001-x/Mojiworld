# Mobile Gameplay Interface Audit — LevelX

**Branch:** `mobile-ui-pass` · **Date:** 2026-04-23 · **Scope:** mobile-only

## Context

LevelX currently ships a functional mobile control deck, fullscreen-fit scaling, and safe-zone-isolated mobile CSS/JS. A recent tap-fix unblocked the class-select and advancement modals. This audit surfaces the next tier of improvements — **reward feedback visibility, progression surfacing, and retention hooks** — scoped strictly to what can land inside the mobile safe zones without touching gameplay code.

## Scope

**In scope (implementable on `mobile-ui-pass`):**
- Mobile HUD surfacing (badges, toasts, tab-title) in safe zones CSS 65–334, 338–419, 484–605; DOM 1147–1167, 1476–1512; JS 3612–3797.
- `localStorage`-backed mobile-only widgets (nag dismissal, return hints).
- Mobile-exclusive feedback augmentation (haptics, duplicate-into-safe-zone toasts, CSS pulse animations).

**Out of scope (would require gameplay-code edits — route to `main` branch):**
- XP curve tuning, drop-rate changes, new skill/class systems.
- Save-format additions beyond append-only localStorage keys with migration flags.
- New game loops (seasons, events, leaderboards with backend).

## Current-state summary

_Filled in Section 3 below._

## Identified gaps (cross-confirmed by all 3 agents)

_Filled in Section 4 below._

## Recommendations

### Phase 1 — Quick wins (<1hr each, ~5–10 items)

_Filled in below._

### Phase 2 — Structural additions (2–4hr each)

_Filled in below._

### Phase 3 — Big bets (6hr+ each)

_Filled in below._

## Ranked ship order (by ROI)

_Filled in below._

## Critical files + existing APIs to reuse

_Filled in below._

## Verification plan

_Filled in below._
