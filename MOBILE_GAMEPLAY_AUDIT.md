# LevelX Mobile Gameplay Audit

**A cold-readable design audit for mobile players on iPhone portrait.**

_Scope: mobile-only improvements implementable in the `mobile-ui-pass` branch's safe zones. Does not touch gameplay code. Generated 2026-04-23 from cross-confirmed findings of 3 parallel Explore agents (rewards / progression / retention)._

---

## Top 3 — if you do nothing else

1. **P2.1 Unified "Next Goal" mobile HUD widget** — pulls 4 psychology levers at once and closes the single biggest gap (G4).
2. **P1.1 Tab-title badge + P3.2 rotating visibility-change title** — the *only* re-engagement surface that works in iOS Safari without notification permission. Currently at 1/10.
3. **P1.3 + P1.5 + P1.8** (3-item bundle) — rotate-nag persistence, daily countdown, streak-at-risk. Together fix both loss-aversion (5→8) and FOMO (3→6) for one hour of total work.

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

Ordered high → low ROI (psychology-lever-points gained ÷ effort hours). Impact legend: 🟢 high · 🟡 medium · ⚪ nice-to-have.

| Rank | ID | Title | Impact | Effort | Levers pulled | ROI |
|---|---|---|---|---|---|---|
| 1 | P2.1 | Unified "Next Goal" widget | 🟢 | M (3h) | Progress overview +4, Completion +2, Near-miss +2, Loss +1 | ⭐⭐⭐ |
| 2 | P1.1 | Tab-title badge on level-up | 🟢 | S (20m) | Re-engagement +3, Completion +1 | ⭐⭐⭐ |
| 3 | P1.3 | Rotate-nag persistence | 🟢 | S (15m) | Friction removal (quit-point kill) | ⭐⭐⭐ |
| 4 | P1.5 | Daily-banner visible + countdown | 🟢 | S (30m) | FOMO +3, Loss aversion +2 | ⭐⭐⭐ |
| 5 | P1.8 | Streak-at-risk toast | 🟢 | S (40m) | Loss aversion +3, Re-engagement +2 | ⭐⭐⭐ |
| 6 | P1.4 | XP-bar near-level pulse | 🟢 | S (25m) | Near-miss +3 | ⭐⭐⭐ |
| 7 | P1.9 | Next-advancement chip | 🟢 | S (40m) | Progress overview +3 | ⭐⭐⭐ |
| 8 | P2.6 | PWA manifest + install | 🟢 | M (3h) | Re-engagement +4 | ⭐⭐ |
| 9 | P2.3 | Mobile coach marks | 🟢 | M (4h) | Onboarding conversion | ⭐⭐ |
| 10 | P3.2 | Rotating visibility-change tab title | 🟡 | L (8h) | Re-engagement +3, Social proof +1 | ⭐⭐ |
| 11 | P2.2 | Achievement/bestiary inline progress | 🟢 | M (3h) | Completion +3, Near-miss +2 | ⭐⭐ |
| 12 | P2.4 | Streak-at-risk notification push | 🟡 | M (4h) | Loss +3, FOMO +3, Re-engagement +3 | ⭐⭐ |
| 13 | P1.7 | Haptic on legendary drop | 🟡 | S (30m) | Variable-ratio +2 | ⭐⭐ |
| 14 | P1.10 | Death overlay tap-to-respawn | 🟢 | S (30m) | Flow +2 | ⭐⭐ |
| 15 | P2.5 | Haptic + audio on silent pickups | 🟡 | M (2h) | Variable-ratio +2, Flow +1 | ⭐⭐ |
| 16 | P1.6 | Damage-number reposition | 🟡 | S (45m) | Flow +2 | ⭐⭐ |
| 17 | P1.2 | Skill-point toast (via observer) | 🟢 | S (1h) | Near-miss +2, Completion +2 | ⭐ (needs hard-rule decision) |
| 18 | P3.1 | Companion panel | 🟢 | L (8h) | Progress +4, Endowment +2, Identity +2, Completion +3 | ⭐⭐ |
| 19 | P3.3 | Mobile share card | 🟡 | L (10h) | Social proof +3, Identity +2 | ⭐ |

**Recommended ship sequence:** top 7 (P2.1 + 6 Phase-1 items) ships in ~5-6 hours total and lifts scores on 6 of 12 levers. That's weekend-one material.

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

