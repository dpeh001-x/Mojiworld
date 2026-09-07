# Sprite calibration — the one document (2026-08-31 → 2026-09-07)

Per user: "ensure all the calibration edits are merged into 1 document." This file merges,
and supersedes, the three calibration write-ups produced this week:

- `docs/reports/sprite_fit_audit_2026-09-07.md` (v0.30.408 audit + v0.30.415 correction) → §3;
  its raw numbers stay in `sprite_fit_audit.json` and the contact sheets in `sprite_fit/`
  (data, not prose). The old `.md` is now a pointer here.
- the hitbox-coverage pass (v0.30.418 draft, **not landed** — it exists only as an uncommitted
  working-copy report + scripts) → §4, folded in so it lives here when it ships.
- the calibration layer audit that followed the Echo Knight fix (v0.30.419) → §5–§6.

Every number below was taken from the repository itself: semantic diffs of the calibration
tables between this conversation's first base (`5e942d73`, 2026-08-31) and `origin/main`
(`03fc0e87`, 2026-09-07), the commit bodies, and in-engine probes where stated.

---

## 1. Ledger — calibration data edits, 2026-08-31 → 2026-09-07

Tables diffed: `data/anim_calib.js` (`LX_ANIM_CALIB`, `LX_ATK_HITBOX`), `data/mob_offsets.js`
(`LX_MOB_OFFSET_DATA`, `LX_MOB_SCALE_DATA`), `data/npc_offsets.js`, `data/monster_hitboxes.js`.

| table | entries changed | nature |
|---|---|---|
| `LX_ANIM_CALIB` | **156** | 135 auto-timed (`ft` + `ftAuto:true`, v0.30.417) · 21 hand-authored (below) |
| `LX_ATK_HITBOX` | **1** | legosaurus idle/walk/attack `w`/`ox` (v0.30.325) |
| `LX_MOB_OFFSET_DATA` / `LX_MOB_SCALE_DATA` | 0 | — |
| `LX_NPC_OFFSET_DATA` / `LX_NPC_SCALE_DATA` | 0 | — |
| `LX_MOB_HITBOX` (`monster_hitboxes.js`) | 0 | — (the coverage pass in §4 would change 112; not landed) |

### 1a. Hand-authored `LX_ANIM_CALIB` changes (21 entities)

