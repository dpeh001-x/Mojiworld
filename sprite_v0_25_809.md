# v0.25.809 — Sprite & Background Prompts

Asset-generation prompts for the mid-game content drop landed in
**v0.25.809**: 5 Tier 0-1 monsters, 1 Lv 45 mini-boss, 10 NPCs (6 in
existing towns + 4 in the two new faction sub-maps), and 3 backgrounds
(Hidden Pagoda, Reach of Vermillion, Sundered Forge boss arena).

## Style guide (shared with v0.25.642 / v0.25.688 / Wayfarer's Gauntlet)

- **Monster sprites:** single still **256 × 256 PNG** with transparent
  background, 3/4 hero pose, weight settled, gaze toward player.
- **Boss sprites:** single still **512 × 512 PNG** (the engine scales
  bosses 1.6× internally; 512 keeps the silhouette readable).
- **NPC sprites:** single still **256 × 256 PNG**, transparent
  background, standing idle three-quarter pose facing left so the
  player approaches them on the right.
- **Background art:** **1280 × 540 PNG**, parallax-ready (foreground +
  midground + sky bands compose vertically), transparent alpha allowed
  but solid sky band at the top.
- **Art language:** 16-bit pixel art, vibrant painterly palette, 1–2 px
  dark outlines, **no anti-aliasing**, soft cel-shading with two tone
  bands per material, key light from upper-left.
- **File paths:**
  - Monsters → `Sprites/monsters/<id>.webp`
  - Bosses → `Sprites/bosses/<id>.webp`
  - NPCs → `Sprites/npc/<name>.webp`
  - Backgrounds → `backgrounds/bg_v3_<mapId>.png`
- **Absolute bans:** no text / labels / watermarks / speech bubbles /
  ground shadow / environmental props inside character cells.

---

## Section 1 — MONSTERS (5 new Tier 0-1 mobs)

Each monster is sized for the engine bounding box noted in
`monsterTypes` (`w` × `h`). The 256 × 256 PNG sprite is rendered to
fit comfortably inside that hitbox after the engine downsamples / fits
to the bounding rectangle, with a small breathing margin (~10–15 % of
the canvas) around the silhouette.

### 1.1 `petalfly` — Lv 2, Emerald Thicket (`Sprites/monsters/petalfly.webp`)

Engine box: 24 × 22 px · colors: body `#ffaae0`, shell `#cc55aa`.

```
A single 256×256 px pixel-art sprite on a fully transparent background.
A tiny chibi flower-fairy creature called a "Petalfly" — a fat round
bumblebee body wrapped in soft pink rose petals instead of fur, four
translucent fairy-wings spread mid-flutter, two big sparkling black
dot-eyes with white catchlights, a tiny content smile. Body palette:
#ffaae0 petal-pink, deeper #cc55aa shell rim along the back, pollen-
gold #ffdd88 dust trail under the wings, near-white #fff8fc highlight
on the upper petals. Pose: hovering three-quarter view, body tilted
slightly forward, wings caught mid-beat at a soft motion blur of one
extra ghost-frame.

16-bit pixel-art style, 1-2 px dark outlines, no anti-aliasing, two-
tone cel-shading, warm key light from upper-left. Sprite centered in
the canvas with ~20 px transparent margin. Mood: harmless, cute,
catchable.
```

### 1.2 `mushpup` — Lv 3, Fungal Hollow (`Sprites/monsters/mushpup.webp`)

Engine box: 30 × 28 px · colors: body `#ffd4c4`, shell `#a8584a`.

```
A single 256×256 px pixel-art sprite on a fully transparent background.
A "Mushpup" — a chubby quad-legged puppy-shaped creature whose head is
a fat domed mushroom cap and whose body is creamy fungal flesh. Cap
palette: deep brick #a8584a top dotted with three pale #ffe8d4 cream
spots, gilled cream underside. Body palette: soft peach #ffd4c4 belly
+ legs, tiny black hooves, two large round black eyes with a single
glossy catchlight, a tiny pink mouth open in a panting smile, a stubby
fungal tail wagging. Pose: three-quarter hero stance, front paws
planted, mid-step bounce.

16-bit pixel-art style, 1-2 px dark outlines, no anti-aliasing, two-
tone cel-shading. Sprite centered with ~16 px transparent margin.
Mood: friendly until provoked.
```

