# Skill tabulation — v0.30.777 (measured)

Every skill cast once at a pinned dummy (ATK 1000, level 90, evasion 0, crits off, RNG pinned); damage is the dummy's HP loss over 10 s as a % of that class's basic hit. "Mobs" = distinct monsters hit out of a 6-mob cluster. Statuses are the dummy fields the cast set. Flags compare a row with the median of its own tier in its class: HIGH > 2×, LOW < 0.5×.

## warrior — basic slash = 1579 per hit

| tier | key | skill | id | dmg %basic | lines | per line | cd s | mp | %basic per 10 s cd | mobs | statuses | flag |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| basic | C | Rush | rush | 489% | 2 | 245% | 1.8 | 15 | 2717 | 1/6 | _proxRestUntil animTimer |  |
| basic | D | War Cry | warCry | 337% | 1 | 337% | 18.0 | 23 | 187 | 2/6 | animTimer |  |
| basic | S | Ground Slam | groundSlam | 275% | 3 | 92% | 4.0 | 18 | 688 | 2/6 | animTimer knockback |  |
| basic | X | Somersault Smash | powerStrike | 544% | 2 | 272% | 4.5 | 13 | 1210 | 3/6 | animTimer knockback stunTimer |  |
| basic | Z | Slash | slash | 100% | 1 | 100% | 0.7 | 0 | 1429 | 1/6 | animTimer | LOW |
| job | F | Bloodlust | bloodlust | 0% | 0 | - | 45.0 | 28 | 0 | 0/6 | animTimer | utility |
| job | F | Guardian | guardian | 0% | 0 | - | 30.0 | 23 | 0 | 0/6 | animTimer | utility |
| job | V | Rampage | rampage | 689% | 8 | 86% | 10.0 | 56 | 689 | 2/6 | animTimer |  |
| job | V | Holy Shield | holyShield | 1125% | 3 | 375% | 25.0 | 56 | 450 | 3/6 | animTimer |  |
| master | B | War of Banners | warlord_ult | 1801% | 2 | 901% | 60.0 | 88 | 300 | 5/6 | animTimer |  |
| master | B | Calamity Incarnate | doombringer_ult | 4200% | 8 | 525% | 50.0 | 90 | 840 | 5/6 | _doomStacks _doomUntil animTimer | HIGH |
| master | B | Bastion of Dawn | crusader_ult | 3122% | 3 | 1041% | 60.0 | 85 | 520 | 6/6 | animTimer |  |
| master | B | Skyfall Dominion | dragoon_ult | 5075% | 10 | 508% | 50.0 | 78 | 1015 | 6/6 | animTimer | HIGH |
| master | G | Warlord's Banner | warlord_warcry | 1213% | 3 | 404% | 25.0 | 63 | 485 | 3/6 | animTimer |  |
| master | G | Blade of Calamity | doombringer_apoc | 998% | 11 | 91% | 18.0 | 75 | 555 | 5/6 | _doomStacks _doomUntil animTimer knockback |  |
| master | G | Divine Aegis | crusader_aegis | 1682% | 4 | 421% | 20.0 | 56 | 841 | 2/6 | animTimer |  |
| master | G | Sky Lance | dragoon_skylance | 1004% | 2 | 502% | 25.0 | 44 | 402 | 2/6 | animTimer knockback stunTimer |  |

## rogue — basic stab = 1023 per hit

