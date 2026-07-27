# Wardrobe Face + Hair Sprite Prompts

Image-generation prompts for new **hair / eye / mouth** styles to plug into the
Q-key Character Studio (wardrobe). Each entry is a single-shot prompt suited
for Ludo.ai / Suno-image / Gemini / Nano-Banana, plus the exact filename the
in-game loader expects so the new pick auto-appears in the wardrobe picker
on next page load.

## How the wiring works (one-time read)

The Q-wardrobe builders walk three arrays at boot — adding a new style is a
two-step drop:

| Layer | Picker array (in `mojiworld_game.html`) | Sprite folder | Format |
|---|---|---|---|
| **Hair** | `HERO_VEC_HAIR_OPTIONS` (~L45820) | `Sprites/character/hair/<id>.webp` | 256 × 256 transparent webp, overlay framed to the chibi head |
| **Eyes** | `HERO_VEC_EYE_OPTIONS` (~L45882) | `Sprites/character/eyes/<id>.webp` | Small face-region overlay (~64 × 48), transparent |
| **Mouth** | `HERO_VEC_MOUTH_OPTIONS` (~L45886) | `Sprites/character/mouth/<id>.webp` | Small mouth-region overlay (~48 × 32), transparent |

After dropping the file, add one line to the matching options array, e.g.:

```js
{ id:'bob', name:'Bob 💇' },
```

The wardrobe picker then auto-renders the new tile. No other code change required.

## Shared style header (paste at the top of every prompt)

> **Style:** Cute chibi Mojiworld character overlay, 16-bit pixel art at 8× upscale (the generated image will be downsampled to fit a 32 × 48 px character cell). Pure transparent background. 16-color palette, bold 1-pixel dark outline on every shape, cel-shaded with 2 tone bands per material (no painterly gradients), warm key light from upper-left, crisp pixel edges — NO anti-aliasing blur. The overlay attaches to a peach-skinned bald chibi base with huge round head + tiny body — frame the art so it lands cleanly on a head of approximately 60 % of the canvas width, eyes centered vertically at ~y=20 of a 48-tall sprite, mouth centered at ~y=30.

---

# §1. HAIRSTYLES — 10 new prompts

Each renders at a 256 × 256 transparent webp, framed so the hair sits on top
of the chibi head (the bottom 20 % of the canvas is reserved for the head
silhouette — your hair should NOT extend below that line, so the loader can
composite cleanly on every body pose).

### 1.1 `bob` — Bob 💇  → `Sprites/character/hair/bob.webp`

```
[SHARED STYLE HEADER]
Chibi anime "Bob cut" hairstyle overlay: a rounded chestnut-brown bob ending exactly at the chin level, perfectly framed straight bangs cut just above the eyebrows, a single subtle highlight stripe on the crown catching the upper-left key light. Soft, full-bodied look without spikes. Palette: chestnut brown #6b3a1a with #8a4d22 mid-tone and #ffe0a8 highlight stripe. No accessories — just hair. Render only the hair shape; the bottom-rear of the bob curves cleanly around an implied chibi head.
```

### 1.2 `mohawk` — Mohawk ⚡  → `Sprites/character/hair/mohawk.webp`

```
[SHARED STYLE HEADER]
Chibi punk "Mohawk" hairstyle overlay: a tall, narrow strip of spiky vertical hair running front-to-back along the center of the head with shaved sides. Spikes shoot upward, slightly fanning outward at the tips. Vivid magenta/violet gradient — #d44ad4 base with #ff88ff highlights at the spike tips. Bold black outline preserves chunky punk silhouette. Bottom and sides of the head are SHAVED — only render the central crest and a thin stubble suggestion at the temples. No accessories.
```

### 1.3 `topKnot` — Top Knot 🎎  → `Sprites/character/hair/top_knot.webp`

```
[SHARED STYLE HEADER]
Chibi samurai-style "Top Knot" hairstyle overlay: jet-black hair pulled tight to the scalp, gathered into a single small fan-shaped bun on the top-back of the head. Two thin loose wisps hang in front of the ears. Tied with a small dark-red ribbon at the base of the bun. Palette: #1a1a22 hair black, #4a3030 mid-shadow, #cc2244 ribbon. Compact, clean silhouette — the bun sits high and proud.
```

