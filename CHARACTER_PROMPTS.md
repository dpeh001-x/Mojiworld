# Character sprite prompts — hair / eyes / mouth (v0.25.325)

Copy-paste Ludo prompts for the three **character-appearance** sprite
layers: `LX_HAIR`, `LX_EYES`, `LX_MOUTH`. These are NOT equipment —
they sit inside the head region and follow a different anchor map
than the 800×800 body-anchor template used by armor / weapons / boots.

> **Workflow:** paste `[A] LOCKED PREFIX` + `[B] LAYER BLOCK`
> (hair / eyes / mouth) + `[C] VARIANT LINE` into Ludo's prompt input
> as one continuous paragraph. Set `image_type: "sprite"`,
> `art_style: "Anime/Manga"`, `aspect_ratio: "ar_1_1"`, `n: 1`.
> Output lands at 768×768; the renderer auto-scales to 800×800 at
> the head-aligned dest rect `(-58, -52, 108, 108)`.

---

## Canvas + head anchor map (locked)

All three layers share one canvas and one head bbox. The renderer
draws every layer at the same rect, so painting outside the bbox is
fine for hair (envelopes the head) but pointless for eyes / mouth.

| | |
|---|---|
| **Canvas** | 800 × 800 transparent |
| **Head silhouette bbox** | (245, 215) → (612, 585) — 367 × 370 |
| **Crown of head** | (430, 220) |
| **Head centre** | (430, 400) |
| **Chin** | (430, 585) |
| **Eye band** | roughly y = 360–420, paired around x = 400 / 460 |
| **Mouth band** | roughly y = 470–520, centred on x = 430 |
| **Hair envelope** | may extend above y = 215 and ± 80 px beyond bbox sides |

> The head sprite itself (`Sprites/character/head/flow.webp`) defines
> the silhouette these layers wrap. Drop it into a reference layer at
> 10–20 % opacity while authoring so eye / mouth placement lands on
> the actual face — exactly the same workflow as the equipment
> template.

---

## [A] LOCKED PREFIX — paste verbatim every time

> Chibi anime face / hair piece for a layered character creator. Pure
> transparent background. Drawn on an 800×800 square canvas. Implied
> chibi head silhouette occupies bbox (245,215)–(612,585), centred
> on (430,400). Crown at (430,220), chin at (430,585). Soft painterly
> cel-shaded anime style, MapleStory aesthetic. Render ONLY the
> [LAYER] piece — no head silhouette, no body, no neck, no other
> facial features.

Replace `[LAYER]` with: `hair`, `eyes`, or `mouth`.

---

## [B] LAYER BLOCKS — paste the one matching your layer

### HAIR LAYER BLOCK

