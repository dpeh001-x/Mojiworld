# Wayfarer's Gauntlet — Sprite & Background Prompts

Asset-generation prompts for the **Lv 51–69 gauntlet chain** added in
v0.25.642. Five interconnected maps bridging Octopus Grotto (Lv 50) and
the Zodiac Sanctum (Lv 70). Lore: a route taken by a doomed expedition
trying to reach the zodiac by surface; each map is haunted by a different
stage of their failure.

**Connecting motifs** (re-use across all 5 maps in the BG art):
- Shattered hourglass / broken brass compass (their expedition icons)
- Tattered cobalt-and-gold banner shreds
- Adventurer footprints / ribcage silhouettes barely visible in the
  middle distance

## Style guide (shared)

- 16-bit pixel art, vibrant painterly palette, 1–2 px dark outlines,
  no anti-aliasing
- Monster sprites: **single still 256 × 256 PNG** with transparent
  background, 3/4 hero pose, weight settled, gaze toward player
- Background art: **1280 × 540 PNG**, parallax-ready (foreground +
  midground + sky bands compose vertically), transparent alpha allowed
  but solid sky band at the top
- Filenames: monsters → `Sprites/monsters/<id>.webp`; backgrounds →
  `backgrounds/bg_v3_<mapId>.png`

---

## MAP 1 — MAGMA FOUNDRY (Lv 53)

**Background** (`bg_v3_magmaFoundry.png`):
```
Side-scrolling 1280×540 painterly pixel-art backdrop of a colossal
underground forge cavern. Crimson-orange sky band: smoke + ash drifting
upward. Midground: titanic broken anvil silhouettes the size of houses,
brass bellows pipes weaving along the ceiling, lava pools glowing
between rock pillars. Foreground: cracked basalt platforms with rune-
carved iron supports. Tucked in the midground rubble: a shattered brass
hourglass on its side, half-buried adventurer pack with cobalt banner
shreds. Palette: #cc5520 lava, #7a2010 deep shadow, #3a1010 rock,
#ffaa66 hot highlights, #1a0808 darkest crevices.
```

**Monster sprites** (256×256, transparent PNG, 3/4 pose):

- **Forgewight** — `forgewight.webp` — A massive armored zombie smith,
  body forged into the broken anvil it wields, glowing molten cracks
  along its limbs, slag-iron helm welded to the skull, posture heavy
  and slow. Palette: #5a3520 plate, #aa5530 cracks, #ffaa44 forge-glow
  in the chest cavity. Holds a hammer the size of its torso.

- **Cinderling** — `cinderling.webp` — A small fast scrap-imp made of
  glowing embers wrapped in iron mesh, tiny legs, manic grin, sparks
  trailing. Mid-leap pose. Palette: #ffaa44 ember core, #cc4422 outer
  shell, #ffee88 spark highlights. Looks like a living bomb.

- **Bellowsbat** — `bellowsbat.webp` — A ceiling-hung leathery fire-bat,
  charcoal wings unfurled, ember-glow throat sac mid-breath, copper-pipe
  hooks on its claws. Hovering pose. Palette: #883322 wings, #ffaa66
  belly glow, #5a1010 outline shadow.

- **Smithgolem** — `smithgolem.webp` (mini-elite — make it look distinctly
  bigger / more menacing) — A 7-ft stone-and-iron golem with a forge in
  its chest, blacksmith's apron of scorched leather, one hand a hammer
  one a tong, runes etched across its shoulders. Stance heroic. Palette:
  #888888 stone, #cc7733 chest forge, #ffaa44 rune-glow, gold trim.

---

## MAP 2 — WITHERING TIDE (Lv 57)

**Background** (`bg_v3_witheringTide.png`):
```
Side-scrolling 1280×540 backdrop of a cursed coastline. Murky teal sky
band shot through with sickly green aurora. Midground: a wrecked
galleon listing on its side, broken mast jutting upward, tattered
sails. Behind it: distant cliffs and a ghostly green lighthouse beam
sweeping the fog. Foreground: half-submerged dock planks with barnacles
and rusted anchor chains, a cracked sea-stone shrine. Among the wreckage:
a snapped brass compass tangled in seaweed, cobalt banner shreds caught
on the mast. Palette: #0a1a2a deep, #3a5a6a mid, #88c0a0 ghost-green
highlight, #5a3a3a wet wood.
```

