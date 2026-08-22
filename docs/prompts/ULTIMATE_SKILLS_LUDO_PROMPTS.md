# Ultimate (Lv-50 B-slot) VFX — ludo.ai prompt library

Epic, drop-in prompts for the **17 final-class ultimate** FX sprites. Companion to
`ultimate_ultimate_spec.md` (design) and `scripts/generate_ult_skill_sprites.mjs` (automation).

Two ways to make the art:
- **Automated (recommended):** `node scripts/generate_ult_skill_sprites.mjs --generate`
  (needs `LUDO_API_KEY`). The same prompts below are embedded in that script; it does the base
  text→sprite **and** the 9-frame animation in one pass.
- **Manual / web UI:** paste the **locked prefix** + a **per-skill block** into ludo.ai.

> **Ludo.ai settings** — `image_type: sprite` · `art_style: Anime/Manga` · `aspect_ratio: ar_1_1`
> · `n: 1` → 768×768 transparent PNG. Save base art as `Sprites/fx/<key>.png`, then animate to
> `Sprites/fx/anim/<key>_0..8.webp` (9-frame loop). `<key>` = the SKILLS id (`<master>_ult`).

---

## [A] LOCKED PREFIX — paste verbatim every time

> Chibi anime spell-effect VFX sprite for a 2D platformer in the Mojiworld aesthetic. Pure
> transparent background, alpha only — no scene, no character, no ground, no text. 768×768 square
> canvas. Soft painterly cel-shaded anime style, bold black outlines, vibrant saturated colors,
> additive glow. Render ONLY the effect, strong centered composition occupying ~70% of the canvas
> with breathing room at the edges, **epic legendary ultimate-tier intensity**. Must read clearly
> when scaled to 1/4 size.

## [B] PER-SKILL BLOCKS

Format: **master** · *Ultimate* · `key`. Append the block to the locked prefix. The shorter
*motion* line is the animation prompt (motion-only, hold-in-place) used by the animate pass.

---

### 🟥 WARRIOR

**warlord** · *War of Banners* · `warlord_ult`
> A colossal golden war-banner planted in the earth, the standard unfurling in a heroic gale;
> spectral vanguard soldiers rising from radiant gold-and-crimson rally-light around the pole;
> sparks and motes of light streaming upward; a commanding aura ring at the base.
> *motion:* the standard ripples in the wind, rally-light pulses and radiates, spectral motes rising.

**doombringer** · *Calamity Incarnate* · `doombringer_ult`
> A titanic black-iron greatsword wreathed in crimson-and-violet ruin energy, the blade cracked
> with molten apocalyptic fissures, dark shockwave rings churning off the edge, embers and ash
> shedding, an aura of catastrophe.
> *motion:* crimson-violet energy churns along the blade, shockwave cracks pulse, embers shedding.

**crusader** · *Bastion of Dawn* · `crusader_ult`
> A radiant domed holy bastion of golden dawn-light, concentric blessed runic rings glowing, the
> absorbed light coiling inward into a brilliant core about to burst, warm halo and divine
> sparkles orbiting.
> *motion:* divine light pulses across the barrier, the core glows brighter, blessed sparkles orbit.

**dragoon** · *Skyfall Dominion* · `dragoon_ult`
> A storm of descending azure dragon-lances raining from a thundercloud, each spear crackling with
> blue draconic lightning, a great winged dragon-silhouette of energy behind them, motion streaks
> and impact sparks.
> *motion:* blue draconic lightning crackles along the spears, motion streaks pulse, sparks flicker.

---

### 🟪 ROGUE

**shadowlord** · *Shadow Sovereign* · `shadowlord_ult`
> A regal shadow-avatar wreathed in a swarm of violet phantom after-images and clone silhouettes
> fanning outward, a dark crown of umbral energy, swirling shadow wisps and echo-trails, an
> ominous sovereign aura.
> *motion:* violet phantom after-images flicker and shimmer, umbral wisps coil in place.

**shinobi** · *Hundred-Hand Shadow Dance* · `shinobi_ult`  ⟲ *reworked v0.30.43*
> A radial mandala of MANY overlapping ghostly arms fanning outward from a dark hooded silhouette
> at the centre, like a thousand-armed asura of shadow — each hand gripping a short moonlit kunai
> or tanto blade, the arms layered in receding indigo and black after-image echoes so the ring
> reads as one figure moving everywhere at once. Cold steel-white edge-light traces every blade,
> thin crimson talisman ribbons trail between the arms, and a dark violet shadow-vortex churns at
> the core. PALETTE IS STRICTLY DEEP INDIGO, BLACK AND COLD STEEL-WHITE with ONE restrained
> crimson accent — absolutely NO gold, NO warm orange, NO festive red-and-cyan fireworks look.
> SHAPE BANS: no banners, no pennants, no flags, no ribbands, no arrow or chevron or dart shapes,
> no scrolls, no placards — nothing that could carry a marking. Wordless imagery only.
> *motion:* the ONE and ONLY motion is the after-image arms flickering softly in place, every arm
> at the same steady rate, each frame differing from the one before by the SAME small amount. Core
> brightness stays CONSTANT — no flare, no strobe, no bloom, no rotation, no zoom, no travel.
>
> *Why it was redone:* the original read as a red-and-gold firework of pennant shapes — no hands,
> no shadow, and garbled glyph marks on the pennants that the locked prefix forbids. The banner
> silhouette is what invited the marks, so the shapes are banned outright rather than the letters
> re-forbidden. The single-motion, constant-brightness rewrite fixes a loop that strobed on frames
> 6–7 (same failure the v0.29.402/403 notes describe for skyhunter and archbishop).