| tier | key | skill | id | dmg %basic | lines | per line | cd s | mp | %basic per 10 s cd | mobs | statuses | flag |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| basic | C | Smoke Dash | smokeDash | 181% | 4 | 45% | 1.5 | 18 | 1206 | 2/6 | _proxRestUntil animTimer |  |
| basic | D | Flurry | flurry | 322% | 1 | 322% | 1.0 | 23 | 3218 | 3/6 | animTimer |  |
| basic | S | Shuriken | throwDagger | 370% | 5 | 74% | 1.3 | 8 | 2842 | 1/6 | animTimer knockback |  |
| basic | X | Backstab | backstab | 224% | 2 | 112% | 2.0 | 8 | 1118 | 1/6 | animTimer |  |
| basic | Z | Stab | stab | 100% | 1 | 100% | 0.3 | 0 | 3333 | 1/6 | animTimer | LOW |
| job | F | Shadow Strike | shadowStrike | 655% | 5 | 131% | 7.0 | 28 | 936 | 5/6 | _proxRestUntil animTimer |  |
| job | F | Shin-Shuriken | smokeBomb | 581% | 12 | 48% | 6.0 | 31 | 968 | 2/6 | animTimer |  |
| job | V | Death Blossom | deathBlossom | 767% | 3 | 256% | 10.0 | 63 | 767 | 5/6 | _proxRestUntil animTimer |  |
| job | V | Voidrift Blink | sleight | 365% | 1 | 365% | 12.0 | 31 | 304 | 4/6 | animTimer |  |
| master | B | Shadow Sovereign | shadowlord_ult | 0% | 0 | - | 60.0 | 78 | 0 | 0/6 | animTimer | utility |
| master | B | Hundred-Hand Shadow Dance | shinobi_ult | 1922% | 5 | 384% | 40.0 | 75 | 480 | 2/6 | animTimer knockback |  |
| master | B | Bloodmoon Domain | nightreaper_ult | 2356% | 16 | 147% | 40.0 | 78 | 589 | 6/6 | animTimer knockback |  |
| master | B | Voidwalk | phantom_ult | 1247% | 3 | 416% | 45.0 | 78 | 277 | 6/6 | animTimer |  |
| master | G | Mirror Shadow | shadowlord_clones | 0% | 0 | - | 20.0 | 63 | 0 | 6/6 | animTimer | utility |
| master | G | Kage Rush | shinobi_seal | 438% | 1 | 438% | 15.0 | 23 | 292 | 4/6 | animTimer knockback | LOW |
| master | G | Eclipse Massacre | nightreaper_mark | 1631% | 11 | 148% | 25.0 | 69 | 653 | 6/6 | animTimer knockback stunTimer |  |
| master | G | Voidrift Execution | phantom_cut | 5374% | 7 | 768% | 20.0 | 69 | 2687 | 6/6 | _proxRestUntil _voidBrand animTimer knockback | HIGH |

## mage — basic magicBolt = 1181 per hit

| tier | key | skill | id | dmg %basic | lines | per line | cd s | mp | %basic per 10 s cd | mobs | statuses | flag |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| basic | C | Dimensional Warp | blink | 215% | 1 | 215% | 2.4 | 19 | 895 | 2/6 | _proxRestUntil animTimer |  |
| basic | D | Arcane Burst | arcaneBurst | 248% | 1 | 248% | 8.0 | 31 | 310 | 3/6 | animTimer |  |
| basic | S | Ice Spike | iceSpike | 274% | 3 | 91% | 3.0 | 19 | 914 | 2/6 | animTimer knockback |  |
| basic | X | Fireball | fireball | 250% | 1 | 250% | 2.3 | 13 | 1088 | 2/6 | animTimer |  |
| basic | Z | Magic Bolt | magicBolt | 100% | 1 | 100% | 0.8 | 0 | 1333 | 1/6 | animTimer | LOW |
| job | F | Meteor | meteor | 420% | 1 | 420% | 8.0 | 44 | 525 | 2/6 | animTimer |  |
| job | F | Soul Siphon | soulSiphon | 3727% | 33 | 113% | 20.0 | 15 | 1864 | 2/6 | animTimer | HIGH |
| job | F | Holy Light | holyLight | 165% | 1 | 165% | 10.0 | 60 | 165 | 3/6 | animTimer | LOW |
| job | V | Elemental Convergence | elemental | 335% | 1 | 335% | 13.0 | 69 | 257 | 1/6 | animTimer | LOW |
| job | V | Dark Pulse | darkPulse | 4919% | 73 | 67% | 30.0 | 69 | 1640 | 2/6 | animTimer | HIGH |
| job | V | Celestial Aurora | celestialAurora | 744% | 9 | 83% | 15.0 | 80 | 496 | 3/6 | animTimer |  |
| master | B | Meteor Sigil | sage_ult | 483% | 1 | 483% | 50.0 | 123 | 97 | 1/6 | animTimer | LOW |
| master | B | Elemental Apotheosis | elementalist_ult | 939% | 2 | 469% | 40.0 | 125 | 235 | 3/6 | animTimer freezeTimer |  |
| master | B | Necrotic Ascendance | necromancer_ult | 1426% | 12 | 119% | 60.0 | 115 | 238 | 4/6 | animTimer |  |
| master | B | Pandemic Hex | hexmaster_ult | 2448% | 13 | 188% | 50.0 | 106 | 490 | 5/6 | _burnStack _burnTickAcc _dotKind _hexStacks _hexUntil animTimer burnDmg burnTimer freezeTimer knockback |  |
| master | B | Apotheosis | archbishop_ult | 4462% | 6 | 744% | 65.0 | 125 | 686 | 6/6 | animTimer knockback | HIGH |
| master | G | Judgment of the Holy Grail | archbishop_grail | 3517% | 7 | 502% | 30.0 | 75 | 1172 | 5/6 | animTimer | HIGH |
| master | G | Pyre Columns | sage_meteorshower | 1140% | 3 | 380% | 18.0 | 69 | 633 | 4/6 | animTimer knockback |  |
| master | G | Prismatic Cascade | elementalist_cascade | 1305% | 4 | 326% | 15.0 | 63 | 870 | 4/6 | _burnStack _burnTickAcc _dotKind animTimer burnDmg burnTimer freezeTimer knockback stunTimer |  |
| master | G | Soul Vortex | necromancer_harvest | 772% | 17 | 45% | 40.0 | 50 | 193 | 3/6 | animTimer |  |
| master | G | Grand Hex | hexmaster_grandhex | 3396% | 12 | 283% | 25.0 | 44 | 1358 | 5/6 | _burnStack _burnTickAcc _dotKind _hexRuptureAt _hexStacks _hexUntil animTimer burnDmg burnTimer freezeTimer | HIGH |

