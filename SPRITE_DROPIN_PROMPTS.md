# Sprite drop-in paths + Ludo.ai prompts (v0.25.482 → v0.25.487)

This document collates every sprite path registered in the codebase since the underwater chain landed. Drop the generated `.webp` files into the listed folders and they auto-load on next page reload — the procedural fallback steps aside automatically.

## Directory map

| Path prefix | Loader | Used for |
| --- | --- | --- |
| `Sprites/monsters/{type}.webp` | `MONSTER_SPRITE_TYPES` (line ~37950) | Regular mobs |
| `Sprites/bosses/{type}.webp` | `BOSS_SPRITE_TYPES` (line ~38606) | Boss mobs |
| `Sprites/bosses/attack/{type}.webp` | `BOSS_ATTACK_SPRITES` | Optional attack pose for bosses |
| `Sprites/npc/{file}` | `NPC_SPRITE_FILES` | Town / map NPCs |

## Generation settings (Ludo.ai → Image Generator)

- **Aspect ratio**: square (1:1) for monsters and bosses; portrait (2:3 or 3:4) for NPCs.
- **Background**: transparent. If output has a flat background, run through `remove.bg` or the in-Ludo background remover before export.
- **Format**: PNG → re-export as `.webp` (lossless or quality 90+).
- **Outline**: every prompt below targets a **2 px black outline** matching the existing cel-shaded fauna look.
- **Pose**: idle / neutral facing camera. The renderers anchor by feet (or bbox bottom for floating mobs) — heads cropped or cut feet will sit wrong.

## Master style line (prepend to every prompt)

```
2D MMORPG cute monster sprite, full body shot, neutral idle pose, transparent background, cel-shaded illustrative style, clean thick 2 pixel black outline on every shape, painterly rendering, soft saturated cartoon colours, chibi proportions with oversized head and big expressive eyes, no text, no watermark, no UI elements.
```

---

# v0.25.482 — Underwater fish quintet

Five floating fish mobs for Coral Reef Depths + Abyssal Trench (Lv 25). Drop into `Sprites/monsters/`.

| Mob | File path | In-game name |
| --- | --- | --- |
| clownfish | `Sprites/monsters/clownfish.webp` | Clownie |
| pufferfish | `Sprites/monsters/pufferfish.webp` | Puffles |
| jellyfish | `Sprites/monsters/jellyfish.webp` | Jellybean |
| anglerfish | `Sprites/monsters/anglerfish.webp` | Lanternjaw |
| seahorse | `Sprites/monsters/seahorse.webp` | Hippocampus |

## clownfish (`clownfish.webp`)

> Clownie — a tiny chubby cartoon clownfish with a big rounded head and oversized expressive eyes. Bright orange body with two thick vertical white stripes outlined in dark orange. Small triangular tail fin and a perky dorsal fin. Friendly innocent expression with a tiny "o" mouth, gently floating. Pastel coral and warm orange palette with deep orange shadows.

## pufferfish (`pufferfish.webp`)

> Puffles — a perfectly round, very chubby cartoon pufferfish in its puffed-up state. Pale yellow body with eight short triangular spikes evenly spaced around the silhouette, each spike outlined in dark amber. Big watery anxious eyes, a tiny pursed mouth blowing a small bubble. Soft buttery yellow and warm tan palette.

## jellyfish (`jellyfish.webp`)

> Jellybean — a translucent dome-shaped cartoon jellyfish. Pastel violet bell with subtle inner glow, three long wavy ribbon tentacles dangling beneath. Two cute simple black-dot eyes inside the dome with a hint of soft pink blush. Floating gracefully, tentacles drifting. Lavender and dusty purple palette with subtle bioluminescent highlights.

## anglerfish (`anglerfish.webp`)

> Lanternjaw — a chunky deep-sea cartoon anglerfish with a wide oval body and stubby tail fin. Dark navy body, a single antenna arching forward from the top of the head ending in a glowing yellow lantern bulb. Big white circular eyes with tiny dark pupils, slightly grumpy expression, two small white triangular fang teeth visible. Deep midnight blue palette with bright lemon-yellow lure glow.

## seahorse (`seahorse.webp`)

> Hippocampus — a tall standing cartoon seahorse with the classic curled S-shape body and prehensile tail. Mint teal body with darker teal segmented ridges along its back, small fluttering side fin, long curled snout. Big curious eye, gentle smile, tail curled into a tight spiral. Soft mint and seafoam palette with cream highlights.

---

# v0.25.485 — Octobaby Lv 50 boss

The 8-tentacled boss of the Octopus Grotto. Drop into `Sprites/bosses/`.

| Boss | File path | In-game name |
| --- | --- | --- |
| octobaby | `Sprites/bosses/octobaby.webp` | Octobaby, the Eight-Mood Tyrant |

