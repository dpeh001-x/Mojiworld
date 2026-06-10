# Mojiworld — Audio Generation Prompt Catalog

Generated for use with **Ludo.ai Audio Generator** (Sound Effects mode).
Tested workflow: paste prompt → click **Generate Sound Effects** (2 credits) → wait ~2-3 min → click **more actions** → **Download**.

**Budget summary:** 72 generations × 2 credits = **144 credits** (out of 486 on account).

All prompts deliberately include `no music, no human voice, seamless loop` (or `single one-shot` for non-loops) to keep the output clean and game-ready. The model behaves better when you tell it what NOT to make.

---

## 1 — Ambient biome loops (12 files, target ~10s each)

Drop into `audio/ambient/`. These cross-fade on map transitions via `_setMapAmbient()`.

| File | Prompt |
|---|---|
| `forest.mp3` | Peaceful forest ambient loop: gentle birdsong chirps, soft rustling leaves in light breeze, distant wind through trees, calm woodland atmosphere, no music, no human voice, seamless loop |
| `water.mp3` | Calm ocean shore ambient loop: gentle waves lapping at sand, soft water rolling onto shore, distant seabirds faint, peaceful coastal atmosphere, no music, no human voice, seamless loop |
| `abyss.mp3` | Deep underwater abyss ambient loop: submerged bubble pops, low pressure groan, eerie deep-ocean drone, oppressive depth atmosphere, no music, no human voice, seamless loop |
| `lava.mp3` | Volcanic lava ambient loop: thick bubbling magma, crackling embers, low fiery rumble, occasional steam hiss, hellish forge atmosphere, no music, no human voice, seamless loop |
| `glasswind.mp3` | Howling high-altitude wind ambient loop: hollow whistling wind, faint distant wind chimes, sparse glass tinkles, vast empty plateau atmosphere, no music, no human voice, seamless loop |
| `cave.mp3` | Stone cave ambient loop: slow water drips with echo, low cavern reverb, distant subterranean creaks, damp underground atmosphere, no music, no human voice, seamless loop |
| `desert.mp3` | Desert ambient loop: dry hot wind across sand, faint sand particle whisper, distant heat shimmer, vast arid emptiness, no music, no human voice, seamless loop |
| `cosmic.mp3` | Cosmic deep-space ambient loop: distant ethereal hum, faint twinkling sparkles, mysterious astral drone, weightless void atmosphere, no music, no human voice, seamless loop |
| `town.mp3` | Medieval town marketplace ambient loop: gentle distant villager murmur, soft footsteps on cobblestone, faint cart wheel, peaceful settlement atmosphere, no music, no spoken words, seamless loop |
| `snow.mp3` | Snowy mountain ambient loop: soft whistling wind through pines, faint creaking snow underfoot, distant ice settle, frigid stillness atmosphere, no music, no human voice, seamless loop |
| `temple.mp3` | Sacred temple ambient loop: distant ceremonial bells, soft sacred breath of wind, faint hallowed reverb, reverent shrine atmosphere, no music, no chanting, seamless loop |
| `void.mp3` | Cosmic void ambient loop: deep sub-bass dimensional drone, faint otherworldly hum, oppressive empty resonance, dread atmosphere, no music, no human voice, seamless loop |

---

## 2 — Class voice grunts (30 files — both M and F per class for in-game gender selection)

Drop into `audio/voice/`. The game's `_classKey()` resolver collapses sub-jobs onto base classes. Each clip should be **1-2 second single vocalization**, chibi anime style.

> **NOTE:** Code already references `<class>_hit1.mp3` / `_hit2.mp3` / `_death.mp3`. To support gender selection, suggest extending the registry to `<class>_<gender>_hit1.mp3` (a 5-line change). I can do that change when the files land.

### Warrior — brave, loud, heavy

