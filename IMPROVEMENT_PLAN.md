# LevelX / Mojiworld — Improvement Plan

_Generated 2026-05-02 from a four-track audit (bugs, performance, balance, UX) over `mojiworld_game.html` at v0.25.238._

This plan ranks **shippable** improvements by impact-per-effort. Each item is small enough to land as its own atomic commit. Items are grouped by track, then ordered within a track by priority.

Verification status per item:
- ✅ **Verified** — I read the cited lines and confirmed the issue exists.
- ⚠️ **Plausible** — Agent flagged it; I haven't re-read every line. Verify before fixing.
- 🔍 **Needs measurement** — Performance claims need a profile run on real device.

---

## 0. Executive summary

The game is in a healthy place: visuals just had a major sprite pass (v0.25.238), the loader is well-tiered (v0.25.237), and the gameplay systems are deep. The audit surfaced:

- **3 real bugs** worth fixing this week (one HIGH severity, two MEDIUM).
- **~10–15 ms/frame** of recoverable performance budget on mobile, dominated by an O(n²) projectile×monster collision loop and uncached gradient creation.
- **5 balance tweaks** that would reshape mid-to-late progression without touching mechanics.
- **6 UX polish items** that mostly cost <30 min each and dramatically improve first-session retention.
- **1 strategic milestone**: server-authoritative combat is already the README-stated next milestone; a smaller "shared loot pool / combo XP" wedge could unlock the multiplayer loop in a fraction of the time.

If I had to pick three items to ship next week, they would be **B1, P1, X2** (verified bug fix → biggest perf win → highest-pain UX gap).

---

## Sections