| entity · state | before → after | source |
|---|---|---|
| legosaurus attack | `ft` [70,70,75,85,100,115,100,85,75] added (775 ms, was flat 48) | v0.30.320 `c7c65392` |
| legosaurus idle / walk / attack `dy` | 0.035 / 0.035 / 0.035 → 0.02 / 0.01 / 0.015 | animator patch `03fc0e87` |
| legosaurusdash attack | `ft` [700,150,64,64,64,64,64,30,30] added (1230 ms = 850 brace + 380 dash) | v0.30.323 `ac2dd3b6` |
| legosaurusdash attack `dy` | 0.065 → 0.025 | animator patch `03fc0e87` |
| gravitospunch attack | `ft` 16-slot [55,55,75,75,30,30,115,115,103,102,70,70,55,55,95,600] added with the 16-frame set | v0.30.341 `162e7c5e` |
| gravitos3 walk `s` / attack `s`,`dy` | 1.29 → 1.27 / 1.13, 0.04 → 1.08, 0.035; attack `ft` [72,60,60,90,132,90,60,60,96] | `03fc0e87` |
| gravitos3punch attack `s` / `ft` | 1.059 → 1.04; `ft` [72,60,60,60,66,90,132,90,96] | `03fc0e87` |
| gravitos3soul attack `ft` | [72,60,60,60,90,90,90,60,96] (strike frames held) | `03fc0e87` |
| gravitos2star / gravitos3star attack `ft` | [110,110,120,140,170,170,140,120,110] | v0.30.363 `61201559` |
| gravitoslaser / gravitossoul attack `ft` | [110,110,120,140,170,170,140,120,110] (gravitossoul entry created) | v0.30.363 |
| aetherionastral attack `s`,`dx` / `ft` | 1.28, 0.06 → 1.24, 0; `ft` [110,110,120,140,170,170,140,120,110] | `bb311105` (user patch) + v0.30.363 |
| kingKrook walk `s`,`dy` / attack `s` | 1.655, 0.0797 → 1.67, 0.065; 1.4946 → 1.6; attack `ft` [72,60,60,60,60,90,132,90,96] | `03fc0e87` |
| zodiac_leo zodiac/pounce `s`,`dy` | 1.45, 0.325 → 1.4, 0.29 | `03fc0e87` |
| zodiac_cancer walk / attack `s` | 1.37 / 1.43 added (v0.30.408) → **reverted** (v0.30.415); attack `ft` kept explicit | `fc42640e` → `8ff8ece0` |
| pathsBane attack `s` | 3.42 added (v0.30.408) → **removed** (v0.30.415: stacked on `_ATK_FRAME_SCALE` 1.604) | `fc42640e` → `8ff8ece0` |
| forgewight attack `s` | 1.26 → 2.90 (v0.30.408) → **back to 1.26** (v0.30.415) | `fc42640e` → `8ff8ece0` |
| tombKeeper attack `s` | 2.29 added → **removed** (stacked on `_ATK_FRAME_SCALE` 2.13) | `fc42640e` → `8ff8ece0` |
| echoKnight attack `s` | 2.11 added → **removed** (stacked on `_ATK_FRAME_SCALE` 2.10) | `fc42640e` → `8ff8ece0` |
| conductorMech attack `s` | 1.69 added → **removed**; set redrawn at the idle body (`gen_conductor_mech_attack.mjs`) | `fc42640e` → `8ff8ece0` |
| ossuaryTyrant attack `s` | 1.40 added → **removed** (rest frames already matched in play) | `fc42640e` → `8ff8ece0` |
| smithgolem attack `fs` | [1,1,1,1.4,1.34,1.12,1.58,1.51,1] per-frame scale (monster attack path now honours `fs`) | v0.30.403 `ee13d36e` |

Net of the v0.30.408 → v0.30.415 round trip: **every scale v0.30.408 added is gone**; the entries
above keep an explicit `s:1, dx:0, dy:0` and their `ft`.

### 1b. Auto-timed frame intervals (135 entities, v0.30.417 `892c379e`)

Every monster and boss attack set without authored timing received `ft` + `ftAuto:true`
(bosses: `[72,60,60,…,132,…,96]` shapes; monsters: `[86,72,72,…,108,1xx,108,115]`), and the
monster WALK/IDLE pickers now honour `ft` through `_lxFtWalk` like the boss pickers. A later
hand edit in the animator drops the `ftAuto` flag (conductorMech, echoKnight, ossuaryTyrant,
pathsBane, smithgolem, tombKeeper, gravitos3*, kingKrook*, zodiac_cancer are now explicit).

### 1c. Attack hitbox fractions (`LX_ATK_HITBOX`)

| entity | before → after | source |
|---|---|---|
| legosaurus idle `w`,`ox` | 0.6764, +0.0227 → **1.088, −0.0567** (measured: art 517 px wide, box covered 296) | v0.30.325 `3dff1b85` |
| legosaurus walk `w`,`ox` | 0.5309, 0.0364 → 1.008, 0.0177 | v0.30.325 |
| legosaurus attack `w`,`ox` | 0.6491, −0.0273 → 1.374, 0.0238 | v0.30.325 |

### 1d. Code-level calibration constants (game and animator)

| constant | base (`5e942d73`) → tip | note |
|---|---|---|
| `_lxMobPlantDy` post-clamp `echoKnight +7` | present → **removed** (v0.30.419 `2da338dc`) | see §2 |
| animator `POST_CLAMP_PX.echoKnight` | 7 → **removed** (same commit, badge v0.30.419) | parity |
| `_ATK_FRAME_SCALE` (game) | unchanged: fatDragon 1.199, tombKeeper 2.13, forgewight 2.327, pathsBane 1.604, echoKnight 2.10 | conductorMech has no entry (set redrawn v0.30.415) |
| `_MOB_SPRITE_FOOT_NUDGE`, `BOSS_DRAW_SCALE`, `_BOSS_ATK_SCALE` | unchanged (`slime 0.14` / `gravitos 0.95` / `kingKrook 1.10`) | |