**Monster sprites**:

- **Bonebos'n** — `bonebosn.webp` — A pirate skeleton in a tattered
  navy coat and tricorne, dual rusted cutlasses crossed at the chest,
  pale gold buttons, hollow blue-flame eyes. Stance: ready-guard,
  feet braced on splintered deck. Palette: #d8d0b8 bone, #7a3a3a coat,
  #4488cc eye-flame.

- **Drowned Cur** — `drownedCur.webp` — A waterlogged ghost-hound,
  matted black fur dripping seawater, glowing teal eyes, ribs visible
  through translucent flank. Mid-lunge crouch. Palette: #3a5a6a wet
  fur, #1a2a3a deep shadow, #66ccaa eye/inner-glow.

- **Spectre Cannoneer** — `spectreCannoneer.webp` — A floating ghost
  in cracked artillery officer's uniform, brass spyglass in one hand,
  spectral cannon hovering at its hip, no legs (cloak fades to mist).
  Palette: #6a5a8a uniform, #3a2a4a shadow, #ddcc88 brass trim,
  spectral teal aura.

- **Brinekraken** — `brinekraken.webp` — A massive tentacle-monster
  emerging from below the platform line, 6 visible tentacles writhing,
  central beak-mouth glowing. Anchored pose (no body, just tentacles
  + beak). Palette: #2a6a6a flesh, #103030 deep shadow, #88ddcc
  bioluminescent suckers.

---

## MAP 3 — GLASSWIND STEPPE (Lv 61)

**Background** (`bg_v3_glasswindSteppe.png`):
```
Side-scrolling 1280×540 backdrop of a wide-open glass-shard tundra
under howling wind. Pale blue sky band fading to bone-white at horizon.
Midground: towering vertical glass-shard pillars (some intact, some
shattered), distant frozen plains, faint mirages shimmering. Foreground:
cracked glass-tile ground with grass tufts pushing through. Wind
streaks drawn as faint white lines diagonal across the scene. Tangled
in one of the foreground shards: a cobalt expedition banner shredded by
wind, broken brass spyglass at its base. Palette: #aac8e8 sky,
#5a7898 deep, #e8f0ff highlights, #1a3050 deep shadow.
```

**Monster sprites**:

- **Razorgale** — `razorgale.webp` — A flying hawk made of glass shards
  bound by wind, wings of overlapping translucent crystals, beak razor-
  sharp. Mid-glide. Palette: #cce8ff body, #3a6a88 shadow, #88ddff
  edge-light.

- **Glasswind Hare** — `glasswindHare.webp` — A fast slim hare with
  glass-shard fur tufts along its back, long ears swept by wind, eyes
  pale violet. Mid-sprint pose, hind legs blurred. Palette: #e8f0ff
  body, #88aacc shadow, #cc88ff eye.

- **Mirage Stalker** — `mirageStalker.webp` — A robed figure half-
  translucent, body splitting into 2-3 afterimages behind it, hood
  pulled low, glowing violet dagger drawn. Palette: #7888aa robe,
  #3a4868 shadow, #cc88ff dagger-glow.

- **Shardlich** — `shardlich.webp` — A caster lich with a face made of
  intersecting glass triangles, robes of fractured ice-crystal mesh,
  staff topped with a hovering shard. Levitating pose. Palette:
  #a0c0ff body, #3a5a8a shadow, #ddeeff highlight.

---

## MAP 4 — HOLLOW SEPULCHRE (Lv 65)

**Background** (`bg_v3_hollowSepulchre.png`):
```
Side-scrolling 1280×540 backdrop of a vast bone catacomb. Deep
purple-black sky band lit by drifting wisp-lanterns. Midground:
colossal arched rib-vaults (a giant beast's ribcage repurposed as
architecture), bone-pile shelves, candle-lined sarcophagi. Foreground:
cracked tomb-stone tiles, scattered armor pieces of fallen adventurers.
Stack of broken brass compasses and a torn cobalt banner stuck to a
spear driven into the floor in midground. Palette: #0a0814 deepest,
#2a1838 violet shadow, #c8c0a0 bone, #ddcc88 candle-flame.
```

