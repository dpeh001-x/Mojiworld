# Wardrobe Face + Hair Sprite Prompts — Volume 2

Follow-up batch to `sprite_wardrobe_face_prompts.md`. **12 new hair** + **10 new
eye** prompts. None duplicate the v1 file or the styles already shipped in
v0.25.828 / v0.25.829. Same drop-in pipeline as before — file in
`Sprites/character/<eyes|hair>/`, one-line registry add in `LX_HAIR` / `LX_EYES`
files map + matching entry in `HERO_VEC_*_OPTIONS` + whitelist in
`_migrateHairId` (hair only).

## Shared style header (paste at the top of every prompt below)

> **Style:** Cute chibi Mojiworld character overlay, 16-bit pixel art at 8× upscale (downsamples to a 32 × 48 px character cell). Pure transparent background. 16-color palette, bold 1-pixel dark outline on every shape, cel-shaded with 2 tone bands per material (no painterly gradients), warm key light from upper-left, crisp pixel edges — NO anti-aliasing blur. Hair overlays frame the chibi head silhouette (top 80 % of canvas, head visible behind/underneath). Eye overlays render two eyes centered horizontally, vertically at ~y=20 of a 48-tall cell.

---

# §1. HAIR — 12 new styles

### 1.1 `witchHat` — Witch Hat 🧹  → `Sprites/character/hair/witch_hat.webp`

```
[SHARED STYLE HEADER]
Chibi spooky-cute "Witch Hat" overlay: tall pointed black witch hat with a wide curling brim and a slight bend at the tip. A small thin gold buckle on the band. Long stringy lime-green hair pokes out from under the brim, framing the cheeks and dangling past the shoulders. A single black cobweb pattern detail on the hat side. Palette: pure #1a1a22 hat black, #6cdd66 hair green with #44aa44 shadow band, gold buckle #ffdd88. Reads as: small witch, definitely up to something.
```

### 1.2 `twinBuns` — Twin Buns 🍡  → `Sprites/character/hair/twin_buns.webp`

```
[SHARED STYLE HEADER]
Chibi magical-girl "Twin Buns" overlay: hair parted in the middle, gathered into two tight round buns ON TOP of the head (one on each side), with long ponytails streaming down from each bun. Front bangs in a soft V-shape across the forehead. Each bun secured with a small jeweled scrunchie. Palette: golden yellow #ffd566 hair with #cca844 mid-tone, scrunchies in opal pink #ff99cc with a single white sparkle pixel. The bun-on-ponytail combo is the silhouette — instantly recognizable from a Sailor-Moon-inspired tradition.
```

### 1.3 `pirateBandana` — Pirate Bandana ☠️  → `Sprites/character/hair/pirate_bandana.webp`

```
[SHARED STYLE HEADER]
Chibi swashbuckler "Pirate Bandana" overlay: crimson red bandana wrapped tightly around the head with a knot tied at the back, two pointed bandana tails flapping behind. A small skull-and-crossbones embroidered in white on the bandana center over the forehead. Wild chestnut tufts of hair escape from under the front edge and stick up in unkempt spikes. Palette: deep #cc2244 bandana red with #8a1a30 shadow, #ffffff skull, #6a3a20 hair brown, #a85a30 highlight. Reads as: small pirate, no respect for laws of geography.
```

### 1.4 `knightCoif` — Knight's Coif 🛡️  → `Sprites/character/hair/knight_coif.webp`

```
[SHARED STYLE HEADER]
Chibi paladin "Knight's Coif" overlay: a chainmail head-cover (coif) wrapping the head and neck, with metallic ring texture rendered as small dotted hatch. A small leather strap chinstrap visible under the jaw. No hair visible — fully covered. A subtle blue silk lining peeks at the forehead edge. Palette: steel-grey #aaa8b0 chainmail base with #6a6870 shadow ring + #d8d8e0 highlight glints, brown chinstrap #6a4622, blue lining #4488dd. Heroic / serious silhouette — would pair well with the warrior class color identity.
```

### 1.5 `galaxyHair` — Galaxy Flow 🌌  → `Sprites/character/hair/galaxy_hair.webp`

