# Per-item prompt library — every existing weapon / armor (v0.25.324)

Every item from `ITEM_POOL` (in `mojiworld_game.html:6053`) gets a tailored
Ludo prompt below. Each prompt's palette injects the item's `vis`
colors directly — so the generated sprite matches the procedural
class-weapon / class-armor render and the in-game UI tooltip.

> **How to use:** paste the locked **PREFIX** + matching **SLOT BLOCK**
> from `EQUIPMENT_PROMPTS.md` + the **VARIANT LINE** from this doc, all
> as one paragraph, into Ludo's prompt input. Set
> `image_type: "sprite"`, `art_style: "Anime/Manga"`,
> `aspect_ratio: "ar_1_1"`, `n: 1`. Save the resulting `.webp` as the
> filename in the **Filename** column. Run
> `node scripts/import_equipment_sprites.mjs <slot>` to print the
> registry block. Reload the game.

> **Naming convention:** filename = item's name lowercased + snake_case
> + `.webp`. spriteId = filename without extension. Example: "Iron
> Sword" → `iron_sword.webp`, spriteId `iron_sword`. The matching
> `equipped` item gets `spriteId: 'iron_sword'` set on it (Apply path
> in `applyCharStudioToPlayer` already merges the visual fields onto
> stat-bearing items per v0.25.313).

---

## Weapons → `weapon` slot (18 items)

Use the **WEAPON SLOT BLOCK** from `EQUIPMENT_PROMPTS.md`. Weapons
skip the tint-friendly palette — paint at the item's authored
saturated colors so the rarity reads at a glance.

### Generic ladder (any class)

| Item | Filename | Variant line |
|---|---|---|
| **Wooden Sword** (T1, common) | `wooden_sword.webp` | `Variant: A crude starter wooden sword. Warm brown wooden blade (#a07040 base, #c89868 highlight, #5a3820 shadow), unfinished hewn texture. Simple dark leather-wrapped crossguard (#4a2a10), small brass pommel cap (#b8882a). Blade pointing UP-FORWARD at a 30-degree angle, beginner-tier rough-around-the-edges aesthetic.` |
| **Iron Sword** (T1, common) | `iron_sword.webp` | `Variant: A medieval iron longsword. Plain forged-iron blade (#8a8a9a base, #aaaabb highlight, #4a4a5a shadow), simple straight crossguard wrapped in worn leather (#6a4a20), brass pommel (#ffcc44). Blade pointing UP-FORWARD at a 30-degree angle, dependable common-tier sword.` |
| **Steel Blade** (T2, rare) | `steel_blade.webp` | `Variant: A polished steel longsword, sharper and refined. Mirror-bright steel blade (#c8ccd8 base, #ffffff highlight, #6a6a80 shadow), gold-trimmed crossguard (#aa8830) with leather-wrapped grip, ornate gold pommel (#ffdd66). Blade pointing UP-FORWARD at a 30-degree angle, rare-tier weapon with subtle metallic gleam.` |
| **Runed Sabre** (T3, rare) | `runed_sabre.webp` | `Variant: A glowing runed cavalry sabre. Curved blade etched with arcane sky-blue runes that glow softly (#88ccff base, #c0e8ff highlight, #4488aa shadow, #4488ff glow). Gold cup-hilt crossguard (#ffcc44), pale-gold pommel (#ffeeaa). Blade pointing UP-FORWARD at a 40-degree angle, rare-tier with a faint blue magical aura.` |
| **Enchanted Katana** (T4, epic) | `enchanted_katana.webp` | `Variant: An enchanted katana wreathed in violet magic. Curved single-edge blade tinted purple with a soft glow (#c0aaff base, #e0ccff highlight, #5a3a9a shadow, #aa66ff glow). Wrapped tsuka grip with menuki ornament, dark purple tsuba cross-guard (#3a1a5a), pink-violet pommel (#cc88cc). Blade pointing UP-FORWARD at a 30-degree angle, epic-tier with violet magical wisps.` |
| **Dawnshard Blade** (T5, legendary, set:dawnshard) | `dawnshard_blade.webp` | `Variant: A legendary radiant longsword. Mint-green crystal blade glowing with dawn light (#88ffcc base, #ddffee highlight, #4aaa88 shadow, #66ff99 glow). Solid gold cross-guard (#ffdd44) with intricate scrollwork, leather grip, brilliant gold pommel (#ffee88). Blade pointing UP-FORWARD at a 30-degree angle, legendary-tier with golden-mint radiant aura.` |

