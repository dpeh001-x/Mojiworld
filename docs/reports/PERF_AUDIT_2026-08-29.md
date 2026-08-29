# Performance audit — 2026-08-29

**Trigger:** user report — "despite going on low graphics performance mode, there is way too much lag."

**Method:** (a) measured data from the in-game A/B/A ablation harness (v0.30.274) and the
hitch-attribution / combat probes (v0.30.278-279); (b) an 8-lens static hot-path fan-out over
`mojiworld_game.html` (allocations/GC, canvas cost, DOM thrash, particles, collision/AI,
sprites, timers/storage, recompute) — 47 raw findings, deduped and cadence-verified
(every item below is proven per-frame, not per-cast/per-event) down to 16 ranked + 8 manual-review.

---

## 1. The headline: "Low" gates the wrong levers

The v0.30.274 ablation harness measured real gameplay (town + forest, Chromium, Intel iGPU):

| Lever | Measured effect |
| --- | --- |
| ALL box-shadows off | **+18% fps** (town 61.5→71.7, forest 65.7→79.8) |
| `html.lx-nobackdrop` (kill backdrop blurs) | **+15-19% fps** |
| Weather / ambient / entity shadows / FX tiers (what "Low" actually toggles) | **no effect / noise** |

The in-game cost is **DOM compositing, not canvas work** — and the user-facing Graphics
Quality "Low" preset only turns off the canvas switches that measured as noise. Meanwhile:

- `backdrop-filter` is now handled: three trip wires (software-renderer probe, boot frame
  watchdog, in-game frame watchdog) engage `html.lx-nobackdrop`, sticky per session. Done.
- **`box-shadow` — the single biggest measured lever — has NO kill switch.** 398 rules,
  none gated by any class or preset.
- The "Low" preset engages neither `lx-nobackdrop` nor any box-shadow gate, and does not
  touch render scale (the 0.75× DRS rung from v0.30.278 is auto-only, last-resort;
  the settings "Resolution" slider is canvas zoom, not render scale).
- 165 `@keyframes`, 91 `infinite` animations; several on always-visible combat HUD
  (`xp-near-pulse`, `mojiHpCritPulse`, `mojiSkillReadyFlash`) animate paint-triggering
  properties, forcing continuous repaint of shadowed elements exactly during combat.

### Recommendations (highest leverage, in order)

- **R1 — `html.lx-noboxshadow`**: mirror of `lx-nobackdrop` (one CSS rule,
  `box-shadow: none !important` under the class), wired into the same three trip points.
  Worth ~+18% on the machines that are lagging. Sticky, same rationale.
- **R2 — make "Low" mean low**: the Low preset should engage `lx-nobackdrop` +
  `lx-noboxshadow` immediately and let DRS drop to its floor without waiting for the
  veryLowFx escalation ladder. A player choosing Low is *asking* for the trade.
- **R3 — pause the always-on HUD pulse animations** under the same class (they repaint
  shadowed elements continuously during combat, when frames matter most).

## 2. Already landed this week (update your build first)

| Ver | Fix |
| --- | --- |
| v0.30.279 | Asset cache-warmer yields to gameplay — was tagged in ALL 34 measured hitches (29-129ms) in 60s of combat |
| v0.30.278 | Loot piles: viewport cull (1.31ms → 0.003ms/call) + coin-merge cap at 240; DRS floor 0.75× desktop |
| v0.30.272-274 | Backdrop-blur kill ladder + boot watchdog (Firefox title 11.9 → 28.7 fps) |
| v0.30.271 | Firefox menu compositing |

A tester on an older build (e.g. v0.30.241) has none of these — much of the reported lag
may already be fixed at origin/main.

## 3. Ranked static findings — auto-safe (mechanical, behavior-identical)

Cadence-verified per-frame items, ranked by impact/risk. All join existing cache idioms
in the file (`_lxProjScaled`, `_EXPLO_GRAD_CACHE`, `_lxGroundSlabs`, single-entry memos).

