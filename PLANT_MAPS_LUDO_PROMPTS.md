# BLOOM REACHES — Plant Monster Sprites (ludo.ai prompts)

Static idle sprites ONLY for now (walk/attack anim frames come later as a
follow-up batch). One 768×768 image each, transparent background, no panel,
no ground shadow. Drop the results in as:

- `Sprites/monsters/thornmaw.webp`
- `Sprites/monsters/elderbark.webp` (user-generated manually — concept below is reference only)
- `Sprites/monsters/pinechad.webp`
- `Sprites/monsters/meloncholy.webp`

Until the sprites land, the game renders all three with the procedural
color/shell fallback, so the maps are playable immediately.

Shared style line (paste in front of each prompt):

> Cute chibi game monster, thick clean outlines, soft cel shading, vibrant
> colors, single character centered, full body visible, 3/4 front view,
> transparent background, no text, no panel, no drop shadow, 768x768.

---

## 1. Thornmaw — `thornmaw.webp` (Lv 52, Verdant Hollow)

Cute chibi game monster: a squat snapping BRAMBLE-JAW plant. Round mossy
body of tangled dark-green brambles (#2a5a1a) with a huge open venus-flytrap
mouth as the face — soft pink inside, blunt cartoon thorn-teeth, two tiny
stubby leaf-arms raised mid-snap. Bright leaf-green highlights (#4a8a3a),
a few small red berries caught in the brambles, mischievous half-lidded
eyes on the upper jaw. Grounded posture, slightly leaning forward like it's
about to lunge. Friendly-menacing, Maplestory-adjacent cuteness.

## 2. Elderbark — `elderbark.webp` (Lv 55, Bloomhaven fringe)

> NOTE: user is generating this sprite manually — concept reference only.

Cute chibi game monster: a BIG ANCIENT WALKING TREE. Massive gnarled
oak-brown trunk body (#6a4a2a) with deep dark bark fissures (#3a2a16), a
broad mossy canopy crown like wild hair, two heavy root-cluster feet and
thick branch-arms ending in knuckled twig-fists. A wise, weary face set
into the trunk — heavy-lidded amber eyes, a long bark-crack mouth. Small
details: a tiny bird nest in the canopy, one dangling acorn, moss patches
on the shoulders. Towering and broad (reads ~1.5× wider than the other two
monsters), slow heavy stance mid-step. Gentle-giant menace, ancient and
very awake.

## 3. Pinechad — `pinechad.webp` (Lv 58, Thornspire Thicket)

Cute chibi game monster: a GIGACHAD PINEAPPLE. Plump golden-yellow
pineapple body (#f0c030) with crosshatch diamond skin sprouting short blunt
spikes — but carried like a gym physique: chest puffed out, tiny leaf-arms
FLEXING a double-biceps pose, root-feet planted in a power stance. The face
is pure chad: chiseled exaggerated jawline, smug sideways smirk, one raised
brow, heavy-lidded confident eyes. Spiky green leaf-crown (#3a7a2a) slicked
back like perfect hair. A single sparkle glinting off the jaw. Radiates
unearned confidence — adorable and insufferable.

## 4. Meloncholy — `meloncholy.webp` (Lv 57, Thornspire Thicket)

Cute chibi game monster: a CREEPY LEERING WATERMELON. Wide oval watermelon
body (#3a8a4a) with dark wavy rind stripes (#1e5a2e), a big bite-shaped
chunk missing from one side exposing pink flesh and black seeds. The face
is deeply unsettling: half-lidded sleazy eyes peering sideways, one
eyebrow raised mid-waggle, an enormous too-wide grin showing seed-teeth,
a single bead of sweat on the rind. Tiny curly stem twirled like a
greasy mustache. Two stubby nub-arms — one raised in a tiny finger-waggle
"hey there" wave. Leaning slightly TOO far toward the viewer. Comically
creepy, lurking energy — the monster that stares from the bushes.

---

# Bloomhaven Village NPCs

Full-body standing character sprites, same pipeline as the Shadow-Woven
Hood / Megamall NPCs (see SHADOW_WOVEN_HOOD_LUDO_PROMPTS.md precedent).
One 768×768 image each, transparent background, full body, feet visible.
Drop in as:

- `Sprites/npc/petunia.webp`
- `Sprites/npc/oakhart.webp`

(Taxi Uncle already has art — `Sprites/npc/taxi_uncle.webp` resolves by
name automatically in Bloomhaven.)

Shared style line:

> Cute chibi game NPC, full body standing pose, thick clean outlines, soft
> cel shading, vibrant colors, single character centered, feet visible,
> transparent background, no text, no panel, no drop shadow, 768x768.

## 5. Petunia — `petunia.webp` (potion seller)

Cute chibi game NPC: a cheerful young HERBALIST. Rosy round face, big
warm eyes, petal-pink bobbed hair (#ff9ad0) crowned with a single fresh
petunia flower tucked over one ear. Earth-green apron over a cream linen
dress, sleeves rolled up, pockets bristling with corked potion vials
(pink, green, blue liquids) and sprigs of herbs. Holding up one glowing
pink potion bottle proudly with both hands. Friendly small-town warmth —
the village's beloved potion auntie-in-training.

## 6. Oakhart — `oakhart.webp` (gear-enhancement smith)

Cute chibi game NPC: a stout TREEFOLK BLACKSMITH. Broad barrel torso of
living oak bark (#a8763a) with a mossy beard like hanging lichen, kind
crinkled amber eyes under heavy bark brows, two small leafy twigs
sprouting from his head like stray hairs. Thick leather smithing apron
scorched at the edges, one bark fist resting on a small anvil-hammer
slung at his hip, the other holding up a glowing enhanced sword with a
proud grin. Embers and tiny leaves drifting around him. Gentle giant
craftsman — half tree, half forge.

---

After generating: if ludo returns an opaque colored panel instead of
transparency, run the border flood-fill fix (see memory note / prior gear
sprites). Verify each sprite reads clearly at ~96px in-game scale.
