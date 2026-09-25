# Skill tabulation — v0.30.1050 (measured)

Every skill cast once at a pinned dummy (ATK 1000, level 90, evasion 0, crits off, RNG pinned); damage is the dummy's HP loss over 10 s as a % of that class's basic hit. "Mobs" = distinct monsters hit out of a 6-mob cluster. Statuses are the dummy fields the cast set. Flags compare a row with the median of its own tier in its class: HIGH > 2×, LOW < 0.5×.

## warrior — basic slash = 1579 per hit

| tier | key | skill | id | dmg %basic | lines | per line | cd s | mp | %basic per 10 s cd | mobs | statuses | flag |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| basic | C | Rush | rush | 489% | 2 | 245% | 1.8 | 15 | 2717 | 1/6 | _proxRestUntil animTimer |  |
| basic | D | War Cry | warCry | 337% | 1 | 337% | 18.0 | 23 | 187 | 2/6 | animTimer |  |
| basic | S | Ground Slam | groundSlam | 214% | 3 | 71% | 4.0 | 18 | 535 | 2/6 | animTimer knockback |  |
| basic | X | Somersault Smash | powerStrike | 300% | 2 | 150% | 4.5 | 13 | 666 | 3/6 | animTimer knockback stunTimer |  |
| basic | Z | Slash | slash | 100% | 1 | 100% | 0.7 | 0 | 1429 | 1/6 | animTimer | LOW |
| job | F | Bloodlust | bloodlust | 0% | 0 | - | 45.0 | 28 | 0 | 0/6 | animTimer | utility |
| job | F | Guardian | guardian | 0% | 0 | - | 30.0 | 23 | 0 | 0/6 | animTimer | utility |
| job | V | Rampage | rampage | 530% | 8 | 66% | 10.0 | 56 | 530 | 2/6 | animTimer | LOW |
| job | V | Holy Shield | holyShield | 1087% | 3 | 362% | 25.0 | 56 | 435 | 3/6 | animTimer |  |
| master | B | War of Banners | warlord_ult | 4009% | 40 | 100% | 60.0 | 88 | 668 | 5/6 | animTimer |  |
| master | B | Calamity Incarnate | doombringer_ult | 3028% | 8 | 378% | 50.0 | 90 | 606 | 5/6 | _doomStacks _doomUntil animTimer |  |
| master | B | Bastion of Dawn | crusader_ult | 2509% | 3 | 836% | 60.0 | 85 | 418 | 6/6 | animTimer knockback |  |
| master | B | Skyfall Dominion | dragoon_ult | 4650% | 10 | 465% | 50.0 | 78 | 930 | 6/6 | animTimer |  |
| master | G | Warlord's Banner | warlord_warcry | 1107% | 3 | 369% | 25.0 | 63 | 443 | 3/6 | animTimer | LOW |
| master | G | Blade of Calamity | doombringer_apoc | 1206% | 11 | 110% | 18.0 | 75 | 670 | 5/6 | _doomStacks _doomUntil animTimer knockback | LOW |
| master | G | Divine Aegis | crusader_aegis | 535% | 3 | 178% | 20.0 | 56 | 267 | 2/6 | animTimer | LOW |
| master | G | Sky Lance | dragoon_skylance | 1784% | 2 | 892% | 25.0 | 44 | 714 | 2/6 | animTimer knockback stunTimer |  |

## rogue — basic stab = 1023 per hit

