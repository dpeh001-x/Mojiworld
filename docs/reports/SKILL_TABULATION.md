# Skill tabulation — v0.30.772 (measured)

Every skill cast once at a pinned dummy (ATK 1000, level 90, evasion 0, crits off, RNG pinned); damage is the dummy's HP loss over 10 s as a % of that class's basic hit. "Mobs" = distinct monsters hit out of a 6-mob cluster. Statuses are the dummy fields the cast set. Flags compare a row with the median of its own tier in its class: HIGH > 2×, LOW < 0.5×.

## warrior — basic slash = 1579 per hit

| tier | key | skill | id | dmg %basic | lines | per line | cd s | mp | %basic per 10 s cd | mobs | statuses | flag |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| basic | C | Rush | rush | 154% | 2 | 77% | 1.8 | 15 | 854 | 1/6 | _proxRestUntil animTimer |  |
| basic | D | War Cry | warCry | 202% | 1 | 202% | 18.0 | 23 | 112 | 2/6 | animTimer |  |
| basic | S | Ground Slam | groundSlam | 220% | 3 | 73% | 4.0 | 18 | 550 | 2/6 | animTimer knockback |  |
| basic | X | Somersault Smash | powerStrike | 235% | 2 | 118% | 4.5 | 13 | 523 | 3/6 | animTimer knockback stunTimer |  |
| basic | Z | Slash | slash | 100% | 1 | 100% | 0.7 | 0 | 1389 | 1/6 | animTimer | LOW |
| job | F | Bloodlust | bloodlust | 0% | 0 | - | 48.0 | 28 | 0 | 0/6 | animTimer | utility |
| job | F | Guardian | guardian | 0% | 0 | - | 11.0 | 23 | 0 | 0/6 | animTimer | utility |
| job | V | Rampage | rampage | 551% | 8 | 69% | 8.0 | 56 | 688 | 2/6 | animTimer |  |
| job | V | Holy Shield | holyShield | 899% | 3 | 300% | 22.0 | 56 | 409 | 3/6 | animTimer |  |
| master | B | War of Banners | warlord_ult | 932% | 2 | 466% | 60.0 | 88 | 155 | 5/6 | animTimer |  |
| master | B | Calamity Incarnate | doombringer_ult | 1000% | 8 | 125% | 50.0 | 90 | 200 | 5/6 | _doomStacks _doomUntil animTimer knockback |  |
| master | B | Bastion of Dawn | crusader_ult | 2497% | 3 | 832% | 60.0 | 85 | 416 | 6/6 | animTimer | HIGH |
| master | B | Skyfall Dominion | dragoon_ult | 935% | 10 | 94% | 50.0 | 78 | 187 | 6/6 | animTimer |  |
| master | G | Warlord's Banner | warlord_warcry | 970% | 3 | 323% | 19.0 | 38 | 511 | 3/6 | animTimer |  |
| master | G | Blade of Calamity | doombringer_apoc | 999% | 11 | 91% | 18.0 | 75 | 555 | 5/6 | _doomStacks _doomUntil animTimer knockback |  |
| master | G | Divine Aegis | crusader_aegis | 857% | 3 | 286% | 26.0 | 56 | 330 | 2/6 | animTimer |  |
| master | G | Sky Lance | dragoon_skylance | 999% | 2 | 500% | 25.0 | 44 | 400 | 2/6 | animTimer knockback stunTimer |  |

## rogue — basic stab = 1023 per hit

