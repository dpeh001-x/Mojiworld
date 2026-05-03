# Equipment sprite prompts — copy-paste prompt library (v0.25.323)

Ready-to-use Ludo.ai prompts for every equipment slot. Each prompt is
composed of three locked blocks plus a single variant line. Copy the
three blocks **verbatim** every time — that's what makes the output
align with the anchor template without per-piece tuning. Then pick or
write a variant line at the end.

> **Workflow:** paste `[A] LOCKED PREFIX` + `[B] SLOT BLOCK` + `[C]
> VARIANT LINE` into Ludo's prompt input as one continuous paragraph.
> Set `image_type: "sprite"`, `art_style: "Anime/Manga"`,
> `aspect_ratio: "ar_1_1"`, `n: 1`. Output lands at 768×768; renderer
> auto-scales to the 800×800 head-aligned dest rect.

---

## [A] LOCKED PREFIX — paste verbatim every time

> Chibi anime equipment piece for a layered character creator. Pure
> transparent background. Drawn on an 800×800 square canvas. Implied
> chibi character body anchored at: top of head (400,130), shoulders
> (320,400) / (480,400), hips (400,520), feet (380,720) / (420,720),
> hand grips (260,460) and (540,460). Soft painterly cel-shaded anime
> style, MapleStory aesthetic. Render ONLY the [SLOT] piece — no
> character, no head, no face, no body, no other clothing.

Replace `[SLOT]` with one of: `helmet`, `cape`, `body_top`,
`body_bottom`, `gloves`, `boots`, `weapon`. (Hair is handled
separately in the existing flow / ponytail / shaggy / spiky / etc.
pipeline — different anchor template.)

---

## [B] SLOT BLOCKS — paste the one matching your slot

Each block restates the slot-specific anchor + tint-palette rule. The
tint guidance is critical: clothing pieces in neutral cream / grey
support runtime multiply-blend recolouring, giving 3–5 colour
variants per piece of art.

### Helmet

