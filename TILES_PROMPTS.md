# Floor-tile + town-object sprite prompts (v0.25.453)

Copy-paste prompt library for Ludo.ai / Midjourney / Stable Diffusion to
generate floor tiles, ground textures, and town props for every town in
LevelX. Same pattern as `EQUIPMENT_PROMPTS.md` and `SKILL_PROMPTS.md`:
paste the **locked prefix** verbatim every time so all outputs land on
a consistent transparent-PNG sprite spec, then add the **per-asset
block** that defines palette + form.

> **Recommended Ludo.ai settings**
> - `image_type`: `sprite`
> - `art_style`: `Anime/Manga`
> - `aspect_ratio`: `ar_1_1` for objects (square), `ar_2_1` for floor tile strips
> - `n`: 1
> - Output lands at 768×768 (or 1536×768 for tile strips), transparent PNG.
>
> **Recommended Midjourney/SDXL prompt suffix**
> - Append `--no background, --transparent, --tile, --ar 1:1` (Midjourney v6+)
> - SDXL: `transparent background, isolated on alpha, no scene, no environment, sprite asset, seamless tileable`

---

## [A] LOCKED PREFIX — paste verbatim every time

> Chibi anime 2D platformer asset for a MapleStory-aesthetic side-
> scrolling game. Pure transparent background — alpha channel only, no
> scene, no character, no sky, no shadow drop on the ground. Drawn in a
> soft painterly cel-shaded anime style with bold black outlines (1.5–
> 2 px), vibrant saturated colours, and crisp readable silhouettes at
> 32–64 px on screen. Drop shadow ONLY where it grounds the asset (a
> short ellipse beneath, not a whole-canvas tint). Render the asset
> head-on (face camera) for floor tiles and ¾-front for objects.

For **floor / ground tiles** add this line to the prefix:

> Seamless horizontal-tileable strip — left edge MUST mirror to right
> edge with zero seam. Render at 1536×768 with the ground surface
> filling the bottom 60 % of the canvas; the upper 40 % is fully
> transparent.

For **single objects** (lamps, signs, banners, anvils, crates, etc.)
add this line instead:

> Single object, centred on the canvas, head-on or ¾-front view.
> Background transparent. No floor, no shadow on the ground (object
> floats on alpha). 768×768.

---

## [B] FLOOR TILE STRIPS — per town

Each entry is a horizontal 1536×768 strip designed to repeat
seamlessly. Use the `seamless-tile` variant of the locked prefix.

### everdawn_central — town hub (warm cobble)
> Sun-warmed pale-grey cobblestone street strip. Hexagonal +
> rectangular flagstones in soft cream / pale rose / warm honey-grey
> tones. Subtle moss creep in the seams. Faint golden hour light wash
> across the top of the surface. Soft shadowed crevices (1 px thick
> outlines around each stone). Holiday town vibe — clean but lived-in.

### bastion — courtyard (sapphire + marble)
> Polished marble flagstones with sapphire-blue inlay strips running
> horizontally along the seams. Cream / ivory base with cool blue
> shadow tones. Each tile bears a faint embossed lion crest in the
> centre. Edges crisp and ceremonial. Light gold flecks in the marble
> grain. Reads as the parade-ground floor of a knight stronghold.

### bastion (throne room — interior)
> Deep indigo-violet polished stone tiles with metallic gold seams.
> Star-pattern fleur-de-lis motif faintly etched into every fourth
> tile. Centred carpet runner edge visible at top of strip
> (vermilion-red runner with gold tassel trim). Dim cathedral light
> wash. Reads as a holy throne-room aisle, intimate cathedral floor.

### shadowSlums — slum street (cracked feudal-Japanese stone)
> Cracked feudal-Japanese stone path with dark slate paving in
> uneven hex blocks. Violet-indigo undertones, deep shadow in the
> seams, faint pink lantern-glow caught on the high points. Patchy
> moss + scattered cherry-blossom petals. A single broken roof tile
> wedged into the path. Reads as rebel-faction ghetto street.

