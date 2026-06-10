# 🧸 Character Sprite Generation Prompts — Copy Paste into Gemini / Nano-Banana

**Read this first:**

1. **Every prompt uses the same Master Header.** Paste it once at the top of each prompt.
2. **Generate one sheet at a time.** Each output is 1536 × 384 px (6 frames × 256 × 384 at 8× upscale).
3. **Save files with the exact filenames** below — the game's loader expects these paths.
4. **Start with BASE_MALE**. Every overlay is anchored to the base's anatomy, so the base has to be right before the overlays will line up.
5. **Downsample** each generated sheet to **192 × 48** with nearest-neighbor before saving. Tools: Photoshop (Image Size → Nearest Neighbor), GIMP (Image → Scale Image → Interpolation: None), or free online tool `ezgif.com/resize`.

---

## 🎨 MASTER HEADER (prepend to every prompt below)

```
Generate a single horizontal pixel art sprite sheet on a solid pure white
#FFFFFF background, exactly 1536 pixels wide by 384 pixels tall. The
sheet contains SIX frames of the same subject in different poses. Each
frame cell is 256 wide by 384 tall (the final image downsamples to
192×48 with each cell 32×48). Thin vertical solid white lines separate
the 6 frame cells.

Art style: 16-bit SNES era pixel art at 8× upscale, cute chibi Mojiworld-
inspired look but plumper and softer (infant-chibi proportions — huge
round head, short stubby legs, tiny waist). Limited 16-color palette,
bold 1-pixel dark outline on every shape, cel-shaded with 2 tone bands
per material, warm key light from upper-left. Crisp stepped pixel
edges — absolutely NO anti-aliased blur, NO painterly strokes, NO
gradient halos.

Every frame must have the subject horizontally centered within its cell
at x=16 (of the final 32-wide cell) and its feet/bottom planted at the
very bottom edge (y=48). No vertical drift between frames — all motion
happens in the upper body. All 6 frames show the SAME subject, not six
different subjects.

Absolute bans: no text, no labels, no frame numbers, no grid lines (only
the thin white frame separators), no captions, no watermark, no ground
shadow, no environmental props, no speech bubbles.
```

---

# 📋 PART 1 — BASE BODIES (2 files)

## 1. `sprites/character/base_male.png`

```
[MASTER HEADER]

Subject: a super-cute bald chibi young male adventurer, same character in
all 6 frames, always facing camera-right.

Appearance (every frame):
- HUGE round peach-skinned head filling the top ~40% of each cell
- Two large black dot eyes with tiny white catchlight highlights
- Thin black eyebrows arching gently upward (friendly expression)
- Soft pink blush circles on both cheeks
- Tiny curved closed-mouth smile
- BALD — no hair, no visible ears
- Very short neck merging into a plump bean-shaped torso
- Simple grey sleeveless tank-top undershirt covering the torso
- Bare peach-skinned arms with rounded mitten-style hands (no detailed fingers)
- Bare peach-skinned chubby thighs and calves
- Tiny brown laced ankle boots on both feet
- Feet planted at the very bottom edge (y=48) in EVERY frame

Poses per frame (left to right):
Frame 1 — IDLE: standing relaxed, arms hanging loose at sides, eyes forward.
Frame 2 — WALK-1: LEFT foot stepped forward, RIGHT arm swung slightly back,
  torso tilted just a touch forward.
Frame 3 — WALK-2: RIGHT foot stepped forward, LEFT arm swung back, mirror
  of frame 2.
Frame 4 — JUMP: both knees bent and tucked up toward chest as if lifting
  off, both arms flung back for momentum, big open eyes, mouth slightly open.
Frame 5 — ATTACK-MID: body coiled, RIGHT arm raised overhead as if winding
  up a swing, left arm counterbalanced forward, eyes narrowed in focus.
Frame 6 — ATTACK-END: RIGHT arm swept down and forward past the body,
  right foot stepped slightly forward, mouth open in a shout.
```

## 2. `sprites/character/base_female.png`

