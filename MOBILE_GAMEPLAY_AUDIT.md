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

Gaps flagged independently by ≥2 agents. Anchored by file + line in `maple_game.html`.

### G1 · Level-up is visually loud, but the *skill-point gain* is silent
- Agents A + C agree: `gainExp()` at `maple_game.html:10706–10744` spawns 30 particles + DOM `.level-up` element + `audio.play('levelup')`, but **no toast** for "+1 Skill Point" (line 10724: `player.skillPoints += 1`).
- Mobile impact: the player sees fireworks but doesn't learn they can now spend a point. Menu access is a 2-tap cost they won't make without a prompt.

### G2 · XP bar fills silently between kills
- Agent A: `killMonster` (line 10550–10636) adds XP with zero dedicated feedback — only the HUD bar increments.
- On a 320px iPhone viewport the bar is ~200px wide; incremental gains are sub-pixel for several kills.

### G3 · Particles/damage-numbers routinely spawn under the mobile button clusters
- Agent A: monster death → 15 particles at `m.x + m.w/2, m.y + m.h/2`. Damage numbers at `player.x + 14, player.y - 14`.
- D-pad zone: canvas X 0–156, Y 404–560. Face buttons: X 776–960, Y 376–560.
- Combat commonly happens in the bottom quadrants; feedback vanishes behind translucent button overlays.

### G4 · Progression systems are entirely menu-gated on mobile
- Agent B: job advancement countdown (invisible pre-Lv 25), master/prestige race at 50, skill-tree AP-available cue, milestone unlocks on stat thresholds, bestiary cosmetic-unlock counters, achievement progress — **none** surface a "next up" affordance on the HUD.
- Agent C adds: daily banner (`#daily-banner` line 1577) defaults to `display:none`, so the *only* progression actively surfaced on mobile fails to show unless toggled.

### G5 · No re-engagement layer exists
- Agent C: static `<title>` (line 5) never updates. No `manifest.json`, no service worker, no `navigator.serviceWorker.register()`, no `Notification` permission flow.
- Rotate-nag dismissal isn't localStorage-persisted (line 3767–3769) — it resets every refresh.
- Result: a closed tab is a lost player.

### G6 · Death overlay is passive and unresponsive
- Agent C: `#death-overlay` (lines 1030–1066) has `pointer-events: none`, no respawn button, 1.6s fade.
- Agents A + C flag this as an anti-flow moment on mobile where input feels frozen.

### G7 · Silent pickups
- Agent A: powerup orbs (`spawnPowerupOrb:5152`) play no sound and fire no toast on collection — the player only learns they picked something up by opening the boons menu.
- Enhancement *failure* (line 11661) fires a plain toast with no rarity color — visually identical to any minor notification.

### G8 · Daily reset has no visible countdown
- Agents B + C: `dailyIndex()` at line 4595 uses `Math.floor(Date.now() / 86400000)` — UTC midnight boundary. Nothing on mobile HUD tells the player when it flips.
- Combined with G5: a player with a 3-day streak has zero mobile signal of "come back in 4h to preserve it."

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