### 1.4 `longBraid` — Long Braid 🪢  → `Sprites/character/hair/long_braid.webp`

```
[SHARED STYLE HEADER]
Chibi heroic "Long Braid" hairstyle overlay: a single thick chestnut braid draping down the BACK of the character to roughly waist-length, visible behind/around the chibi head silhouette. Front: a center-parted soft fringe with two longer side-locks falling past the cheeks. Braid: clearly textured with diamond pattern, tied at the bottom with a small teal ribbon. Palette: rich auburn #8a4422 with #b86a3a mid-tone, teal ribbon #44a8aa. The braid should clearly read AS a braid even at small size — bold rope-twist suggestion.
```

### 1.5 `curlyAfro` — Curly Afro ☁  → `Sprites/character/hair/curly_afro.webp`

```
[SHARED STYLE HEADER]
Chibi cozy "Curly Afro" hairstyle overlay: a soft, round, voluminous cloud of tightly-coiled curls forming a near-circle around and above the chibi head. Each curl rendered as a small dark spiral cluster, with deeper #2a1a18 base and warm #6a3a28 highlight ribbons. Looks bouncy and full. Palette: warm dark brown base, copper-orange highlights catching the upper-left light. No accessories — pure shape.
```

### 1.6 `sidecut` — Sidecut ✂️  → `Sprites/character/hair/sidecut.webp`

```
[SHARED STYLE HEADER]
Chibi alternative "Sidecut" hairstyle overlay: long swept-over hair on the RIGHT side of the head (from viewer's perspective), the LEFT side completely shaved to short stubble. Long side: pale ash-blonde locks falling past the right cheek, slightly tousled. Shaved side: a thin band of #a8907a stubble texture against scalp pink. The shaved/long contrast is the signature — clean asymmetric line down the part. Single dark eyebrow piercing implied as a tiny stud above the right brow ridge.
```

### 1.7 `pigtails` — Pigtails 🎀  → `Sprites/character/hair/pigtails.webp`

```
[SHARED STYLE HEADER]
Chibi twin-tail "Pigtails" hairstyle overlay: hair parted in the middle, two thick pigtail bunches gathered above the ears and falling down past the shoulders, each tied with a vibrant ribbon. Front bangs in straight-cut style across the forehead. Palette: honey-blonde #d4a868 with #ffe89a highlight, ribbons in bright sky-blue #66bbff. The pigtails should bounce slightly outward, not hang straight — youthful, energetic silhouette.
```

### 1.8 `bedhead` — Bedhead 🛌  → `Sprites/character/hair/bedhead.webp`

```
[SHARED STYLE HEADER]
Chibi disheveled "Bedhead" hairstyle overlay: messy, asymmetric mop of brown hair sticking up in random tufts on top, with a single comically-flat patch on the side where the character clearly slept. One stubborn cowlick spikes upward off the crown. Soft #6a4628 brown with #8a6a40 highlights, one bright #ffd66a sun-glint on the cowlick. Looks slept-in but still cute — not unkempt enough to read as "homeless," just "didn't bother."
```

### 1.9 `wizardHat` — Wizard Hat 🧙  → `Sprites/character/hair/wizard_hat.webp`

```
[SHARED STYLE HEADER]
Chibi mage "Wizard Hat" hairstyle overlay: a tall pointed indigo wizard hat with a slight droopy curve at the tip, brim wide enough to shade the eyes very slightly. White wispy hair pokes out from under the brim around the ears. Star pattern dotted in pale silver across the hat fabric. Palette: deep indigo #2a1a4a hat, silver-white #e8e0ff hair wisps, star points #ffe89a. The brim is the dominant silhouette — confident "I am a small mage" energy.
```

### 1.10 `crownBraid` — Crown Braid 👑  → `Sprites/character/hair/crown_braid.webp`

```
[SHARED STYLE HEADER]
Chibi royal "Crown Braid" hairstyle overlay: long golden hair gathered and braided into a thick ring that wraps over the top of the head like a natural crown, with two loose curled tendrils framing the cheeks. A small spray of forget-me-not flowers tucked into the braid at the right temple. Palette: bright honey-gold #e0b250 with #ffe89a highlight, flower petals #88aaee pale blue with #ffdd66 yellow centers. The braid texture must read clearly — bold rope-twist pattern around the crown line.
```

