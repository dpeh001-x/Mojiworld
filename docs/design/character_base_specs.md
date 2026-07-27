# 🧸 Character Base + Layered Overlay System

**Target aesthetic: cute chibi — big head, bean-shaped body, tiny limbs. Think Mojiworld but even softer / plumper, more like an infant-chibi.**

One base character + drop-in overlays for hair, armor, cape, helmet, weapon, shield, boots. You animate the base once; every outfit snaps onto the same frame grid.

---

## 📐 FIXED DIMENSIONS

| Param | Value |
|---|---|
| **Per-frame cell** | **32 × 48 px** |
| **Sheet layout** | **6 frames horizontally** → **192 × 48 px** total |
| **Generation canvas** | **1536 × 384 px** (8× upscale — gives Gemini room to render crisp pixels) |
| **Background** | Solid pure white `#FFFFFF` (color-keyed at load) |
| **Feet line** | `y = 48` (bottom of cell) — character's soles planted on this line in **every** frame |
| **Horizontal anchor** | Centered at `x = 16` of each cell |
| **Head center** | around `(16, 10)` — big round head occupies top half |
| **Body center** | around `(16, 30)` |

The cell is small on purpose — **the head should dominate** (roughly top 40% of the cell), making a proper chibi. Body + legs fit the lower 60%.

---

## 🎞️ THE 6 FRAMES

Horizontal order in the sheet (feet planted at y=48 in every frame):

| # | Frame | Pose |
|---|---|---|
| 0 | **idle** | Standing relaxed, weight centered, arms loose, tiny smile |
| 1 | **walk-1** | Left foot stepping forward, right arm back |
| 2 | **walk-2** | Right foot stepping forward, left arm back |
| 3 | **jump** | Both knees tucked slightly up, arms flared back |
| 4 | **attack-mid** | Right arm raised high overhead, body coiled |
| 5 | **attack-end** | Right arm swept down-forward past body, front foot planted |

---

## 👶 BASE CHARACTER PROMPT

Target visual reference:

> **Super cute chibi**, bald, round face with pink cheek blush, tiny smile, wearing a simple grey sleeveless tank top and small brown boots. Infant-like body proportions — huge round head, short stubby legs, tiny waist. No hair, no pants (bare legs), no weapon, no armor. This is the neutral template every outfit layers onto.

### `sprites/character/base_male.png` (192×48, generate at 1536×384)

```
Generate a single horizontal pixel art sprite sheet, exactly 1536 pixels wide
by 384 pixels tall (6 frames of 256×384 each at 8× scale — downsample to
192×48 yourself with nearest-neighbor). Solid pure white #FFFFFF
background across the entire image. Thin vertical solid white separators
divide the 6 frame cells.

Art style: 16-bit SNES pixel art at 8× upscale, cute chibi Mojiworld-style
but plumper and softer. 16-color palette, bold 1-pixel dark outline on every
form, cel-shaded with 2 tone bands per material (no painterly gradients),
warm key light from upper-left, nearest-neighbor pixel edges — NO
anti-aliasing blur.

Character (same in every frame): a super-cute bald chibi human with:
- HUGE round peach-skinned head (takes up the top 40% of each cell)
- Two large black expressive dot eyes with small white catchlight highlights
- Small thin black eyebrows arching gently upward (friendly expression)
- Soft pink blush circles on both cheeks
- Tiny curved smile
- No hair, no ears visible
- Short neck merging into a plump bean-shaped torso
- Simple grey sleeveless tank-top undershirt covering the torso
- Bare peach-skinned arms, small rounded hand mittens
- Bare peach-skinned chubby thighs and calves
- Tiny brown laced ankle boots on both feet
- Feet planted firmly at y=48 in every frame (no bounce in feet)

Pose per frame (character always faces camera-right, feet planted at
the bottom edge of each cell):

Frame 1 (idle): standing perfectly relaxed, arms hanging loose at sides,
  eyes forward, tiny smile.
Frame 2 (walk-1): LEFT foot stepped forward, RIGHT arm swung back,
  torso slightly turned.
Frame 3 (walk-2): RIGHT foot stepped forward, LEFT arm swung back,
  mirror of frame 2.
Frame 4 (jump): BOTH feet still on ground line but knees bent and tucked
  as if about to lift off, arms flung back for momentum, big eyes,
  mouth slightly open.
Frame 5 (attack-mid): body coiled, RIGHT arm raised high overhead as if
  winding up a swing, left arm counterbalanced forward, eyes narrowed
  in focus.
Frame 6 (attack-end): RIGHT arm swept down and forward past the body,
  right foot stepped slightly forward, mouth open in a shout.

CRITICAL: in every frame the feet stay at the bottom edge of the cell —
no vertical bounce, no crouch. All motion is in the upper body.

Absolute bans: no text, no labels, no frame numbers, no grid lines (only
the white frame separators), no captions, no watermark, no ground shadow,
no environmental props, no speech bubbles, no weapons, no hair, no armor.
Just the same cute bald chibi in six different poses on solid white.
```