### Warrior weapons

| Item | Filename | Variant line |
|---|---|---|
| **Crusader Mace** (T2, rare) | `crusader_mace.webp` | `Variant: A silver crusader's mace. Heavy flanged steel head (#a8a8b8 base, #d8d8e8 highlight, #5a5a6a shadow) with cross-shaped flanges, stout dark-wood haft wrapped in leather (#7a4a20), gold cap (#ffcc44). Head pointing UP, blunt holy-warrior aesthetic, rare-tier.` |
| **Berserker Cleaver** (T3, epic) | `berserker_cleaver.webp` | `Variant: A brutal crimson cleaver. Massive single-edge axe-blade in deep blood red (#cc4422 base, #ff7744 highlight, #661a08 shadow, #ff5522 glow), jagged inner spine. Charred-black wood haft with crude leather wrap (#1a0a0a), copper-and-rust pommel (#aa3322). Blade FORWARD at a 30-degree angle, epic-tier with smoldering red ember aura.` |
| **Doomforged Greatsword** (T5, legendary, set:doomforged) | `doomforged_greatsword.webp` | `Variant: A legendary two-handed crimson greatsword. Massive blood-red blade with darker crimson grooves (#cc3344 base, #ff6666 highlight, #660000 shadow, #ff4422 glow), wide cross-guard etched with skulls. Charcoal-black two-handed grip (#1a0a0a) with crimson leather wraps, deep-red pommel (#aa3333). Blade pointing UP at a 25-degree angle, legendary-tier with smoldering red ember aura, intimidating berserker aesthetic.` |

### Rogue weapons

| Item | Filename | Variant line |
|---|---|---|
| **Quickfang Daggers** (T2, rare) | `quickfang_daggers.webp` | `Variant: A pair of teal-jade fang daggers. Twin curved single-edge blades in pale jade-green (#88ffcc base, #ddffee highlight, #3a8866 shadow), held grip-up with both points down (the held one in the right hand at (540,460), the second tucked just below it). Dark purple bone-textured grips (#3a1a5a), violet-purple pommels (#aa66cc). Sharp + light, rare-tier dual-blade aesthetic.` |
| **Nightshade Kunai** (T3, epic) | `nightshade_kunai.webp` | `Variant: A violet-shadow ninja kunai. Triangular kunai blade in dark violet (#5a3aaa base, #aa66ff highlight, #1a0832 shadow, #aa44ff glow), held forward and slightly down with the point reaching past x=720. Black braided cord-wrapped grip (#0a0414), small purple-amethyst pommel (#cc88ff) with a hanging tassel. Epic-tier with faint violet shadow wisps, ninja aesthetic.` |
| **Shadowweave Dagger** (T5, legendary, set:shadowweave) | `shadowweave_dagger.webp` | `Variant: A legendary shadow-weave assassin's dagger. Curved single-edge blade absorbing light, near-black with violet sheen (#1a0a2a base, #aa66ff highlight, #0a0014 shadow, #aa44ff glow). Wrapped purple grip (#3a1a5a) with woven shadow-fabric texture, ornate violet pommel (#cc88ff). Blade pointing FORWARD-DOWNWARD at a 35-degree angle, legendary-tier with violet shadow trails, sinister assassin aesthetic.` |

### Mage weapons

