# Monster damage audit — Lv 20+ (touch vs skill/projectile), 2026-07-27

Source: `mojiworld_game.html` @ main (v0.29.256). All values are RAW (pre-mitigation).
Player mitigation applied afterwards: flat DEF subtraction (touch −DEF×0.5, projectile −DEF×0.4),
then `_defAbsorbMul` % curve (cap 90% at ~4500 DEF), block ×0.3, class DR (warrior 0.90→0.60), aegis, mana shield.

## Damage formulas (single source of truth)

| Path | Formula | Notes |
|---|---|---|
| Normal-mob touch | `atk × 0.28 × lvGap` | L58320. lvGap = 1 + 0.06/level over player, cap ×4 |
| Normal-mob projectile | `atk × 1.2 × lvGap` | L56351 mspawnProjectile — deliberately ~3.4× touch |
| bigMelee heavy swing/smash | `atk × dmgMul` (1.3–3.0) | L57075. Full atk, telegraphed |
| columnStrike | `atk × dmgMul` (1.25–3.0) | telegraphed vertical column |
| Monster skills | `atk × 0.30–0.95` per skill | MONSTER_SKILL_FNS |
| Boss touch | `atk × 1.0` (overrides below) × lvGap | boss lvGap = 1 + 0.22/level, cap ×60 |
| Boss hit band clamp | final HP loss clamped to % of player maxHP | L31779 — see bands below |

Boss touch overrides: Gloopaloo ×1.8, KingKrook ×2.0, Gravitos ×10, Octobaby legs ×1.4, Tower Arbiter ×0.25 (flat).

**Boss bands (the real balance governor):** every boss hit's FINAL HP loss is clamped:
- Story boss: touch 8–45%, heavy 15–65%, ranged 6–40% of player maxHP.
- Super/hyper/zodiac: touch 12–60%, heavy 20–80%, ranged 10–55%.
- Gravitos: phase-scaled, floor 25/30/35%, cap 70/90/99% (P1/P2/P3).
- Hard ceiling 99.9% maxHP — a banded hit never strictly one-shots. Only telegraphed
  set-piece OHKOs (Gravitos Singularity, Sovereign collapse) kill outright.
- Normal mobs and miniElites are NOT banded — only DEF/HP mitigate them.

Zodiac heavy-hit procs (contact): default 20% chance for ≥50% maxHP; Cancer/Capricorn 30%/55%,
Leo 35%/60%, Aquarius 35%/60%, Pisces 40%/70%.

## Player maxHP reference (base, no gear)

| Lv | Warrior | Archer | Rogue | Mage |
|---|---|---|---|---|
| 20 | ~886 | ~557 | ~485 | ~376 |
| 40 | ~1615 | ~1032 | ~869 | ~690 |
| 60 | ~2343 | ~1497 | ~1253 | ~1004 |
| 80 | ~3071 | ~1961 | ~1637 | ~1317 |

## Bosses Lv 20+ (raw numbers; band cap shown as governor)

| Boss | Lv | atk | Touch (raw) | Skill/ranged (raw) | Band caps t/h/r |
|---|---|---|---|---|---|
| Mirror Self | 20 | 110 | 110 | mdark ~132 @1.0s | 45/65/40% |
| Master Conductor (PQ) | 30 | 240 | 240 | swing ×2.6=624, dash ×2.0, mdark @0.85s | 45/65/40% |
| Vigil Vermillion | 47 | 324 | 324 | mbloodbolt volley ×0.8=259/arrow | 45/65/40% |
| Young Confused Barnaby | 47 | 312 | 312 | mquery @1.3s | 45/65/40% |
| Sundered Smith | 48 | 305 | 305 | swing ×2.0=610, mforgespark @1.5s | 45/65/40% |
| King Krook | 50 | 300 | ×2.0=600 | claw/jump-slam patterns | 45/65/40% |
| Octobaby (super) | 50 | 360 | legs ×1.4=504 | leg shot ×0.7=252 +stun/poison | 60/80/55% |
| Aetherion (super) | 65 | 640 | 640 | shards ×0.6–0.78=384–499, beam ×1.4=896 | 60/80/55% |
| Legosaurus | 69 | 425 | 425 | swing ×2.2=935, column ×1.8=765, mfirespit | 45/65/40% |
| Zodiac ×12 | 70–90 | ~1149–1309 | banded | swing ×1.3 / column ×1.25; heavy procs 50–70% maxHP | 60/80/55% |
| Tower Arbiter | 20 gate | 340 | ×0.25=85 | swing ×2.2–2.8=748–952, column ×2.0=680 | 45/65/40% |
| Tower Sovereign | 20 gate | 760 | 760 | swing ×2.8=2128, column ×3.0=2280, dash ×2.2 + OHKO collapse | 45/65/40% |
| Gravitos (hyper) | 100 | 1440 | ×10=14400 | comet ×1.5=2160, meteor ×3.5–4.2=5040–6048, beam ×1.6=2304 | 25–99% phase bands |

