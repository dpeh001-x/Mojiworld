# Sprite drop-in paths + Ludo.ai prompts (v0.25.482 → v0.25.488)

This document collates every sprite path registered in the codebase since the underwater chain landed, plus the full skill-VFX icon set. Drop the generated `.webp` files into the listed folders and they auto-load on next page reload — the procedural fallback steps aside automatically.

> **Direction (v0.25.488):** Every prompt below has been re-tuned to land **cooler and more eye-catching** — punchier silhouettes, dramatic rim-light, attitude in the pose, saturated accent glow. The chibi-cute base is preserved (this is still Mojiworld-flavoured), but the energy gets a kick. Apply the same energy bump to anything you regenerate.

## Directory map

| Path prefix | Loader | Used for |
| --- | --- | --- |
| `Sprites/monsters/{type}.webp` | `MONSTER_SPRITE_TYPES` (line ~38782) | Regular mobs (now incl. 4 octobaby tentacles) |
| `Sprites/bosses/{type}.webp` | `BOSS_SPRITE_TYPES` (line ~38949) | Boss mobs |
| `Sprites/bosses/attack/{type}.webp` | `BOSS_ATTACK_SPRITES` | Optional attack pose for bosses |
| `Sprites/npc/{file}` | `NPC_SPRITE_FILES` | Town / map NPCs |
| `Sprites/vfx/{skillKey}.webp` | lazy-loaded by skill renderer | Skill VFX icons (see §Skill VFX below) |

## Generation settings (Ludo.ai → Image Generator)

- **Aspect ratio**: square (1:1) for monsters and bosses; portrait (2:3 or 3:4) for NPCs.
- **Background**: transparent. If output has a flat background, run through `remove.bg` or the in-Ludo background remover before export.
- **Format**: PNG → re-export as `.webp` (lossless or quality 90+).
- **Outline**: every prompt below targets a **2 px black outline** matching the existing cel-shaded fauna look.
- **Pose**: idle / neutral facing camera. The renderers anchor by feet (or bbox bottom for floating mobs) — heads cropped or cut feet will sit wrong.

## Master style line (prepend to every monster / boss prompt)

```
2D MMORPG cute-but-cool monster sprite, full body shot, dynamic confident idle pose with a hint of attitude, transparent background, cel-shaded illustrative style, clean thick 2 pixel black outline on every shape, painterly rendering with crisp rim-light highlights and a saturated accent-colour glow, chibi proportions with oversized head and big expressive eyes that read clearly at 64×64, eye-catching silhouette readable from across the screen, no text, no watermark, no UI elements.
```

> **Why the bump?** Earlier prompts read as "neutral idle". The new direction adds **rim-light, silhouette pop, accent glow, and posed attitude** so each mob holds its own at thumbnail size. Boss prompts go further — see the per-boss block.

---

# v0.25.482 — Underwater fish quintet

Five floating fish mobs for Coral Reef Depths + Abyssal Trench (Lv 25). Drop into `Sprites/monsters/`.

| Mob | File path | In-game name |
| --- | --- | --- |
| clownfish | `Sprites/monsters/clownfish.webp` | Clownie |
| pufferfish | `Sprites/monsters/pufferfish.webp` | Puffles |
| jellyfish | `Sprites/monsters/jellyfish.webp` | Jellybean |
| anglerfish | `Sprites/monsters/anglerfish.webp` | Lanternjaw |
| seahorse | `Sprites/monsters/seahorse.webp` | Hippocampus |

## clownfish (`clownfish.webp`)

> Clownie — a chubby cartoon clownfish with a big rounded head and huge sparkly expressive eyes, mid-glide with the front fin flared like it just spotted prey. Bright neon-orange body with two thick vertical white stripes outlined in dark orange and a thin cyan rim-light along the spine. Cocky little smirk showing a single tooth, dorsal fin pricked up. Tiny bubble trail behind the tail. Saturated coral-orange palette with cool teal shadows for contrast.

## pufferfish (`pufferfish.webp`)

> Puffles — a perfectly round, very chubby cartoon pufferfish mid-puff with the body slightly stretched in cartoon-anticipation pose. Buttery yellow body with eight stubby triangular spikes around the silhouette, each spike tipped with a tiny crimson danger-glow and outlined in dark amber. Big determined eyes (one slightly squinted in attitude), tiny pursed mouth blowing a defiant bubble. Soft yellow body with hot-amber rim-light along the top half and a faint green glow at the spike bases.

## jellyfish (`jellyfish.webp`)

> Jellybean — a translucent dome-shaped cartoon jellyfish with a confident floaty pose, three long wavy ribbon tentacles trailing in a wind-swept curve. Pastel violet bell with strong inner bioluminescent glow (cyan + magenta highlights swirling inside the dome). Two cute black-dot eyes with bright white pinpoint reflections, faint pink blush, sly half-smile. Tentacle tips flicker with electric magenta sparks. Lavender + electric-cyan palette with a violet rim-glow.

## anglerfish (`anglerfish.webp`)

> Lanternjaw — a chunky deep-sea cartoon anglerfish with a wide oval body and stubby tail fin, tilted forward like it's stalking the viewer. Inky midnight-navy body with subtle gradient to deep purple at the belly. Single forehead antenna arched dramatically forward, bulb at the tip blasting a hot lemon-yellow halo that spills cold cyan rim-light across the face. Big round white eyes, slit-pupil predator stare, two protruding white fang teeth visible. Faint glowing teal speckles along the flanks like deep-sea bioluminescence.

## seahorse (`seahorse.webp`)

> Hippocampus — a tall standing cartoon seahorse with the classic curled S-shape body, head turned three-quarter toward the viewer with a smug half-grin. Mint-teal body with darker teal segmented ridges along the back catching a sharp pearlescent rim-light. Long curled snout, fluttering side fin frozen mid-flicker, prehensile tail curled into a tight spiral. Big curious eye with a bright gold reflection. Soft mint + seafoam palette with cream highlights and a single pink heart-shaped sparkle floating off the tail.

---

# v0.25.485 + v0.25.488 — Octobaby Lv 50 boss + tentacle quartet

The 8-tentacled boss of the Octopus Grotto, now with **paint-over tentacles**. The head drops into `Sprites/bosses/`; the 4 tentacle types now have registered paths under `Sprites/monsters/` (per v0.25.488 — `MONSTER_SPRITE_TYPES` updated, `drawOctoLeg` is gated behind a sprite-loaded check, so the procedural bezier tentacle stays visible until you drop a `.webp`).

| Entry | File path | In-game name |
| --- | --- | --- |
| octobaby (head) | `Sprites/bosses/octobaby.webp` | Octobaby, the Eight-Mood Tyrant |
| octobaby (attack) | `Sprites/bosses/attack/octobaby.webp` | Optional attack pose |
| octoLegPoison | `Sprites/monsters/octoLegPoison.webp` | Venom Tentacle |
| octoLegFreeze | `Sprites/monsters/octoLegFreeze.webp` | Frostbite Tentacle |
| octoLegSkillLock | `Sprites/monsters/octoLegSkillLock.webp` | Silence Tentacle |
| octoLegStun | `Sprites/monsters/octoLegStun.webp` | Shock Tentacle |

## octobaby (`Sprites/bosses/octobaby.webp`)