```
[MASTER HEADER]

Subject: a super-cute bald chibi young female adventurer, same character
in all 6 frames, always facing camera-right.

Appearance (every frame):
- HUGE round peach-skinned head filling the top ~40% of each cell
- Two large black dot eyes with tiny white catchlight highlights
- Thin black eyebrows arching gently upward
- Soft ROSE-PINK blush circles on both cheeks (brighter than male variant)
- Tiny curved smile with a small lip highlight
- BALD — no hair, no visible ears (hair is an overlay, always)
- Slightly narrower shoulders than male base, softer jawline
- Simple grey sleeveless tank-top undershirt, slightly fitted at waist
- Bare peach-skinned arms with rounded mitten-style hands
- Bare peach-skinned chubby thighs and calves
- Tiny brown laced ankle boots on both feet
- Feet planted at the very bottom edge (y=48) in EVERY frame

Poses per frame (identical to male base):
Frame 1 — IDLE: standing relaxed, arms at sides.
Frame 2 — WALK-1: left foot forward, right arm back.
Frame 3 — WALK-2: right foot forward, left arm back.
Frame 4 — JUMP: knees tucked, arms flung back.
Frame 5 — ATTACK-MID: right arm raised overhead, body coiled.
Frame 6 — ATTACK-END: right arm swept down-forward, shout.
```

---

# 💇 PART 2 — HAIR OVERLAYS (4 files)

**Reminder for all hair prompts:** no body, no face, no accessories — just the hair silhouette in each frame, correctly positioned on an invisible head whose top is at pixel y=4 and whose scalp center is at x=16 (of the final 32×48 cell).

## 3. `sprites/character/overlays/hair/spiky_brown.png`

```
[MASTER HEADER]

Subject: HAIRSTYLE OVERLAY ONLY — no body, no face, no accessories.
Each of the 6 frames shows hair in the pose it would take if an invisible
base character were animating through: idle / walk-1 / walk-2 / jump /
attack-mid / attack-end.

Style: short spiky anime chestnut-brown hair with chunky jagged tufts
sticking up from the crown, a tuft falling over the forehead in bangs,
and small side-sweeps at the temples. Cel-shaded with 2 tone bands
(chestnut base + lighter warm-brown highlight).

Per-frame behavior:
- Frames 1-3 (idle/walk): hair settled naturally, gentle forward drift
- Frame 4 (jump): hair FLARED UP from airspeed, spikes more exaggerated
- Frame 5 (attack-mid): hair slightly pulled back from wind-up
- Frame 6 (attack-end): hair trailing slightly back from swing motion

Alignment: hair must sit on top of a head whose top is at pixel y=4 of
the cell and scalp center at x=16. Hair wraps naturally around where the
skull would be; face area (lower half of head) must be BLANK (solid
white background shows through so the base's face is visible in-game).
```

## 4. `sprites/character/overlays/hair/spiky_gold.png`

```
[MASTER HEADER]

Same as spiky_brown but color palette is GOLDEN YELLOW — bright sunny
yellow base with lighter cream-yellow highlights. Same short spiky
anime cut, same per-frame motion behavior.
```

## 5. `sprites/character/overlays/hair/long_silver.png`

```
[MASTER HEADER]

Subject: HAIRSTYLE OVERLAY ONLY. Long flowing silver-platinum hair
falling past the shoulders, with volumetric bangs covering the forehead
and two face-framing strands on each side.

Per-frame behavior:
- Frames 1-3: hair hangs naturally with tiny sway
- Frame 4 (jump): long hair flares UP and outward dramatically
- Frame 5 (attack-mid): hair bunched and pulled slightly back
- Frame 6 (attack-end): long hair trailing out behind from the swing

Alignment: scalp at (16, 4) on a 32×48 cell, hair extends down and out
but NEVER covers the face region (lower half of head stays blank).

Cel-shaded 2-tone: cool silver base + icy white highlight.
```

## 6. `sprites/character/overlays/hair/ponytail_blonde.png`

```
[MASTER HEADER]

Subject: HAIRSTYLE OVERLAY ONLY. A high blonde ponytail tied at the
back of the head, with a few loose strands framing the face. Bangs
swept gently to one side on the forehead. Rest of the hair gathered
high and flowing backward.

Per-frame behavior:
- Frames 1-3: ponytail sways gently back and forth
- Frame 4 (jump): ponytail whipped UP behind the head
- Frame 5 (attack-mid): ponytail pulled back from wind-up
- Frame 6 (attack-end): ponytail whipping forward over shoulder from swing

Alignment: scalp at (16, 4); ponytail base at approximately (20, 8).

Cel-shaded 2-tone: warm blonde base + cream-yellow highlight.
```

---

