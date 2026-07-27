# Zodiac Boss Sprite Prompts — Mystical Beast Pantheon

Generation prompts for the 12 Zodiac Sanctum bosses (Lv 70-90 endgame tier as
of v0.25.580). Each boss gets a **single still sprite prompt** — one large
dramatic key art per sign, no animation strip. Written for Midjourney v6,
DALL·E 3, and Stable Diffusion XL — also works as a brief for a pixel
artist. One prompt block per sign → drop renders into `bosses/`.

These are constellations made flesh as **mystical beasts**, not humanoid
warriors. The pantheon sits narratively above Gravitos (Lv 100 super-boss)
in cosmic weight, but they are creatures — quadrupeds, sea-things, sky-
things, hybrid mythological forms. No bipedal armored knights, no humanoid
mages, no human silhouettes. Think: cosmic megafauna with star-stuff in
their bones. Tone matches the existing `bg_v3_*.png` zodiac backdrops —
cosmic, painterly, vibrant.

---

## Shared style guide

- **Vibe**: ancient · primeval · mystical · beast-divine · made of starlight
  and bone and storm
- **Form**: quadrupedal, serpentine, multi-limbed, or otherwise non-human.
  Where the lore implies a humanoid (Virgo "maiden", Aquarius "bearer",
  Libra "judge"), reinterpret as a **divine beast embodying that role** —
  e.g. Virgo as a six-winged celestial owl, not a winged woman.
- **Aesthetic**: 16-bit pixel art, vibrant painterly palette, dark 1-2 px
  edge outlines, minimal anti-aliasing. Matches existing Mojiworld art.
- **Pose**: **epic idle stance** — the boss is at rest but radiating presence,
  the kind of pose you'd see in a fighting-game character-select screen or
  a boss intro freeze-frame. No mid-attack, no mid-wind-up, no in-flight
  motion. Every limb settled, weight on all feet (or coiled, or floating
  steady), head held proud, gaze directed slightly down toward where the
  player would stand. Aura, halo, or constellation effects swirl gently
  around the body but do not imply motion of the body itself. Each boss
  also has a phase-3 evolved form — the prompt notes that transformation
  at the end so a second still can be shipped later.
- **Background**: **transparent** (PNG alpha channel). No chroma key, no
  green fill — the engine blits with alpha and the procedural starfield
  backdrop renders behind.
- **Identity hooks**: each prompt also calls out the boss's signature
  feature (Aries' iron horns, Sagittarius' antler-bow, Aquarius' eight
  weeping tentacles, etc.) so silhouettes are unmistakable at draw scale.

## Sprite spec

| Param | Value |
|---|---|
| Canvas | **1280 × 1280 px** |
| Pose | single dramatic 3/4 hero shot, beast in motion |
| Background | **transparent** (alpha PNG) |
| Filename | `bosses/zodiac_<id>.png` |

---

## ♈ ARIES — Ariel the Ember Ram · Lv 70

*"The First-Born — horns of molten iron."*

**Sprite prompt:**

```
A colossal celestial ram-beast in 16-bit pixel art, epic idle pose,
fully four-legged and bestial — no humanoid features, no armor, no
weapons. Body the size of a small mountain, dense charcoal wool tipped
in burning ember orange along the shoulders and spine. Stance is heroic
and still: all four obsidian-stone hooves planted firmly on cracked
basalt ground, body squared toward the viewer in a 3/4 hero pose, head
raised proud and high, chest puffed forward to display the burning
breastplate of fused obsidian. Two enormous spiraling horns of glowing
molten iron curve outward and upward in a perfect symmetrical crown,
each ringed with floating ember-rune sigils that orbit slowly. The
face is a long ovine skull naturally fused with cracked black obsidian
plating; twin ember-red eyes burn deep within the eye sockets, gaze
directed slightly downward at the viewer. The fleece along the spine
smolders gently, releasing slow ember sparks that drift upward in a
calm column. Beneath the hooves, glowing crack lines spread outward in
a stillborn starburst — the heat radiates but the body does not move.
A halo of roiling red-orange flames crowns the back of the head,
weaving slowly between the horns. No saddle, no rider, no metal.
Phase 3 evolution: the wool burns away entirely, revealing a skeletal
frame of glowing white-hot ember bones, the horns shed iron and
become pure flame. Palette: #ff5522 base,
#8a1510 deep shade, #ffaa66 hot highlight, #ff9944 aura. Transparent
PNG background, 1-2 px black outlines, no anti-aliasing, vibrant pixel-
art style.
```

