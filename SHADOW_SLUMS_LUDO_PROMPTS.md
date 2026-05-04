# Shadow-Woven Slums — Ludo.ai sprite prompts (v0.25.411)

Three NPCs live in the new map (right of Sweet Candy Canyon, World Map ▶ Shadow-Woven Slums). The game already references the sprite filenames in `NPC_SPRITE_FILES` — drop the generated webps into `Sprites/npc/` and they auto-load on next page reload, replacing the procedural fallback.

| NPC | File path |
| --- | --- |
| Taiga | `Sprites/npc/taiga.webp` |
| Kuro | `Sprites/npc/kuro.webp` |
| Ren | `Sprites/npc/ren.webp` |

## Generation settings (Ludo.ai → Image Generator)

- **Aspect ratio**: portrait / 2:3 or 3:4 (matches the existing 640×864 sprites).
- **Background**: transparent. If Ludo.ai output has a flat background, run it through `remove.bg` or the in-Ludo background remover before exporting.
- **Format**: PNG → re-export as `.webp` (lossless or quality 90+).
- **Pose**: full body, feet visible, slightly facing camera. The `_drawNpcSprite` renderer scales by feet-anchor — heads cropped or cut feet will sit wrong.
- **Style anchor**: match the existing slum-friendly pack — Fashionista / Sage Mira / Brok have the right detailed-illustrative feel. Paste the master style line into every prompt.

## Master style line (prepend to every prompt)

```
2D MMORPG high-quality concept art, detailed sprite illustrative aesthetic, full body shot from head to feet, dynamic idle pose, transparent background, painterly rendering, clean line art, dark fantasy anime style, deep violet and obsidian color palette dominated by neon purples midnight blues and pitch black with stark contrasting silver and faded gold highlights, cinematic moody lighting.
```

## NPC 1 — Taiga (`taiga.webp`)

> Taiga, a fearless master of the ninjutsu arts and the leader of a rebel faction. Commanding, intimidating presence. Fusion of traditional ninja garb and rugged urban streetwear: baggy tactical pants, heavily worn arm guards, and a tattered flowing dark-purple scarf that looks like it is made of living shadows trailing behind him. Half of his face is covered by a sleek menacing oni half-mask. His visible eye glows with an intense violet light. He holds a pair of kunai daggers that drip with dark purple shadow energy. Dynamic idle pose, weight on the back foot, scarf billowing. Deep purple and obsidian color palette. Clean line art.

## NPC 2 — Kuro (`kuro.webp`)

> Kuro, a stoic samurai who has abandoned honorable combat to master quick shadow arts. He wears heavily battered and rusted O-yoroi samurai armor draped in a dark hooded cloak that conceals his identity in the slums. The armor features faded gold accents that hint at the city's former glory, now corrupted by tendrils of shadow. He is unsheathing a long katana — the blade is entirely composed of crackling, dark purple shadow magic, smoking and arcing with violet electricity. Imposing, grounded stance, one foot forward, blade halfway out of the saya. Deep purple and tarnished bronze color palette. Dark fantasy anime style.

## NPC 3 — Ren (`ren.webp`)

> Ren, a nimble and street-smart ghetto thief, dressed for maximum agility in the urban slums. She wears tight black stealth leggings, a cropped tech-wear jacket, and a multi-layered utility belt loaded with stolen scrolls, smoke bombs, and lockpicks. A dark bandana covers her nose and mouth. Shadowy purple smoke naturally trails from her boots and fingertips, showing her mastery of quick shadow arts for evasion. Crouching, ready-to-sprint posture, fingers splayed and pulsing with violet smoke, playful but dangerous eyes. Deep violet and slate grey color palette. Highly detailed sprite art.

## After generating

1. Save each as `<name>.webp` (lowercase) into `Sprites/npc/`.
2. Optionally save the original Ludo render as `<name>_raw.webp` next to it (matches the existing `*_raw.webp` convention so the unprocessed asset stays archived).
3. Reload the game — `_loadNpcSprites()` runs at boot and the new NPCs swap from procedural to painted automatically. No code changes needed.
4. If a sprite reads too tall/short next to the others, add an entry to `NPC_SPRITE_HEIGHTS` in `maple_game.html` (default render height is 78 px; Sage Mira uses 115 px because she's a sky-elder).
