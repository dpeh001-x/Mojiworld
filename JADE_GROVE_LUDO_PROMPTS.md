# The Jade Grove — Ludo.ai sprite prompts (v0.25.414)

Three sanctuary NPCs live in the new Jade Grove (right of Sky Garden, World Map ▶ The Jade Grove). The game already references the sprite filenames in `NPC_SPRITE_FILES` — drop the generated webps into `Sprites/npc/` and they auto-load on next page reload, replacing the procedural fallback.

| NPC | File path |
| --- | --- |
| Lady Hongyu | `Sprites/npc/lady_hongyu.webp` |
| Master Shen | `Sprites/npc/master_shen.webp` |
| Yun | `Sprites/npc/yun.webp` |

## Generation settings (Ludo.ai → Image Generator)

- **Aspect ratio**: portrait / 2:3 or 3:4 (matches the existing 640×864 sprites).
- **Background**: transparent. If the output has a flat colour, run it through `remove.bg` or Ludo's background remover.
- **Format**: PNG → re-export as `.webp` (lossless or quality 90+).
- **Pose**: full body, feet visible, slightly facing camera. The `_drawNpcSprite` renderer scales by feet-anchor — heads cropped or cut feet sit wrong.
- **Style anchor**: 2D hand-painted HD-2D Eastern fantasy aesthetic, soft lighting, organic shapes. Strict jade-green / vermilion-red / moss-brown / misty-white palette. Paste the master style line into every prompt.

## Master style line (prepend to every prompt)

```
2D high-resolution game sprite, hand-painted HD-2D aesthetic, full body shot from head to feet, isometric view, transparent background, vibrant Eastern fantasy color palette of jade green vermilion red moss brown and misty white, soft morning lighting, organic shapes, painterly texture, clean line art, consistent character heights, 4k resolution.
```

## NPC 1 — Lady Hongyu, the Divine Archer (`lady_hongyu.webp`)

> Lady Hongyu, descended deity and Celestial Guardian of the Jade Grove. A graceful, ethereal woman with long flowing black hair styled into elegant updo crowned with ornate jade hairpins. Calm, piercing gaze. She wears flowing crimson and white hanfu robes that float as if underwater, with wide trailing sleeves and silver embroidery of cranes and clouds along the hem. She holds "The Vermilion Reach," a tall longbow crafted from celestial wood, in her left hand; her right hand is drawn back in a serene fully-nocked posture, manifesting an arrow of pure red light at full draw. Stoic but compassionate expression. A faint divine aura outlines her silhouette. Color palette: vermilion red, cool white, jade green accents in the hairpins, gold filigree on the bow, soft pink blossom petals drifting around her.

## NPC 2 — Master Shen, the Root-Singer (`master_shen.webp`)

> Master Shen, an elderly hermit herbalist of the Jade Grove. A small, kindly old man with a long thin white beard reaching past his belt, deeply lined face, twinkling eyes, slightly hunched. He wears simple hemp robes in muted moss-brown and grey-green, frayed at the cuffs. A large wicker basket is strapped across his back, overflowing with rare forest fungi (red-and-white-spotted caps, pale mossfire-cap clusters), bundles of glowing pale-blue herbs, rolled bark scrolls, and a small brass kettle. He leans on a tall gnarled walking-stick of jade-tinted wood. Humorous and eccentric expression, mid-laugh, as if he were just speaking to a plant. Color palette: moss brown, hemp beige, soft jade highlights from the herbs, vermilion accents in the basket weave.

## NPC 3 — Yun, the Jade Sentinel (`yun.webp`)

> Yun, young village protector of the Jade Grove. A disciplined warrior in his early twenties, light lamellar armor painted forest green with dark leather lacing, carved jade pauldrons, and a navy under-tunic. Black hair tied into a samurai-style topknot. A carved wooden fox mask, lacquered red-and-white, rests on the side of his head, tied by a silk cord around the temple. He grips a tall slender spear with a polished jade blade-tip; the spear's haft is wrapped in green silk cord. Vigilant, focused stance, weight on the back foot, spear angled forward. A small wooden charm dangles from his belt. Color palette: forest green, navy, jade, red-and-white lacquer on the fox mask, polished bronze trim.

## After generating

1. Save each as `<filename>.webp` (lowercase + underscores) into `Sprites/npc/`.
2. Optionally save the original Ludo render as `<name>_raw.webp` next to it (matches the existing `*_raw.webp` archive convention).
3. Reload the game — `_loadNpcSprites()` runs at boot and the new NPCs swap from procedural to painted automatically. No code changes needed.
4. If a sprite reads too tall/short next to the others, add an entry to `NPC_SPRITE_HEIGHTS` in `maple_game.html` (default render height is 78 px; Sage Mira uses 115 px). Lady Hongyu may want a taller height to match her descended-deity stature.