---

## ♉ TAURUS — Taur the Granite Bull · Lv 72

*"The Unshakable — each stomp cracks the earth."*

**Sprite prompt:**

```
A colossal four-legged stone-bull beast in 16-bit pixel art, epic
idle pose. Pure quadruped — no armor, no helm, no rider. The body is
a mountain of living granite, hide composed of overlapping slabs of
grey and tan stone fitted like fortress plating, glowing amber lava-
cracks running through every joint and pulsing in rhythm with breath.
Stance is heroic and still: all four hooves planted square on the
basalt ground, weight distributed evenly, body angled in a regal 3/4
hero pose. Head is lowered slightly so the massive curved horns of
polished obsidian tipped with raw gold are prominent and aimed forward
in a silent challenge. A thick mane of jagged obsidian shards runs
down the spine from the back of the skull to the tail, each shard the
size of a tombstone, settled at rest. The face is heavy and stone-
mask-like, eyes deep amber gemstones glowing from sunken sockets,
gaze fixed forward at the viewer. The tail ends in a triple-spiked
stone mace-cluster, drooping in repose. Hot dust drifts gently around
the hooves and the basalt beneath glows faintly with the heat of his
presence. Behind the bull, ancient star-glyphs hover in dim air,
slowly rotating around the horns. Phase 3 evolution: the stone hide
cracks apart at the chest and flanks, revealing a molten-gold
endoskeleton core; lava drips from the seams, horns turn pure
obsidian-black flecked with stars. Palette: #7a6a5a
granite base, #3a2a1a deep stone, #bba68a lit highlight, #ffcc66 amber-
glow aura. Transparent PNG background, 1-2 px black outlines, no anti-
aliasing, vibrant pixel-art style.
```

---

## ♊ GEMINI — Gem & Mini the Twinstar · Lv 74

*"Two-bodied star — splits at half HP."*

**Sprite prompt:**

```
Two enormous celestial star-stags in 16-bit pixel art, epic idle pose
— mythological twin beasts, no humanoid forms. Each stag is the size
of a small whale, fused at the rump in a shared infinity-loop posture
so their bodies form a perfectly still interlocking yin-yang silhouette
locked in cosmic stillness. Both stags stand with all four crystalline
hooves planted, heads raised proud and forward toward the viewer, the
two faces side by side as if posing for a regal portrait. Left stag
has a hide of glacial cyan-white starlight, mane and tail of swirling
moon mist; right stag has a hide of warm magenta-pink stardust, mane
and tail of nebula-cloud violet. Antlers on both are massive forked
constellation-trees, each tine a glowing star, the antler tips
overlapping at the apex where a shared crown of seven nested stars
hovers in the air. Constellation threadlines arc gracefully between
the antlers in a still suspended pattern. Eyes are slit pupils of
pure white light, both pairs gazing slightly down. A faint connecting
umbilical of plasma flows steady and undisturbed between their two
chests. Around them, drifting nebula dust forms ghostly wing shapes
that hold position rather than billow. Phase 3 evolution: the two
stags detach fully and orbit a shared central pearl of pure starlight,
each trailing a constellation streamer.
Palette: #88ddff cyan base, #3366aa deep blue shade, #ffffff pure
highlight, #aaccff cool aura, with #ff88cc magenta accent on the
right stag. Transparent PNG background, 1-2 px black outlines, no
anti-aliasing, vibrant pixel-art style.
```

---

## ♋ CANCER — Cancer the Tidecaller · Lv 76

*"Moonlit pincers — water bubbles burst into homing droplets."*

**Sprite prompt:**

```
A massive deep-tide moon-crab beast in 16-bit pixel art, epic idle
pose. Pure crustacean, no humanoid features. Eight segmented pearl-
rose legs splay outward in a wide planted stance, all eight claw-tips
braced firmly against the seabed-stone, body squared in a regal 3/4
hero shot. The carapace is a vast iridescent rose dome crusted with
barnacles shaped like tiny crescent moons, naturally fused together
to form a crown of seven moon-shaped pearls along the dorsal ridge.
Two enormous front pincers are raised high and held wide above the
body in a perfectly symmetrical crown-display silhouette — both
pincers are closed and held proud, the segmented limbs arched into a
ceremonial halo above the carapace, framing the body like an ornate
throne-back. The face is hidden under the lip of the carapace;
only eight tiny crescent-moon-shaped eyes glow white from within the
shadow, all eight gazing forward at the viewer. The mouthparts are
crystalline mandibles, parted slightly. Around the crab, ten
translucent water-bubbles float at varying sizes in a slow stationary
hover, each containing a faint moon-phase image inside.
Phase 3 evolution: the carapace splits open along the dorsal seam,
revealing a glowing black-pearl heart surrounded by spiraling tide-
rings; legs sprout coral spikes, pincers grow secondary claws. Palette: #ff66aa rose base, #aa2266
deep coral shade, #ffccdd pearl highlight, #ffaaff bubble aura.
Transparent PNG background, 1-2 px black outlines, no anti-aliasing,
vibrant pixel-art style.
```