### 1e. Generated tables regenerated in range (not authored)

`anim_calib_manifest.js`, `sprite_frame_index.js`, `sprite_edges.js`, `sprite_bbox.js` — after
every art drop: gravitos2 laser/punch (`efcc94b0`), aetherionastral frames (`c0a516ac`), Gravitos
Ascendant/Awakened + the eight-boss repaint (`53b9abcd`, `5490ff82`, `c132fc86`), the 16-frame
punch (`162e7c5e`), the void tear (`5536174a`), the A-press stances (`a68b4d62`). All pass
`animator_parity_check.mjs` 9/9 at the tip.

---

## 2. Echo Knight plant (v0.30.419)

Reported: "the bottom pixel sinks far down." Measured in-engine (`drawMonster` driven directly,
`drawImage` spied, dest rect → world px through the scene transform, drawn source alpha-scanned):
opaque bottom **12 px under** the foot line (floor 510, bottom 522). The ladder, in the order
`_lxMobPlantDy` applies it:

| step | value | effect |
|---|---|---|
| bbox-bottom anchor | 847 / 850 | his art has no bottom padding |
| `GROUND_BURY_FRAC` 2 % | +4.84 px | house rule, every ground mob |
| foot nudge / pre-clamp | none | |
| bury clamp | 6 px cap | not binding |
| **post-clamp hardcode** | **+7 px** | the whole excess — placed after the clamp on purpose |
| `mob_offsets` yOff · calib `dy` · hitbox fraction | 0 · 0 · none | |

House norm for the other hardcoded types: boneGolem 2.99, future_lyra 2.24, slime 3, pathsBane 5.5,
seastar 6.93, grumpsquid 9.4; echoKnight sat at 11.84 with scorpion (authored yOff 10) the only
other outlier. The `+7` predates the current art. After the deletion (game **and** the animator's
mirrored table): ladder 4.84 px, real static blit 5 px, attack frame 4.4 px.
`scripts/echoknight_plant_test.mjs` 6/6 with golden values for the other four types (±0.01 px).

---

## 3. Sprite-fit audit (v0.30.408, corrected v0.30.415) — merged

Tool: `scripts/sprite_fit_audit.mjs` measures the content box (alpha > 24) of every frame under
`Sprites/{monsters,bosses,npc}` — 480 sets, 4,325 frames — and compares states the way the game
draws them. Raw numbers `sprite_fit_audit.json`; contact sheets `sprite_fit/index.html`.

**Correction (v0.30.415).** The v0.30.408 pass measured content in pixels across canvases of
different sizes and did not read `_ATK_FRAME_SCALE`, which has undone the padding of the weapon-swing
attack sets since v0.26.351. It reported bodies at 29–59 % that were already at parity in play, then
stacked calib scales on top: attacking for real, pathsBane drew 5.5×, forgewight 6.7×, tombKeeper
4.9×, echoKnight 4.4×, conductorMech 1.7×. Every v0.30.408 scale is gone (§1a); the metric is
rewritten to what the screen shows (content share of its own canvas × calib scale × padding
multiplier) and stays a **flagging** tool — the arbiter is `scripts/sprite_fit_calib_test.mjs`, which
measures a real attack through the monster's AI.

**Flagged, not changed — still open for judgement**

- aetherion attack: body 148 % of idle in play (attack art drawn larger AND hand calib 1.6 on top of
  idle 1.58). If he is not meant to grow half again when attacking, `attack.s ≈ 1.08`.
- kingKrook walk/attack (168 % / 152 %, hand calib now 1.67 / 1.6) and towerArbiter walk (152 %,
  1.515): set by eye; check in the animator before touching.