> Octobaby, the Eight-Mood Tyrant — a massive boss-tier cartoon octopus with a colossal bulbous head dominating the silhouette and serious main-character energy. Deep magenta-pink head fading to plum belly band, with a moody storm-cloud purple aura backlighting the entire silhouette as a boss-presence halo. **Wearing oversized chunky black wraparound shades** that catch a single bright magenta lens-flare reflection — the eyes behind the shades only barely visible as faint glowing pinpoints. Sharply furrowed brow folds visible above the shades, tiny smug downturned grimace mouth, faint pink cheek blush left in for the cute-but-deadly contrast. Eight chunky bezier-curved tentacles spread around the base of the head in a confident wide stance, each tentacle subtly tinted toward its status colour at the tip (toxic purple, ice cyan, silence amber, shock yellow). Crackling micro-sparks of all four colours orbiting the head. Heavy rim-light along the top of the head, deep plum core shadow underneath. Reads as "boss-fight intro cutscene" — adorable plushie silhouette but unmistakably the heavy.

> **Optional attack pose** (`Sprites/bosses/attack/octobaby.webp`): Same character mid-roar — shades knocked slightly askew so one glowing magenta eye burns through the side gap, mouth open showing a small fanged maw, tentacles flexed outward in star pattern, four-coloured status orbs charging at each tentacle tip, full storm-aura behind.

## octoLegPoison (`Sprites/monsters/octoLegPoison.webp`)

> Venom Tentacle — a single chunky disembodied octopus tentacle in a curling S-shape, base on the left, tip on the right, mounted as if extending from off-canvas. Toxic violet skin with a darker plum underside, suction cups along the inner curve. Tip flares into a hooded mouth-opening dripping luminous green-violet venom droplets, with two small slitted purple eyes flanking the tip giving it a serpent-head silhouette. Sickly green sparkles drift around the tip. Strong magenta rim-light along the top of the curve, deep aubergine shadow on the underside.

## octoLegFreeze (`Sprites/monsters/octoLegFreeze.webp`)

> Frostbite Tentacle — same chunky S-curved tentacle silhouette as the venom one (consistent base/tip orientation), but ice-element. Pale glacial cyan skin with cool teal undershadow, suction cups frosted over with crystalline rime. Tip encased in jagged pale-cyan ice shards forming a clawed crown, frozen vapour mist curling off the surface, two icy-blue glowing pinpoint eyes on the tip. Crisp white rim-light catches the ice shards, deep navy core shadow.

## octoLegSkillLock (`Sprites/monsters/octoLegSkillLock.webp`)

> Silence Tentacle — same S-curve tentacle silhouette, amber-element. Burnt-orange skin with a deeper rust underside, suction cups dotted along the inner curve. Tip wrapped in a glowing rune-circle of amber sigils with a tiny ornate keyhole / lock motif at the centre, faint orange chains drifting around the tip, two narrow glowing yellow eyes flanking the lock. A muffled "shh" gesture implied — the rune-circle pulses with mute-energy. Hot orange rim-light, deep mahogany shadow.

## octoLegStun (`Sprites/monsters/octoLegStun.webp`)

> Shock Tentacle — same S-curve tentacle silhouette, lightning element. Bright sun-yellow skin with a darker amber underside, suction cups crackling with stray micro-bolts. Tip explodes into a sharp lightning-bolt crown — three jagged white-gold electric forks radiating outward, electric arcs zig-zagging between them, two wide white shocked eyes on the tip. Pulsing white-yellow halo around the tip, sharp white rim-light along the curve, dark sepia shadow.

---

# v0.25.487 — Sauro Slope + Koopa King

Two cute fat fire-spitting mobs + a Bowser-style Lv 30 boss.

| Entry | File path | In-game name |
| --- | --- | --- |
| fatLizard | `Sprites/monsters/fatLizard.webp` | Tubsalamander |
| fatDragon | `Sprites/monsters/fatDragon.webp` | Plumpdrake |
| koopaKing | `Sprites/bosses/koopaKing.webp` | King Koopaloo, the Ember Tyrant |

## fatLizard (`fatLizard.webp`)

> Tubsalamander — an oversized chubby cartoon salamander, very round stout body, weight planted forward like it owns the rock it's sitting on. Bright fire-orange skin with a dark crimson belly stripe and a single hot-yellow scale highlight along the spine catching the rim-light. Stubby legs, small tail flicked confidently to one side, wide chunky head tilted slightly upward with a smug half-grin. Big round eyes with bright pinpoint reflections, tiny nostrils trailing twin wisps of black smoke, mouth cracked open showing a flickering orange flame and one fang. Warm amber-orange palette with soot-grey accents and a faint heat-shimmer aura.

## fatDragon (`fatDragon.webp`)

> Plumpdrake — a much larger spherical cartoon dragon, balloon-dragon silhouette but with attitude. Deep crimson-red scales with a darker maroon belly band and a hot magma-orange underglow leaking through a few cracked scales along the chest. Tiny vestigial wings flared out for show (clearly too small to fly), two forward-curving black horns, half-lidded eyes giving a "fight me" stare. Wide grumpy mouth slightly open with a charging fireball glowing inside (yellow core, orange mantle). Heavy heat-shimmer aura around the silhouette, ember sparks drifting upward. Volcanic red palette with charcoal-grey accents and bright amber rim-light along the top.

## koopaKing (`koopaKing.webp`)

> King Koopaloo, the Ember Tyrant — a chunky Bowser-inspired cartoon turtle-dragon king with full boss presence. Massive spiked orange shell with three white-tipped pyramid spikes along the top and a darker burnt-orange inner rim, edges scorched. Tan-yellow belly plate. Chunky green-skinned legs ending in three sharp white claws each, powerful clawed arms. Huge horned head with two forward-curving white horns, a fiery crimson mohawk hair tuft erupting upward in flickering flame-shapes, furrowed brow, big white eyes with intense red pupils and a hot lens-flare on each, wide menacing fanged grin showing two protruding lower-jaw fangs. Royal-villain stance — one fist raised with a small fireball cradled in the palm, the other planted on the hip. Storm-cloud heat aura behind the silhouette, ember sparks orbiting the head. Deep moss-green + burnt-orange palette with crimson, gold, and a single magenta rim-glint for boss-tier polish.

> **Optional attack pose** (`Sprites/bosses/attack/koopaKing.webp`): Same character mid-roar — mouth wide open belching a wide diagonal fireball geyser, eyes glowing pure red, both claws raised, mohawk flames stretched tall, full-body shockwave ember halo.

---

# v0.25.488 — Skill VFX icons (52 skills)

Drop-in icon sprites for every skill — 5 base + 4 advanced job for each of the 4 classes (= 9 × 4 = 36) plus 4 master signatures × 4 paths (= 16). Save each as `Sprites/vfx/<skillKey>.webp` using the exact key shown (e.g. `Sprites/vfx/slash.webp`). Loader is the lazy VFX registry — sprites swap in on first cast once the file exists. Until then the procedural cel-shaded VFX in `_drawVectorHero` / projectile renderer keeps drawing.

> **Cooler / eye-catching direction (v0.25.488):** every prompt below leans into **bold motion lines, hot-edge rim light on the leading shape, a saturated accent glow, and a clear focal silhouette readable at thumbnail size**. Earlier prompts in `SKILL_PROMPTS.md` were tuned for "soft cel-shaded anime" — these crank the energy: dramatic perspective, additive glow, sparks/embers/runes, contrasted complementary palette per class.

## Master VFX prefix — paste verbatim before each skill prompt

```
Chibi anime spell-effect / weapon-strike VFX sprite for a 2D platformer game in the Mojiworld aesthetic. Pure transparent background — alpha channel only, no caster, no target, no scene, no environment, no text. 768×768 square canvas, soft painterly cel-shaded with bold black outlines and additive glow accents. Strong centred composition; effect occupies ~70% of canvas. Punchy eye-catching motion-line energy, dramatic rim-light on the leading edge, saturated accent palette, clear focal silhouette readable at 1/4 size. The effect should feel kinetic — like the still frame plucked from peak motion.
```

## 🟦 Warrior (5 base + 2 berserker + 2 knight)