### 1.3 `tidefish` — Lv 8, Sunset Coast (`Sprites/monsters/tidefish.webp`)

Engine box: 32 × 24 px · colors: body `#7ed4ff`, shell `#2a78b0`.

```
A single 256×256 px pixel-art sprite on a fully transparent background.
A "Tidefish" — a stout sky-blue surf-fish caught mid-leap out of an
imaginary wave. Body palette: bright lagoon #7ed4ff dorsal fading to
near-white #e8f8ff belly, deep ocean #2a78b0 finned outline along the
top, soft coral #ff9a88 gill blush, sun-glint white catchlight on the
single big round eye facing the player. Tail and side fins fan wide
mid-leap, three tiny droplets of foam-white water beading off the
underside. Mouth slightly open showing one comic tiny tooth.

Pose: caught at the apex of a leap, body arched into a gentle reverse-C
so the tail trails. 16-bit pixel-art style, 1-2 px dark outlines, no
anti-aliasing, two-tone cel-shading. Sprite centered with ~14 px
transparent margin. Mood: cheeky, slippery, hard to predict.
```

### 1.4 `sparkling` — Lv 9, Wildflower Plains (`Sprites/monsters/sparkling.webp`)

Engine box: 28 × 30 px · colors: body `#ffb04a`, shell `#cc4422`.
Ranged shoot-mob — sprite should foreshadow a charge-up posture.

```
A single 256×256 px pixel-art sprite on a fully transparent background.
A "Sparkling" — a flower-mimic critter shaped like an upright orange
marigold with a stocky bulb-body underneath. Petal palette: warm
marigold #ffb04a flaring into deep ember #cc4422 at the petal tips,
with three sparking yellow #ffe066 motes orbiting the petal crown
mid-charge. Bulb body: leaf-green #88c66a stem with two stubby green
leaf-arms held slightly out as if conducting. Single big black eye in
the centre of the bloom with a glossy catchlight, tiny worried-but-
cute mouth.

Pose: standing upright on a single root-foot, petals fanned forward
toward the player, charging up a spark between the leaf-hands. 16-bit
pixel-art style, 1-2 px dark outlines, no anti-aliasing, two-tone cel-
shading. Sprite centered with ~16 px transparent margin. Mood: pretty
but dangerous — the prettiest thing on the prairie that bites back.
```

### 1.5 `cloudbun` — Lv 9, Sky Garden (`Sprites/monsters/cloudbun.webp`)

Engine box: 36 × 30 px · colors: body `#fdfdff`, shell `#a8c8e8`.
Flyer — needs a hovering pose with floating cloud-puffs around the
silhouette.

```
A single 256×256 px pixel-art sprite on a fully transparent background.
A "Cloudbun" — a plump cloud-shaped bunny floating mid-air. Body
palette: pure cumulus white #fdfdff with cool pale-blue #a8c8e8
shadow undertones, a hint of pink dawn-blush #ffd4e4 on the cheeks
and inner ears. Long droopy bunny ears made of denser cloud-fluff,
two huge black sparkling eyes with white catchlights, tiny pink
triangle nose, and a tiny smile. Four little stubby cloud-paws
dangling underneath. Three tiny detached cloud-puffs orbit the
silhouette to communicate the "I am hovering" effect.

Pose: hovering three-quarter view, body relaxed, ears tilted gently
back. 16-bit pixel-art style, 1-2 px dark outlines, no anti-aliasing,
two-tone cel-shading. Sprite centered with ~20 px transparent margin.
Mood: dreamy, weightless, just out of reach.
```

---

## Section 2 — BOSS (1 mini-boss)

### 2.1 `sundered_smith` — Lv 45 mini-boss (`Sprites/bosses/sundered_smith.webp`)

Engine box: 140 × 140 px · colors: body `#4a1a08`, shell `#cc6622`.
Lore: half-melted forge-ghost, each strike rings the anvil that broke
him. Revives once at 35 % HP. Render at **512 × 512 px** so the
silhouette stays readable when the engine scales him 1.6× in arena.

