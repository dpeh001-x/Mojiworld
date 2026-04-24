# Background images

Drop any of the following PNGs into this folder and the game picks them up automatically on next load. If a file is missing, the game falls back to the procedural parallax (faceted low-poly mountains + pines from v0.25.11).

## Slots (v0.25.13)

| Filename | Vibe | Where it shows up by default |
|---|---|---|
| `bg_forest.png` | Bright sunny forest framing distant mountains. | Combat maps (cycled). |
| `bg_valley.png` | Mountain valley with oak + snow peaks + dirt strata. | Combat maps (cycled). |
| `bg_meadow.png` | Meadow with blossom tree, rocks, big cumulus clouds. | Combat maps (cycled). |
| `bg_misty.png` | Misty mountain forest with mossy ledges + eagle. | Combat maps (cycled — moodier maps feel heavier here). |
| `bg_homestead.png` | Farmhouse on a golden-grass hillside + sky clouds. | Town hub (`Everdawn Village`). |
| `main_bg.png` | Legacy single-image slot (v0.24.1). | Ignored if any of the five named slots is loaded. |

## Selection rules

1. **Explicit per-map override** — a map can set `mapData.bg = 'forest' | 'valley' | 'meadow' | 'misty' | 'homestead'` to pin a specific image. Takes highest priority.
2. **Town default** — maps with `isTown: true` pick `bg_homestead.png` first, falling back to `bg_valley.png`.
3. **Combat map cycle** — non-town maps deterministically pick one of the loaded outdoor slots by hashing their map ID, so different maps get different backdrops without you having to assign each one.
4. **Special backdrops** — sanctum cosmos, zodiac boss arenas, and the subway carriage ignore this folder entirely.
5. **Procedural fallback** — if no slot is loaded for the current map, the procedural parallax (faceted mountains + pines + flowers + sparkles) kicks in.

## Sizing

- Canvas renders at logical **960 × 560**; the HiDPI pass blits at 2× on Retina.
- Any aspect ratio works — the game stretches each image to the canvas. Closer to **16:9** looks best.
- 1024×1024 images (typical AI-gen output) work fine; they'll be horizontally tiled with a gentle camera parallax (~0.12×).
- PNG recommended; JPG works too if you rename.

## How it renders

1. Sky gradient paints first (always — even behind the bitmap, so tall/transparent PNGs blend).
2. If a bitmap is loaded for this map, it draws at ~0.12 camera-parallax over the sky.
3. A subtle atmospheric haze (`rgba(20,24,48,0.18)`) paints on top so foreground characters still pop.
4. If no bitmap is available, the procedural parallax (mountains → pines → flowers → sparkles) draws instead — that's the fully-coded fallback path.

## Pin a specific background to a specific map

Find the map definition in `maple_game.html` (search the `MAPS` object) and add a `bg:` field:

```js
MAPS.dark_cave = {
  name: 'Hollow Pass',
  // ...
  bg: 'misty',   // force the misty forest background on this map
};
```
