# Equipment sprite template — locked spec (v0.25.304)

The MapleStory-style layered equipment system in this game treats every
visual gear piece as a single 800×800 PNG / WebP that overlays the
chibi character. The template below is **locked** — change it once,
re-author every existing piece. Don't.

> **Authoring in Photoshop?** See `PHOTOSHOP_GUIDE.md` (in the same
> folder) for the full step-by-step workflow — master template PSD
> setup, anchor layers, tint-friendly palette tips, export settings,
> and the most common pixel-misalignment gotchas. The doc below is
> the engine contract; the Photoshop guide is the artist's playbook.

## Canvas spec

| | |
|---|---|
| **Canvas size** | 800 × 800 |
| **Format** | WebP (preferred) or PNG, transparent background |
| **Color mode** | sRGB, 8-bit per channel |
| **Coordinate system** | (0,0) at top-left, (800,800) at bottom-right |

## Anchor map — paint your art relative to these

The chibi character's body parts always land at these pixel positions
inside the 800 × 800 canvas. Author your gear piece centred on the
matching anchor and it'll align on every character regardless of pose.

| Anchor | Position (x, y) | Notes |
|---|---|---|
| Top of head | (400, 130) | Crown of the head silhouette |
| Head centre | (400, 250) | Used by the v0.25.270 hair sprites — already proven |
| Chin / neckline | (400, 350) | Bottom of head, top of body |
| Shoulders | (320, 400) and (480, 400) | Left + right shoulder caps |
| Chest centre | (400, 440) | Where a chest insignia / armour focal sits |
| Hips / waist | (400, 520) | Top of pants / skirt / belt line |
| Hand grips | (260, 460) and (540, 460) | For weapon / glove anchor |
| Knees | (380, 600) and (420, 600) | Roughly — legs taper inward |
| Feet | (380, 720) and (420, 720) | Bottom of boots |

> Tip: include a `_chibi_reference.psd` as a PARTIALLY-VISIBLE bottom layer
> (10–20 % opacity) when you author each piece — the reference is your
> alignment guide and is never exported.

## Per-slot guidance

| Slot | What lands in the canvas |
|---|---|
| `cape` | Drawn behind the body. Paint from neckline (400, 350) flowing down past hips. |
| `body_bottom` | Pants / skirt / leg armour. Hips (400, 520) → just above ankles. |
| `body_top` | Shirt / chest plate / robe top. Neckline (400, 350) → hips (400, 520). |
| `boots` | Feet (380–420, 720) → roughly mid-shin (~y=620). |
| `gloves` | Hand grips (260, 460) and (540, 460) — both hands in one sprite. |
| `weapon` | Held in front hand (typically right-grip at 540, 460). One PNG = one weapon. |
| `helmet` | Top of head (400, 130) → just above eyes (y≈260). Don't cover the face. |

## Locked Ludo prompt prefix

When generating a new piece via Ludo.ai, **always** start the prompt with:

> "Chibi anime equipment piece for a layered character creator. Pure
> transparent background. Drawn on an 800×800 square canvas. Implied
> chibi character body anchored at: top of head (400,130), shoulders
> (320,400)/(480,400), hips (400,520), feet (380,720)/(420,720). Soft
> painterly cel-shaded anime style, MapleStory aesthetic, dark-fantasy
> palette. Render ONLY the [SLOT] piece — no character, no head, no
> face, no other clothing. Variant: …"

Replace `[SLOT]` with the slot name (cape / body_top / etc.) and add
the variant description at the end. Same prefix every time = consistent
alignment + style across the wardrobe.

> **Need ready-to-paste prompts?** See `EQUIPMENT_PROMPTS.md` (same
> folder) for a copy-paste prompt library: the locked prefix, per-slot
> anchor blocks, and ~80 pre-written variant lines (15 helmets, 12
> capes, 15 body tops, 12 body bottoms, 10 gloves, 10 boots, 20
> weapons). Drop into Ludo with three blocks of locked text + one
> variant line and the output aligns to the template automatically.

> **Generating sprites for items that already exist in `ITEM_POOL`?**
> See `EQUIPMENT_PROMPTS_PER_ITEM.md` for 38 palette-locked prompts —
> one per existing weapon + armor + cape/helmet item — with each
> item's authored `vis` hex colors injected so the sprite matches the
> in-game tooltip preview without manual tweaking.

## Filename → spriteId convention

Filename → sprite id mapping is **direct**: lowercase, snake_case, drop the
extension. No spaces.

| Filename | spriteId |
|---|---|
| `iron_plate.webp` | `iron_plate` |
| `red_cape.webp` | `red_cape` |
| `wizard_hat.webp` | `wizard_hat` |

Anything camelCase in the filename will be converted to snake_case by the
import script.

## Z-order (final, locked)

The renderer (in `_drawVectorHero`) draws the player in this order. Every
new equipment slot is already wired in — don't change this without
auditing every piece of art.

```
1. back-hair                   (existing, vector goo or sprite)
2. cape                        (NEW — back layer)
3. body_bottom                 (NEW)
4. body_top                    (NEW)
5. boots                       (NEW)
6. gloves                      (NEW)
7. back-hand weapon            (NEW — when dual-wielding, optional)
8. head silhouette             (existing — LX_HEAD)
9. front-hair                  (existing — LX_HAIR sprite)
10. face features              (existing — LX_EYES + LX_MOUTH)
11. helmet                     (NEW — top layer of head region)
12. front-hand weapon          (NEW — primary weapon overlay)
```

Slots 2–7 render BEFORE the head; slots 11–12 render AFTER the face.
The split is deliberate — items below the head sit behind the silhouette,
items above sit on top.

## Adding new equipment to the game

1. Author the sprite per the spec above; drop it into
   `Sprites/character/<slot>/<filename>.webp`.
2. Run `node scripts/import_equipment_sprites.mjs`. The script prints a
   ready-to-paste registry block + (optionally) wardrobe picker entries.
3. Paste the printed block into `maple_game.html` at the indicated
   location. The renderer picks it up on the next reload.
4. Reference the spriteId from your item definition:
   `{ id:'…', name:'…', slot:'body_top', spriteId:'iron_plate', tint:'#aaaadd' }`.

## Tint variants

The renderer applies `item.tint` (e.g. `'#cc4444'`) over the sprite via
`globalCompositeOperation = 'multiply'`. **One sprite = up to 5 items**
just by varying tint. Use this aggressively — re-tinting `iron_plate`
in red, blue, gold, etc. gives you a whole gear set off one piece of art.

Tints stack with the silhouette's existing colours (multiply darkens),
so paint your master sprite in a NEUTRAL light grey or warm cream when
you intend to support tinting. Pure white sprites multiply cleanly.
