# 🎨 Gemini / Nano-Banana Sprite Catalog — LevelX Shardfall

**Standardized so every sprite comes out identical in dimensions, background, and style.**

---

## 📏 HARD STANDARDS (every prompt bakes these in)

| Spec | Value |
|---|---|
| **Output resolution** | **1024 × 1024 PNG** |
| **Background** | **Solid pure white `#FFFFFF`** — zero gradients, zero shadows under sprite, zero environmental elements |
| **Pixel mode** | 16-bit SNES pixel art, nearest-neighbor look, crisp pixel boundaries, NO anti-aliased blur, NO painterly strokes |
| **Palette** | 48-color limited palette, hand-dithered gradients, cel-shaded 3-tone banding per material |
| **Outlines** | Bold 1-pixel dark outline on the entire external silhouette |
| **Lighting** | Warm key light from upper-left, cool shadow lower-right, subtle rim light |
| **Sprite placement** | Subject **centered**, occupies ~60–70% of canvas width. Feet rest on implicit baseline at 85% y |
| **View angle** | 3/4 front-facing, slight turn toward the right (character "faces right") |
| **Content ban** | NO text, labels, watermarks, signatures, borders, frames, UI elements, ground shadow plate, or environmental props |

### Style anchor (reference games)
> Match the fidelity of **Seiken Densetsu 3 (Trials of Mana)**, **Chrono Trigger**, **Octopath Traveler HD-2D**, and **Odin Sphere**. Noticeably higher detail than classic Mojiworld — richer palette, more anatomical shading, more expressive faces.

---

## 🧩 MASTER HEADER (prepend to every prompt below)

Paste this as the first paragraph of every prompt:

```
Generate a 1024x1024 PNG sprite on a solid pure white #FFFFFF background.
16-bit SNES pixel art style matching Seiken Densetsu 3, Chrono Trigger,
and Octopath Traveler HD-2D fidelity. 48-color palette, hand-dithered
gradients, cel-shaded 3-tone banding, bold 1-pixel dark outline on the
external silhouette, crisp pixel boundaries with no anti-aliasing blur.
Warm key light from upper-left, cool shadow lower-right. Subject centered
in the canvas, occupying roughly 65% of frame width, feet resting at 85% y.
No text, no watermark, no frame, no ground shadow, no environmental props.
```

---

# 🗡️ SECTION 1 — PLAYER CLASSES (8 sprites: 4 classes × 2 genders)

> **Fixed sprite geometry for every class.** Each sprite must follow these numbers exactly so the game can swap between them without realigning anything:
>
> - Canvas: **1024 × 1024 PNG**, solid white background
> - Character body occupies an implicit **48 × 64 cell** inside the canvas (body box)
> - Cell center is at canvas center-x, cell bottom is at **85 % y** (feet-line)
> - Hair, weapon, cape may overflow the cell upward / outward — up to ~80 % of canvas
> - Head center: ~8 % of canvas below the top of the cell → at roughly 52 % y
> - Hands: at roughly 68 % y
> - Feet: at roughly 85 % y (planted on implicit baseline)
>
> Keep all 8 sprites aligned to this skeleton so you can drop them into `sprites/player/<class>_<gender>.png` and the game will render them identically.
>
> **Gender rules** (keep these consistent across every class):
> - **Male**: short spiky anime hair, broader shoulders, slightly squared jaw
> - **Female**: longer hair with bangs and side strands down past the shoulder, one small braid on the strong-hand side, narrower shoulders, softer jaw, rose-pink cheek blush
> - Both genders share identical armor/weapon silhouettes, color palette, and pose

## 1.1 Warrior — Male
```
[MASTER HEADER]

Subject: a young heroic human warrior, standing 3/4 front-facing right in a
confident contrapposto idle pose, weight on back leg, hand loosely gripping
sword at side.

Armor: lustrous crimson plate cuirass with embossed gold cross emblem on chest,
pointed shoulder pauldrons with small crest peaks, studded dark leather belt
with ornate gold buckle, deep navy chausses with polished steel kneecaps,
tall dark leather boots with gold buckles. Subtle scale-mail texture under
the chest plate.

Cape: wine-red flowing cape lined with ink-black silk, gold collar trim,
billowing slightly behind, visible three-tone cloth folds.

Face: warm tan skin with rim-lit cheekbones, auburn anime-spiky hair with
individual strand highlights, thick determined brows, focused hazel eyes
with catchlight reflections, small confident half-smile.

Weapon in right hand: long knight's longsword, mirror silver blade with
central fuller, brass ornate crossguard with leaf motif, leather grip with
gold rings, ruby-inlaid teardrop pommel.
```

## 1.2 Rogue (base)
```
[MASTER HEADER]

Subject: an agile young human rogue assassin, lean predatory stance, low
contrapposto with weight forward, twin daggers held at the sides.

Outfit: form-fitting deep-indigo leather chest harness with silver buckles,
crossed bandoliers with small throwing daggers, fingerless gloves with
metal knuckle studs, black wrapped calf bindings, silent leather climbing
boots. Purple sash at waist with embroidered pattern trailing.

Face: half-hidden by dark violet scarf-mask covering nose and mouth, only
sharp silver eyes and thin brows visible, messy black hair with bangs and
a single purple highlight streak.

Weapons: paired curved shortswords, obsidian blades with faint violet
energy trim, ornate gold crescent-moon guards, leather-bound handles
with tassel. One forward grip, one reverse grip.
```