| Item | Filename | Variant line |
|---|---|---|
| **Apprentice Wand** (T2, rare) | `apprentice_wand.webp` | `Variant: A novice's purple wand. Polished dark-violet wood shaft (#aa88ff base, #ddccff highlight, #5a3a9a shadow) with carved spiral ridges, held grip-up with the tip pointing UP at y≈260. Simple deep-purple grip wrap (#3a1a5a), small star-shaped pink-violet tip (#cc88ff). Length about 200 px from the hand, rare-tier apprentice-mage aesthetic.` |
| **Crystal Scepter** (T3, epic) | `crystal_scepter.webp` | `Variant: A polished crystal scepter. Pale-blue translucent crystal head shaped like a teardrop with internal lattice glow (#88ddff base, #ddf6ff highlight, #4488aa shadow, #88aaff glow), held grip-up with the crystal at y≈200. Dark-purple metal shaft (#2a1a5a), violet wrapped grip, gold-and-violet pommel (#aa66cc). Length about 320 px, epic-tier with cool blue magical aura.` |
| **Voidcaller Staff** (T5, legendary, set:voidcaller) | `voidcaller_staff.webp` | `Variant: A legendary void wizard's staff held vertically. Dark-purple twisted wood shaft (#3a1a6a base, #aa66ff highlight, #1a0832 shadow) running from y=720 grip-bottom up to y=80 top, capped with a swirling violet void-orb wreathed in starry purple wisps (#bb44ff glow). Ornate gold filigree wraps the orb's base (#ffee88). Black-and-purple wrapped grip (#0a0414). Legendary-tier with cosmic void aura, archmage aesthetic.` |

### Archer weapons

| Item | Filename | Variant line |
|---|---|---|
| **Hunter's Shortbow** (T2, rare) | `hunters_shortbow.webp` | `Variant: A polished olive-wood shortbow held vertically. Olive-tan recurve limbs (#8aa860 base, #bbcc88 highlight, #3a4828 shadow) running from y=200 top to y=620 bottom, leather-wrapped centre grip (#5a3818) at hand anchor. Bowstring drawn taut along the back, gold-bound nock tips (#ccaa44). Rare-tier ranger aesthetic.` |
| **Falcon Recurve** (T3, epic) | `falcon_recurve.webp` | `Variant: A jade-green falcon recurve bow held vertically. Jade-green carved limbs (#5aaa6a base, #88ffaa highlight, #1a4a28 shadow, #88ffaa glow) running from y=120 top to y=720 bottom, falcon-feather motif carved along the back, leather grip (#5a3818) wrapped in green cord. Bowstring taut, gold tips (#ffcc44). Epic-tier with mint-green wind aura.` |
| **Skyhunter Longbow** (T5, legendary, set:skyhunter) | `skyhunter_longbow.webp` | `Variant: A legendary verdant longbow held vertically. Deep-emerald longbow limbs etched with vine motifs (#2a8a4a base, #88ffaa highlight, #0a3a18 shadow, #66ff99 glow) running from y=80 top to y=720 bottom. Gold-thread wrapped centre grip (#5a3818 / #ffcc44 trim) at hand anchor. Bowstring drawn taut, gold-tipped nocks. Legendary-tier with mint-green nature aura, ranger-king aesthetic.` |

---

## Armors → `body_top` slot (15 items)

Use the **BODY_TOP SLOT BLOCK** from `EQUIPMENT_PROMPTS.md`. These all
render in the chest area (neckline 350 → hips 520). Tint compatibility
varies — common-tier pieces use neutral palettes for runtime tinting;
named legendaries paint at full saturation since their colour IS the
identity.

### Generic ladder

