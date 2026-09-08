# Final polish audit — 2026-09-08

Against `origin/main` @ `128e11cd` (v0.30.444). Every number below is measured, not estimated;
the harnesses used are named so each finding can be re-checked.

## Method

| Probe | What it did |
| --- | --- |
| Smoke | Booted the shipped build, loaded all **109 maps**, spawned + fought on each, fired all **74 skills**, opened all **28 panels** |
| Perf | Boot timing, frame-time distribution idle / +30 mobs / 20-skill storm, heap across 6 map loads + 600 frames |
| Hitch | Worst frame in the 40 frames spanning `loadMap`, over 8 maps |
| Save | Boot with garbage / truncated / null / wrong-typed / empty save payloads |
| Size | Per-state drawn character height for flagged entities, read from the animator's own game-geometry metrics |
| Suite | All 43 browser-free harnesses in a clean checkout of the shipped build |

**Clean results, for the record:** zero runtime errors and no NaN state across the smoke run;
no heap growth (32 MB → 29 MB after six map loads); 1.1 s to interactive; median frame 4–7 ms;
all five corrupt-save cases boot with no error; boss attack-scale tables agree between game and animator.

---

## 1. The animator draws four monsters' attack state too big (confirmed)

`monster_animator.html` keeps a hand-mirrored copy of the game's `_ATK_FRAME_SCALE`. The two have
drifted, so the tool that promises "renders EXACTLY what the game renders" overstates the **attack**
state for four types:

| Type | Game | Animator | Animator draws attack |
| --- | --- | --- | --- |
| `smithgolem` | *(no entry → ×1)* | 1.881 | **+88%** |
| `conductorMech` | *(no entry → ×1)* | 1.69 | **+69%** |
| `fatDragon` | 1.199 | 1.951 | **+63%** |
| `tombKeeper` | 1.7 | 2.13 | **+25%** |

Cross-checked two ways: the animator reports the smith golem's attack at 205 px drawn against
105 px for idle, while the in-engine probe in `scripts/smithgolem_scale_test.mjs` measures rendered
ink of 113 px idle against 117–129 px attack on the same build. The game is right; the tool is wrong.

**This is why the smith golem "still looked wrong in the animator"** after the art itself was rebuilt.
The residual was the tool, not the sprites.

**Fix:** delete the four drifted entries so the animator's table equals the game's
(`{ ...5 game entries }`). One line, no art or game change. Worth a guard test that diffs the two
tables, so the mirror cannot drift again — the same failure mode the hitbox tables already have fenced.

## 2. Every map transition drops 9–18 frames

Worst frame in the window spanning `loadMap`, median frame for context:

| Map | Worst | Median |
| --- | --- | --- |
| town | 293.9 ms | 10.3 ms |
| cryptHollow | 212.3 ms | 5.9 ms |
| mushroom | 170.8 ms | 7.0 ms |
| bloomhaven | 163.9 ms | 5.2 ms |
| coralReef | 156.4 ms | 4.8 ms |
| stormCrest | 152.5 ms | 7.0 ms |
| honeycombHollow | 149.9 ms | 9.6 ms |
| confusedVigil | 63.3 ms | 7.1 ms |

Consistent 150–290 ms freeze on every door, portal and taxi ride — the single most repeated rough
edge left in the game. Prime suspects, in order: synchronous image decode of the new background
(the biggest backgrounds are 4–6 MB), platform/collision rebuild, and DOM churn in the HUD.
Worth profiling one map with the decode path instrumented; `createImageBitmap` off the main thread
or a one-frame fade over the swap would both hide it.

## 3. Heavy VFX moments miss 60 fps

| Scenario | Median | p95 | Worst | Frames > 33 ms |
| --- | --- | --- | --- | --- |
| Forest, as spawned | 6.8 ms | 16.8 ms | 212 ms *(the map load above)* | 2 |
| +30 mobs | 4.1 ms | 5.8 ms | 17.1 ms | 0 |
| 20 skills fired | 6.0 ms | 30.2 ms | 40.8 ms | 5 |