## 1.3 Mage (base)
```
[MASTER HEADER]

Subject: a slender scholarly mage, elegant 3/4 pose, staff planted on
ground beside them, one hand on hip.

Robes: deep navy-blue wizard robe with silver celestial embroidery of
moons, stars, and constellations running down chest and sleeves. Wide
sleeves gathered at wrist with purple cuffs, high pointed collar, gold
hem trim. Ivory under-tunic peeking at neck. Thin silver chain belt with
hanging crystals.

Hat: tall peaked floppy-brimmed blue wizard hat with silver star buckle,
slight droop at tip, cloth-fold shading.

Face: pale porcelain skin with rosy rim-lit cheeks, bright cyan eyes with
detailed irises and twin sparkle highlights, thin silver brows, calm
focused expression, long snow-white hair falling to shoulders.

Staff: tall ornate wooden staff with spiraled grip, topped with glowing
cyan crystal orb held in gold claw prongs. Tiny arcane runes float
around the orb emitting soft cyan light that rim-lights face and
shoulder.
```

## 1.4 Archer (base)
```
[MASTER HEADER]

Subject: a graceful young forest ranger archer, 3/4 pose, bow held low in
left hand with an arrow ready in the right.

Outfit: hunter-green leather jerkin over cream undershirt, dark brown
trousers tucked into tall laced hunting boots, fingerless shooting
glove on right hand, leather bracer on left forearm with gold-embossed
wolf crest. Forest cloak with hood down resting on shoulders, edges
lightly tattered from travel. White-fletched arrow quiver on back.

Face: sun-tanned skin with light freckles across nose, sharp amber
hawk-like eyes, shoulder-length chestnut hair braided on one side with
a green leather tie, feather tucked in hair.

Weapon: magnificent composite longbow held in left hand, laminated
horn/wood/sinew bands alternating, elaborately carved nocks, gold-wrapped
grip. An arrow with goose-feather fletching and barbed steel head held
ready at the string.
```

---

# 👹 SECTION 2 — MONSTERS (9 sprites)

## 2.1 Shellsnip (small slug)
```
[MASTER HEADER]

Subject: Shellsnip — a fantasy snail creature, 3/4 side view.

Body: velvet-moss-green slug belly with visible muscular segment ridges,
leaving a glistening pearlescent slime trail below on the implicit ground
(the trail can shine with subtle rainbow iridescence). Two long curled
upright eye-stalks each topped with a glossy black eyeball with
prominent white catchlight. Tiny upturned smile with one small fang peek.

Shell: amethyst-purple spiral snail shell with THREE concentric gold-trim
ridges, darker purple shadow on one side, brighter violet highlight on
the other, tiny chips/scratches showing age.

Proportions: the creature is stubby and cute. Shell is about 60% of the
total mass, slug body slightly smaller beneath.
```

## 2.2 Gumbud (jelly slime)
```
[MASTER HEADER]

Subject: Gumbud — a gummi-bear-pink translucent jelly slime, centered.

Body: translucent rounded blob with visible refractive interior where
smaller air bubbles suspend at different depths (visible through the
jelly). Top dome rim-lit in creamy white, bottom pool in deep magenta
shadow. A single hanging droplet dangles from the underside.

Face: two large chibi anime eyes with three-layer iris detail and double
white catchlight reflections. Curled upturned grin with tiny pink tongue
peek.

Shape: slightly squished as if mid-bounce, about 2/3 as tall as wide.
```

## 2.3 Capling (red mushroom)
```
[MASTER HEADER]

Subject: Capling — a friendly scarlet-capped mushroom monster, 3/4 front
view.

Cap: deep scarlet-red with a brighter sunset-orange crown highlight at
the top, darker burgundy shadow near cap edge, five asymmetric chunky
white spots each with their own 2-tone shadow to sell spherical cap
curvature. Visible radial gill lines under the cap.

Body/stem: creamy-ivory stout stem, slightly puffier than classic
Mushroom enemies, little fluffy shoulder-tuft hairs, visible belly
dimple, pink cheek blush on the stem.

Face: big friendly expressive anime eyes with gleaming highlights, thick
happy brows, small smile with one pointed tooth peek. Cute.

Feet: stubby brown rounded hooved feet.
```

## 2.4 Sunback (orange mushroom)
```
[MASTER HEADER]

Subject: Sunback — same family as Capling but a vibrant ORANGE mushroom.

Cap: deep pumpkin-orange base, golden-yellow crown highlight at top,
burnt umber shadow at lower cap edge, THREE BIG cream-colored spots
with shadow-sides. Slightly wobblier more cheerful cap shape.

Body: chunkier stem body with plumper cheeks, bigger rounded feet, pink
cheek blush. Happier vibe than Capling.

Face: laughing open mouth with tiny tongue and two small teeth visible,
squinting happy eyes in a curve. Motion lines around body conveying
playful bounce.
```

## 2.5 Hexcap (evil horned mushroom)
```
[MASTER HEADER]

Subject: Hexcap — an evil dark mushroom monster with sharp horns.

Cap: midnight-purple base with ominous black necrotic spots instead of
white ones, jagged torn cap edge, faintly glowing magenta veins pulsing
across the surface. Two sharp curved ivory bone horns protrude from the
cap sides, tips scorched dark, gold rim at their base.

Stem: bruised grey-purple with dark purple veins snaking down, visible
rib-like ridges.

Face: menacing glowing venomous red slit-pupil eyes with bright pink
bloom halo around each eye, furrowed angry brows casting hard shadow,
bared pearly-white fangs with pink gums, small drool drip on lower lip.

Feet: clawed purple feet with sharp curved white claws. Subtle purple
aura mist wisping upward from body.
```