### `sprites/character/base_female.png`

Same prompt, change this section:
```
- Same bald base (it's a gender-neutral template — all hair, including
  "female" long hair, is layered as a separate hair overlay later)
- Slightly narrower shoulders, softer chin line
- Same grey tank top (can be a bit more fitted at the waist)
- Slightly smaller stubby feet
```

The base stays **bald** for both genders. Hair is always an overlay. This is how you can stack ANY hair on ANY base.

---

## 🎨 OVERLAY SHEETS — Every overlay reuses the 192×48 frame grid

**Rule #1:** Every overlay is the same 192 × 48 dimensions, 6 frames aligned with the base.
**Rule #2:** Only the overlay itself is drawn in each cell — the rest is solid white (for keying) or transparent, and the base shows through.
**Rule #3:** Where the overlay attaches to the body (neckline, head-top, feet, hand) is where the base anatomy lives — match it.

### Layer Z-order at render time

```
 ┌─ drawn last (top) ──────────────────────┐
 │  6. Accessory glows (procedural sparkles) │
 │  5. Weapon + Shield  (per hand)           │
 │  4. Helmet                                │
 │  3. Cape                                  │
 │  2. Armor (torso)                         │
 │  1. Hair                                  │
 │  0. Base body                             │
 └─ drawn first (bottom) ────────────────────┘
```

Warrior overlay stack: base → hair → armor → (no cape usually) → weapon
Knight overlay stack: base → hair → armor → cape → helmet → shield → weapon

### Overlay prompt templates

#### Hair overlay (`sprites/character/overlays/hair/<style>.png`)
```
16-bit pixel art HAIR OVERLAY sheet, 1536×384 (8× of 192×48 — 6 frames),
solid pure white #FFFFFF background with vertical white separators.

Subject: hairstyle ONLY — no head, no face, no body, no accessories.
Each of the 6 frames shows the hair in the pose it would take IF the
invisible base character were in that frame:
- Idle / walk: hair gently settled
- Jump (frame 4): hair flared UP from airspeed
- Attack-mid (frame 5): hair slightly back from the wind-up
- Attack-end (frame 6): hair trailing from the swing

Alignment: hair must sit on a head whose top is at roughly pixel y=4
of each 48-tall cell, and whose scalp center is at x=16. It must wrap
naturally around where the skull would be.

Style: [DESCRIBE HAIRSTYLE — e.g., "Short spiky golden-yellow anime
hair with chunky jagged tips sticking up from the crown and
shoulder-length side bangs"].

Cel-shaded with 2 tone bands (base + highlight), bold 1-pixel dark
outline, same palette fidelity as the base. No body, no face — HAIR
ONLY in each cell. Solid white background.
```