## Tower mobs (all Lv 20, expedition gate — NORMAL, not banded)

| Mob | atk | Touch | Projectile/skill |
|---|---|---|---|
| Spireling | 120 | 34 | dash ×1.4=168 |
| Hall Warden | 180 | 50 | swing ×2.0=360 |
| Tomb Hexer | 160 | 45 | mhexbolt 192 @1.5s, column ×1.5=240 |
| Mirror Stalker | 200 | 56 | dash ×1.7=340 |
| Aether Seer | 200 | 56 | mlantern 240 @1.7s +MP drain |
| Shardling | 185 | 52 | micicle 222 @1.9s (+50% enraged) |
| Ossifer | 210 | 59 | mossbaton 252 @1.7s, echo ×2 |
| Stormcaller | 230 | 64 | mstormorb 276 @1.4s, dash ×1.5=345 |

## Normal mobs Lv 20+ (touch = atk×0.28, proj = atk×1.2, heavy = atk×dmgMul; raw, at-level)

| Mob | Lv | atk | Touch | Projectile / skill |
|---|---|---|---|---|
| frog / skywisp / honeyBuzz / blockPopo | 20 | 36/35/55/56 | 10–16 | mtoxic 43; gravityWell 11; mstinger 66; — |
| nougatBear / stoneling | 21 | 68/52 | 19/15 | —; mstone 62 + summons minis |
| frostkin | 22 | 48 | 13 | micicle 58; freezeBeam 34 |
| coralImp | 23 | 44 | 12 | mbubble 53; homing 37 |
| voltipup / sandhusk / blockHupo / emberling | 25 | 60/59/79/76 | 17–22 | zap 72 (strike 57); mdark 71 (shockwave 38); —; spark 91 (rapid 30×4) |
| horny / orange | 26 | 61/45 | 17/13 | mhornshot 73; morange 54 (fan 20×5) |
| mummy | 27 | 56 | 16 | mwrap 67; groundStun 48 |
| axolotl / pearlSprite | 28 | 54/34 | 15/10 | — |
| stormKitty | 29 | 73 | 20 | — |
| mayo / blockEle | 30 | 62/102 | 17/29 | mbubble 74; — |
| ticketMech / expressTicketMech | 31 | 29 | 8 | mticket 35 |
| tidepoolTurtle / stump | 32 | 62/56 | 17/16 | mbubble 74; mbark 67 (mortar 39) |
| skeleton / sparkSprite / clownfish | 33 | 87/88/97 | 24–27 | mbonechip 104 + dash; mvoltzap 106; — |
| thunderMole | 34 | 90 | 25 | — |
| blockRhirhi / fatDragon | 35 | 128/112 | 36/31 | —; mfirespit 134 + swing ×1.5=168 |
| conductorMech | 36 | 46 | 13 | mticket 55 |
| pufferfish / jellyfish / seahorse | 37 | 103/103/94 | 26–29 | mspine 124; mdark 124; — |
| blockGary / seasponge | 40 | 150/98 | 42/27 | — |
| seastar | 41 | 104 | 29 | — |
| grumpsquid / deranged_kuro / drownedCur | 42 | 112/162/116 | 31–45 | mbubble 134; swing ×1.6=259; pack-call |
| anglerfish / goblinScout / bonebosn | 43 | 119/137/121 | 33–38 | mdark 143; —; — |
| wraith / spectreCannoneer | 44 | 77/136 | 22/38 | mdark 92 (homing 65); mghostshot 163 ×3 volley |
| boneGolem / brinekraken / future_lyra / blockTigreal | 45 | 211/164/193/171 | 46–59 | smash ×1.8=380; mink 197 + pull; mdark 232; — |
| zombie | 46 | 82 | 23 | mtoxic 98 (poisonCloud 25) |
| goblinMauler / nimbusFox / cosmicMochi / potato_uncle | 47 | 234/85/75/206 | 21–66 | swing ×1.6=374; mstarshot 102; homing 64; slam |
| cherub / willeo | 49 | 148/231 | 41/65 | — |
| tombWraith | 50 | 181 | 51 | mcoffinshard 217, column ×1.5=272 |
| thornmaw / seraph | 51 | 387/209 | 108/59 | swing ×1.5=581; mfeather 251 (homing 178) |
| young_bloodthirsty_vermillion | 52 | 277 | 78 | — (miniElite) |
| archon | 53 | 264 | 74 | mholybeam 317, column ×1.6=422, summons cherubs |
| graveReaver (miniElite) | 55 | 328 | 92 | mbonechip 394, swing ×2.0=656 |
| elderbark | 56 | 454 | 127 | smash ×1.5=681 |
| forgewight | 60 | 558 | 156 | mrivet 670, smash ×1.5=837, death-blast ×0.9≈502 |
| cinderling / meloncholy | 62 | 378/527 | 106/148 | death-blast; mseed 632 |
| pinechad | 63 | 550 | 154 | — |
| smithgolem (miniElite) | 65 | 451 | 126 | mforgespark 541, swing ×1.6=722 |
| bellowsbat | 66 | 405 | 113 | mfirespit 486 + divebomb + death-blast |
| razorgale | 67 | 508 | 142 | mgaleblade 610 (strafing flyer) |
| glasswindHare | 69 | 495 | 139 | — (dodges) |
| mirageStalker / blightElder (miniElite) | 71 | 551/698 | 154/195 | splits; mblightseed 838, swing/column ×1.3=907 |
| shardlich | 72 | 538 | 151 | mcryshard 646, swing ×1.6=861, groundSpikes |
| lichkin | 73 | 604 | 169 | — (revives) |
| sepulchreHound | 75 | 589 | 165 | — (pack) |
| mournshade | 76 | 685 | 192 | mlantern 822 (pulse 308) + MP drain |
| tombKeeper (miniElite) | 77 | 665 | 186 | msplinter 798, smash ×1.6=1064 ⚠ |
| echoKnight | 78 | 767 | 215 | swing ×1.5=1150, echoes ×2 @0.5s ⚠ |
| boneWraith | 79 | 610 | 171 | mdark 732 (phases out) |
| ossuaryTyrant (miniElite) | 79 | 822 | 230 | mgravebone 986, swing/column ×1.4=1151 |
| pathsBane (miniElite) | 80 | 850 | 238 | mtidemark 1020, swing ×1.4=1190, column |