## 2.6 Grumpwood (angry stump)
```
[MASTER HEADER]

Subject: Grumpwood — a grumpy walking tree-stump, front view.

Body: deep cocoa-brown bark with exaggerated vertical grain lines in
alternating light/dark bands, clumps of bright emerald moss on the
shoulders and top, small bracket-fungus mushroom growing off one side
as a detail, visible wood-knot facial scars on the trunk.

Top: precise concentric sawn-log growth rings with realistic age
shading and a small dark hollow at the dead center.

Face: jagged-lit bloodshot white eyes with tiny red pupils, heavy
furrowed angry black wooden brows, scowling mouth showing two
cream-colored wooden tooth stubs, a small axe-nick scar over one eye.

Feet: gnarled root-feet emerging at the base with visible dirt clumps.
```

## 2.7 Rotshade (zombie mushroom)
```
[MASTER HEADER]

Subject: Rotshade — an undead decayed mushroom horror, 3/4 view.

Cap: sickly putrid purple-grey with ROTTED HOLES showing bright
bioluminescent toxic-green mold inside each hole (faintly glowing).
Tattered cap edge hanging in strips, ooze dripping from hole rims,
one tiny maggot peeking from a hole for flavor.

Stem: mottled grey-violet, partly peeled bark revealing black sinew
beneath, green ooze dribbling from cracks.

Face: hollow black eye sockets with BRIGHT radioactive-green soul-flame
cores glowing with bloom halo, drooling gaping mouth with uneven
broken off-white teeth, a bright green toxic drool strand hanging.

Feet: torn tattered feet with missing toes, one dragging. Eerie but
still Saturday-morning-cartoon cute.
```

## 2.8 Gelmonarch (boss — king jelly slime)
```
[MASTER HEADER]

Subject: Gelmonarch — a MAJESTIC translucent royal sapphire-blue
gelatinous boss slime. Boss-scale presence, fills more of the canvas
than normal monsters (~80% width).

Body: huge translucent sapphire-blue jelly with visible refractive
depth. Through the body you can see silhouettes of smaller slime
minions and bubbles of glittering trapped treasure suspended at
different depths. Top of the body rim-lit with cyan-white highlight
halo, bottom pool deep oceanic navy.

Crown: elaborately ornate GOLD kingly crown with FIVE spiked peaks,
each tipped with a different-colored jewel (center ruby, inner pair
sapphires, outer pair emeralds). Red velvet band with ermine-fur white
trim, small dangling pearls, intricate engraved filigree on gold.

Face: two big lovable expressive eyes with full iris detail and
multiple catchlight reflections, sparkle glints. Wide laughing open
mouth showing pink tongue and two adorable nub teeth.

Ambient: bright sparkle particles drift upward from the body, throne-lit
spotlight vibe.
```

## 2.9 Queen Fungara (boss — mushroom queen)
```
[MASTER HEADER]

Subject: Queen Fungara — BOSS-class motherly mushroom queen. Fills
~90% of the canvas. Cinematic scale worthy of a SNES RPG boss reveal.

Cap: COLOSSAL dark crimson-plum mushroom cap with SIX huge snow-white
circular spots, each with full shadow-side and highlight-side to sell
cap curvature. Ornamental gold-embroidered scroll-work trim on the cap
rim. Deep emerald velvety gill lines underneath. Regal high posture.

Crown: immense GOLD royal tiara with seven jeweled spikes, centerpiece
is a giant teardrop-cut rose ruby, outer spikes alternate sapphires and
amethysts, ornate gold scroll-work filigree between spikes. Sitting
proudly atop cap.

Body: plump tan fleshy mushroom stem with delicate peach rim-lighting,
soft belly button dimple, sturdy squat brown felt legs, small bare
mushroom-root toes, gold-trimmed ankle bracelets.

Face: heavy black ancient angry-mother eyebrows furrowed inward, dark
outlined almond eyes with bright glowing crimson irises and tiny
sparkles, thin disapproving-mother frown with two small sharp pearly
white upper fangs visible. Subtle dark lipstick tint.

Ambient: falling spore particles drift around her, faint magical aura
wisps at feet. Feels both intimidating AND motherly.
```

---

# 👥 SECTION 3 — NPCs (5 sprites)

## 3.1 Elspeth the Alchemist
```
[MASTER HEADER]

Subject: Elspeth — a young cheerful alchemist standing 3/4 front-facing
right, welcoming pose.

Outfit: cherry-red curly hair in twin high pigtails with small
alchemical-symbol clips, ivory apron dress over peach-pink puffy-sleeved
undershirt, leather gloves with tiny scorch marks, glasses with small
reflective lenses. Notebook tucked under left arm.

In right hand: a glowing cyan potion flask held aloft, visible liquid
bubbles, a tiny steam wisp rising from the cork.

Face: bright excited smile, flushed cheeks, sparkling green eyes behind
glasses.
```

## 3.2 Brok the Blacksmith
```
[MASTER HEADER]

Subject: Brok — a burly friendly smith, 3/4 front view, confident stance.

Build: massive smoke-grey muscular arms with visible sweat sheen, thick
dark bearded face braided with two small iron rings, shaved sides
showing blue tribal tattoo pattern, red forge-crest bandana, iron-grey
workshirt.

Outfit: scorched brown leather apron with visible burn marks and tool
loops, heavy steel-plate boots.

Hand: warhammer with visible fuller groove held resting over his right
shoulder, left hand holding red-hot iron tongs with a glowing orange
billet (golden sparks drift off the hot metal).

Face: warm kind-eyed grin beneath beard, a single facial scar over left
eyebrow.
```