| tier | key | skill | id | dmg %basic | lines | per line | cd s | mp | %basic per 10 s cd | mobs | statuses | flag |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| basic | C | Smoke Dash | smokeDash | 144% | 4 | 36% | 1.5 | 18 | 963 | 2/6 | _proxRestUntil animTimer |  |
| basic | D | Flurry | flurry | 130% | 1 | 130% | 1.0 | 23 | 1301 | 3/6 | animTimer |  |
| basic | S | Shuriken | throwDagger | 141% | 5 | 28% | 1.3 | 8 | 1087 | 1/6 | animTimer knockback |  |
| basic | X | Backstab | backstab | 160% | 2 | 80% | 2.0 | 8 | 801 | 1/6 | animTimer |  |
| basic | Z | Stab | stab | 100% | 1 | 100% | 0.3 | 0 | 3333 | 1/6 | animTimer |  |
| job | F | Shadow Strike | shadowStrike | 524% | 5 | 105% | 7.0 | 28 | 748 | 5/6 | _proxRestUntil animTimer |  |
| job | F | Shin-Shuriken | smokeBomb | 581% | 12 | 48% | 9.0 | 38 | 645 | 2/6 | animTimer |  |
| job | V | Death Blossom | deathBlossom | 552% | 3 | 184% | 8.0 | 63 | 690 | 5/6 | _proxRestUntil animTimer |  |
| job | V | Voidrift Blink | sleight | 700% | 1 | 700% | 14.0 | 31 | 500 | 4/6 | animTimer |  |
| master | B | Shadow Sovereign | shadowlord_ult | 0% | 0 | - | 60.0 | 78 | 0 | 0/6 | animTimer | utility |
| master | B | Hundred-Hand Shadow Dance | shinobi_ult | 1002% | 5 | 200% | 45.0 | 75 | 223 | 2/6 | animTimer knockback |  |
| master | B | Bloodmoon Domain | nightreaper_ult | 998% | 16 | 62% | 45.0 | 78 | 222 | 6/6 | animTimer knockback |  |
| master | B | Voidwalk | phantom_ult | 998% | 3 | 333% | 50.0 | 78 | 200 | 6/6 | animTimer |  |
| master | G | Mirror Shadow | shadowlord_clones | 0% | 0 | - | 22.0 | 50 | 0 | 6/6 | animTimer knockback | utility |
| master | G | Kage Rush | shinobi_seal | 1000% | 1 | 1000% | 15.0 | 23 | 666 | 4/6 | animTimer knockback |  |
| master | G | Eclipse Massacre | nightreaper_mark | 909% | 11 | 83% | 25.0 | 69 | 364 | 6/6 | animTimer knockback stunTimer |  |
| master | G | Voidrift Execution | phantom_cut | 970% | 7 | 139% | 20.0 | 69 | 485 | 6/6 | _proxRestUntil _voidBrand animTimer knockback |  |

## mage — basic magicBolt = 1376 per hit

| tier | key | skill | id | dmg %basic | lines | per line | cd s | mp | %basic per 10 s cd | mobs | statuses | flag |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| basic | C | Dimensional Warp | blink | 172% | 1 | 172% | 2.4 | 18 | 716 | 2/6 | _proxRestUntil animTimer |  |
| basic | D | Arcane Burst | arcaneBurst | 310% | 1 | 310% | 7.0 | 28 | 442 | 3/6 | animTimer |  |
| basic | S | Ice Spike | iceSpike | 236% | 3 | 79% | 4.5 | 15 | 524 | 2/6 | animTimer knockback |  |
| basic | X | Fireball | fireball | 172% | 1 | 172% | 2.4 | 18 | 716 | 2/6 | animTimer |  |
| basic | Z | Magic Bolt | magicBolt | 100% | 1 | 100% | 0.7 | 0 | 1389 | 1/6 | animTimer |  |
| job | F | Meteor | meteor | 600% | 1 | 600% | 10.0 | 44 | 600 | 2/6 | animTimer |  |
| job | F | Soul Siphon | soulSiphon | 838% | 32 | 26% | 20.0 | 15 | 419 | 2/6 | animTimer |  |
| job | F | Holy Light | holyLight | 62% | 1 | 62% | 12.0 | 60 | 52 | 3/6 | animTimer | LOW |
| job | V | Elemental Convergence | elemental | 701% | 1 | 701% | 14.0 | 69 | 501 | 1/6 | animTimer |  |
| job | V | Dark Pulse | darkPulse | 874% | 73 | 12% | 26.0 | 56 | 336 | 2/6 | animTimer |  |
| job | V | Celestial Aurora | celestialAurora | 383% | 9 | 43% | 10.0 | 80 | 383 | 3/6 | animTimer |  |
| master | B | Meteor Sigil | sage_ult | 998% | 1 | 998% | 50.0 | 115 | 200 | 1/6 | animTimer |  |
| master | B | Elemental Apotheosis | elementalist_ult | 995% | 2 | 498% | 40.0 | 125 | 249 | 3/6 | animTimer freezeTimer |  |
| master | B | Necrotic Ascendance | necromancer_ult | 944% | 12 | 79% | 60.0 | 115 | 157 | 4/6 | animTimer |  |
| master | B | Pandemic Hex | hexmaster_ult | 964% | 13 | 74% | 50.0 | 106 | 193 | 5/6 | _burnStack _burnTickAcc _dotKind _hexStacks _hexUntil animTimer burnDmg burnTimer freezeTimer knockback |  |
| master | B | Apotheosis | archbishop_ult | 1000% | 6 | 167% | 65.0 | 125 | 154 | 6/6 | animTimer knockback |  |
| master | G | Judgment of the Holy Grail | archbishop_grail | 936% | 7 | 134% | 32.0 | 75 | 292 | 5/6 | animTimer |  |
| master | G | Pyre Columns | sage_meteorshower | 910% | 3 | 303% | 17.0 | 69 | 535 | 4/6 | animTimer knockback |  |
| master | G | Prismatic Cascade | elementalist_cascade | 941% | 4 | 235% | 15.0 | 63 | 628 | 4/6 | _burnStack _burnTickAcc _dotKind animTimer burnDmg burnTimer freezeTimer knockback stunTimer |  |
| master | G | Soul Vortex | necromancer_harvest | 944% | 17 | 56% | 40.0 | 50 | 236 | 3/6 | animTimer |  |
| master | G | Grand Hex | hexmaster_grandhex | 962% | 12 | 80% | 25.0 | 44 | 385 | 5/6 | _burnStack _burnTickAcc _dotKind _hexRuptureAt _hexStacks _hexUntil animTimer burnDmg burnTimer freezeTimer knockback |  |