# 🎽 PART 3 — ARMOR OVERLAYS (6 files)

**Reminder for all armor prompts:** torso piece ONLY — no head, no legs below the knee, no weapons, no hands. Cover the tank-top region of the base. Shoulders at y=14, belt at y=34, center at x=16 of the 32×48 cell.

## 7. `sprites/character/overlays/armor/cloth_tunic.png`

```
[MASTER HEADER]

Subject: ARMOR OVERLAY ONLY — a simple cloth tunic top, drawn across 6
frames that animate with the invisible base body's torso motion (walk
twist, jump lift, attack torque).

Style: simple coarse grey-brown linen tunic, visible weave texture,
drawstring V-neck, loose short sleeves ending at mid-bicep. Practical,
worn, no metal. A plain brown cloth belt cinches the waist.

Alignment: shoulder-top at y=14, neckline at y=16, belt line at y=34,
centered at x=16. Covers ONLY the torso — no head, no hands, no legs
visible in the overlay.
```

## 8. `sprites/character/overlays/armor/leather_vest.png`

```
[MASTER HEADER]

Subject: ARMOR OVERLAY ONLY — rugged brown leather vest across 6 frames.

Style: warm tan leather body armor with visible hand-stitched seams,
brass buckles on front straps, reinforced shoulder patches (small
leather pads on top of each shoulder), wide leather belt at waist with
a brass buckle. Short sleeves ending at mid-bicep.

Alignment: shoulder pads peak at y=14, body extends to belt at y=34,
centered x=16. Torso only.
```

## 9. `sprites/character/overlays/armor/chain_mail.png`

```
[MASTER HEADER]

Subject: ARMOR OVERLAY ONLY — chainmail shirt across 6 frames.

Style: oiled silver chainmail hauberk with visible 4-in-1 ring weave
pattern, brown fabric padding visible at the neck and sleeve cuffs,
iron-banded edges, sleeves ending at the elbows. A narrow iron belt
at the waist.

Alignment: neck cowl at y=14, sleeve cuffs at y=24, hem at y=34,
centered x=16.
```

## 10. `sprites/character/overlays/armor/plate_armor.png`

```
[MASTER HEADER]

Subject: ARMOR OVERLAY ONLY — polished steel plate cuirass across 6 frames.

Style: bright polished steel breastplate, articulated steel shoulder
pauldrons with small pointed crest peaks, subtle embossed heraldic
cross emblem on the chest, gold rivets at every joint, dark leather
straps on the sides. Plated sleeves ending at mid-bicep.

Alignment: pauldrons peak above the shoulders at y=12, chest plate
runs from y=16 to y=34 (waist), centered x=16.
```

## 11. `sprites/character/overlays/armor/dragon_scale.png`

```
[MASTER HEADER]

Subject: ARMOR OVERLAY ONLY — emerald dragon-scale chest armor across
6 frames.

Style: overlapping iridescent emerald-green dragon scales covering the
chest, small golden dragon-fang spikes lining the edges of the armor,
one larger curving dragon spike at each shoulder, gold-trimmed neckline,
dark green under-fabric visible at the waist. Short armored sleeves to
mid-bicep.

Alignment: spiked shoulders peak at y=12, chest plate ends at y=34,
centered x=16.
```

## 12. `sprites/character/overlays/armor/dawnshard_aegis.png`

```
[MASTER HEADER]

Subject: ARMOR OVERLAY ONLY — legendary holy white-and-gold plate
across 6 frames.

Style: ivory polished plate with gold filigree scroll-work inlay, large
feathered angel-wing shoulder pauldrons (small detailed white feathers),
an ornate carved maple-leaf gem centerpiece on the chest glowing
emerald-green, gold chain-mail accents visible at the neck and waist,
soft divine holy-light rim on the silhouette (a thin pale-yellow halo
line along the outer outline).

Alignment: pauldron feathers peak at y=10, chest plate ends at y=34,
centered x=16.
```

---

# 🦸 PART 4 — CAPE OVERLAYS (3 files)

**Reminder for cape prompts:** cape hangs from the shoulders down past the feet, visible on the SIDES of the body (the cape overlay covers the area LEFT and RIGHT of the base body, plus behind). Collar at y=15, bottom hem around y=42.

## 13. `sprites/character/overlays/cape/wine_red.png`