**slash** · *Slash* · D · `Sprites/vfx/slash.webp`
> Heavy curved sword arc — silver blade trail in a 270° sweep with a hot white-to-cyan motion ribbon, sparks of cyan light flying off the trail, a single bright lens-flare at the apex. Diagonal top-left → bottom-right.

**powerStrike** · *Power Strike* · S · `Sprites/vfx/powerStrike.webp`
> Three vertically-stacked white-gold blade arcs (high / mid / low), each trailing golden energy ribbons, the lowest arc anchored by a small starburst stun-ring shockwave. Bold gold-on-cyan complementary palette.

**groundSlam** · *Ground Slam* · A · `Sprites/vfx/groundSlam.webp`
> Top-down circular shockwave — concentric orange-red cracked-ground rings, golden spark bursts radiating outward, dust chunks kicked up at the rim, hot-magma core glow at the centre.

**rush** · *Rush* · E · `Sprites/vfx/rush.webp`
> Horizontal warm-amber motion blur trail, dense speedlines left-to-right, leading edge shaped like a piercing arrow tip in bright golden energy, soft heat-shimmer accent behind.

**warCry** · *War Cry* · W · `Sprites/vfx/warCry.webp`
> Radial sound-wave burst — concentric red and gold rings expanding outward, a faint roaring lion silhouette crossfading in the centre, fierce red rim-light.

**bloodlust** · *Bloodlust* · Q (Berserker) · `Sprites/vfx/bloodlust.webp`
> Dripping crimson aura with rising blood-red flames at the bottom, floating dark-red droplets, a glowing red heart silhouette pulsing in the centre, blood-mist splatter at the edges.

**rampage** · *Rampage* · C ULT (Berserker) · `Sprites/vfx/rampage.webp`
> Spinning crimson tornado of swords — multiple silver blade silhouettes whirling in a vortex with red-orange flame wisps trailing each, tornado tapering wide-top to sharp-bottom, dramatic cinematic energy.

**guardian** · *Guardian* · Q (Knight) · `Sprites/vfx/guardian.webp`
> Translucent blue-white shield bubble dome, hexagonal energy lattice pattern, soft pulsing apex light, golden filigree edge, faint cross sigil in the centre.

**holyShield** · *Holy Shield* · C ULT (Knight) · `Sprites/vfx/holyShield.webp`
> Radiant golden cross enclosed in a circular halo — concentric rings of holy energy, four directional star-burst light beams, soft warm gold + ivory + soft-blue palette.

## 🟪 Rogue (5 base + 2 ninja + 2 assassin)

**stab** · *Stab* · D · `Sprites/vfx/stab.webp`
> Single sharp horizontal violet slash, needle-thin blade silhouette piercing through a soft purple smoke trail, speedlines emphasising the thrust direction.

**backstab** · *Backstab* · S · `Sprites/vfx/backstab.webp`
> Three overlapping diagonal dagger slashes — violet + dark-purple blade arcs with crimson blood-mist trails, a glowing purple eye sigil burning behind the slashes.

**throwDagger** · *Throw Dagger* · A · `Sprites/vfx/throwDagger.webp`
> Five fan-spread daggers radiating outward, silver blades with violet motion-trail ribbons in a 60° fan, each blade tipped with a small purple spark.

**smokeDash** · *Smoke Dash* · E · `Sprites/vfx/smokeDash.webp`
> Horizontal smoke corridor — three streaks of swirling violet-grey smoke with embedded dagger silhouettes, wispy edges, hot magenta accent at the leading edge.

**flurry** · *Flurry* · W · `Sprites/vfx/flurry.webp`
> Rapid blink-warp slash combo — multiple violet dagger afterimages stacked along a horizontal line, fading from bright magenta at the front to deep purple at the back, shutter-stutter strike feel.

**shadowStrike** · *Shadow Strike* · Q (Ninja) · `Sprites/vfx/shadowStrike.webp`
> Flash of dark-violet energy with a kunai silhouette piercing a small black-violet vortex, swirling shadow tendrils, sharp cyan/magenta blade highlights, critical-hit starburst behind.

**deathBlossom** · *Death Blossom* · C ULT (Ninja) · `Sprites/vfx/deathBlossom.webp`
> Pink-magenta cherry-blossom petal storm — five glowing daggers radiating from a central rose-pink burst, sakura petals trailing each blade, soft cherry-blossom palette mixed with dark-violet shadow accents.

**smokeBomb** · *Smoke Bomb* · Q (Assassin) · `Sprites/vfx/smokeBomb.webp`
> Dense lavender-grey smoke cloud, organic billowing shape with embedded sparkles and a faint healing-green inner glow at the centre, soft puffy edges.

**sleight** · *Voidrift Blink* · C ULT (Assassin) · `Sprites/vfx/sleight.webp`
> Horizontal void rift — a tear in space drawn as a deep indigo-black diamond crack with violet lightning arcs along its edges, three afterimage silhouettes of a hooded figure radiating outward, magenta phantom light bleeding through.

## 🟦 Mage (5 base + 2 archmage + 2 warlock)

**magicBolt** · *Magic Bolt* · D · `Sprites/vfx/magicBolt.webp`
> Small sparkling arcane projectile — soft white-blue glowing orb with crystalline shards orbiting it, short trail of magic motes behind. Light, zippy, hot-cyan core.

**fireball** · *Fireball* · S · `Sprites/vfx/fireball.webp`
> Dense orange-red fireball — bright yellow-white core, swirling red-orange flame mantle, smoke wisps trailing behind, embers shooting off the edges, hottest at centre coolest at edges.

**iceSpike** · *Ice Spike* · A · `Sprites/vfx/iceSpike.webp`
> Vertical crystalline ice spike — pale cyan-blue jagged crystal with white frost mist swirling at the base, sharp facets catching a hot white rim-light, frozen-air shimmer above the tip.

**blink** · *Blink* · E · `Sprites/vfx/blink.webp`
> Short teleport flash — two parallel vertical streaks of cyan-violet light with a starburst at the destination, sharp crystalline glints, trail dissipating into magic motes.

**arcaneBurst** · *Arcane Burst* · W · `Sprites/vfx/arcaneBurst.webp`
> Massive radial AoE — concentric rings of pale violet and electric-blue energy expanding outward from a bright white core, runes floating in the inner ring, hexagonal mana shapes arrayed around the perimeter.

**meteor** · *Meteor* · Q (Archmage) · `Sprites/vfx/meteor.webp`
> Burning meteor crashing diagonally — large rocky chunk wreathed in orange-red flame, comet-tail of smoke and embers behind, ground impact crater glowing hot magma at the bottom of the canvas.

**elemental** · *Elemental Convergence* · C ULT (Archmage) · `Sprites/vfx/elemental.webp`
> Three elements converging on a centre point — fire (orange-red) on the left, ice (cyan-blue) on the right, lightning (yellow-white) on top, all arcing inward with chain-energy lines into a prismatic star-burst at the centre.

**soulSiphon** · *Soul Siphon* · Q (Warlock) · `Sprites/vfx/soulSiphon.webp`
> Spectral skull silhouette with three streams of pale-green soul energy flowing from outside the canvas into its mouth, wispy ghostly tendrils, eerie sickly-green glow.

**darkPulse** · *Dark Pulse* · C ULT (Warlock) · `Sprites/vfx/darkPulse.webp`
> Black-violet AoE pulse — concentric rings of dark-purple void energy expanding outward, ghostly skull faces emerging from the rings, blood-red lifesteal arcs flowing back toward the centre.

## 🟧 Archer (5 base + 2 sniper + 2 ranger)

**arrowShot** · *Arrow Shot* · D · `Sprites/vfx/arrowShot.webp`
> Single sleek arrow in flight — wood-grain shaft, white-feather fletching, polished steel tip with a thin green-gold motion-trail ribbon behind. Horizontal orientation, hot-edge highlight.