### emeraldVillage — cherry-blossom courtyard (jade flagstone)
> Jade-green flagstones in irregular polygons with cherry-blossom
> petal scatter. Vermilion-red border tiles every fourth slab, soft
> moss in the seams, faint koi-pond reflection caught at the top
> edge. Eastern village hamlet vibe — quiet, tended.

### azureAcademia — fountain plaza (silver + sapphire)
> Polished silver-marble flagstones with a subtle hexagon runic motif
> faintly etched into every other tile. Sapphire-blue shimmer veins
> running through the marble. Light fountain mist tint along the top.
> Reads as the central fountain plaza of a magical academy.

### jadeGrove — wooden walkway over marsh
> Weathered cedar planks running horizontally across the strip with
> visible knot-grain and a soft moss-fringe along the seams. Light
> pink cherry-blossom petals scattered across the grain. Misty white
> wash on the seams. Reads as a sacred wooden walkway over a koi
> pond.

### duneSands — sand-dune ground (warm gold)
> Wind-rippled fine sand in warm gold + ochre tones with darker
> burnt-sienna shadow lines following the ripples. A single bleached
> bone fragment half-buried at the right edge. Faint heat-haze
> shimmer caught at the top edge. Reads as Sahara-style dune surface.

### everdawn_marketplace — bazaar paving (terracotta + brass)
> Warm terracotta hexagonal tiles with brass-strip seams running
> across them. Faint scuff marks where caravan wheels have ground
> over the surface. Spice-stain rust tones in random patches. Reads
> as the central paving of a bustling bazaar.

---

## [C] PLATFORM / WALKWAY TILES — short repeating slabs

Smaller 768×384 horizontal slab textures for the floating platforms in
each town. Use the seamless-tile variant of the locked prefix and
specify the slab is **trimmed top + bottom** (no edge taper, just a
clean stripe).

### bastion-platform — marble parade dais
> Sapphire-trimmed cream marble slab with gold seam top + bottom and
> a centred lion-crest inlay. Polished, ceremonial.

### bastion-banner-walk — high stone walkway
> Pale flagstone walkway with a thin navy-blue silk banner draped off
> the right-hand front edge (gold tassel). Seamless top edge.

### bastionThrone-aisle — red-carpet step
> Cream marble step with a vermilion-red carpet runner centred on it,
> gold tassel trim along both long edges. Reads as the aisle approach
> to a throne dais.

### emeraldVillage-shrine — archery shrine plank
> Aged cedar plank slab with vermilion-red lacquer trim, jade-green
> banner draped from the front edge, gold-thread tassels. Reads as
> the surface of a sacred archery range.

### emeraldVillage-watchtower — sentinel post
> Stained dark-cedar slab with a small jade-paper lantern hanging
> from the front-right corner. Reads as the upper deck of a small
> watchtower.

### shadowSlums-roof — pagoda peak shingle
> Indigo-tile pagoda roof slab. Curved peak silhouette at the front
> edge, lacquer-shine highlight running across the top. Faint violet
> lantern-glow rimming the lower lip of the eaves. Reads as the apex
> of a feudal-Japanese house roof.

### shadowSlums-eaves — descending pagoda eaves
> Same indigo-tile palette as the peak slab but with a flatter,
> wider profile and a single small paper lantern hanging from the
> front-left corner. Reads as the lower tier of a tiered pagoda
> roof.

### shadowSlums-alley — wooden scaffolding
> Weathered dark-grey timber slab with cross-bracing visible
> underneath, soft purple lantern-glow on the top surface. Reads
> as the rickety scaffolding climbing up a slum alley.

### azureAcademia-fountain — silver fountain rim
> Silver-marble curved slab with sapphire-rune etching along the
> centre line, soft mist drifting up from the front edge. Reads as
> the rim of a glowing magical fountain.

### jadeGrove-walkway — pond plank
> Mossy cedar plank slab with cherry-blossom petals scattered on top,
> a thin reflection of jade water shimmering on the underside. Reads
> as a wooden walkway over a koi pond.

---

## [D] TOWN OBJECTS — single-object sprites (768×768 each)

Use the **single-object** variant of the locked prefix.

### Bastion — props