---

## ♌ LEO — Regulus the Sunmane · Lv 78

*"The Sun King — a single roar stops time."*

**Sprite prompt:**

```
A colossal four-legged solar lion-beast in 16-bit pixel art, epic
idle pose. Pure quadruped — no armor, no crown, no weapons, no rider.
Body the size of a small temple, hide a shimmering molten gold pelt
with deeper amber rosette markings shaped like solar glyphs along the
flanks. Stance is regal and still in the unmistakable lion-king pose:
front-right paw raised and resting proudly atop a rocky sun-stone
outcrop, the other three paws planted firmly on the ground, body
squared at a heroic 3/4 angle, chest puffed forward to display the
golden bib of mane around the throat. The mane itself is a vast,
literal miniature sun — a radiating sphere of fire wrapped around the
head, individual mane strands curling like solar prominences, each
tipped in a glowing ember, the whole sphere pulsing slowly without
visibly expanding. The face is broad and beast-feral, eyes blazing
white-yellow stars set deep in a brow of golden bone, gaze directed
slightly downward at the viewer with imperial calm. Maw is closed in
a regal jaw-clench, single fang visible at the corner. Paws are tipped
in obsidian claws inscribed with tiny constellations. The tail curls
proudly behind, tipped with a five-pointed flame-star that drifts
slow sparks upward. Phase 3 evolution: the mane detonates into a
true miniature star behind the head, three smaller satellite suns
orbit the body in slow rotation, the rosettes ignite with white fire. Palette: #ffcc22 gold base,
#aa6600 deep amber shade, #ffff88 sunlight highlight, #ffaa44 mane
aura. Transparent PNG background, 1-2 px black outlines, no anti-
aliasing, vibrant pixel-art style.
```

---

## ♍ VIRGO — Virga the Seraph · Lv 80

*"Winged maiden — heals her shards, banishes yours."*

**Sprite prompt:**

```
A massive six-winged celestial owl-beast in 16-bit pixel art, epic
idle pose — the embodiment of cosmic judgment as a divine creature,
no humanoid form. Three pairs of vast feathered wings unfurled in a
perfect heraldic display fan behind the body in symmetrical splendor:
the topmost pair edged in pale gold sweeping highest, the middle pair
ivory spread mid-height, the lowest pair tipped in glowing star-
feathers fanned outward. The body is that of a sacred owl — but the
size of a small whale — covered in overlapping luminous white-and-
cream plumage with constellation patterns woven into the feather
edges. Stance is regal and still: two enormous taloned feet of
polished silver grip a perch made of floating wheat-shafts of pure
light, body upright and proud, chest plumage puffed forward, the
entire silhouette as still as a stone monument. The head is owl-
shaped but adorned with a natural crown of bone-white horn-tines
fused into a radiant halo etched with celestial glyphs, the halo
holding its full width steady around the head. Eyes are six in
total — two large solid pure-white forward eyes plus four smaller
starlight eyes on the upper brow, all six open and gazing forward
in cosmic judgement. The beak is curved gold, closed in dignified
silence. Three small ribbon-bound prayer-scrolls orbit the body in
slow rotation. No clothing, no jewellery, no weapons — the divinity
is the bird itself. Phase 3 evolution: feathers turn pure incandescent
white-gold, the halo splits into three nested counter-rotating rings,
the four secondary eyes open into starlight beams. Palette: #ffeecc ivory base, #aaaa88
muted gold shade, #ffffff pure highlight, #ffee99 halo aura. Transparent
PNG background, 1-2 px black outlines, no anti-aliasing, vibrant
pixel-art style.
```

---

## ♎ LIBRA — Libra the Scalelord · Lv 82

*"Two plates — damage to one heals the other."*

**Sprite prompt:**

