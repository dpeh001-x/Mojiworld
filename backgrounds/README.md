# Background images

Drop any of the following PNGs into this folder and the game picks them up automatically on next load. If a file is missing, the game falls back to its procedural parallax (the faceted low-poly mountains + pines from v0.25.11).

## Slots

| Filename | Shown on | Expected art |
|---|---|---|
| `bg_forest.png` | All combat / outdoor / field maps (default) | Lush forest scene — reference: pixel-art oaks + snow mountains. |
| `bg_valley.png` | Town map (`Everdawn Village`) | Grassy valley hub — reference: painted meadow + church + lake + cumulus clouds. |
| `main_bg.png` | Legacy single-image fallback (v0.24.1) | Ignored if either of the two above is present. |

## Sizing

- Canvas renders at logical **960 × 560**; the HiDPI pass blits at 2× on Retina.
- Any aspect ratio works — the game stretches each image to the canvas. Closer to **16:9** looks best.
- PNG recommended (transparency not required). JPG works too if you rename.

## How it renders

1. Sky gradient paints first (always).
2. If a bitmap is loaded for this map, it draws at ~0.12 camera-parallax over the sky.
3. A subtle atmospheric haze (`rgba(20,24,48,0.18)`) paints on top so foreground characters still pop.
4. If no bitmap is available, the procedural parallax (mountains → pines → flowers → sparkles) draws instead — that's the fully-coded fallback path.

Special maps (sanctum cosmos, zodiac arenas, subway carriage) have their own authored backdrops and ignore these files entirely.
