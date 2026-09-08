# Hitbox coverage pass — 2026-09-07 (v0.30.420)

Per user, after the v0.30.415 hitbox review: "Fix all of them, try to achieve 100% height then try to achieve 80-100% width, do not clobber the other parallel edits."

Method: `scripts/hitbox_coverage_probe.mjs` measures each type in the running game — every draw of it, the drawn image's visible pixels (alpha box; transparent padding never counts; effect art ignored) mapped to the screen against the box. The new box height is the visible height above the floor line; the new width is 85% of the wider of the idle and walk sets, never wider than the narrower one. A box under 90% or over 115% of the art gets its height; one under 80% or over 105% of the art gets its width. The draw multiplier (LX_MOB_SCALE_DATA for mobs, BOSS_DRAW_SCALE for bosses, _Z_BOX_ABS + BOSS_DRAW_SCALE for the zodiac signs) is lowered by old h / new h so the sprite on screen does not move. 118 boxes changed (98 mobs, 20 bosses). Left alone: gravitos (its box is deliberately larger than its art), frog and axolotl (the probe caught their shadows).

Correction to the v0.30.415 review: while a boss is staggered, `drawMonster` also draws the punish-window rim stamp and the "!", and the review's probe took the tallest thing drawn as the body — so several bosses (the zodiac signs, King, King Krook among them) were reported up to 1.5× taller than their art. The probe now skips staggered frames and never spawns an elite (its aura canvas is keyed by the box, so it would grow with the box). Every height below is the body alone. State shifts (a walk set drawn at a different size from the idle set, e.g. King Krook 315 px standing vs 196 px walking) are NOT fixed here: the box fits the base state and is flagged in the notes.