| Item | Filename | Variant line |
|---|---|---|
| **Cloth Tunic** (T1, common) | `cloth_tunic.webp` | `Variant: A simple peasant's cloth tunic. Tan woven wool chest (#8a7458 base, #aa9478 highlight, #4a3828 shadow) with V-neckline, short cap sleeves, dark-brown leather belt (#3a2818) at the hem. Plain commoner aesthetic, T1 starter armour.` |
| **Leather Vest** (T1, common) | `leather_vest.webp` | `Variant: A worn leather adventurer's vest. Saddle-brown leather chest (#8a5a30 base, #aa7a50 highlight, #4a2a10 shadow) with bronze rivets along the front seam, dark-brown trim (#3a1808) at the neckline + waist hem. Sleeveless, T1 common adventurer aesthetic.` |
| **Chain Mail** (T2, rare) | `chain_mail.webp` | `Variant: A silver chain-mail hauberk. Densely linked steel rings (#8a8a9a base, #b0b0c0 highlight, #4a4a5a shadow) covering chest + shoulders, brass-buckled leather straps (#aa7722) crossing the chest. Knee-length, rare-tier mid-armour aesthetic.` |
| **Plate Armor** (T3, rare) | `plate_armor.webp` | `Variant: A polished steel plate cuirass. Mirror-bright fitted breastplate (#a0a0b0 base, #d0d0e0 highlight, #5a5a6a shadow), riveted articulated pauldrons covering the shoulder anchors, gold-trimmed neckline + waist (#ffcc44). Rare-tier knight aesthetic.` |
| **Dragon Scale** (T4, epic) | `dragon_scale.webp` | `Variant: An emerald-green dragon-scale chestplate. Overlapping iridescent emerald scales (#3a8a4a base, #5abb6a highlight, #1a4a28 shadow) across the chest + shoulders, gold-trimmed neckline + faulds (#ffcc44), draconic tooth-shaped pauldron caps. Epic-tier with subtle scale shimmer.` |
| **Dawnshard Aegis** (T5, legendary, set:dawnshard) | `dawnshard_aegis.webp` | `Variant: A legendary radiant white plate aegis. Mirror-bright pearlescent breastplate (#f0f0f8 base, #ffffff highlight, #a8a8c0 shadow) with elaborate gold filigree across the chest (#ffdd44), radiant gold dawn-emblem at the centre, gold-trimmed pauldrons + faulds, faint warm halo glow (#ffee88). Legendary-tier holy paladin aesthetic.` |

### Warrior armors

| Item | Filename | Variant line |
|---|---|---|
| **Crusader Hauberk** (T2, rare) | `crusader_hauberk.webp` | `Variant: A silver crusader's hauberk. Densely linked silver chain-mail (#aaaab0 base, #d8d8e0 highlight, #5a5a60 shadow) under a sleeveless white tabard, gold cross-emblem on the chest (#ffcc44), gold-trimmed neckline. Rare-tier holy-knight aesthetic.` |
| **Berserker Pauldron** (T3, epic) | `berserker_pauldron.webp` | `Variant: A spiked crimson berserker chest-piece. Riveted blood-red steel chest plate (#aa3322 base, #dd5544 highlight, #5a1108 shadow, #ff5522 glow) with massive horn-spiked pauldrons covering the shoulder anchors, charred orange trim (#ffaa33), red ember aura. Epic-tier intimidating berserker aesthetic.` |
| **Doomforged Plate** (T5, legendary, set:doomforged) | `doomforged_plate.webp` | `Variant: A legendary doomforged dark-crimson plate. Massive jagged dark-red breastplate (#5a1a1a base, #aa2a2a highlight, #2a0808 shadow, #ff5544 glow) with skull-emblem center plate, gold trim (#ffcc44) along plate edges, smoldering red embers rising from beneath the gorget. Spiked black pauldrons. Legendary-tier hellforged-warrior aesthetic.` |

### Rogue armors

| Item | Filename | Variant line — *NOTE: this is hood, store under `helmet` slot* |
|---|---|---|
| **Shadow Hood** (T2, rare) | `shadow_hood.webp` (helmet slot) | `Variant: A dark purple rogue's hood pulled up over the head. Layered dark-violet cloth hood (#3a2a4a base, #5a3a7a highlight, #1a0a1a shadow) draping at the back and sides, frames the face WITHOUT covering it, violet-purple inner lining (#aa66cc). Rare-tier assassin aesthetic. Sits in the helmet slot per the engine's z-order.` |