### P2.1 · Unified "Next Goal" mobile HUD widget 🟢 M
- **Psychology levers:** Progress overview (+4), Completion bias (+2), Near-miss (+2), Loss aversion (+1)
- **What:** A single 28-40px pill in top-right stack that cycles (every ~5s) through the player's nearest milestone: next job/master level, next achievement (by lowest remaining %), next cosmetic unlock, nearest daily quest goal, nearest skill-tree unlock. Each entry shows "→ Target (X of Y)".
- **Implementation:** New `<div id="goal-chip">` in DOM safe zone 1147–1167. CSS in safe zone 65–334. JS tick in safe zone 3612–3797 reads existing state (`player.level`, `player.dailyState`, `game.achievements`, `game.bestiary`) — pure read layer, no writes.
- **Data sources (all existing, no save migration):**
  - Job/master: `player.level` vs `JOB_ADVANCE_LEVEL` / `MASTER_ADVANCE_LEVEL`.
  - Achievements: `game.achievements` vs `ACHIEVEMENTS` definitions.
  - Bestiary cosmetics: `game.bestiary` vs `COSMETICS` (lines 11843-11862).
  - Daily: `player.dailyState`.
- **Why it works:** Agent B's biggest gap. Pulls the 4 weakest levers simultaneously. Highest-ROI single item in the audit.

### P2.2 · Achievement / bestiary progress in-line on kill 🟢 M
- **Psychology levers:** Completion bias (+3), Near-miss (+2)
- **What:** After monster death, peek ahead in the achievement + bestiary tables to see if this kill contributed to a goal within 5 of completion. If yes, subtle toast: `'🦂 9/10 — one more for Ember Cape!'`
- **Implementation:** MutationObserver on `game.bestiary` counts (or periodic delta-check on a mobile JS tick, polling once per second). All reads, no writes.
- **Anchor:** `game.bestiary` (line 11868–11871), `trackPickup()` (11867), `COSMETICS` definitions (11843–11862).
- **Note:** If bestiary updates are sync-only via gameplay code, a periodic delta-detect loop in mobile safe zone is equivalent — uses 0% CPU at idle.

### P2.3 · First-run mobile coach marks 🟢 M
- **Psychology levers:** Friction reduction, Onboarding conversion
- **What:** After the class-select modal closes for the first time, overlay 3 pointer arrows (one per mobile button cluster) with labels — "← move", "attack", "menu ↑". Each auto-dismisses on first relevant button press or 5s timeout. Never shows again (localStorage flag).
- **Implementation:** Mobile-only DOM in safe zone 1147–1167; CSS in safe zone 65–334 or 338–419; JS listener in safe zone 3612–3797.
- **Anchor:** Existing `body.forced-modal` observer can be extended — detect transition-off on `#class-select-modal` and fire once if `!localStorage.getItem('_mobileCoachSeen')`.
- **Why it works:** Agent C estimates ~10% of new mobile players bounce before learning controls.

### P2.4 · Streak-at-risk notification + countdown 🟡 M
- **Psychology levers:** Loss aversion (+3), FOMO (+3), Re-engagement (+3)
- **What:** Combines P1.5 (countdown) + P1.8 (at-risk toast) + adds: if browser `Notification` permission is granted, fire a push ~1h before UTC midnight when `player.dailyState.streak > 2`. Escalate from passive banner → pulsing banner → notification → (when reset imminent) full-screen overlay on next load.
- **Implementation:** `Notification.requestPermission()` gated behind an explicit opt-in button we add to the daily banner. All timing data already in save. Persistent timer via `setInterval` in mobile init.
- **Note:** Browser notification API is fully standards-based, no backend needed.

### P2.5 · Haptic + audio cue on silent pickups 🟡 M
- **Psychology levers:** Variable-ratio (+2), Flow (+1)
- **What:** MutationObserver on boon inventory array; when a new entry appears, fire `navigator.vibrate(40)` + `audio.play('pickup')` (reuse existing sound). Catches G7 (silent pickups).
- **Implementation:** Mobile safe zone JS.
- **Reuse:** `audio.play` exists globally.

### P2.6 · Progressive-Web-App manifest + install prompt 🟢 M
- **Psychology levers:** Re-engagement (+4)
- **What:** Add `manifest.webmanifest` (new file at repo root) + `<link rel="manifest">` in `<head>`. Register a minimal service worker (in-repo file) that caches the single HTML and enables home-screen install. No offline-game support initially — just the install prompt.
- **Implementation:** New files; `<head>` edit at line 5-15 (mobile meta-tags safe zone). Service worker script referenced by `<script>` tag that could sit at end-of-body.
- **Note:** iOS Safari doesn't auto-prompt, but "Add to Home Screen" from the share sheet will produce a standalone PWA. Android Chrome auto-prompts.
- **Scope check:** `<head>` edits around lines 5-15 are inside the mobile meta-tag safe zone 7-10. Safe.