```
A single 512×512 px pixel-art boss sprite on a fully transparent
background. "The Sundered Smith" — a Lv 45 forge-ghost mini-boss.
A massive armoured blacksmith silhouette, head and shoulders forged
from blackened iron-slag (#4a1a08) with bright lava-orange (#cc6622)
cracks glowing along the seams as if half-melted from inside. Left
arm a normal anvil-arm gripping a glowing red-hot smithing hammer the
size of his torso; right arm is mid-dissolve, the iron flesh sloughing
into translucent ember-mist that drifts away from his body. Eyes are
two small white-hot pinpricks of slag light in the deep helm-socket.
A heavy leather forge-apron, charred, hangs scorched in tatters past
his knees. He stands knee-deep in a circular molten pool of his own
unmade body, the pool's surface throwing up small lava-spit motes.

Pose: three-quarter hero stance, mid-anvil-strike — hammer raised
overhead, one foot forward, the body torqued to deliver the next ring
of the anvil that broke him. Background: fully transparent (no
arena), but the molten pool at his feet is part of the sprite. 16-bit
pixel-art style, vibrant painterly palette, 1-2 px dark outlines, no
anti-aliasing, dramatic key light from the lava pool below (uplit
silhouette), cool slag-rim light from above. Sprite centred with ~24
px transparent margin all sides. Mood: tragic, furious, mid-shift.
```

---

## Section 3 — NPCs (10 total — 6 town + 4 faction)

All NPC sprites: **256 × 256 PNG, transparent background, three-quarter
idle pose facing left** (player approaches from the right). Match the
existing `Sprites/npc/*.webp` plumper-chibi visual register — huge
round head, soft body, two-tone cel-shading, bold dark outlines.

### 3.1 `Sprites/npc/madame_cresco.webp` — Megamall innkeeper

Color anchor: `#d4a886` (warm tan / parchment apron).

```
A single 256×256 px chibi NPC sprite on a fully transparent background.
"Auntie Innie" — a plump matronly innkeeper standing in idle pose
facing camera-left. Huge round head with kind crinkled eyes (curved
black arcs above tiny bright dot-pupils), apple-cheek blush, soft
smile. Hair: greying chestnut bun pinned with a small wooden hair-pin,
wisps escaping at the temple. Wearing a long warm-tan #d4a886 inn-
keeper's apron over a cream blouse (#f4ead0) and rust-red skirt
(#a85a40). Holding a folded set of linens taller than her own head in
both arms. Tiny wire-rim half-moon spectacles perched at the tip of
her nose. Soft, motherly, lived-in.

16-bit pixel-art, plumper-chibi proportions matching Brok / Barnaby /
Nurse Joyce. 1-2 px dark outlines, no anti-aliasing, two-tone cel-
shading, warm key light from upper-left. Sprite centred with ~12 px
transparent margin.
```

### 3.2 `Sprites/npc/old_rye.webp` — Hollow Sepulchre bartender

Color anchor: `#8a4422` (worn leather brown).

```
A single 256×256 px chibi NPC sprite on a fully transparent background.
"Old Rye" — a wiry old sepulchre bartender standing in idle pose
facing camera-left, polishing a small glass with a rag. Huge round
head, deeply lined face, half-lidded knowing eyes, a long droopy
moustache. Hair: thin white slicked-back ponytail. Wearing a worn
leather vest (#8a4422) over a stained off-white tunic, dark trousers,
sleeves rolled to the elbows showing thin forearms. A small lit
oil-lantern (#ffa844 flame) hangs on a hook at his belt, casting a
faint warm rim along his right side. Behind him: nothing (transparent
background) — but a single small ghost-wisp (#d8c4ff translucent puff)
hovers near his shoulder as a hint to his clientele.

16-bit pixel-art, plumper-chibi proportions. 1-2 px dark outlines,
no anti-aliasing, two-tone cel-shading. Sprite centred with ~12 px
transparent margin. Mood: weary, dry, unflappable.
```

### 3.3 `Sprites/npc/captain_plum.webp` — Sunset Coast fisher

Color anchor: `#5a99cc` (deep navy weathered coat).