```
[MASTER HEADER]

Subject: CAPE OVERLAY ONLY — a flowing wine-red cape hanging from the
shoulders. 6 frames animating cape physics.

Style: deep crimson-wine red cloth lined with ink-black inner silk, gold
collar trim band visible at the shoulders, tattered lower hem, visible
three-tone cloth folds.

Per-frame cape motion:
- Frame 1 (idle): cape hangs straight down with tiny sway
- Frames 2-3 (walk): cape trails slightly behind, opposite-phase sway
- Frame 4 (jump): cape FLARED UP AND OUT from airspeed
- Frame 5 (attack-mid): cape snapped BACK from the wind-up
- Frame 6 (attack-end): cape whipping FORWARD past the body from swing follow-through

Alignment: cape collar attaches at shoulder-top y=15 centered x=16,
bottom hem at around y=42. Cape extends outward both sides beyond the
body silhouette to sell the flow. Center of the body area (where the
base stands) is LEFT BLANK (solid white) so the base shows through —
the cape is only visible to the sides and behind.
```

## 14. `sprites/character/overlays/cape/royal_blue.png`

```
[MASTER HEADER]

Same as wine_red but deep royal-blue cloth lined with silver, silver
collar trim. Same motion behavior. Same alignment.
```

## 15. `sprites/character/overlays/cape/dawnshard.png`

```
[MASTER HEADER]

Same cape shape and motion as wine_red, but the cape is pure pearl
white with gold filigree scroll-work embroidery along the hem and
collar, faint holy-light rim along the outer outline, ivory inner silk.
Legendary holy theme.
```

---

# 🛡️ PART 5 — HELMET OVERLAYS (3 files)

**Reminder for helmet prompts:** helmet sits on the head. Base of helmet at y=14, covers the top of the head. Plumes/crests may extend above y=0. The face area (lower half of head, roughly y=8–20) should stay visible — helmet covers crown and above.

## 16. `sprites/character/overlays/helmet/iron_cap.png`

```
[MASTER HEADER]

Subject: HELMET OVERLAY ONLY — a simple iron cap helmet across 6 frames.

Style: rounded dark iron skullcap with a small forehead brow guard,
two rivets on each side, leather chin strap hanging loose. No plume,
no visor.

Alignment: helmet base rim at y=14, dome peaks at y=4, centered x=16.
Face remains uncovered (base shows through lower head). Head moves
subtly with each frame's body pose — helmet moves with it.
```

## 17. `sprites/character/overlays/helmet/knight_plume.png`

```
[MASTER HEADER]

Subject: HELMET OVERLAY ONLY — a knight's plumed helmet across 6 frames.

Style: silvery steel knight's helmet with a cross-shaped visor slit on
the front (just the slit outline shown), rivets along the brow ridge,
and a TALL blue feathered plume rising from the top extending above
the frame.

Per-frame plume motion: the plume sways gently in idle/walk, flares up
in the jump frame, and whips back-and-forth with the attack frames.

Alignment: helmet base at y=14, helmet dome peaks at y=2, plume extends
from y=2 up toward y=-8 (beyond the frame top — fine, it gets clipped),
centered x=16. The visor slit covers the eyes region of the face (base
face mostly hidden — only the chin and lower jaw peek out).
```

## 18. `sprites/character/overlays/helmet/dawnshard_crown.png`

```
[MASTER HEADER]

Subject: HELMET OVERLAY ONLY — a legendary golden crown-helm across
6 frames.

Style: ornate gold crown-helmet with filigree scrollwork, three jeweled
points rising from the crown (center large ruby, side sapphires), a
radiant pearl-white halo floating behind the head emitting soft holy
light rays.

Alignment: crown base at y=14, tallest jewel peak at y=-4 (above frame),
halo ring extends behind the head at y=0 to y=16. Face region left
visible below y=20. Centered x=16.

Per-frame behavior: halo pulses gently with a soft glow. Crown moves
with head.
```

---

# 🛡️ PART 6 — SHIELD OVERLAYS (3 files)

**Reminder for shield prompts:** shield is held in the LEFT hand (screen left when facing right). Shield position is approximately at left-hand location in each frame: idle (10, 28), walk frames sway ±2, jump (10, 24), attack-mid (6, 30), attack-end (14, 26).

## 19. `sprites/character/overlays/shield/wooden.png`