## 3.3 Master Ren (martial arts trainer)
```
[MASTER HEADER]

Subject: Master Ren — an elderly zen martial-arts master, standing
peacefully with arms crossed, 3/4 front view.

Build: lean weathered build, slight slouch of wisdom.

Outfit: vibrant persimmon-orange gi with a thick black belt wrapped
three times, tiny jade medallion at throat, wrapped forearm bindings.
One bare foot slightly ahead.

Face: weathered wise face, long flowing snow-white beard that drifts
slightly, high silver-white topknot tied with red cord, almond-shaped
calm closed eyes with gentle smile lines, small soft smile.

Ambient: tiny golden chi light particles swirl faintly around him.
```

## 3.4 Sage Mira (cosmic wizard)
```
[MASTER HEADER]

Subject: Sage Mira — an enigmatic cosmic wizardess, 3/4 front view,
one hand holding floating crystal orb.

Robes: floor-length deep violet-navy cosmic robe with silver embroidered
moon-phases, stars, and constellations (Big Dipper visible). Belt of
hanging crystal charms. Tall pointed wizard hat with a sagging floppy
tip and silver five-pointed-star buckle on the brim.

Hair: flowing silver-platinum hair falling to her waist.

Face: pale face with bright glowing-cyan eyes (no visible pupils),
mysterious knowing smirk.

In hand: a levitating crystal orb held at chest height, swirling
galaxy pattern visible inside, tiny stars drift around her body.
```

## 3.5 Old Arlen (village elder innkeeper)
```
[MASTER HEADER]

Subject: Old Arlen — a kindly stooped village elder, 3/4 view.

Build: stooped elderly posture, leaning on a wooden cane in his right
hand.

Face: wrinkled kind face, bushy white mutton-chop sideburns, flat brown
newsboy cap, pipe clenched between teeth with a small curl of smoke
rising. White stubble, crooked friendly smile with one missing tooth.

Outfit: quilted olive-green patched peasant tunic with brass buttons,
woolen breeches, thick knit scarf around neck even indoors.

In left hand: a wooden mug of foamy ale.
```

---

# 🏘️ SECTION 4 — TOWN BUILDINGS (5 sprites)

All buildings: **1024×1024 PNG, solid white background**, building centered,
slight 3/4 front perspective (camera just left of dead-center), building
occupies ~85% of canvas vertically.

## 4.1 Alchemy Shop (Elspeth's)
```
[MASTER HEADER]

Subject: a cozy storybook alchemy shop building, 3/4 front-quarter view.

Structure: 2-story timber-framed building, pink slate shingle roof
(individually drawn shingles), pastel-pink stucco walls with visible
exposed dark wooden half-timber cross beams (Tudor style), small stone
foundation course at base.

Details: two square leaded-glass windows with cross frames glowing warm
yellow from within (you can see tiny lamp silhouettes inside). Wooden
front door with iron hinges and a gold knob, stone step outside.
Hanging wooden sign above door on a forged iron bracket, sign shows a
painted glowing potion flask icon. Potted purple lavender plants beside
the door. Tiny green ivy creeping up one side.

Chimney: small stone chimney with a gentle white steam wisp rising.
```

## 4.2 Blacksmith Forge (Brok's)
```
[MASTER HEADER]

Subject: a sturdy blacksmith's forge building.

Structure: square 1-story building with slate-blue pitched shingle
roof, grey stone walls, timber-framed window trim.

Details: doorway wide open with warm orange-red forge glow visible
inside, anvil silhouette hinted. A weathered wooden sign above door
shows a crossed anvil-and-hammer icon. Barrel of water outside with
a rusted ladle. Pile of coal bags beside the door.

Chimney: tall stone chimney puffing thick dark smoke in a 3-wisp
trail (animated feel).
```

## 4.3 Dojo (Master Ren's)
```
[MASTER HEADER]

Subject: a tranquil martial-arts dojo, Eastern pagoda style.

Structure: 1-story building with terracotta-orange pagoda curved-peak
tiled roof, cream stucco walls with dark timber framing, sliding paper-
screen (shoji-style) door centered.

Details: two red-paper lanterns hanging outside door by the eaves.
Small maple bonsai in a ceramic pot visible through the window. Carved
wooden sign above door displays a scroll icon. Flat stone walkway path
leading up to the door.

Small garden: single weathered stone lantern beside the entrance.
```

## 4.4 Sage's Tower (Sage Mira's)
```
[MASTER HEADER]

Subject: a tall narrow wizard's tower.

Structure: 3-story stacked tower, deep purple slate conical roof with
gold starburst finial on top, lavender-tinted stone walls, arched narrow
windows glowing pale-blue with floating candle silhouettes inside. Tall
wooden arched door with iron strap hinges at the base.

Details: carved wooden sign showing a crystal-orb-with-stars icon.
Crescent-moon weather-vane above the roof. Gentle spiral of star
sparkles drifting around the tower.

Overall: mysterious and mystical vibe, slight forward tilt.
```

## 4.5 Inn (Old Arlen's)
```
[MASTER HEADER]

Subject: a warm welcoming village inn.

Structure: 2-story building with warm-green mossy shingle roof, beige
stucco walls heavily covered with climbing ivy and roses. Brown timber
framing. Cobblestone foundation course.

Details: wooden front door with brass knob and welcome mat, hanging
flower baskets flanking the door. Wooden sign above door shows a
single red maple leaf painted icon. Stone chimney with soft smoke
wisp. A golden retriever dog sleeping contentedly on the porch mat.
```

---

# 🌲 SECTION 5 — TILESET / ENVIRONMENT (6 tiles)

All tiles: **1024×1024 PNG, solid white background**, tile content
occupies ~90% of canvas, one tile per image.