| # | Fix | Where | Why it matters |
| --- | --- | --- | --- |
| 1 | Delete dead `_fireShot` closure | ~76529, updateMonsters | Allocated per ranged mob per frame (~2,000/s on a 30-40 mob map); verified dead — live sites call `_fireShotFor(m)` |
| 2 | Minion claim-count: O(minions²×mobs) → per-frame Map | 68486/68531, updateMinions | 3,000 inner iterations/frame → ~100; provably identical scores |
| 3 | Hoist `_has*` ally flags + inline `_consider` closure | 78031-78068, updateMonsters | ~30 closure allocs + ~210 rederivations/frame; 6 call sites, verbatim inline |
| 4 | Hoist `_boltSpent(p)` out of per-mob hit loop | 89477 | Up to ~1,600 redundant calls/frame in the 40×40 pair loop |
| 5 | Afterimage pass: scratch hitbox + X pre-reject | 65306-65317 | ~4 allocs + ~120 Set lookups/frame during any sprint |
| 6 | Regen block: getMaxHp/getMaxMp 7 calls → 2 | 64624-64662 | Each call walks equip/class/talent chains + allocates key strings, every frame |
| 7 | Quest-compass banner: memoize measureText | 16036-16041 | 2 font reparses + measures per frame → on-change only; compass runs ~every frame |
| 8 | Charge-halo gradient: unit-gradient + globalAlpha | 66476-66486 | 1 gradient + 3 stops + 2 strings per frame for entire charge holds; pixel-identical |
| 9 | `_defaultPortalY`: join `_lxGroundSlabs` cache | 91693; 109899/109987 | 2-4 platform rescans + allocs per portal per frame |
| 10 | `_heroVecWalkGait(t)` single-entry memo | 113130 | ~13 pose objects per walking hero per frame → 0 steady-state |
| 11 | drawSmoothFx: hoist `_perfLowFx()` + memo shadowColor strings | 69619/69689 | Twice per frame over every live slash (scope: memo only — do NOT drop the blur layer) |
| 12 | `lx_drs` localStorage read → boot-time const | 10460-10463 | Synchronous disk-backed API call every frame; key verified never written |

## 4. High-value, needs one look before shipping

| Fix | Where | Caveat |
| --- | --- | --- |
| Kill 2× per-frame `_lxGetSettings()` (sync storage + 4 spreads/frame) | 36461; 108095, 110930 | Refresh scalars in EVERY settings writer or a stale bool leaks |
| Chest webp through `_lxProjScaled` (~590K px resampled to paint ~1.7K, per chest per frame) | 108288 | Same fault class v0.30.252 fixed for portals, 34× worse per pixel; slight sharpness delta — one eyeball check |
| Drop item art through `_lxProjScaled` (10-30 full-res resamples/frame after a farm run) | 132385 | Same; minor sharpness delta |
| `_lxGroundBelow`: 256px x-bucket index over platforms | 122564; callers 122652, 115084 | ~5,000 iterations/frame on tower maps; bucket-boundary spot-check needed |

## 5. Manual-review candidates (valuable, riskier — do not auto-apply)

1. `_drawMonsterSprite` per-type geometry memo (122274-122355) — must invalidate from the
   R-key Monster Plant editor (`_lxAnimCalibRefresh`/`_lxMobSetScale`) or live-editing breaks.
2. Particle pool hidden-class stabilization (double for-in reset) — audit every spawn site's field set first.
3. Second rAF chain `_lxPadPoll` + pad-modal layout scan (42833/41989) — real cost at 144Hz; playtest with a controller.
4. Enemy projectile-trail budget routing — sheds enemy trails on saturated frames; design-intent call.
5. `drawSuperBossBar` double `.find()` (135032) — check the `boss:true`-without-`isBoss` edge.
6. `_lxPlayerFocus` memo (85059) — needs invalidation in killMonster.
7. Meteor `[...game.monsters]` spreads ×3 (90845/90976/91066) — touches the damage path; boss-fight playtest.
8. Minion idle-sprite shrink (68872) — verify the foot line after the async bake, or use `_lxProjScaled`.

## 6. Suggested order

1. **R1+R2 (box-shadow switch + honest Low preset)** — the only items with *measured*
   double-digit fps behind them; directly answers the user's complaint.