**multiShot** · *Multi Shot* · S · `Sprites/vfx/multiShot.webp`
> Three arrows in horizontal fan spread — same arrow design as arrowShot, each with a green-yellow trail, slight radial arc, leading arrow tipped with a bright spark.

**chargedShot** · *Charged Shot* · A · `Sprites/vfx/chargedShot.webp`
> Massive piercing arrow charged with crackling yellow-white lightning — oversized shaft, bright glowing electric tip, lightning bolts arcing along the shaft, motion trail of pure electric energy.

**evadeRoll** · *Evade Burst* · E · `Sprites/vfx/evadeRoll.webp`
> Cute back-flip explosive blast — small puff cloud burst with a gust of leaf-green wind petals fanning outward, two tiny floating arrows at the edges hinting at the follow-up shot, knockback shock-ring at the base.

**eagleEye** · *Eagle Eye* · W · `Sprites/vfx/eagleEye.webp`
> Glowing golden-amber eye sigil with a stylised eagle silhouette overlaid — sharp predatory pupil, crosshair reticle behind the eye, accuracy beams radiating in cardinal directions.

**snipe_railgun** · *Railshot* · Q (Sniper) · `Sprites/vfx/snipe_railgun.webp`
> Horizontal piercing rail beam — thick electric-blue laser line across the canvas with crackling lightning arcs branching outward, arrow-shaped energy projectile leading the line, comet tail of bright cyan light behind.

**arrowRain** · *Arrow Rain* · C ULT (Sniper) · `Sprites/vfx/arrowRain.webp`
> Dense barrage of arrows raining down at 60° from upper-left — 12-15 arrows in formation with green-yellow motion trails, dust cloud accumulating at the bottom of the canvas.

**wildBond** · *Wild Bond* · Q (Ranger) · `Sprites/vfx/wildBond.webp`
> Spectral grey wolf silhouette emerging from a swirl of green nature energy — full-body wolf in a leaping pose, leaves and pine needles drifting around it, ethereal forest-spirit aura.

**elementalArrows** · *Elemental Arrows* · C ULT (Ranger) · `Sprites/vfx/elementalArrows.webp`
> Rainbow barrage of magic arrows — six arrows in a fan, each glowing a different element colour (red fire, blue ice, yellow lightning, green nature, white light, purple dark), all radiating outward from canvas centre.

## ⭐ Master signatures (16 skills · 4 per path)

### Warrior path

**warlord_warcry** · *Warlord's Banner* · `Sprites/vfx/warlord_warcry.webp`
> Planted military banner billowing in the wind — crimson banner with gold trim, planted on a dark-iron pole, golden warlord-buff aura radiating outward in concentric rings, faint roaring crowd shadows behind.

**doombringer_apoc** · *Blade of Calamity* · `Sprites/vfx/doombringer_apoc.webp`
> Colossal black-iron greatsword embedded vertically in the canvas — runes glowing crimson along the blade, dark crimson energy billowing off the edges, ten phantom slash arcs radiating forward from the blade tip.

**crusader_aegis** · *Divine Aegis* · `Sprites/vfx/crusader_aegis.webp`
> Five hovering golden-white holy orbs arranged in a pentagon — each orb has a small cross sigil and trailing halo, central healing radiance pulsing outward, soft warm gold + ivory + soft-blue palette.

**dragoon_skylance** · *Sky Lance* · `Sprites/vfx/dragoon_skylance.webp`
> Massive blue-steel lance plunging downward from the top of the canvas — leading edge wreathed in cyan-white piercing energy, draconic spirit silhouette wrapping the lance shaft, ground impact crater splitting open at the bottom.

### Rogue path

**shadowlord_clones** · *Mirror Shadow* · `Sprites/vfx/shadowlord_clones.webp`
> Three levitating dark-violet ninja silhouettes flanking the centre — each clone in monochrome shadow-purple with white eye-glow only, circular AoE-strike telegraph rings under each, faint levitation glow at their feet.

**shinobi_seal** · *Kage Rush* · `Sprites/vfx/shinobi_seal.webp`
> Horizontal violet zip-streak slashing across the canvas — multiple kanji seal-paper silhouettes embedded along the streak, rapid-succession dagger strikes layered along the path, kunai embedded at the leading edge.

**nightreaper_mark** · *Eclipse Massacre* · `Sprites/vfx/nightreaper_mark.webp`
> Blood-red eclipse — black sun with crimson corona at the top, ten spectral daggers raining down from the eclipse, dark spiral aftershock nova crackling at the centre, blood-mist haze in the background.

**phantom_cut** · *Voidrift Execution* · `Sprites/vfx/phantom_cut.webp`
> Dark phantom silhouette mid-execution — phasing through chained teleport afterimages, six floating death-mark sigils on enemies implied at the edges, final shadow-nova starburst at the centre.

### Mage path

**sage_meteorshower** · *Meteor Shower* · `Sprites/vfx/sage_meteorshower.webp`
> Five meteors raining diagonally across the canvas — each wreathed in bright orange-yellow flame with smoke trails, ground impact crater glow at the bottom-right, embers floating across the canvas.

**elementalist_cascade** · *Prismatic Cascade* · `Sprites/vfx/elementalist_cascade.webp`
> Four-element vertical cascade — fire (top) cascading into ice (upper-mid) into lightning (lower-mid) into nature green (bottom), each element seamlessly blending into the next, prismatic energy bridging them.

**lich_harvest** · *Soul Vortex* · `Sprites/vfx/lich_harvest.webp`
> Large swirling dark-violet vortex in the centre — black-purple spiral pulling spectral souls inward, ghostly skull silhouettes spiralling toward the singularity, sickly-green life-drain energy radiating outward.

**hexmaster_grandhex** · *Grand Hex* · `Sprites/vfx/hexmaster_grandhex.webp`
> Glowing purple hexagram sigil with five intricate runes at its points — frost mist clinging to the sigil edges, green poison droplets dripping from the runes, central purple eye watching from the hex.

### Archer path

**marksman_oneshot** · *One Shot One Kill* · `Sprites/vfx/marksman_oneshot.webp`
> Single oversized golden arrow drawn at full bow tension at the right edge — body crackling with white-gold piercing energy, long horizontal aim-line beam stretching across the canvas, crosshair reticle at the left edge.

**ballista_volley** · *Siege Volley* · `Sprites/vfx/ballista_volley.webp`
> Horizontal stream of piercing arrows — dense rapid-fire 8-arrow stream with chain-link motion trails between them, leading arrow tipped with a heavy bronze ballista bolt, smoke wisps trailing the stream.

**beastmaster_pack** · *Call of the Wild* · `Sprites/vfx/beastmaster_pack.webp`
> Three grey-and-white wolves running in a tight pack formation — spectral nature-energy aura around them, fierce determination, pine forest hint in the background dissolving into transparency.

**skyhunter_gale** · *Gale Storm* · `Sprites/vfx/skyhunter_gale.webp`
> Ten homing arrows with cyan-white wind-trail ribbons spiralling through the canvas — each arrow following a curved path with a wind slip-stream behind it, central wind vortex at the canvas centre, all arrows converging outward.

---

# v0.25.512 — Priest + Arch Bishop (holy mage subtree)

New tier-1 / tier-2 mage path. Two skill-VFX icons + two character portraits (the second + third advancements show their full-body sprite in the advancement modal). Drop the VFX into `Sprites/vfx/` and the portraits into `Sprites/character/portraits/` (the modal will auto-pick up `priest.webp` / `archbishop.webp` if you wire them in later — for now they fall back to the `icon` emoji).