#### Armor / Clothing overlay (`sprites/character/overlays/armor/<name>.png`)
```
16-bit pixel art ARMOR OVERLAY sheet, 1536×384, solid pure white bg.

Subject: a [ARMOR NAME] chest/torso piece only — no head, no legs below
the knee, no feet, no weapons. Cover the tank-top area of the base,
including any shoulder pauldrons that sit above the shoulders. Extend
down to roughly mid-thigh if the armor is a tunic/skirt.

Each of the 6 frames shows the armor as it would appear on the base
body in that pose (torso twists with walk, shoulders raise with jump,
shoulders torque with the attack frames).

Alignment: shoulders start at pixel y=14, belt line at y=34, centered
at x=16.

Style: [DESCRIBE ARMOR — e.g., "Rugged brown leather tunic with iron
shoulder studs, cinched leather belt at waist, visible stitching"].

No head, no arms below the wrists, no legs below the knee. Armor
silhouette only, cel-shaded pixel art, solid white background.
```

#### Cape overlay (`sprites/character/overlays/cape/<name>.png`)
```
16-bit pixel art CAPE OVERLAY sheet, 1536×384, solid pure white bg.

Subject: a flowing cape hanging from shoulders behind the character,
visible on each side and below the body. 6 frames animating cape
physics:
- Idle: cape hangs straight down with gentle sway
- Walk-1/2: cape trails slightly behind the moving body
- Jump: cape flared UP and out with airspeed
- Attack-mid: cape snapped back from wind-up motion
- Attack-end: cape whipping forward from swing follow-through

Alignment: cape collar attaches at shoulder-top y=15, centered x=16,
and the bottom hem trails down to roughly y=42.

Style: [DESCRIBE CAPE — e.g., "Deep crimson-red cloth cape with gold
collar trim, tattered lower hem, visible fabric folds"].

Solid white background, cel-shaded pixel art, just the cape — no body.
```

#### Helmet overlay (`sprites/character/overlays/helmet/<name>.png`)
```
16-bit pixel art HELMET OVERLAY sheet, 1536×384, solid pure white bg.

Subject: a helmet that sits on the character's head, 6 frames matching
the base head movement (same pose as frames 0-5 of the base).

Alignment: helmet base rests at pixel y=14 of each cell, covers the
top of the head. Plumes/feathers/horns may extend above y=0.

Style: [DESCRIBE HELMET — e.g., "Silvery knight's helmet with a tall
blue plume, cross-shaped visor slit, rivets along the brow"].

Solid white background, cel-shaded. HELMET ONLY, no head visible
underneath (the base shows through where the helmet has no coverage).
```

#### Weapon overlay (`sprites/character/overlays/weapon/<name>.png`)
```
16-bit pixel art WEAPON OVERLAY sheet, 1536×384, solid pure white bg.

Subject: weapon held in the character's RIGHT hand (screen right from
camera view when facing forward). 6 frames showing weapon position
matched to the base's arm at each pose:

- Idle: weapon held at right side, grip near pixel (22, 28), blade tip
  pointing down and slightly out
- Walk-1: weapon swaying slightly back
- Walk-2: weapon slightly forward
- Jump: weapon raised a little, swung back
- Attack-mid: weapon RAISED HIGH OVERHEAD, tip at top of cell (around
  y=2), grip around (20, 16)
- Attack-end: weapon SWEPT DOWN AND FORWARD past the left edge of the
  cell, tip near (2, 30), grip around (18, 28)

Alignment: the weapon's GRIP pivot must match where the base character's
right hand is in that frame. No hand drawn on the weapon sprite — the
base's hand shows through.

Style: [DESCRIBE WEAPON — e.g., "Silver longsword with brown leather
grip, brass crossguard, small red gem pommel"].

Solid white background, no body, weapon only.
```

#### Shield overlay (`sprites/character/overlays/shield/<name>.png`)
```
Same spec as weapon, but held in the LEFT hand (screen left).
Shield stays oriented forward in all frames, only position shifts
with the body.
Alignment: shield center at the left hand, around (10, 28) in idle.
```