```
[MASTER HEADER]

Subject: SHIELD OVERLAY ONLY — a small round wooden shield held at the
character's LEFT side (screen left) across 6 frames.

Style: circular oak-wood buckler with iron rim band, a central iron
boss, visible grain texture, brown leather grip visible from the
side.

Per-frame positioning (shield center):
- Frame 1 (idle): at pixel (10, 28)
- Frame 2 (walk-1): at (9, 28)
- Frame 3 (walk-2): at (11, 28)
- Frame 4 (jump): at (10, 24)
- Frame 5 (attack-mid): at (6, 30)
- Frame 6 (attack-end): at (14, 26)

Shield ONLY — no arm, no body. Solid white background around the shield.
```

## 20. `sprites/character/overlays/shield/iron.png`

```
[MASTER HEADER]

Same spec as wooden shield but replace with a larger ROUND IRON shield:
polished iron disc with a brass central sun-boss, bolt-studded rim, a
small heraldic cross in the center.

Same per-frame positioning.
```

## 21. `sprites/character/overlays/shield/knight_kite.png`

```
[MASTER HEADER]

Subject: SHIELD OVERLAY ONLY — a tall kite-shaped knight's shield at
the LEFT side across 6 frames.

Style: tall teardrop/kite-shaped shield, blue field with a silver
heraldic cross painted across it, gold rim trim, pointed bottom tip,
rounded top. Leather grip visible from the side profile.

Per-frame positioning (shield center — shield extends taller than the
round ones, spans roughly y=16 to y=36):
- Frame 1 (idle): centered at (9, 28)
- Frame 2 (walk-1): (8, 28)
- Frame 3 (walk-2): (10, 28)
- Frame 4 (jump): (9, 24)
- Frame 5 (attack-mid): (5, 30)
- Frame 6 (attack-end): (13, 26)

Shield ONLY.
```

---

# 🗡️ PART 7 — WEAPON OVERLAYS (6 files)

**Reminder for weapon prompts:** weapon held in RIGHT hand (screen right). Per-frame hand/grip positions:
- Idle: grip at (22, 28), weapon pointed DOWN at the side
- Walk-1: grip at (22, 28), slight backward sway
- Walk-2: grip at (22, 28), slight forward sway
- Jump: grip at (22, 24), weapon lifted
- Attack-mid: grip at (20, 16), weapon RAISED HIGH OVERHEAD, tip near y=2
- Attack-end: grip at (18, 28), weapon SWEPT DOWN-FORWARD, tip near (2, 30)

## 22. `sprites/character/overlays/weapon/sword_wood.png`

```
[MASTER HEADER]

Subject: WEAPON OVERLAY ONLY — a wooden practice sword held in the
character's right hand across 6 frames.

Style: plain unadorned brown oak practice sword, dull cream-grey wooden
blade, simple rounded crossguard, dark leather-wrap grip, simple round
wooden pommel. Slightly scuffed with use marks.

Per-frame weapon position (grip → blade tip):
- Frame 1 (idle): grip (22, 28) → tip (22, 12), blade pointed UP (held
  vertically at side)
- Frame 2 (walk-1): grip (22, 28) → tip (20, 12), sway back
- Frame 3 (walk-2): grip (22, 28) → tip (24, 12), sway forward
- Frame 4 (jump): grip (22, 24) → tip (22, 8)
- Frame 5 (attack-mid): grip (20, 16) → tip (20, 2), weapon RAISED
  HIGH OVERHEAD
- Frame 6 (attack-end): grip (18, 28) → tip (2, 30), weapon SWEPT
  DOWN AND FORWARD past the left edge of the cell

No hand drawn on the sprite. Weapon ONLY. Solid white background.
```

## 23. `sprites/character/overlays/weapon/sword_iron.png`

```
[MASTER HEADER]

Same spec as sword_wood but style is a forged iron longsword: grey
steel blade with a central fuller groove, simple brass crossguard,
dark leather-wrapped grip, round iron pommel. Same per-frame positions.
```

## 24. `sprites/character/overlays/weapon/sword_steel.png`

```
[MASTER HEADER]

Same spec as sword_iron but polished steel: bright mirror blade with
clear fuller, elegant brass quillons curving downward, gold-ringed
leather grip, teardrop-shaped brass pommel with a small red stone.
Same per-frame positions.
```

## 25. `sprites/character/overlays/weapon/sword_runed.png`

