# Monster special-skill VFX — ludo.ai prompt library

Dedicated sprites to beautify the procedural hazard effects cast by ordinary
monsters (the gravity well & friends). Companion to
`scripts/generate_mob_vfx.mjs` (which embeds these same prompts and runs the
generation). Output → `Sprites/vfx/<file>.webp`, loaded by `LX_VFX`; each
renderer blits the sprite when ready and falls back to its procedural drawing
otherwise. **Static** images — the in-game render rotates / expands / squashes
them for motion.

Run: `node scripts/generate_mob_vfx.mjs --generate` (needs `LUDO_API_KEY`), or
paste a block below into the ludo.ai web UI.

> **Ludo.ai settings** — `image_type: sprite` · `art_style: Anime/Manga` ·
> `aspect_ratio: ar_1_1` · `n: 1` → 768×768 transparent PNG/WEBP.

## [A] LOCKED PREFIX — paste verbatim every time

> Chibi anime game VFX sprite for a 2D platformer in the Mojiworld aesthetic.
> Pure transparent background, alpha only — no scene, no character, no ground
> tile. 768×768 square canvas. ABSOLUTELY NO TEXT of any kind (no letters,
> words, numbers, runes, watermark) — wordless imagery only. Soft painterly
> cel-shaded anime style, bold clean edges, vibrant saturated colors, additive
> glow. Centered, effect occupies ~80% of the canvas. Must read clearly small.

## [B] PER-EFFECT BLOCKS

Format: **caster** · skill · `file` (LX_VFX key).

**Skywisp** · Gravity Well · `gravity_well.webp` (`gravityWell`)
> A swirling PURPLE gravity-well vortex seen TOP-DOWN (looking straight down at
> the ground): concentric violet energy rings spiralling inward to a bright
> glowing core, wispy lavender streaks dragged toward the centre, a circular
> flat disc shape.

**Frostkin** · Freeze Beam · `frost_beam.webp` (`frostBeam`)
> A horizontal pale-blue FROST BEAM / ice cone firing LEFT-TO-RIGHT: a tapering
> jet of icy energy with jagged frost shards, crystalline glints and drifting
> cold mist, sharp leading edge on the right.

**Zombie** · Poison Cloud · `poison_cloud.webp` (`poisonCloud`)
> A bubbling TOXIC POISON puddle seen TOP-DOWN: a sickly green-and-lime gradient
> pool with rising round bubbles and a faint noxious haze above it, a circular
> flat disc shape.

**Sandhusk** · Shockwave · `shock_ring.webp` (`shockRing`)
> An expanding GROUND SHOCKWAVE RING seen TOP-DOWN: a bold tan-and-gold leading
> ring of kicked-up dust and rock with a fainter outer halo and cracked-earth
> glow, mostly EMPTY in the centre (a ring, not a disc).

**Voltipup** · Lightning Strike · `lightning_pillar.webp` (`lightningPillar`)
> A vertical ELECTRIC LIGHTNING PILLAR striking downward: a jagged white-blue
> bolt inside a glowing yellow energy column with crackling forked arcs and
> bright sparks, tall and narrow.

**Rexy / quake casters** · Quake · `quake_ring.webp` (`quakeRing`)
> An expanding GROUND-QUAKE shockwave seen TOP-DOWN: concentric cracked-earth
> rings with rising dust and tumbling rubble, a warm orange-tan seismic glow,
> mostly EMPTY in the centre (a ring, not a disc).

**Skeleton / Nimbus Fox** · Dash Charge · `dash_streak.webp` (`dashStreak`)
> A horizontal SPEED-DASH motion streak firing LEFT-TO-RIGHT: sharp
> white-to-violet motion-blur lines and a sweeping afterimage swoosh that tapers
> to a point on the right, strong sense of fast lunging movement.

> **AOE marker** — already authored as `Sprites/fx/meteor_marker.webp` (the
> generic `meteor_warn` telegraph). v0.26.x just wires `mortarLob` (Stumpy) to
> spawn that marker at its landing spot, so no new sprite is needed there.

## [C] Wiring (already done in-game)

`LX_VFX` loads these five from `Sprites/vfx/`, and the hazard renderers
(`mob_gravity`, `mob_frostbeam`, `mob_poisoncloud`, `mob_shockwave`,
`mob_lightning`) blit the matching sprite when `_lxVfxReady()` is true — else
the original procedural drawing. So dropping the generated files in is the only
step; no further code change. Each renders ground-projected (squashed to an
ellipse) or directional (beam/pillar) to match the existing geometry.