```
[SHARED STYLE HEADER]
Chibi cosmic "Galaxy Flow" hairstyle overlay: long flowing hair in deep cosmic purple, scattered with small white pinprick stars and one or two slightly-larger swirly nebula clusters in cyan and pink. The hair flows back as if there's a gentle wind. Multiple subtle highlight strands give it volumetric depth. Palette: deep midnight #2a1648 base, #5a3490 mid-tone, #aa66cc highlight strand, scattered #ffffff star pinpricks, nebula cluster mix #66ccff + #ff99dd. Reads as: starborn, slightly otherworldly mage.
```

### 1.6 `mushroomCap` — Mushroom Cap 🍄  → `Sprites/character/hair/mushroom_cap.webp`

```
[SHARED STYLE HEADER]
Chibi forest-druid "Mushroom Cap" hairstyle overlay: a literal red-and-white-spotted mushroom cap sitting on the head like a hat, with the cap's gilled underside visible at the brim. Wispy moss-green hair tufts poke out around the temples and back. The cap is rounded and plump — friendly toadstool energy. Palette: bright red #dd4444 cap top with #aa2222 shadow, #ffffff dot spots, gilled underside #ffe0c4 cream, hair #6a8a5a moss green with #4a6a3a shadow. Reads as: tiny forest spirit, friend of mushpup.
```

### 1.7 `haloBlonde` — Halo of Light 😇  → `Sprites/character/hair/halo_blonde.webp`

```
[SHARED STYLE HEADER]
Chibi divine "Halo of Light" hairstyle overlay: short layered platinum-blonde hair brushed back from the face, soft front bangs swept slightly to the side. Floating ~8 pixels ABOVE the head: a thin glowing golden halo ring rendered as an ellipse with bright gold core and pale-yellow outer glow. Palette: platinum-blonde #f0e0a0 hair with #d0b070 shadow + #ffffff highlight strands, halo bright gold #ffe06a core with #ffffaa glow, faint star sparkle pixels #ffffff around the halo. Reads as: small angel, possibly mid-blessing.
```

### 1.8 `fauxHawk` — Faux-hawk ✂️  → `Sprites/character/hair/fauxhawk.webp`

```
[SHARED STYLE HEADER]
Chibi alt-skater "Faux-hawk" hairstyle overlay: medium-length hair on the sides (NOT shaved like the mohawk), but the center strip pulled UP and styled into a soft ridge running front-to-back along the crown. Less aggressive than a mohawk — looks more like a deliberate style choice than a punk statement. Palette: warm dark brown #4a2a1a base with #6a4a2a highlights, the center ridge slightly lighter where the upper-left key light catches it. Reads as: cool-kid attempt that mostly works, mostly tries too hard.
```

### 1.9 `himeCut` — Hime Cut 🎴  → `Sprites/character/hair/hime_cut.webp`

```
[SHARED STYLE HEADER]
Chibi traditional-Japanese "Hime Cut" hairstyle overlay: jet-black hair in a precisely-cut style — straight blunt bangs across the forehead, two thick straight side-locks falling past the cheeks ending sharply at the jawline, and the rest of the hair flowing long down the back past the waist. Every line is cleanly cut, never wavy. Single faint blue silk ribbon visible mid-back of the long hair. Palette: pure inky black #0a0a14 with subtle deep-blue #1a2030 highlight ribbons, single accent ribbon #4488aa. Reads as: small noblewoman, knows exactly how this is going to go.
```

### 1.10 `flowerCrown` — Flower Crown 🌸  → `Sprites/character/hair/flower_crown.webp`

```
[SHARED STYLE HEADER]
Chibi spring-festival "Flower Crown" hairstyle overlay: soft sandy-blonde hair in a relaxed shoulder-length wave, with a thick laurel-style crown of small flowers and green leaves wrapping over the top of the head. Mix of three flower types: small pink five-petal blooms, white daisies, and one or two bright yellow buttercups. Tiny green leaf accents fill between blooms. Palette: warm sandy hair #d4b878 with #a88848 shadow, flowers #ffaabb pink, #ffffff daisy, #ffdd55 yellow, leaves #6a9a44 with #4a6a30 shadow. Soft, joyful, slightly hippie-coded.
```

### 1.11 `antlers` — Forest Antlers 🦌  → `Sprites/character/hair/antlers.webp`