| File | Prompt |
|---|---|
| `warrior_m_hit1.mp3` | Single short chibi anime male warrior pain grunt on impact, brief deep "ugh" with effort, dry close mic, no music, no reverb, one-shot |
| `warrior_m_hit2.mp3` | Single short chibi anime male warrior pain shout on impact, brief barked "argh", dry close mic, no music, no reverb, one-shot |
| `warrior_m_death.mp3` | Chibi anime male warrior death cry, heavy falling "aaagh" fading to a soft thud, dramatic but short, no music, one-shot |
| `warrior_f_hit1.mp3` | Single short chibi anime female warrior pain grunt on impact, brief firm "uh", dry close mic, no music, no reverb, one-shot |
| `warrior_f_hit2.mp3` | Single short chibi anime female warrior pain shout on impact, brief sharp "hng", dry close mic, no music, no reverb, one-shot |
| `warrior_f_death.mp3` | Chibi anime female warrior death cry, brief falling "aaah" fading to a soft thud, dramatic but short, no music, one-shot |

### Mage — refined, mystical, slightly higher register

| File | Prompt |
|---|---|
| `mage_m_hit1.mp3` | Single short chibi anime male mage pained gasp on impact, surprised "ah!", soft close mic, no music, no reverb, one-shot |
| `mage_m_hit2.mp3` | Single short chibi anime male mage pained yelp on impact, brief "ugh", soft close mic, no music, no reverb, one-shot |
| `mage_m_death.mp3` | Chibi anime male mage death cry, soft fading "aaah" with magical shimmer trailing off, no music, one-shot |
| `mage_f_hit1.mp3` | Single short chibi anime female mage pained gasp on impact, light "ah!", soft close mic, no music, no reverb, one-shot |
| `mage_f_hit2.mp3` | Single short chibi anime female mage pained yelp on impact, brief "ngh", soft close mic, no music, no reverb, one-shot |
| `mage_f_death.mp3` | Chibi anime female mage death cry, soft fading "aaah" with magical shimmer trailing off, no music, one-shot |

### Thief — quick, smug, light

| File | Prompt |
|---|---|
| `thief_m_hit1.mp3` | Single short chibi anime male thief pained grunt on impact, quick "tch!" through teeth, dry close mic, no music, one-shot |
| `thief_m_hit2.mp3` | Single short chibi anime male thief pained hiss on impact, brief surprised "ah!", dry close mic, no music, one-shot |
| `thief_m_death.mp3` | Chibi anime male thief death gasp, brief defeated "ah... heh" fading out, no music, one-shot |
| `thief_f_hit1.mp3` | Single short chibi anime female thief pained grunt on impact, quick "tch!" through teeth, dry close mic, no music, one-shot |
| `thief_f_hit2.mp3` | Single short chibi anime female thief pained hiss on impact, brief surprised "ah!", dry close mic, no music, one-shot |
| `thief_f_death.mp3` | Chibi anime female thief death gasp, brief defeated "ah... heh" fading out, no music, one-shot |

### Bowman — focused, alert, mid register

| File | Prompt |
|---|---|
| `bowman_m_hit1.mp3` | Single short chibi anime male archer pained grunt on impact, focused "hng!", dry close mic, no music, one-shot |
| `bowman_m_hit2.mp3` | Single short chibi anime male archer pained yelp on impact, sharp "tch!", dry close mic, no music, one-shot |
| `bowman_m_death.mp3` | Chibi anime male archer death cry, soft falling "aaah" with a small exhale, no music, one-shot |
| `bowman_f_hit1.mp3` | Single short chibi anime female archer pained grunt on impact, focused "hng!", dry close mic, no music, one-shot |
| `bowman_f_hit2.mp3` | Single short chibi anime female archer pained yelp on impact, sharp "tch!", dry close mic, no music, one-shot |
| `bowman_f_death.mp3` | Chibi anime female archer death cry, soft falling "aaah" with a small exhale, no music, one-shot |

### Pirate — boisterous, loud, gruff

