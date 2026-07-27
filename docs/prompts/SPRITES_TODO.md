# Sprites still to generate (snapshot v0.25.498)

> **v0.25.498 update:** 8 sprites previously listed here have shipped — `fatLizard`, `fatDragon`, `octoLegPoison/Freeze/SkillLock/Stun` (monsters), `octobaby` + `koopaKing` (bosses). Loader now accepts `.webp` OR `.png` so the dropped `.png` files load directly without re-encoding. Boss attack-pose sprites for `octobaby` + `koopaKing` are still pending (the renderer falls back to the neutral pose during attack windows until they land).



What's registered in the code but **doesn't have a `.webp` on disk yet**. Drop each generated file at the listed path — loaders auto-swap from procedural to painted on next reload, no code changes.

Generation settings (Ludo.ai → Image Generator):
- Aspect: **1:1 square** for monsters/bosses; bake at 768×768 or higher.
- Background: **transparent**. Run through `remove.bg` if Ludo bakes a flat backdrop.
- Format: PNG → re-export `.webp` quality 90+. Filename **must match exactly** (the loader is case-sensitive).
- Outline: **2 px black** matching the existing fauna pass.

---

## 🟦 Monster sprites — 1 missing (was 7; v0.25.498 shipped 6)

**Master style line — prepend verbatim to every prompt below:**

> 2D MMORPG cute-but-cool monster sprite, full body shot, dynamic confident idle pose with a hint of attitude, transparent background, cel-shaded illustrative style, clean thick 2 pixel black outline on every shape, painterly rendering with crisp rim-light highlights and a saturated accent-colour glow, chibi proportions with oversized head and big expressive eyes that read clearly at 64×64, eye-catching silhouette readable from across the screen, no text, no watermark, no UI elements.

### `Sprites/monsters/seahorse.webp` — Hippocampus
> A tall standing cartoon seahorse with the classic curled S-shape body, head turned three-quarter toward the viewer with a smug half-grin. Mint-teal body with darker teal segmented ridges along the back catching a sharp pearlescent rim-light. Long curled snout, fluttering side fin frozen mid-flicker, prehensile tail curled into a tight spiral. Big curious eye with a bright gold reflection. Soft mint + seafoam palette with cream highlights and a single pink heart-shaped sparkle floating off the tail.

### `Sprites/monsters/fatLizard.webp` — Tubsalamander
> An oversized chubby cartoon salamander, very round stout body, weight planted forward like it owns the rock it's sitting on. Bright fire-orange skin with a dark crimson belly stripe and a single hot-yellow scale highlight along the spine catching the rim-light. Stubby legs, small tail flicked confidently to one side, wide chunky head tilted slightly upward with a smug half-grin. Big round eyes with bright pinpoint reflections, tiny nostrils trailing twin wisps of black smoke, mouth cracked open showing a flickering orange flame and one fang. Warm amber-orange palette with soot-grey accents and a faint heat-shimmer aura.

### `Sprites/monsters/fatDragon.webp` — Plumpdrake
> A much larger spherical cartoon dragon, balloon-dragon silhouette but with attitude. Deep crimson-red scales with a darker maroon belly band and a hot magma-orange underglow leaking through a few cracked scales along the chest. Tiny vestigial wings flared out for show (clearly too small to fly), two forward-curving black horns, half-lidded eyes giving a "fight me" stare. Wide grumpy mouth slightly open with a charging fireball glowing inside (yellow core, orange mantle). Heavy heat-shimmer aura around the silhouette, ember sparks drifting upward. Volcanic red palette with charcoal-grey accents and bright amber rim-light along the top.

### `Sprites/monsters/octoLegPoison.webp` — Venom Tentacle
> A single chunky disembodied octopus tentacle in a curling S-shape, base on the left, tip on the right, mounted as if extending from off-canvas. Toxic violet skin with a darker plum underside, suction cups along the inner curve. Tip flares into a hooded mouth-opening dripping luminous green-violet venom droplets, with two small slitted purple eyes flanking the tip giving it a serpent-head silhouette. Sickly green sparkles drift around the tip. Strong magenta rim-light along the top of the curve, deep aubergine shadow on the underside.