## archer — basic arrowShot = 1964 per hit

| tier | key | skill | id | dmg %basic | lines | per line | cd s | mp | %basic per 10 s cd | mobs | statuses | flag |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| basic | C | Evade Burst | evadeRoll | 220% | 2 | 110% | 8.0 | 10 | 275 | 1/6 | animTimer |  |
| basic | D | Eagle Eye | eagleEye | 0% | 0 | - | 60.0 | 20 | 0 | 0/6 | animTimer | utility |
| basic | S | Charged Shot | chargedShot | 238% | 1 | 238% | 4.0 | 18 | 595 | 3/6 | animTimer |  |
| basic | X | Multi Shot | multiShot | 314% | 3 | 105% | 2.6 | 13 | 1208 | 1/6 | animTimer knockback |  |
| basic | Z | Arrow Shot | arrowShot | 103% | 1 | 103% | 0.8 | 0 | 1292 | 1/6 | animTimer | LOW |
| job | F | Railshot | snipe_railgun | 663% | 1 | 663% | 12.0 | 35 | 553 | 5/6 | animTimer |  |
| job | F | Wild Bond | wildBond | 327% | 7 | 47% | 60.0 | 38 | 55 | 1/6 | animTimer | LOW |
| job | V | Arrow Rain | arrowRain | 0% | 0 | - | 10.0 | 53 | 0 | 1/6 | animTimer | utility |
| job | V | Elemental Arrows | elementalArrows | 1658% | 10 | 166% | 14.0 | 50 | 1184 | 3/6 | animTimer | HIGH |
| master | B | Deadeye Protocol | marksman_ult | 15005% | 155 | 97% | 60.0 | 81 | 2501 | 1/6 | animTimer | HIGH |
| master | B | War Machine | ballista_ult | 1495% | 11 | 136% | 60.0 | 88 | 249 | 1/6 | animTimer |  |
| master | B | Apex Bond | beastmaster_ult | 734% | 6 | 122% | 60.0 | 81 | 122 | 1/6 | animTimer | LOW |
| master | B | Eye of the Tempest | skyhunter_ult | 1812% | 14 | 129% | 60.0 | 81 | 302 | 3/6 | _skyMarkUntil animTimer |  |
| master | G | Deadeye | marksman_oneshot | 4789% | 81 | 59% | 40.0 | 63 | 1197 | 1/6 | animTimer | HIGH |
| master | G | Siege Volley | ballista_volley | 3951% | 106 | 37% | 25.0 | 56 | 1580 | 5/6 | animTimer knockback stunTimer | HIGH |
| master | G | Call of the Wild | beastmaster_pack | 1582% | 35 | 45% | 120.0 | 75 | 132 | 2/6 | animTimer |  |
| master | G | Gale Storm | skyhunter_gale | 1956% | 13 | 150% | 25.0 | 56 | 782 | 5/6 | animTimer |  |

