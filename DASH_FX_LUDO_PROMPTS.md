# Class quick-dash VFX — ludo.ai prompt library

One dedicated sprite per class for the double-tap quick dash (v0.29.240).
`quickDash()` spawns these via `spawnSpriteBurst` the moment the image has
decoded; until then the old procedural particle FX renders as fallback, so
files can be dropped in one at a time in any order. **Static** images — the
in-game render scales / fades / mirrors them for motion.

Output → `Sprites/fx/<file>` (LX_FX registry). `.png` or `.webp` both work —
the loader silently retries the other extension.

> **Ludo.ai settings** — `image_type: sprite` · `art_style: Anime/Manga` ·
> `aspect_ratio: ar_1_1` · `n: 1` → 768×768 transparent PNG/WEBP.

> **Orientation rule** — all motion reads **LEFT-TO-RIGHT**. The game
> mirrors with `flipX` when dashing left; never bake a direction ambiguity.

## [A] LOCKED PREFIX — paste verbatim every time

> Chibi anime game VFX sprite for a 2D platformer in the Mojiworld aesthetic.
> Pure transparent background, alpha only — no scene, no character, no ground
> tile. 768×768 square canvas. ABSOLUTELY NO TEXT of any kind (no letters,
> words, numbers, runes, watermark) — wordless imagery only. Soft painterly
> cel-shaded anime style, bold clean edges, vibrant saturated colors, additive
> glow. Centered, effect occupies ~80% of the canvas. Must read clearly small.

## [B] PER-CLASS BLOCKS

Format: **class** · dash fantasy · `file` (LX_FX key).

**Warrior** · Body Charge · `dash_warrior.png` (`dash_warrior`)
> A horizontal AMBER-ORANGE charge shockwave firing LEFT-TO-RIGHT: bold warm
> speed streaks with a crescent shockwave leading edge on the right, ember
> flecks and a faint golden dust kick trailing off the left, aggressive
> forward momentum.

**Mage** · Arcane Blink · `dash_mage.png` (`dash_mage`)
> A VIOLET-AND-BLUE arcane blink burst: a shattering teleport flash with
> radiating cyan sparkles, wispy lavender energy trails streaming
> LEFT-TO-RIGHT, and a bright white-violet core, mystical and instantaneous.

**Archer** · Forward Roll · `dash_archer.png` (`dash_archer`)
> An EMERALD-GREEN wind roll gust: a curling spiral of green wind arcs
> sweeping LEFT-TO-RIGHT with small leaf flecks and pale mint motion ribbons,
> light and acrobatic, a tumbling breeze.

**Rogue** · Shadow Dash · `dash_rogue.png` (`dash_rogue`)
> A VIOLET-GREY shadow-smoke dash streak firing LEFT-TO-RIGHT: dissipating
> ninja smoke wisps stretched horizontally with dark purple speed lines and
> a few fading shadow flecks, stealthy and fast.

## [C] Drop-in checklist

1. Generate with prefix [A] + one block from [B].
2. Save to `Sprites/fx/` under the exact filename (or `.webp`).
3. Reload the game — no code change needed; the sprite takes over the dash
   FX for that class automatically (mage gets it at both blink endpoints,
   rogue also at the brake-dust moment).