### `Sprites/monsters/octoLegFreeze.webp` — Frostbite Tentacle
> Same chunky S-curved tentacle silhouette as the venom one (consistent base/tip orientation), but ice-element. Pale glacial cyan skin with cool teal undershadow, suction cups frosted over with crystalline rime. Tip encased in jagged pale-cyan ice shards forming a clawed crown, frozen vapour mist curling off the surface, two icy-blue glowing pinpoint eyes on the tip. Crisp white rim-light catches the ice shards, deep navy core shadow.

### `Sprites/monsters/octoLegSkillLock.webp` — Silence Tentacle
> Same S-curve tentacle silhouette, amber-element. Burnt-orange skin with a deeper rust underside, suction cups dotted along the inner curve. Tip wrapped in a glowing rune-circle of amber sigils with a tiny ornate keyhole / lock motif at the centre, faint orange chains drifting around the tip, two narrow glowing yellow eyes flanking the lock. A muffled "shh" gesture implied — the rune-circle pulses with mute-energy. Hot orange rim-light, deep mahogany shadow.

### `Sprites/monsters/octoLegStun.webp` — Shock Tentacle
> Same S-curve tentacle silhouette, lightning element. Bright sun-yellow skin with a darker amber underside, suction cups crackling with stray micro-bolts. Tip explodes into a sharp lightning-bolt crown — three jagged white-gold electric forks radiating outward, electric arcs zig-zagging between them, two wide white shocked eyes on the tip. Pulsing white-yellow halo around the tip, sharp white rim-light along the curve, dark sepia shadow.

---

## 👑 Boss sprites — 0 missing (was 2 — both shipped v0.25.498) + 2 attack poses still pending

Same master style line as monsters; bosses go bigger — **boss-fight intro cutscene energy, presence halo, dramatic backlight**.

### `Sprites/bosses/octobaby.webp` — Octobaby, the Eight-Mood Tyrant
> A massive boss-tier cartoon octopus with a colossal bulbous head dominating the silhouette and serious main-character energy. Deep magenta-pink head fading to plum belly band, with a moody storm-cloud purple aura backlighting the entire silhouette as a boss-presence halo. **Wearing oversized chunky black wraparound shades** that catch a single bright magenta lens-flare reflection — the eyes behind the shades only barely visible as faint glowing pinpoints. Sharply furrowed brow folds visible above the shades, tiny smug downturned grimace mouth, faint pink cheek blush left in for the cute-but-deadly contrast. Eight chunky bezier-curved tentacles spread around the base of the head in a confident wide stance, each tentacle subtly tinted toward its status colour at the tip (toxic purple, ice cyan, silence amber, shock yellow). Crackling micro-sparks of all four colours orbiting the head. Heavy rim-light along the top of the head, deep plum core shadow underneath.

### `Sprites/bosses/attack/octobaby.webp` — Octobaby attack pose
> Same character mid-roar — shades knocked slightly askew so one glowing magenta eye burns through the side gap, mouth open showing a small fanged maw, tentacles flexed outward in star pattern, four-coloured status orbs charging at each tentacle tip, full storm-aura behind.

### `Sprites/bosses/koopaKing.webp` — King Koopaloo, the Ember Tyrant
> A chunky Bowser-inspired cartoon turtle-dragon king with full boss presence. Massive spiked orange shell with three white-tipped pyramid spikes along the top and a darker burnt-orange inner rim, edges scorched. Tan-yellow belly plate. Chunky green-skinned legs ending in three sharp white claws each, powerful clawed arms. Huge horned head with two forward-curving white horns, a fiery crimson mohawk hair tuft erupting upward in flickering flame-shapes, furrowed brow, big white eyes with intense red pupils and a hot lens-flare on each, wide menacing fanged grin showing two protruding lower-jaw fangs. Royal-villain stance — one fist raised with a small fireball cradled in the palm, the other planted on the hip. Storm-cloud heat aura behind the silhouette, ember sparks orbiting the head. Deep moss-green + burnt-orange palette with crimson, gold, and a single magenta rim-glint for boss-tier polish.