**bastion-banner**
> Tall navy-blue silk banner with a gold lion-rampant crest, hanging
> from a polished oak pole, gold tassels at the bottom edge. Slight
> wind-curl in the fabric. Reads as a knight-order ceremonial banner.

**bastion-anvil**
> Heavy black iron anvil on a thick oak stump base, sapphire-tinted
> cold-forge glow on the working surface, hammer leaning against the
> stump. Reads as Barnaby's smithy anvil — well-used, ceremonial.

**bastion-brazier**
> Tall brass tripod brazier with curling lion-paw legs, glowing ember
> bowl at the top, faint blue-flame plume rising. Reads as a knight-
> order eternal flame — sacred, watchful.

**bastion-watchtower-flag**
> Pointed pennant on a tall oak pole — slim navy + gold quartered
> heraldic flag, fluttering crisply. Reads as the flag at the top of
> a bastion watchtower.

**bastion-lion-statue**
> Small carved cream-marble lion statue, seated upright, sapphire
> gemstone eyes, gold-leaf collar. Reads as the dais sentinel of a
> ceremonial parade ground.

### Bastion Throne Room — props

**bastionThrone-throne**
> Carved oak throne with sapphire-blue velvet upholstery, gold
> filigree on the armrests, lion-rampant crest carved into the
> backrest, a single sword leaning against the right side. Reads
> as the High Commander's seat.

**bastionThrone-scribe-desk**
> Small dark-oak writing desk with an inkwell, a feather quill, an
> open ledger, and a single lit candle. Reads as Elena the scribe's
> personal alcove.

**bastionThrone-hearth**
> Stone fireplace with a low orange ember glow, copper kettle hanging
> from a hook above, a single sapphire-cushioned wooden stool beside
> it. Reads as a quiet hearth corner inside the throne hall.

**bastionThrone-prayer-candle**
> Cluster of three white prayer candles on a small marble plinth,
> golden flames, drips of wax pooled at the base. Reads as a small
> devotional shrine.

### Shadow-Woven Hood — props

**shadowSlums-paper-lantern**
> Round paper lantern in violet-indigo with a faint pink rune painted
> on the front, hanging from a thin black cord, soft purple glow.
> Reads as a stealth-faction signal lantern.

**shadowSlums-shuriken-rack**
> Dark-lacquered wooden rack with three shuriken slotted into it,
> faint purple glow on the steel edges. Reads as Kuro the sniper's
> equipment rack.

**shadowSlums-incense-coil**
> Spiral of dark grey incense smoke rising from a low black bowl,
> small ember glowing red at the centre. Reads as a stealth-faction
> meditation prop.

**shadowSlums-tatami**
> Small tatami mat with a violet trim border and a single black
> kunai laid across it, faint candle flame to one side. Reads as a
> rebel-faction floor sit.

**shadowSlums-banner-skull**
> Long black silk banner with a stylised purple skull crest, hanging
> from a dark bamboo pole. Reads as a Shadow-Woven faction banner.


### Emerald Village — props

**emeraldVillage-archery-target**
> Round straw archery target on a dark-cedar tripod, four red + white
> concentric rings, three arrows already embedded in the bullseye.
> Reads as Lady Hongyu's practice target.

**emeraldVillage-cherry-tree-branch**
> Single cherry-blossom branch in full bloom, soft pink petals,
> dark-bark texture, a few petals already drifting off the bottom
> edge. Reads as a hanging decoration over a shrine plinth.

**emeraldVillage-stone-lantern**
> Carved jade-stone lantern (Japanese ishi-doro style) with a small
> warm-yellow flame visible inside, moss creeping up the base. Reads
> as a village shrine lantern.

**emeraldVillage-herb-pot**
> Round terracotta clay pot with a thriving green herb cluster
> (basil-lookalike), small wooden tag tied to the rim with a hemp
> string. Reads as one of Master Shen's medicinal pots.

**emeraldVillage-koi-pond-edge**
> Small object: a wooden bucket dipped half into a jade-green pond,
> a single orange koi visible breaking the surface, water-droplet
> sheen on the bucket rim. Reads as a village pond-side prop.

**emeraldVillage-watchtower-bell**
> Small bronze bell on a thick rope, mounted on a dark-cedar bracket,
> faint vermilion-red tassel hanging from the clapper. Reads as Yun
> the sentinel's alarm bell.

