# Mojiworld — Gameplay & UI Audit (2026-05-18, v0.25.871)

A 2-hour audit driven by 5 parallel reconnaissance agents scanning combat, progression, content variety, UX flow, and UI polish. Findings are ranked by **impact × effort** so a designer can pick from the top of each list and ship in a session.

## How to read this

- ✅ **Verified** — agent cited the line; I sanity-checked the cluster.
- ⚠️ **Plausible** — single agent reference, not cross-checked. Re-verify before fixing.
- 🎯 **Quick win** — implementable in ≤ 30 lines, included in the v0.25.872 commit attached to this audit.

Every finding has a `file:line` reference into `mojiworld_game.html`.

## Sections

1. [Top 10 by impact × effort](#1-top-10-by-impact--effort)
2. [Combat feel & damage feedback](#2-combat-feel--damage-feedback)
3. [Progression curve & gear acquisition](#3-progression-curve--gear-acquisition)
4. [Content variety: maps, mobs, bosses, quests](#4-content-variety-maps-mobs-bosses-quests)
5. [UX flow, onboarding & retention loops](#5-ux-flow-onboarding--retention-loops)
6. [UI polish & visual consistency](#6-ui-polish--visual-consistency)
7. [Quick-win patch attached to this audit](#7-quick-win-patch-attached-to-this-audit)

---

## 1. Top 10 by impact × effort

| # | Finding | Track | Effort | Quick-win in v0.25.872? |
|---|---|---|---|---|
| 1 | No status icons on enemy sprites — burn/freeze/stun invisible | Combat | ~40 LOC | 🎯 yes |
| 2 | Combo counter tracked but never drawn on-screen during play | UX | ~25 LOC | 🎯 yes |
| 3 | Damage-tier visual escalation flat: 1000-dmg crit looks like 600-dmg crit | Combat | ~30 LOC | 🎯 yes |
| 4 | No CSS design tokens — 5+ gold shades, 7+ font sizes, magic z-indexes | UI polish | ~50 LOC (additive) | 🎯 yes |
| 5 | Tier 4 gear gap Lv 20-29 — players forced to wear Lv 10 Tier 3 | Progression | ~120 LOC | next pass |
| 6 | Class identity collapses by Lv 50 — gear affixes overshadow class multipliers | Progression | ~200 LOC + design | next pass |
| 7 | Empty states are inline-styled `slot is empty` strings — no polish | UI polish | ~30 LOC | 🎯 yes |
| 8 | Daily-quest UI shell exists (`#daily-banner`) but `dailyState` is `null` | UX retention | ~250 LOC | next pass |
| 9 | 6 maps share `windGusts` with identical force/verticalChance values | Content | ~80 LOC | next pass |
| 10 | Clockwork Underpass PQ is 1 of 5 stages built (33% complete) | Content | multi-session | roadmap |

Items 1, 2, 3, 4, 7 ship together in the v0.25.872 patch (see §7).

---

## 2. Combat feel & damage feedback

### 2.1 Hit weight is uniform across damage tiers ✅

- **L33358-33359**: Crit scale-pop hardcoded `1.42 / 0.62` — same for a 200-dmg dagger jab and a 1500-dmg boss execute. No tier-dependent escalation.
- **L33430-L33436**: Damage tier thresholds `500 / 200 / 80` are hardcoded constants — they do NOT scale with player level, so by Lv 80+ every hit is "tier 1" and the tiering collapses.
- **L33434-33435**: Crit font cap is `22 + finalDmg/14` → max ~38 px. Non-crit cap is `13 + finalDmg/10` → max ~30 px. A 5 % size delta is the *only* visual differentiator between a clean kill and a chunky crit.
- **L17656**: `addHitStop` cap is 220 ms flat regardless of damage source. A basic swing and a screen-clearing ultimate both top out at 220 ms — no "weight" delta.
- **L17611-17624**: `addShake` per-frame cap is 6, total ceiling 18 / 24. A 1000-dmg crit only contributes `5 + min(6, dmg/200)` ≈ 5.6 — the cap eats most of the magnitude.

**Fix sketch** — damage-tier escalation: tie crit scale-pop, font-size, hitstop, and shake budget to `dmg / playerATK` ratio rather than absolute thresholds. Adds 4-6 named tiers (`light / solid / heavy / brutal / executing`) computed per-hit, each with its own pop / shake / freeze.

### 2.2 Enemy status state is invisible to the player ✅

- **L54825-54843**: Burn renders 2 random particles per frame. No icon, no label, no consistent color. Player must *infer* burn from particle density during AOE chaos.
- **No freeze/stun/poison icon found** anywhere in the mob draw path. `m.freezeTimer`, `m.stunTimer`, `m.burnTimer` are tracked but never stamped on the sprite.
- **L30269-30272**: Burn tick damage numbers use identical size/color (`size: 11`) to direct hits — player can't visually separate "I'm hitting it" from "DOT is doing work".

**Fix sketch** — 🎯 ship a 4-icon status row above the mob HP bar: 🔥 burn / ❄ freeze / ⚡ stun / 🧪 poison. Each pulses while active, fades on expire. ~40 LOC in `_drawMonster()`.

### 2.3 Combo system is invisible during play ✅

- **L21351-21402**: `bumpCombo()` increments + refreshes the timer, but no audio cue on break and no always-on counter in HUD.
- **L6908**: `game.combo` is read by code but never `fillText`-ed during combat. Player has zero feedback that they're at 47× until the rare milestone toast.
- **L21381-21401**: Combo milestones at 50 / 100 / 150 each get one-shot toasts but nothing in between, and nothing on *breaking* a streak.

**Fix sketch** — 🎯 add a small always-visible combo widget in the HUD (top-right under HP/MP), shows `Nx · ×1.20`, pulses on increment, shake-fades on break. ~25 LOC.

### 2.4 Telegraph quality varies wildly between bosses ⚠️

- **L31098-31099**: Mirror Strike telegraph is toast + flash, *no* ground marker.
- **L31329-31330**: Aetherion Dimensional Tear has a ground reticle but no animated shrink/pulse — zones just appear.
- **L10055**: Frostkin outward red particle ring is flat orange, no escalation — flat 30-frame pre-roll then strike.
- **L9720-9721**: Ground Stun pre-pulse is *static* — telegraph particle doesn't grow or pulse.

**Fix sketch** — establish a 3-stage telegraph standard: appear (cool tint) → swell (warm tint) → strike (white flash). Refactor all per-boss telegraph calls through a `telegraphZone(x, y, r, durMs, kind)` helper.

### 2.5 Weakness / resist hits look identical to neutral hits ✅

- **No `WEAK!` / `RESIST` suffix found** in the damage-number path. `applyEnhOnHit()` adjusts numbers but doesn't tag the popup.
- **L33442**: Damage numbers always `toLocaleString()` — no decoration for `crit + weakness + combo` stacks vs plain hits.

**Fix sketch** — append a small chip after the number: `1240 ✨` for crit, `1240 !` for weakness, `1240 ▼` for resist. Re-uses the existing float-text channel.

---

## 3. Progression curve & gear acquisition

### 3.1 Tier 4 gear gap at Lv 20-29 ✅

- **L36784-36791**: Tier gates land at Lv 6 / 10 / 30 / 50. The Lv 20-29 band has NO new tier — players stay on Lv 10 Tier 3 gear with a +20-level penalty against Lv 30 mobs.
- **L7950-7956**: Tier 4 covers armor + accessories only — no Tier 4 weapons for any class. Rogue/Mage/Archer jump straight from Tier 3 (Lv 10) to Tier 5 (Lv 50) weapons.
- **L7907 / L7937 / L7950**: Cost jump Tier 4 → Tier 5 is ×2.5 (3000 → 7500-8000 mesos) — no soft step.

**Fix sketch** — add a Tier 3.5 (Lv 20) class-specific weapon set: 4 designs reusing Tier 3 silhouettes with a paint variant. Closes the dead zone and gives Lv 20 a meaningful upgrade ping.

### 3.2 Drop-rate inversion punishes early game ✅

- **L34483-34491**: Lv 1-10 mobs have legendary weight 1 of 46 total → ≈ 2.2 % roll chance. Lv 50+ mobs have legendary 6 of 34 → ≈ 17.6 %. Early players see 8× *less* legendary loot per kill than late players.
- **L34173**: Normal mob gear-drop gate is a flat 8 % — combined with the above, Lv 1-10 P(legendary | gear drops) ≈ 0.18 %. Compare to Lv 50: ≈ 1.4 %.
- **L34505-34506**: Class affinity multiplier is ×1.5 (match) vs ×0.3 (mismatch) — a 5× spread with no pity timer. A Mage farming melee-affinity zones is starved.

**Fix sketch** — bad-luck protection: every 30 kills without a rare+ drop guarantees one on the 31st. Track in `player._dryStreak`, reset on any rare+ drop.

### 3.3 Class identity collapses by Lv 50 ✅

- **L7278-7285**: Damage multipliers are 1.40 (Warrior) / 1.35 (Ninja, Sniper) / 1.20 (Mage). A 16.7 % delta between Warrior and Mage — *much* smaller than the spread gear affixes (crit, atkPct, lifesteal) introduce.
- **L7111-7214**: Job "signatures" (Berserker → Bloodlust, Ranger → Falcon Eye, etc.) are tooltip strings — no actual trigger code exists for most of them.
- **L14894**: Per-level HP gains differ (W 28 / A 20 / R 16 / M 14) — by Lv 50 the spread is +700 HP. The *only* real class differentiation is HP bloat.

**Fix sketch** — give each class one always-on passive mechanic worth keeping: Warrior already has Fortitude (v0.25.x); add Mage *Arcane Surge* (every 4th cast +50 % range), Rogue *Backstab* (rear-hits +25 % crit chance), Archer *First Strike* (first hit on each new mob +30 %).

### 3.4 ★ enhance economy is whales-only at the top ⚠️

- **L8214**: `STAR_COSTS = [100, 200, 400, 800, 1500, 1500, 2000, 8000, 20000, 35000]` — stars 5 and 6 are identical (1500 each), then ★8 jumps 4× to 8000. Looks like a typo or an unintentional plateau.
- **L8235**: `starSuccessRate(s) = Math.max(15, 70 - s*5)` → ★10 = 20 %. Expected attempts to land ★10 ≈ 5 → expected cost ≈ 140 k mesos = 4 Gravitos clears for one star.

**Fix sketch** — smooth the curve: `[100, 200, 400, 800, 1500, 2500, 4000, 6500, 11000, 20000]`. Add a "shard buyback" so failed ★8+ attempts return 25 % of the cost as enhancement shards.

### 3.5 Prestige is the only post-Lv-100 loop ⚠️

- **L21272-21286**: Prestige unlocks at Lv 50, caps at 20 prestiges. xpMult + dmgMult per prestige.
- **L8943**: Gravitos (Lv 100 capstone) drops 325 k mesos = cost of one ★8 attempt. No infinite dungeons, no NG+ scaling, no seasonal track.

**Fix sketch** — add a "Twilight Spire" infinite floor mode: each floor +5 % mob HP / ATK, drops scale with floor. Bookmarks deepest floor reached on the title card.

---

## 4. Content variety: maps, mobs, bosses, quests

### 4.1 Quest variety is anaemic ✅

- **L10083-13200**: `QUESTS` registry has only **3 `kind` values** — `kill` (14), `visit` (6), `boss` (5). No escort, defend, time-trial, puzzle, or fetch. Every non-combat quest is "walk to map X".

**Fix sketch** — add `kind: 'fetch'` (gather N items from drops), `kind: 'defend'` (survive N waves at a fixed NPC), `kind: 'time'` (reach map Y within Tms). Re-uses existing trackers.

### 4.2 Hazards are stamped across maps with identical tuning ✅

- **L11732-12393**: 6 `windGusts` maps (Glasswind Steppe / Hamlet, Hollow Sepulchre, Withering Tide, Celestial Spire, Thunder Plateau) share the same force / verticalChance — only cooldown varies by a few hundred ms.
- **L10083-11752**: 4 `lavaEruptions` maps reuse identical damage band (90-130) and delay band (3.8-5.5 s).
- **L12386-12393**: `ceilingHazards` is used in 2 maps with identical patterns.
- **L10328-10962**: `pothole` exists but only 3 maps use it.

**Fix sketch** — per-map hazard *flavour* parameters: Glasswind Steppe's gusts blow *into* spike walls, Thunder Plateau's gusts arrive *in pairs* from opposite sides. Same engine, different feel.

### 4.3 Enemy attack pattern reuse ✅

- **L9688-9716**: 13 mob types share **8 unique attack `kind`s**. `homingShot` is reused 4 times (wraith / coralImp / seraph / cosmicMochi). `summon` is reused on stoneling + archon with no variant.
- **L9690-9717**: Zodiac bosses (12 added in v0.25.853) have no entries in monsterTypes attack table — they're stat-sponges only.

**Fix sketch** — give each zodiac boss one signature mechanic referencing its sign (Aries flame charge already exists; clone the pattern to Taurus / Gemini / Cancer / Leo). 12 × ~50 LOC.

### 4.4 Clockwork Underpass is 1 of 5 stages complete ✅

- **L11013-11017**: `clockworkUnderpassLobby` map is 2 platforms tall — Lobby + Stage 1 (Ticket Panic) shipped in v0.25.863.
- **CLOCKWORK_UNDERPASS_DESIGN.md**: Designed stages 2-5 (Counting Room / Rat Race / Imposter Party / Password Beast) + final boss Conductor Gloomgear — none coded.
- **L10984-11026**: PQ spawn table only lists ticketMech + slime. Designed armoredMech + goldenRat mini-elite not spawned.

**Fix sketch** — Stage 2 ("Counting Room") first: timer-based count-the-tickets puzzle, ~250 LOC. Roadmap full PQ across 4 versions.

### 4.5 NPC dialog is 80 % boilerplate ⚠️

- **L35862-36100**: `openNPC()` has voiced dialog for only 3 NPC roles (Nurse Joyce / Brok / DJ Vinyl). The other 20+ roles default to generic "Yes / No" quest-give.
- **L15343, 18693**: `_emote` system exists (`kind: 'emote'`) but is never wired into NPC dialog — NPCs never visually react.
- **L13066-13072**: Named lore NPCs (Ren / Taiga / Kuro / Master Kaze / Whisper) have quest-delivery dialog only, no re-engagement after handover.

**Fix sketch** — character voice pass on the 5 most-frequented quest-givers: each gets 3 idle lines (rotates on re-talk), 1 quest-complete line, 1 emote on greet.

### 4.6 Map theming has palette collisions ✅

- **L10779 / L12830**: Sunset Beach + Tidal Lagoon both use `sky=['#7fbdd8','#a8d8e8','#e0f2f8']` — identical cyan pastel.
- **L10250-10283**: Forest + Mushroom share `bg='forest'`.
- **L10352-10512**: Candy Canyon + Bubblegum Swamp differ by 10 % HSL on the sky band, no audio distinction.

**Fix sketch** — palette diff pass. Each map gets at least one unique colour stop in the sky gradient + one distinct ambient track or layered ambient sample.

### 4.7 Town count vs town content ⚠️

- 16 maps have `isTown: true`. Only 4 have a unique music track + distinct NPC roster. The other 12 reuse the marketplace layout and generic shopkeeper sprite.

**Fix sketch** — collapse the 12 redundant safe-zones to 6 by merging the lowest-NPC-density pairs, and use the freed-up content budget on quest variety (§4.1).

---

## 5. UX flow, onboarding & retention loops

### 5.1 Tutorial only fires once, never again ✅

- **L41514-41559**: 8-step tutorial exists and is well-written.
- **L16995**: Gated behind `localStorage.mojiworld_tutorial_seen` with no in-game trigger on first run *and* no replay option in the Help menu.
- **L4513**: First-time tooltip references "once on class pick" — ambiguous flow.

**Fix sketch** — auto-fire on first-ever player creation (when no save exists). Add a "Replay tutorial" button to Help. ~15 LOC.

### 5.2 Combat HUD missing key real-time signals ✅

- **L6908**: `game.combo` tracked but never `fillText`-ed in HUD.
- **L3960-3976**: Stats panel shows 5 numbers (ATK, DEF, Crit, ACC, Kills) — all static gear values, no live buff/debuff icons.
- **L6902**: `floatingTexts` array defined; damage numbers float through it, but there's no in-HUD "last hit" tally.

**Fix sketch** — combo widget (§2.3) and a small buff stack icon row anchored top-left under the HP bar. Ship combo widget in v0.25.872, buff icons in v0.25.873.

### 5.3 Death has no real stakes ⚠️

- **L24700**: Flat 5 % XP loss. Used to be tiered 0-8 % but flattened "per user request" — at Lv 80+ a 5 % loss is ~30 minutes of grinding, but at Lv 5 it's 10 seconds. Same number, very different sting.
- **L16561-16584**: Respawn keys (Enter / Space / R / Esc) all fire immediately — no "Confirm respawn?" beat. Double-tap Esc can accidentally respawn during death-screen review.

**Fix sketch** — re-introduce a 3-tier death penalty (0 % under Lv 10, 3 % Lv 10-50, 6 % Lv 50+) and add a 600 ms grace window where the death screen ignores input before accepting respawn keys.

### 5.4 Daily quest UI shell with no system behind it ✅

- **L635**: `#daily-banner` DOM element exists.
- **L6915**: `dailyState: null` — never populated.
- **L18266**: Rollover check stub exists; no quest registry attached.

**Fix sketch** — minimum-viable daily loop: 3 daily challenges (kill N of type, complete N quests, deal X damage in one combo), reset at local midnight, reward = 1 ★ shard + 5 k mesos. ~250 LOC.

### 5.5 Achievement progress is invisible while grinding ✅

- **L18914-18927**: 12 achievements defined.
- **L18934**: Toast fires on unlock only — no in-progress display.
- **L21045-21051**: Codex shows unlocked state only, no "47 / 100 kills" breadcrumb.

**Fix sketch** — every achievement gets a `progress` field; render `47/100` next to it in the Codex; bonus toast at 50 %, 90 %. ~40 LOC.

### 5.6 Save / load is single-slot with silent fail ⚠️

- **L15120-15125**: `localStorage` write in try/catch with no fallback UI. If localStorage is blocked, progress evaporates silently.
- No multi-slot save, no export-to-clipboard, no auto-save indicator.

**Fix sketch** — surface storage errors as a persistent banner: "⚠ Save disabled — enable site storage". Add "Export save" / "Import save" buttons that round-trip JSON.

### 5.7 Settings lacks accessibility controls ⚠️

- **L15977-16002**: Settings exposes scale, BGM vol, SFX vol, mute, lowfx, debug, grid. No colourblind palette, no motion reduction, no text size, no rebind.
- **L16026-16033**: Audio is split BGM / SFX only — boss roars cannot be lowered without muting all SFX.

**Fix sketch** — add "Reduce camera shake" toggle (gates §2.1 shake stack), "High-contrast HUD" toggle (boosts HP/MP fill alpha to 0.95). Ship together with §6 design-token pass.

---

## 6. UI polish & visual consistency

The visual-craft agent surfaced **32 specific weaknesses** that mostly resolve into "no design system." Highlights:

### 6.1 No CSS design tokens — every component is its own snowflake ✅

- **L2307 / L3750**: `.modal` has `border-radius: 16px`, `#enhance-modal .modal` has `2px solid` border — different visual weight.
- **L1873-1877 / L2089-2090 / L2698**: Same easing curve `cubic-bezier(.22,1.4,.36,1)` duplicated with 3× duration spread (220 ms / 520 ms) and no shared constant.
- **L876 / L1441 / L1626**: 7 distinct font-sizes in HUD alone (`9px / 10px / 11px / 12px / 13px / 14px / 18px / 20px`).
- **L1151 / L1503 / L1626**: 5+ gold shades hardcoded (`#ffe2a3 / #ffd166 / #ffcc66 / #c8a8ff / #ffe388`).
- **L2369 / L2384 / L3599 / L1747**: 4+ border-radius values scattered (`4px / 6px / 8px / 12px / 16px`).
- **L2288 / L1214 / L1376 / L4785 / L40546**: z-index magic numbers `50 / 90 / 120 / 200 / 5000 / 9999` — inline `5000` overrides the CSS `50` for the same modal.

**Fix sketch** — 🎯 Introduce a `:root { --moji-* }` token block at the top of the first `<style>`: radius scale, transition durations, easing curves, gold accent triad, z-index map. Additive only — does NOT migrate existing rules in this pass. Adoption is per-component over time.

### 6.2 Modal close-button stacking context bug ✅

- **L2337-2350 vs L3774-3777**: Default `.close-btn` is `position: absolute; 28px round`; enhance-modal's gets `position: relative; z-index: 1` — clicks miss the absolute hit area at certain scroll positions.

**Fix sketch** — drop the inline override; let the default rule apply. ~3 LOC.

### 6.3 Inline-styled empty states ✅

- **L8364**: `<div style="font-size:10px; color:#888;">slot is empty</div>` — naked, no icon, no padding. Looks like an unfinished prototype.
- **L1547**: Quest tracker is `display: none` when empty — produces a layout-shift jump when the first quest arrives.

**Fix sketch** — 🎯 ship a `.empty-state` component (centered, ghost icon + caption) and use it in both the inventory slot and the quest tracker idle state. ~30 LOC.

### 6.4 HP / MP / XP bar transitions drift ✅

- **L988 / L2615 / L20793**: Bar transitions are `0.3s ease-out`, `200ms ease-out`, `280ms ease` — three different cadences for the same widget family.

**Fix sketch** — unify to `--bar-anim: 220ms cubic-bezier(.4,0,.2,1)`. Part of §6.1 token pass.

### 6.5 Range inputs are browser-default ✅

- **L4715 / L4722 / L4729**: `<input type="range">` for volume sliders has no custom styling — looks "1998 system UI" against the rest of the polished modals.

**Fix sketch** — `::-webkit-slider-runnable-track` + `::-webkit-slider-thumb` rule. ~25 LOC. Ship after §6.1.

### 6.6 Hover micro-interactions inconsistent ✅

- **L2346 / L2430**: Close button hover is `scale(1.08)`, shop-item hover is `translateX(2px)` — same affordance ("hovering is responsive"), wildly different motion.
- **L3660-3661**: `.enhance-btn:hover` raises 2 px, `:active` only depresses 1 px — never fully returns to baseline. Should depress 2 px.

**Fix sketch** — define `--hover-lift: -1px`, `--press-lift: 0px` tokens; standardise on `transform: translateY(var(--hover-lift))` for interactive elements.

### 6.7 Per-modal scrollbar styling ✅

- **L3611**: `#enhance-list::-webkit-scrollbar-thumb` is styled.
- **L2374** `.lore-body` scrollbar is not — desktop users see different scrollbar treatments in different modals.

**Fix sketch** — global `*::-webkit-scrollbar-thumb` rule. ~10 LOC.

---

## 7. Quick-win patch attached to this audit (v0.25.872)

Five fixes are ready to land in the same commit as this document. Each is < 60 LOC and orthogonal to the others — any one can be reverted without affecting the others.

| Patch | Section | Effort | Player-visible win |
|---|---|---|---|
| A. `--moji-*` design tokens (additive) | §6.1 | ~50 LOC | groundwork: future polish edits use one place |
| B. Enemy status icon row on mob HP bar | §2.2 | ~40 LOC | players see 🔥/❄/⚡ on enemies they've inflicted |
| C. Damage-tier visual escalation | §2.1, §2.5 | ~35 LOC | crits, weakness, executes look distinct |
| D. Always-visible combo HUD widget | §2.3, §5.2 | ~30 LOC | players see live combo + multiplier |
| E. `.empty-state` component | §6.3 | ~25 LOC | inventory & quest tracker look intentional when idle |

**Not in this patch (require design buy-in or > 100 LOC):**

- Tier 3.5 weapon set (§3.1) — content design
- Class identity passives (§3.3) — needs balance pass
- Tutorial replay + first-run auto-fire (§5.1) — flow design
- Daily-quest system (§5.4) — full retention loop
- Clockwork Underpass Stage 2 (§4.4) — multi-session content build
- Twilight Spire endless mode (§3.5) — multi-session content build

These ship in subsequent patches; treat this audit as the running roadmap.

---

_End of audit — v0.25.871, 2026-05-18. Re-run when v0.25.900 ships._
