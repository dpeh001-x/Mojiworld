# Skill tabulation — v0.30.784 (measured)

Every skill cast once at a pinned dummy (ATK 1000, level 90, evasion 0, crits off, RNG pinned); damage is the dummy's HP loss over 10 s as a % of that class's basic hit. "Mobs" = distinct monsters hit out of a 6-mob cluster. Statuses are the dummy fields the cast set. Flags compare a row with the median of its own tier in its class: HIGH > 2×, LOW < 0.5×.

## warrior — basic slash = 1579 per hit

| tier | key | skill | id | dmg %basic | lines | per line | cd s | mp | %basic per 10 s cd | mobs | statuses | flag |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| basic | C | Rush | rush | 489% | 2 | 245% | 1.8 | 15 | 2717 | 0/6 | _proxRestUntil animTimer |  |
| basic | D | War Cry | warCry | 337% | 1 | 337% | 18.0 | 23 | 187 | 2/6 | animTimer |  |
| basic | S | Ground Slam | groundSlam | 275% | 3 | 92% | 4.0 | 18 | 688 | 2/6 | animTimer knockback |  |
| basic | X | Somersault Smash | powerStrike | 544% | 2 | 272% | 4.5 | 13 | 1210 | 3/6 | animTimer knockback stunTimer |  |
| basic | Z | Slash | slash | 100% | 1 | 100% | 0.7 | 0 | 1429 | 1/6 | animTimer | LOW |
| job | F | Bloodlust | bloodlust | 0% | 0 | - | 45.0 | 28 | 0 | 0/6 | animTimer | utility |
| job | F | Guardian | guardian | 0% | 0 | - | 30.0 | 23 | 0 | 0/6 | animTimer | utility |
| job | V | Rampage | rampage | 732% | 8 | 91% | 10.0 | 56 | 732 | 2/6 | animTimer |  |
| job | V | Holy Shield | holyShield | 1087% | 3 | 362% | 25.0 | 56 | 435 | 3/6 | animTimer |  |
| master | B | War of Banners | warlord_ult | 1930% | 2 | 965% | 60.0 | 88 | 322 | 5/6 | animTimer knockback |  |
| master | B | Calamity Incarnate | doombringer_ult | 3773% | 8 | 472% | 50.0 | 90 | 755 | 5/6 | _doomStacks _doomUntil animTimer knockback |  |
| master | B | Bastion of Dawn | crusader_ult | 3679% | 3 | 1226% | 60.0 | 85 | 613 | 6/6 | animTimer |  |
| master | B | Skyfall Dominion | dragoon_ult | 5401% | 10 | 540% | 50.0 | 78 | 1080 | 6/6 | animTimer | HIGH |
| master | G | Warlord's Banner | warlord_warcry | 1136% | 3 | 379% | 25.0 | 63 | 454 | 3/6 | animTimer |  |
| master | G | Blade of Calamity | doombringer_apoc | 1760% | 11 | 160% | 18.0 | 75 | 978 | 5/6 | _doomStacks _doomUntil animTimer knockback |  |
| master | G | Divine Aegis | crusader_aegis | 1262% | 3 | 421% | 20.0 | 56 | 631 | 2/6 | animTimer |  |
| master | G | Sky Lance | dragoon_skylance | 1394% | 2 | 697% | 25.0 | 44 | 558 | 2/6 | animTimer knockback stunTimer |  |

## rogue — basic stab = 1023 per hit