```
A colossal four-legged celestial chimera-beast in 16-bit pixel art,
epic idle pose — the embodiment of cosmic balance as a creature, no
humanoid form. Body of a regal great-cat fused with the antlers of a
deer and the long-tailed grace of a snow leopard, hide a shimmering
royal-bronze pelt overlaid with gold-leaf rosette markings shaped
like balance-glyphs. Stance is the iconic guardian-sphinx pose: front
legs extended forward and crossed at the wrists, hind legs tucked
beneath the body in a regal seated posture, chest raised proud, body
squared at a heroic 3/4 angle. The head is feline and noble, held
high and level, blindfolded by a naturally-grown band of star-thread
feathers that wraps across the eyes where the third-eye marking
sits. The two great branching antlers rise straight up and out from
the head in perfect heraldic symmetry — each antler ends in a giant
suspended glowing orb fused to the antler tips by living gold
tendons. The orbs hang at exactly equal height, perfectly level — the
LEFT antler holds a bright gold orb glowing with active radiance, the
RIGHT antler holds a softer bronze orb. Around the body, seven smaller
weight-token sigils orbit slowly in a stationary ring at chest height.
The tail is plumed with golden feathers that fade into ribbon-trails,
draped gracefully along one side. All four hooves are gold-plated and
still. Phase 3 evolution: the eye-band burns away revealing a single
all-seeing white star eye on the forehead, both orb-antlers glow
equally, a third antler sprouts from the spine carrying a balancing
pearl. Palette: #ccaa66
royal-bronze base, #664422 deep bronze shade, #ffeecc ivory highlight,
#ffcc88 gold-orb aura. Transparent PNG background, 1-2 px black
outlines, no anti-aliasing, vibrant pixel-art style.
```

---

## ♏ SCORPIO — Scorpio the Venomlord · Lv 84

*"Queen of the hollow ground — every stinger is lethal."*

**Sprite prompt:**

```
A colossal venomlord scorpion-beast in 16-bit pixel art, epic idle
pose — pure arthropod monarch, no humanoid features, no clothing, no
cape. Body is a vast jet-black armored carapace streaked with deep
magenta-purple bio-luminescent veins that pulse like exposed nerves
in slow rhythm. Stance is heraldic and still: eight thick chitinous
walking legs splay outward in a perfectly symmetrical wide planted
stance, each leg tipped in a violet crystal claw braced against the
basalt ground, body squared at a regal 3/4 angle. Two enormous front
pedipalp pincers are raised high and held wide above the head in a
ceremonial display — both pincers closed and held proud, the
segmented limbs arched into a crown silhouette framing the body, each
fitted with poison-dripping amethyst tips. The segmented tail arches
gracefully overhead in a tall vertical curl, the perfect needle
stinger of toxic violet glass held still at the apex, glowing softly
from within with banked venom — coiled but not striking. The carapace
plating along the dorsal ridge has grown into a natural crown of
nine purple obsidian spikes — no metal, no jewelry, just bone-glass
spike-growth. Eight glowing toxic-pink gem-eyes form a constellation
across the forehead, all eight gazing forward at the viewer. Around
the body, the basalt floor is cracked open in a circular burrow-
pattern; faint dust still drifts from old burrow shafts.
Phase 3 evolution: the carapace splits along the dorsal seam
revealing a glowing violet endoskeleton lit from within, the stinger
swells to twice its size and crackles with venom-electricity, two
extra spider-legs emerge from the side. Palette: #882266 royal-
violet base, #330022 deep shadow shade, #cc44aa pink-bright highlight,
#ff66cc venom aura. Transparent PNG background, 1-2 px black outlines,
no anti-aliasing, vibrant pixel-art style.
```

---

## ♐ SAGITTARIUS — Sagitta the Starchaser · Lv 86

*"Centaur archer — fills the sky with falling arrows."*

**Sprite prompt:**

