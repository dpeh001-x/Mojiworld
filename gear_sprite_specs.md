# 🛡️ Equipment Overlay Sprite Specifications

**When you're ready to replace the procedural gear rendering with generated PNGs, use these specs so every equipment piece aligns perfectly on the character.**

---

## 🧍 CHARACTER ANCHOR

The player body box is **28 × 44 px** internally. Every equipment overlay is drawn *on top* of the character sprite at a known anchor, so all overlays must be produced at the same scale and use a shared pivot.

**Recommended generation canvas:** `448 × 704 px` (16× the body box).
**Downsample to:** `28 × 44 px` nearest-neighbor when saving final assets.

**Character anchor map (in 28 × 44 space):**
- Head center: `(14, 5)`
- Neck: `(14, 16)`
- Chest center: `(14, 25)`
- Waist/belt: `(14, 34)`
- Right hand (facing-right): `(24, 26)`
- Left hand: `(4, 26)`
- Feet line: `y = 44` (bottom edge)

---

## ⚔️ WEAPON SPRITES — 32 × 48 px (with handle anchor)

Every weapon is drawn *held in the player's forward hand*.

**Generation canvas:** `512 × 768 px`. **Downsample to:** `32 × 48`.

**Anchor point (in 32×48 space):** the center of the grip is at `(16, 40)` — this is the pivot that the game rotates around for attack animations.

**Sprite orientation:** Weapon pointed **straight up** (pommel at bottom of frame, blade tip at top of frame). The game rotates it dynamically. DO NOT pre-angle it.

**Shared structure (every weapon must have):**
- Blade: roughly y=4 to y=30 (top 60 % of sprite)
- Crossguard: roughly y=30 to y=34 (horizontal bar)
- Grip: roughly y=34 to y=42
- Pommel: roughly y=42 to y=46

**Background:** Solid pure white `#FFFFFF`. I'll key it out when loading.

**Prompt template:**
```
[MASTER HEADER — 16-bit SNES pixel art, 48-color palette, 1px dark outline,
cel-shaded 3-tone banding, warm key light upper-left, transparent-friendly
solid white #FFFFFF background]

Subject: a [WEAPON NAME] held vertically, pommel at bottom of frame,
blade tip pointing straight up. Sprite fits a 32×48 pixel cell (centered
horizontally, grip pivot at x=16 y=40 in the 32×48 cell).

[WEAPON-SPECIFIC DETAILS — see list below]

Style: sharp pixel edges, visible chunky pixels, NO glow haze beyond
the blade silhouette itself, NO environmental elements.
```

**Weapon-specific details:**

| File | Details |
|---|---|
| `sword_wood.png` | Weathered oak practice sword, brown leather grip, simple wooden pommel, no gold accents |
| `sword_iron.png` | Forged iron longsword, grey blade with central fuller, simple brass crossguard, dark grip, round pommel |
| `sword_steel.png` | Polished steel longsword, mirror-bright blade with visible fuller, elegant brass quillons curving downward, gold-banded grip, teardrop pommel with tiny red stone |
| `sword_runed.png` | Curved silver sabre, glowing cyan runic etchings running along the fuller, ornate gold tsuba-style guard, silk-wrapped grip, crescent-moon pommel with sapphire |
| `sword_katana.png` | Slim slightly-curved polished steel blade with faint indigo aurora mist, black silk-wrapped grip with gold menuki diamonds, round tsuba, red tassel hanging from pommel |
| `sword_dawnshard.png` | **Legendary.** Translucent emerald-green crystal blade shaped like a stylized maple leaf with inner prismatic glow, gold hilt engraved with tree-of-life, wrapped grip, ruby pommel, a few floating leaf particles (within the sprite bounds) |

---

## 🧥 ARMOR SPRITES — 28 × 22 px (chest plate overlay)

Each armor sprite *covers only the chest area* of the character. The rest of the body (legs, arms, head) stays as the base character sprite.

**Generation canvas:** `448 × 352 px`. **Downsample to:** `28 × 22`.

**Anchor:** The sprite fits exactly over the chest region `y = 17–38` of the 28×44 character. Top-left of the sprite = `(0, 17)` of the character.

**Silhouette:** Must match the classic cuirass shape — square chest with small shoulder pauldrons above and a belt line at bottom. Don't draw arms or legs (they show through from the character sprite).

**Prompt template:**
```
[MASTER HEADER]

Subject: a [ARMOR NAME] chest-plate sprite ONLY, 28×22 pixels, front view
3/4 angle. Just the cuirass and shoulder pauldrons — no arms, no belt
below, no helmet. Silhouette must fit within a 28×22 rectangle, shoulder
pauldrons at the top corners, bottom edge is the belt line.

[ARMOR-SPECIFIC DETAILS — see list below]

Background: solid pure white #FFFFFF. No floor, no drop shadow, no
character body visible.
```