---

## Phase 3 — Big bets (6hr+)

### P3.1 · Full mobile-only "Companion Panel" 🟢 L
- **Psychology levers:** Progress overview (+4), Endowment (+2), Identity (+2), Completion bias (+3)
- **What:** A slide-up panel (accessed by tapping a new ☰ button in the mobile HUD) that consolidates all progression on one screen: character name + look, level + XP, skill points waiting, next advancement ETA, 3 nearest achievements, 3 nearest cosmetic unlocks, daily quest + streak + countdown, recent PBs (combo, tower, super-boss clear time), cosmetics owned.
- **Implementation:** New DOM node in safe zone 1476–1512, full-width slide-up animation. Reads every existing state field. No writes.
- **Why it works:** Collapses 5 different menu modals into a single thumb-friendly view. Desktop doesn't need it — menu keys are fine there.

### P3.2 · Persistent mobile meta-progression mini-dashboard via tab title 🟡 L
- **Psychology levers:** Re-engagement (+3), Social proof (+1)
- **What:** A rotating tab-title system that periodically updates to show the most urgent/rewarding pending action: `⭐ Lv12` → `✨ +1 SP ready` → `🔥 3-day streak` → `⚔ Boss ready` → cycle. Uses `document.visibilityState === 'hidden'` to switch into "attention mode" with animated ellipsis.
- **Implementation:** ~80 lines of JS in mobile safe zone. `visibilitychange` listener + `setInterval` for title rotation while hidden. Dataset of message rules (what to show when).
- **Why it works:** Most mobile players have LevelX in a background tab after a session. This is the single re-engagement surface that works on iOS Safari without notification permission.

### P3.3 · Mobile-native replay / share card 🟡 L
- **Psychology levers:** Social proof (+3), Identity (+2)
- **What:** On boss kill or new PB, capture a 1600x900 canvas snapshot via `canvas.toBlob`, overlay the hero name + stats + kill time, offer native share sheet via `navigator.share({ files: [...] })`. On desktop / unsupported browsers, just download.
- **Implementation:** New canvas composer function in mobile safe zone, triggered by hooking existing "new record" toast events via MutationObserver. No gameplay-code edits.
- **Why it works:** Free social proof — every shared card is organic acquisition.

---

## Critical files + existing APIs

### Mobile safe zones (editable — per `CLAUDE.md` + `.claude/hooks/mobile-zone-check.py`)

| Range | Content | Used by |
|---|---|---|
| 7–10 | mobile meta tags | P2.6 (PWA manifest link) |
| 33 | body `touch-action` | — |
| 65–334 | MOBILE CONTROLS (v5) CSS | P1.4 (XP pulse), P1.5, P1.9, P2.1, P2.3 |
| 338–419 | `#rotate-nag` CSS + portrait-nag media query | P1.3, P1.10 |
| 484–605 | MOBILE TOUCH CONTROLS CSS | — |
| 1147–1167 | rotate-to-landscape nag + `#mobile-ctrl` HUD overlay | P1.9, P2.1, P2.3, P3.1 |
| 1476–1512 | MOBILE CONTROL DECK DOM | P3.1 (companion panel mount point) |
| 3612–3797 | MOBILE / TOUCH CONTROLS JS + FULLSCREEN FIT | All Phase-1 JS (P1.1, P1.3, P1.4, P1.5, P1.7, P1.8, P1.9, P1.10), all Phase-2 JS, P3.2, P3.3 |

### Existing APIs to reuse (no new abstractions)

- `showToast(text, rarity)` — toast notifications. Rarity values: `'common' | 'rare' | 'epic' | 'legendary'`. Anchored around lines 2330-2400.
- `audio.play('levelup' | 'pickup' | etc.)` — sound cues; globals on `audio`.
- `flash(alpha)`, `addShake(n)`, `addHitStop(ms)` — feel helpers (lines 4042-4044).
- `player.exp`, `player.expToNext`, `player.level`, `player.skillPoints`, `player.dailyState`, `game.achievements`, `game.bestiary`, `game.prestige`, `game.towerBestFloor` — all read-only from the mobile layer.
- `document.body.classList` — already used for `forced-modal`, `mc-portrait`, `mc-landscape`, `nag-portrait`, `hide-mobile-ctrl`. Add `xp-near`, `streak-risk`, `adv-ready` for new triggers.
- `localStorage` — save key is `'levelx_save_v1'`. For new mobile-only flags, **prefix all keys with `_mobile_`** to avoid clashing with the main save format. No migration needed since these are pure-mobile additions.