| Item | Filename | Variant line — *NOTE: capes go to `cape` slot* |
|---|---|---|
| **Nightshade Cloak** (T3, epic, cape slot) | `nightshade_cloak.webp` | `Variant: A long flowing dark-purple assassin cloak. Deep midnight-purple fabric (#2a1a4a base, #5a3aaa highlight, #0a0418 shadow, #aa44ff glow) cascading from the neckline (400,350) past the hips, frayed lower hem at y≈640, faint violet glow trim (#aa66ff). Epic-tier shadow-magic aesthetic.` |
| **Shadowweave Cloak** (T5, legendary, cape slot, set:shadowweave) | `shadowweave_cloak.webp` | `Variant: A legendary woven-shadow long cloak. Black fabric shifting with violet undertones (#1a0a2a base, #5a3a8a highlight, #0a0414 shadow, #aa44ff glow), spider-silk weave pattern, hood pulled back behind the shoulders, fabric flowing past the knees, faint shadow-wisps trailing from the lower hem. Legendary-tier nightreaper aesthetic.` |

### Mage armors

| Item | Filename | Variant line |
|---|---|---|
| **Apprentice Robe** (T2, rare) | `apprentice_robe.webp` | `Variant: A junior wizard's blue robe top. Royal-blue fabric chest piece (#3a55aa base, #6677dd highlight, #1a2858 shadow) with simple gold trim along the neckline + sleeve cuffs (#ffcc44), small star embroidery on the chest. Rare-tier student-of-magic aesthetic.` |
| **Arcane Vestments** (T3, epic) | `arcane_vestments.webp` | `Variant: A high mage's purple ceremonial vestments. Deep violet fabric with gold celestial embroidery across the chest (#5a3aaa base, #aa66ff highlight, #1a1058 shadow, #aa44ff glow), wide gold-trimmed sleeves, gold star-and-moon emblem at the breast (#ffee88). Epic-tier archmage aesthetic.` |
| **Voidcaller Robe** (T5, legendary, set:voidcaller) | `voidcaller_robe.webp` | `Variant: A legendary cosmic void-mage robe top. Deep-space violet fabric (#2a1a5a base, #5a2aaa highlight, #0a0820 shadow, #aa44ff glow) etched with rotating gold rune circles across the chest (#ffee88), high collar with stars, swirling violet nebula motif. Legendary-tier cosmic-archmage aesthetic.` |

### Archer armors