```
A single 256×256 px chibi NPC sprite on a fully transparent background.
"Captain Plum" — a retired ship-captain turned shore-fisher, standing
in idle pose facing camera-left, fishing rod resting against the
right shoulder. Huge round head, sun-worn weather-tanned face, a wide
sea-squint, white five-o'clock stubble. Hair: short salt-and-pepper
under a deep-navy (#5a99cc) captain's cap with a faded gold anchor
emblem. Wearing a heavy weathered navy coat over a striped cream-and-
red sailor's shirt, dark canvas trousers, worn leather boots. A small
fish-creel slung across the body (woven straw #d4b078, single tail-fin
poking out). Right hand grips the rod; left hand tucked in pocket.

16-bit pixel-art, plumper-chibi proportions. 1-2 px dark outlines, no
anti-aliasing, two-tone cel-shading. Sprite centred with ~12 px
transparent margin. Mood: patient, salt-cured, content.
```

### 3.4 `Sprites/npc/postal_wisp.webp` — Town courier (incorporeal)

Color anchor: `#e8d4ff` (pale lilac ghost-glow).

```
A single 256×256 px chibi NPC sprite on a fully transparent background.
"Postal Wisp" — a small floating ghost-spirit courier, hovering in
idle pose facing camera-left. Body shape: a translucent pale-lilac
(#e8d4ff) wisp with no legs — the body tapers into a soft trailing
mist tail below. Wisp body otherwise has the chibi-NPC head proportion
of the other NPCs (huge round head, two big sparkling black dot-eyes
with white catchlights, tiny content smile). Wearing a tiny official
postal cap (#5a4488 navy with a small gold #ffdd44 mail-emblem) tipped
slightly forward. A leather messenger satchel (#a85a44) almost as big
as the wisp itself slung across the body, with a single rolled scroll
poking out the top, sealed with a small red wax dot.

The wisp glows softly — a faint pale-violet outer rim halo (about 4
px wide). Pose: hovering slightly tilted forward as if mid-delivery.
16-bit pixel-art, 1-2 px dark outlines, no anti-aliasing, two-tone
cel-shading. Sprite centred with ~16 px transparent margin (room for
the halo). Mood: brisk, professional, weightless.
```

### 3.5 `Sprites/npc/tincture_aunt.webp` — Azure Academia alchemist

Color anchor: `#aa66ee` (violet apothecary robes).

```
A single 256×256 px chibi NPC sprite on a fully transparent background.
"Tincture Aunt" — a wiry elderly alchemist standing in idle pose
facing camera-left, grinding something in a small stone mortar with a
pestle. Huge round head, sharp clever eyes (one slightly narrowed),
deep crow's-feet, a small knowing smirk. Hair: long silver braid down
the back tied with a thin violet ribbon. Wearing flowing violet
(#aa66ee) apothecary robes with deep purple (#5a2a8a) trim along the
cuffs and hem, a cream sash, a leather belt with three small glass
vials clipped to it (red, blue, glowing green). A pair of thin gold-
rim reading lenses pushed up onto her forehead. Right hand grips the
pestle mid-grind; left hand braces the mortar against her hip.

Around her shoulders a thin violet-grey wisp of fume (#c8a8e8) rises
faintly from the mortar — barely visible, just enough to read as
"something is brewing". 16-bit pixel-art, plumper-chibi proportions.
1-2 px dark outlines, no anti-aliasing, two-tone cel-shading. Sprite
centred with ~12 px transparent margin. Mood: sharp, amused, dangerous.
```

### 3.6 `Sprites/npc/coach_stride.webp` — Bastion Courtyard arena master

Color anchor: `#cc8844` (burnt-orange training gi sash).

```
A single 256×256 px chibi NPC sprite on a fully transparent background.
"Coach Stride" — a stocky weather-hardened combat coach standing in
idle pose facing camera-left, mid one-armed push-up recovery (one arm
on the ground out-of-frame, the upper body torqued upright). Huge
round head, intense focused eyes, a broken-and-reset nose, square
jaw, a confident close-lipped smile. Hair: short steel-grey crop,
a single small braided rat-tail at the nape. Wearing a sleeveless
training gi, cream tunic with a burnt-orange (#cc8844) cloth sash
double-wrapped around the waist, dark-grey trousers tucked into wrap-
cloth shin guards. Hands wrapped in white training tape, knuckles
showing wear. A whistle on a leather thong around the neck.

Pose: confident drill-instructor stance — one knee bent, the body
upright and ready, weight settled. 16-bit pixel-art, plumper-chibi
proportions. 1-2 px dark outlines, no anti-aliasing, two-tone cel-
shading. Sprite centred with ~12 px transparent margin. Mood:
disciplined, dependable, faintly smug.
```

