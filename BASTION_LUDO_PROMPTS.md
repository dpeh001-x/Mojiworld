# The Bastion — Ludo.ai sprite prompts (v0.25.412)

Three knight NPCs live in the new Bastion complex (left of Everdawn Bazaar, World Map ◀ The Bastion). The game already references the sprite filenames in `NPC_SPRITE_FILES` — drop the generated webps into `Sprites/npc/` and they auto-load on next page reload, replacing the procedural fallback.

| NPC | File path | Lives in |
| --- | --- | --- |
| Will | `Sprites/npc/will.webp` | `bastionThrone` (throne dais) |
| Elena | `Sprites/npc/elena.webp` | `bastionThrone` (records desk) |
| Barnaby | `Sprites/npc/barnaby.webp` | `bastion` (training courtyard forge) |

## Generation settings (Ludo.ai → Image Generator)

- **Aspect ratio**: portrait / 2:3 or 3:4 (matches the existing 640×864 sprites).
- **Background**: transparent. If the output has a flat colour, run it through `remove.bg` or Ludo's background remover.
- **Format**: PNG → re-export as `.webp` (lossless or quality 90+).
- **Pose**: full body, feet visible, slightly facing camera. The `_drawNpcSprite` renderer scales by feet-anchor — heads cropped or cut feet sit wrong.
- **Style anchor**: match the existing painted NPC pack (Fashionista / Sage Mira / Brok). Paste the master style line into every prompt.

## Master style line (prepend to every prompt)

```
2D MMORPG high-quality concept art, detailed sprite illustrative aesthetic, full body shot from head to feet, dynamic idle pose, transparent background, painterly rendering, clean line art, fantasy MMORPG aesthetic, bright heroic colors, sapphire blue and white marble and burnished gold color palette, sun-drenched cinematic lighting, 4k resolution.
```

## NPC 1 — Will, the Undefeated Champion (`will.webp`)

> Will, High Commander of the Bastion. A towering knight in full plate armor polished to a mirror finish, sapphire-blue inlays glinting along every joint. He wears a flowing sapphire cape that pools at his feet and a closed helm topped with a tall golden plume. His face — kind but stern, with a neatly trimmed beard — is partly visible through a raised visor. He grips a massive two-handed claymore named "Justice's Breath" point-down before him; the blade radiates a soft white light, as if the metal were holding back dawn. Heroic stance, weight settled, calm booming presence. Bright sapphire blue, mirror silver, and burnished gold color palette. Clean line art.

## NPC 2 — Elena, the Master of Records (`elena.webp`)

> Elena the Scribe, knight-priestess of the Bastion. She wears light silver chainmail under flowing white liturgical robes trimmed in gold sigils, the chainmail catching small highlights at the cuffs and hem. She carries a heavy leather-bound tome in one arm — gilt edges, page-marker ribbons in navy — and writes in mid-air with a quill made from a shimmering phoenix feather that leaves a faint trail of warm sparks. Her expression is precise, intellectual, attentive. Standing pose, slightly turned, ready to record a deed. Color palette: white robes, polished silver chain, soft gold trim, glowing phoenix-feather amber. Highly detailed sprite art.

## NPC 3 — Barnaby, the Iron Anvil (`barnaby.webp`)

> Barnaby, Bastion blacksmith, a burly older retired knight. He wears a heavy soot-blackened leather apron over his greaves, scuffed pauldrons buckled over the apron straps. His left leg has a slight stiffness from an old battlefield injury, hinted at by a brace. Scarred face, broad smile, white beard, hair tied back. He grips a large blacksmith's hammer in his right hand, head resting on his shoulder, and a glowing-red half-finished blade in tongs in his left. Apron and bracers tarnished bronze; armor scratched silver; the forge light underlights him in warm orange. Earthy and jovial pose. Color palette: scuffed silver, leather brown, bronze, hot-iron amber. Highly detailed sprite art.

## After generating

1. Save each as `<name>.webp` (lowercase) into `Sprites/npc/`.
2. Optionally save the original Ludo render as `<name>_raw.webp` next to it (matches the existing `*_raw.webp` archive convention).
3. Reload the game — `_loadNpcSprites()` runs at boot and the new NPCs swap from procedural to painted automatically. No code changes needed.
4. If a sprite reads too tall/short next to the others, add an entry to `NPC_SPRITE_HEIGHTS` in `maple_game.html` (default render height is 78 px; Sage Mira uses 115 px).