## 5.1 Grass Ground Tile (horizontally tileable)
```
[MASTER HEADER]

Subject: a side-view grass-and-dirt ground platform tile, designed to
tile seamlessly horizontally.

Composition: top third = lush layered grass (three green tones — dark
forest, mid emerald, highlight seafoam) with individually visible
grass blades, a few tiny scattered flowers (yellow, pink, white), one
four-leaf clover easter egg. Middle/lower two-thirds = rich brown
dirt in three tones (tan, sienna, umber) with scattered small pebbles
(each with a highlight), occasional tree roots poking through, small
dark dirt-dimples.

Shape: left and right edges flat (so it tiles).
```

## 5.2 Wooden Platform Plank
```
[MASTER HEADER]

Subject: a horizontal wooden plank platform, side view, designed to
tile horizontally.

Details: warm oak planks, visible grain lines, dark wood knots in
2-3 spots, iron rivets/nails at regular intervals, 2-pixel seam
between plank boards, slightly worn corners. Three tone bands:
lighter highlight on top, mid warm brown, darker shadow along bottom.

Shape: long narrow plank, left and right edges flat.
```

## 5.3 Stone-Path Tile
```
[MASTER HEADER]

Subject: a stone-flagstone path ground tile, side/top view.

Details: tightly fitted mossy grey flagstones in irregular hex/poly
shapes, 3-4 tones of grey, mortar gaps between stones, small moss
patches growing in the cracks, one small yellow flower in a crack.

Shape: flat edges for tiling.
```

## 5.4 Mushroom-Forest Grass (alt variant)
```
[MASTER HEADER]

Subject: alternate grass tile with a mystical mushroom-forest feel.

Composition: violet-tinted grass (three tones of purple-green) with
tiny bioluminescent glowing spots scattered, small purple and pink
mushrooms growing in tufts, a few wispy spore particles drifting.
Rich dark purple-brown dirt below with faint mystical vein-cracks
of soft teal light.

Shape: flat edges, tileable.
```

## 5.5 Background Tree (foreground variant)
```
[MASTER HEADER]

Subject: a single stylized parallax tree, front view.

Details: round lollipop-style canopy in three layered greens (darkest
bottom, mid green, highlight bright seafoam on top). Brown trunk with
visible bark grain. A few leaf clumps hanging off one branch. Soft
1-pixel outline. Saturated colors (this is the foreground variant).
```

## 5.6 Distant Mountain Silhouette
```
[MASTER HEADER]

Subject: a tileable distant mountain silhouette strip, 1024 wide
1024 tall, mountains occupy bottom half.

Details: three silhouette layers of mountains — darkest teal-blue at
back, lighter greyish-blue middle, soft pastel front. Jagged triangular
peaks, a few snow caps on the highest tips. No outline (silhouettes
only). Flat edges so the strip tiles horizontally.
```

---

# 🎁 SECTION 6 — ITEMS & PICKUPS

## 6.1 Treasure Chest — Wood (closed)
```
[MASTER HEADER]

Subject: a wooden treasure chest, closed state, 3/4 front view.

Details: warm brown oak planks with visible wood grain, two iron
reinforcement bands wrapping vertically, brass keyhole plate on front,
rounded dome lid with ornate corner fittings, simple iron hinges.
Slightly worn with a few nicks. Plank seams visible.
```

## 6.2 Treasure Chest — Silver (closed)
```
[MASTER HEADER]

Subject: a polished silver treasure chest, closed, 3/4 front view.

Details: polished silver metal body with engraved vine patterns on
sides, blue-sapphire round gems embedded at the band corners,
mirror-shine surface catching light, chrome-steel lock with
clover-shaped keyhole. Slight iridescent highlight along the lid edge.
```

## 6.3 Treasure Chest — Gold (closed)
```
[MASTER HEADER]

Subject: a radiant gold treasure chest, closed, 3/4 front view.

Details: rich ornate gold with intricate engraved scrollwork and dragon
motifs, three large ruby gems on the lid, ornate clawed feet at the
base, filigree lock shaped like a rising sun. Subtle golden glow halo
around the entire chest even when closed.
```

## 6.4 Powerup Orb — Common (pearl white)
```
[MASTER HEADER]

Subject: a floating magical powerup orb, centered.

Structure: central pearl-white glowing crystal sphere with internal
iridescent shimmer (like mother-of-pearl), soft outer halo of misty
white light, four small satellite white stars orbiting at the
cardinal directions around the core. Tiny sparkle particles drifting
upward.
```

## 6.5 Powerup Orb — Rare (sapphire)
```
[MASTER HEADER]

Subject: same as common powerup orb, but deep sapphire-blue variant.

Details: sapphire-blue crystal sphere with electric cyan highlights
and internal lightning wisps, cool outer water-ripple aura in
translucent blue, four cyan satellite stars orbiting.
```

## 6.6 Powerup Orb — Epic (violet)
```
[MASTER HEADER]

Subject: same as common powerup orb, but amethyst-violet variant.

Details: rich violet-magenta crystal sphere with electric purple
crackling-energy arcs inside, lightning wisps outside, four purple
satellite stars. More intense energy feel.
```

## 6.7 Powerup Orb — Legendary (gold/solar)
```
[MASTER HEADER]

Subject: same as common powerup orb, but molten gold-orange variant.

Details: molten gold-orange crystal sphere glowing like a tiny sun,
flame-wisp aura flickering around it, solar flare arcs, scorching
heat-haze distorting around orb edges. Four golden star satellites.
Clearly the rarest and most powerful.
```

## 6.8 Red Potion (HP small)
```
[MASTER HEADER]

Subject: a small glass potion flask, centered.

Details: round body, narrow neck, cork stopper with string tie, filled
with bright crimson liquid, tiny bubbles visible rising inside, air
pocket at top. Glass highlight reflection on one side. Small white
label with a red cross on front.
```