```
[MASTER HEADER]

Subject: WEAPON OVERLAY ONLY — a curved silver sabre with GLOWING CYAN
runes held in right hand across 6 frames.

Style: silver curved sabre blade with cyan glowing runic etchings
running along the fuller (faint cyan light halo along the blade edge),
ornate gold tsuba-style round guard, silk-wrapped grip, crescent-moon
pommel with an embedded sapphire.

Same per-frame positions as sword_wood.
```

## 26. `sprites/character/overlays/weapon/sword_katana.png`

```
[MASTER HEADER]

Subject: WEAPON OVERLAY ONLY — a slim enchanted katana across 6 frames.

Style: slim slightly-curved polished steel blade with a faint indigo
aurora mist wisping along it, black silk-wrapped grip with gold menuki
diamonds, traditional round tsuba guard, a small red tassel hanging
from the pommel.

Same per-frame positions.
```

## 27. `sprites/character/overlays/weapon/sword_dawnshard.png`

```
[MASTER HEADER]

Subject: WEAPON OVERLAY ONLY — a legendary leaf-shaped crystal blade
across 6 frames.

Style: translucent emerald-green crystal blade shaped like a stylized
maple leaf with inner prismatic glow, gold hilt engraved with tree-of-
life motif, wrapped grip with gold rings, large ruby teardrop pommel,
a few tiny floating leaf particles around the blade (within frame
bounds).

Same per-frame positions as sword_wood.
```

---

# 👢 PART 8 — BOOTS OVERLAYS (3 files)

**Reminder for boots prompts:** feet are planted at y=48 in every frame. Boots cover from ankle (~y=42) down to y=48. Walk frames have one foot slightly forward (x offset ±2). Jump frame has feet lifted to y=46.

## 28. `sprites/character/overlays/boots/leather.png`

```
[MASTER HEADER]

Subject: BOOTS OVERLAY ONLY — tall leather boots across 6 frames.

Style: warm brown laced knee-high leather boots with small brass buckles
on the shin, visible stitching, slightly worn soles, folded cuff at the
top.

Per-frame foot positions:
- Frames 1-3 (idle/walk): both boots planted at y=48, with walk frames
  offsetting one foot forward (+2 x) and one back (-2 x)
- Frame 4 (jump): both boots lifted to y=46, slightly tucked under
- Frames 5-6 (attack): boots planted, one foot stepped forward

Boots ONLY — no legs visible. Solid white background.
```

## 29. `sprites/character/overlays/boots/plate.png`

```
[MASTER HEADER]

Same spec as leather boots but style is heavy steel plate sabatons:
polished silver plate boots with articulated toe segments, gold rivets,
reinforced shin plates, leather straps between segments.
```

## 30. `sprites/character/overlays/boots/dawnshard.png`

```
[MASTER HEADER]

Same spec as leather boots but legendary holy: pearl-white plate
sabatons with gold filigree inlay, subtle divine holy-light rim,
tiny golden feather wing details on each ankle.
```

---

# ✅ POST-GENERATION CHECKLIST

After Gemini produces each sheet:

1. **Verify dimensions.** Image should be exactly `1536 × 384` px. If it's slightly off, regenerate.
2. **Check frame alignment.** The 6 frames should be equal width (256 each). Look for thin white dividers between them.
3. **Check vertical consistency.** In every frame, the subject's bottom edge (feet or base of overlay) should be exactly at y=384 (at 8× scale) = y=48 (final scale). If feet drift up/down, regenerate that specific sheet — alignment across overlays is crucial.
4. **Downsample** to `192 × 48` with nearest-neighbor interpolation.
5. **Save to the exact path** listed in the prompt header.

When at least `base_male.png` lands in `sprites/character/`, refresh the game. If it renders but looks tiny or off-center, tell me and I'll tune `SPRITE_SCALE` in the engine.

---

# 🔄 BATCH STRATEGY

- **Day 1:** Generate both base bodies (#1, #2), validate they load in-game before continuing.
- **Day 2:** Generate 1 hair + 1 armor + 1 weapon (#3, #7, #23 for a proven pipeline). Confirm layering aligns.
- **Day 3+:** Batch through remaining hairs, armors, weapons.
- **Final phase:** Capes, helmets, shields, boots.

Missing files silently fail — you'll never break the game by skipping a sprite. Procedural hand-drawn art is the fallback for any missing asset.