| tier | key | skill | id | dmg %basic | lines | per line | cd s | mp | %basic per 10 s cd | mobs | statuses | flag |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| basic | C | Smoke Dash | smokeDash | 219% | 4 | 55% | 1.5 | 18 | 1458 | 2/6 | _proxRestUntil animTimer |  |
| basic | D | Flurry | flurry | 263% | 1 | 263% | 1.0 | 23 | 2633 | 3/6 | animTimer |  |
| basic | S | Shuriken | throwDagger | 370% | 5 | 74% | 1.3 | 8 | 2842 | 1/6 | animTimer knockback |  |
| basic | X | Backstab | backstab | 293% | 2 | 146% | 2.0 | 8 | 1464 | 1/6 | animTimer |  |
| basic | Z | Stab | stab | 100% | 1 | 100% | 0.3 | 0 | 3333 | 1/6 | animTimer | LOW |
| job | F | Shadow Strike | shadowStrike | 950% | 5 | 190% | 7.0 | 28 | 1357 | 5/6 | _proxRestUntil animTimer |  |
| job | F | Shin-Shuriken | smokeBomb | 677% | 12 | 56% | 6.0 | 31 | 1128 | 2/6 | animTimer knockback |  |
| job | V | Death Blossom | deathBlossom | 767% | 3 | 256% | 10.0 | 63 | 767 | 5/6 | _proxRestUntil animTimer |  |
| job | V | Voidrift Blink | sleight | 1512% | 3 | 504% | 12.0 | 31 | 1260 | 4/6 | animTimer |  |
| master | B | Shadow Sovereign | shadowlord_ult | 0% | 0 | - | 60.0 | 94 | 0 | 0/6 | animTimer | utility |
| master | B | Hundred-Hand Shadow Dance | shinobi_ult | 2341% | 5 | 468% | 40.0 | 75 | 585 | 2/6 | animTimer knockback |  |
| master | B | Bloodmoon Domain | nightreaper_ult | 2556% | 16 | 160% | 40.0 | 78 | 639 | 6/6 | animTimer knockback |  |
| master | B | Voidwalk | phantom_ult | 2059% | 4 | 515% | 45.0 | 78 | 458 | 6/6 | animTimer |  |
| master | G | Mirror Shadow | shadowlord_clones | 0% | 0 | - | 20.0 | 63 | 0 | 6/6 | animTimer knockback | utility |
| master | G | Kage Rush | shinobi_seal | 2338% | 4 | 585% | 15.0 | 23 | 1559 | 4/6 | animTimer |  |
| master | G | Eclipse Massacre | nightreaper_mark | 1485% | 11 | 135% | 25.0 | 69 | 594 | 6/6 | animTimer knockback stunTimer |  |
| master | G | Voidrift Execution | phantom_cut | 4794% | 7 | 685% | 25.0 | 69 | 1917 | 6/6 | _proxRestUntil _voidBrand animTimer knockback | HIGH |

## mage — basic magicBolt = 1084 per hit

| tier | key | skill | id | dmg %basic | lines | per line | cd s | mp | %basic per 10 s cd | mobs | statuses | flag |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| basic | C | Dimensional Warp | blink | 189% | 1 | 189% | 2.4 | 19 | 788 | 2/6 | _proxRestUntil animTimer |  |
| basic | D | Arcane Burst | arcaneBurst | 271% | 1 | 271% | 8.0 | 31 | 338 | 3/6 | animTimer |  |
| basic | S | Ice Spike | iceSpike | 299% | 3 | 100% | 3.0 | 19 | 995 | 2/6 | animTimer knockback |  |
| basic | X | Fireball | fireball | 232% | 1 | 232% | 2.3 | 13 | 1011 | 2/6 | animTimer |  |
| basic | Z | Magic Bolt | magicBolt | 100% | 1 | 100% | 0.8 | 0 | 1333 | 1/6 | animTimer | LOW |
| job | F | Meteor | meteor | 697% | 1 | 697% | 8.0 | 44 | 871 | 2/6 | animTimer knockback |  |
| job | F | Soul Siphon | soulSiphon | 2865% | 34 | 84% | 20.0 | 15 | 1432 | 2/6 | animTimer | HIGH |
| job | F | Holy Light | holyLight | 189% | 1 | 189% | 10.0 | 60 | 189 | 3/6 | animTimer | LOW |
| job | V | Elemental Convergence | elemental | 231% | 1 | 231% | 13.0 | 69 | 178 | 1/6 | animTimer | LOW |
| job | V | Dark Pulse | darkPulse | 3005% | 75 | 40% | 30.0 | 69 | 1002 | 2/6 | animTimer | HIGH |
| job | V | Celestial Aurora | celestialAurora | 810% | 9 | 90% | 15.0 | 80 | 540 | 3/6 | animTimer |  |
| master | B | Meteor Sigil | sage_ult | 3867% | 10 | 387% | 50.0 | 123 | 773 | 1/6 | animTimer | HIGH |
| master | B | Elemental Apotheosis | elementalist_ult | 2814% | 7 | 402% | 40.0 | 125 | 704 | 6/6 | animTimer freezeTimer |  |
| master | B | Necrotic Ascendance | necromancer_ult | 1256% | 12 | 105% | 60.0 | 115 | 209 | 4/6 | animTimer |  |
| master | B | Pandemic Hex | hexmaster_ult | 1795% | 13 | 138% | 50.0 | 106 | 359 | 5/6 | _burnStack _burnTickAcc _dotKind _hexStacks _hexUntil animTimer burnDmg burnTimer freezeTimer knockback |  |
| master | B | Apotheosis | archbishop_ult | 4440% | 6 | 740% | 65.0 | 125 | 683 | 6/6 | animTimer knockback | HIGH |
| master | G | Judgment of the Holy Grail | archbishop_grail | 2600% | 7 | 371% | 30.0 | 75 | 867 | 5/6 | animTimer |  |
| master | G | Pyre Columns | sage_meteorshower | 1355% | 3 | 452% | 17.0 | 69 | 797 | 4/6 | animTimer knockback |  |
| master | G | Prismatic Cascade | elementalist_cascade | 1298% | 4 | 325% | 15.0 | 63 | 866 | 4/6 | _burnStack _burnTickAcc _dotKind animTimer burnDmg burnTimer freezeTimer knockback stunTimer |  |
| master | G | Soul Vortex | necromancer_harvest | 810% | 15 | 54% | 40.0 | 50 | 202 | 3/6 | animTimer | LOW |
| master | G | Grand Hex | hexmaster_grandhex | 1489% | 12 | 124% | 25.0 | 44 | 595 | 6/6 | _burnStack _burnTickAcc _dotKind _hexRuptureAt _hexStacks _hexUntil animTimer burnDmg burnTimer freezeTimer knockback |  |