- Walk/idle body drift > 20 % within a loop: aetherion2 walk, coach_stride idle, towerArbiter walk,
  bellowsbat, cancer idle, leo pounce, ossuaryTyrant idle, razorgale walk, sparkling walk, thornmaw
  walk, tideling walk, virgo fly.
- Foot-line jumps > 12 % across a loop: pinechad walk 15 %, sparkling walk 18 %, thornmaw walk 13 %,
  young_confused_barnaby duck 16 %.
- Box aspect: octoLegFreeze idle art 0.60 tall inside a 1.33 box (80×60).
- Clipped edges (71 sets, mostly attack effects): idle/walk ones worth a look — bonebosn, orange walk,
  fatLizard walk, goblinMauler walk, razorgale walk, cancer idle, pisces idle, taurus walk, scorpio walk.

Nothing failed to decode, none is blank, every monster with frames has all three states at the
counts the frame index records.

---

## 4. Hitbox-coverage pass (draft v0.30.418) — **NOT LANDED**

Lives only in the working copy (`hitbox_coverage_2026-09-07.md`, `scripts/hitbox_coverage_*.mjs`);
`monster_hitboxes.js`, `monsterTypes` w/h and `LX_MOB_SCALE_DATA` on `origin/main` are unchanged
(echoKnight is still 110×130 at scale 1.12). Recorded here so it lands in this document, not a fourth.

Method: `scripts/hitbox_coverage_probe.mjs` maps each type's drawn visible pixels (alpha box; padding
and effect art excluded) to the screen against its box. New height = visible height above the floor;
new width = 85 % of visible width; the draw multiplier (`LX_MOB_SCALE_DATA` for mobs, `BOSS_DRAW_SCALE`
for bosses, `_Z_BOX_ABS` + `BOSS_DRAW_SCALE` for zodiac signs) is lowered by old h / new h so the sprite
on screen does not move. 112 boxes would change (91 mobs, 21 bosses); left alone: gravitos (box
deliberately larger than its art), frog and axolotl (probe caught their shadows). Full proposed table:

| type | boss | old w×h | new w×h | covers before → after | draw mul before → after |
|---|---|---|---|---|---|
| zodiac_scorpio | yes | 142×142 | 387×370 | 32% → 85% | 2 → 0.7676 |
| zodiac_capricorn | yes | 150×150 | 377×360 | 35% → 84% | 2 → 0.8333 |
| zodiac_aries | yes | 114×114 | 365×348 | 28% → 84% | 2 → 0.6552 |
| zodiac_sagittarius | yes | 146×146 | 332×387 | 37% → 98% | 2 → 0.7545 |
| kingKrook | yes | 120×130 | 385×351 | 35% → 95% | 2 → 0.7407 |
| zodiac_cancer | yes | 126×126 | 282×343 | 36% → 98% | 2 → 0.7347 |
| blightElder |  | 130×150 | 322×327 | 44% → 96% | 1.71 → 0.784 |
| zodiac_pisces | yes | 158×158 | 308×339 | 47% → 100% | 2 → 0.9322 |
| ossuaryTyrant |  | 110×130 | 260×331 | 39% → 99% | 2.19 → 0.86 |
| zodiac_leo | yes | 130×130 | 255×319 | 40% → 98% | 2 → 0.815 |
| zodiac_aquarius | yes | 154×154 | 221×323 | 48% → 100% | 2 → 0.9536 |
| octobaby | yes | 200×160 | 308×312 | 50% → 98% | 2 → 1.0256 |
| zodiac_taurus | yes | 118×118 | 276×295 | 38% → 95% | 2 → 0.8 |
| legosaurus | yes | 224×238 | 388×288 | 77% → 93% | 2 → 1.6528 |
| king | yes | 112×98 | 297×304 | 32% → 99% | 2 → 0.6447 |
| aetherion | yes | 160×160 | 309×276 | 56% → 97% | 2 → 1.1594 |
| pathsBane |  | 130×150 | 155×261 | 56% → 98% | 1.02 → 0.586 |
| zodiac_libra | yes | 138×138 | 175×252 | 53% → 98% | 2 → 1.0952 |
| sundered_smith | yes | 140×140 | 207×246 | 56% → 98% | 2 → 1.1382 (art off-centre −40.9 px) |
| elderbark |  | 130×150 | 159×238 | 60% → 95% | 1.05 → 0.662 |
| zodiac_virgo | yes | 134×134 | 290×242 | 55% → 100% | 2 → 1.1074 |
| echoKnight |  | 110×130 | 170×223 | 55% → 95% | 1.12 → 0.653 |
| brinekraken |  | 175×150 | 206×216 | 67% → 96% | 0.88 → 0.611 |
| octoLegFreeze |  | 80×60 | 109×206 | 27% → 94% | 2.33 → 0.679 |
| octoLegStun |  | 80×60 | 116×204 | 28% → 94% | 2.45 → 0.721 |
| young_confused_barnaby | yes | 120×140 | 147×195 | 67% → 93% | 2 → 1.4359 |
| pinechad |  | 96×104 | 171×204 | 50% → 98% | 1.21 → 0.617 |
| octoLegPoison |  | 80×60 | 106×184 | 31% → 94% | 2.44 → 0.796 |
| shardlich |  | 82×92 | 116×191 | 47% → 97% | 1.31 → 0.631 |
| mooma | yes | 133×151 | 161×187 | 77% → 95% | 2 → 1.615 |
| forgewight |  | 110×130 | 128×187 | 68% → 98% | 1 → 0.695 |
| octoLegSkillLock |  | 80×60 | 96×165 | 34% → 94% | 2.43 → 0.884 |
| glasswindHare |  | 170×150 | 108×167 | 88% → 98% | 0.84 → 0.754 |
| zodiac_gemini | yes | 122×122 | 160×165 | 74% → 100% | 2 → 1.4788 |
| blockGary |  | 115×115 | 82×158 | 70% → 96% | 1.06 → 0.772 |
| graveReaver |  | 80×110 | 102×135 | 76% → 93% | 1.08 → 0.88 |
| archon |  | 65×74 | 88×139 | 51% → 96% | 1.12 → 0.596 |
| goblinMauler |  | 90×108 | 133×142 | 75% → 98% | 1 → 0.761 |
| meloncholy |  | 112×88 | 132×127 | 65% → 93% | 1.25 → 0.866 |
| spectreCannoneer |  | 68×70 | 101×134 | 51% → 98% | 1.22 → 0.637 |
| boneGolem |  | 90×100 | 90×131 | 75% → 98% | 1 → 0.763 |
| fatDragon |  | 90×78 | 112×124 | 61% → 97% | 1 → 0.629 |
| boneWraith |  | 55×72 | 86×124 | 56% → 97% | 1.31 → 0.761 |
| bonebosn |  | 60×75 | 80×123 | 59% → 97% | 0.96 → 0.585 |
| tombKeeper |  | 72×81 | 86×124 | 64% → 98% | 0.9 → 0.588 |
| seraph |  | 55×65 | 139×126 | 52% → 100% | 1.43 → 0.738 |
| mournshade |  | 70×90 | 70×114 | 72% → 91% | 1.05 → 0.829 |
| thornmaw |  | 88×78 | 106×119 | 63% → 97% | 1.25 → 0.819 |
| blockEle |  | 114×103 | 114×118 | 84% → 96% | 1 → 0.873 |
| sepulchreHound |  | 72×58 | 101×111 | 50% → 95% | 1.46 → 0.763 |
| future_lyra |  | 69×93 | 54×112 | 82% → 98% | 1 → 0.83 |
| blockTigreal |  | 112×102 | 78×102 | 91% → 91% | 0.95 → 0.95 |
| mirageStalker |  | 80×86 | 80×106 | 77% → 95% | 0.94 → 0.763 |
| lichkin |  | 48×60 | 64×106 | 54% → 96% | 1.18 → 0.668 |
| vigil_vermillion |  | 64×80 | 88×108 | 73% → 98% | 1 → 0.741 |
| deranged_kuro |  | 48×64 | 74×102 | 60% → 96% | 1.14 → 0.715 |
| willeo |  | 68×80 | 68×102 | 77% → 98% | 0.93 → 0.729 |
| young_bloodthirsty_vermillion |  | 60×74 | 83×100 | 73% → 98% | 1 → 0.74 |
| seahorse |  | 56×75 | 56×95 | 77% → 98% | 1 → 0.789 |
| stormKitty |  | 81×77 | 81×93 | 80% → 96% | 1 → 0.828 |
| bellowsbat |  | 63×54 | 98×96 | 56% → 100% | 1.33 → 0.748 |
| tombWraith |  | 48×60 | 62×96 | 63% → 100% | 1.27 → 0.794 |
| wraith |  | 60×75 | 67×93 | 81% → 100% | 1 → 0.806 |
| drownedCur |  | 63×53 | 113×88 | 58% → 96% | 1.14 → 0.687 |
| seastar |  | 78×75 | 78×83 | 83% → 92% | 1 → 0.904 |
| jellyfish |  | 56×66 | 56×90 | 73% → 100% | 1 → 0.733 |
| blockHupo |  | 82×79 | 55×87 | 88% → 97% | 1 → 0.908 |
| cherub |  | 46×50 | 56×88 | 56% → 98% | 1.41 → 0.801 |
| mayo |  | 62×54 | 70×84 | 62% → 97% | 1.24 → 0.797 |
| blockPopo |  | 66×66 | 74×82 | 77% → 95% | 1.16 → 0.934 |
| potato_uncle |  | 54×60 | 60×84 | 70% → 98% | 1 → 0.714 |
| nougatBear |  | 84×80 | 57×80 | 94% → 94% | 1 → 1 |
| mummy |  | 57×72 | 57×81 | 87% → 98% | 1 → 0.889 |
| razorgale |  | 78×60 | 78×83 | 73% → 101% | 1.22 → 0.882 |
| ticketMech |  | 60×52 | 43×78 | 64% → 95% | 1.37 → 0.913 |
| fatLizard |  | 63×53 | 63×76 | 66% → 95% | 1.19 → 0.83 |
| zombie |  | 58×66 | 46×77 | 83% → 97% | 0.88 → 0.754 |
| skeleton |  | 52×66 | 52×77 | 84% → 98% | 1 → 0.857 |
| expressTicketMech |  | 60×52 | 48×74 | 67% → 95% | 1.36 → 0.956 |
| smithgolem |  | 96×105 | 96×74 | 135% → 95% | 0.65 → 0.922 |
| gummy |  | 68×68 | 52×72 | 88% → 93% | 1 → 0.944 |
| seasponge |  | 69×72 | 54×72 | 94% → 94% | 0.89 → 0.89 |
| coralImp |  | 42×42 | 54×74 | 56% → 98% | 1.56 → 0.885 |
| nimbusFox |  | 55×50 | 67×71 | 66% → 94% | 1.06 → 0.746 |
| sparkling |  | 44×46 | 66×75 | 61% → 100% | 1.25 → 0.767 |
| sparkSprite |  | 68×77 | 96×77 | 105% → 105% | 1 → 1 |
| lanternWisp |  | 62×62 | 27×70 | 88% → 100% | 1 → 0.886 |
| thunderMole |  | 76×69 | 61×69 | 99% → 99% | 0.9 → 0.9 |
| frostkin |  | 68×68 | 48×68 | 98% → 98% | 1 → 1 |
| cloudbun |  | 54×45 | 63×69 | 65% → 99% | 1.07 → 0.698 |
| anglerfish |  | 60×48 | 74×69 | 70% → 101% | 1.42 → 0.988 |
| cinderling |  | 56×54 | 62×64 | 79% → 94% | 1 → 0.844 |
| pearlSprite |  | 40×46 | 60×64 | 68% → 95% | 1.22 → 0.877 |
| mirrorSelf | yes | 28×44 | 62×67 | 66% → 101% | 2 → 1.3134 |
| orange |  | 40×42 | 50×61 | 64% → 93% | 1.27 → 0.874 |
| petalfly |  | 44×40 | 55×65 | 61% → 100% | 1.4 → 0.862 |
| tidepoolTurtle |  | 62×52 | 43×63 | 80% → 96% | 1 → 0.825 |
| emberling |  | 32×34 | 45×61 | 54% → 97% | 1.52 → 0.847 |
| goblinScout |  | 38×44 | 38×60 | 71% → 97% | 1.17 → 0.858 |
| scorpion |  | 66×45 | 72×48 | 76% → 81% | 1 → 0.938 |
| voltipup |  | 81×72 | 60×72 | 123% → 123% | 1.11 → 1.11 |
| cosmicMochi |  | 46×41 | 56×57 | 71% → 99% | 1.36 → 0.978 |
| cookie |  | 62×52 | 48×52 | 91% → 91% | 1 → 1 |
| sproutle |  | 40×40 | 40×55 | 70% → 97% | 1.2 → 0.873 |
| tidefish |  | 32×24 | 54×50 | 45% → 94% | 1.58 → 0.758 |
| clownfish |  | 48×38 | 48×50 | 76% → 100% | 1.15 → 0.874 |
| stoneling |  | 38×36 | 41×48 | 73% → 98% | 1.28 → 0.96 |
| slime |  | 34×28 | 42×46 | 57% → 94% | 1.48 → 0.901 |
| stump |  | 38×44 | 46×44 | 90% → 90% | 1 → 1 |
| mushpup |  | 45×42 | 45×48 | 86% → 99% | 1 → 0.875 |
| honeyBuzz |  | 41×36 | 47×44 | 82% → 100% | 1.2 → 0.982 |
| snail |  | 66×56 | 52×42 | 130% → 97% | 1 → 1.333 |

