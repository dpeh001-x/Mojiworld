# Skill VFX sprite prompts — copy-paste prompt library (v0.25.453)

Ready-to-use Ludo.ai / Midjourney / Stable Diffusion prompts for every
skill VFX in the game. Same workflow as `EQUIPMENT_PROMPTS.md`: paste
the **locked prefix** verbatim every time so all 60 skills land on a
consistent transparent-PNG sprite spec, then add the **per-skill
block** that defines the palette + motif.

> **Recommended Ludo.ai settings**
> - `image_type`: `sprite`
> - `art_style`: `Anime/Manga`
> - `aspect_ratio`: `ar_1_1` (square)
> - `n`: 1
> - Output lands at 768×768 PNG with transparent background.
>
> **Recommended Midjourney/SD prompt suffix**
> - Append `--no background, --transparent, --ar 1:1` (Midjourney v6+)
> - Or for SDXL: `transparent background, isolated on alpha, no scene, no environment, sprite asset`

---

## [A] LOCKED PREFIX — paste verbatim every time

> Chibi anime spell-effect / weapon-strike VFX sprite for a 2D
> platformer game in the Mojiworld aesthetic. Pure transparent
> background — alpha channel only, no scene, no character, no
> environment, no text. Drawn on a 768×768 square canvas. Soft
> painterly cel-shaded anime style with bold black outlines, vibrant
> saturated colors, additive glow accents. Render ONLY the spell
> effect itself — no caster, no target, no ground. Strong center
> composition; effect occupies ~70 % of the canvas with breathing room
> at the edges. The effect should read clearly at 1/4 size when scaled
> down for in-game use.

---

## [B] PER-SKILL BLOCKS

Append the matching block below to the locked prefix. The skill name +
class are noted before each block for easy lookup.

---

### 🟦 WARRIOR — base kit (5 skills)

**slash** · *Slash* · D-slot
> A heavy curved sword slash arc — bold silver blade trail in a
> 270-degree sweep, leaving a soft white-to-blue motion blur ribbon
> behind it. Sparks of cyan light fly off the trail. Clean diagonal
> arc, top-left to bottom-right.

**powerStrike** · *Power Strike* · S-slot
> Three vertically-stacked sword cleaves — high, mid, low — drawn as
> three parallel curved white-gold blade arcs with golden energy
> ribbons trailing behind each. Soft yellow glow accents. Final arc
> has a small starburst stun ring at the impact point.

**groundSlam** · *Ground Slam* · A-slot
> A circular shockwave radiating outward from the centre — concentric
> orange-red rings of cracked ground energy with bursts of golden
> sparks and chunks of dust kicked up. Top-down perspective, like a
> seismic slam shockwave.

**rush** · *Rush* · E-slot
> A horizontal motion blur trail in warm amber and white — speedlines
> radiating left-to-right with a leading edge of bright golden energy
> shaped like a piercing arrow tip. Soft heat shimmer accents.

**warCry** · *War Cry* · W-slot
> A radial sound-wave burst from the centre — concentric red and gold
> rings expanding outward, with a faint roaring lion silhouette in
> the middle. Bold red outlines, fierce energy.

---

### 🟦 WARRIOR — Berserker job (2 skills)

**bloodlust** · *Bloodlust* · Q-slot
> A dripping crimson aura with rising blood-red flames at the bottom
> and floating droplets of dark red energy. Centre has a glowing red
> heart silhouette pulsing with rage energy. Blood splatter accents
> at the edges.

**rampage** · *Rampage* · C-slot · ULTIMATE
> A spinning crimson tornado of swords — multiple silver blade
> silhouettes whirling in a vortex, with red-orange flame wisps
> trailing each blade. Tornado tapers from wide top to sharper
> bottom. Dramatic cinematic energy.

---

### 🟦 WARRIOR — Knight job (2 skills)

**guardian** · *Guardian* · Q-slot
> A glowing translucent blue-white shield bubble dome — hexagonal
> energy lattice pattern, soft pulsing light at the apex, golden
> filigree edge. Centre has a faint cross or star sigil.

**holyShield** · *Holy Shield* · C-slot · ULTIMATE
> A radiant golden cross enclosed in a circular halo of white-gold
> light — concentric rings of holy energy, four directional light
> beams extending outward like a star burst, soft warm glow palette
> (gold, ivory, soft blue accents).