### 3.7 `Sprites/npc/master_kaze.webp` — Hidden Pagoda (rogue faction lord)

Color anchor: `#5a2d8a` (deep violet shadow-robes).

```
A single 256×256 px chibi NPC sprite on a fully transparent background.
"Master Kaze" — a serene rogue lord seated cross-legged in idle pose
facing camera-left, eyes closed in meditation. Huge round head, calm
unlined face, very faint half-smile, a fox-mask perched on the side
of his head (matching the v0.25.414 Yun motif but in shadow-violet
tones instead of forest-green — the pagoda's parallel faction). Hair:
long inky-black ponytail bound with a thin violet ribbon, sweeping
down to the floor in front of him. Wearing deep-violet (#5a2d8a)
flowing shadow-robes with silver (#c8c8e8) thread-trim along the
sleeves and hem, a black cloth obi at the waist with a small silver
shuriken-emblem clasp. A long curved katana resting horizontally
across his lap, sheathed in violet lacquered scabbard.

Body posture: perfect cross-legged seated meditation, hands resting
palms-up on knees, head slightly tilted forward. A single small
shadow-petal motif drifts in the air near his shoulder. 16-bit pixel-
art, plumper-chibi proportions. 1-2 px dark outlines, no anti-aliasing,
two-tone cel-shading. Sprite centred with ~12 px transparent margin.
Mood: still, patient, lethal-when-needed.
```

### 3.8 `Sprites/npc/whisper.webp` — Hidden Pagoda info broker

Color anchor: `#aa66ee` (violet hood lining).

```
A single 256×256 px chibi NPC sprite on a fully transparent background.
"Whisper" — an androgynous slight-build info broker standing in idle
pose facing camera-left, folding a small parchment crane between
their fingers. Huge round head mostly hidden under a deep cowl-hood,
only the lower face visible: pale skin, a small knowing smile, a
single pale-violet eye showing under the hood's edge. Hood: dark
charcoal #2a2030 outer cloth with a violet (#aa66ee) inner lining
visible where the hood opens. Wearing a long dark cloak that drops
past the knees, layered over a violet under-tunic and dark trousers.
Hands gloved in fingerless leather mitts, currently held up at chest
height folding the parchment crane (a small white origami crane half-
finished between the fingertips).

Around their feet on the ground (just inside the canvas), one
finished paper crane already sits, and a torn scroll-strip beside it.
16-bit pixel-art, plumper-chibi proportions. 1-2 px dark outlines, no
anti-aliasing, two-tone cel-shading. Sprite centred with ~12 px
transparent margin. Mood: quiet, knowing, unreadable.
```

### 3.9 `Sprites/npc/high_marshal_vermillion.webp` — Reach of Vermillion

Color anchor: `#cc2244` (deep vermilion archery uniform).

```
A single 256×256 px chibi NPC sprite on a fully transparent background.
"High Marshal Vermillion" — a tall imposing archer-marshal standing
in idle pose facing camera-left, mid-draw posture with a longbow in
the left hand, an arrow nocked but not yet at full draw. Huge round
head, sharp narrow eyes (focused mid-aim), confident calm expression,
faint scar across the right cheekbone. Hair: long deep-crimson #aa2244
braid down the back tied with a small black ribbon. Wearing a deep
vermilion (#cc2244) lamellar archery uniform — fitted leather chest-
guard with black-and-gold trim, a half-length crimson cloak draped
over the right shoulder only (so the bow-arm is unencumbered), high
boots, and a wrist-guard of polished bronze on the bow-hand. A quiver
of arrows on the back, fletched with vermilion goose feathers.

Pose: settled draw stance, left side toward the player, bow held
upright in left hand. 16-bit pixel-art, plumper-chibi proportions
(but slightly taller / leaner than the average NPC — Marshal-rank
silhouette). 1-2 px dark outlines, no anti-aliasing, two-tone cel-
shading. Sprite centred with ~12 px transparent margin. Mood:
commanding, precise, second-bow to no-one but Hong.
```

### 3.10 `Sprites/npc/ginko.webp` — Reach of Vermillion fletcher