| Entry | File path | Used as |
| --- | --- | --- |
| celestialAurora (VFX) | `Sprites/vfx/celestialAurora.webp` | Priest signature on-cast burst |
| archbishop_grail (VFX) | `Sprites/vfx/archbishop_grail.webp` | Arch Bishop ultimate on-cast burst |
| priest (portrait) | `Sprites/character/portraits/priest.webp` | Class-advancement modal card |
| archbishop (portrait) | `Sprites/character/portraits/archbishop.webp` | Master-advancement modal card |

## VFX icons (paste master VFX prefix from §v0.25.488 first)

**celestialAurora** · *Celestial Aurora* · Q (Priest) · `Sprites/vfx/celestialAurora.webp`
> Miniature glowing star anchored at canvas centre — eight-pointed cream-and-gold geometric core with a sharp white pinpoint, bathed in concentric pale-amber haloes that fade to soft lavender at the edges. Eight thin ray-spokes radiate outward, each terminating in a tiny floating starlet. Faint translucent feather-wisps curl around the perimeter to suggest "celestial cleanse." Cool ivory + warm honey palette with a single magenta lens-flare glint at the top. Reads as healing and judgment in one beat.

**archbishop_grail** · *Judgment of the Holy Grail* · X ULT (Arch Bishop) · `Sprites/vfx/archbishop_grail.webp`
> Ornate filigreed chalice planted at canvas centre, wreathed in seven downward-pointing pillars of pure golden-white light arranged in a perfect halo around it. Each pillar tapers from a wide flared top to a needle-sharp base, alive with cascading light-particles. Spectral translucent wings of pure golden geometry stretch out behind the chalice. Eyes-of-divinity motif at the chalice rim — small white pinpoints. Background ringed with seven larger floating starlets matching the pillars. Palette: ivory, honey-gold, warm amber, with a single crimson rim-glint inside the cup for solemn weight.

## Character portraits (paste master style line from §monster sprites first, but swap "monster" for "hero")

**priest** · *Priest* · `Sprites/character/portraits/priest.webp`
> The Luminary — a chibi mage in shimmering white-and-cream silken robes with pale-amber trim, a soft floating golden halo orbiting a few inches above the head, holding a slender ivory staff topped with a single radiant eight-pointed star. Robes catch a hot rim-light along the upper sleeves with cool periwinkle shadow underneath. Big confident eyes with bright magenta pinpoint reflections; serene knowing half-smile. Spectral starlight motes drift around the silhouette. The character should read as cute first, divine second — a kid prodigy who learned the math of light.

**archbishop** · *Arch Bishop, the Archon of Providence* · `Sprites/character/portraits/archbishop.webp`
> Same character ascended — hovers a few pixels off the ground in cream-and-gold ornate vestments with floor-length hem dripping golden geometric trim, translucent spectral wings of pure golden geometry (sharp polygonal facets, NOT feathers) folded behind. A heavier ringed halo with seven small starlet markers floats above the head. Eyes glow constant piercing white (no visible iris). Holds the same ivory staff but the star tip has bloomed into a chalice-shaped reliquary cradling a captured starlight. Subtle golden chains of light dangle from the wrists and waist as if the figure is the still point at the centre of a divine equation. Reads as boss-fight intro cutscene energy — same chibi proportions as the Priest, but with serious main-character presence and a faint gravitas the smaller figure didn't have.

---

# v0.25.514 — Master skill-VFX prompt sheet (ALL 55 skills)

Single canonical reference for every in-game skill VFX as of v0.25.514. Supersedes the v0.25.488 §Skill VFX section for any skill listed below — the prompts here have been re-tuned for tighter palette consistency per class and updated for the new Priest path (Holy Light + Celestial Aurora) and the v0.25.514 changes (Beastmaster pack, etc.).

Workflow: prepend the **VFX master prefix** below to each skill's per-line prompt, paste into Ludo.ai, save the output as `Sprites/vfx/<skillKey>.webp` matching the heading exactly.

**VFX master prefix — paste verbatim before each prompt:**

> Chibi anime spell-effect / weapon-strike VFX sprite for a 2D platformer game in the Mojiworld aesthetic. Pure transparent background — alpha channel only, no caster, no target, no scene, no environment, no text. 768×768 square canvas, soft painterly cel-shaded with bold black outlines and additive glow accents. Strong centred composition; effect occupies ~70% of canvas. Punchy eye-catching motion-line energy, dramatic rim-light on the leading edge, saturated accent palette, clear focal silhouette readable at 1/4 size. The effect should feel kinetic — like the still frame plucked from peak motion.

---

## 🟦 Warrior (5 basic + 2 berserker + 2 knight + 4 master)

**slash** · *Slash* — `Sprites/vfx/slash.webp`
> Heavy curved sword arc — silver blade trail in a 270° sweep with a hot white-to-cyan motion ribbon, sparks of cyan light flying off the trail, single bright lens-flare at the apex. Diagonal top-left → bottom-right.

**powerStrike** · *Power Strike* — `Sprites/vfx/powerStrike.webp`
> Three vertically-stacked white-gold blade arcs (high / mid / low), each trailing golden ribbons, the lowest arc anchored by a small starburst stun-ring shockwave. Bold gold-on-cyan complementary palette.

**groundSlam** · *Ground Slam* — `Sprites/vfx/groundSlam.webp`
> Top-down circular shockwave — concentric orange-red cracked-ground rings, golden spark bursts radiating outward, dust chunks at the rim, hot-magma core glow at the centre.

**rush** · *Rush* — `Sprites/vfx/rush.webp`
> Horizontal warm-amber motion blur, dense speedlines left-to-right, leading edge shaped like a piercing arrow tip in bright golden energy, soft heat-shimmer accent behind.

**warCry** · *War Cry* — `Sprites/vfx/warCry.webp`
> Radial sound-wave burst — concentric red and gold rings expanding outward, faint roaring lion silhouette crossfading in the centre, fierce red rim-light.

**bloodlust** · *Bloodlust* (Berserker Q) — `Sprites/vfx/bloodlust.webp`
> Dripping crimson aura with rising blood-red flames at the bottom, floating dark-red droplets, glowing red heart silhouette pulsing in the centre, blood-mist splatter at the edges.

**rampage** · *Rampage* (Berserker C) — `Sprites/vfx/rampage.webp`
> Spinning crimson tornado of swords — multiple silver blade silhouettes whirling in a vortex with red-orange flame wisps, tornado tapering wide-top to sharp-bottom, dramatic cinematic energy.

**guardian** · *Guardian* (Knight Q) — `Sprites/vfx/guardian.webp`
> Translucent blue-white shield bubble dome, hexagonal energy lattice pattern, soft pulsing apex light, golden filigree edge, faint cross sigil in the centre.

**holyShield** · *Holy Shield* (Knight C) — `Sprites/vfx/holyShield.webp`
> Radiant golden cross enclosed in a circular halo — concentric rings of holy energy, four directional star-burst light beams, soft warm gold + ivory + soft-blue palette.

**warlord_warcry** · *Warlord's Banner* (Warlord master) — `Sprites/vfx/warlord_warcry.webp`
> Planted military banner billowing in the wind — crimson banner with gold trim on a dark-iron pole, golden warlord-buff aura radiating outward in concentric rings, faint roaring crowd shadows behind.

**doombringer_apoc** · *Blade of Calamity* (Doombringer master) — `Sprites/vfx/doombringer_apoc.webp`
> Colossal black-iron greatsword embedded vertically — runes glowing crimson along the blade, dark crimson energy billowing off the edges, ten phantom slash arcs radiating forward from the blade tip.

**crusader_aegis** · *Divine Aegis* (Crusader master) — `Sprites/vfx/crusader_aegis.webp`
> Five hovering golden-white holy orbs arranged in a pentagon — each orb has a small cross sigil and trailing halo, central healing radiance pulsing outward, soft warm gold + ivory + soft-blue palette.