---

### 🟪 ROGUE — base kit (5 skills)

**stab** · *Stab* · D-slot
> A single quick dagger thrust — sharp horizontal slash of violet
> light with a needle-thin blade silhouette piercing through a soft
> purple smoke trail. Speed lines emphasize the thrust direction.

**backstab** · *Backstab* · S-slot
> Three diagonal dagger slashes overlapping — violet and dark purple
> blade arcs with crimson blood-mist trails, each slash slightly
> rotated. A glowing purple eye sigil sits behind the slashes.

**throwDagger** · *Throw Dagger* · A-slot
> Five fan-spread daggers radiating outward — silver blades with
> violet motion-trail ribbons, arrayed in a 60-degree fan, each blade
> tipped with a small purple spark.

**smokeDash** · *Smoke Dash* · E-slot
> A horizontal smoke corridor — three streaks of swirling violet-grey
> smoke with subtle dagger silhouettes embedded in the smoke. Trails
> from left to right with wispy edges.

**flurry** · *Flurry* · W-slot
> A rapid blink-warp slash combo — multiple violet afterimages of a
> dagger arc stacked along a horizontal line, each fading from bright
> magenta at the front to deep purple at the back. Looks like a
> shutter-stutter strike.

---

### 🟪 ROGUE — Ninja job (2 skills)

**shadowStrike** · *Shadow Strike* · Q-slot
> A flash of dark violet energy with a kunai silhouette piercing a
> small black-violet vortex — small swirling shadow tendrils, sharp
> cyan/magenta highlights on the blade. Critical-hit starburst
> behind.

**deathBlossom** · *Death Blossom* · C-slot · ULTIMATE
> A pink-magenta cherry-blossom petal storm — five glowing daggers
> radiate outward from a central rose-pink burst, with sakura petals
> trailing each blade. Soft elegant cherry-blossom palette mixed with
> dark violet shadow accents.

---

### 🟪 ROGUE — Assassin job (2 skills)

**smokeBomb** · *Smoke Bomb* · Q-slot
> A dense cloud of pale lavender-grey smoke — billowing organic shape
> with embedded sparkles and a faint healing-green inner glow at the
> centre. Soft puffy edges, slightly cartoonish.

**sleight** · *Voidrift Blink* · C-slot · ULTIMATE
> A horizontal void rift — a tear in space drawn as a deep
> indigo-black diamond crack with violet lightning arcs along its
> edges, three afterimage silhouettes of a hooded figure radiating
> outward, magenta phantom light bleeding through.

---

### 🟦 MAGE — base kit (5 skills)

**magicBolt** · *Magic Bolt* · D-slot
> A small sparkling arcane projectile — soft white-blue glowing orb
> with crystalline shards swirling around it, leaving a short trail
> of magic motes behind. Feels light and zippy.

**fireball** · *Fireball* · S-slot
> A dense orange-red fireball — bright yellow-white core, swirling
> red-orange flame mantle, smoke wisps trailing behind, embers
> shooting off the edges. Center hottest, edges coolest.

**iceSpike** · *Ice Spike* · A-slot
> A vertical crystalline ice spike — pale cyan-blue jagged crystal
> with white frost mist swirling around its base, sharp facets
> catching light, frozen-air shimmer above the tip.

**blink** · *Blink* · E-slot
> A short teleport flash — two parallel vertical streaks of
> cyan-violet light with a starburst at the destination point. Sharp
> crystalline glints, trail dissipating into magic motes.

**arcaneBurst** · *Arcane Burst* · W-slot
> A massive radial AoE explosion — concentric rings of pale violet
> and electric-blue energy expanding outward from a bright white
> core, runes floating in the inner ring, hexagonal mana shapes
> arrayed around the perimeter.

---

### 🟦 MAGE — Archmage job (2 skills)

**meteor** · *Meteor* · Q-slot
> A burning meteor crashing diagonally — large rocky chunk wreathed
> in orange-red flame, comet-tail of smoke and embers behind it,
> ground impact crater glowing at the bottom of the canvas.

**elemental** · *Elemental Convergence* · C-slot · ULTIMATE
> Three elements converging at a centre point — fire (orange-red) on
> the left, ice (cyan-blue) on the right, lightning (yellow-white) on
> top, all arcing inward with chain-energy lines into a prismatic
> star burst at the centre.

---