Color anchor: `#88aa55` (sage-green fletcher's apron).

```
A single 256×256 px chibi NPC sprite on a fully transparent background.
"Ginko" — a lanky young fletcher seated cross-legged in idle pose
facing camera-left, a small quiver of half-finished arrows held
between his knees, gluing a goose feather onto an arrow shaft in his
hands. Huge round head, friendly focused eyes, faint freckles across
the nose, gentle absent-minded smile. Hair: short messy hazel-brown
with a single feather (decorative, a goose primary) tucked behind one
ear. Wearing a sage-green (#88aa55) fletcher's apron with multiple
small pockets full of trimming tools (tiny shears, a glue brush, a
fletching jig), a cream tunic underneath, dark trousers, soft canvas
shoes. Hands carefully aligning the feather along the arrow shaft —
fingertips stained faintly with glue.

A small pile of stray goose feathers (#e8e0d0 cream) on the ground
beside him, and a finished arrow leaning against his knee. 16-bit
pixel-art, plumper-chibi proportions. 1-2 px dark outlines, no anti-
aliasing, two-tone cel-shading. Sprite centred with ~12 px transparent
margin. Mood: meditative, craft-focused, happy.
```

---

## Section 4 — BACKGROUNDS (3 new maps)

All backgrounds: **1280 × 540 PNG**, side-scrolling parallax-ready,
painterly pixel-art matching v0.25.642 / v0.25.688 / Wayfarer's
Gauntlet visual register. Sky band at the top must stay solid (no
alpha) so the world doesn't show transparency when the camera scrolls.
Tier-line platform stubs at the canonical heights help the in-engine
platforms read correctly against the BG.

### 4.1 `backgrounds/bg_v3_hiddenPagoda.png` — Hidden Pagoda (rogue faction)

```
Side-scrolling 1280×540 painterly pixel-art backdrop of a single tall
hidden pagoda silhouette under a moonless violet night sky. Sky band
(top): deep indigo #08020e at the very top fading to a dusty violet
#2d1450 horizon, with three or four faint distant pinprick stars and
a low pale-violet aurora ribbon drifting through the upper third.
Midground: a single tall five-tiered pagoda silhouette dominating the
right two-thirds of the canvas, dark-violet (#1a0a2e) roof eaves with
faint silver (#aa88dd) moon-rim light along each tier's curved ridge.
Each pagoda tier overhangs the one beneath it with paper-lantern
ornaments (tiny dim violet #5a2d8a paper-lantern dots, two or three
per tier) — the lanterns are NOT bright enough to fully illuminate
the pagoda; they read as discreet, hidden, just-enough-to-see-by.
Foreground: a low slate-grey rooftile ridge across the bottom of the
canvas (the pagoda's lowest tier), and a single small bonsai tree in
silhouette at the bottom-left as a focal point.

Tier-line platform stubs imagined at y≈420 (ground entry), y≈370
(first ascent), y≈310 (second ascent — Kaze's perch), y≈220
(peak — Master Kaze's command tier), and y≈360 (side perch —
Whisper's nook). Leave gaps in the foreground / midground so the
in-engine platforms read cleanly against the BG.

Palette anchors: #08020e deep night, #15082c sky-mid, #2d1450 sky
horizon, #1a0a2e pagoda shadow, #3a1a5e pagoda midtone, #aa88dd
moon-rim highlight, #5a2d8a lantern violet, #888aa8 distant mist,
#1a0a18 deep foreground shadow.

Mood: quiet, hidden, contemplative — the rogue brotherhood's secret
capital. NOT looming or threatening — these are monks, not killers.
```

### 4.2 `backgrounds/bg_v3_reachOfVermillion.png` — Archer faction

```
Side-scrolling 1280×540 painterly pixel-art backdrop of a long open
archery longshot range at sunset, painted in deep vermilion banners
over a jade-and-cream painted-wood pavilion silhouette. Sky band
(top): warm peach #ffd8b8 horizon fading to deeper coral #e88060
sunset glow at the upper third, with a single thin gold #ffdd88
sun-line just above the horizon and four or five small distant
swallows in silhouette.

Midground: the firing range itself — a wide cream-stone pavilion
floor stretching across the entire canvas width, jade-green (#5a8a5a)
painted wooden columns lining the rear of the pavilion at regular
intervals, hung with long vertical deep-vermilion #cc2244 silk
banners that catch the sunset light. The high marshal's elevated
command platform sits centred in the canvas — a slightly raised wooden
deck of stained jade-and-cream planks with two vermilion banner-poles
flanking it. To the far right, a small line of distant target plinths
diminishing in perspective (three plinths, paper bullseye discs in
cream + vermilion + black rings) communicates the longshot range.

Tier-line platform stubs imagined at y≈420 (ground), y≈380 (firing
line walkway), y≈280 (marshal's command platform), y≈340 (Ginko's
fletching ledge). Leave platform-shaped gaps in the BG so the engine
platforms read cleanly.

Palette anchors: #ffd8b8 sky highlight, #ffc090 sky mid, #e88060 sky
horizon, #5a8a5a jade column, #cc2244 vermilion banner, #aa1a32
banner shadow, #f4ead0 pavilion stone, #d4b078 stained wood,
#3a4a3a deep shadow, #ffdd88 gold sun-line.

Mood: ceremonial, focused, alive — the working academy of the
archer faction. Banners catch the breeze; the place breathes.
```

### 4.3 `backgrounds/bg_v3_sundered_forge.png` — Sundered Smith arena

Lava-eruption boss arena off Magma Foundry. Should read as a single
intimate forge-chamber, not a sprawling cavern — the boss fight is
the whole experience.

```
Side-scrolling 1280×540 painterly pixel-art backdrop of a vast molten
forge-chamber buried deep beneath the Magma Foundry. Sky band (top):
the ceiling is a low arched cavern roof of blackened iron-slag
(#2a0606) dripping with stalactites of cooling glass-slag, lit
intermittently from below by lava-glow that reflects red-orange
across the rock. No sky proper — this is fully enclosed.

Midground: a massive ruined central anvil dominating the back wall
of the chamber, half-melted into the floor, its surface still glowing
red-hot at the seams. Behind and around it, two huge ruined forge-
hearths flank either side, their mouths gaping with low molten light
(#cc6622 lava core, #ff8844 inner glow rim). Cracked iron support
beams arch overhead, the chamber's structure half-collapsed and
held together by sheer weight. A river of molten slag streams across
the lower midground from left to right, glowing #ff5522 at the core
fading to crusted black #4a1a08 at the surface ripples. Three small
lava-spit bubbles rising along the stream.

Foreground: cracked obsidian floor tiles, the boss-arena's playable
surface — laid out as a long horizontal platform with two raised
flanking platforms at left and right where the player can dodge
eruption columns. Tier-line platform stubs imagined at y≈480
(ground floor — wide), y≈380 (left + right small flanking platforms
at x≈200, x≈1160), y≈340 (mid-tier flanking ledges at x≈560 + x≈840).

Palette anchors: #2a0606 cavern darkest, #5a1010 cavern mid-shadow,
#aa3320 cavern warm rim, #4a1a08 slag rust, #cc6622 ember orange,
#ff5522 lava core, #ff8844 lava inner glow, #ffdd88 hottest highlight
glints, #1a0a08 deep iron, #ffffff smallest sparks.

Mood: oppressive, sacred, sorrowful — the place where a smith broke
the anvil that broke him. The room remembers.
```

---

## Section 5 — GENERATION ORDER & BUDGET

Suggested batching (for Ludo.ai / Gemini / Nano-Banana):

1. **Tier 0-1 monsters (5 prompts, ~5 credits)** — quick wins, fills
   the visible early-game gap immediately.
2. **NPCs (10 prompts, ~10 credits)** — town + faction characters
   become dialog-card portraits as soon as they land.
3. **Backgrounds (3 prompts, ~6 credits)** — biggest visual impact;
   render last so any sprite-side palette adjustments inform BG
   palette choices.
4. **Sundered Smith boss (1 prompt, ~2 credits at 512×512)** — render
   AFTER the Sundered Forge BG so the silhouette can be cross-checked
   against the lava palette.

**Total estimated credit cost:** ~23 credits at one render per asset
(no re-rolls). Budget 30-40 credits if you expect to re-roll the 2-3
hardest assets (Sundered Smith silhouette + the Hidden Pagoda
silhouette are the highest-risk renders).

After download, follow the existing rename / move pattern from
`AUDIO_DOWNLOAD_INDEX.md` — Ludo names downloads using the prompt
prefix, so a tiny shell-script analogous to `rename_sfx.sh` can map
the downloaded files into `Sprites/monsters/`, `Sprites/npc/`,
`Sprites/bosses/`, and `backgrounds/`.



