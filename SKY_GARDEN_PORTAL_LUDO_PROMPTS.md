# SKY GARDEN — Cloud Portal Sprite (ludo.ai prompts)

Re-skin of the portal that appears on **Sky Garden** (`skyGarden`,
`backgrounds/bg_v3_skyGarden.png`) — the purple galaxy-vortex currently reads
as an alien void rift against a bright cumulus sky.

Target: **light-blue, cloud-based** portal that belongs in the sky.

---

## ⚠ READ FIRST — this sprite is GLOBAL, not per-map

`Sprites/world/portal.webp` is a **single shared asset**. The renderer
(`mojiworld_game.html`, `drawPortals`) resolves it once as `LX_WORLD.portal`
and draws that same image for **every portal on every map** — swamp, frozen
peak, mushroom, grotto, all of them. There is no per-map sprite lookup.

So dropping a cloud portal in at that path turns **all** portals into cloud
portals, including the ones in caves and underwater.

Two ways forward — pick one before generating:

| Option | What happens | Code change |
| --- | --- | --- |
| **A. Global re-skin** | Every portal becomes the cloud version | none |
| **B. Sky-only variant** | Sky maps use `portal_cloud.webp`, everything else keeps the vortex | small — a per-map override in the portal draw path |

**Option B is the recommended one** and is a contained change: a
`MAPS[id].portalSprite` field, honoured where `LX_WORLD.portal` is read, with
the existing sprite as the fallback. Ask and I'll wire it.

### Halo colour needs changing too (either option)

The glow under the sprite is **not** part of the image — it's a baked canvas
gradient in `_getPortalHaloCanvas()`, hardcoded purple:

```
rgba(180,150,255,0.40)  →  rgba(120,90,200,0.16)  →  rgba(40,20,70,0)
```

A light-blue portal sitting in a violet halo will look wrong no matter how
good the sprite is. Suggested sky palette for that function:

```
rgba(210,240,255,0.42)  →  rgba(130,190,240,0.18)  →  rgba(40,80,120,0)
```

---

## Technical spec (matches the current asset exactly)

- **Canvas: 768×768**, exported/downscaled to **256×256** — the size of the
  file it replaces.
- **Transparent background.** No panel, no frame, no ground shadow, no text.
- **Drawn at 110×156 in game**, i.e. the square source is squashed ~30 %
  horizontally and stretched vertically. **Compose the art slightly WIDE and
  squat** so it resolves to a correct upright oval in play. A circle drawn in
  the source renders as a tall ellipse.
- Rendered at **`globalAlpha 0.65`** — it is semi-transparent in game, so keep
  values punchy; anything subtle will wash out.
- The engine adds its own gentle bob, halo, and 4 drifting white sparkles.
  **Don't bake sparkles, glow bloom, or motion blur into the sprite** — they
  double up.

Shared style line (paste in front of either prompt):

> Game asset sprite, painterly cel-shaded fantasy style, thick soft edges,
> vibrant but airy palette, single object centered, transparent background,
> no text, no panel, no drop shadow, 768x768.

---

## 1. Cloudgate — `portal_cloud.webp` (primary)

Game asset sprite: a MAGICAL SKY PORTAL made of swirling cloud. A wide
spiralling vortex of soft cumulus vapour — thick whipped-cream cloud lobes
coiling inward to a bright glowing core of warm white light (#fdfeff), like
sunlight breaking through the eye of a gentle storm. Cloud body in layered
light blues: pale sky (#dbeeff) on the outer billows, mid cornflower
(#8fc4ee) in the folds, soft periwinkle shadow (#5f95c8) where the spiral
turns under itself. Ringing the vortex, a slender floating halo band of
frosted glass-blue (#bfe3ff), tilted like a planet's ring and broken into a
few drifting wisps. A scatter of tiny suspended water droplets and 3–4 soft
white feather-wisps orbiting the rim. The whole thing reads as an inviting
doorway of living cloud — bright, breezy and welcoming, NOT a dark void
rift. Composed slightly wider than tall.

## 2. Stormeye — `portal_cloud.webp` (alt, cooler / more dramatic)

Game asset sprite: a SKY PORTAL shaped like the eye of a calm storm. Dense
ring of coiled storm-cloud in deeper blues (#4a7fb5, #6ba3d6) spiralling
tightly around a clear open centre that glows pale aqua-white (#eafaff),
suggesting bright open sky on the far side. Faint arcs of pale electric
cyan (#9fe8ff) trace the inner rim like distant sheet lightning — thin and
elegant, no harsh bolts. Outer edge feathers off into soft torn wisps.
A thin tilted ring of condensed vapour circles the whole portal. Cooler and
more powerful than version 1 while staying firmly light-blue and cloud-made.
Composed slightly wider than tall.

---

## After generating

1. Save as `Sprites/world/portal_cloud.webp` (Option B) or overwrite
   `Sprites/world/portal.webp` (Option A).
2. If overwriting: the file is preloaded in **two** places in
   `mojiworld_game.html` (the boot preload list and the map-stream list) —
   both reference the path, so no code edit is needed, but a hard refresh is
   required to clear the cached decode.
3. Check it against `bg_v3_skyGarden.png` specifically. A pale portal on a
   pale cloud background is the main risk — if it disappears into the
   backdrop, take version 2 (deeper blues) or deepen the outer lobes.
4. Bump `GAME_VERSION` and add a `CHANGELOG.html` entry.