```
[SHARED STYLE HEADER]
Chibi forest-spirit "Antlers" hairstyle overlay: small branching deer antlers (2 or 3 prongs per side) growing up out of the top of the head, with shoulder-length forest-brown hair flowing around them. The antlers have a few tiny moss patches and one small acorn detail. The hair is parted to make room for the antlers — slight separation visible where the antler base meets the scalp. Palette: warm cervine antler #d4a878 with #a86840 shadow + #ffe0a8 highlight tip, hair #5a3a20 mahogany with #7a5a3a mid-tone, accent moss patches #6a8a5a + #ffaa44 acorn. Reads as: small forest spirit, definitely not human.
```

### 1.12 `cyberStrands` — Cyber Strands 🦾  → `Sprites/character/hair/cyber_strands.webp`

```
[SHARED STYLE HEADER]
Chibi cyberpunk "Cyber Strands" hairstyle overlay: short jet-black hair on the sides with three thick neon-glowing strands flowing back from the crown — one cyan, one magenta, one electric purple. Each strand is straight and chrome-like with a slight metallic sheen. Small implants/ports visible at the temples as tiny silver chips. The neon strands appear to softly glow against the dark hair beneath. Palette: pure black #0a0a14 base hair, glow strands #44ddff cyan / #ff44cc magenta / #cc44ff purple with white-hot pinpoint cores #ffffff, temple-implant silver #c8c8d8. Reads as: small netrunner, jacked in, possibly out of patience.
```

---

# §2. EYE STYLES — 10 new prompts

Each renders at ~256 × 192 transparent webp (small overlay framed for the face
region only — calibrate framing against `default.webp` at 3 KB on disk).

### 2.1 `heterochromia` — Heterochromia 👁️‍🗨️  → `Sprites/character/eyes/heterochromia.webp`

```
[SHARED STYLE HEADER]
Chibi mystic "Heterochromia Eyes" overlay: two round eyes — the LEFT eye has a SAPPHIRE BLUE iris, the RIGHT eye has a WARM GOLD iris. Same shape on both (default cute roundness), same single-white catchlight on each pupil — only the iris color differs. Subtle pink dot in the inner corner of each eye for warmth. Palette: blue iris #4488dd with #2a5588 darker rim, gold iris #ffcc44 with #cc8822 darker rim, white catchlights, black pupil cores. Reads as: rare and quietly powerful — one of you might be marked by something old.
```

### 2.2 `crying` — Crying 😭  → `Sprites/character/eyes/crying.webp`

```
[SHARED STYLE HEADER]
Chibi tearful "Crying Eyes" overlay: both eyes drawn as the default round shape but with a thick rim of pooling tears at the lower lid, AND two large round teardrops actively cascading down the cheeks below each eye (one drop per cheek, slightly different sizes). Slight pink/red rim around the eye outlines suggests crying. Tiny white catchlights still visible inside the iris through the tears. Palette: standard black-brown iris, pale blue #aaddff tears with white #ffffff highlight pixel, pink rim #ff8a99 around the outer eye outline. Reads as: completely overwhelmed in a sympathetic way.
```

### 2.3 `galaxy` — Galaxy Eyes 🌌  → `Sprites/character/eyes/galaxy.webp`

```
[SHARED STYLE HEADER]
Chibi cosmic "Galaxy Eyes" overlay: both eyes filled with a swirling cosmic field — deep purple base with scattered tiny white star pinpricks, a swirl of cyan/pink nebula winding inside each iris. Pupils are a tiny black dot at the center surrounded by the cosmos. Eye outlines slightly upturned at the outer corners for "lifted" wonder. Palette: deep midnight #1a1040 base, swirl of #66ccff cyan + #ff99dd pink, scattered #ffffff stars, pupil #000000 core. Reads as: looked at the universe directly and brought a piece of it home.
```

### 2.4 `spiral` — Hypnotic Spiral 🌀  → `Sprites/character/eyes/spiral.webp`

```
[SHARED STYLE HEADER]
Chibi enchanted "Hypnotic Spiral Eyes" overlay: both pupils replaced with concentric spiral rings alternating black and white, spiraling inward to a central point. The spirals are NOT in motion — they're static art, but they read as if they're rotating. Eye whites slightly tinted pink at the corners for trance vibes. Palette: alternating #000000 / #ffffff spiral rings only, faint #ffccdd pink eye-corner tint. Reads as: just got hit by an enchantment, or willingly volunteered for one.
```

### 2.5 `goggles` — Goggles 🥽  → `Sprites/character/eyes/goggles.webp`