2. Tier-3 auto-safe batch (items 1-12), small commits, `run_all_tests.mjs` between batches.
3. The four needs-a-look items, each with its named check.
4. Manual-review list as separate, individually-tested changes.

Static analysis run: 8 lenses, 47 raw findings, 1.5M tokens, all cadence-gated per-frame.

---

## 7. Disposition (landed same day)

| Item | Outcome |
| --- | --- |
| R1 box-shadow kill switch | Already existed — v0.30.274 folded box-shadow + grade into `lx-nobackdrop`; the audit missed it by grepping for a separate class |
| R2 honest Low preset + R3 HUD pulse pause | **v0.30.282** — Low engages `lx-nobackdrop` immediately; both infinite HUD pulses pause under it |
| Auto-safe 1–6 (update loop) | **v0.30.283** (clobbered by a parallel stale rebuild the same hour; re-landed by that session in v0.30.284) |
| Auto-safe 7–12 (draw path) | **v0.30.285** |
| Needs-a-look 1–4 (settings scalars, chest, drops, groundBelow index) | **v0.30.287** — chest sharpness A/B eyeballed (indistinguishable); groundBelow equivalence asserted at 500+ points |
| Manual 5 (boss bar double .find) + 8 (minion sprite downscale) | **v0.30.288** |
| Manual 7 (meteor spreads) | REJECTED — snapshots are load-bearing vs kill+splice mid-loop (index-walking after a lower-index splice can double-hit a live mob) |
| Manual 1, 2, 3, 4, 6 | DEFERRED — geometry/focus memos risk the live Monster Plant editor & killMonster invalidation; pad poll needs a physical controller; trail shedding is a design call; particle pool needs a spawn-site field audit |

Suites added: `low_preset_perf_css_test` (10), `perf_loop_smoke_test` (8),
`perf_draw_smoke_test` (10), `perf_needslook_test` (9), `perf_bossbar_minion_test` (6)
— all auto-discovered by `run_all_tests.mjs`.

---

## 8. Cycle 2 (same day, "more ways while maintaining high graphics")

Fresh 8-lens sweep with everything landed on the avoid list: 47 raw findings → 15 ranked.

| Item | Outcome |
| --- | --- |
| **`_perfVeryLowFx` stale cache — the auto tier-2 FX ladder NEVER engaged** (2+ bosses / >22 mobs / bullet-hell ≥40 projectiles all dead; only the oscillating reactive path worked) | **v0.30.292** — one line: clear `veryValue` with the frame stamp. A/B: tier 2 off at 25 mobs and 2 bosses on the old build, engages on the fix |
| Ward orbs + ballista blits, cuteMob Set/blend memo, minimap ground memo, daily Map, 9× double `_lxVfxFrame` calls | **v0.30.292** |
| Enemy trails through the particle budget + pool; desktop budget 120→90 (sanctioned particle trim) | **v0.30.291** |
| Mob-projectile statics, slash/burst art (2× per frame), meteors (7 resamples → 1 bake), small-box hazard frames, `_pickBGImage` memo | **v0.30.294** |
| CSS `contain: layout paint` on HUD panels | **REJECTED, measured**: −77% fps town / −19% forest (defeats existing layerization). `will-change: transform`: +2–5%, inside noise |
| Pad poll chain | Already presence-gated for keyboard players (early-out + 2s reprobe); pad-connected cost needs a physical controller |
| `_drawMonsterSprite` geometry memo | Re-reviewed: all helpers are O(1) memoized lookups; the audit overestimated it. Dropped |

Remaining pool (documented, unlanded): drawAmbient lastColor/stamp memos (5 override
branches to keep straight), renderSkillBar quantized cooldown gates, `_qnavDrawKey`
CSSOM gate, `_buffBarMax` Map, dyed-hair tint bake (needs visual diff), and the
synthesizer's second-tier list (hazard alpha-out-of-gradient, nameplate gradient,
checkPlatformCollision bucket reuse — its double slam-pierce caveat is real).

Suites added cycle 2: `perf_ladder_test` (9), `perf_blit_route_test` (8).