## 6.9 Blue Potion (MP small)
```
[MASTER HEADER]

Subject: same as red potion shape, but deep cobalt-blue liquid inside.

Details: small white label with a silver star icon on front.
```

## 6.10 Elixir (full restore)
```
[MASTER HEADER]

Subject: same potion shape, filled with iridescent rainbow-swirl liquid.

Details: shimmering rainbow gradient liquid, floating gold sparkle
flecks inside, gold-leaf label on front with starburst pattern. Subtle
rainbow glow emanating from the bottle.
```

## 6.11 Gold Coin (single frame, front face)
```
[MASTER HEADER]

Subject: a single spinning gold coin, front-face view, centered.

Details: polished gold circular coin with mirror shine, embossed
maple-leaf design in center, small numeral ring around the edge, ornate
wreath pattern along inner border. High contrast with rim light on
upper-left edge, deep gold shadow on lower-right.
```

---

# ⚔️ SECTION 7 — EQUIPMENT ICONS (18 sprites)

Each equipment icon: **1024×1024 PNG, solid white background**, item
centered, 3/4 slanted perspective, item occupies ~75% of canvas.

## 7.1 Wooden Sword
```
[MASTER HEADER]

Subject: a basic wooden practice sword, centered in 3/4 angle.

Details: plain unadorned brown oak hilt with dark leather wrap on the
grip, dull cream-grey wooden blade, simple rounded crossguard. Slightly
scuffed with use marks.
```

## 7.2 Iron Sword
```
[MASTER HEADER]

Subject: a forged iron longsword.

Details: polished steel straight blade with central fuller groove,
simple brass crossguard, dark leather grip with brass rivets, round
iron pommel.
```

## 7.3 Steel Blade
```
[MASTER HEADER]

Subject: a refined steel longsword.

Details: longer slightly tapered polished steel blade, elegant brass
quillons curving down, dark leather-wrapped grip with gold rings,
teardrop-shaped pommel with a small red stone.
```

## 7.4 Runed Sabre
```
[MASTER HEADER]

Subject: a curved sabre with magical runes.

Details: silver curved blade with glowing cyan runic etchings running
along the fuller, ornate gold guard in tsuba style, silk-wrapped grip,
crescent-moon pommel with a sapphire embedded.
```

## 7.5 Enchanted Katana
```
[MASTER HEADER]

Subject: a slim enchanted katana.

Details: slim slightly-curved polished steel blade with a faint indigo
aurora mist wisping along it, black silk-wrapped grip with gold menuki
diamonds, traditional round tsuba, a small hanging tassel ornament.
Floating runic mist near the blade tip.
```

## 7.6 Dawnshard Blade (legendary)
```
[MASTER HEADER]

Subject: a leaf-shaped crystal longsword.

Details: translucent emerald-green crystal blade shaped like a stylized
maple leaf, inner prismatic glow, gold hilt with engraved tree-of-life
motif, wrapped grip with gold rings, large ruby pommel, floating leaf
particles drifting around the weapon. Mythic divine radiance.
```

## 7.7 Cloth Tunic
```
[MASTER HEADER]

Subject: a simple grey linen tunic, spread flat 3/4 view.

Details: coarse grey-brown wool weave texture, simple V-neckline with
drawstring, loose sleeves. Worn and practical.
```

## 7.8 Leather Vest
```
[MASTER HEADER]

Subject: a tan leather vest with visible stitching.

Details: warm tan leather body armor with visible hand-stitched seams,
brass buckles on the front straps, reinforced shoulder patches. Slight
distressed texture.
```

## 7.9 Chain Mail
```
[MASTER HEADER]

Subject: a chainmail hauberk shirt.

Details: oiled silver chainmail rings woven in visible 4-in-1 pattern,
brown fabric padding visible at the neck and wrist, small iron edge
bindings.
```

## 7.10 Plate Armor
```
[MASTER HEADER]

Subject: a polished steel plate cuirass.

Details: polished steel breastplate with articulated shoulder pauldrons,
gold rivets at visible joints, subtle embossed heraldic crest on chest,
leather straps on sides.
```

## 7.11 Dragon Scale
```
[MASTER HEADER]

Subject: an emerald-green dragon scale chest armor.

Details: overlapping green-scale plates with iridescent shimmer, small
dragon-fang trim along the edges, a prominent spike at each shoulder,
gold trim and rivets.
```

## 7.12 Dawnshard Aegis (legendary)
```
[MASTER HEADER]

Subject: a radiant white-and-gold winged cuirass.

Details: polished ivory plate armor with gold feather-winged shoulder
pauldrons, ornate carved maple-leaf gem centerpiece on the chest
(glowing emerald-green), gold chainmail underlayers visible, halo-ring
hovering subtly behind the armor. Holy divine glow.
```

## 7.13 Ring of Might
```
[MASTER HEADER]

Subject: a chunky gold ring with a ruby, centered in 3/4 view.

Details: solid gold band with engraved vine pattern, prominent
bezel-set teardrop ruby gem on top, catching rim light on upper-left.
```

## 7.14 Ring of Wisdom
```
[MASTER HEADER]

Subject: a delicate silver ring with a sapphire cluster.

Details: fine silver band with intricate moon-phase engravings,
three-stone sapphire cluster setting on top, small white diamond
accents between the stones.
```

## 7.15 Boots of Swiftness
```
[MASTER HEADER]

Subject: tan leather boots with small wings on the ankles.

Details: tall tan leather boots with brass buckles up the shin, tiny
angelic white feathered wings sprouting from each ankle, visible
stitching, soft leather creases.
```

