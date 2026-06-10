# BLOOM REACHES — Plant Monster Sprites (ludo.ai prompts)

Static idle sprites ONLY for now (walk/attack anim frames come later as a
follow-up batch). One 768×768 image each, transparent background, no panel,
no ground shadow. Drop the results in as:

- `Sprites/monsters/thornmaw.webp`
- `Sprites/monsters/glimmercap.webp`
- `Sprites/monsters/vinelash.webp`

Until the sprites land, the game renders all three with the procedural
color/shell fallback, so the maps are playable immediately.

Shared style line (paste in front of each prompt):

> Cute chibi game monster, thick clean outlines, soft cel shading, vibrant
> colors, single character centered, full body visible, 3/4 front view,
> transparent background, no text, no panel, no drop shadow, 768x768.

---

## 1. Thornmaw — `thornmaw.webp` (Lv 52, Verdant Hollow)

Cute chibi game monster: a squat snapping BRAMBLE-JAW plant. Round mossy
body of tangled dark-green brambles (#2a5a1a) with a huge open venus-flytrap
mouth as the face — soft pink inside, blunt cartoon thorn-teeth, two tiny
stubby leaf-arms raised mid-snap. Bright leaf-green highlights (#4a8a3a),
a few small red berries caught in the brambles, mischievous half-lidded
eyes on the upper jaw. Grounded posture, slightly leaning forward like it's
about to lunge. Friendly-menacing, Maplestory-adjacent cuteness.

## 2. Glimmercap — `glimmercap.webp` (Lv 55, Bloomhaven fringe)

Cute chibi game monster: a tall BIOLUMINESCENT MUSHROOM spirit. Broad
teal-mint cap (#7ad4b0) studded with softly glowing cyan spots, gentle
light-rays drifting off the rim, sleepy contented eyes and a tiny smile on
the stem-face. Short stout stem with little root-feet, faint spore motes
floating around the cap (drawn as part of the character, not a background).
Deep teal shadow tones (#2a6a55). Serene, lantern-like, slightly eerie glow.

## 3. Vinelash — `vinelash.webp` (Lv 58, Thornspire Thicket)

Cute chibi game monster: a fast WHIP-VINE CREEPER. A coiled spring of
bright vines (#6aa83a) standing upright like a cobra, two long vine-arms
ending in leaf-blade whips raised to strike, narrow sharp eyes peering
from a hood of overlapping leaves (#3a6a1a), small thorns along every limb,
one cracked purple flower on its chest like a badge. Dynamic ready-to-lash
pose but feet (root cluster) planted. Energetic, wiry, predatory-cute.

---

After generating: if ludo returns an opaque colored panel instead of
transparency, run the border flood-fill fix (see memory note / prior gear
sprites). Verify each sprite reads clearly at ~96px in-game scale.