> Slot guidance: hat / helm / hood, painted from top-of-head (400,130)
> DOWN to JUST ABOVE the eyes (~y=240). MUST NOT cover the face. Sits
> ON TOP of front hair in z-order. NEUTRAL LIGHT GREY METAL (#c8c8d0)
> base color for runtime multiply-blend tinting — paint in flat light
> grey with subtle painterly highlights, no saturated colors.

### Cape

> Slot guidance: drawn BEHIND the body, painted from the neckline
> (400,350) flowing DOWN past the hips (400,520), fabric only. Stays
> within Y range 350–650. NEUTRAL LIGHT CREAM (#e8d8b8) base color
> for runtime multiply-blend tinting — paint in flat cream with
> subtle painterly shading, no saturated colors.

### Body Top

> Slot guidance: shirt / chest plate / robe top, painted from the
> neckline (400,350) DOWN to the hips (400,520) only. Covers the
> shoulder anchors at (320,400) and (480,400). Hem ends at y=520
> exactly so it seams cleanly with body_bottom. NEUTRAL LIGHT CREAM
> (#e8d8b8) base color for runtime multiply-blend tinting — paint in
> flat cream with subtle painterly shading, no saturated colors.

### Body Bottom

> Slot guidance: pants / skirt / leg armour, painted from the hips
> (400,520) DOWN to just above the ankles (~y=700) only. Waistband
> sits at y=520 exactly so it seams cleanly with body_top hem.
> NEUTRAL LIGHT CREAM (#e8d8b8) base color for runtime multiply-blend
> tinting — paint in flat cream with subtle painterly shading, no
> saturated colors.

### Gloves

> Slot guidance: BOTH HANDS in one sprite, positioned exactly at
> hand-grip anchors (260,460) and (540,460), only the gloves on each
> hand visible. Y range 440–480 only — must NOT extend up the
> forearm. NEUTRAL LIGHT GREY METAL (#c8c8d0) base color for runtime
> multiply-blend tinting — paint in flat light grey with subtle
> painterly highlights, no saturated colors.

### Boots

> Slot guidance: BOTH FEET in one sprite, painted from the feet
> anchors (380,720) and (420,720) UP to roughly mid-shin (~y=620),
> only the boots / foot armor visible. NEUTRAL LIGHT CREAM (#e8d8b8)
> base color for runtime multiply-blend tinting — paint in flat
> cream with subtle painterly shading, no saturated colors.

### Weapon

> Slot guidance: ONE WEAPON held in the right hand at grip (540,460).
> The grip part of the weapon clasps at exactly (540,460); the rest
> of the weapon (blade / shaft / bow body) extends OUT from that
> point. Full saturation — paint at natural metal / wood / crystal
> colors, NO tinting required since shape (not colour) is the
> weapon's identity. Painterly cel-shaded anime style with crisp
> highlights.

---

## [C] VARIANT MENU — pick one or write your own

For each slot below, pick a variant line. The format is the SAME
every time: `Variant: <description ending in painterly cel-shaded
anime style with appropriate highlights>.`

### Helmet variants (15 options)

| # | Variant line — paste after the helmet slot block |
|---|---|
| 1 | `Variant: A medieval knight's iron helm with horizontal eye-slit visor (open / decorative), riveted plates, small top crest, fantasy-knight aesthetic.` |
| 2 | `Variant: A tall pointed wizard's hat with a slight droop at the tip, wide circular brim resting on the head, dark fantasy aesthetic.` |
| 3 | `Variant: A dark cloth hood pulled up over the head, fabric draping at the back and sides, soft fold lines, fantasy rogue aesthetic.` |
| 4 | `Variant: A spiked plate barbarian helm with horns curling outward from each side, crude rivets, weathered metal.` |
| 5 | `Variant: A delicate gold tiara crown with three small pointed spires and a center jewel, regal princess aesthetic.` |
| 6 | `Variant: A leather adventurer's tricorn hat, broad-brimmed, with a single feather tucked into the hatband.` |
| 7 | `Variant: A samurai kabuto helm with curved frontplate ornament (maedate), lacquered black metal, gold trim.` |
| 8 | `Variant: A bandana / forehead protector with a metal plate centered on the brow, fluttering tied ends behind, ninja aesthetic.` |
| 9 | `Variant: A jester's cap with three drooping points each tipped with a small bell, motley pattern.` |
| 10 | `Variant: A laurel wreath crown of gilded leaves wrapping the brow, bare on top, classical-hero aesthetic.` |
| 11 | `Variant: A skull-shaped iron helm with empty eye sockets glowing faint violet, necromancer aesthetic.` |
| 12 | `Variant: A feathered chieftain headdress, broad band across the brow with three large feathers fanning up.` |
| 13 | `Variant: A pirate captain's tricorn hat, black with gold trim, skull-and-crossbones emblem on the front.` |
| 14 | `Variant: A fox-mask kitsune face cover pushed up onto the forehead, lacquered red and white, kabuki aesthetic.` |
| 15 | `Variant: A cleric's circlet, thin gold band with a small radiant sun emblem at the front, holy aesthetic.` |

### Cape variants (12 options)

| # | Variant line |
|---|---|
| 1 | `Variant: A short shoulder-cape clasped at the neckline with a small round brooch, fabric flowing back behind the shoulders, ending around the upper back at y=480.` |
| 2 | `Variant: A long full-length hooded cloak, fabric flowing from the shoulders past the hips down to mid-shin, hood pulled back behind the shoulders.` |
| 3 | `Variant: A ragged battle cloak with torn lower hem, multiple slashes / cuts, fabric whipping in implied wind, war-veteran aesthetic.` |
| 4 | `Variant: A regal velvet royal cape with ermine fur trim along the neckline, gold-tasseled brooch, flowing past the hips to knee-length.` |
| 5 | `Variant: A feathered angelic mantle, two layers of overlapping white feathers cascading down the back, divine aesthetic.` |
| 6 | `Variant: A spider-silk witch cape with web pattern embroidery, long flowing dark fabric to ankle-length.` |
| 7 | `Variant: A pirate captain's cape with gold-piped edges, deep colour, broad collar standing tall behind the head.` |
| 8 | `Variant: A military officer's half-cape covering only the right shoulder (asymmetric), gold epaulette at the shoulder seam.` |
| 9 | `Variant: A tattered desert ranger cloak, sandy fabric with frayed edges, layered hood + scarf at the neckline.` |
| 10 | `Variant: A scholar's academic robe-cape with a wide turn-down collar, simple straight hem to hip-length.` |
| 11 | `Variant: A fur-lined cold-weather mantle, thick wool collar, ending at upper-back length, traveler aesthetic.` |
| 12 | `Variant: A holy paladin tabard-cape with a centered cross emblem, fabric draping straight down past the hips.` |

### Body Top variants (15 options)

| # | Variant line |
|---|---|
| 1 | `Variant: A simple cream-colored woven tunic with a soft V-neckline, short cap sleeves, gentle fabric drape, hem at hip line.` |
| 2 | `Variant: A heavy fantasy knight chest plate with riveted steel pauldrons covering both shoulder anchors, central decorative emblem, articulated faulds at the waist.` |
| 3 | `Variant: A long-sleeved arcane robe top, mage style, with elaborate symbol embroidery across the chest, wide flowing sleeves.` |
| 4 | `Variant: A leather assassin's vest, sleeveless, with multiple buckled straps across the torso, hooded mantle around the shoulders.` |
| 5 | `Variant: A scout's quilted gambeson with leather shoulder reinforcements, light + practical, archer aesthetic.` |
| 6 | `Variant: A ceremonial priest's robe top with gold embroidery along the neckline + sleeves, white fabric, holy aesthetic.` |
| 7 | `Variant: A barbarian's bare-chest fur jerkin, fur trim at the shoulders + waist, exposed sternum, primal aesthetic.` |
| 8 | `Variant: A noble's brocade jacket with intricate gold thread filigree across the chest panels, high collar, three buttons running centre.` |
| 9 | `Variant: A samurai's lacquered chest armour (do) with rectangular plates laced together with vibrant cord, shoulder guards (sode).` |
| 10 | `Variant: A demon-knight chest plate with bone-rib motif across the chest, dark metal, spiked pauldrons.` |
| 11 | `Variant: A pirate's billowy white shirt with loose collar, puffed sleeves, leather corset belt cinching the waist.` |
| 12 | `Variant: A gothic Victorian waistcoat with double-breasted brass buttons, high collar, formal aesthetic.` |
| 13 | `Variant: A crystal-mage breastplate with a glowing blue gemstone embedded in the centre, magical-knight hybrid aesthetic.` |
| 14 | `Variant: A school uniform blazer with a centred badge over the heart, neat lapels, shirt collar visible underneath.` |
| 15 | `Variant: A summer camisole top with thin shoulder straps, lace trim along the neckline, light + airy aesthetic.` |

### Body Bottom variants (12 options)

| # | Variant line |
|---|---|
| 1 | `Variant: Loose-fitting cloth trousers cinched at the waist, gentle drape, slight taper toward the ankles.` |
| 2 | `Variant: Articulated steel plate leg armor with cuisses on the thighs and greaves on the shins, riveted joints at the knees, fantasy knight aesthetic.` |
| 3 | `Variant: A long flowing mage robe-skirt, ankle-length, with intricate hem embroidery, billowing fabric.` |
| 4 | `Variant: Tight-fitting leather assassin trousers with multiple thigh pouches and buckled straps at the calves.` |
| 5 | `Variant: A hakama (samurai pleated trousers) with seven sharp pleats down the front, indigo blue, traditional aesthetic.` |
| 6 | `Variant: A noblewoman's full ballgown skirt with layered ruffles at the hem, cinched waistband.` |
| 7 | `Variant: A barbarian's loincloth with a leather belt, exposed thighs, fur waist trim, primal aesthetic.` |
| 8 | `Variant: A ranger's quilted forest-green leggings with knee-pads and side pouches, wilderness aesthetic.` |
| 9 | `Variant: A pirate's slashed knee-length breeches with frayed hem, wide leather belt with brass buckle.` |
| 10 | `Variant: A schoolgirl's pleated mini-skirt, tartan pattern, pleats radiating from the waist.` |
| 11 | `Variant: A tactical military combat trousers with cargo pockets at the thighs, knee reinforcements.` |
| 12 | `Variant: A simple linen apron-skirt with a centred pocket, peasant aesthetic, ankle-length.` |

### Gloves variants (10 options)

| # | Variant line |
|---|---|
| 1 | `Variant: Soft cream-colored fingerless cloth gloves with leather wrist-cuffs and small decorative stitching, both hands shown side by side.` |
| 2 | `Variant: Heavy iron knight gauntlets with riveted plate fingers, articulated knuckle plates, steel cuffs, both hands shown side by side.` |
| 3 | `Variant: Mage's enchanted gloves with glowing rune embroidery on the back of each hand, wrist-flared cuffs, both hands.` |
| 4 | `Variant: Leather archer's bracers covering the forearm + wrist, fingerless palms exposed, both hands shown.` |
| 5 | `Variant: Assassin's tight black gloves with knuckle reinforcements and hidden wrist-blades sheathed underneath, both hands.` |
| 6 | `Variant: Royal noble's white silk gloves extending past the wrist, gold cuff embroidery, formal aesthetic, both hands.` |
| 7 | `Variant: Crystal-mage gloves with translucent gemstone palms that emit faint light, magical aesthetic, both hands.` |
| 8 | `Variant: Studded leather brawler gloves with brass knuckle inserts visible across the fingers, both hands.` |
| 9 | `Variant: Furred barbarian wraps, leather strips wound around the wrists with fur trim at the cuffs, both hands.` |
| 10 | `Variant: Dragon-scale gauntlets with overlapping iridescent scales running up the back of each hand, both hands.` |

### Boots variants (10 options)

| # | Variant line |
|---|---|
| 1 | `Variant: Knee-high cream-colored leather boots with soft folds at the ankle, simple metal buckles up the side, rounded toes, both feet shown.` |
| 2 | `Variant: Heavy iron plate sabatons covering the feet with greaves rising up the shins, riveted plate construction, knight aesthetic, both feet.` |
| 3 | `Variant: Soft cloth slippers with curled-up toes (Persian-style), ankle-length, both feet.` |
| 4 | `Variant: Tall ranger leather boots with multiple cross-laced straps up the front, fur trim at the top, both feet.` |
| 5 | `Variant: Tactical combat boots, ankle-length, with thick rubber soles and three buckled straps across the front, both feet.` |
| 6 | `Variant: Dancer's pointed slipper-shoes with thin ribbon ties wrapping up the ankle, light + airy aesthetic, both feet.` |
| 7 | `Variant: Samurai zori sandals with a wide cloth strap, raised wooden block soles, traditional aesthetic, both feet.` |
| 8 | `Variant: Pirate captain's tall folded-cuff boots with brass buckles and worn leather, knee-high, both feet.` |
| 9 | `Variant: Crystal-mage boots with translucent gemstone heels that emit faint glow, magical aesthetic, both feet.` |
| 10 | `Variant: Barbarian fur-wrapped foot wraps with leather straps crisscrossing up the calves, both feet.` |

### Weapon variants (20 options)

> Weapons skip the tint-friendly palette — paint at full natural
> saturation. The grip pixel must clasp exactly at hand anchor
> (540,460); the rest of the weapon extends from that point.

| # | Variant line |
|---|---|
| 1 | `Variant: A medieval longsword with cruciform crossguard, polished steel blade, leather-wrapped grip, gold-and-ruby pommel. Blade pointing UP and slightly forward at a 30-degree angle.` |
| 2 | `Variant: A two-handed greatsword, wider blade, leather-wrapped two-handed grip, blade pointing UP at a 25-degree angle, fantasy-knight aesthetic.` |
| 3 | `Variant: A wizard's staff held vertically. Dark wooden shaft, staff bottom near y=720, staff top near y=80 capped with a softly glowing blue crystal orb wreathed in faint magical wisps.` |
| 4 | `Variant: A wizard's staff held vertically with a coiled-snake wooden carving at the head and a green crystal in the snake's mouth, druidic aesthetic.` |
| 5 | `Variant: A curved short dagger with a black leather-wrapped grip, polished single-edge blade pointing FORWARD and slightly DOWNWARD, small jeweled pommel.` |
| 6 | `Variant: A pair of crossed straight daggers held grip-up, both points down, twin assassin blades, ornate matching pommels.` |
| 7 | `Variant: A wooden recurve bow held vertically. Bow grip clasped at hand anchor, top of bow at y=80, bottom of bow at y=720. Bowstring visible parallel to the bow. No arrow nocked.` |
| 8 | `Variant: A long English-style longbow held vertically, simple wood without ornament, warm honey-brown finish, bowstring drawn taut.` |
| 9 | `Variant: A cavalry sabre with curved blade, gold cup-hilt protecting the grip, blade pointing UP-FORWARD at a 40-degree angle.` |
| 10 | `Variant: A war hammer with a heavy iron head topped with a flat striking face on one side and a curved spike on the other, leather-wrapped wooden haft, head pointing UP.` |
| 11 | `Variant: A double-bladed battle axe head atop a wooden haft, leather-wrapped grip, twin curved cutting edges, head pointing FORWARD.` |
| 12 | `Variant: A spear held vertically with a leaf-shaped iron tip pointing UP at y=80, wooden shaft, leather grip, spear butt at y=720.` |
| 13 | `Variant: A magical wand made of polished dark wood with a small star-shaped golden tip, held grip-up, length about 200 px from the hand.` |
| 14 | `Variant: A scythe with a long curved black blade running diagonally across the upper body, wooden shaft, dark reaper aesthetic.` |
| 15 | `Variant: A pair of nunchaku held by one connected handle, the second handle dangling from a short chain at hand level, martial-arts aesthetic.` |
| 16 | `Variant: A holy mace with a flanged iron head shaped like a sun rising, gold filigree around the haft, paladin aesthetic.` |
| 17 | `Variant: A flintlock pistol held grip-down with the muzzle pointing UP-FORWARD, brass barrel, ornate carved wooden grip, swashbuckler aesthetic.` |
| 18 | `Variant: A whip-blade dual weapon — segmented metal blade looking like a sword that can extend, coiled but with the handle solid at the grip.` |
| 19 | `Variant: A katana with curved single-edge blade, wrapped tsuka grip with menuki ornament, tsuba (cross-guard), blade pointing UP at a 30-degree angle.` |
| 20 | `Variant: A crystal sword whose blade is made of glowing translucent blue crystal instead of metal, gold cross-guard, magical aesthetic.` |

---

## Style notes — what makes the output match the existing kit

The locked prefix specifies "soft painterly cel-shaded anime style,
MapleStory aesthetic". Output looks right when:

- **2-tone or 3-tone shading** per material — base color + one shadow
  + (optional) one highlight. No painterly gradients with 10+ tones.
- **Crisp ink-line outlines** along major silhouette edges (~2 px),
  thinner for internal seam lines.
- **Soft anti-aliased edges** at the silhouette outer edge (no
  pixel-art harsh stair-stepping). The renderer scales down ~14×; AA
  at 800×800 ends up clean at the chibi size.
- **Warm-leaning palette** for organic materials (wood, leather,
  fabric — cream, ochre, sienna), cool-leaning for inorganic (steel,
  crystal — silver, slate, ice).
- **No background elements** — the prompt says transparent + "no
  character / no body / no other clothing" three different ways
  because Ludo will sometimes still add chibi outlines if you don't
  emphasize. If output includes a partial body, regenerate.

## Tint-friendliness reminders

If you're authoring clothing that you want to recolour at runtime via
`item.tint = '#hex'`, the prompt MUST emphasise the neutral palette:

- ✅ "NEUTRAL LIGHT CREAM (#e8d8b8) base color for runtime
  multiply-blend tinting — paint in flat cream with subtle painterly
  shading"
- ✅ "NEUTRAL LIGHT GREY METAL (#c8c8d0) base color — paint in flat
  light grey with subtle painterly highlights, no saturated colors"

The slot blocks above already include this for clothing. If you write
a custom variant that uses saturated colour ("crimson cape", "emerald
robe"), you lose tint-friendliness — that piece supports only its
authored colour, no recolour variants.

For one-off signature pieces (e.g. a unique boss-drop weapon) where
tinting doesn't apply, override the slot block's palette guidance with
specific colours.

## What to do if output is misaligned

If a generated piece's content lands at the wrong Y inside the canvas
(e.g. helmet is centred at y=400 instead of y=180), either:

1. **Re-prompt with stronger anchor language.** Add an explicit "MUST
   place the piece's centre at exactly y=180" line. Ludo respects
   numeric coordinates better than relative descriptions.
2. **Open in Photoshop and reposition.** Cut + paste the content to
   the correct Y, save out at 800×800. This is faster than
   re-rolling for one-off corrections.
3. **Add a per-sprite render-rect override** in
   `_drawEquipmentLayer` if multiple AI generations consistently
   land at the same off-Y. The function already supports a
   per-spriteId offset map (commit-pending — see the open follow-up
   in v0.25.305 changelog).