> Octobaby, the Eight-Mood Tyrant — a massive cute-but-angry cartoon octopus with an enormous round bulbous head taking up most of the silhouette. Vivid magenta-pink body with a darker plum belly band. Huge expressive white eyes with small black tracking pupils, sharply furrowed angry diagonal eyebrows above each eye, a tiny grumpy downturned mouth, soft pink cheek blushes that contrast with the angry expression. Eight chunky bezier-curved tentacles spread evenly around the base of the head, slightly wavy and animated, each tentacle ends in a suction-cup-style round tip. Each tentacle's tip has a subtle hint of a different status colour (purple, ice blue, orange, yellow). Slightly menacing yet adorable, like a furious plushie. Deep magenta and plum palette with bright effect-tint accents on the leg tips.

> **Optional attack pose** (`Sprites/bosses/attack/octobaby.webp`): Same character but with all 8 tentacles flexed outward in attack stance, eyes glowing brighter, mouth open in a yell, multiple round bubble projectiles emerging from the tentacle tips.

> **Note on the legs:** The 8 individual tentacles (`octoLegPoison`, `octoLegFreeze`, `octoLegSkillLock`, `octoLegStun`) are **drawn procedurally only** — they don't have separate sprite paths. The procedural renderer connects each leg's bezier shape to the head sprite at runtime. If you want individually rendered legs, register them in `MONSTER_SPRITE_TYPES` and add 4 more files to `Sprites/monsters/`.

---

# v0.25.487 — Sauro Slope + Koopa King

Two cute fat fire-spitting mobs + a Bowser-style Lv 30 boss.

| Entry | File path | In-game name |
| --- | --- | --- |
| fatLizard | `Sprites/monsters/fatLizard.webp` | Tubsalamander |
| fatDragon | `Sprites/monsters/fatDragon.webp` | Plumpdrake |
| koopaKing | `Sprites/bosses/koopaKing.webp` | King Koopaloo, the Ember Tyrant |

## fatLizard (`fatLizard.webp`)

> Tubsalamander — an oversized chubby cute cartoon salamander, very round and stout body. Bright fire-orange skin with a dark crimson belly stripe. Stubby short legs, a small tail, and a wide chunky head. Big round friendly eyes, tiny nostrils trailing wisps of smoke, mouth slightly open showing a hint of orange flame inside. Sitting in a relaxed pose with its belly almost touching the ground. Warm amber-orange palette with soot-grey accents.

## fatDragon (`fatDragon.webp`)

> Plumpdrake — a much larger and rounder cartoon dragon, almost spherical body, like a balloon dragon. Deep crimson red scales with a dark maroon belly. Tiny vestigial wings (clearly too small to fly), two small forward-curving horns, big lazy half-lidded eyes. Wide grumpy mouth slightly open with a small fireball forming inside. Sitting on a slope with a heavy posture. Deep volcanic red palette with charcoal grey accents.

## koopaKing (`koopaKing.webp`)

> King Koopaloo, the Ember Tyrant — a chunky Bowser-inspired cartoon turtle-dragon king. Massive spiked orange shell on the back with three white-tipped pyramid spikes along the top, an inner orange-tan rim. Tan-yellow belly plate on the front. Chunky stubby green-skinned legs ending in three sharp white claws each. Powerful arms with claws on the sides. Huge horned head with two forward-curving white horns, a fiery red mohawk-style hair tuft on top of the head, sharply furrowed angry diagonal eyebrows, big white eyes with red intense pupils, a wide menacing fanged grin showing two large protruding upward white tooth fangs from the lower jaw. Imposing royal stance, one fist raised slightly. Deep moss green and burnt orange palette with crimson and gold accents.

> **Optional attack pose** (`Sprites/bosses/attack/koopaKing.webp`): Same character mid-roar with mouth wide open belching a fireball, eyes glowing red, claws raised, fiery embers swirling around the body.

---

# Drop-in checklist

1. Generate the sprite via Ludo.ai with the master style line + the per-character prompt above.
2. Run through `remove.bg` if the background isn't already transparent.
3. Save as the listed filename (lowercase the type name where applicable). Use `.webp` quality 90+.
4. Drop into the listed folder.
5. Optionally archive the unprocessed render alongside as `{name}_raw.webp` (matches the existing convention).
6. Reload the game — `_loadMonsterSprites()` / `_loadBossSprites()` run at boot, swap procedural → painted automatically. No code changes required.

# Tweaks to know

- **If a sprite reads too tall or short next to the others**, look at `MONSTER_SPRITE_META` / `NPC_SPRITE_HEIGHTS` for size overrides (default monster render height is `m.h × 1.5`).
- **If a sprite is mis-anchored at the feet**, the loader's `_detectSpriteBboxBottom` finds the lowest opaque pixel automatically — but artwork with shadow / glow extending below the body confuses it. Crop tighter around the feet before exporting.
- **Outline thickness:** the existing fish + boss procedural draws use exactly 2 px black (`#0a0612`). Match this in Ludo prompts so the new art doesn't clash with the procedural fallback that will keep being used until every file is dropped in.