### 🟦 MAGE — Warlock job (2 skills)

**soulSiphon** · *Soul Siphon* · Q-slot
> A spectral skull silhouette with three streams of pale green soul
> energy flowing from outside the canvas into its mouth — wispy
> ghostly tendrils, subtle bone outlines, eerie green glow.

**darkPulse** · *Dark Pulse* · C-slot · ULTIMATE
> A black-violet AoE pulse — concentric rings of dark purple void
> energy expanding outward, ghostly skull faces emerging from the
> rings, blood-red lifesteal arcs flowing back toward the centre.

---

### 🟧 ARCHER — base kit (5 skills)

**arrowShot** · *Arrow Shot* · D-slot
> A single sleek arrow in flight — wood-grain shaft, white-feather
> fletching, polished steel tip with a thin green-gold motion trail
> ribbon behind it. Horizontal orientation.

**multiShot** · *Multi Shot* · S-slot
> Three arrows in a horizontal fan spread — same arrow design as
> arrowShot, each with a green-yellow trail, arranged in a slight
> radial arc.

**chargedShot** · *Charged Shot* · A-slot
> A massive piercing arrow charged with crackling yellow-white
> lightning — oversized shaft, bright glowing electric tip, lightning
> bolts arcing along the shaft, motion-trail of pure electric energy.

**evadeRoll** · *Evade Burst* · E-slot
> A cute back-flip explosive blast — a small puff cloud burst with a
> gust of leaf-green wind petals fanning outward, two tiny floating
> arrows at the edges hinting at the follow-up shots, knockback shock
> ring at the base.

**eagleEye** · *Eagle Eye* · W-slot
> A glowing golden-amber eye sigil with a stylised eagle silhouette
> overlaid — sharp predatory pupil, crosshair reticle behind the eye,
> radiating accuracy beams in cardinal directions.

---

### 🟧 ARCHER — Sniper job (2 skills)

**snipe_railgun** · *Railshot* · Q-slot
> A horizontal piercing rail beam — thick electric-blue laser line
> across the canvas with crackling lightning arcs branching outward,
> arrow-shaped energy projectile leading the line, comet tail of
> bright cyan light behind.

**arrowRain** · *Arrow Rain* · C-slot · ULTIMATE
> A dense barrage of arrows raining down at a 60-degree angle from
> the upper-left — 12-15 arrows in formation with green-yellow motion
> trails, dust cloud accumulating at the bottom of the canvas.

---

### 🟧 ARCHER — Ranger job (2 skills)

**wildBond** · *Wild Bond* · Q-slot
> A spectral grey wolf silhouette emerging from a swirl of green
> nature energy — full-body wolf in a leaping pose, leaves and pine
> needles drifting around it, ethereal forest-spirit aura.

**elementalArrows** · *Elemental Arrows* · C-slot · ULTIMATE
> A rainbow barrage of magic arrows — six arrows arranged in a fan,
> each glowing a different element color (red fire, blue ice, yellow
> lightning, green nature, white light, purple dark), all converging
> outward from the centre of the canvas.

---

### ⭐ MASTER SIGNATURES

#### Warrior path (4 skills)

**warlord_warcry** · *Warlord's Banner*
> A planted military banner billowing in the wind — crimson banner
> with gold trim, planted on a dark-iron pole, golden warlord-buff
> aura radiating outward in concentric rings, faint roaring crowd
> shadows behind.

**doombringer_apoc** · *Blade of Calamity*
> A colossal black-iron greatsword embedded vertically in the canvas
> — runes glowing crimson along the blade, dark crimson energy
> billowing off the edges, ten phantom slash arcs radiating forward
> from the blade tip.

**crusader_aegis** · *Divine Aegis*
> Five hovering golden-white holy orbs arranged in a pentagon — each
> orb has a small cross sigil and trailing halo, central healing
> radiance pulsing outward, soft warm gold-and-white palette.

**dragoon_skylance** · *Sky Lance*
> A massive blue-steel lance plunging downward from the top of the
> canvas — leading edge wreathed in cyan-white piercing energy,
> draconic spirit silhouette wrapping the lance shaft, ground impact
> crater splitting open at the bottom.

#### Rogue path (4 skills)

**shadowlord_clones** · *Mirror Shadow*
> Three levitating dark-violet ninja silhouettes flanking the centre
> — each clone drawn in monochrome shadow-purple, white eye-glow
> only, circular AoE-strike telegraph rings under each clone, faint
> levitation glow at their feet.