**dragoon_skylance** · *Sky Lance* (Dragoon master) — `Sprites/vfx/dragoon_skylance.webp`
> Massive blue-steel lance plunging downward from the top of canvas — leading edge wreathed in cyan-white piercing energy, draconic spirit silhouette wrapping the lance shaft, ground impact crater splitting open at the bottom.

## 🟪 Rogue (5 basic + 2 ninja + 2 assassin + 4 master)

**stab** · *Stab* — `Sprites/vfx/stab.webp`
> Single sharp horizontal violet slash, needle-thin blade silhouette piercing through soft purple smoke trail, speedlines emphasising the thrust direction.

**backstab** · *Backstab* — `Sprites/vfx/backstab.webp`
> Three overlapping diagonal dagger slashes — violet + dark-purple blade arcs with crimson blood-mist trails, glowing purple eye sigil burning behind the slashes.

**throwDagger** · *Throw Dagger* — `Sprites/vfx/throwDagger.webp`
> Five fan-spread daggers radiating outward in a 60° fan, silver blades with violet motion-trail ribbons, each blade tipped with a small purple spark.

**smokeDash** · *Smoke Dash* — `Sprites/vfx/smokeDash.webp`
> Horizontal smoke corridor — three streaks of swirling violet-grey smoke with embedded dagger silhouettes, wispy edges, hot magenta accent at the leading edge.

**flurry** · *Flurry* — `Sprites/vfx/flurry.webp`
> Rapid blink-warp slash combo — multiple violet dagger afterimages stacked along a horizontal line, fading from bright magenta at the front to deep purple at the back, shutter-stutter strike feel.

**shadowStrike** · *Shadow Strike* (Ninja Q) — `Sprites/vfx/shadowStrike.webp`
> Flash of dark-violet energy with kunai silhouette piercing a small black-violet vortex, swirling shadow tendrils, sharp cyan/magenta blade highlights, critical-hit starburst behind.

**deathBlossom** · *Death Blossom* (Ninja C) — `Sprites/vfx/deathBlossom.webp`
> Pink-magenta cherry-blossom petal storm — five glowing daggers radiating from a central rose-pink burst, sakura petals trailing each blade, soft cherry palette mixed with dark-violet shadow accents.

**smokeBomb** · *Smoke Bomb* (Assassin Q) — `Sprites/vfx/smokeBomb.webp`
> Dense lavender-grey smoke cloud, organic billowing shape with embedded sparkles and faint healing-green inner glow at the centre, soft puffy edges.

**sleight** · *Voidrift Blink* (Assassin C) — `Sprites/vfx/sleight.webp`
> Horizontal void rift — a tear in space drawn as a deep indigo-black diamond crack with violet lightning arcs along its edges, three afterimage silhouettes of a hooded figure radiating outward, magenta phantom light bleeding through.

**shadowlord_clones** · *Mirror Shadow* (Shadowlord master) — `Sprites/vfx/shadowlord_clones.webp`
> Three levitating dark-violet ninja silhouettes flanking the centre — each clone monochrome shadow-purple with white eye-glow only, circular AoE-strike telegraph rings under each, faint levitation glow at their feet.

**shinobi_seal** · *Kage Rush* (Shinobi master) — `Sprites/vfx/shinobi_seal.webp`
> Horizontal violet zip-streak slashing across canvas — multiple kanji seal-paper silhouettes embedded along the streak, rapid-succession dagger strikes layered along the path, kunai embedded at the leading edge.

**nightreaper_mark** · *Eclipse Massacre* (Nightreaper master) — `Sprites/vfx/nightreaper_mark.webp`
> Blood-red eclipse — black sun with crimson corona at the top, ten spectral daggers raining down from the eclipse, dark spiral aftershock nova crackling at the centre, blood-mist haze in the background.

**phantom_cut** · *Voidrift Execution* (Phantom master) — `Sprites/vfx/phantom_cut.webp`
> Dark phantom silhouette mid-execution — phasing through chained teleport afterimages, six floating death-mark sigils on enemies implied at the edges, final shadow-nova starburst at the centre.

## 🔵 Mage (5 basic + 2 archmage + 2 warlock + 2 priest + 4 master)

**magicBolt** · *Magic Bolt* — `Sprites/vfx/magicBolt.webp`
> Small sparkling arcane projectile — soft white-blue glowing orb with crystalline shards orbiting it, short trail of magic motes behind. Light, zippy, hot-cyan core.

**fireball** · *Fireball* — `Sprites/vfx/fireball.webp`
> Dense orange-red fireball — bright yellow-white core, swirling red-orange flame mantle, smoke wisps trailing behind, embers shooting off the edges, hottest at centre coolest at edges.

**iceSpike** · *Ice Spike* — `Sprites/vfx/iceSpike.webp`
> Vertical crystalline ice spike — pale cyan-blue jagged crystal with white frost mist swirling at the base, sharp facets catching a hot white rim-light, frozen-air shimmer above the tip.

**blink** · *Dimensional Warp* (v0.25.516 — was "Blink") — `Sprites/vfx/blink.webp`
> Horizontal rift through reality — long elliptical fracture in space drawn as a deep indigo-black tear with electric violet-and-cyan lightning forking along its inner edge, cracked-glass refractions, prism shards splintering off both endpoints. Two ghost-silhouettes of the caster bookend the rift (departure on the left as a fading violet afterimage, arrival on the right as a crisp cyan rim-lit pose) with a corridor of arcane motes connecting them, suggesting the path was just phased through. Saturated cosmic palette: deep indigo + electric violet + hot cyan + a single hot-magenta lens-flare at the rift's centre. Reads as both a teleport AND an AoE — the sweep zone is implied by the corridor between the two silhouettes.

**arcaneBurst** · *Arcane Burst* — `Sprites/vfx/arcaneBurst.webp`
> Massive radial AoE — concentric rings of pale violet and electric-blue energy expanding outward from a bright white core, runes floating in the inner ring, hexagonal mana shapes arrayed around the perimeter.

**meteor** · *Meteor* (Archmage Q) — `Sprites/vfx/meteor.webp`
> Burning meteor crashing diagonally — large rocky chunk wreathed in orange-red flame, comet-tail of smoke and embers behind, ground impact crater glowing hot magma at the bottom of canvas.

**elemental** · *Elemental Convergence* (Archmage C) — `Sprites/vfx/elemental.webp`
> Three elements converging on a centre point — fire (orange-red) on the left, ice (cyan-blue) on the right, lightning (yellow-white) on top, all arcing inward with chain-energy lines into a prismatic star-burst at the centre.

**soulSiphon** · *Soul Siphon* (Warlock Q) — `Sprites/vfx/soulSiphon.webp`
> Spectral skull silhouette with three streams of pale-green soul energy flowing from outside the canvas into its mouth, wispy ghostly tendrils, eerie sickly-green glow.

**darkPulse** · *Dark Pulse* (Warlock C) — `Sprites/vfx/darkPulse.webp`
> Black-violet AoE pulse — concentric rings of dark-purple void energy expanding outward, ghostly skull faces emerging from the rings, blood-red lifesteal arcs flowing back toward the centre.

**holyLight** · *Holy Light* (Priest F) — `Sprites/vfx/holyLight.webp`
> Vertical pillar of warm cream-and-honey light bursting upward from canvas centre — golden eight-pointed star at the apex, drifting starlet motes scattered through a wide soft halo, peripheral shimmer of pale-amber sparks at the rim. Reads as both a heal and a small AoE chip-burst.

**celestialAurora** · *Celestial Aurora* (Priest V) — `Sprites/vfx/celestialAurora.webp`
> Wide horizontal sanctified field — long flat cream-gold rectangle with eight-pointed star pulsing in the centre, gold rim-line top and bottom, drifting starlet shimmer scattered evenly through the rect, faint translucent feather-wisp at the corners suggesting cleanse. Palette: ivory, honey-gold, periwinkle accents.