## archer — basic arrowShot = 1964 per hit

| tier | key | skill | id | dmg %basic | lines | per line | cd s | mp | %basic per 10 s cd | mobs | statuses | flag |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| basic | C | Evade Burst | evadeRoll | 186% | 2 | 93% | 8.0 | 10 | 233 | 1/6 | animTimer |  |
| basic | D | Eagle Eye | eagleEye | 0% | 0 | - | 60.0 | 20 | 0 | 0/6 | animTimer | utility |
| basic | S | Charged Shot | chargedShot | 172% | 1 | 172% | 4.0 | 18 | 429 | 3/6 | animTimer |  |
| basic | X | Multi Shot | multiShot | 266% | 3 | 89% | 2.6 | 13 | 1025 | 1/6 | animTimer knockback |  |
| basic | Z | Arrow Shot | arrowShot | 104% | 1 | 104% | 0.8 | 0 | 1299 | 1/6 | animTimer |  |
| job | F | Railshot | snipe_railgun | 474% | 1 | 474% | 12.0 | 35 | 395 | 5/6 | animTimer |  |
| job | F | Wild Bond | wildBond | 327% | 7 | 47% | 60.0 | 38 | 55 | 1/6 | animTimer | LOW |
| job | V | Arrow Rain | arrowRain | 932% | 7 | 133% | 10.0 | 53 | 932 | 3/6 | animTimer |  |
| job | V | Elemental Arrows | elementalArrows | 1508% | 10 | 151% | 14.0 | 50 | 1077 | 3/6 | animTimer knockback |  |
| master | B | Deadeye Protocol | marksman_ult | 10579% | 155 | 68% | 60.0 | 81 | 1763 | 1/6 | animTimer | HIGH |
| master | B | War Machine | ballista_ult | 1441% | 9 | 160% | 60.0 | 88 | 240 | 1/6 | animTimer |  |
| master | B | Apex Bond | beastmaster_ult | 1169% | 7 | 167% | 60.0 | 81 | 195 | 1/6 | animTimer |  |
| master | B | Eye of the Tempest | skyhunter_ult | 1045% | 12 | 87% | 60.0 | 81 | 174 | 3/6 | _skyMarkUntil animTimer |  |
| master | G | Deadeye | marksman_oneshot | 4491% | 81 | 55% | 40.0 | 63 | 1123 | 1/6 | animTimer | HIGH |
| master | G | Siege Volley | ballista_volley | 3750% | 94 | 40% | 25.0 | 56 | 1500 | 5/6 | animTimer knockback stunTimer |  |
| master | G | Call of the Wild | beastmaster_pack | 1264% | 40 | 32% | 120.0 | 75 | 105 | 2/6 | animTimer |  |
| master | G | Gale Storm | skyhunter_gale | 1947% | 13 | 150% | 25.0 | 56 | 779 | 5/6 | animTimer knockback |  |