### `Sprites/bosses/attack/koopaKing.webp` — Koopa King attack pose
> Same character mid-roar — mouth wide open belching a wide diagonal fireball geyser, eyes glowing pure red, both claws raised, mohawk flames stretched tall, full-body shockwave ember halo.

---

## ✨ Skill VFX — 52 missing (every registered key)

The lazy VFX loader expects `Sprites/vfx/<skillKey>.webp` matching the exact key strings below. The existing `slash.png`, `fireball.png`, `ice_spike.png`, `magic_bolt.png`, `meteor.png` all use the wrong extension and (in two cases) the wrong key — **none of them are picked up**. Procedural cel-shaded VFX keep rendering until each `.webp` lands.

**Master VFX prefix — paste verbatim before each per-skill line below:**

> Chibi anime spell-effect / weapon-strike VFX sprite for a 2D platformer game in the Mojiworld aesthetic. Pure transparent background — alpha channel only, no caster, no target, no scene, no environment, no text. 768×768 square canvas, soft painterly cel-shaded with bold black outlines and additive glow accents. Strong centred composition; effect occupies ~70% of canvas. Punchy eye-catching motion-line energy, dramatic rim-light on the leading edge, saturated accent palette, clear focal silhouette readable at 1/4 size. The effect should feel kinetic — like the still frame plucked from peak motion.

Per-skill prompts live in **`SPRITE_DROPIN_PROMPTS.md` §v0.25.488** (lines 144–317). The 52 keys to generate, by class:

| Class | Skill keys (= filename stems) |
| --- | --- |
| 🟦 Warrior (9) | `slash`, `powerStrike`, `groundSlam`, `rush`, `warCry`, `bloodlust`, `rampage`, `guardian`, `holyShield` |
| 🟪 Rogue (9) | `stab`, `backstab`, `throwDagger`, `smokeDash`, `flurry`, `shadowStrike`, `deathBlossom`, `smokeBomb`, `sleight` |
| 🔵 Mage (9) | `magicBolt`, `fireball`, `iceSpike`, `blink`, `arcaneBurst`, `meteor`, `elemental`, `soulSiphon`, `darkPulse` |
| 🟧 Archer (9) | `arrowShot`, `multiShot`, `chargedShot`, `evadeRoll`, `eagleEye`, `snipe_railgun`, `arrowRain`, `wildBond`, `elementalArrows` |
| ⭐ Master Warrior (4) | `warlord_warcry`, `doombringer_apoc`, `crusader_aegis`, `dragoon_skylance` |
| ⭐ Master Rogue (4) | `shadowlord_clones`, `shinobi_seal`, `nightreaper_mark`, `phantom_cut` |
| ⭐ Master Mage (4) | `sage_meteorshower`, `elementalist_cascade`, `lich_harvest`, `hexmaster_grandhex` |
| ⭐ Master Archer (4) | `marksman_oneshot`, `ballista_volley`, `beastmaster_pack`, `skyhunter_gale` |

**To generate one:** open `SPRITE_DROPIN_PROMPTS.md`, find the heading matching the key (e.g. `**slash** · *Slash* · D ·`), paste *master VFX prefix* + the `>` line that follows the heading into Ludo.ai, save the output as `Sprites/vfx/<key>.webp`.

---

## Tally

| Category | Missing | On disk |
| --- | --- | --- |
| Monsters | **1** (seahorse) | 42 / 43 |
| Bosses | **0** | 6 / 6 |
| Boss attack poses | **2** (octobaby, koopaKing) | 4 / 6 |
| Skill VFX | **52** | 0 / 52 |
| **Total** | **55** | — |

NPC sprites are all present except where noted in `SPRITE_DROPIN_PROMPTS.md` for procedural-fallback NPCs (no missing entries vs. `NPC_SPRITE_FILES`).