**shinobi_seal** · *Kage Rush*
> A horizontal violet zip-streak slashing across the canvas —
> multiple kanji seal-paper silhouettes embedded along the streak,
> rapid-succession dagger strikes layered along the path, kunai
> embedded at the leading edge.

**nightreaper_mark** · *Eclipse Massacre*
> A blood-red eclipse — a black sun with crimson corona at the top,
> ten spectral daggers raining down from the eclipse, dark spiral
> aftershock nova crackling at the centre, blood-mist haze in the
> background.

**phantom_cut** · *Voidrift Execution*
> A dark phantom silhouette mid-execution — phasing through chained
> teleport afterimages, six floating death-mark sigils on enemies
> implied at the edges, final shadow-nova starburst at the centre.

#### Mage path (4 skills)

**sage_meteorshower** · *Meteor Shower*
> Five meteors raining diagonally across the canvas — each wreathed
> in bright orange-yellow flame with smoke trails, ground impact
> crater glow at the bottom-right, embers floating across the canvas.

**elementalist_cascade** · *Prismatic Cascade*
> A four-element vertical cascade — fire (top) cascading into ice
> (upper-mid) into lightning (lower-mid) into nature green (bottom),
> each element seamlessly blending into the next, prismatic energy
> bridging them.

**lich_harvest** · *Soul Vortex*
> A large swirling dark-violet vortex in the centre — black-purple
> spiral pulling spectral souls inward, ghostly skull silhouettes
> spiralling toward the singularity, sickly green life-drain energy
> radiating outward.

**hexmaster_grandhex** · *Grand Hex*
> A glowing purple hexagram sigil with five intricate runes at its
> points — frost mist clinging to the sigil edges, green poison
> droplets dripping from the runes, central purple eye watching from
> the hex.

#### Archer path (4 skills)

**marksman_oneshot** · *One Shot One Kill*
> A single oversized golden arrow drawn at full bow tension at the
> right edge — the arrow body crackling with white-gold piercing
> energy, a long horizontal aim-line beam stretching across the
> canvas, crosshair reticle at the left edge.

**ballista_volley** · *Siege Volley*
> A horizontal stream of piercing arrows — dense rapid-fire 8-arrow
> stream with chain-link motion trails between them, leading arrow
> tipped with a heavy bronze ballista bolt, smoke wisps trailing the
> stream.

**beastmaster_pack** · *Call of the Wild*
> Three grey-and-white wolves running in a tight pack formation —
> spectral nature-energy aura around them, fierce determination, pine
> forest hint in the background dissolving into transparency.

**skyhunter_gale** · *Gale Storm*
> Ten homing arrows with cyan-white wind-trail ribbons spiralling
> through the canvas — each arrow following a curved path with wind
> slip-stream behind it, central wind vortex at the canvas centre,
> all arrows converging outward.

---

## Workflow notes

1. **Pick a skill** from the list above.
2. **Paste** the locked prefix (`[A]`) followed by the matching skill
   block (`[B]`) into your AI image tool.
3. **Generate at 768×768** with transparent background. Re-roll until
   you get a clean centred composition.
4. **Save** to `Sprites/vfx/<skillKey>.webp` (or `.png`). Use the same
   key as the SKILLS object id (e.g. `slash.webp`, `meteor.webp`,
   `warlord_warcry.webp`).
5. **Wire into the game** via the existing FX_SHEETS / VFX registry
   pattern — see `LX_SUMMON` / `MONSTER_SPRITES` / `BOSS_SPRITES`
   loaders for the eager-load pattern, or load lazily on first cast.

If a skill already has procedural / cel-shaded VFX in `_drawVectorHero`
or the projectile system that you're happy with, you can skip its
sprite — generated VFX are an *addition* to the existing procedural
look, not a replacement.

---

## Compatibility with existing assets

Existing VFX sprites in `Sprites/vfx/` include `fireball.png`,
`ice_spike.png`, `magic_bolt.png`, `meteor.png`, `slash.png`,
`portal.png`, `death.png`, `level_up.png`, `frost_beam.webp`,
`gravity_well.webp`. New sprites generated via this guide should match
their stylistic intent — soft cel-shaded anime, transparent
background, centre composition — so the addition feels like one
coherent set.