Caution before landing it: a box change moves every consumer of `m.w/m.h` — contact damage,
platform collision, AI ranges, spawn placement, the hitbox fractions in §1c (authored against the
current box), and the mirrored `hb.mul` in the animator — not just the draw multiplier it compensates.
The Legosaurus row alone would undo v0.30.325's measured fractions unless they are re-derived.

---

## 5. The layers, in the order the engine applies them

### Ground mobs (`_drawMonsterSprite` → `_lxMobPlantDy`)

| # | Layer | Source of truth | Units | Authoring surface |
|---|---|---|---|---|
| 1 | Hitbox `w/h` | `monsterTypes` def; regenerated copy in `data/monster_hitboxes.js` | px | code |
| 2 | Target height | `h × 1.5 × sizeFactor(canvas/768, clamped 0.85–1.20) × mobScale` | px | — |
| 3 | Mob scale | `LX_MOB_SCALE_DATA`; live `localStorage lx_mob_scale` wins | × | R-key Monster Plant |
| 4 | Bbox-bottom anchor | `data/sprite_bbox.js` row for the static sprite (dimension-guarded), else runtime alpha scan | px | generated |
| 5 | Ground bury | `GROUND_BURY_FRAC = 0.02` (fliers `FLOATING_GROUND_BLEED = 0.04` up) | fraction | code |
| 6 | Foot nudge | `_MOB_SPRITE_FOOT_NUDGE = { slime: 0.14 }` | fraction | code |
| 7 | Pre-clamp hardcodes | `boneGolem +5+5`, `seastar +5+5` (three lines) | px | code |
| 8 | Bury clamp | `_BURY_MAX_PX = 6` | px | code |
| 9 | Post-clamp hardcodes | `boneGolem +10`, `grumpsquid +4`, `future_lyra +9`, `seastar +6` | px | code |
| 10 | Mob y-offset | `LX_MOB_OFFSET_DATA`; live `lx_mob_yoff` wins | px | R-key Monster Plant |
| 11 | Attack-frame blow-up | `_ATK_FRAME_SCALE` scales `dy` for attack frames | × | code |
| 12 | Anim calib | `LX_ANIM_CALIB` `{s, dx, dy, fs[], ft[]}` per (type, state) | s ×, dx/dy fraction | animator Copy-patch |