| File | Prompt |
|---|---|
| `pirate_m_hit1.mp3` | Single short chibi anime male pirate pained shout on impact, boisterous "yarr!" cut short, dry close mic, no music, one-shot |
| `pirate_m_hit2.mp3` | Single short chibi anime male pirate pained grunt on impact, gruff "ooch!", dry close mic, no music, one-shot |
| `pirate_m_death.mp3` | Chibi anime male pirate death roar, dramatic "yaaaargh" falling to a thud, no music, one-shot |
| `pirate_f_hit1.mp3` | Single short chibi anime female pirate pained shout on impact, fiery "hah!" cut short, dry close mic, no music, one-shot |
| `pirate_f_hit2.mp3` | Single short chibi anime female pirate pained grunt on impact, gruff "ooch!", dry close mic, no music, one-shot |
| `pirate_f_death.mp3` | Chibi anime female pirate death roar, dramatic "aaaargh" falling to a thud, no music, one-shot |

---

## 3 — Skill SFX (12 files, target 1-2s)

Drop into `audio/skill/`. Hooked into `castSkill()` via the `_SKILL_SFX_ALIAS` bucket map — one file covers a family of skills.

| File | Prompt |
|---|---|
| `strike.mp3` | Sharp sword strike impact, fast metallic blade slash with weight, single decisive hit with brief tail, retro RPG game SFX, no music, one-shot |
| `burst.mp3` | Bright magical energy burst explosion, sharp transient with shimmering shockwave tail, retro RPG game SFX, no music, one-shot |
| `dash.mp3` | Quick character dash whoosh, short rapid air rush with speed-line tail, retro RPG game SFX, no music, one-shot |
| `heal.mp3` | Magical healing chime, warm sparkle tinkle with gentle bell, restorative uplift, retro RPG game SFX, no music, one-shot |
| `buff.mp3` | Buff activation chime, warm rising magical tone swelling into a positive shimmer, empowering, retro RPG game SFX, no music, one-shot |
| `magic_claw.mp3` | Ethereal magical claw slash, three quick arcane swipes with shimmer tail, retro RPG game SFX, no music, one-shot |
| `arrow_rain.mp3` | Arrow volley impact, rapid whistling arrows piercing air then thudding into ground, retro RPG game SFX, no music, one-shot |
| `jump_attack.mp3` | Heavy jump attack ground impact, descending whoosh into deep thunk and dust crack, retro RPG game SFX, no music, one-shot |
| `triple_throw.mp3` | Three rapid throwing knife impacts, fast metallic blade hits in quick succession, retro RPG game SFX, no music, one-shot |
| `shroud.mp3` | Stealth shroud activation, soft mystical whoosh into fading shimmer, vanish effect, retro RPG game SFX, no music, one-shot |
| `rage.mp3` | Berserker rage activation, short angry guttural roar with rising power-up swell, retro RPG game SFX, no music, one-shot |
| `volley.mp3` | Multi-arrow volley release, layered bowstring twangs with whistling arrows trailing, retro RPG game SFX, no music, one-shot |

---

## 4 — Boss roars / intro stingers (6 files, 2-4s each)

Drop into `audio/boss/`. Plays alongside the cinematic boss intro overlay (already shipped in v0.25.794).

| File | Prompt |
|---|---|
| `boss_gloopaloo.mp3` | Slime king boss roar, deep gurgling wet bubble growl rising to a sovereign bellow, fantasy RPG boss intro, no music, one-shot |
| `boss_shroomaloo.mp3` | Mushroom queen boss roar, eerie wet fungal sporing breath rising to a haunting wail, fantasy RPG boss intro, no music, one-shot |
| `boss_octobaby.mp3` | Octopus boss roar, wet tentacle slap with shrill childlike shriek, eight-moods chaotic stinger, fantasy RPG boss intro, no music, one-shot |
| `boss_koopaloo.mp3` | Turtle king boss roar, heavy shell scrape into deep monarch bellow, spiked-throne menace, fantasy RPG boss intro, no music, one-shot |
| `boss_aetherion.mp3` | Celestial shardfather boss intro, crystalline shimmer rising into a vast cosmic chord and a low godlike growl, fantasy RPG boss intro, no music vocals, one-shot |
| `boss_gravitos.mp3` | Gravity god boss intro, deep gravitational hum collapsing into a vast titanic groan, weight-bearer menace, fantasy RPG final boss intro, no music vocals, one-shot |