```
A massive celestial comet-stag in 16-bit pixel art, epic idle pose —
a mythological four-legged star-beast that fires arrows from its own
antlers, no humanoid form, no rider, no torso, no held bow. Body is
a large noble stag of deep mahogany hide marked with glowing soft-
amber constellation tattoos along the flanks; mane and tail are
literal streaming comet-fire trailing behind in long ribbons of
light, draped at rest. Eyes glow pure white-gold, gazing forward with
serene intensity. Stance is regal and proud: all four crystalline
starlight hooves planted on the ground in a heroic squared stance,
the front-right hoof set just slightly forward in a stride-pause
silhouette, body angled in a 3/4 hero pose. The defining feature:
enormous antlers that have grown into the shape of a great recurve
bow — the antler bases form the bow's grip, the upper antler tines
curve and arc out to either side forming the upper and lower limbs
of the bow, and a glowing star-thread bowstring stretches taut between
the tine tips. The bowstring is at rest with no arrow nocked, holding
its perfect symmetrical curve. A halo of spare star-arrows orbits
the neck in a stationary ring. Behind the stag, a faint Sagittarius
glyph hovers in dim air. Beneath the hooves, faint meteor trails
linger from earlier movement but the body itself is completely still.
Phase 3 evolution: the antler-bow grows three additional ghostly
bow-arms branching at different angles, the comet-mane ignites pure
white-gold, the body is engulfed in a constellation-of-lines outline.
Palette: #aa6633 hide base, #552211 deep mahogany shade, #ffcc88
star-highlight, #ffaa66 arrow aura. Transparent PNG background,
1-2 px black outlines, no anti-aliasing, vibrant pixel-art style.
```

---

## ♑ CAPRICORN — Caprikor the Peaklord · Lv 88

*"Sea-goat of the summit — breath freezes the floor."*

**Sprite prompt:**

```
A massive cryptid sea-goat beast in 16-bit pixel art, epic idle pose
— purely creature, no armor, no warrior torso, no held staff. The
front half of the body is a colossal mountain-goat — thick frost-
blue fur in heavy mane folds along the chest and shoulders, four
sturdy goat-legs ending in cloven hooves of solid blue ice. The rear
half tapers and fuses into a long, coiling serpentine tail of
overlapping crystalline ice-scale plates that ends in an ornate ice-
fluke fin. Stance is regal and still: the beast is perched majestically
atop a tall jagged glacier-ice summit, all four hooves planted firmly
on the icy peak, body squared at a heroic 3/4 angle, with the long
serpent-tail coiled gracefully around the base of the ice pillar
beneath the body, the fluke-fin draped over the edge in a frozen
wave shape. Two enormous spiral horns of carved blue glacier-ice rise
from the goat-skull in a perfect symmetrical crown, each horn ringed
with floating frost-rune sigils. The face is heavy and ovine-feral
with a long muzzle, head raised proud and high; only a slow plume
of pale frost mist breath drifts from the nostrils. Two glacier-
blue eyes glow from deep beneath a brow of icicle-spikes. Beard is
long and frozen into pendant icicles. The mane along the spine is
crusted with snow. Around the summit, soft snow falls in a steady
hush. Phase 3 evolution: the fur turns pure snow-white, the spiral
horns triple in size and crackle with arctic lightning, the serpent-
tail extends and curls to twice its length, eyes glow pure-white. Palette: #88aaff cyan-ice
base, #334488 deep glacial shade, #ccddff frost highlight, #aaeeff
arctic aura. Transparent PNG background, 1-2 px black outlines, no
anti-aliasing, vibrant pixel-art style.
```

---

## ♒ AQUARIUS — Aqua the Tidesworn · Lv 89

*"Water-bearer — floods the arena in rising tides."*

**Sprite prompt:**

```
A colossal celestial leviathan-jellyfish in 16-bit pixel art, epic
idle pose — pure beast of living water, no humanoid form, no held
urn, no clothing. Body is a vast translucent dome of ocean-blue
water — the head/bell of a giant celestial jellyfish suspended in the
air, inside which entire schools of tiny silver star-fish swim in
slow spiraling currents. The bell is iridescent indigo and seafoam,
edged with a frilled rim of coral-blue tendrils, its dome held
perfectly upright in a tall regal cathedral-spire silhouette. Hanging
beneath the bell are eight enormous trailing tentacles of ribboned
water — each tentacle is itself a flowing river held in shape, with
tiny constellation fish swimming inside. The eight tentacles drape
downward in a perfectly symmetrical eightfold-skirt pattern beneath
the bell, like the hanging banners of a divine pavilion, their tips
curled gently inward into ornate vase-mouth openings that weep slow
single droplets rather than full columns. Where the eyes would be,
two deep oceanic-indigo orbs glow within the bell, calm and ancient,
gazing forward at the viewer. A halo of woven water-runes — the
Aquarius sigil — hovers steadily above the bell. The base of the
body fades into mist and rivulets, no feet, no ground; the whole
leviathan hangs serene in air. Phase 3 evolution: the bell inverts
upward into a great spiraling typhoon shape, the eight tentacles
split into sixteen, a massive tsunami-silhouette wave rises behind,
the entire body crackles with stormlight.
Palette: #22aadd ocean base, #113366 deep abyss shade, #aaeeff foam
highlight, #66ccff tide aura. Transparent PNG background, 1-2 px black
outlines, no anti-aliasing, vibrant pixel-art style.
```

