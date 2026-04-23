# LevelX Mobile Gameplay Audit

**A cold-readable design audit for mobile players on iPhone portrait.**

_Scope: mobile-only improvements implementable in the `mobile-ui-pass` branch's safe zones. Does not touch gameplay code. Generated 2026-04-23 from cross-confirmed findings of 3 parallel Explore agents (rewards / progression / retention)._

---

## Top 3 — if you do nothing else

_Filled in below._

---

## Table of contents

1. [Executive summary](#executive-summary)
2. [Psychology scoring (12 levers)](#psychology-scoring-12-levers)
3. [Cross-confirmed gaps](#cross-confirmed-gaps)
4. [ROI-ranked action list](#roi-ranked-action-list)
5. [Phase 1 — Quick wins (<1hr)](#phase-1--quick-wins-1hr)
6. [Phase 2 — Structural additions (2–4hr)](#phase-2--structural-additions-24hr)
7. [Phase 3 — Big bets (6hr+)](#phase-3--big-bets-6hr)
8. [Critical files + existing APIs](#critical-files--existing-apis)
9. [Verification plan](#verification-plan)
10. [Psychology-lever glossary](#psychology-lever-glossary)

---

## Executive summary

LevelX on mobile is **mechanically solid but feedback-starved**. Combat, controls, scaling, and modal tappability all work (after recent fixes). What's missing is the thin layer of *visible progress and reward* that keeps a phone player engaged between kills. Three agents independently identified the same root cause from different angles:

- **Rewards are silent on mobile.** XP gain, skill-point earns, boon pickups, combo milestones fire without toast or HUD animation. Particles spawn at monster death coordinates and often land behind the d-pad/face-button clusters.
- **Progression is modal-gated.** Job / master / skill-tree / milestone / bestiary / achievement progress all require opening a menu to see. On mobile every modal is a 2-tap cost — and none of these systems surface a "next milestone" on the HUD.
- **Retention hooks don't exist.** No tab-title updates, no localStorage return-hints, no PWA manifest, no daily countdown timer. Once the tab closes, the player has zero pull back.

Estimated impact of shipping the Phase-1 quick-wins list: **~10-15% reduction in first-hour bounce** (per Agent C). None of the Phase-1 items require gameplay-code changes — every one lives inside a mobile safe zone.

---

## Psychology scoring (12 levers)

Scores reflect the **mobile player's** experience, not desktop. A category scoring low isn't necessarily broken in the game — it may just be invisible on a phone.

| # | Lever | Score | Backed by | Top recommendation | Lift | Effort |
|---|---|---|---|---|---|---|
| 1 | Variable-ratio reinforcement | **6/10** | Enhancement RNG (11632), rarity tiers via luck, boss drops partly guaranteed | Add "lucky moment" overlay — 10% chance kill spawns brighter particle burst with haptic | +2 | S |
| 2 | Loss aversion | **5/10** | HP bar reddens, streak resets silently | HUD warning badge when daily streak is <2h from expiry | +3 | M |
| 3 | Completion bias | **6/10** | Codex + bestiary + achievements exist, but all modal-gated on mobile | Top-left HUD badge: `🏆 3/15` achievement counter | +2 | S |
| 4 | Social proof | **2/10** | Tower best floor + combo record locally; no global | localStorage-only "personal best" nudges; tab-title cue on new PB | +2 | M |
| 5 | FOMO | **3/10** | Daily quests reset at UTC midnight, invisible countdown | Visible countdown in daily banner (add `Math.ceil(msToUTCMidnight/3600000)h` label) | +3 | S |
| 6 | Endowment effect | **7/10** | Name + gender + hair/skin/eye + class + cosmetics all persist | Already strong — surface cosmetic unlock progress on mobile HUD | +1 | M |
| 7 | Progress overview | **3/10** | No unified "next up" anywhere on mobile | Mobile-only "Next Goal" widget: rotates between nearest milestone (job/master/prestige/daily/cosmetic) | +4 | M |
| 8 | Near-miss reinforcement | **2/10** | XP bar silent at 95%; combo meter static | Pulse the XP bar at >90%; combo-meter grows/glows nearer each 50-hit threshold | +4 | M |
| 9 | Re-engagement | **1/10** | No tab title, no PWA, no notifications, no localStorage reminders | Tab-title badge (`LevelX ⭐ Lv12`) + localStorage "streak at risk" check on page load | +4 | M |
| 10 | Mastery curve | **7/10** | Class → job → master → skill tree → prestige chain is well-shaped (gameplay) | Out of scope on this branch | — | — |
| 11 | Flow state | **6/10** | Combo system helps; mobile button occlusion interrupts flow when feedback lands behind clusters | Route damage numbers to center-safe zone when player is in bottom-right quadrant | +2 | M |
| 12 | Identity / self-expression | **6/10** | Customization exists but cosmetic unlock paths are opaque on mobile | Surface current cosmetic progress in codex banner (e.g. `🦂 3/10 scorpion kills`) | +2 | M |

**Weakest three (priority targets):** Re-engagement (1), Near-miss (2), Social proof (2).
**Single highest-leverage fix:** Unified "Next Goal" mobile HUD widget — pulls Progress-overview (+4), Completion-bias (+2), Near-miss (+2), Loss-aversion (+1) simultaneously.

---

## Cross-confirmed gaps

_Filled in below._

---

## ROI-ranked action list

_Filled in below._

---

## Phase 1 — Quick wins (<1hr)

_Filled in below._

---

## Phase 2 — Structural additions (2–4hr)

_Filled in below._

---

## Phase 3 — Big bets (6hr+)

_Filled in below._

---

## Critical files + existing APIs

_Filled in below._

---

## Verification plan

_Filled in below._

---

## Psychology-lever glossary

_Filled in below._