#### Boots overlay (`sprites/character/overlays/boots/<name>.png`)
```
16-bit pixel art BOOTS OVERLAY sheet, 1536×384, solid pure white bg.

Subject: a pair of boots replacing the base's default brown ankle boots.
6 frames, feet planted at y=48 except during jump (frame 4) where feet
lift slightly. Walk frames show one foot forward / one back.

Style: [DESCRIBE BOOTS].

Solid white background, boots only (no legs visible).
```

---

## 🗂️ FILE LAYOUT

```
LevelX/sprites/character/
├── base_male.png
├── base_female.png
└── overlays/
    ├── hair/
    │   ├── spiky_brown.png
    │   ├── spiky_gold.png       (warrior default)
    │   ├── long_silver.png
    │   └── ponytail_blonde.png
    ├── armor/
    │   ├── cloth_tunic.png
    │   ├── leather_vest.png
    │   ├── chain_mail.png
    │   ├── plate_armor.png
    │   ├── dragon_scale.png
    │   └── dawnshard_aegis.png
    ├── cape/
    │   ├── wine_red.png         (warrior default)
    │   ├── royal_blue.png
    │   └── dawnshard.png
    ├── helmet/
    │   ├── iron_cap.png
    │   ├── knight_plume.png     (knight signature)
    │   └── dawnshard_crown.png
    ├── shield/
    │   ├── wooden.png
    │   ├── iron.png
    │   └── knight_kite.png
    ├── weapon/
    │   ├── sword_wood.png
    │   ├── sword_iron.png
    │   ├── sword_steel.png
    │   └── sword_dawnshard.png
    └── boots/
        ├── leather.png
        ├── plate.png
        └── dawnshard.png
```

---

## ⚙️ RUNTIME LAYERING (already wired in game)

The engine composites in this Z-order per frame:

```
0. Base body        (always — from base_male/female.png)
1. Hair             (player.look.hair or class default)
2. Armor            (player.equipped.armor.spriteKey)
3. Cape             (player.equipped.cape or class default)
4. Helmet           (player.equipped.helmet.spriteKey)
5. Shield           (player.equipped.shield.spriteKey)
6. Weapon           (player.equipped.weapon.spriteKey)
7. Accessory glow   (procedural — stays drawn last)
```

Each layer is independent — if a file doesn't exist, that layer silently skips. **The current hand-drawn pixel art is the fallback** — remove any sprite and the game still renders cleanly.

---

## 🧭 GENERATION ROADMAP

1. **Phase 1 — validate the pipeline (1 day):**
   - Generate `base_male.png` only
   - Drop into `sprites/character/`
   - Refresh the game — you should see the chibi replace the procedural art
2. **Phase 2 — validate overlays (1 day):**
   - Generate `hair/spiky_brown.png`, `armor/leather_vest.png`, `weapon/sword_iron.png`
   - These should stack on the base cleanly
3. **Phase 3 — batch production:**
   - Generate remaining hair styles (6 total)
   - Generate remaining armors (6)
   - Generate capes (3), helmets (3), shields (3), boots (3), weapons (6)
   - Each batch follows the same template, just change the [DESCRIBE X] block

**Total: ~32 sprite sheets** to fully cover the overlay catalog. But you only need ~5 to get a playable, great-looking character on screen.

---

## 💡 TIPS

- **Generate base FIRST** and lock it in before producing overlays. Every overlay is calibrated to the base's anatomy.
- **Check the frame separators** — if Gemini merges frames or makes them different widths, regenerate. The engine assumes 32px per frame exactly.
- **Attack frames (4 and 5) are the most likely to drift.** If the arm in the overlay doesn't match the arm in the base, that pose needs a re-roll.
- **For cute chibi vibe:** keep reminding Gemini "big round head, tiny short legs, plump body" — the head should be *at least* one-third of the total height.
- **Solid white background is easier than transparent** for Gemini. We key it out in code, no loss of quality.

When `base_male.png` is ready and saved at `sprites/character/base_male.png`, tell me and we'll iterate from there.