---

# §2. EYE STYLES — 8 new prompts

Each renders at ~256 × 192 transparent webp (small overlay, framed for the
face region only). The overlay attaches across both eye positions — render
both eyes side by side, centered horizontally. The base file `default.webp`
(3 KB on disk) is the calibration target for size + framing.

### 2.1 `sparkle` — Sparkle ✨  → `Sprites/character/eyes/sparkle.webp`

```
[SHARED STYLE HEADER]
Chibi anime "Sparkle Eyes" overlay: two large, round eyes filled with vivid sapphire-blue irises and a tall white star-shaped catchlight in each. Tiny additional secondary catchlight pixels around the main star give a "wonderstruck" galaxy-eye look. Black outer outline thick and confident. Palette: white star highlight, sapphire #4a88dd iris mid, deep navy #1a3068 pupil core. Thin black upper lash line accent. Pure wide-eyed wonder.
```

### 2.2 `sleepy` — Sleepy 😴  → `Sprites/character/eyes/sleepy.webp`

```
[SHARED STYLE HEADER]
Chibi tired "Sleepy Eyes" overlay: both eyes drawn as gentle downward-curving arcs with the upper lid covering nearly half the iris, giving a dreamy half-closed look. Subtle pink under-eye blush extending slightly out from the corners. A tiny single eyelash pixel on each outer corner suggests fatigue. Palette: soft brown #6a3a28 iris peeking through, pale pink #ffccdd under-eye blush. The mouth is intentionally NOT drawn (that's a separate layer) — pure eye sleepy droop.
```

### 2.3 `heart` — Heart 💖  → `Sprites/character/eyes/heart.webp`

```
[SHARED STYLE HEADER]
Chibi smitten "Heart Eyes" overlay: pupils replaced with two glowing pink heart shapes, slightly oversized so the heart silhouette fills most of the eye. Two small white catchlights inside each heart. Outer eye outlines arced upward slightly to give a "swooning" cheerful expression. Palette: hot pink #ff6699 heart fill, deeper magenta #cc3366 outline, white catchlight, tiny sparkle pixels #ffe0aa floating around the eye corners.
```

### 2.4 `wink` — Wink 😉  → `Sprites/character/eyes/wink.webp`

```
[SHARED STYLE HEADER]
Chibi confident "Wink" overlay: the LEFT eye (viewer's left) is open and friendly — round black dot pupil with single white catchlight. The RIGHT eye is closed, drawn as a single short upward-curving line (a "u" shape rotated 90°). A tiny tongue-out implication (small #ff8866 pixel between the eyes) reinforces the playful tone. The asymmetry is the whole personality — left open and bright, right squeezed tight.
```

### 2.5 `cat` — Cat Slit 🐱  → `Sprites/character/eyes/cat.webp`

```
[SHARED STYLE HEADER]
Chibi mischievous "Cat Slit Eyes" overlay: both eyes have vertical slit pupils inside narrow, slightly upturned almond shapes. Iris colour is bright amber-gold; pupil is a sharp vertical black line that thickens slightly in the middle. The shape of the eye itself slants up at the outer corners (cat-like). Palette: amber #ffaa44 iris, deep black slit, thin black outline. Reads as cunning, alert, slightly mischievous.
```

### 2.6 `closed` — Closed Zen 🧘  → `Sprites/character/eyes/closed.webp`

```
[SHARED STYLE HEADER]
Chibi serene "Closed Eyes" overlay: both eyes drawn as gentle U-curves (smile-shaped lines) suggesting a peaceful, content closed-eye state. Each U has a small lash pixel at the outer corner. A faint pink cheek blush extends slightly below each eye. Palette: dark brown #2a1a18 lid lines, soft #ffccdd blush. Reads as meditation / contentment / quiet joy — universally calm.
```

### 2.7 `glowing` — Glowing Energy ⚡  → `Sprites/character/eyes/glowing.webp`