| Item | Filename | Variant line |
|---|---|---|
| **Hunter's Tunic** (T2, rare) | `hunters_tunic.webp` | `Variant: A green hunter's leather tunic. Forest-green leather chest piece (#5a8a4a base, #88bb6a highlight, #2a4828 shadow) with brown laced front (#ccaa44 trim), small leaf-shaped clasp at the neckline. Rare-tier ranger aesthetic.` |
| **Falcon Mail** (T3, epic) | `falcon_mail.webp` | `Variant: A jade falcon-mail chest. Layered jade-green leather + small silver-mail accents (#3a8a5a base, #66aa88 highlight, #0a3818 shadow, #88ffaa glow), feather motif embossed across the chest, gold-trimmed leather buckles (#ffcc44). Epic-tier hawk-rider aesthetic.` |
| **Skyhunter Vest** (T5, legendary, set:skyhunter) | `skyhunter_vest.webp` | `Variant: A legendary verdant skyhunter vest. Deep emerald leather chest (#2a5a3a base, #5aaa6a highlight, #0a2a18 shadow, #88ffaa glow) with feather-pattern embossed across the chest, gold buckles + filigree (#ffdd66), wind-weave green trim. Legendary-tier ranger-king aesthetic.` |

---

## Accessories — partial visual coverage (3 of 10)

Most accessories (rings, amulets, sigils, orbs) are abstract objects
held in inventory, not worn on the character — they don't render
in any visual slot. Three exceptions map to existing visual slots:

| Item | Slot | Filename | Variant line |
|---|---|---|---|
| **Boots of Swiftness** (any, T2, rare) | `boots` | `boots_of_swiftness.webp` | `Variant: A pair of magical mint-green swift-runner boots, both feet shown side by side. Calf-high tan leather boots (#8a5a30 base, #aa7a50 highlight) wrapped in glowing mint-green wind-rune ribbons (#88ffcc glow), gold winged ankle clasps (#ffeeaa). Rare-tier swiftness aesthetic.` |
| **Shadow Talisman** (any, T4, epic) | `helmet` (forehead pendant) | `shadow_talisman.webp` | `Variant: A floating violet shadow talisman pendant centered on the forehead (around x=400, y=200). Hexagonal shadow-amethyst gemstone (#552266 base, #aa44cc glow) bound by black-iron filigree clasps, suspended just above the eye line by a thin chain disappearing into the hair. Epic-tier shadow-channeler aesthetic. Painted only in the helmet Y range (130–240).` |
| **Skyhunter Quiver** (archer, T5, legendary, set:skyhunter) | `cape` (back-mounted quiver) | `skyhunter_quiver.webp` | `Variant: A legendary back-mounted leather quiver visible from behind the right shoulder, fastened by a green strap crossing the chest from neckline (400,350) over to (480,400) shoulder. Jade-green leather quiver (#3a8a4a base, #88ffaa highlight) bristling with golden-fletched arrow feathers (#ffdd66 / #88ffaa glow). Legendary-tier ranger-king aesthetic. Renders in the cape slot since cape is z-ordered behind the body.` |

The remaining 7 accessories (Ring of Might / Wisdom, Amulet of Fortune, Dawnshard Medallion, Doomforged Sigil, Shadowweave Veil, Voidcaller Orb) are abstract held-in-inventory objects without an obvious wearable rendering — leave them stat-only for now. If you want them visible later, "Shadowweave Veil" → `helmet` and "Voidcaller Orb" → `weapon` (held off-hand) are the cleanest mappings.

---

## How to wire generated sprites back to the in-game item

Once you've generated and saved the sprites, the wardrobe Apply path
(`applyCharStudioToPlayer`, fixed in v0.25.313) automatically merges
the visual fields onto stat-bearing equipped items. So the workflow
is:

1. Generate the sprite via Ludo using the prompt rows above.
2. Save as `Sprites/character/<slot>/<filename>.webp` (the filename is
   in the table).
3. Run `node scripts/import_equipment_sprites.mjs <slot>` and paste
   the printed registry block into `mojiworld_game.html`.
4. **In `ITEM_POOL` (line 6053+)**, add a `spriteId` field to the
   matching item so loot drops carry the visual:
   ```js
   { name:'Iron Sword', icon:'⚔️', atk:8, …, spriteId: 'iron_sword',
     vis:{…} }
   ```
5. Loot drops + shop purchases now spawn items with the visual already
   attached. The renderer's `_drawEquipmentLayer` reads `item.spriteId`
   and resolves through `LX_WEAPON[id]` / `LX_BODY_TOP[id]` etc.

For tint variants (e.g. recolouring `iron_sword` for the rare
"Sharp Iron Sword" affix variant), set `tint: '#hex'` on the item;
the multiply-blend cache (v0.25.306) handles the rest.

## Quick stats

| Slot | Item count covered | Existing item rows |
|---|---|---|
| `weapon` | 18 | 6 generic + 3 warrior + 3 rogue + 3 mage + 3 archer (incl. all 4 set legendaries) |
| `body_top` | 15 | 6 generic + 3 warrior + 1 rogue (Shadow Hood goes to helmet) + 3 mage + 3 archer (incl. 4 of the 5 set legendaries) |
| `cape` | 2 | Nightshade Cloak, Shadowweave Cloak |
| `helmet` | 2 | Shadow Hood, Shadow Talisman |
| `boots` | 1 | Boots of Swiftness |
| **Total** | **38** | All 18 weapons + 15 of 16 chest armors + 2 capes + 2 helmets + 1 boots |