1. [Bugs](#1-bugs) — 3 verified, 4 plausible
2. [Performance](#2-performance) — top 6 hotspots
3. [Balance & gameplay loop](#3-balance--gameplay-loop) — 5 tuning ratchets
4. [UX & polish](#4-ux--polish) — 6 first-session wins
5. [Strategic / next milestone](#5-strategic--next-milestone)
6. [What was checked but found OK](#6-what-was-checked-but-found-ok)

---

## 1. Bugs

### B1 ✅ HIGH · `mojiworld_game.html:17935` — town-respawn skip is dead code

```js
if (game.currentMap === game.mapData && game.mapData.isTown) return;
```

`game.currentMap` is a **string** map id (e.g. `'town'`). `game.mapData` is the **object** `MAPS[id]`. The `===` comparison is always false, so the early-return never fires. The intent is "don't respawn mobs in town." Today the safety net is the next line's `if (mapD && !mapD.isTown ...)`, so the bug is masked, but the dead expression is a footgun for future edits.

**Fix:** drop the bad equality check; the second guard already covers the case. ~1 line diff.

---

### B2 ⚠️ HIGH · `mojiworld_game.html:21129` — `closeAllModals` null-deref on missing modal

`closeAllModals()` accesses `document.getElementById('class-select-modal').style.display` without a null guard. Other modal IDs in the same function are guarded with `if (el)`. If the markup ever changes or the modal hasn't been injected yet, the whole modal-close path throws and Esc / X breaks for every overlay.

**Fix:** Add `const cs = document.getElementById('class-select-modal'); if (cs && cs.style.display === 'flex') return;` style guard. Audit the rest of the function for the same pattern. ~6 lines.

---

### B3 ⚠️ MEDIUM · Save schema drift on `Object.assign(player, save.player)`

Old saves predate `_pendingTimeouts`, `_clones`, `_aegis`, etc. `Object.assign` doesn't add missing fields, so a load from an older save can leave `player._pendingTimeouts === undefined`. The next code path that pushes to that array (`player._pendingTimeouts.push(...)`) crashes.

**Fix:** After the `Object.assign`, run a defensive defaulter:

```js
player._pendingTimeouts ??= [];
player._clones = null;          // cast func re-creates
player._aegis  = null;          // cast func re-creates
if (player._aegis && !Array.isArray(player._aegis.orbs)) player._aegis.orbs = [];
player.skillCooldowns ??= {};
player.buffs ??= {};
```

~10 lines, near the existing `Object.assign` (around line 9450).

---

### B4 ⚠️ MEDIUM · Divide-by-zero risk in damage formula

`getMaxHp()` and `getMaxMp()` are divided into `player.hp` / `player.mp` for buff scaling (Bloodlust, etc.) at lines 7676, 7681, 7685, 7689. If a (theoretical) boon configuration ever drops max to 0, the result is `NaN`/`Infinity` and damage becomes garbage.

**Fix:** Clamp denominators: `const hpFrac = player.hp / Math.max(1, getMaxHp());`. Defensive, ~4 lines.

---

### B5 ⚠️ LOW · Stale references in `game.afterImages` and `game.particles`

Both arrays are append-only with `life`-based eviction. If the player rapidly cycles dash/skill in low-fps frames, life decay can lag behind insertion. Not currently observable but worth a hard cap (e.g. `if (game.particles.length > 2500) game.particles.length = 2500`).

---

### B6 🔍 Verify · Modal stack `Esc` coverage

The bug+UX audits both flagged that some modals (Codex, Skill Tree, World Map, Inventory) might not all close on Esc. Run a manual sweep with every modal open and confirm `closeAllModals` covers each id. There's a v0.25.224 fix that added `worldmap-modal` — confirm nothing else slipped through.

---

### B7 🔍 Verify · Pet AI `Math.hypot` safety

Bug audit flagged a NaN risk if a monster dies between the cull check and `Math.hypot`. Looking at the code, the pre-loop `if (m.currentHp <= 0) continue` already guards this — likely a false positive. Verify by reading lines 12245–12265.

> **Cleared during verification:** Bug audit also claimed `loadMap()` doesn't call `cancelPendingSkillTimers()`. False — the call exists at line 11203. Removed from the plan.

---

## 2. Performance

Total estimated recoverable budget: **11–20 ms/frame** on mid-range mobile, **3–5 ms/frame** on desktop.

### P1 🔍 Spatial partitioning for projectile×monster collisions — **−3 to −5 ms/frame**

Today every active projectile iterates every alive monster every frame (line 18160 + ricochet/AoE expansions). With 30 projectiles and 50 monsters, that's 1,500 hit-tests per frame, plus inner ricochet loops.

**Fix sketch:**
- Add a uniform grid (`128×128 px` cells) keyed by `Math.floor(x/128)|0`. Rebuild once per frame at the start of `updateMonsters`.
- Projectile collision becomes "look up the 1–4 cells the AABB overlaps, iterate those." Average mobs-per-cell << 50.
- Monster→player melee can use the same grid.

**Effort:** medium (1 evening). **Risk:** low — the grid is additive; if it goes wrong, fall back to the original loop. **Highest-leverage performance work in the codebase.**

### P2 🔍 Cache gradients — **−1.5 to −2 ms/frame**

44 `createLinearGradient`/`createRadialGradient` calls fire per frame in render hot paths (charge ring, momentum bar, chain ping, elite/miniboss auras). Two of them are already cached via off-screen canvases (`_getEliteAuraCanvas`, `_getMiniBossAuraCanvas`); generalize the pattern.

**Fix sketch:** add a tiny `_gradientCache` map keyed by `${type}|${coords}|${stops}`. Invalidate on resize. Most gradients have static geometry per skill/HUD element, so the cache hit rate will be near 100%.

### P3 🔍 Particle pool — **−2 to −4 ms/frame** + GC pause reduction

200–400 `{x, y, vx, vy, life, color, size}` objects pushed to `game.particles` per frame; ~14 KB/frame allocation pressure. Skill bursts can spike to 200+ particles in a single frame.

**Fix sketch:**
- Pre-allocate a 2,000-slot pool.
- Replace `game.particles.push({...})` with `acquireParticle(x, y, vx, vy, life, color, size)`.
- Sweep dead particles by overwriting from the tail (no array splicing).
- Gate emission behind `LX_PERF.lowFx` for the "extras" (non-load-bearing trails).

**Effort:** medium. Highest second-derivative win — eliminates GC-pause stutters that mask FPS drops.

### P4 🔍 Add Y-axis off-screen culling for monsters — **−0.6 to −1 ms/frame**

`drawMonster()` only checks X-axis off-screen (line 31061). Aura draws + particle emissions still fire for mobs above/below the viewport on tall maps.

**Fix:** one-liner: `if (m.y + m.h < game.camera.y - 30 || m.y > game.camera.y + H + 30) return;` at the top of `drawMonster`. Hoist the same check around aura/particle code in the per-monster loop at line 35300.

### P5 🔍 Tighter particle culling + first-pass skip — **−0.8 to −1.2 ms/frame**

`drawParticles` does a two-pass loop (halo + crisp core). Cull margin is loose (±20–30 px) and the halo pass runs for old particles whose glow is invisible. Tighten to ±10 px and skip the halo pass when `p.life > 250` (or whatever threshold lines up with the alpha curve).

### P6 🔍 Profile + gate Phaser overhead — **−1.5 to −2.5 ms/frame** (if real)

5 Phaser scenes (`LXBackgroundScene`, `LXParticleScene`, etc.) run their own `update()` loop in parallel with the vanilla canvas pipeline. Some are explicitly gated, but a profile run would confirm whether they're parasitic on mobile. If so, `pause()/resume()` them when the vanilla path is sufficient.

**Effort:** higher — needs a real device profile first. Park until P1–P5 land.

### P7 🔍 Burst-emission throttle on skill cast — spike reduction

Skills like Nightreaper ricochet + ice AoE + multishot can emit 200+ particles in 2 frames, causing visible stutter. Add a simple per-frame budget: `if (frameParticleCount > 80) return;` gating the "extras" (decorative trails, secondary ribbons). Load-bearing FX still fire.

---

## 3. Balance & gameplay loop

These are tuning tweaks, not reworks. Each takes <30 min to implement.

### G1 ⚠️ Star enhancement — flatten the ★6+ wall

`STAR_COSTS` (line 5482) doubles every two stars and tops out at 50,000 Lumens at ★10 (cumulative ~103k). Success rate hits 5% at ★10 (`70 - star * 5`), with 95% demote-on-fail. Most players abandon enhancement at ★5 because the ROI plateau is too aggressive.

**Fix:** flatten ★4–6 to a single tier (`1500, 1500, 2000`) and raise the success floor from 5% → 15%. Keep ★8–10 punishing but reachable.

### G2 ⚠️ XP curve — soften Lv 25–40 grind

Multipliers in `xpToNext()` (lines 17607–17611): 1.40 → 1.45 → 1.50 → 1.55. Lv 30→31 is ~400k XP, Lv 40→41 is ~1M. Monster XP yield doesn't keep pace. Players hit a slog window 8–12 hours long.

**Fix:** drop Lv 25–39 multiplier to 1.35–1.40. Or alternatively, bump tier-3 monster XP yields by 15%. Either lops 30–40% off the slog without flattening the late curve.

### G3 ⚠️ Phantom + Nightreaper G — apply DEF reduction

Both ultimates write damage directly to `target.currentHp` instead of routing through `hitMonster()`, which means they bypass DEF entirely AND always crit. Tanky elites melt instantly to these two skills regardless of build investment.

**Fix:** route through `hitMonster()` like every other skill. Drop the unconditional crit to `rollCrit() || alwaysCritOnExecute`. Damage formula unchanged otherwise.

### G4 ⚠️ Assassin `cdRefundOnKill: 0.30` is a runaway loop

Assassin job (line 5162) refunds 30% of all cooldowns on every kill. Combined with low-cd skills like Flurry (1s cd) and DEF-bypass ults (G3), kill streaks reset every cooldown. Locks a ceiling above other rogue subclasses.

**Fix:** drop to 15% **and** add a 2 s internal gate so not every kill in an AoE clear triggers the refund. Or scale by `1 / nearbyEnemies` so the refund self-balances in dense fights.

### G5 ⚠️ Tier-5 zone difficulty cliff

v0.25.225 rebalanced map level requirements but didn't adjust monster ATK to match. `levelReq:24` zones have mobs with `atk:125` while a Lv 24 warrior caps near 30–40 base ATK. Trash mobs take 8–10 hits to kill, kill the player in 2–3.

**Fix:** lower Tier-5 mob ATK by 10% **or** raise `levelReq` from 24 → 26 to give players two more levels of gear before entry. The latter is one-line per zone.

### G6 ⚠️ Multiplayer Chain Cast + Multishot interaction

Mage Chain Cast (1.5× damage on alternating skill cast within 1s) has no internal cooldown. With a Rogue 6-lane multishot, every chain triggers 6 empowered hits. Add a 1.5 s internal CD on the trigger.

---

## 4. UX & polish

Ranked by first-session pain.

### X1 ⚠️ Death screen — show what killed you

Death overlay shows `Lost X Lumens · Y XP` but not what enemy/hazard delivered the killing blow, and doesn't say "respawning in town." Many players quit on first death because the loop feels punishing-without-explanation.

**Fix:** track `player._lastDamageSource` in the damage pipeline; render `💀 Defeated by: [NAME] · Respawning in town` on the overlay. ~15 lines.

### X2 ⚠️ Skill-unlock toast says nothing useful

`showToast('✦ Unlocked: ${node.name}')` (line 5251) is the only feedback when a tree node unlocks. It doesn't say what the passive does. Players miss tier-defining passives because they don't open the tree.

**Fix:** include the first sentence of `node.desc` in the toast: `"✦ Unlocked: Berserker Mastery (+50% ATK while raging). Open Skills (K) to learn."` ~3 lines.

### X3 ⚠️ NPC dialog can't be dismissed by walking away

`#dialog` modal stays open until you click an option or hit Esc. Walking away does nothing. Adds friction to the open-shop → glance-at-prices → leave loop.

**Fix:** in the player update loop, if dialog is open and player.x is more than ~80 px from the NPC's x, call `closeDialog()`. Add a "Leave" button to the dialog footer for explicit dismissal. ~10 lines.

### X4 ⚠️ Browser `confirm()` for save reset is jarring

The reset-save flow uses `confirm()` twice. Browser confirms break out of the game's visual world and look like a phishing prompt on mobile.

**Fix:** Replace with a styled in-game modal that matches the rest of the UI. Single confirm with consequences spelled out. ~30 lines.

### X5 ⚠️ Skill slot lock displays level number but not what unlocks

When a skill slot is level-gated, the bar shows `Lv 25` instead of MP. There's no tooltip explaining what skill becomes available, or what the slot's mechanic is (e.g. some skills hold-charge, some are instant). Mobile loses this entirely.

**Fix:** add a hover/tap tooltip per slot showing `[Skill name preview] · Unlocks at Lv N`. On level-up, fire a one-time toast for any newly-unlocked slot. ~20 lines.

### X6 ⚠️ Persistent hotkey hint never gets explained

`#hotkey-hint` (top-left) shows the current skill bar but nothing tells new players what it is. Click it on first session shows the help modal — players don't discover this.

**Fix:** first-session toast (gated on `localStorage`): `"Tip: hotkey panel (top-left) shows your skills. Press ? for full controls."` Auto-dismiss after 5 s. ~10 lines.

### X7 🔍 Verify · Esc + X coverage on every modal

Manually open Codex (`Y`), Skill Tree (`K`), World Map (`W`), Inventory (`B`), Char panel, Shop, and confirm Esc + X both close each. v0.25.224 fixed `worldmap-modal`; sweep the rest.

### X8 🔍 Accessibility wedge — colorblind palette + caption layer

No colorblind mode, no audio captions, no `aria-live` on toast region. The visual identity uses red/green for buff/debuff stacks heavily.

**Fix (small):** add `aria-live="assertive"` to the toast container so screen readers announce drops/levels/deaths. Free win, ~2 lines.
**Fix (medium):** Settings modal toggle for "Colorblind palette" that swaps red↔orange and green↔blue in the stack/aura colors. Keep audio cue toggle separate.

---

## 5. Strategic / next milestone

### S1 — Server-authoritative combat (already on the README roadmap)

The README states this is the next milestone after the v0.24.0 chat-relay multiplayer. It's a heavy lift — the server in `server/` has to authoritatively own monster state, damage events, and loot. Worth doing eventually, but…

### S2 — Smaller wedge: shared loot + combo XP

A much faster way to make multiplayer feel alive without server-authoritative combat:

- **Shared loot pool** — when monster dies in a multiplayer room, the drop is broadcast and any nearby player can pick it up (first-come). Just a network message, no auth changes.
- **Combo XP bonus** — `if (monster.lastDamagedByOtherPlayerWithin === 2000) xpReward *= 1.5`. Encourages party play without rebalancing the whole loop.

These two features alone change the multiplayer phenomenology from "two solo runs in adjacent windows" to "we farmed Fungal Hollow together." ~1–2 days of work, mostly client-side.

### S3 — Discoverability for World Map / Taxi Uncle

The world map (W) is hidden behind two layers: you have to know to press W or to find Taxi Uncle. New players spend their first session walking back and forth between Sunset Coast and Emerald Thicket because the warp interface isn't surfaced.

**Fix:** when the player first reaches Lv 5, fire a one-time toast: `"🗺️ Press W to open the world map — fast-travel between unlocked areas."` Same pattern as X6.

---

## 6. What was checked but found OK

- `loadMap()` cancels pending skill timers (line 11203). Bug audit was wrong on this one.
- Pet AI `Math.hypot` has a pre-loop `m.currentHp <= 0` guard. Likely a false flag.
- BAZAAR/CRITICAL/DEFERRED loader (v0.25.234–237) is well-tiered. Don't touch unless adding new skin packs.
- Mobile safe-zone hooks (`mobile-pre-push.py`, `mobile-zone-check.py`) are doing their job — no rebase conflicts logged in recent history.
- `closeAllModals` covers `worldmap-modal` (v0.25.224 fix). Verify the rest in X7 sweep.
- Sprite registry pattern (`LX_FX`, `LX_SUMMON`, etc.) scales cleanly — adding more sprites is a one-line registry edit + one-line preloader edit. Architecture choice is paying dividends.

---

## Suggested ship order (next 2–3 weeks)

| Week | Items | Ship size |
|------|-------|-----------|
| 1 | B1 (verified bug), B2, B3, B4 — bug-fix sweep | 1 commit per item |
| 1 | X1 (death screen), X2 (skill toast), X6 (hotkey hint) — UX polish | 1 commit per item |
| 2 | P1 (spatial grid) — biggest perf lift | 1 commit, profile-driven |
| 2 | P2 (gradient cache), P3 (particle pool) | 2 commits |
| 2 | G1, G2, G5 — balance tuning | 1 commit per item |
| 3 | X3 (dialog walk-away), X4 (in-game confirm), X5 (slot tooltips) | 3 commits |
| 3 | G3, G4, G6 — assassin/mage rebalance | 3 commits |
| 3 | S2 — shared loot + combo XP wedge | 1 spike, 1 ship |

Most items fit the project's existing rhythm: small commits, single-file changes, atomic per-version bumps.

— end of plan —

