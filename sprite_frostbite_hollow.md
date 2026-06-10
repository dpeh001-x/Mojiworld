# Frostbite Hollow — Sprite & Background Prompts

Asset-generation prompts for the **Lv 12 Frostkin farm chamber** added in
v0.25.688. A small 3-layer side-room beside Frozen Peak (side door at
x:1000 of Frozen Peak's ground floor → x:80 inside the hollow). Tight
1100-px world width — the player sees the whole arena from the centre
without panning. Per user spec: "very small and easy to mob with good
spawn rate".

**Connecting motifs** (read as a Frozen Peak side-chamber):
- Ice-shard wall texture, frost crystalline lattice, frozen-over fungus
- Pale blue / cyan palette family, fading to near-white near the floor
- Subtle "buzzing-with-life" detail despite the cold — patches of moss
  under ice, frosted glow-mushrooms, a single intact ice-flower at the
  rear midground
- Should read as a **mid-level farm room** — cosy and quick, not the
  intimidating ascent of Frozen Peak itself

## Style guide (shared with v0.25.642 Gauntlet + earlier biome art)

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

## MAP 1 — FROSTBITE HOLLOW (Lv 12, only map in this batch)

**Background** (`bg_v3_frostbiteHollow.png`):
```
Side-scrolling 1280×540 painterly pixel-art backdrop of a small ice
grotto carved into the side of a vast mountain (subtle hint of Frozen
Peak's silhouette in the far background, partially veiled by mist).
Pale blue sky band at the top fading to soft cyan, gentle aurora-like
ribbons drifting through the upper third. Midground: a curved chamber
of pale blue ice walls, frost-crystal lattice catching imagined torch-
light, frozen-over fungus growths along the walls (cap-shaped lumps
sealed under ice). One intact pale-violet ice-flower in the rear-right
midground as a focal point. Foreground: a small mossy patch under
near-melted ice on the left (where the player's L1 portal platform
sits), cracked ice-floor tiles. Three pale tier-line platforms imagined
at y≈260, y≈370, y≈480 — leave gaps in the foreground / midground so
the in-engine platforms read cleanly against the BG.

Palette: #a8c8e8 sky, #d8e8f8 mid-sky, #f0f8ff highlight-sky,
#88aacc ice mid, #6688aa ice deep, #5a78a8 cave shadow,
#ccdef0 ice highlight, #b8ddff frost crystal, #4a6a88 deep shadow,
small accents of #c89ade ice-flower violet + #88aa66 moss green.

Mood: cosy, contained, light despite the cold. NOT looming or
dangerous — this is a farm room beside the actual tower.
```

**Foreground decoration overlay** (optional, `bg_v3_frostbiteHollow_fg.png`):
```
Optional parallax-foreground layer at 1280×120 (anchored to bottom):
chunks of jagged ice rubble + scattered frost crystals at near-ground
height. Transparent everywhere else. Render at 1.0× scroll speed (no
parallax) so they sit firmly in the play layer. Palette matches the
main BG's ice tones.
```

---

## MONSTERS — no new sprites required

Frostbite Hollow's spawns list is **Frostkin only** (`count: 14`). The
engine's `spawnMonster` function at L18518 procedurally rolls a 13 %
chance per spawn to mark a mob as `isElite` — elites reuse the base
Frostkin sprite at 1.25× scale with the standard "Elite " name prefix
+ 3× HP / 1.5× ATK / 2.2× EXP / 2.5× mesos tier multipliers. No
dedicated `eliteFrostkin` sprite asset is needed.

Existing Frostkin sprite: `Sprites/monsters/frostkin.webp` (already
in the project from v0.25.99-ish). If a future "explicit Elite Frostkin
variant" is desired (e.g. a recoloured ice-shard crown overlay), drop
a new prompt block below; the engine's spawn list would then need an
explicit `{type:'frostkinElite', count:N}` entry alongside the
existing `{type:'frostkin', count:14}`.

---

## Delivery checklist

- [ ] 1 background at 1280×540, named `bg_v3_frostbiteHollow.png`
- [ ] Optional foreground overlay at 1280×120, named
      `bg_v3_frostbiteHollow_fg.png` (skip if the main BG carries
      enough foreground detail)
- [ ] No new monster sprites — Frostkin asset is reused
- [ ] Connecting motifs visible: ice-crystal lattice, frozen-over
      fungus, ONE focal ice-flower
- [ ] Palette stays in cool blues / whites with the ice-flower violet
      + moss green as the only warm accents
- [ ] Pixel-art style, 1–2 px dark outlines, no anti-aliasing
- [ ] Mood reads "cosy farm room", NOT "intimidating ascent"