```
[SHARED STYLE HEADER]
Chibi tinkerer "Goggles" overlay: both eyes COVERED by a pair of brass steampunk goggles. Each goggle is a small round lens with a brass rim, a leather strap visible at the sides, and the lens itself rendered as a shiny gradient circle — pale tinted glass with white reflection highlight in the upper-left of each lens. Strap visible crossing horizontally just under the lenses. Palette: brass rims #cc9944 with #886622 shadow, leather strap #6a4422, lens glass #aaccff pale blue with bright #ffffff catchlight. Reads as: small inventor, eyes possibly closed behind the lenses, hard to tell.
```

### 2.6 `eyepatch` — Eyepatch 🏴‍☠️  → `Sprites/character/eyes/eyepatch.webp`

```
[SHARED STYLE HEADER]
Chibi rogue "Eyepatch" overlay: the RIGHT eye (viewer's right) is fully open — large, round, alert iris in icy gray-blue with strong white catchlight. The LEFT eye is COVERED by a black leather eyepatch — circular patch with a faint stitch detail around the edge, and a thin leather strap visible above and below the patch crossing to the back of the head. Palette: open eye iris #6688aa with deeper #2a4466 shadow + #ffffff catchlight, patch leather #1a1a14 with subtle stitch hatch in #4a4a3a. Reads as: small adventurer with a story they're not telling.
```

### 2.7 `puppyDog` — Puppy-Dog Eyes 🥺  → `Sprites/character/eyes/puppy_dog.webp`

```
[SHARED STYLE HEADER]
Chibi pleading "Puppy-Dog Eyes" overlay: both eyes drawn EXTRA-LARGE (~25 % bigger than default) and shimmering — multiple white catchlights per eye (two big, one small) instead of just one, suggesting wet glistening. Upper lid edge slightly raised so the iris reads as "round upward" — the classic "please?" expression. Tiny pink under-eye blush emphasizes the appeal. Palette: standard warm-brown iris with multiple #ffffff catchlights, pink under-eye blush #ffccdd. Reads as: absolutely about to manipulate you, and you're going to let them.
```

### 2.8 `squint` — Laughing Squint 😆  → `Sprites/character/eyes/squint.webp`

```
[SHARED STYLE HEADER]
Chibi joyful "Laughing Squint Eyes" overlay: both eyes drawn as TIGHTLY-CLOSED upward-curving arcs (steeper than the "closed zen" curve in v1 — these are squeezed shut with cheek-lifting force). A small smile crinkle is implied at the outer corner of each eye. Both eyes asymmetric on purpose to suggest a moment of being CAUGHT laughing. Palette: dark brown #2a1a18 lid lines only, faint pink #ffccdd cheek-crinkle suggestion. Reads as: full-body laugh, eyes physically can't open right now.
```

### 2.9 `vampireRed` — Vampire Red Glow 🩸  → `Sprites/character/eyes/vampire_red.webp`

```
[SHARED STYLE HEADER]
Chibi predator "Vampire Red Glow Eyes" overlay: both eyes drawn with a deep blood-red iris that softly glows from within, a single vertical-slit pupil like a cat's eye, and a small halo of bright crimson light radiating outward 2-3 pixels beyond each eye outline. White of eye still visible but tinted pinkish from the glow. Eye shape slightly upturned/narrow at the outer corners (predatory). Palette: deep red iris #cc1133 with brighter #ff4455 center glow, vertical pupil #000000 slit, halo bleed #ff8899 fading to nothing, eye-white #ffe0e0 pink tint. Reads as: small vampire, has not eaten, might forget themselves.
```

### 2.10 `cybernetic` — Cybernetic 🤖  → `Sprites/character/eyes/cybernetic.webp`

```
[SHARED STYLE HEADER]
Chibi cyborg "Cybernetic Eyes" overlay: the LEFT eye (viewer's left) is biological — standard round eye, warm amber iris, single white catchlight. The RIGHT eye is MECHANICAL — a glowing red rectangular HUD lens with a thin horizontal cyan tracking-line scanning across, set into a small metal eye-socket frame visible around it. A subtle metal cheek-plate accent below the mechanical eye implies the cybernetic conversion extends past the eye itself. Palette: amber iris #ffaa44 for organic eye + #ffffff catchlight, mech eye red glow #ff4444 lens with #44ddff cyan scan-line, frame chrome #aaa8b0 with #6a6870 shadow. Reads as: small soldier, half mended.
```