### Generic small-town props (re-usable everywhere)

**signpost-wood**
> Two-arrow weathered wooden signpost on a slender oak post, blank
> arrow boards, small lantern hanging from the top. Reads as a
> generic town directional sign.

**market-stall**
> Small striped fabric awning over a low wooden table, half-empty
> baskets of fruit / cloth bolts / bread on the surface, dark cloth
> draped from the front edge. Reads as a generic market stall.

**barrel-stack**
> Two wooden barrels stacked, banded with dark iron hoops, one with
> the lid slightly ajar and a single apple visible. Reads as
> background storage prop.

**crate-stack**
> Three wooden crates stacked unevenly, faint stencil mark on the
> sides, a coiled length of rope draped over the top. Reads as
> bazaar / dock loading prop.

**well-stone**
> Round stone well with a peaked thatched roof, wooden bucket on a
> rope, mossy stones at the base. Reads as a generic village water
> well.

**wagon-empty**
> Small two-wheeled wooden cart with iron-rim wheels, hay scattered
> in the bed, a single wooden yoke on the front. Reads as a market /
> caravan transport prop.

**fence-rail**
> Two-rail wooden split-rail fence segment (3 posts, 2 horizontal
> rails), weathered cedar, tile-able horizontally. Reads as a
> village field-edge fence.

**hanging-flowerbasket**
> Small woven hanging basket with red + yellow flowers spilling over
> the rim, hung from a thin chain. Reads as a generic cosy town
> decoration (pairs well with Emerald Village + Everdawn Central).

---

## [E] WORKFLOW — wiring tiles + objects into the game

Floor tiles + platform tiles + objects all live in `Sprites/tiles/` or
`Sprites/objects/`. The current renderer draws platforms as solid
filled rectangles inside `drawWorld` / per-map procedural overlays;
adding tile sprites means hooking them into the same path.

Suggested filename convention:

| Asset class | Path | Filename |
| --- | --- | --- |
| Floor tile strip | `Sprites/tiles/floor/` | `<mapKey>_floor.webp` |
| Platform slab | `Sprites/tiles/platform/` | `<mapKey>_platform.webp` |
| Town object | `Sprites/objects/<mapKey>/` | `<assetSlug>.webp` |
| Generic prop | `Sprites/objects/_shared/` | `<assetSlug>.webp` |

Wiring steps (when ready to render them in-game):

1. Eager-load the floor + platform tile via the existing `_loadBG` /
   `_loadImage` helper in the asset section near `BAZAAR_PATHS`.
2. In `drawWorld` (after the existing background blit), draw the floor
   strip across the world width using `ctx.drawImage` + horizontal tile
   loop based on `mapData.worldWidth`.
3. For each `platforms[]` entry, draw the matching platform slab on top
   of the existing rectangle (or replace the rectangle entirely once all
   maps have art).
4. Town objects render via a new `mapData.props[]` array (parallel to
   `mapData.npcs[]`); place them at fixed `{x, y, key}` and draw them in
   the same per-map post-render pass.

Until the props array exists, generated objects are static reference
art — copy them into `Sprites/objects/` so they're ready when the
prop-rendering pipeline is added.

---

## [F] EXISTING REFERENCES (don't re-generate)

Already-present art under `Sprites/`:

- `backgrounds/bg_v3_*.png` — full-scene backgrounds for every map
  (don't replace; these define the painted skyline, terrain, and
  building silhouettes).
- `vfx/<skillKey>.webp` — per-skill VFX (see `SKILL_PROMPTS.md`).
- `equipment/<slug>.webp` — per-equipment renders (see
  `EQUIPMENT_PROMPTS.md`).

Empty / pending folders this doc covers:

- `Sprites/tiles/floor/` — floor tile strips (this doc, section [B])
- `Sprites/tiles/platform/` — platform slabs (this doc, section [C])
- `Sprites/objects/<mapKey>/` — town props (this doc, section [D])

If a folder doesn't exist yet, generate the asset first — the wiring
step (above) will add the folder when the renderer is hooked up.