---

## 5 — Monster hit / death SFX (12 files, ~0.5-1s each)

Drop into `audio/monster/`. Wire into existing `hitMonster()` and monster-death paths.

### Slime family

| File | Prompt |
|---|---|
| `mob_slime_hit.mp3` | Wet squishy slime hit, single quick splat with jiggle tail, cartoon RPG SFX, no music, one-shot |
| `mob_slime_die.mp3` | Slime death pop, soft wet bubble burst with goopy splat, cartoon RPG SFX, no music, one-shot |

### Ghost / spirit family

| File | Prompt |
|---|---|
| `mob_ghost_hit.mp3` | Ethereal ghost hit, brief shrill spectral wail with shimmer, cartoon RPG SFX, no music, one-shot |
| `mob_ghost_die.mp3` | Ghost dissolve death, fading ethereal wail with disappearing shimmer, cartoon RPG SFX, no music, one-shot |

### Bat / flying family

| File | Prompt |
|---|---|
| `mob_bat_hit.mp3` | Bat hit squeak, sharp high-pitched cartoon yelp with wing flap, cartoon RPG SFX, no music, one-shot |
| `mob_bat_die.mp3` | Bat death squeal, descending squeak with crumpling wing flap, cartoon RPG SFX, no music, one-shot |

### Skeleton / undead family

| File | Prompt |
|---|---|
| `mob_skeleton_hit.mp3` | Skeleton hit, sharp bone clack with hollow rattle, cartoon RPG SFX, no music, one-shot |
| `mob_skeleton_die.mp3` | Skeleton collapse death, cascading bone clatter into floor thud, cartoon RPG SFX, no music, one-shot |

### Dragon / large beast family

| File | Prompt |
|---|---|
| `mob_dragon_hit.mp3` | Dragon hit grunt, deep guttural reptilian growl cut short, cartoon RPG SFX, no music, one-shot |
| `mob_dragon_die.mp3` | Dragon death roar, descending deep bellow fading to wet exhale, cartoon RPG SFX, no music, one-shot |

### Generic beast / feral family

| File | Prompt |
|---|---|
| `mob_beast_hit.mp3` | Feral beast hit yelp, sharp animal whimper cut short, cartoon RPG SFX, no music, one-shot |
| `mob_beast_die.mp3` | Feral beast death whine, descending animal whimper fading, cartoon RPG SFX, no music, one-shot |

---

## How to run this batch

1. Open https://app.ludo.ai/audio-generator and confirm credit balance.
2. For each row above:
   - Paste the `Prompt` into the **Description** field
   - Click **Generate Sound Effects** (cost: 2 credits)
   - Wait ~2-3 min for render
   - Click the **more actions** (...) button on the card → **Download**
   - Rename the downloaded file to the `File` column value
3. Move downloaded files into the matching `audio/<folder>/` directory in this repo. The game's audio system is lazy-loading and missing-file-tolerant, so you can drop files in any order without breaking anything.

## Cost summary

| Category | Files | Credits |
|---|---|---|
| Ambient | 12 | 24 |
| Voice (M+F per class) | 30 | 60 |
| Skill SFX | 12 | 24 |
| Boss stingers | 6 | 12 |
| Monster SFX | 12 | 24 |
| **Total** | **72** | **144** |

Account balance at start of run: 486 credits. Post-batch: ~342 credits remaining.