| tier | key | skill | id | dmg %basic | lines | per line | cd s | mp | %basic per 10 s cd | mobs | statuses | flag |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| basic | C | Smoke Dash | smokeDash | 219% | 4 | 55% | 1.5 | 18 | 1458 | 2/6 | _proxRestUntil animTimer |  |
| basic | D | Flurry | flurry | 322% | 1 | 322% | 1.0 | 23 | 3218 | 3/6 | animTimer |  |
| basic | S | Shuriken | throwDagger | 370% | 5 | 74% | 1.3 | 8 | 2842 | 1/6 | animTimer knockback |  |
| basic | X | Backstab | backstab | 293% | 2 | 146% | 2.0 | 8 | 1464 | 1/6 | animTimer |  |
| basic | Z | Stab | stab | 100% | 1 | 100% | 0.3 | 0 | 3333 | 1/6 | animTimer | LOW |
| job | F | Shadow Strike | shadowStrike | 655% | 5 | 131% | 7.0 | 28 | 936 | 5/6 | _proxRestUntil animTimer |  |
| job | F | Shin-Shuriken | smokeBomb | 625% | 12 | 52% | 6.0 | 31 | 1042 | 2/6 | animTimer knockback |  |
| job | V | Death Blossom | deathBlossom | 767% | 3 | 256% | 10.0 | 63 | 767 | 5/6 | _proxRestUntil animTimer |  |
| job | V | Voidrift Blink | sleight | 614% | 1 | 614% | 12.0 | 31 | 511 | 4/6 | animTimer |  |
| master | B | Shadow Sovereign | shadowlord_ult | 0% | 0 | - | 60.0 | 94 | 0 | 0/6 | animTimer | utility |
| master | B | Hundred-Hand Shadow Dance | shinobi_ult | 2341% | 5 | 468% | 40.0 | 75 | 585 | 2/6 | animTimer knockback |  |
| master | B | Bloodmoon Domain | nightreaper_ult | 2574% | 16 | 161% | 40.0 | 78 | 644 | 6/6 | animTimer knockback |  |
| master | B | Voidwalk | phantom_ult | 1545% | 3 | 515% | 45.0 | 78 | 343 | 6/6 | animTimer |  |
| master | G | Mirror Shadow | shadowlord_clones | 0% | 0 | - | 20.0 | 63 | 0 | 6/6 | animTimer knockback | utility |
| master | G | Kage Rush | shinobi_seal | 585% | 1 | 585% | 15.0 | 23 | 390 | 4/6 | animTimer knockback | LOW |
| master | G | Eclipse Massacre | nightreaper_mark | 1631% | 11 | 148% | 25.0 | 69 | 653 | 6/6 | animTimer knockback stunTimer |  |
| master | G | Voidrift Execution | phantom_cut | 4812% | 7 | 687% | 20.0 | 69 | 2406 | 6/6 | _proxRestUntil _voidBrand animTimer knockback | HIGH |

## mage — basic magicBolt = 1181 per hit

