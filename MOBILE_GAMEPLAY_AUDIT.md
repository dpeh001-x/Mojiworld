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

Each item ships as an atomic commit. All land inside mobile safe zones.

### P1.1 · Tab-title badge on level-up 🟢 S
- **Psychology lever:** Re-engagement (+3), Completion bias (+1)
- **What:** On each `gainExp` level-up branch, push `document.title = '⭐ Lv ' + player.level + ' — LevelX';`. When the tab loses focus, enqueue a pulse-animation via existing toast system.
- **Anchor:** JS hook in mobile safe zone 3612–3797. Add a `document.addEventListener('visibilitychange', ...)` listener that sets `document.title` based on current `player.level`. Revert to static title on focus.
- **Why it works:** The browser tab is the #1 retention surface for web games. Zero-cost reminder in the user's existing workflow.
- **Reuse:** `player.level` (already global), no new save fields.

### P1.2 · Skill-point toast on level-up 🟢 S
- **Psychology lever:** Near-miss reinforcement (+2), Completion bias (+2)
- **What:** After a level-up, fire `showToast('+1 Skill Point — open Skills (I)', 'rare')` at line 10751 area (where `audio.play('levelup')` sits). Wrapped in an `if (window.matchMedia('(pointer: coarse)').matches || isMobile())` check so desktop isn't doubled.
- **Anchor:** **NOTE — this one requires a 2-line addition in gameplay code (line ~10724/10751) and would violate the mobile hard rule.** *Alternative mobile-only implementation:* MutationObserver in the mobile JS zone watching `player.skillPoints` via a periodic tick, synthesize the toast when the counter increments. Slightly indirect but safe-zone-local. **Flag to user: confirm before shipping.**
- **Why it works:** The level-up fanfare is loud but the actionable reward is invisible. This converts a silent gain into a clear CTA.

### P1.3 · Rotate-nag dismissal persists across reloads 🟢 S
- **Psychology lever:** Friction reduction; not a lever proper, but removes a quit-point.
- **What:** At line 3767–3769, replace `document.body.dataset.nagDismissed = '1'` with a pair of writes — dataset AND `localStorage.setItem('_mobileNagDismissed', '1')`. On the nag-evaluation path earlier (which sets `body.nag-portrait`), read localStorage first and early-return if set.
- **Anchor:** JS safe zone 3612–3797. ~6 lines total.
- **Why it works:** Current behavior re-nags on every page load; an already-dismissed user re-learns "close this banner" daily.

### P1.4 · XP-bar near-level pulse 🟢 S
- **Psychology lever:** Near-miss reinforcement (+3)
- **What:** Pure CSS. When `player.exp / player.expToNext > 0.9`, add `body.xp-near` (set from an existing mobile JS tick). CSS in safe zone 65–334 applies a 0.8s pulse-glow animation on the XP fill element.
- **Anchor:** CSS rule in MOBILE CONTROLS (v5) block; JS toggle in mobile-init block. Uses `player.exp` / `player.expToNext` already in scope.
- **Why it works:** The last 10% of any bar is the Casino rule — visible "almost there" drives one-more-kill.

### P1.5 · Daily-banner default-visible + countdown timer 🟢 S
- **Psychology lever:** FOMO (+3), Loss aversion (+2)
- **What:** Add CSS override in safe zone 65–334: `@media (pointer: coarse) { #daily-banner { display: block !important; } }`. Plus a tiny JS tick (once per minute) that appends `… resets in 5h 32m` to the banner using `Date.now()` vs next UTC midnight.
- **Anchor:** CSS + JS mobile safe zones. Reads `dailyState` (no writes).
- **Why it works:** The banner already exists, already has a progress bar and streak counter. Mobile just hides it.

### P1.6 · Route damage numbers out of bottom-right quadrant 🟢 S
- **Psychology lever:** Flow state (+2)
- **What:** CSS/JS tweak that, on mobile, clamps the spawn Y of damage numbers to ≤ 340 (well above the face button cluster). Read `player.y` via `document.body.classList.contains('mc-portrait')` gate.
- **Anchor:** Existing `#damage-numbers` container styling in mobile safe zones; no combat-code touch required if done via CSS transform overlay.
- **Note:** Full implementation requires a small JS helper in mobile safe zone that repositions nodes after they append. *If this requires touching combat code, flag before shipping.*

### P1.7 · Haptic vibrate on legendary drop / boss kill 🟡 S
- **Psychology lever:** Variable-ratio reinforcement (+2)
- **What:** Wrap a mobile-only call `if (navigator.vibrate) navigator.vibrate([60, 40, 60])` triggered by a MutationObserver on toast DOM nodes that have `.rarity-legendary` / `.epic` class. Zero gameplay touch.
- **Anchor:** JS safe zone 3612–3797. Observer on toast container.
- **Why it works:** Haptic is a mobile-only feedback channel the game doesn't use yet.

### P1.8 · "Streak at risk" localStorage check 🟢 S
- **Psychology lever:** Loss aversion (+3), Re-engagement (+2)
- **What:** On page-load, if `player.dailyState.streak > 1` AND `Date.now() + 2*3600*1000 > nextUTCMidnight`, show a toast `"⚠ 2h left to keep your X-day streak"` plus pulse the daily banner for 3s.
- **Anchor:** JS safe zone; reads `player.dailyState` (existing save field).
- **Why it works:** Turns a passive streak into an urgent cue. Loss aversion is ~2× the pull of equivalent gain.

### P1.9 · Mobile-only "next advancement" countdown chip 🟢 S
- **Psychology lever:** Progress overview (+3)
- **What:** A small badge in the mobile-ctrl HUD region (safe zone 1147–1167). Content: if `player.level < 25`, shows `→ Job in N`; if 25 ≤ level < 50, shows `→ Master in N`; if ≥ 50, shows `→ Ascend in N` or hides.
- **Anchor:** New `<div id="adv-chip">` in DOM safe zone; CSS in CSS safe zone; data reads from `player.level` (existing). One-line JS tick to update.
- **Why it works:** Removes the 25-level flat zones between advancement tiers.

### P1.10 · Death overlay: add "Tap to respawn" affordance 🟢 S
- **Psychology lever:** Flow state (+2)
- **What:** Mobile-only override. CSS in safe zone 338–419 (adjacent to rotate-nag zone): add pointer-events:auto on an inner element inside `#death-overlay`; attach click that speeds up the existing respawn timer to completion. If respawn is gameplay-timer-driven and can't be accelerated safely: flag to user.
- **Anchor:** `#death-overlay` (1030–1066). Ideally call an existing respawn helper. *If no safe accelerator exists, flag.*
- **Why it works:** Removes a dead-air moment on every death.

### Phase 1 flagged items (hard-rule checks)

- **P1.2 (skill-point toast)** — cleanest implementation is 2 lines at line ~10751. That's gameplay code. Proposing MutationObserver-on-counter as the safe-zone alternative. **User decision needed.**
- **P1.6 (damage-number clamp)** — may require touching the emit site in combat code. Proposing post-append DOM reposition in mobile JS as alt. **User decision needed.**
- **P1.10 (respawn accelerator)** — depends on whether `respawnAtTown` exposes a skip function. If not, flag.

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