> Layer = hair. Hair envelopes the chibi head silhouette: crown
> coverage starting at y = 180–220 (above the 215 bbox top so the
> hairline overhangs forward), side coverage flanking x = 245–612,
> and may extend past the bbox horizontally up to ±80 px for volume.
> Paint the FULL silhouette of the hairstyle including back-hair
> volume visible behind the head. Two- or three-tone cel shading,
> crisp ink-line outline (~2 px). Authored in NEUTRAL DARK BROWN
> (#3a2218 base, #5a3624 highlight, #1a0a04 shadow) so the multiply-
> blend tint cache can recolour to any of the 8 supported hair
> colours at runtime — saturated colours bake the tint in and lose
> recolour support.

### EYES LAYER BLOCK

> Layer = eyes. Render a PAIR of chibi anime eyes only. Each eye
> sits inside the head bbox at approximately (400, 390) and (460,
> 390), separated by ~60 px, ~30 px tall × ~45 px wide. No nose, no
> brows-without-eyes, no eyelashes drifting outside that band. Crisp
> ink-line outline (~2 px) on whites; saturated iris colour with a
> single soft specular pip. The pair may include matching eyebrows
> directly above each eye (y ≈ 350) at the artist's discretion.
> Symmetric across x = 430.

### MOUTH LAYER BLOCK

> Layer = mouth. Render a SINGLE chibi anime mouth shape only. Sits
> at approximately (430, 490), no taller than ~25 px and no wider
> than ~50 px. No nose, no chin, no facial outline around it. Crisp
> ink-line outline (~2 px), warm subtle inner colour. Centred on
> x = 430. Symmetric unless the variant explicitly calls for an
> asymmetric smirk / fang.

---

## [C] HAIR VARIANT MENU (12 styles)

| Style | Filename | Variant line |
|---|---|---|
| **Long flow** | `flow.webp` | `Variant: Long flowing hair past the shoulders, soft side-swept bangs covering one eyebrow. Generous side volume. Romantic / heroine aesthetic.` |
| **High ponytail** | `ponytail.webp` | `Variant: Tall genki high ponytail tied at crown with a small ribbon, side bangs framing the face. Volume swept up and backward. Energetic schoolgirl aesthetic.` |
| **Shaggy crop** | `shaggy.webp` | `Variant: Loose unkempt shaggy layered cut, choppy mid-length strands falling over the forehead and ears. Tousled bedhead aesthetic.` |
| **Spiky shounen** | `spiky.webp` | `Variant: Aggressive shounen spiked hair with sharp pointed clusters radiating outward, gravity-defying volume. Battle-anime hero aesthetic.` |
| **Flowy waves** | `flowy.webp` | `Variant: Long flowing wavy hair with gentle curls, voluminous bottom layer. Storybook princess aesthetic.` |
| **Ice-cream tower** | `ice_cream.webp` | `Variant: Tall soft tower-bun pulled high on the crown like an ice-cream cone, two short side strands at the cheeks. Cute mascot aesthetic.` |
| **Pigeotto crop** | `pigeotto.webp` | `Variant: Short cropped front-tuft style with one wide bang sweeping across the forehead, sides cleanly tapered. Boyish anime protagonist aesthetic.` |
| **Twin pigtails** | `pigtails.webp` | `Variant: Twin low pigtails tied with simple bands behind each ear, blunt-cut bangs across the forehead. Genki schoolgirl aesthetic.` |
| **Topknot bun** | `topknot.webp` | `Variant: Tight topknot bun tied at crown, sleek sides pulled smooth, optional short side-strand at one temple. Samurai / martial-artist aesthetic.` |
| **Curly afro halo** | `afro.webp` | `Variant: Round full curly halo of tight ringlets framing the face, even volume on all sides. Chibi cherub aesthetic.` |
| **Undercut** | `undercut.webp` | `Variant: Long top swept to one side with shaved / very-short undercut on the sides, sharp contrast between top length and side stubble. Edgy modern aesthetic.` |
| **Long ringlets** | `ringlets.webp` | `Variant: Long tightly-spiralled ringlet curls cascading past the shoulders, voluminous side volume, vintage-doll aesthetic.` |

---

## [C] EYES VARIANT MENU (12 styles)

| Style | Filename | Variant line |
|---|---|---|
| **Default round** | `default.webp` | `Variant: Standard chibi round eyes, deep brown iris with a single bright specular pip, simple thin upper eyelid line and short brows above. Calm friendly expression.` |
| **Fierce determined** | `fierce.webp` | `Variant: Fierce slanted determined eyes, sharper outer corners angled upward, narrowed lid line, bold dark eyebrows angled inward. Combat-ready expression.` |
| **Sparkle stars** | `sparkle.webp` | `Variant: Wide-open round eyes with multiple star and circle sparkle pips inside large saturated irises (mint or pink), magical-girl awe expression.` |
| **Sleepy half-lidded** | `sleepy.webp` | `Variant: Half-lidded relaxed eyes, lid covering top third of iris, gentle curve, optional small under-eye line. Drowsy daydreamer expression.` |
| **Cat slit** | `cat.webp` | `Variant: Cat-like slit pupils inside large yellow-green irises, sharper almond-shaped lid line, slight upward outer corner. Mischievous trickster expression.` |
| **Closed smile** | `closed.webp` | `Variant: Both eyes closed in upturned crescent arcs (^_^), no iris visible, soft happy lashes. Cheerful expression.` |
| **One-eye wink** | `wink.webp` | `Variant: Right eye open with normal round iris, left eye closed in upturned crescent, asymmetric playful wink expression.` |
| **Round glasses** | `glasses.webp` | `Variant: Standard round eyes behind thin round wire-frame glasses, light reflection across one lens. Studious scholar expression.` |
| **Scar slash** | `scarred.webp` | `Variant: Standard determined eyes with one diagonal scar across the right brow / cheek (faint pink line), unaffected gaze. Battle-hardened veteran expression.` |
| **Heterochromia** | `heterochromia.webp` | `Variant: Round eyes with mismatched iris colours (left eye gold, right eye violet), each with single specular pip. Mystical otherworldly expression.` |
| **Cyber visor** | `cyber.webp` | `Variant: Eyes hidden behind a horizontal glowing cyan visor band across the eye line, two slit highlights where pupils would be. Cyberpunk netrunner expression.` |
| **Tearful glisten** | `teary.webp` | `Variant: Wide round eyes brimming with a single visible tear droplet at the inner corner, glossy oversized speculars across the iris. Vulnerable emotional expression.` |

---

## [C] MOUTH VARIANT MENU (12 styles)

| Style | Filename | Variant line |
|---|---|---|
| **Default smile** | `default.webp` | `Variant: Small soft closed-mouth smile, gentle upturned curve, warm rose-tinted lip line, no teeth visible. Friendly default expression.` |
| **Big grin** | `grin.webp` | `Variant: Wide open-mouth grin showing top row of small even white teeth, upturned corners, joyful expression.` |
| **Smirk** | `smirk.webp` | `Variant: Asymmetric one-sided smirk, only the right corner pulled up, small confident curve. Cocky expression.` |
| **Surprise O** | `surprise.webp` | `Variant: Small round open mouth in a perfect "O" shape, slight inner-mouth shadow visible. Startled expression.` |
| **Tongue out** | `tongue.webp` | `Variant: Open mouth with tongue sticking out playfully to one side, small teeth visible above tongue. Cheeky expression.` |
| **Stoic line** | `stoic.webp` | `Variant: A simple flat horizontal mouth line, neither up- nor downturned, no teeth visible. Neutral stoic expression.` |
| **Big laugh** | `laugh.webp` | `Variant: Wide-open laughing mouth showing top teeth and tongue, head-tilt-back energy implied, joyful overflowing laughter expression.` |
| **Pout** | `pout.webp` | `Variant: Small pursed pouty mouth, lower lip slightly pushed forward, downturned corners. Sulky expression.` |
| **Fang grin** | `fang.webp` | `Variant: Half-open grin with one small visible canine fang protruding from the upper lip, mischievous monster-girl / shounen aesthetic.` |
| **Gentle frown** | `frown.webp` | `Variant: Small downturned closed mouth, gentle inverted curve, no teeth. Sad / disappointed expression.` |
| **Blush smile** | `blush.webp` | `Variant: Small soft closed smile with two pink blush dabs centred under each eye on the cheek line. Bashful flustered expression.` |
| **Determined set** | `determined.webp` | `Variant: Tightly closed mouth in a flat slightly-downturned firm line, jaw-set energy. Resolute battle-ready expression.` |

---

## Filename → registry id wire-up

The renderer registries (`LX_HAIR`, `LX_EYES`, `LX_MOUTH` in
`maple_game.html:4906`, `:5059`, `:5078`) map a picker id to a
filename in `Sprites/character/<layer>/`. To wire up a new sprite:

1. Save the generated WebP into the right folder
   (`Sprites/character/hair/spiky.webp`, etc.).
2. Add an entry to the `files` map inside the matching registry —
   `spiky: 'spiky.webp'`.
3. Extend the picker option list in the Q-key Character Studio
   (`HERO_VEC_HAIR_GOO` for hair; `HERO_VEC_EYE_OPTIONS` /
   `HERO_VEC_MOUTH_OPTIONS` for face) so the new id is selectable.
4. Reload — the registry decodes on boot, the picker shows the new
   option, the renderer picks it up the moment the sprite finishes
   decoding.

> Hair sprites authored in **neutral dark brown** retain the
> multiply-blend tint cache — picker recolour works automatically.
> Saturated hair sprites bake the colour in and lose runtime tint;
> ship those only when the colour is part of the style identity
> (e.g. cyber-punk gradient hair).