| type | boss | old w×h | new w×h | covers before → after | width before → after | draw mul before → after | notes |
|---|---|---|---|---|---|---|---|
| zodiac_sagittarius | yes | 146×146 | 303×387 | 37% → 98% | 37% → 78% | 2 → 0.7545 |  |
| kingKrook | yes | 120×130 | 347×344 | 36% → 95% | 29% → 85% | 2 → 0.7558 |  |
| zodiac_cancer | yes | 126×126 | 282×341 | 36% → 98% | 38% → 85% | 2 → 0.739 |  STATE SHIFT idle 347 / walk 248.3 (1.40x, calibration - not fixed here) |
| blightElder |  | 130×150 | 308×327 | 44% → 96% | 36% → 85% | 1.71 → 0.784 |  |
| zodiac_pisces | yes | 158×158 | 311×339 | 47% → 100% | 43% → 85% | 2 → 0.9322 |  |
| ossuaryTyrant |  | 110×130 | 259×323 | 39% → 97% | 36% → 85% | 2.19 → 0.881 |  |
| zodiac_leo | yes | 130×130 | 296×315 | 40% → 98% | 44% → 100% | 2 → 0.8254 |  |
| octobaby | yes | 200×160 | 308×312 | 50% → 98% | 55% → 85% | 2 → 1.0256 |  |
| legosaurus | yes | 224×238 | 388×293 | 77% → 95% | 49% → 85% | 2 → 1.6246 |  |
| zodiac_taurus | yes | 118×118 | 283×290 | 38% → 95% | 35% → 84% | 2 → 0.8138 |  |
| aetherion | yes | 160×160 | 309×275 | 57% → 97% | 44% → 85% | 2 → 1.1636 |  |
| zodiac_aquarius | yes | 154×154 | 199×277 | 56% → 100% | 69% → 89% | 2 → 1.1119 |  |
| zodiac_aries | yes | 114×114 | 186×272 | 42% → 100% | 52% → 85% | 2 → 0.8382 |  |
| pathsBane |  | 130×150 | 155×261 | 56% → 98% | 71% → 85% | 1.02 → 0.586 |  |
| zodiac_scorpio | yes | 142×142 | 217×218 | 54% → 83% | 56% → 85% | 2 → 1.3028 |  |
| zodiac_libra | yes | 138×138 | 181×250 | 54% → 98% | 67% → 88% | 2 → 1.104 |  |
| sundered_smith | yes | 140×140 | 208×246 | 56% → 98% | 57% → 85% | 2 → 1.1382 |  ART OFF-CENTRE -40.9px |
| elderbark |  | 130×150 | 159×238 | 60% → 95% | 69% → 85% | 1.05 → 0.662 |  |
| zodiac_capricorn | yes | 150×150 | 231×244 | 61% → 100% | 65% → 100% | 2 → 1.2295 |  |
| zodiac_virgo | yes | 134×134 | 290×242 | 55% → 100% | 39% → 85% | 2 → 1.1074 |  |
| echoKnight |  | 110×130 | 170×230 | 55% → 98% | 55% → 85% | 1.12 → 0.633 |  |
| king | yes | 112×98 | 191×230 | 42% → 99% | 50% → 85% | 2 → 0.8522 |  |
| brinekraken |  | 175×150 | 203×217 | 67% → 96% | 73% → 85% | 0.88 → 0.608 |  |
| octoLegStun |  | 80×60 | 116×204 | 28% → 94% | 59% → 85% | 2.45 → 0.721 |  |
| octoLegFreeze |  | 80×60 | 109×199 | 28% → 94% | 63% → 85% | 2.33 → 0.703 |  |
| young_confused_barnaby | yes | 120×140 | 141×195 | 67% → 93% | 74% → 88% | 2 → 1.4359 |  |
| pinechad |  | 96×104 | 171×204 | 50% → 98% | 48% → 85% | 1.21 → 0.617 |  |
| octoLegPoison |  | 80×60 | 106×184 | 31% → 94% | 64% → 85% | 2.44 → 0.796 |  |
| shardlich |  | 82×92 | 116×191 | 47% → 97% | 60% → 85% | 1.31 → 0.631 |  |
| mooma | yes | 133×151 | 161×186 | 77% → 95% | 70% → 85% | 2 → 1.6237 |  |
| forgewight |  | 110×130 | 128×187 | 68% → 98% | 73% → 85% | 1 → 0.695 |  |
| octoLegSkillLock |  | 80×60 | 96×166 | 34% → 94% | 70% → 85% | 2.43 → 0.878 |  |
| glasswindHare |  | 170×150 | 108×167 | 88% → 98% | 133% → 85% | 0.84 → 0.754 |  |
| zodiac_gemini | yes | 122×122 | 160×165 | 74% → 100% | 65% → 85% | 2 → 1.4788 |  |
| blockGary |  | 115×115 | 82×158 | 70% → 96% | 119% → 85% | 1.06 → 0.772 |  |
| graveReaver |  | 80×110 | 102×135 | 76% → 93% | 67% → 85% | 1.08 → 0.88 |  |
| goblinMauler |  | 90×108 | 133×142 | 75% → 98% | 58% → 85% | 1 → 0.761 |  |
| archon |  | 65×74 | 89×136 | 52% → 96% | 63% → 86% | 1.12 → 0.609 |  |
| meloncholy |  | 112×88 | 132×127 | 65% → 93% | 72% → 85% | 1.25 → 0.866 |  |
| spectreCannoneer |  | 68×70 | 101×134 | 51% → 98% | 57% → 85% | 1.22 → 0.637 |  |
| boneGolem |  | 90×100 | 90×131 | 75% → 98% | 92% → 92% | 1 → 0.763 |  |
| towerOssifer |  | 72×88 | 102×127 | 68% → 98% | 60% → 85% | 1.2 → 0.831 |  |
| fatDragon |  | 90×78 | 112×124 | 61% → 97% | 68% → 85% | 1 → 0.629 |  |
| boneWraith |  | 55×72 | 86×124 | 56% → 97% | 55% → 85% | 1.31 → 0.761 |  |
| bonebosn |  | 60×75 | 80×123 | 59% → 97% | 73% → 97% | 0.96 → 0.585 |  |
| tombKeeper |  | 72×81 | 86×124 | 64% → 98% | 71% → 85% | 0.9 → 0.588 |  |
| seraph |  | 55×65 | 139×126 | 52% → 100% | 34% → 85% | 1.43 → 0.738 |  |
| mournshade |  | 70×90 | 76×114 | 72% → 91% | 82% → 89% | 1.05 → 0.829 |  |
| thornmaw |  | 88×78 | 106×119 | 63% → 97% | 71% → 85% | 1.25 → 0.819 |  |
| blockEle |  | 114×103 | 114×118 | 84% → 96% | 84% → 84% | 1 → 0.873 |  |
| sepulchreHound |  | 72×58 | 102×111 | 50% → 95% | 60% → 85% | 1.46 → 0.763 |  |
| future_lyra |  | 69×93 | 54×112 | 82% → 98% | 108% → 84% | 1 → 0.83 |  |
| mirageStalker |  | 80×86 | 80×108 | 76% → 96% | 95% → 95% | 0.94 → 0.749 |  |
| blockTigreal |  | 112×102 | 78×102 | 91% → 91% | 122% → 85% | 0.95 → 0.95 |  |
| lichkin |  | 48×60 | 65×106 | 54% → 96% | 64% → 86% | 1.18 → 0.668 |  |
| vigil_vermillion |  | 64×80 | 88×108 | 73% → 98% | 62% → 85% | 1 → 0.741 |  |
| deranged_kuro |  | 48×64 | 76×102 | 60% → 95% | 54% → 85% | 1.14 → 0.715 |  |
| towerHexer |  | 60×78 | 72×106 | 73% → 100% | 71% → 85% | 1.19 → 0.876 |  |
| willeo |  | 68×80 | 68×102 | 77% → 98% | 81% → 81% | 0.93 → 0.729 |  |
| bellowsbat |  | 63×54 | 96×101 | 53% → 99% | 56% → 85% | 1.33 → 0.711 |  |
| young_bloodthirsty_vermillion |  | 60×74 | 83×100 | 73% → 98% | 62% → 85% | 1 → 0.74 |  |
| towerStormcaller |  | 60×74 | 80×98 | 74% → 98% | 64% → 85% | 1.17 → 0.883 |  |
| seahorse |  | 56×75 | 56×97 | 76% → 98% | 104% → 104% | 1 → 0.773 |  |
| stormKitty |  | 81×77 | 81×93 | 80% → 96% | 88% → 88% | 1 → 0.828 |  |
| tombWraith |  | 48×60 | 62×96 | 63% → 100% | 69% → 89% | 1.27 → 0.794 |  |
| wraith |  | 60×75 | 67×93 | 80% → 100% | 77% → 86% | 1 → 0.806 |  |
| towerStalker |  | 62×82 | 62×91 | 89% → 98% | 85% → 85% | 1 → 0.901 |  |
| drownedCur |  | 63×53 | 113×89 | 58% → 97% | 48% → 85% | 1.14 → 0.679 |  |
| seastar |  | 78×75 | 78×83 | 83% → 92% | 96% → 96% | 1 → 0.904 |  |
| jellyfish |  | 56×66 | 56×90 | 73% → 100% | 98% → 98% | 1 → 0.733 |  |
| blockHupo |  | 82×79 | 55×87 | 88% → 97% | 127% → 85% | 1 → 0.908 |  |
| cherub |  | 46×50 | 56×88 | 57% → 100% | 70% → 85% | 1.41 → 0.801 |  |
| blockPopo |  | 66×66 | 75×83 | 76% → 95% | 75% → 85% | 1.16 → 0.922 |  |
| mayo |  | 62×54 | 71×83 | 63% → 97% | 76% → 87% | 1.24 → 0.807 |  |
| potato_uncle |  | 54×60 | 60×84 | 70% → 98% | 76% → 85% | 1 → 0.714 |  |
| nougatBear |  | 84×80 | 57×80 | 94% → 94% | 126% → 85% | 1 → 1 |  |
| sparkSprite |  | 68×77 | 82×77 | 92% → 92% | 70% → 85% | 1 → 1 |  |
| mummy |  | 57×72 | 57×82 | 86% → 98% | 96% → 96% | 1 → 0.878 |  |
| towerShardling |  | 52×54 | 52×79 | 65% → 95% | 80% → 80% | 1.24 → 0.848 |  |
| razorgale |  | 78×60 | 78×83 | 73% → 101% | 93% → 93% | 1.22 → 0.882 |  |
| ticketMech |  | 60×52 | 43×78 | 64% → 95% | 119% → 85% | 1.37 → 0.913 |  |
| fatLizard |  | 63×53 | 63×76 | 66% → 95% | 92% → 92% | 1.19 → 0.83 |  |
| zombie |  | 58×66 | 45×77 | 83% → 97% | 109% → 85% | 0.88 → 0.754 |  |
| skeleton |  | 52×66 | 52×77 | 84% → 98% | 101% → 101% | 1 → 0.857 |  |
| expressTicketMech |  | 60×52 | 48×74 | 67% → 95% | 105% → 84% | 1.36 → 0.956 |  |
| smithgolem |  | 96×105 | 96×74 | 135% → 95% | 88% → 88% | 0.65 → 0.922 |  |
| gummy |  | 68×68 | 52×72 | 88% → 93% | 111% → 85% | 1 → 0.944 |  |
| seasponge |  | 69×72 | 59×72 | 93% → 93% | 99% → 84% | 0.89 → 0.89 |  |
| coralImp |  | 42×42 | 54×75 | 54% → 97% | 66% → 85% | 1.56 → 0.874 |  |
| sparkling |  | 44×46 | 67×76 | 61% → 100% | 56% → 86% | 1.25 → 0.757 |  |
| nimbusFox |  | 55×50 | 67×71 | 66% → 94% | 71% → 86% | 1.06 → 0.746 |  |
| thunderMole |  | 76×69 | 62×69 | 96% → 96% | 105% → 86% | 0.9 → 0.9 |  |
| lanternWisp |  | 62×62 | 27×70 | 88% → 100% | 196% → 85% | 1 → 0.886 |  |
| frostkin |  | 68×68 | 48×68 | 98% → 98% | 121% → 85% | 1 → 1 |  |
| cloudbun |  | 54×45 | 63×69 | 65% → 99% | 73% → 85% | 1.07 → 0.698 |  |
| cinderling |  | 56×54 | 62×64 | 79% → 94% | 77% → 85% | 1 → 0.844 |  |
| pearlSprite |  | 40×46 | 60×64 | 68% → 95% | 57% → 85% | 1.22 → 0.877 |  |
| anglerfish |  | 60×48 | 75×67 | 72% → 100% | 68% → 85% | 1.42 → 1.017 |  |
| orange |  | 40×42 | 50×62 | 64% → 94% | 70% → 87% | 1.27 → 0.86 |  |
| petalfly |  | 44×40 | 55×65 | 61% → 100% | 68% → 85% | 1.4 → 0.862 |  |
| tidepoolTurtle |  | 62×52 | 42×62 | 81% → 96% | 125% → 85% | 1 → 0.839 |  |
| emberling |  | 32×34 | 46×60 | 55% → 96% | 60% → 86% | 1.52 → 0.861 |  |
| goblinScout |  | 38×44 | 38×60 | 71% → 97% | 82% → 82% | 1.17 → 0.858 |  |
| scorpion |  | 66×45 | 72×48 | 76% → 81% | 78% → 85% | 1 → 0.938 |  |
| voltipup |  | 81×72 | 60×58 | 123% → 99% | 115% → 85% | 1.11 → 1.378 |  |
| cosmicMochi |  | 46×41 | 58×57 | 71% → 99% | 68% → 86% | 1.36 → 0.978 |  |
| cookie |  | 62×52 | 49×52 | 91% → 91% | 107% → 85% | 1 → 1 |  |
| sproutle |  | 40×40 | 40×54 | 71% → 96% | 102% → 102% | 1.2 → 0.889 |  |
| tidefish |  | 32×24 | 54×50 | 45% → 94% | 51% → 87% | 1.58 → 0.758 |  |
| slime |  | 34×28 | 42×47 | 56% → 93% | 69% → 85% | 1.48 → 0.882 |  |
| clownfish |  | 48×38 | 48×50 | 76% → 100% | 82% → 82% | 1.15 → 0.874 |  |
| stump |  | 38×44 | 47×44 | 90% → 90% | 68% → 84% | 1 → 1 |  |
| mushpup |  | 45×42 | 45×48 | 86% → 99% | 93% → 93% | 1 → 0.875 |  |
| honeyBuzz |  | 41×36 | 47×43 | 74% → 89% | 74% → 85% | 1.2 → 1.005 |  |
| stoneling |  | 38×36 | 41×47 | 75% → 97% | 79% → 85% | 1.28 → 0.98 |  |
| snail |  | 66×56 | 57×42 | 130% → 97% | 106% → 92% | 1 → 1.333 |  |
| tideling |  | 34×30 | 34×37 | 81% → 100% | 88% → 85% | 1.1 → 0.892 |  |
| towerWisp |  | 48×54 | 33×37 | 146% → 100% | 124% → 85% | 1 → 1.459 |  |

Verified by `scripts/hitbox_coverage_test.mjs` (the 30 tallest by default, `--all` for every type).