**nightreaper** · *Bloodmoon Domain* · `nightreaper_ult`
> A blood-red eclipse domain — a black sun corona ringed with crimson light, spectral soul-scythes
> orbiting, dripping blood-energy and violet death motes gathering, an eerie reaper-moon glow.
> *motion:* the crimson corona flickers, soul-scythes drift, violet death motes pulse inward.

**phantom** · *Voidwalk* · `phantom_ult`
> A swirling violet void-singularity tearing reality with crossed spectral daggers, warping purple
> event-horizon rings pulling inward, ghostly phantom hands reaching from the rift, crackling void
> energy.
> *motion:* the rift swirls and warps, spectral hands flicker, void energy crackles around the rim.

---

### 🟦 MAGE

**sage** · *Meteor Sigil* · `sage_ult`
> A colossal blazing comet plunging with a fiery tail, a glowing arcane targeting sigil scorched
> beneath it linking radiant impact-runes with fire-web threads, molten embers and a hot shockwave
> glow.
> *motion:* the comet glow flickers, the sigil runes pulse, embers shed and a hot glow breathes.

**elementalist** · *Elemental Apotheosis* · `elementalist_ult`  ⟲ *reworked v0.30.52*
> THREE colossal elemental orbs — a blazing orange fire orb, a glacial blue-white ice orb and a
> crackling yellow-white lightning orb — orbiting a violet-black void singularity at the centre,
> linked to it by arcs of prismatic energy, all enclosed in a ring of radiant white ascension
> light. PALETTE: orange, ice-blue, electric yellow, violet and white. No runes, no glyphs, no
> symbols, no writing of any kind.
> *motion:* the prismatic arcs linking the orbs shimmer softly in place at one steady rate; no
> rotation, no flare, core brightness constant.
>
> *Why it was redone:* Apotheosis v3 is three random catastrophe strikes per cast, so the burst
> shows the three charges being gathered rather than one convergence beam. The four catastrophe
> PROJECTILES (`p_apo_fire` / `_ice` / `_lightning` / `_void`) live in
> `scripts/generate_elementalist_proj.mjs` alongside the Cascade phase bursts.

**necromancer** · *Necrotic Ascendance* · `necromancer_ult`
> A necromantic surge of ghostly green souls spiraling upward into a risen necromancer-crown, skeletal
> thralls forming from emerald soul-fire, a swirling necrotic vortex core, eerie phosphor glow and
> drifting wisps.
> *motion:* the soul-wisps drift and flicker, the necrotic vortex churns, phosphor glow pulses.

**hexmaster** · *Pandemic Hex* · `hexmaster_ult`
> A spreading plague of purple hex-runes and cursed evil-eye sigils branching like contagion
> tendrils, dark-frost and sickly violet miasma creeping outward, a throbbing cursed glow,
> malignant runic circles.
> *motion:* cursed sigils orbit and flicker, sickly miasma creeps, a cursed glow throbs.

**archbishop** · *Apotheosis* · `archbishop_ult`
> A towering radiant column of golden divine light descending from heaven, an ascended angelic halo
> and fleur-de-lis grail crest within, choral sparkles and feathers drifting, a sweeping beam of
> judgment.
> *motion:* divine light pours and pulses, choral sparkles rise, a warm halo breathes.

---

### 🟩 ARCHER

**marksman** · *Deadeye Protocol* · `marksman_ult`
> A precision focus-reticle of glowing crosshairs locking onto multiple target-marks, a charged
> piercing energy-round glinting at center, a sharp lens-flare glint, taut aiming-light threads,
> cold blue precision glow.
> *motion:* the crosshairs tighten and pulse, the charged round glints, aiming-threads flicker.

**ballista** · *War Machine* · `ballista_ult`
> A massive mounted siege-ballista war engine drawn taut, a heavy explosive bolt charged with fiery
> energy on the rail, gears and bracing, impact sparks and a charging anchor-shot glow, imposing
> fortress-weapon presence.
> *motion:* the bolt vibrates with energy, motion streaks pulse, impact sparks flicker.

**beastmaster** · *Apex Bond* · `beastmaster_ult`
> A colossal spirit apex dire-wolf of amber spirit-energy rearing with bared fangs, a feral
> rally-roar shockwave and claw-mark energy, wild amber sparks and primal runes, a bonded-rider aura.
> *motion:* the amber spirit-energy flickers and pulses, claw-mark energy crackles in place.

**skyhunter** · *Eye of the Tempest* · `skyhunter_ult`
> A swirling cyan wind-tempest cyclone with a calm glowing eye, a storm of wind-charged arrows
> orbiting and streaking outward, gusty spiral streaks, feathers and motes caught in the vortex,
> gale energy.
> *motion:* the storm swirls, wind-charged arrows glint and streak, gusty energy crackles.

---

## [C] After generation — wiring (next code step)

Once `Sprites/fx/<key>.png` + `Sprites/fx/anim/<key>_0..8.webp` exist for all 17, the game code
needs (tracked in `ultimate_ultimate_spec.md` §5):
1. Register each `<key>` in the `LX_FX` sprite map + the FX preload list.
2. Confirm `_fxAnimFrames('<key>')` resolves the 9-frame loop (same path as the G-skill FX).
3. Each ultimate's `SKILL_FNS` impl calls `spawnSpriteBurst(x, y, '<key>', { size, life })`.

Until the art lands, the skills still run — `spawnSpriteBurst` no-ops on a missing sprite and the
procedural fallbacks fire, so code and art can be built in parallel.

