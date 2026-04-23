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

Mobile shell is working (touch controls, scaling, modal tap-fix, reset button, HUD overlap fix). What's missing is the feedback + retention layer. See [MOBILE_GAMEPLAY_AUDIT.md](../../MOBILE_GAMEPLAY_AUDIT.md) "Executive summary" for the full picture.

| Area | Status | Notes |
|---|---|---|
| Touch controls | ✅ shipped | D-pad, face buttons, skill grid, menu cluster |
| Fullscreen fit | ✅ shipped | 960×560 canvas scales via transform |
| Modal tappability | ✅ shipped | `body.forced-modal` + MutationObserver fix |
| Mobile reset button | ✅ shipped | Revealed via media query |
| HUD overlap | ✅ shipped | Desktop corner buttons re-positioned for mobile |
| Reward feedback on mobile | ❌ gap | Silent XP, silent SP gain, particles behind buttons |
| Progression HUD | ❌ gap | All tracks modal-gated |
| Re-engagement | ❌ gap | No tab title, no PWA, no push, no localStorage hints |

## Identified gaps (cross-confirmed by all 3 agents)

Full list with anchors in [MOBILE_GAMEPLAY_AUDIT.md § Cross-confirmed gaps](../../MOBILE_GAMEPLAY_AUDIT.md#cross-confirmed-gaps). Summary:

- **G1** — Level-up fireworks loud; skill-point gain silent.
- **G2** — XP bar fills silently between kills.
- **G3** — Particles / damage numbers spawn under mobile button clusters.
- **G4** — All progression systems modal-gated.
- **G5** — No re-engagement layer (tab title, PWA, push).
- **G6** — Death overlay passive, no respawn affordance.
- **G7** — Boon pickups + enhancement failures silent/weak.
- **G8** — Daily reset countdown invisible on mobile.

## Recommendations

See [MOBILE_GAMEPLAY_AUDIT.md](../../MOBILE_GAMEPLAY_AUDIT.md) for full rationale per item; condensed list here:

### Phase 1 — Quick wins (<1hr each)

1. **P1.1** Tab-title badge on level-up (S · Re-engagement +3)
2. **P1.2** Skill-point toast (S · Near-miss +2, Completion +2) ⚠ **hard-rule flag**: cleanest fix is gameplay-code; safe-zone alt uses MutationObserver on `player.skillPoints`. User decision needed.
3. **P1.3** Rotate-nag dismissal → localStorage (S · quit-point removal)
4. **P1.4** XP-bar near-level pulse (S · Near-miss +3)
5. **P1.5** Daily-banner visible + countdown (S · FOMO +3, Loss +2)
6. **P1.6** Damage-number reposition on mobile (S · Flow +2) ⚠ may need gameplay touch; safe-zone alt is post-append DOM reposition.
7. **P1.7** Haptic on legendary drops (S · Variable-ratio +2)
8. **P1.8** Streak-at-risk toast (S · Loss +3, Re-engagement +2)
9. **P1.9** Next-advancement chip in HUD (S · Progress overview +3)
10. **P1.10** Death-overlay tap-to-respawn (S · Flow +2) ⚠ may need gameplay touch if `respawnAtTown` isn't accelerable.

### Phase 2 — Structural additions (2–4hr each)

1. **P2.1** Unified "Next Goal" HUD widget (M · Progress +4, Completion +2, Near-miss +2, Loss +1) — **highest single ROI**.
2. **P2.2** Achievement/bestiary inline progress toasts (M · Completion +3, Near-miss +2)
3. **P2.3** First-run mobile coach marks (M · onboarding)
4. **P2.4** Streak-at-risk notification push (M · Loss +3, FOMO +3, Re-engagement +3)
5. **P2.5** Haptic + audio on silent pickups (M · Variable-ratio +2)
6. **P2.6** PWA manifest + service worker (M · Re-engagement +4)

### Phase 3 — Big bets (6hr+ each)

1. **P3.1** Companion Panel (slide-up meta-progression view) (L · 4 levers)
2. **P3.2** Rotating visibility-change tab-title system (L · Re-engagement +3)
3. **P3.3** Mobile-native share card on new PB (L · Social proof +3)

## Ranked ship order (by ROI)

See [MOBILE_GAMEPLAY_AUDIT.md § ROI-ranked action list](../../MOBILE_GAMEPLAY_AUDIT.md#roi-ranked-action-list) for the full table. Top 3:

1. **P2.1** — unified Next-Goal widget
2. **P1.1** — tab-title badge
3. **P1.3 + P1.5 + P1.8** bundle — rotate-nag + countdown + streak-at-risk

## Critical files + existing APIs to reuse

- `maple_game.html` — the single file. Edit only inside the safe zones in the `.claude/hooks/mobile-zone-check.py` table.
- Reuse `showToast`, `audio.play`, `flash`, `addShake`, existing body-classes.
- Save-format additions: `localStorage` keys with `_mobile_` prefix only. Never touch `PLAYER_SAVE_FIELDS` (line 4051) or `GAME_SAVE_FIELDS` (line 4060).
- Full reuse map in [MOBILE_GAMEPLAY_AUDIT.md § Critical files](../../MOBILE_GAMEPLAY_AUDIT.md#critical-files--existing-apis).

## Verification plan

Per-item checks in [MOBILE_GAMEPLAY_AUDIT.md § Verification plan](../../MOBILE_GAMEPLAY_AUDIT.md#verification-plan). Summary:

- **Pre-commit:** extract `<script>` and `node --check`.
- **Post-commit:** load `raw.githack` preview on an iPhone-sized viewport, verify the specific trigger fires.
- **Commit message:** include `verification:` block describing exact steps.
- **Changelog:** every shipped commit adds an entry to `MOBILE_CHANGELOG.html`.
- **Regression risk:** all mobile-gated via `@media (pointer: coarse)` or matching JS check; desktop stays unchanged.