**Armor-specific details:**

| File | Details |
|---|---|
| `armor_cloth.png` | Simple grey-brown wool tunic, coarse weave texture, no metal, V-neckline with drawstring |
| `armor_leather.png` | Warm tan leather vest with visible stitching, brass buckles on front straps, reinforced shoulder patches |
| `armor_chain.png` | Oiled silver chainmail hauberk, visible 4-in-1 ring pattern, brown fabric padding at neck |
| `armor_plate.png` | Polished steel plate cuirass, gold rivets at joints, subtle embossed heraldic crest on chest, articulated shoulder pauldrons |
| `armor_dragon.png` | Emerald-green overlapping dragon scales with iridescent shimmer, small dragon-fang trim along the edges, spike at each shoulder, gold rivets |
| `armor_dawnshard.png` | **Legendary.** Polished ivory plate with feathered angel-wing shoulder pauldrons, ornate maple-leaf gem centerpiece glowing emerald, gold chainmail accents, subtle holy light rim around the silhouette |

---

## 💍 ACCESSORY SPRITES — 12 × 12 px (small glyph/glow)

Accessories are tiny — just a small glyph or glow the game overlays near the neck or hand.

**Generation canvas:** `192 × 192 px`. **Downsample to:** `12 × 12`.

**Usage:** The game will render this sprite at `(neck_x - 6, chest_y - 6)` and occasionally at the forward hand.

**Prompt template:**
```
[MASTER HEADER]

Subject: a small floating [ACCESSORY NAME] icon, 12×12 pixels, centered.
Pixel-perfect silhouette, bold outline, ONE clear bright focus color
matching the accessory theme.

[ACCESSORY-SPECIFIC DETAILS — see list below]

Background: solid pure white #FFFFFF.
```

**Accessory-specific details:**

| File | Details |
|---|---|
| `acc_ring_might.png` | A gold ring with a teardrop ruby gem glowing red |
| `acc_ring_wisdom.png` | A silver ring with a blue sapphire cluster |
| `acc_boots.png` | A small cyan winged rune (represents the aura) |
| `acc_amulet.png` | A gold four-leaf-clover charm on a tiny chain loop |
| `acc_talisman.png` | A jagged black obsidian shard with purple mist aura |
| `acc_medallion.png` | **Legendary.** A radiant gold medal with maple-leaf relief, orange-yellow glow halo |

---

## 📂 FILE LAYOUT

```
LevelX/sprites/equipment/
├── weapons/
│   ├── sword_wood.png        (32×48, downsampled)
│   ├── sword_iron.png
│   ├── sword_steel.png
│   ├── sword_runed.png
│   ├── sword_katana.png
│   └── sword_dawnshard.png
├── armors/
│   ├── armor_cloth.png       (28×22)
│   ├── armor_leather.png
│   ├── armor_chain.png
│   ├── armor_plate.png
│   ├── armor_dragon.png
│   └── armor_dawnshard.png
└── accessories/
    ├── acc_ring_might.png    (12×12)
    ├── acc_ring_wisdom.png
    ├── acc_boots.png
    ├── acc_amulet.png
    ├── acc_talisman.png
    └── acc_medallion.png
```

---

## 🔌 INTEGRATION HANDOFF

When you drop the `sprites/equipment/` folder next to the HTML, tell me and I'll:

1. Preload every PNG at boot using `new Image()` into a lookup table keyed by item name
2. Replace the procedural palette in `drawPlayer()` with `drawImage()` calls:
   - Weapon: `ctx.drawImage(weaponSprite, anchor.x-16, anchor.y-40, 32, 48)` with rotation for swing
   - Armor: `ctx.drawImage(armorSprite, sx, sy+17, 28, 22)`
   - Accessory: `ctx.drawImage(accSprite, sx+14-6, sy+20-6, 12, 12)`
3. Fall back to procedural colors if sprite missing (keeps the game playable while you're still generating)

---

## 💡 TIPS FOR BATCHING

- Generate all **6 weapons in one session** so Gemini anchors a consistent grip/pommel geometry across the set
- Generate all **6 armors in another** so they share silhouette proportions
- Generate accessories last — they're the least sensitive to alignment
- If a weapon's grip pivot comes out off-center, regenerate with a reminder: *"The pommel must be exactly at the bottom center of the 32×48 cell"*

Total sprite count needed: **18 equipment overlays** (vs. the 60+ in the full revamp catalog). Small batch, big visual impact.