```
[SHARED STYLE HEADER]
Chibi arcane "Glowing Eyes" overlay: both eyes filled with solid bright glowing energy, no pupils visible. A soft halo of the same color radiates outward beyond the eye outline (~3-4 pixels of glow). Palette: vibrant electric cyan #66ddff core fading to softer #aaffff halo, faint white center pinpoint. Slight purple #aa66ee scatter pixels around the glow. Reads as magic-saturated, mid-cast, or possessed-by-power.
```

### 2.8 `bigDots` — Big Dots 🫥  → `Sprites/character/eyes/big_dots.webp`

```
[SHARED STYLE HEADER]
Chibi minimalist "Big Dot Eyes" overlay: just two oversized solid black circular dots, no whites, no catchlights, no detail. The dots are larger than the default eye footprint — they fill nearly the entire eye region. A simple, geometric, almost emoticon style. Palette: pure black dots only. Reads as a stylized "blank slate" / "cute mascot" expression — works for both surprised and stoic moods.
```

---

# §3. MOUTH STYLES — 8 new prompts

Each renders at ~192 × 128 transparent webp, small mouth-region overlay.
Calibrate framing against `default.webp` (1.7 KB on disk). Mouth attaches
below the eye plane on the face — don't draw nose, chin, or eyes.

### 3.1 `grin` — Grin 😁  → `Sprites/character/mouth/grin.webp`

```
[SHARED STYLE HEADER]
Chibi joyful "Grin Mouth" overlay: a wide open-mouthed smile showing the upper row of small clean white teeth. Lower lip drawn as a soft inward curve. Slight upturned crease at each corner. Palette: dark outline #2a1a18, white teeth #ffffff with subtle #d8c8b8 shadow gap, pink inner-mouth glimpse #cc5566. Reads as full-hearted happiness, no restraint.
```

### 3.2 `frown` — Pout 😣  → `Sprites/character/mouth/frown.webp`

```
[SHARED STYLE HEADER]
Chibi disappointed "Pout Mouth" overlay: a small inverted-U curve (the mouth) drooping downward, slightly off-center. Lower lip pushed out subtly to suggest a real pout, not anger — sulky / sad / "I didn't get what I wanted" energy. Palette: dark outline only, no teeth, no inner mouth. Single soft pink pixel below the mouth as a quivering-lip suggestion (optional).
```

### 3.3 `surprise` — Surprise O 😲  → `Sprites/character/mouth/surprise.webp`

```
[SHARED STYLE HEADER]
Chibi shocked "Surprise Mouth" overlay: a small round "O" — a perfect black-outlined circle filled with dark pink inner-mouth, sized to fit naturally below the eye plane. The O is small and round, not wide — reads as a quiet "oh!" rather than a scream. Palette: dark outline #2a1a18, inner mouth #aa3366. The circular shape is the whole reading.
```

### 3.4 `tongue` — Tongue Out 😛  → `Sprites/character/mouth/tongue.webp`

```
[SHARED STYLE HEADER]
Chibi playful "Tongue Out Mouth" overlay: an upward-curved smile with a small pink tongue sticking out slightly off-center, just past the lower lip. Tongue rendered as a round-tipped pink shape with a small highlight pixel for sparkle. Palette: dark outline, #ff8a99 tongue, #ffccdd tongue highlight, faint #cc5577 tongue shadow. Reads as cheeky, teasing, "nyeh!"
```

### 3.5 `stoic` — Stoic Line 😐  → `Sprites/character/mouth/stoic.webp`

```
[SHARED STYLE HEADER]
Chibi neutral "Stoic Line Mouth" overlay: a single horizontal flat line, perfectly straight, no upturn or droop. Slightly off-center positioning gives it a tiny bit of personality. Palette: dark outline only, single line, no teeth, no fill. Reads as deadpan, focused, considering — works great paired with the "fierce" or "cat slit" eye styles.
```

### 3.6 `whistle` — Whistling 🎵  → `Sprites/character/mouth/whistle.webp`

```
[SHARED STYLE HEADER]
Chibi casual "Whistling Mouth" overlay: a small pursed circular shape (smaller and more tucked than the surprise-O), positioned slightly off-center to convey a sideways whistle. A single tiny music-note pixel floats up-and-right of the mouth (the note is the whole vibe). Palette: dark outline mouth, music note #66bbff with white inner pixel. Reads as nonchalant, "nothing to see here," innocent-mischief energy.
```