| tier | key | skill | id | dmg %basic | lines | per line | cd s | mp | %basic per 10 s cd | mobs | statuses | flag |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| basic | C | Dimensional Warp | blink | 231% | 1 | 231% | 2.4 | 19 | 964 | 2/6 | _proxRestUntil animTimer |  |
| basic | D | Arcane Burst | arcaneBurst | 331% | 1 | 331% | 8.0 | 31 | 414 | 3/6 | animTimer |  |
| basic | S | Ice Spike | iceSpike | 324% | 3 | 108% | 3.0 | 19 | 1079 | 2/6 | animTimer knockback |  |
| basic | X | Fireball | fireball | 250% | 1 | 250% | 2.3 | 13 | 1088 | 2/6 | animTimer |  |
| basic | Z | Magic Bolt | magicBolt | 100% | 1 | 100% | 0.8 | 0 | 1333 | 1/6 | animTimer | LOW |
| job | F | Meteor | meteor | 503% | 1 | 503% | 8.0 | 44 | 628 | 2/6 | animTimer |  |
| job | F | Soul Siphon | soulSiphon | 3124% | 33 | 95% | 20.0 | 15 | 1562 | 2/6 | animTimer | HIGH |
| job | F | Holy Light | holyLight | 248% | 1 | 248% | 10.0 | 60 | 248 | 3/6 | animTimer | LOW |
| job | V | Elemental Convergence | elemental | 402% | 1 | 402% | 13.0 | 69 | 309 | 1/6 | animTimer |  |
| job | V | Dark Pulse | darkPulse | 5052% | 75 | 67% | 30.0 | 69 | 1684 | 2/6 | animTimer | HIGH |
| job | V | Celestial Aurora | celestialAurora | 744% | 9 | 83% | 15.0 | 80 | 496 | 3/6 | animTimer |  |
| master | B | Meteor Sigil | sage_ult | 483% | 1 | 483% | 50.0 | 123 | 97 | 1/6 | animTimer | LOW |
| master | B | Elemental Apotheosis | elementalist_ult | 939% | 2 | 469% | 40.0 | 125 | 235 | 3/6 | animTimer freezeTimer |  |
| master | B | Necrotic Ascendance | necromancer_ult | 1426% | 12 | 119% | 60.0 | 115 | 238 | 4/6 | animTimer |  |
| master | B | Pandemic Hex | hexmaster_ult | 2366% | 13 | 182% | 50.0 | 106 | 473 | 5/6 | _burnStack _burnTickAcc _dotKind _hexStacks _hexUntil animTimer burnDmg burnTimer freezeTimer knockback |  |
| master | B | Apotheosis | archbishop_ult | 4098% | 6 | 683% | 65.0 | 125 | 630 | 6/6 | animTimer knockback | HIGH |
| master | G | Judgment of the Holy Grail | archbishop_grail | 3768% | 7 | 538% | 30.0 | 75 | 1256 | 5/6 | animTimer | HIGH |
| master | G | Pyre Columns | sage_meteorshower | 1243% | 3 | 414% | 17.0 | 69 | 731 | 4/6 | animTimer knockback |  |
| master | G | Prismatic Cascade | elementalist_cascade | 1471% | 4 | 368% | 15.0 | 63 | 980 | 4/6 | _burnStack _burnTickAcc _dotKind animTimer burnDmg burnTimer freezeTimer knockback stunTimer |  |
| master | G | Soul Vortex | necromancer_harvest | 892% | 18 | 50% | 40.0 | 50 | 223 | 3/6 | animTimer |  |
| master | G | Grand Hex | hexmaster_grandhex | 2266% | 12 | 189% | 25.0 | 44 | 906 | 5/6 | _burnStack _burnTickAcc _dotKind _hexRuptureAt _hexStacks _hexUntil animTimer burnDmg burnTimer freezeTimer |  |

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
| job | V | Arrow Rain | arrowRain | 0% | 0 | - | 10.0 | 53 | 0 | 1/6 | animTimer knockback | utility |
| job | V | Elemental Arrows | elementalArrows | 1658% | 10 | 166% | 14.0 | 50 | 1184 | 3/6 | animTimer | HIGH |
| master | B | Deadeye Protocol | marksman_ult | 6143% | 156 | 39% | 60.0 | 81 | 1024 | 1/6 | animTimer | HIGH |
| master | B | War Machine | ballista_ult | 1515% | 10 | 151% | 60.0 | 88 | 252 | 1/6 | animTimer |  |
| master | B | Apex Bond | beastmaster_ult | 957% | 7 | 137% | 60.0 | 81 | 159 | 1/6 | animTimer | LOW |
| master | B | Eye of the Tempest | skyhunter_ult | 1814% | 14 | 130% | 60.0 | 81 | 302 | 3/6 | _skyMarkUntil animTimer |  |
| master | G | Deadeye | marksman_oneshot | 4789% | 81 | 59% | 40.0 | 63 | 1197 | 1/6 | animTimer | HIGH |
| master | G | Siege Volley | ballista_volley | 4725% | 106 | 45% | 25.0 | 56 | 1890 | 5/6 | animTimer knockback stunTimer | HIGH |
| master | G | Call of the Wild | beastmaster_pack | 1582% | 35 | 45% | 120.0 | 75 | 132 | 2/6 | animTimer |  |
| master | G | Gale Storm | skyhunter_gale | 2149% | 13 | 165% | 25.0 | 56 | 860 | 5/6 | animTimer |  |