**sage_meteorshower** · *Meteor Shower* (Sage master) — `Sprites/vfx/sage_meteorshower.webp`
> Five meteors raining diagonally across canvas — each wreathed in bright orange-yellow flame with smoke trails, ground impact crater glow at bottom-right, embers floating across canvas.

**elementalist_cascade** · *Prismatic Cascade* (Elementalist master) — `Sprites/vfx/elementalist_cascade.webp`
> Four-element vertical cascade — fire (top) cascading into ice (upper-mid) into lightning (lower-mid) into nature green (bottom), each element seamlessly blending into the next, prismatic energy bridging them.

**lich_harvest** · *Soul Vortex* (Lich master) — `Sprites/vfx/lich_harvest.webp`
> Large swirling dark-violet vortex in the centre — black-purple spiral pulling spectral souls inward, ghostly skull silhouettes spiralling toward the singularity, sickly-green life-drain energy radiating outward.

**hexmaster_grandhex** · *Grand Hex* (Hexmaster master) — `Sprites/vfx/hexmaster_grandhex.webp`
> Glowing purple hexagram sigil with five intricate runes at its points — frost mist clinging to the sigil edges, green poison droplets dripping from the runes, central purple eye watching from the hex.

**archbishop_grail** · *Judgment of the Holy Grail* (Arch Bishop master) — `Sprites/vfx/archbishop_grail.webp`
> Ornate filigreed chalice planted at canvas centre, wreathed in seven downward-pointing pillars of pure golden-white light arranged in a perfect halo around it. Each pillar tapers from a wide flared top to a needle-sharp base, alive with cascading light-particles. Spectral translucent wings of pure golden geometry stretch out behind the chalice. Background ringed with seven larger floating starlets matching the pillars. Palette: ivory, honey-gold, warm amber, with a single crimson rim-glint inside the cup for solemn weight.

## 🟧 Archer (5 basic + 2 sniper + 2 ranger + 4 master)

**arrowShot** · *Arrow Shot* — `Sprites/vfx/arrowShot.webp`
> Single sleek arrow in flight — wood-grain shaft, white-feather fletching, polished steel tip with thin green-gold motion-trail ribbon behind. Horizontal orientation, hot-edge highlight.

**multiShot** · *Multi Shot* — `Sprites/vfx/multiShot.webp`
> Three arrows in horizontal fan spread — same arrow design as arrowShot, each with a green-yellow trail, slight radial arc, leading arrow tipped with a bright spark.

**chargedShot** · *Charged Shot* — `Sprites/vfx/chargedShot.webp`
> Massive piercing arrow charged with crackling yellow-white lightning — oversized shaft, bright glowing electric tip, lightning bolts arcing along the shaft, motion trail of pure electric energy.

**evadeRoll** · *Evade Burst* — `Sprites/vfx/evadeRoll.webp`
> Cute back-flip explosive blast — small puff cloud burst with gust of leaf-green wind petals fanning outward, two tiny floating arrows at the edges hinting at the follow-up shot, knockback shock-ring at the base.

**eagleEye** · *Eagle Eye* — `Sprites/vfx/eagleEye.webp`
> Glowing golden-amber eye sigil with a stylised eagle silhouette overlaid — sharp predatory pupil, crosshair reticle behind the eye, accuracy beams radiating in cardinal directions.

**snipe_railgun** · *Railshot* (Sniper Q) — `Sprites/vfx/snipe_railgun.webp`
> Horizontal piercing rail beam — thick electric-blue laser line across canvas with crackling lightning arcs branching outward, arrow-shaped energy projectile leading the line, comet tail of bright cyan light behind.

**arrowRain** · *Arrow Rain* (Sniper C) — `Sprites/vfx/arrowRain.webp`
> Dense barrage of arrows raining down at 60° from upper-left — 12-15 arrows in formation with green-yellow motion trails, dust cloud accumulating at the bottom of canvas.

**wildBond** · *Wild Bond* (Ranger Q) — `Sprites/vfx/wildBond.webp`
> Spectral grey wolf silhouette emerging from a swirl of green nature energy — full-body wolf in a leaping pose, leaves and pine needles drifting around it, ethereal forest-spirit aura. Larger / chunkier than v0.25.488 — match the v0.25.514 buffed wolf size.

**elementalArrows** · *Elemental Arrows* (Ranger C) — `Sprites/vfx/elementalArrows.webp`
> Rainbow barrage of magic arrows — six arrows in a fan, each glowing a different element colour (red fire, blue ice, yellow lightning, green nature, white light, purple dark), all radiating outward from canvas centre.

**marksman_oneshot** · *One Shot One Kill* (Marksman master) — `Sprites/vfx/marksman_oneshot.webp`
> Single oversized golden arrow drawn at full bow tension at the right edge — body crackling with white-gold piercing energy, long horizontal aim-line beam stretching across canvas, crosshair reticle at the left edge.

**ballista_volley** · *Siege Volley* (Ballista master) — `Sprites/vfx/ballista_volley.webp`
> Horizontal stream of piercing arrows — dense rapid-fire 8-arrow stream with chain-link motion trails between them, leading arrow tipped with a heavy bronze ballista bolt, smoke wisps trailing the stream.

**beastmaster_pack** · *Call of the Wild* (Beastmaster master) — `Sprites/vfx/beastmaster_pack.webp`
> Four oversized grey-and-white wolves running in tight pack formation (was 3 — bumped to match the v0.25.514 cap) — spectral nature-energy aura around them, fierce determination, pine forest hint in the background dissolving into transparency.

**skyhunter_gale** · *Gale Storm* (Skyhunter master) — `Sprites/vfx/skyhunter_gale.webp`
> Ten homing arrows with cyan-white wind-trail ribbons spiralling through canvas — each arrow following a curved path with a wind slip-stream behind it, central wind vortex at canvas centre, all arrows converging outward.

1. Generate the sprite via Ludo.ai with the master style line (monsters/bosses) **or** the master VFX prefix (skill icons) plus the per-entry prompt above.
2. Run through `remove.bg` if the background isn't already transparent.
3. Save as the listed filename exactly — for skill VFX use the skill key from the heading (e.g. `slash.webp`, `meteor.webp`, `warlord_warcry.webp`). `.webp` quality 90+.
4. Drop into the listed folder (`Sprites/monsters/`, `Sprites/bosses/`, `Sprites/bosses/attack/`, or `Sprites/vfx/`).
5. Optionally archive the unprocessed render alongside as `{name}_raw.webp` (matches the existing convention).
6. Reload the game — `_loadMonsterSprites()` / `_loadBossSprites()` run at boot and swap procedural → painted automatically. Skill VFX swap in lazily on first cast. No code changes required for any of these now that v0.25.488 registered the four octobaby tentacle paths.

# v0.26.503 — Sundered Smith forge-hammer projectile

The Sundered Smith's boomerang hammer (`skill: 'forgeHammer'`) was the one
projectile of his without authored art — it rendered the procedural ember
ellipse. The code is now wired for a dedicated sprite; generate it in Ludo.ai
with the prompt below and drop the file in.

| Projectile | Filename | Used by |
| --- | --- | --- |
| forgeHammer | `Sprites/projectiles/p_forgehammer.png` | Sundered Smith — Hammer Wheel (4-hammer boomerang fan) |

**Ludo.ai prompt** (per user spec — **3 px black outline**):