**Monster sprites**:

- **Lichkin** — `lichkin.webp` — A lesser lich in moth-eaten silk
  robes, crown of finger-bones on its skull, one hand raised in a
  necromantic gesture, second hand clutching a femur. Palette: #c8c0a0
  bone, #5a4a3a robe, #ccaa66 crown glow.

- **Sepulchre Hound** — `sepulchreHound.webp` — A skeletal canine
  made of fused bones, no skin, ribs prominent, eye sockets glowing
  pale yellow. Mid-prowl pose. Palette: #888070 bone, #3a3a2a
  shadow, #ffee88 eye-glow.

- **Bone Wraith** — `boneWraith.webp` — A floating ghost with a
  skull face emerging from a hood of tattered fabric, body fading
  to mist below the waist, two skeletal hands raised. Palette:
  #aab0c8 mist, #3a3a5a deep, #ddddff highlight.

- **Tomb Keeper** — `tombKeeper.webp` (mini-elite — bigger / armored)
  — A massive armored skeleton in funeral plate, two-handed greatsword
  point-down in the ground, helm with a crest of vertebra, gold trim.
  Palette: #4a4858 plate, #aa9966 gold trim, #ddcc88 inner-eye glow.

---

## MAP 5 — WAYFARER'S LANTERN (Lv 68)

**Background** (`bg_v3_wayfarersLantern.png`):
```
Side-scrolling 1280×540 backdrop of an amber-lit pilgrimage shrine at
the chain's end. Warm amber-orange sky band, eternal flame braziers
casting soft glow. Midground: a colossal stone shrine carved with the
sigils of every preceding map (anvil, anchor, glass-shard, skull) —
sacred geometry. Statues of fallen heroes line the path, each holding
a lit lantern. Foreground: marble pilgrimage steps, scattered prayer
beads. Centerpiece: an intact brass hourglass standing upright on the
altar, restored — symbolising the path completed. A single cobalt
banner whole and proud beside it. Palette: #2a1810 deepest, #7a4a20
mid, #ffaa44 lantern glow, #ffe8b0 highlight.
```

**Monster sprites**:

- **Mournshade** — `mournshade.webp` — A weeping ghost of a fallen
  adventurer, translucent body in expedition gear (cobalt cloak, brass
  buckles), hood pulled up, dark mist swirling at its hands. Palette:
  #5a4a6a body, #2a1a3a deep, #88aaff tear-glow.

- **Lantern Wisp** — `lanternWisp.webp` — A floating amber wisp inside
  a hovering brass lantern, the lantern slightly cracked, soft glow
  emanating. Palette: #ffd470 core, #aa6622 lantern brass, #ffe8b0
  halo.

- **Echo Knight** — `echoKnight.webp` — A ghostly armored knight
  with a faint duplicate afterimage behind it, plate armor of polished
  silver-blue, two-handed greatsword raised in salute, hollow helm with
  blue inner flame. Palette: #888aac plate, #3a3a5a shadow, #66aaff
  inner-flame.

- **Path's Bane** — `pathsBane.webp` (mini-boss tier — make distinctly
  imposing) — A towering hooded executioner figure draped in amber
  robes, scythe taller than the figure itself, hood pulled low so only
  the lantern-eyes glow through, brass hourglass chained to its belt
  (cracked). Palette: #aa8844 robe, #4a2a1a shadow, #ffaa66 lantern-
  eye, gold trim.

---

## Delivery checklist

- [ ] 5 backgrounds at 1280×540, named `bg_v3_<mapId>.png`
- [ ] 20 monsters at 256×256 transparent PNG, named `<id>.webp`
- [ ] Connecting motifs (hourglass, brass compass, cobalt banner) visible
      in EVERY background — chain reads as one expedition
- [ ] Palette gradient progresses crimson → teal → glass-white → bone-
      gray → amber-glow across the 5 maps in order
- [ ] Pixel-art style, 1–2 px dark outlines, no anti-aliasing
- [ ] Mini-elites (Smithgolem, Tomb Keeper, Path's Bane) drawn distinctly
      larger / more menacing than baseline mobs in their map