## Findings

1. **Bosses are structurally safe.** Every boss hit funnels through the %-maxHP band clamp
   (v0.29.131) with a 99.9% ceiling — atk inflation cannot produce an un-telegraphed one-shot.
   Sovereign's raw ×2.8/×3.0 hits (2128/2280) always resolve to ≤65% maxHP.
2. **⚠ tombKeeper drift:** v0.29.9 comment tuned the smash around atk 485 ("970 max hit → 776
   on-curve"), but atk is now 665 → smash 1064, above the value already judged over-curve.
   Verify the post-v0.29.9 atk buff was intentional or re-trim to ≈485.
3. **⚠ echoKnight double-hit:** 1150 ×2 within 0.5 s = 2300 raw — exceeds base maxHP of every
   at-level class except geared warrior. Not banded (normal mob). Both hits landing means death
   for cloth classes even at full HP.
4. **Tower gate pressure:** Lv-20 tower projectiles (192–276 raw) hit a base Lv-20 mage (376 HP)
   for 51–73% per hit; Warden swing 360 ≈ 96%. Fine if the tower assumes gear/higher level;
   brutal at the literal gate.
5. **Lv 76–80 elite band:** projectiles 732–1020 raw vs mage base 1250–1320 (55–77% per hit
   pre-DEF). Intended "projectiles ≫ touch" design, but the margin for cloth classes is thin;
   these five mobs are the effective difficulty ceiling outside bosses.
6. Everything Lv 20–55 sits comfortably: touch 2–7% and projectiles 8–45% of the squishiest
   at-level class's HP — matches the "touch chips, projectiles punish" design intent.