Mob count is a non-issue — 45 monsters ran *faster* than 15. The cost is in skill VFX: draw calls
per frame go 12 → 40 and text draws 0 → 14 during the storm. Worth a look only if players report
stutter in big fights; the mob-count headroom says the engine is in good shape.

## 4. ~54 MB of art the game never loads

| Item | Size | Status |
| --- | --- | --- |
| 5 root PNG backgrounds | 23.4 MB | `refs=0` in the game; 4 of the 5 have a `.webp` twin already in use |
| `backgrounds/New background/` | 26 MB | source art, referenced only in two code comments ("copied into the main" set) |
| `audio/bgm_bloom.mpeg` | 4.9 MB | byte-twin of `bgm_bloom.mp3`, the only duplicated stem in 1041 audio files |

Also `bg_v3_bonegraveyard_lich's vigil.png` carries an apostrophe in its filename — a URL-encoding
hazard; the live art is the sanitized `bg_v3_bonegraveyard_lichsvigil.webp`. None of this reaches
players (the game does not reference it), so this is repo and CDN weight, not load time.

## 5. No text or HUD scale option

The accessibility surface is otherwise good — key rebinding, colourblind modes, screen-shake and
reduced-motion controls, separate volumes, difficulty options and subtitles are all present. The one
gap is UI/text scaling (`fontScale|uiScale|textSize|hudScale` — zero hits). That matters most on
Steam Deck, on a TV, and on phones, where fixed-px HUD text is the usual complaint.

## 6. Two creatures change size between states — verify intent

Measured as drawn character height from the animator's game geometry, after calib:

| Entity | idle | walk | attack |
| --- | --- | --- | --- |
| `aetherion` | 281.5 px | 270.5 px (−3.9%) | **468.5 px (+66.4%)** |
| `thornmaw` | 110.2 px | 141.0 px (+27.9%) | **165.3 px (+50.0%)** |

For a lunging plant like thornmaw this may be the intended reach; for Aetherion a 66% swing on
attack is the same defect class that was fixed on the smith golem. `boss_attack_set_test` independently
reports the dark-armour body varying 20.6% across that set. Nine other entities I flagged statically
(`towerArbiter`, `kingKrook`, `conductorMech`, `snail`, `tombKeeper`, `forgewight`, …) measured within
±3% once calib was applied and are **fine** — the static screen over-reports, so trust the drawn numbers.

## 7. The test suite can no longer be used as a gate

25 of 43 browser-free harnesses were red on the shipped build. v0.30.444 fixed the three real defects
they had caught and re-aimed six. **Fourteen remain red because they grep for code blocks that were
since refactored** — not because the game is broken:

`virga_columns`, `virga_flight`, `virga_starburst`, `virga_wings`, `hexorb_ward`, `mage_proj_art`,
`sage_marksman_burst` (harness crashes the page), `steam_input` (needs steamworks typings absent here),
`gravitos_band`, `gravitos3_bodylock`, `gravitos3_state_size`, `gravitos_wiring`, `boss_walk_timing`
(aetherion stride), `boss_attack_set` / `boss_anim_integrity` (the Aetherion size question above).

Until these are re-aimed or retired, a red suite carries no signal, and a genuine regression would
hide among them. This is the highest-leverage cleanup on the list: it is what protects everything else.

## 8. Trivia

`mojiworld_game.html` carries one stale `TODO` (line ~22773) pointing at an `armoredMech` variant that
has since shipped as the Conductor Mech — the comment above it already says so.

---

## Suggested order

1. **Sync the animator's attack table + add a drift guard** — one line, removes a defect you have
   already hit once, and restores trust in the tool every art decision is made in.
2. **Re-aim or retire the 14 stale harnesses** — restores the regression net.
3. **Hide the map-transition hitch** — the most repeated rough edge a player actually feels.
4. **Settle the Aetherion attack size** (and confirm thornmaw is intended).
5. **Add a UI scale slider** — the one real accessibility gap.
6. **Drop the ~54 MB of unreferenced art** — housekeeping, zero player impact, smaller clones and CDN.
