# Background images

Drop the current `bg_v3_*` image files into this folder and the game will use them on the next load. If a file is missing, the game falls back to the procedural parallax.

## Slots (v0.25.408)

| Filename | Vibe | Where it shows up by default |
|---|---|---|
| `bg_v3_forest.png` | Forest / grove art. | Emerald Thicket, Fungal Hollow, Elderwood-style maps. |
| `bg_v3_valley.png` | Mountain valley art. | Granite Bluffs and fallback cycling. |
| `bg_v3_meadow.png` | Bright meadow / coast art. | Sunset Coast and wildflower maps. |
| `bg_v3_misty.png` | Misty highland art. | Frozen Peak / lagoon fallback maps. |
| `bg_v3_dungeon.png` | Dark dungeon art. | Gelwater Grotto and Lava Cavern. |
| `bg_v3_everdawn bazaar.png` | Bazaar town spawn art. | Everdawn Bazaar first paint and runtime background. |
| `bg_v3_everdawnmarketplace.png` | Covered market town art. | Everdawn Marketplace and legacy homestead alias. |
| `bg_v3_worldMapInterface.gif` | Animated world map art. | World map modal backdrop. |

Additional authored `bg_v3_*` files are registered in `maple_game.html` for candy, bubblegum, celestial, underwater, zodiac, boss, and carriage maps.

## Selection Rules

1. Explicit per-map override: a map can set `mapData.bg` to a registered key such as `forest`, `valley`, `meadow`, `misty`, `dungeon`, `everdawnBazaar`, `everdawnMarketplace`, `zodiacSanctum`, or `carriageOfAscension`.
2. Town default: town maps pick the Everdawn Marketplace image first, with the old `homestead` key kept as a compatibility alias.
3. Cinematic art pack: launch with `?art=cinematic`, or set `localStorage.levelx_art_pack = "cinematic"`, to rotate through the bundled cinematic variants for non-town traversal maps.
4. Combat map cycle: when cinematic mode is off, non-town maps without an explicit `bg` deterministically pick one of the loaded outdoor slots by hashing their map ID.
5. Special backdrops: sanctum, zodiac, boss, and carriage maps pin their authored `bg_v3_*` files through explicit map keys.
6. Procedural fallback: if no bitmap is available for the current map, the coded parallax fallback draws instead.

## Sizing

- Canvas renders at logical 960 x 560; the HiDPI pass blits at 2x on Retina.
- 16:9 art works best because the game stretches the image to the canvas.
- PNG is recommended; GIF is used for the world map interface backdrop.

## Pin A Background

Find the map definition in `maple_game.html` and add or change its `bg` field:

```js
MAPS.dark_cave = {
  name: 'Hollow Pass',
  bg: 'misty',
};
```

## Art Quality Mode

- Classic visuals: `maple_game.html`
- Cinematic visuals: `maple_game.html?art=cinematic`
- Force classic: `maple_game.html?art=classic`
- Optional post-FX: `&artfx=soft`, `&artfx=vivid`, `&artfx=noir`, or `&artfx=0`