> Top-down game projectile sprite of a heavy molten forge war-hammer, single object centred on a fully transparent background, 512×512 square canvas. A short-handled blacksmith's sledgehammer with a chunky rectangular dark-iron head, the striking faces glowing white-hot orange with cracks of molten lava-light, a stubby charred wooden haft wrapped in scorched leather, faint ember sparks and a thin heat-shimmer trailing off the head. Clean cel-shaded illustrative style with a **bold uniform 3-pixel black outline (`#0a0612`)** around the entire silhouette, crisp rim-light on the hot edges, saturated forge palette (deep iron grey, molten orange-gold `#ffaa44`, white-hot core). Composed at a slight 3/4 spin angle so it reads as a thrown, tumbling hammer; effect occupies ~75% of the canvas; clearly readable at 64×64. No text, no watermark, no UI, no background, no ground shadow.

**Steps:** generate → `remove.bg` if needed → save **exactly** as
`Sprites/projectiles/p_forgehammer.png` (PNG; this loader has **no** webp↔png
fallback, so the extension must be `.png`) → reload. `LX_MOB_PROJ` /
`_PROJ_SPRITE_BLIT` already carry the `forgeHammer` entry (`mode:'spin'`), so
the hammer swaps from the procedural ember to the painted sprite automatically
once the file exists. No code changes needed.

# Tweaks to know

- **If a sprite reads too tall or short next to the others**, look at `MONSTER_SPRITE_META` / `NPC_SPRITE_HEIGHTS` for size overrides (default monster render height is `m.h × 1.5`).
- **If a sprite is mis-anchored at the feet**, the loader's `_detectSpriteBboxBottom` finds the lowest opaque pixel automatically — but artwork with shadow / glow extending below the body confuses it. Crop tighter around the feet before exporting.
- **Outline thickness:** the existing fish + boss procedural draws use exactly 2 px black (`#0a0612`). Match this in Ludo prompts so the new art doesn't clash with the procedural fallback that will keep being used until every file is dropped in.
- **Octobaby tentacles:** all 4 leg types (`octoLegPoison/Freeze/SkillLock/Stun`) now load from `Sprites/monsters/`. The procedural bezier tentacle keeps drawing until each `.webp` lands; once present, the painted sprite renders with the standard foot-anchored draw (note: legs are floating mobs, the renderer lifts them slightly off the ground line).
- **Skill VFX vs procedural:** the procedural class-skill VFX in `_drawVectorHero` and the projectile system stay live forever — generated `Sprites/vfx/*.webp` are an *addition* layered on top, not a replacement. Skip any skill whose procedural look you're already happy with.

---

# v0.26.517 — Queen Shroomaloo boss spore (`spore`)

Audit of the four playful-tyrant bosses' projectiles found three already have unique authored art (**King Gloopaloo** → `goo`, **Octobaby** → `bubble`/`pincer`/`splash`, all 9-frame animated; **King Koopaloo** → `firebomb`/`m_firebomb.webp`, velocity-rotated). The lone gap was **Queen Shroomaloo**, whose `spore` projectile had *no* sprite — it fired the procedural fallback, and is deliberately DISTINCT from the common Shroom mob's orange `mspore`.

The engine is already wired (`LX_MOB_PROJ.spore` → `p_spore.png`, `_PROJ_SPRITE_BLIT.spore` `{mode:'spin', size:1.4}`, and `spore` added to `_PROJ_ANIM_KEYS`). It renders the procedural spore until the files below land, then swaps automatically — no code changes needed.

| Asset | Path |
| --- | --- |
| Base sprite | `Sprites/projectiles/p_spore.png` (true PNG — no webp fallback for this loader) |
| Animation | `Sprites/projectiles/anim/spore_0.webp` … `spore_8.webp` (9-frame loop) |

**Generate (needs `LUDO_API_KEY`):**

```bash
# 1) base sprite
node tools/gen_zodiac_proj.mjs --only spore --generate
# 2) 9-frame VFX loop (reads the base, slices the spritesheet)
node scripts/generate_boss_projectile_anim.mjs --only spore --generate
```

**Prompt (Ludo `/assets/image`, sprite-vfx, Cel-Shaded, 1:1):**

> A toxic boss spore-pod projectile (Queen Shroomaloo, the Cradle-Veiled) — a plump rounded magenta-and-pink fungal spore sac with a soft veined translucent membrane, a darker crimson crown of tiny cap-frills on top, a sickly-pink toxic inner glow and a few drifting spore motes puffing off it, roughly round and bloated. *(+ the master outline line: bold uniform 2–3 px black outline `#0a0612`, transparent background, centred, readable at 64×64.)*

**Motion (anim frames):** membrane gently pulses/breathes, pink spore motes puff and drift, toxic inner glow throbs — effect-only, no rotate/translate (the engine's `spin` blit handles tumble).

---

# v0.26.518 — King Koopaloo firebomb animation (`firebomb`)

Koopa's `firebomb` already had a unique authored sprite (`m_firebomb.webp`, velocity-rotated), but — unlike Gloopaloo's `goo` and Octobaby's `bubble`/`pincer`/`splash` — it was a single static image, not a 9-frame loop. Now wired to animate: the render branch uses `_projAnimFrame('firebomb')` when present, and `firebomb` is in `_PROJ_ANIM_KEYS`. The **base already exists**, so only the animation step is needed.

| Asset | Path | Status |
| --- | --- | --- |
| Base sprite | `Sprites/projectiles/m_firebomb.webp` | already present ✓ |
| Animation | `Sprites/projectiles/anim/firebomb_0.webp` … `firebomb_8.webp` | generate below |

**Generate (needs `LUDO_API_KEY`):**

```bash
node scripts/generate_boss_projectile_anim.mjs --only firebomb --generate
```

Until the frames land it keeps rendering the static (rotating) `m_firebomb.webp` — no visual regression. Motion is effect-only (flame pulse/flicker, embers shed); the engine still applies the tumble spin.

---

# v0.26.x — Lv-50 B-ult dedicated projectile sprites (`p_ult_<master>.png`)

Each Lv-50 master ultimate that fires a projectile previously **borrowed** a generic skill sprite (War of Banners → `shockwave`, the rogue/dragoon ults → Aetherion's `shard`, Elementalist → Aetherion's `voidbeam`, etc.). The engine now tags each ult projectile with a `bspr` key and draws a dedicated sprite (oriented to velocity, with the borrowed sprite as the automatic fallback until the file exists).

| `bspr` key | File | Ult |
| --- | --- | --- |
| bult_warlord | `Sprites/projectiles/p_ult_warlord.png` | War of Banners (banner shockwave) |
| bult_doombringer | `p_ult_doombringer.png` | Calamity Incarnate (blade-wave) |
| bult_dragoon | `p_ult_dragoon.png` | Skyfall Dominion (dragon-lance) |
| bult_nightreaper | `p_ult_nightreaper.png` | Bloodmoon Domain (blood scythe) |
| bult_phantom | `p_ult_phantom.png` | Voidwalk (void shuriken) |
| bult_sage | `p_ult_sage.png` | Meteor Sigil (meteor) |
| bult_elementalist | `p_ult_elementalist.png` | Elemental Apotheosis (convergence beam) |
| bult_marksman | `p_ult_marksman.png` | Deadeye Protocol (crit round) |
| bult_ballista | `p_ult_ballista.png` | War Machine (siege bolt) |

**Generate (needs `LUDO_API_KEY`):**

```bash
node tools/gen_bult_proj.mjs              # dry-run — prints prompts
node tools/gen_bult_proj.mjs --generate   # mint all (skip-existing)
```

The generator authors the art facing **right** (the engine mirrors horizontal shots and orients angled ones — lances/shards rotate to velocity, beams stay upright). Filenames are `p_ult_<master>.png` to match `LX_BULT_PROJ` in `mojiworld_game.html`. The generator also lists a `ult_skyhunter` storm-arrow; Skyhunter's ult summons an eagle (no direct ult projectile) so the engine doesn't wire it — that sprite is optional/unused.