## 7.16 Amulet of Fortune
```
[MASTER HEADER]

Subject: a gold four-leaf-clover pendant necklace.

Details: ornate gold four-leaf clover medallion with enameled green
leaves and tiny gold vein details, hanging from a fine gold chain
(partial loop visible), small emerald at the clover center.
```

## 7.17 Shadow Talisman
```
[MASTER HEADER]

Subject: a jagged obsidian pendant.

Details: irregular black obsidian shard wrapped in black silk cord,
faint purple mist wisping around it, small silver rune etched on the
surface. Dark and mysterious.
```

## 7.18 Dawnshard Medallion (legendary)
```
[MASTER HEADER]

Subject: a round gold medal, centered with red silk ribbon above.

Details: ornate gold medal with enameled maple-leaf relief in the
center, surrounded by engraved scroll-work border, suspended from a
red silk ribbon with gold clasps. Subtle radiant glow halo.
```

---

# ✨ SECTION 8 — VFX (10 effects, each at 1024×1024)

For VFX I recommend generating a **horizontal 4-frame sheet** style as
a single 1024×256 image — but to keep our standard 1024×1024 canvas,
arrange frames in a **2×2 grid** on solid white.

## 8.1 Slash Arc (2×2 sheet)
```
[MASTER HEADER]

Subject: a 2x2 grid of 4 animation frames showing a white crescent
sword-slash VFX arc, centered in each cell.

Frames: (top-left) thin faint slash appearing; (top-right) full
bright arc peak with motion-blur trail; (bottom-left) arc fading to
translucent; (bottom-right) only residual white sparkles remaining.

No characters, just the effect. White sword-slash arc on pure white
background, so draw the arc with a bright yellow-orange glow edge so
it reads against the white.
```

## 8.2 Magic Bolt (2×2 sheet)
```
[MASTER HEADER]

Subject: 2x2 sheet of a sapphire-cyan magical energy bolt.

Frames: rotating inner crystal at 0°, 90°, 180°, 270°, with visible
energy trail wisps. Center the orb in each cell.
```

## 8.3 Fireball (2×2 sheet)
```
[MASTER HEADER]

Subject: 2x2 sheet of an orange-yellow flame sphere VFX.

Frames show flame flicker cycle — frame 1: compact bright core;
frame 2: flames licking up and right; frame 3: flames whipping up
and left; frame 4: flames settling with ember break-off particles.
```

## 8.4 Ice Spike (2×2 sheet)
```
[MASTER HEADER]

Subject: 2x2 sheet of a crystalline cyan ice-lance VFX.

Frames: (1) ground frost crack appearing; (2) shard emerging halfway;
(3) full tall ice lance at peak with frost mist aura; (4) ice lance
shattering into fragments. Centered per cell.
```

## 8.5 Meteor Impact (2×2 sheet)
```
[MASTER HEADER]

Subject: 2x2 sheet of a meteor impact VFX.

Frames: (1) flaming meteor streaking down with orange trail; (2)
crashed impact white flash; (3) crater with ember fountain + expanding
shockwave ring; (4) residual lingering smoke with glowing ember dust.
```

## 8.6 Level Up Pillar (2×2 sheet)
```
[MASTER HEADER]

Subject: 2x2 sheet of a radiant gold-white light pillar VFX.

Frames: (1) ground rune appearing; (2) small light column rising;
(3) full tall radiant column with swirling spiral sparkles and a
halo ring at the top; (4) fading dissipation with drifting light
motes.
```

## 8.7 Healing Sparkle (2×2 sheet)
```
[MASTER HEADER]

Subject: 2x2 sheet of an emerald-green healing rune VFX.

Frames: (1) green runic circle appearing on implicit ground; (2) soft
leaves rising with pastel green sparkles; (3) warm green glow pulse at
peak; (4) fading with residual sparkles.
```

## 8.8 Portal Vortex (2×2 sheet)
```
[MASTER HEADER]

Subject: 2x2 sheet of a tall swirling violet-cyan portal vortex VFX,
oriented vertically in each cell.

Frames: rotation at 0°, 90°, 180°, 270° of the inner galaxy pattern.
Gold rim-light ring outline. Sparkle particles being drawn inward,
hints of starfield visible through the vortex.
```

## 8.9 Death Explosion (2×2 sheet)
```
[MASTER HEADER]

Subject: 2x2 sheet of a red death-burst VFX.

Frames: (1) star-shaped white flash core; (2) expanding orange
fireball ring; (3) dark smoke puff; (4) dispersing black smoke wisps
with residual embers.
```

## 8.10 Lightning Chain (2×2 sheet)
```
[MASTER HEADER]

Subject: 2x2 sheet of a yellow lightning chain VFX.

Frames: (1) initial spark at left; (2) jagged zigzag bolt stretching
to the right; (3) full chain lit with branching smaller forks; (4)
fading afterimage. Horizontal orientation in each cell.
```

---

# 🖼️ SECTION 9 — UI ELEMENTS

All UI: **1024×1024 PNG, solid white background**, UI element centered.

## 9.1 HP Bar Frame
```
[MASTER HEADER]

Subject: an ornate fantasy RPG UI HP bar frame, long horizontal shape
centered in the canvas.

Details: dark lacquered wood outer border with gold filigree corners,
ornate inner rim in bronze-gold, empty dark recess in the middle for
the fill (fill NOT drawn — just the empty frame). Style inspired by
Octopath Traveler or Final Fantasy Tactics UI.

Scale: bar is 80% canvas width, ~8% canvas height, centered vertically.
```