### Save format — do not touch

- `PLAYER_SAVE_FIELDS` (line 4051) and `GAME_SAVE_FIELDS` (line 4060) are shared with main. Never add fields here from the mobile branch.
- Any new persistent state goes to dedicated `localStorage` keys with the `_mobile_` prefix.

---

## Verification plan

Per-item and end-to-end checks. Every commit should include a `verification:` block matching this pattern.

### Per-item verification

- **P1.1 Tab-title badge:** Level up, switch tabs, confirm title becomes `⭐ Lv N — LevelX`. Switch back, confirm revert.
- **P1.3 Rotate-nag persistence:** Dismiss nag, reload page, confirm no re-nag. Delete `localStorage._mobileNagDismissed`, confirm nag returns.
- **P1.4 XP-bar pulse:** Set `player.exp` so ratio > 0.9, confirm CSS `xp-near` class applied and animation fires. Drop ratio, confirm class removed.
- **P1.5 Daily countdown:** Open banner at 00:30 UTC, confirm countdown shows ~23h. At 23:50 UTC, confirm ~10m. Loop over midnight rollover.
- **P1.8 Streak-at-risk:** Set `player.dailyState.streak = 5` + set clock to 22:00 UTC. Reload, confirm toast. Set streak to 1, confirm no toast. Set time to 10:00 UTC with streak 5, confirm no toast.
- **P1.9 Next-advancement chip:** At Lv 10 expect `→ Job in 15`. At Lv 25 expect `→ Master in 25`. At Lv 55 expect `→ Ascend in N` or hidden.
- **P2.1 Next-goal widget:** Confirm cycles every 5s across all active tracks. Confirm no stale data when daily quest flips. Confirm mobile-only (hidden on desktop).
- **P2.6 PWA:** Chrome Android: add-to-home-screen prompt surfaces. iOS Safari: share sheet → "Add to Home Screen" produces standalone app. Service worker registers without errors.

### End-to-end smoke

Per the v2 guardrails, each commit includes a short `verification:` block. Also run:

```bash
# JS syntax check on the extracted <script> block:
awk '/<script>/{flag=1;next}/<\/script>/{flag=0}flag' maple_game.html > /tmp/x.js
node --check /tmp/x.js
```

### Regression risk

All changes land inside mobile safe zones. Worst case: a mobile HUD element misbehaves — revert a single commit, no gameplay impact. Zero-risk for desktop: every new behavior is gated by either `@media (pointer: coarse)` or `window.matchMedia('(pointer: coarse)').matches`.

### Changelog discipline

Every shipped commit on `mobile-ui-pass` adds an entry to `MOBILE_CHANGELOG.html` matching existing styling (pill tag `bug`/`feat`/`polish`, `<kbd>` for keys). Audit items are `feat` unless they fix a reported issue.

---

## Psychology-lever glossary

Terse definitions for the 12 levers scored above.

1. **Variable-ratio reinforcement** — rewards whose timing/magnitude are random. Slot machines; loot boxes. Drives the highest sustained engagement of any schedule.
2. **Loss aversion** — the pain of losing X is ~2× the pleasure of gaining X. Streaks, decay, expiring buffs, warnings.
3. **Completion bias** — humans are compelled to finish started sets. Collection shelves, owned-ticks, "8/10" counters.
4. **Social proof** — seeing others do / want something raises your own desire. Leaderboards, rivals, "X% of players".
5. **FOMO (fear of missing out)** — time-limited content triggers urgency. Events, daily-resets, seasonal cosmetics.
6. **Endowment effect** — you value things more when you own them. Naming, customizing, long-term persistence.
7. **Progress overview** — a single glanceable "what's next" reduces cognitive load; absence creates dead zones.
8. **Near-miss reinforcement** — the last 10% of a goal feels more rewarding than the first 10%. Louder bars near cap.
9. **Re-engagement** — surfaces outside the game that pull the player back. Push, email, tab title, home-screen icon.
10. **Mastery curve** — escalating challenge matched to growing skill. Too easy → bored; too hard → quit.
11. **Flow state** — a tight action loop with continuous feedback that feels timeless. Broken by UI interruptions.
12. **Identity / self-expression** — the player can make themselves visible. Cosmetics, titles, shareables.

---

_Audit built 2026-04-23 from 3 parallel Explore agents. All Phase-1/2 items are implementable inside mobile safe zones; Phase-3 items include notes on which fragments would require gameplay-code edits if any. Hard-rule flags are called out per item. Questions or corrections: open an issue or ping via the PR._
