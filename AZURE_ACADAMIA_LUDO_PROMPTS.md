# The Azure Acadamia — Ludo.ai sprite prompts (v0.25.413)

Three mage NPCs live in the new Acadamia complex (left of Tidal Lagoon, World Map ◀ The Azure Acadamia). The game already references the sprite filenames in `NPC_SPRITE_FILES` — drop the generated webps into `Sprites/npc/` and they auto-load on next page reload, replacing the procedural fallback.

| NPC | File path | Lives in |
| --- | --- | --- |
| Hera | `Sprites/npc/hera.webp` | `azureAbode` (floating bubble-room) |
| Auron | `Sprites/npc/auron.webp` | `azureAcademia` (library / records desk) |
| Lyra | `Sprites/npc/lyra.webp` | `azureAcademia` (training plaza) |

## Generation settings (Ludo.ai → Image Generator)

- **Aspect ratio**: portrait / 2:3 or 3:4 (matches the existing 640×864 sprites).
- **Background**: transparent. If the output has a flat colour, run it through `remove.bg` or Ludo's background remover.
- **Format**: PNG → re-export as `.webp` (lossless or quality 90+).
- **Pose**: full body, feet visible, slightly facing camera. The `_drawNpcSprite` renderer scales by feet-anchor — heads cropped or cut feet sit wrong.
- **Style anchor**: classic high-quality 2D MMORPG aesthetic, MapleStory-style hand-drawn digital art with painterly texture. Strict blue/silver/white palette. Paste the master style line into every prompt.

## Master style line (prepend to every prompt)

```
2D MMORPG high-quality concept art, classic hand-drawn digital art with painterly texture, MapleStory-style sprite illustrative aesthetic, full body shot from head to feet, transparent background, soft glowing blue magical aura pervading the figure, mystical wonder atmosphere, color palette strictly sapphire cobalt electric-blue sky-blue with silver white and dark grey accents, clean line art, 4k resolution.
```

## NPC 1 — Hera, the Azure Archmage (`hera.webp`)

> Hera, charismatic leader of the Acadamia restoration. A beautiful, confident wizard with long, wavy, deep sapphire-blue hair that seems to shift slightly like flowing water. Striking silver eyes. She wears an elegant stylized wizard's robe of flowing dark-blue silk with silver embroidery of celestial patterns; the robe has tasteful cutouts and a thigh-high slit, retaining a majestic powerful silhouette. A silver circlet rests on her forehead, and a large sapphire amulet hangs at her throat. Confident standing pose, holding a tall ornate staff topped with a large swirling blue crystal orb that hums with energy; her other hand is raised, casually conjuring small dancing blue magical symbols mid-air. A faint blue magical glow emanates from her jewellery and her staff. Color palette: deep sapphire, electric blue, silver, white.

## NPC 2 — Auron, the Scholarly Elder (`auron.webp`)

> Auron, the Acadamia's head librarian and lorekeeper. An elderly man with a long flowing white beard and kind bespectacled eyes; slightly hunched posture from a lifetime of study. He wears practical layered scholarly robes in dusty blues and grey-blue fabrics, covered in patches and deep pockets stuffed with rolled scrolls, quills, and small potion vials. A heavy blue-velvet cowl drapes over his shoulders. Seated pose at a large cluttered desk of blue-tinted wood, peering intently at a massive open magical tome — one hand holds a quill that writes in glowing blue ink. Stacks of books, rolled parchment, and a small glowing-blue desk lamp powered by magic surround him. Looks like he might nod off but is sharp when engaged. Color palette: dusty navy, grey-blue, soft silver, glowing-blue ink accents.

## NPC 3 — Lyra, the Aspiring Sorceress (`lyra.webp`)

> Lyra, a young apprentice wizard, energetic and determined. Shorter spiky light-blue hair, bright eyes, expression focused but slightly excited. She wears a simpler practical apprentice uniform: a knee-length sky-blue tunic with darker blue trim, sturdy brown leather boots, a utility belt with pouches, and a simple satchel slung over one shoulder. Active practising pose: hands cupped before her, looking intently at a small swirling ball of concentrated blue magical energy she is actively conjuring between her palms. Tiny puffs of blue smoke and a few errant sparks float around her fingers showing she is still learning. A determined smile. Color palette: sky blue, navy trim, warm leather brown, sparks of electric blue.

## After generating

1. Save each as `<name>.webp` (lowercase) into `Sprites/npc/`.
2. Optionally save the original Ludo render as `<name>_raw.webp` next to it (matches the existing `*_raw.webp` archive convention).
3. Reload the game — `_loadNpcSprites()` runs at boot and the new NPCs swap from procedural to painted automatically. No code changes needed.
4. If a sprite reads too tall/short next to the others, add an entry to `NPC_SPRITE_HEIGHTS` in `maple_game.html` (default render height is 78 px; Sage Mira uses 115 px). Hera in particular may want a taller height (e.g. 100 px) to match her archmage stature.