## archer — basic arrowShot = 1969 per hit

| tier | key | skill | id | dmg %basic | lines | per line | cd s | mp | %basic per 10 s cd | mobs | statuses | flag |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| basic | C | Evade Burst | evadeRoll | 340% | 2 | 170% | 8.0 | 10 | 425 | 1/6 | animTimer |  |
| basic | D | Eagle Eye | eagleEye | 0% | 0 | - | 60.0 | 20 | 0 | 0/6 | animTimer | utility |
| basic | S | Charged Shot | chargedShot | 220% | 1 | 220% | 4.0 | 18 | 550 | 3/6 | animTimer |  |
| basic | X | Multi Shot | multiShot | 179% | 3 | 60% | 2.6 | 13 | 688 | 1/6 | animTimer knockback |  |
| basic | Z | Arrow Shot | arrowShot | 104% | 1 | 104% | 0.8 | 0 | 1296 | 1/6 | animTimer | LOW |
| job | F | Railshot | snipe_railgun | 650% | 1 | 650% | 12.0 | 35 | 542 | 5/6 | animTimer |  |
| job | F | Wild Bond | wildBond | 900% | 7 | 129% | 70.0 | 38 | 129 | 1/6 | animTimer |  |
| job | V | Arrow Rain | arrowRain | 0% | 0 | - | 18.0 | 53 | 0 | 1/6 | animTimer | utility |
| job | V | Elemental Arrows | elementalArrows | 778% | 10 | 78% | 17.0 | 50 | 458 | 3/6 | animTimer |  |
| master | B | Deadeye Protocol | marksman_ult | 980% | 155 | 6% | 60.0 | 81 | 163 | 1/6 | animTimer |  |
| master | B | War Machine | ballista_ult | 1074% | 11 | 98% | 60.0 | 88 | 179 | 1/6 | animTimer |  |
| master | B | Apex Bond | beastmaster_ult | 1001% | 7 | 143% | 60.0 | 81 | 167 | 1/6 | animTimer |  |
| master | B | Eye of the Tempest | skyhunter_ult | 916% | 14 | 65% | 60.0 | 81 | 153 | 3/6 | _skyMarkUntil animTimer |  |
| master | G | Deadeye | marksman_oneshot | 995% | 81 | 12% | 30.0 | 63 | 332 | 1/6 | animTimer |  |
| master | G | Siege Volley | ballista_volley | 999% | 106 | 9% | 23.0 | 31 | 434 | 5/6 | animTimer knockback stunTimer |  |
| master | G | Call of the Wild | beastmaster_pack | 1000% | 35 | 29% | 100.0 | 63 | 100 | 2/6 | animTimer |  |
| master | G | Gale Storm | skyhunter_gale | 977% | 13 | 75% | 19.0 | 56 | 514 | 5/6 | animTimer |  |