### 3.7 `fang` — Fangs 🧛  → `Sprites/character/mouth/fang.webp`

```
[SHARED STYLE HEADER]
Chibi vampiric "Fang Mouth" overlay: a small confident smile with two tiny pointed white fangs poking down past the upper lip line, one on each side. Mouth otherwise closed. Subtle dark crease for the lower lip line. Palette: dark outline, white fang tips #ffffff with #d8c8b8 shadow notch, faint pink lower lip suggestion. Reads as cute-monster, friendly-vampire, "I might bite but I haven't decided."
```

### 3.8 `smirk` — Smirk 😏  → `Sprites/character/mouth/smirk.webp`

```
[SHARED STYLE HEADER]
Chibi sly "Smirk Mouth" overlay: a one-sided lip curl — one corner of the mouth lifted clearly higher than the other, creating an asymmetric upward arc. No teeth shown. Slight crease beside the raised corner emphasizes the lift. Palette: dark outline only. Reads as sly, knowing, "I have a secret" — perfect for pairing with cat-slit or fierce eyes for a rogue archetype.
```

---

# §4. Submission order + credit budget

If submitting via Ludo.ai automation (the same flow as the v0.25.809 batch):

| Tier | Count | Credits |
|---|---|---|
| Hair (1.1 → 1.10) | 10 | ~10 |
| Eyes (2.1 → 2.8) | 8 | ~8 |
| Mouth (3.1 → 3.8) | 8 | ~8 |
| **Total** | **26** | **~26 credits** |

Budget **30–35 credits** if re-rolling the most ambitious ones (Glowing Eyes,
Crown Braid, Wizard Hat all benefit from a re-roll on a different seed).

# §5. After files land — wiring step

For each new style file dropped into `Sprites/character/<eyes|mouth|hair>/`,
add ONE line to the matching options array in `mojiworld_game.html`:

```js
// HERO_VEC_HAIR_OPTIONS at L45820 — append:
{ id:'bob',         name:'Bob 💇'        },
{ id:'mohawk',      name:'Mohawk ⚡'     },
{ id:'top_knot',    name:'Top Knot 🎎'   },
{ id:'long_braid',  name:'Long Braid 🪢' },
{ id:'curly_afro',  name:'Curly Afro ☁'  },
{ id:'sidecut',     name:'Sidecut ✂️'    },
{ id:'pigtails',    name:'Pigtails 🎀'   },
{ id:'bedhead',     name:'Bedhead 🛌'    },
{ id:'wizard_hat',  name:'Wizard Hat 🧙' },
{ id:'crown_braid', name:'Crown Braid 👑'},

// HERO_VEC_EYE_OPTIONS at L45882 — append:
{ id:'sparkle',  name:'Sparkle ✨'   },
{ id:'sleepy',   name:'Sleepy 😴'    },
{ id:'heart',    name:'Heart 💖'     },
{ id:'wink',     name:'Wink 😉'      },
{ id:'cat',      name:'Cat Slit 🐱'  },
{ id:'closed',   name:'Closed Zen 🧘'},
{ id:'glowing',  name:'Glowing ⚡'   },
{ id:'big_dots', name:'Big Dots 🫥'  },

// HERO_VEC_MOUTH_OPTIONS at L45886 — append:
{ id:'grin',     name:'Grin 😁'     },
{ id:'frown',    name:'Pout 😣'     },
{ id:'surprise', name:'Surprise 😲' },
{ id:'tongue',   name:'Tongue 😛'   },
{ id:'stoic',    name:'Stoic 😐'    },
{ id:'whistle',  name:'Whistle 🎵'  },
{ id:'fang',     name:'Fang 🧛'     },
{ id:'smirk',    name:'Smirk 😏'    },
```

The wardrobe picker auto-renders the new tiles on next page load. No
additional plumbing required. Ping me with "wardrobe styles landed" and I'll
run the same audit pattern as v0.25.811 — check every dropped file resolves
in the registry, verify nothing 404s in the console, and ship the option
arrays in a new version bump.