### Bosses (`_drawBossSprite`)

`BOSS_DRAW_SCALE` (gravitos 0.95) → content-normalisation against the manifest's per-frame boxes
(8 % threshold, 2 % for `_BOSS_SIZE_STRICT`) → `_BOSS_ATK_UNIFORM` / `_BOSS_ATK_NOSHRINK` /
`_BOSS_ATK_SCALE` (kingKrook 1.10) → per-sign push-down → bury clamp → calib `s/dx/dy`; the calib `s`
folds into the stashed `_visW/_visH` that `LX_ATK_HITBOX` fractions multiply.

### NPCs (`_drawNpcSprite`)

`_npcSpriteTargetHeight × npcScale` → bbox anchor `+ 2 %` → `LX_NPC_OFFSET_DATA` (`lx_npc_yoff`).
A third copy of the ladder shape with its own two tables.

---

## 6. Findings and consolidation plan

**F1 — the ladder exists three times.** `_lxMobPlantDy` (game), the Monster Plant preview
(`_lxMpDrawPreview`, re-implements steps 2/4/5/10 and skips 6–9), and `monster_animator.html`'s
"verbatim" constants. **F1b — and the mirror has already drifted:** the animator's `ATK_FRAME_SCALE`
still carries `fatDragon 1.951`, `smithgolem 1.881`, `conductorMech 1.69` while the game has
`fatDragon 1.199` and no entry for the other two (v0.30.239 / v0.30.403 / v0.30.415 changed the
game; the mirror was not updated). The animator previews those attacks at the wrong size today —
the exact failure class the Echo Knight +7 was.