---

# §3. Submission order + budget

Suggested batching for Ludo.ai automation:

| Tier | Count | Credits |
|---|---|---|
| Hair §1.1 – §1.12 | 12 | ~12 |
| Eyes §2.1 – §2.10 | 10 | ~10 |
| **Total** | **22** | **~22** |

Budget **28–30 credits** if re-rolling — Cyber Strands, Galaxy Flow, and
Vampire Red are the highest-risk renders. The neon-glow ones in particular
benefit from a re-roll since some image generators muddy the high-saturation
strands against pixel-art lines.

# §4. After files land — wiring step

Identical pattern to v0.25.828 / v0.25.829. Three places to add a one-liner
each:

```js
// HERO_VEC_HAIR_OPTIONS at ~L45820 — append:
{ id:'witchHat',      name:'Witch Hat 🧹'      },
{ id:'twinBuns',      name:'Twin Buns 🍡'      },
{ id:'pirateBandana', name:'Pirate Bandana ☠️' },
{ id:'knightCoif',    name:'Knight Coif 🛡️'    },
{ id:'galaxyHair',    name:'Galaxy Flow 🌌'    },
{ id:'mushroomCap',   name:'Mushroom Cap 🍄'   },
{ id:'haloBlonde',    name:'Halo of Light 😇'  },
{ id:'fauxHawk',      name:'Faux-hawk ✂️'      },
{ id:'himeCut',       name:'Hime Cut 🎴'       },
{ id:'flowerCrown',   name:'Flower Crown 🌸'   },
{ id:'antlers',       name:'Forest Antlers 🦌' },
{ id:'cyberStrands',  name:'Cyber Strands 🦾'  },

// LX_HAIR file map at ~L5594 — append:
witchHat:      'witch_hat.webp',
twinBuns:      'twin_buns.webp',
pirateBandana: 'pirate_bandana.webp',
knightCoif:    'knight_coif.webp',
galaxyHair:    'galaxy_hair.webp',
mushroomCap:   'mushroom_cap.webp',
haloBlonde:    'halo_blonde.webp',
fauxHawk:      'fauxhawk.webp',
himeCut:       'hime_cut.webp',
flowerCrown:   'flower_crown.webp',
antlers:       'antlers.webp',
cyberStrands:  'cyber_strands.webp',

// _migrateHairId whitelist at ~L45852 — append to the existing OR chain:
|| id === 'witchHat' || id === 'twinBuns' || id === 'pirateBandana'
|| id === 'knightCoif' || id === 'galaxyHair' || id === 'mushroomCap'
|| id === 'haloBlonde' || id === 'fauxHawk' || id === 'himeCut'
|| id === 'flowerCrown' || id === 'antlers' || id === 'cyberStrands'

// HERO_VEC_EYE_OPTIONS at ~L45882 — append:
{ id:'heterochromia', name:'Heterochromia 👁️'  },
{ id:'crying',        name:'Crying 😭'         },
{ id:'galaxy',        name:'Galaxy 🌌'         },
{ id:'spiral',        name:'Hypnotic 🌀'       },
{ id:'goggles',       name:'Goggles 🥽'        },
{ id:'eyepatch',      name:'Eyepatch 🏴‍☠️'    },
{ id:'puppyDog',      name:'Puppy-Dog 🥺'      },
{ id:'squint',        name:'Laughing 😆'       },
{ id:'vampireRed',    name:'Vampire 🩸'        },
{ id:'cybernetic',    name:'Cybernetic 🤖'     },
```

If you submit and land any of these, ping me with "v2 styles landed" and I'll
do the three-line wire-up + audit as v0.25.832, same as the v0.25.828 pattern.

# §5. Combined wardrobe roster (when both batches land)

| Layer | Current (v0.25.831) | + v1 prompts pending | + v2 prompts pending | **Theoretical max** |
|---|---|---|---|---|
| Hair | 12 | 10 | 12 | **34** |
| Eyes | 2 | 8 | 10 | **20** |
| Mouth | 1 | 8 | (no v2) | **9** |

34 hair × 20 eye × 9 mouth = **6,120 face permutations** at full coverage —
more than enough for the same NPC to feel different every visit.
