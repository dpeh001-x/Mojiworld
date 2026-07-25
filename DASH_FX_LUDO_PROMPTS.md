# Class quick-dash VFX — ludo.ai prompt library

One dedicated sprite per class for the double-tap quick dash (wired v0.29.240,
art generated + shipped v0.29.246). `quickDash()` spawns these via
`spawnSpriteBurst` the moment the image has decoded; the procedural particle
FX is the fallback, so files can be replaced one at a time in any order.
**Static** images — the in-game render scales / fades / mirrors them for
motion. Base art reads **LEFT-TO-RIGHT**; the game mirrors with `flipX`.

Run: `node scripts/generate_dash_fx.mjs --generate` (needs `LUDO_API_KEY`;
flags `--force`, `--only a,b`), or paste a block below into the ludo.ai web
UI. Output → `Sprites/fx/<key>.png` (LX_FX registry; `.webp` also accepted —
the loader retries the other extension).

> **Ludo.ai settings** — `image_type: sprite` · `art_style: Anime/Manga` ·
> `aspect_ratio: ar_1_1` · `n: 1` · `augment_prompt: false` → 768×768
> transparent PNG/WEBP. The script post-processes: trim → contain at ~82% on
> a transparent 768² canvas so nothing is edge-clipped.

## ⚠ Prompt shape (v2 — hard-learned 2026-07-25)

Long "cute 2D RPG …Mojiworld aesthetic" style prefixes make ludo's sprite
model return **chibi characters** regardless of what follows (4/4 attempts).
And naming an agent ("ninja smoke") draws that agent's face in the effect.
What works: **short, effect-first prompts** — lead with "A single <effect>",
end with the compact style/negation suffix below. Nothing else.

**Shared suffix — append verbatim to every block:**

> special-effect for a 2D side-scroller game, cel-shaded anime style with
> bold dark outlines, glossy highlights, vibrant saturated colors, game VFX
> element only, no character, no person, no creature, no text, fully inside
> the frame with empty margin on all sides, transparent background

## Per-class blocks

Format: **class** · dash fantasy · `file` (LX_FX key).

**Warrior** · Body Charge · `dash_warrior.png` (`dash_warrior`)
> A single amber-orange charging shockwave swoosh with a crescent leading
> edge on the right and small ember flecks, horizontal motion streak firing
> left-to-right,

**Mage** · Arcane Blink · `dash_mage.png` (`dash_mage`)
> A single violet-and-blue arcane teleport flash burst with radiating cyan
> sparkles, wispy lavender energy trails streaming left-to-right and a
> bright white-violet core,

**Archer** · Forward Roll · `dash_archer.png` (`dash_archer`)
> A single emerald-green horizontal wind gust streak sweeping left-to-right,
> long curved wind arcs and swirl ribbons stretched horizontally, dense at
> the right and tapering off to the left, a few small leaf flecks trailing
> behind, strong sense of fast sideways motion,

**Rogue** · Shadow Dash · `dash_rogue.png` (`dash_rogue`)
> A single very long thin horizontal violet-grey shadow-smoke dash streak
> firing left-to-right, stretched trailing smoke wisps and dark purple speed
> lines tapering to a sharp point on the left, dense compact smoke at the
> right edge, strong sense of extremely fast sideways motion, abstract smoke
> only, no face, no eyes,

## Drop-in / redo checklist

1. Delete the `Sprites/fx/dash_<cls>.png` you want to redo.
2. `node scripts/generate_dash_fx.mjs --only dash_<cls> --generate`.
3. Reload the game — no code change needed; the sprite takes over that
   class's dash FX automatically (mage at both blink endpoints, rogue also
   at the brake-dust moment).
