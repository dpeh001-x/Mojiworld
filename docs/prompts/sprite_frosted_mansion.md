# Frosted Mansion — Sprite & Background Prompts

Asset generation for the **Frosted Mansion** (`glasswindHamlet`, Lv 61
safe-zone town renamed from "Glasswind Hamlet" in v0.25.803). The map
currently **reuses the Razor Plains background** — it has no dedicated
art of its own. Its two NPCs (Wynn the elder, Skirra the shard-collector)
also render procedurally with no sprite entries yet.

Map summary (from MAPS at L10817):

- World width 900 (compact), 5 platforms (3 cottage roofs, central
  shrine, high overlook ledge), 2 NPCs, no spawns.
- Sky palette: `#88a8c8` cool steel → `#5a7898` dusk blue → `#3a5870`
  deep navy.
- Mild wind gusts (every 8–14 s, 0.20 force) — softer than the steppe.
- World-map icon: 🏰 (castle, matching the "Mansion" rename).

Style baseline (same as v0.25.809 / v0.25.811 batches):

> **Illustration / illustrative style, 2 px outline, transparent (for
> NPCs) or parallax-ready full-bleed (for backgrounds), side-scroller
> view.**

---

## 1. Frosted Mansion background — `backgrounds/bg_v3_glasswindHamlet.png`

```
Side-scrolling 2D game level background, no characters, no UI, no text. A single tall frosted mansion silhouette sheltered in a small frost-glass clearing at the edge of an open windswept steppe. Sky: cool steel-blue at the top fading downward to dusk-blue and deep-navy horizon, a thin pale-violet aurora ribbon drifting through the upper third, a few faint pinprick stars just visible against the dusk. The mansion dominates the central two-thirds of the canvas: a tall narrow three-storey ivory-stone manor with steep ice-blue slate-shingle roofs, frost-trimmed gables, glowing pale-amber lanterns in two of the upper windows, a wrought-iron weathervane on the very top, snow piled on the rooflines, and thin trailing icicles under every eave. Flanking the mansion: two smaller stone cottages with matching ice-blue roofs, one to the west and one to the east, partially buried in low drifts. Midground: a low frost-glass shrine and stone well at the centre of a small courtyard, glass-shards catching the dusk light like scattered prisms. Foreground: a wide pale-snow walkway running across the bottom of the canvas, with a few frost-glass shards embedded in the snow as accent detail. Mood: quiet, cold, sheltered — the steppe blows past but the mansion holds the calm. Wide horizontal landscape composition for a side-scroller, parallax-ready depth with sky, midground mansion + cottages, and foreground snow walkway as separate visual layers. Illustration / illustrative style, vibrant painterly palette, 2 px dark outlines, no anti-aliasing.
```

---

## 2. Wynn (elder NPC) — `Sprites/npc/wynn.webp`

The hamlet elder. Stands atop the **west cottage roof** in the map.
Color anchor: `#cce4ee` (pale steel-blue robes). Lore: she keeps the
well + shrine, knows the wind's voice, three generations on this site.

```
Chibi NPC sprite of "Wynn", an old hamlet elder, idle pose facing camera-left for side-scroller view. Huge round head, deeply lined kind face, half-lidded knowing eyes, faint serene smile, long white hair pulled back into a low bun with two silver hairpins. Wearing pale steel-blue heavy winter robes with cream fur trim along the collar and sleeves, layered over a high-necked cream tunic, a thick woven shawl draped across the shoulders. She leans gently on a tall gnarled wooden walking-staff topped with a small pale-violet frost-glass shard that catches the light. Tiny silver shrine-key on a leather thong around her neck. A faint breath-mist drifts from her mouth. Calm, patient, stubborn — the kind of elder who has out-survived three winters that should have killed her. Illustration / illustrative style, vibrant painterly palette, 2 px dark outlines, transparent background, no anti-aliasing, no text.
```

---

## 3. Skirra (shard-collector NPC) — `Sprites/npc/skirra.webp`

The hamlet's shard-collector. Stands atop the **east cottage roof**.
Color anchor: `#88aacc` (frost-blue work apron). Lore: sorts the glass
shards the wind blows in, sells the cleanest cuts to the Academia.

```
Chibi NPC sprite of "Skirra", a young hamlet shard-collector, idle pose facing camera-left for side-scroller view. Huge round head, focused practical expression, narrow alert eyes, a small confident half-smile, faintly wind-chapped cheeks. Short messy ash-blonde hair tucked under a knitted frost-blue beanie with a small pale shard pinned to the side as a token. Wearing a frost-blue heavy work apron over a cream wool sweater and dark wool trousers tucked into thick fur-lined boots. Leather gauntlets gripping a pair of long leather sorting-tongs in one hand and a small open wooden tray in the other, the tray holding three sorted piles of pale-violet glass shards. A small leather collecting pouch hangs at her belt with one extra shard poking out the top. Practical, sharp, weather-cured — the kind of worker who'd notice if the wind changed its song mid-day. Illustration / illustrative style, vibrant painterly palette, 2 px dark outlines, transparent background, no anti-aliasing, no text.
```

---

## Registry wiring (after sprites land)

When the files drop into the right folders, two small registry edits
land the art in-game (analogous to the v0.25.811 wiring pattern):

```js
// NPC_SPRITE_FILES (~L51425):
'Wynn':   'wynn.webp',
'Skirra': 'skirra.webp',
```

Backgrounds don't need a registry entry — the loader at L39209-ish
auto-resolves `backgrounds/bg_v3_<mapId>.png` from the map's `bg:` field.
For the BG to actually apply, also change the map's `bg:` field from
`'glasswindSteppe2'` (legacy reuse) to `'glasswindHamlet'` (dedicated).

---

## Submission order

1. **Frosted Mansion BG** — biggest visual win, fixes the identity
   bug of the map looking identical to its parent steppe
2. **Wynn** — face of the lore + Hourglass Chapter III quest hand
3. **Skirra** — paired flavour NPC, mentioned in `q_visit_glasswind`

**Credit cost:** ~3 credits at one render each. Budget 4-5 if re-rolling
the BG (the mansion silhouette is the highest-risk render).