**F2 — four independent vertical knobs** (6, 7, 9, 10; calib `dy` a fifth for animated states),
differing only in where they sit relative to the clamp.

**F3 — five scale knobs** (`sizeFactor`, mob scale, `_ATK_FRAME_SCALE`, calib `s`, boss
draw/attack scales); `monster_hitboxes.mul` exists only to re-derive them. The v0.30.408 → 415
round trip in §1a is this finding in action: a calib `s` stacked on `_ATK_FRAME_SCALE` because
nothing says which knob owns a set's size.

**F4 — three sources of "content bottom"** (static bbox table, manifest per-frame boxes, runtime
scan). The mob path anchors frames on the *static*'s bbox; the boss path per frame via the manifest.

**F5 — pre-clamp hardcodes are partly dead** (the clamp swallows them); golden values in
`echoknight_plant_test.mjs` are the contract, not the code.

**F6 — the live-edit layers** (`lx_mob_yoff`, `lx_mob_scale`, `lx_npc_*`, `lx_atk_hitbox`,
`lx_anim_calib`) shadow the baked tables per machine.

**Plan, safest first**

1. Fold every per-type px hardcode into `LX_MOB_OFFSET_DATA` (post-clamp pushes *are* offsets;
   pre-clamp ones re-derived against the goldens); delete the code lines in game **and** animator.
   Gate: the golden test extended to all five types + the Monster Plant preview.
2. One `data/draw_constants.js` (bury/bleed/clamp, foot nudge, `_ATK_FRAME_SCALE`, boss norm sets,
   `BOSS_DRAW_SCALE`) included by both pages — fixes F1b by construction; parity check asserts it is
   the only source.
3. Retire `sprite_bbox.js` for animated sets in favour of the manifest's per-frame boxes (F4).
4. Collapse the scale knobs to an authored per-type scale + calib `s`; `_ATK_FRAME_SCALE` and
   `_BOSS_ATK_SCALE` become per-state calib `s`; `monster_hitboxes.mul` derives from one number.
5. Land §4 only after steps 1–4, re-deriving §1c's fractions against the new boxes.

Steps 1–2 are mechanical and provable with the golden test; 3–5 change real numbers and want the
same per-type before/after measurement the Echo Knight and Legosaurus passes used.