## 9.2 Skill Slot Frame
```
[MASTER HEADER]

Subject: an ornate RPG skill slot frame, squarish, centered.

Details: dark bronze-and-black frame with rounded corners, small gold
rivets at each corner, dark interior recess, small empty plate at top
for a key-binding label, small empty plate at bottom for an MP cost.
Style inspired by Octopath Traveler UI.

Scale: frame occupies ~60% of canvas width.
```

## 9.3 Dialog Box Frame
```
[MASTER HEADER]

Subject: a fantasy parchment dialog box, rectangular, wide horizontal.

Details: aged parchment-scroll paper inside a dark wood frame with
gold filigree corner scrollwork. Edges of the scroll paper have tiny
curls. Center interior is empty (for text to be drawn on later).
Magical subtle glow binding the paper to the wood.

Scale: frame occupies ~85% canvas width, ~50% height, centered.
```

## 9.4 Button Plaque
```
[MASTER HEADER]

Subject: a carved wooden button plaque, small rectangular, centered.

Details: warm oak wood plaque with beveled edges and engraved gold rim
border, subtle darker notched backing behind it suggesting depth.
Interior empty for text to be added.

Scale: plaque occupies ~50% canvas width, 20% height.
```

---

# 📂 RECOMMENDED FILE LAYOUT

When you save generated sprites, use this structure so I can wire them
into the game without renaming:

```
LevelX/sprites/
├── player/
│   ├── warrior.png
│   ├── rogue.png
│   ├── mage.png
│   └── archer.png
├── monsters/
│   ├── shellsnip.png
│   ├── gumbud.png
│   ├── capling.png
│   ├── sunback.png
│   ├── hexcap.png
│   ├── grumpwood.png
│   └── rotshade.png
├── bosses/
│   ├── gelmonarch.png
│   └── queen_fungara.png
├── npcs/
│   ├── elspeth.png
│   ├── brok.png
│   ├── master_ren.png
│   ├── sage_mira.png
│   └── old_arlen.png
├── buildings/
│   ├── alchemy.png
│   ├── forge.png
│   ├── dojo.png
│   ├── sage_tower.png
│   └── inn.png
├── tiles/
│   ├── grass.png
│   ├── wood_plank.png
│   ├── stone_path.png
│   ├── mushroom_grass.png
│   ├── tree_front.png
│   └── mountains_bg.png
├── items/
│   ├── chest_wood.png
│   ├── chest_silver.png
│   ├── chest_gold.png
│   ├── orb_common.png
│   ├── orb_rare.png
│   ├── orb_epic.png
│   ├── orb_legendary.png
│   ├── potion_red.png
│   ├── potion_blue.png
│   ├── elixir.png
│   └── coin.png
├── equipment/
│   ├── sword_wood.png
│   ├── sword_iron.png
│   ├── sword_steel.png
│   ├── sword_runed.png
│   ├── sword_katana.png
│   ├── sword_dawnshard.png
│   ├── armor_cloth.png
│   ├── armor_leather.png
│   ├── armor_chain.png
│   ├── armor_plate.png
│   ├── armor_dragon.png
│   ├── armor_dawnshard.png
│   ├── acc_ring_might.png
│   ├── acc_ring_wisdom.png
│   ├── acc_boots.png
│   ├── acc_amulet.png
│   ├── acc_talisman.png
│   └── acc_medallion.png
├── vfx/
│   ├── slash.png
│   ├── bolt.png
│   ├── fireball.png
│   ├── icespike.png
│   ├── meteor.png
│   ├── levelup.png
│   ├── heal.png
│   ├── portal.png
│   ├── death.png
│   └── lightning.png
└── ui/
    ├── hp_frame.png
    ├── skill_slot.png
    ├── dialog.png
    └── button.png
```

---

# 🚀 RECOMMENDED WORKFLOW

1. **Batch by section.** Start with Section 1 (Players) — 4 sprites. Paste
   each prompt verbatim into Gemini, hit send, download the 1024×1024 PNG,
   save with the filename from Section 9.
2. **Spot-check fidelity** after the first 4 sprites. If Gemini's output
   isn't matching the standards (e.g., it's adding gradients, fake
   backgrounds, anti-aliasing), append this bugfix line to the prompt:
   `CRITICAL: Do NOT add any background gradient, ground shadow, ambient
   sky, or photorealistic blur. Solid #FFFFFF white background ONLY.
   Crisp pixel edges only.`
3. **Continue section by section.** Each section is independent — no
   dependencies between them.
4. **When done,** drop the `sprites/` folder next to `mojiworld_game.html` and
   tell me. I'll replace the canvas-drawn sprites in the game code with
   `Image()` loads that reference your PNGs.
5. **Re-roll any that look off.** Same prompt, different seed — Gemini's
   variance is often the quality filter.

---

# 💡 TIPS FOR BETTER GEMINI OUTPUT

1. **Always prepend the Master Header.** Consistency of style across 60+
   sprites depends on it.
2. **Generate at 2× or 4× the intended game size, then downsample yourself
   with nearest-neighbor** in any image editor — this preserves crisp
   pixels and removes Gemini's subtle anti-aliasing.
3. **If Gemini gives you a background despite instructions,** add:
   `"The background must be a flat pure-white #FFFFFF rectangle with zero
   gradient, zero shadow, zero sky"` to that prompt and re-roll.
4. **If the pixel style isn't "pixely" enough,** add: `"Visible chunky
   pixels, mosaic look, stepped edges, 16-bit era retro aesthetic."`
5. **Never mention Mojiworld** in prompts — Gemini sometimes imitates
   flatter MS art when the word appears. My prompts already avoid it.
