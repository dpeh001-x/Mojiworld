# Sprite fit audit — 2026-09-07 (v0.30.408)

Per user: "do an audit regarding the sprites, flag up potentially misfitting sprites".

Tool: `node scripts/sprite_fit_audit.mjs` measures the real content box (alpha > 24) of every
animation frame under `Sprites/{monsters,bosses,npc}` — 480 sets, 4,325 frames — and compares
them the way the game draws them (every frame is scaled to the same box, so what matters is the
pixels' own size and placement). Contact sheets for the flagged sets are in
`docs/reports/sprite_fit/` (`index.html`), every frame at the same frame scale, so a body that
shrinks between states shows exactly as it does in play. Raw numbers: `sprite_fit_audit.json`.
The existing `animator_parity_check.mjs` passed 9/9 before this pass (manifest, hitboxes,
content boxes all current).

## CORRECTION (v0.30.413) — the v0.30.408 "fixes" below were wrong for five of the seven

The game already undoes the transparent padding of these attack sets at draw time with
`_ATK_FRAME_SCALE` (per type, since v0.26.351: pathsBane 1.604, forgewight 2.327, tombKeeper 2.13,
echoKnight 2.10, conductorMech 1.69). The v0.30.408 audit measured content in pixels across canvases
of different sizes and did not read that table, so it reported bodies at 29–59% that were already at
parity in play, and then stacked calib scales on top: attacking for real, the five drew at 4.4–6.7× the
idle. v0.30.413 removes those scales (forgewight back at its hand-set 1.26), removes Cancer's (the boss
path sizes states its own way) and the Ossuary Tyrant's too (attacking for real, its rest frames already
matched its idle — the "three smallest frames" heuristic misread that set; the 1.40 drew it 1.4×). Every
scale v0.30.408 added is gone. The audit's metric is rewritten to what the screen shows — content share
of its own canvas × calib scale × padding multiplier — but it remains a FLAGGING tool: the arbiter is
`scripts/sprite_fit_calib_test.mjs`, which now measures a REAL attack through the monster's AI.

## As first shipped in v0.30.408 (superseded; kept for the record)

The body in these attack / walk frames was drawn at a fraction of the idle's size, so the
monster shrank the moment it attacked. Each now carries a calib state scale (`data/anim_calib.js`)
that restores the body to the idle's height; `scripts/sprite_fit_calib_test.mjs` blits a forced
attack frame in the served build and checks the body and the feet line against the idle (15/15).

| set | body vs idle | calib `s` |
|---|---|---|
| pathsBane attack | 29% | 3.42 |
| forgewight attack | 43% (34% before its old 1.26) | 2.90 |
| tombKeeper attack | 44% | 2.29 |
| echoKnight attack | 47% | 2.11 |
| conductorMech attack | 59% | 1.69 → **v0.30.413: set redrawn at the idle's body, scale removed** (`scripts/gen_conductor_mech_attack.mjs`) |
| ossuaryTyrant attack | 72% | 1.40 |
| zodiac_cancer walk / attack | 73% / 70% | 1.37 / 1.43 → **reverted in v0.30.413** (the zodiac boss path applies a state scale differently; the blit probe never exercised it, and the change made the crab worse in play) |

## Flagged, not changed — please judge

- **aetherion attack** — the body is 148% of the idle's in play (state median 167%): the attack set
  is drawn larger AND the hand calib scales it 1.6× on top of the idle's 1.58×. If the boss is not
  meant to grow half again when it attacks, `attack.s` ≈ 1.08 matches the idle.
- **kingKrook walk / attack** (168% / 152% in play, hand calib 1.655 / 1.495) and **towerArbiter walk**
  (152%, hand calib 1.515) — with the corrected metric (content share of its own canvas) these
  hand-calibrated states read larger than their idle. Check them in the animator before touching
  anything: they were set by eye, and the boss path may not draw what this metric assumes.
- **Walk / idle body drift** (frames of one loop whose body height differs > 20% from the loop's
  median — a pulse every loop): aetherion2 walk (4 frames 126–146%), coach_stride idle (3 frames
  61–68%), towerArbiter walk (3 frames 73%), bellowsbat idle/walk, cancer idle, leo pounce,
  ossuaryTyrant idle, razorgale walk, sparkling walk, thornmaw walk, tideling walk, virgo fly.
- **Foot line jumps** (the content bottom moves > 12% of the frame across a looping state — a hop
  every loop): pinechad walk 15%, sparkling walk 18%, thornmaw walk 13%, young_confused_barnaby
  duck 16%.
- **Box aspect**: octoLegFreeze idle art is 0.60 wide-to-tall inside a 1.33 box (80×60) — much
  taller than its hitbox.
- **Clipped** (71 sets): opaque pixels along the top, left or right edge over more than 6% of that
  edge. Almost all are attack frames where a slash or flare runs off the canvas (blockGary 4–6,
  cherub 3–7, spectreCannoneer 4–7, frostkin 2–5…); the idle/walk ones worth a look are bonebosn
  (idle 6 frames, walk 4), orange walk (4), fatLizard walk, goblinMauler walk, razorgale walk,
  cancer idle (3), pisces idle (2), taurus walk (2), scorpio walk.
- **Attack silhouette drift** (43 attack sets with 3+ frames > 20% off the state median) is listed
  in the JSON but is mostly the pose — a raised hammer, a lunge, spread wings — not the body. The
  body-vs-idle check above is the one that catches the real defect.

## Not found

No frame failed to decode, none is blank, and every monster with any frames has all three states
(idle / walk / attack) at the counts the frame index records.