---

## ♓ PISCES — Pisces the Twin Current · Lv 90

*"Two fish, one soul — swirls the map into a whirlpool."*

**Sprite prompt:**

```
The capstone of the zodiac pantheon — two enormous mythological
celestial koi-leviathans in 16-bit pixel art, epic idle pose. Each
fish is the size of a small whale, scales individually rendered as
miniature stars in a continuous mosaic. The two koi are bound at the
tail by a single glowing ribbon of pure starlight, locked in a perfect
frozen yin-yang infinity-loop posture — the entire silhouette held in
absolute stillness like a divine sigil suspended in space. The upper
fish has scales of moonlight violet-silver with a deep-pearl
underbelly; the lower fish has scales of deep ocean-indigo with a
midnight-blue underbelly. Both heads face outward and slightly toward
the viewer, framing the central pearl between them in a heraldic
display. Both have enormous trailing dorsal and caudal fins that
dissolve into ribboned nebula-cloud at the trailing edges, and long
sweeping whisker-barbels of pure light arcing forward from each face,
all held in motionless grace. Eyes are large white-gold pearls with
no visible pupils, gazing forward in serene cosmic awareness. From
the forehead of each fish grows a single bone-white horn-tine —
not a crown, a natural appendage — etched with constellation glyphs.
At the center of the swirling pair floats a glowing white-pearl orb
(their shared soul) at peak radiance, lighting both fish from below.
A slow rotating vortex of all 11 other zodiac sigils orbits the
entire scene as faint background glyphs. The fishes are airborne,
swimming through space. Phase 3 evolution: the two fish split fully
apart and orbit at greater distance, the central pearl pulsates and
emits visible inward gravity-lines that distort the surrounding
starscape, the nebula spiral tightens around the pearl. Palette: #aa88dd violet
base, #553388 deep mystic shade, #ddccff pure-light highlight, #cc99ff
cosmic aura. Transparent PNG background, 1-2 px black outlines, no
anti-aliasing, vibrant pixel-art style.
```

---

## After generation — wiring into the loader

The current zodiac bosses (`drawZodiacBoss` at L42912 and below) are
**procedural vector art** — there is no sprite-loader for them yet. To
swap to authored PNGs:

1. Register each `bosses/zodiac_<id>.png` via the existing `BG_IMAGES`
   pattern (see `bg_v3_aetherion.png` at L3438) into a new `BOSS_SPRITES`
   map. Alpha is preserved natively — no chroma-key pass needed since the
   PNGs ship with a transparent background.
2. In `drawZodiacBoss(m, sx, sy)`, gate on `BOSS_SPRITES.zodiac_<id>` —
   if the sprite is loaded, blit the still at the boss's screen position
   (scaled to the boss's `m.w / m.h` body box). Otherwise fall through to
   the existing procedural draw as a safe fallback.
3. Use the same still PNG in any boss intro / quest UI / death banner —
   one image covers all use cases since this pass is single-still only.

## Delivery checklist

- [ ] 12 sprite PNGs at exactly **1280 × 1280 px** with **transparent
      background** (alpha PNG, not chroma-keyed)
- [ ] Filenames lowercase: `bosses/zodiac_aries.png`,
      `bosses/zodiac_taurus.png`, etc. (id from `ZODIAC_SIGNS`)
- [ ] Alpha is clean — no semi-transparent halo bleed around the sprite
      edges. Anti-aliasing off or minimal so edges read crisp at draw scale.
- [ ] Each sprite anchored at horizontal center, base of body near canvas
      bottom so the engine can place the sprite on platforms cleanly
- [ ] **Beast aesthetic enforced** — no humanoid silhouettes, no held
      weapons, no metal armor / clothing. The divinity is the creature
      itself. Where lore implies a person (Virgo "maiden", Aquarius
      "bearer", Libra "judge", Sagittarius "centaur archer"), the form
      is reinterpreted as a divine animal embodying that role
      (six-winged owl, leviathan-jellyfish, antlered chimera, comet-stag).
- [ ] Visual identity per sign — no two bosses should be confusable as
      "the same animal with different palette". Vary species: ram, bull,
      stag, crab, lion, owl, chimera, scorpion, comet-stag, sea-goat,
      leviathan-jellyfish, twin-koi.

