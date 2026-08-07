# Custom Monster Sounds — Guide

This folder holds the **hit** and **death** sound effects for monsters.
Drop `.mp3` files here and the game picks them up automatically — **no code edit needed**.

There are two layers, checked in this order:

1. **Per-monster (custom)** — `mob_<type>_<kind>.mp3`  ← *what you want for "each monster"*
2. **Per-family (fallback)** — `mob_<family>_<kind>.mp3`  ← already shipped

`<kind>` is either **`die`** (death) or **`hit`** (taking a hit).

---

## 1. Per-monster custom sounds (the goal)

To give **one specific monster** its own death sound, drop a file named after its
**type id** (the internal key, listed below):

```
audio/monster/mob_<type>_die.mp3      ← custom death sound
audio/monster/mob_<type>_hit.mp3      ← custom hit sound (optional)
```

Examples:
```
audio/monster/mob_blockGary_die.mp3       → Gary's death sound
audio/monster/mob_king_die.mp3            → King Gloopaloo's death sound
audio/monster/mob_jellyfish_die.mp3       → Jellyfish death sound
```

**How it behaves at runtime** (engine: `_playMonsterSfx`, v0.26.425):
- The first time that monster dies, the game starts loading your custom file and
  plays the *family* clip for that one kill.
- Once your file has decoded, **every** later kill of that monster plays YOUR file.
- If the file isn't present (404), the game silently keeps using the family clip.

So the workflow is just: **make the mp3 → name it `mob_<type>_die.mp3` → drop it here → reload the game.** Done.

> Tip: keep clips short (~0.3–1.0 s) and not too loud — they play at ~45% volume,
> scaled by the in-game SFX master volume.

---

## 2. Per-family fallback (already shipped)

Any monster with no custom file uses its **family** clip. Families & current files:

| Family | File (die / hit) | Covers (examples) |
|---|---|---|
| slime | `mob_slime_die.mp3` / `_hit` | slime, gummy, gloop, fish-family squish |
| ghost | `mob_ghost_die.mp3` / `_hit` | wraith, spectre, wisp, lich, fairy-family |
| bat | `mob_bat_die.mp3` / `_hit` | bats, moths, gales, insect-family |
| skeleton | `mob_skeleton_die.mp3` / `_hit` | skeletons, crypt mobs, mechanical, golem |
| dragon | `mob_dragon_die.mp3` / `_hit` | dragons, drakes, saurians, lizards |
| beast | `mob_beast_die.mp3` / `_hit` | everything else (default) |

Replacing a family file changes the sound for **all** monsters in that family at once —
handy if you want a whole group to share a sound instead of doing them one by one.

---

## 3. Full monster type-id list

Use these exact ids in the filename (`mob_<id>_die.mp3`):

**Beginner / forest:** snail, slime, mushroom, horny, orange, stump, frog, axolotl, gummy, cookie, mushpup, petalfly, sproutle, cloudbun

**Undead / crypt:** zombie, mummy, skeleton, wraith, boneWraith, tombWraith, tombKeeper, sepulchreHound, graveReaver, lichkin, shardlich, mournshade, lanternWisp, echoKnight, pathsBane, boneGolem, bonebosn, drownedCur, spectreCannoneer

**Critters / elemental:** scorpion, honeyBuzz, nougatBear, voltipup, frostkin, emberling, skywisp, sandhusk, stoneling, sparkling, sparkSprite, thunderMole, stormKitty, glasswindHare, mirageStalker, cinderling, bellowsbat, razorgale, forgewight, smithgolem

**Sea:** coralImp, pearlSprite, tideling, tidefish, clownfish, pufferfish, jellyfish, anglerfish, seahorse, seasponge, seastar, grumpsquid, tidepoolTurtle, brinekraken

**Celestial / cosmic:** cherub, seraph, archon, nimbusFox, cosmicMochi

**Block-land:** blockPopo, blockHupo, blockEle, blockRhirhi, blockGary, blockTigreal, blockRexy

**Mechanical (Ticket Rush):** ticketMech, conductorMech, expressTicketMech

**Octopus boss legs:** octoLegPoison, octoLegFreeze, octoLegSkillLock, octoLegStun

**Bosses / named:** king, mushmom, aetherion, gravitos, octobaby, koopaKing, mirrorSelf, fatLizard, fatDragon, sundered_smith, goblinScout, goblinMauler, mayo

**Story / inner-dimension:** deranged_kuro, future_lyra, potato_uncle, willeo, young_bloodthirsty_vermillion, vigil_vermillion, young_confused_barnaby

**Tower of the Spire (endless tower):** towerWisp, towerWarden, towerHexer, towerStalker, towerArbiter, towerSeer, towerShardling, towerOssifer, towerStormcaller, towerSovereign

> Note: most **boss** monsters have their own dedicated intro/outro audio and skip
> the generic death clip, so a `mob_<boss>_die.mp3` may not play for them. Normal
> mobs are where custom death sounds shine.
