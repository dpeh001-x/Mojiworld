# Mojiworld — Aesthetic Recommendations (v0.25.954)

A focused review of UI surfaces + in-game presentation, with prioritised
suggestions. Grouped by domain, scored by impact ↑ / effort ↓ tradeoff.

> **Reading order:** P1 items have the biggest visual return for the
> least implementation cost — start there. P3 items are polish to
> consider after the bigger swings land.

---

## A. UI surface cohesion (already strong, finish the journey)

The recent passes (v0.25.928 → v0.25.943) brought the lux family — class-
select / wardrobe / tutorial / AI dock / Guguma chips — into one coherent
brushed-steel + gold language. The **next batch of modals still uses the
old dark-purple palette** and breaks the spell when the player opens them.

### A.1 — Lift the remaining 10 utility modals into the lux family · P1

| Modal | Current state | Recommended action |
| --- | --- | --- |
| `inventory-modal` (B-key bag) | Old `.modal` dark purple | Apply v0.25.943 brushed-steel + gold rim treatment |
| `shop-modal` | Old `.modal` | Same lux pass |
| `enhance-modal` (Brok's anvil) | Old `.modal` | Same + add subtle forge-spark accent particles |
| `craft-modal` (Brok's set-craft) | Old `.modal` | Same |
| `skilltree-modal` (K-key) | Old `.modal` | Same + node-glow refinement (see B.3) |
| `attributes-modal` (U-key) | Mostly lux v0.25.927 but stat radar still on dark bg | Match radar canvas BG to graphite |
| `quest-modal` (J-key journal) | Old `.modal` | Same + add scroll-paper texture overlay |
| `worldmap-modal` (W-key) | Old `.modal` | Same + atmospheric map glow |
| `taxi-modal` | Old `.modal` | Same |
| `codex-modal` (Y-key) | Old `.modal` | Same |

**Implementation pattern** — for each modal, append a v0.25.x CSS block
that:
1. Overrides `.modal` background to the brushed-steel gradient
2. Adds 0.5 px gold rim border + 100 px violet inner-glow
3. Adds the four `::before` / `::after` corner brackets
4. Bumps title typography to the polished-brass shimmer

This is repetitive but mechanical — ~30 LOC per modal × 10 modals =
~300 LOC of CSS for a major visual cohesion win. Could ship in
batches of 3 modals per version.

### A.2 — Universal modal close animation · P2

Current close is instant. Add a 180 ms fade-out + 4 px slide-down so
modals dismiss with weight. Pure CSS via `transition` on `opacity` +
`transform`. ~10 LOC, applied via a shared `.modal-closing` class.

### A.3 — Modal-stack z-index audit · P3

Multiple modals can layer (NPC dialog over advancement over story-beat).
Audit + document the canonical z-stack so future modals don't fight.
Suggested order: tutorial (200) → class-select (180) → advancement (170)
→ NPC dialog (160) → utility modals (140) → toast (120) → world (10).

---

## B. Iconography & visual hierarchy

### B.1 — Convert emoji-as-icon to authored SVG glyphs · P1

The game leans heavily on emoji (⚔️ 🛡️ 🔮 🏹 etc.) for class icons,
skill icons, quest icons. Emoji rendering varies wildly across OS /
browser (Apple Color Emoji vs Segoe vs Noto vs Twemoji), so the same
icon looks different on every device. The "WARRIOR" card on a Mac shows
crossed silver swords; on Windows it's a flat 8-bit-ish glyph; on Android
it's something else again.

**Action:** Author a 32-icon SVG set (one per class + one per common skill
slot) using the existing palette. Drop into `Sprites/ui/icons/` and reference
via `<svg>` includes or background-image. Costs ~2-3 hours of design work
but yields **consistent reads across every device**.

### B.2 — Rarity glow strength refinement · P2

The current rarity-tinted item slots (common → legendary) use the same
border colour with a fixed 6 px shadow. Push the legendary tier further:
- Common: thin grey border, no shadow
- Rare: thin blue border, soft blue 4 px glow
- Epic: bold purple border, **animated** breathing 8-12 px glow
- Legendary: bold orange border, **animated** rotating-conic-gradient ring
  (1 rotation per 6 s) — premium-loot feel

Per-card cost: ~15 LOC CSS. Already partially implemented for the apply
button (v0.25.867 breathing pulse) — extend the pattern to legendary
loot.

### B.3 — Skill tree node visual upgrade · P2

The current skill tree nodes are flat coloured rectangles. Upgrade them to
glass pebbles with:
- Inner glow per unlock state (locked: grey; available: faint blue;
  unlocked: bright gold)
- Connection lines between nodes drawn as gold metallic gradient with
  a flowing animated highlight
- Hover state: scale 1.08 + soft glow pulse

The tree is one of the most-revisited UI surfaces (every level-up sends
the player here). Investment here compounds across many sessions.

---

## C. Typography hierarchy

### C.1 — Lock the lux font stack across all UI · P1

Current state: most surfaces use system sans (Inter / Segoe UI), but
the class-select uses Cormorant Garamond + Consolas for the lux feel.
Inventory tooltips use a different font, the boss-defeat toast uses
another. The mix reads as inconsistent.

**Recommended stack (paste into `:root` as CSS custom properties):**

```css
:root {
  --font-display: 'Cinzel', 'Cormorant Garamond', 'Trajan Pro', serif;
  --font-italic:  'Cormorant Garamond', 'Times New Roman', serif;
  --font-body:    'Inter', 'Segoe UI', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', 'Consolas', monospace;
}
```

Then apply consistently:
- Modal titles (WARDROBE / SHOP / etc.) → `--font-display`
- Subtitles + lore prose → `--font-italic`
- Body / buttons / stats → `--font-body`
- Code-like labels (stat tags, timer values, status pills) → `--font-mono`

### C.2 — Letter-spacing hierarchy · P2

Headlines get wide spacing (3-4 px) for grandeur; body stays at default;
small mono labels get tight spacing (-0.5 to 1.5 px). Already done for
the wardrobe title — extend to all modals.

### C.3 — Numeric-style for stat numbers · P2

CSS `font-variant-numeric: tabular-nums` on all stat displays prevents
the wobble when HP / MP / damage numbers change. Critical for damage
numbers floating off mobs — currently they shift width per-tick. One CSS
property per surface = clean fix.

---

## D. Game-feel / juice

### D.1 — Hit-stop curve refinement · P1

The current hit-stop on player crits (60-120 ms) is good but flat. Add a
two-stage curve:
- 60 ms hard freeze (everything stops)
- 80 ms gentle slow-mo (entities at 30 % speed)

This gives the "weighty impact" feel of Hades / Hollow Knight without
fully halting the player's input perception. Apply to:
- Player crit on boss
- Player skill-hit (G-skill especially with the new 2× damage)
- Boss heavy-hit on player

### D.2 — Screen flash colour-coding · P2

Currently `flash(amount)` is generic white. Colour-code by event:
- White: standard crit / hit
- Gold: legendary loot / boss kill / level up
- Red: player took damage (already partial — extend)
- Cyan: parry success / dodge
- Purple: void / dark-magic skill cast

5-line change to `flash()` to accept optional colour arg + 5-line update
to per-event call sites.

### D.3 — Camera shake easing curve · P2

Replace the current linear `addShake(amount)` with a critically-damped
spring. Same input shake value but the visual feel is far smoother +
returns to centre cleanly rather than hard-stopping. ~20 LOC change.

### D.4 — Skill-cast trail particles · P3

Each G-skill could leave a class-coloured trail when the cast animation
plays (gold for paladin, violet for shadow, etc.). Particle budget
already supports it; just need per-skill trail-colour map.

---

## E. World atmosphere

### E.1 — Per-map ambient particle layer · P1

Each map could have a signature ambient particle effect that the player
SEES the moment they enter:

| Map | Ambient |
| --- | --- |
| Town (Everdawn Central) | Slow gold dust motes drifting upward |
| Frozen Peak | Snowflakes drifting down + occasional gust burst |
| Magma Foundry | Ember sparks rising + heat shimmer overlay |
| Wayfarer's Lantern | Soft warm orange lantern-light pulses |
| Octopus Grotto | Bubble streams + drifting plankton particles |
| Zodiac arenas | Slow rotating star-field at z:-1 |
| Singularity | Inward-falling cosmic dust toward map centre |

Most of these are 10-20 lines of code per map. They add atmosphere
disproportionate to their cost.

### E.2 — Background parallax depth · P2

Many backgrounds are single static images. Adding 2-3 parallax layers
(far/mid/near) at different scroll speeds creates depth. Particularly
impactful for the Singularity, Zodiac Sanctum, and Tower.

### E.3 — Dynamic time-of-day tint · P3

A subtle overlay tint per map that suggests time of day:
- Town: warm afternoon
- Frozen Peak: cold blue midday
- Sunset Coast: golden hour (already in name!)
- Hollow Sepulchre: cold grey overcast
- Singularity: pure starlight

Single full-screen overlay with `mix-blend-mode: soft-light` at ~10 %
opacity, per-map colour. ~30 LOC total.

---

## F. Audio polish

### F.1 — Per-class skill SFX layer · P1

You already have voice grunts per class × gender (30 files). The next
layer is **per-class skill cast SFX** — a brief signature audio for each
class's skill cast:
- Warrior: heavy steel ring
- Rogue: silken whisper
- Mage: soft chime
- Archer: drawstring tension

Currently most skills use generic burst/strike SFX. Per-class signatures
make the same skill feel different across classes. ~12 audio files
needed (3-4 per class) + ~15 LOC routing in `castSkill`.

### F.2 — Ambient map BGM transitions · P2

When transitioning between maps, crossfade the BGM over 600 ms instead
of cut. Already partially done — extend to all map-loads.

### F.3 — UI click SFX library · P3

Differentiate by control type:
- Button tap: soft mallet
- Modal open: deeper resonance
- Modal close: brief whoosh
- Hover (desktop): subtle tick
- Error: muted thud
- Success: bright chime

10 small WAV files + ~20 LOC routing. Punches up the "premium feel".

---

## G. Character & NPC art

### G.1 — Use the new HQ prompts to refresh portraits · P1

The `NPC_SPRITE_PROMPTS_HQ.md` doc (v0.25.949) has 20 painterly prompts
for the most-visible NPCs. Generating the new sprites and dropping them
in is **zero code change** — the `NPC_SPRITE_FILES` registry already
maps display names to canonical filenames. Just replace files.

Highest impact: Sage Mira, Brok, Milo (story-critical NPCs).

### G.2 — Equipment sprite consistency pass · P2

The current equipment sprites are a mix of authored ludo.ai outputs and
older placeholders. A consistency pass — single artist, single style —
would unify the look. ~50-80 items affected; doable as a multi-version
batch.

### G.3 — Player character idle animation refinement · P3

The vector hero idle already has a breathing wobble (v0.25.x). Adding
two more idle states (hand-on-hip, looking-up-at-sky, swiping-hair) on a
slow 10-30 s rotation would make the character feel alive in
non-combat moments. Bone-rig is in place — just need state variants.

---

## H. Quick wins (≤ 30 LOC each)

A list of high-impact, low-effort polish:

1. **Particle z-sort by life remaining** — newer particles in front of older ones. Gives the "spray" effect more depth.
2. **Damage number subtle bounce on spawn** — `transform: scale(1.2) → 1.0` over 80 ms.
3. **Combo meter spring-physics fill** — the bar already grows; add a slight overshoot + settle.
4. **Quest-tracker progress bar with golden sweep** — when a quest progresses, a brief gold highlight sweeps across the bar.
5. **HP bar critical-low pulse** — when HP < 25 %, the bar pulses red 1 Hz. Cheap urgency.
6. **MP bar refill flash** — when MP refunded (audio chime fires), the bar gets a brief cyan halo.
7. **Boss intro letterbox** — pre-fight boss-intro overlay adds top + bottom black bars that retract over 400 ms. Cinematic feel.
8. **Map name reveal flourish** — when entering a new map, the map name appears centred in large faded letters for 1.5 s, then fades. Tests via a single utility function call in `loadMap`.
9. **Setting toggle haptic** — if `navigator.vibrate` is available, fire a 15 ms tap on every setting toggle. Mobile feel.
10. **Player level-up burst** — radial gold particles from the player's centre on level-up (already partially done) — make it bigger.

---

## I. Recommendations summary table

| Priority | Item | Effort | Impact |
| --- | --- | --- | --- |
| **P1** | A.1 — Lift remaining 10 modals into lux | M | High |
| **P1** | B.1 — Authored SVG icons replace emoji | M | High |
| **P1** | C.1 — Lock lux font stack via CSS vars | S | High |
| **P1** | D.1 — Hit-stop curve refinement | S | High |
| **P1** | E.1 — Per-map ambient particle layer | M | High |
| **P1** | F.1 — Per-class skill SFX layer | M (audio) | High |
| **P1** | G.1 — Drop new HQ NPC portraits in | S (just file replace) | High |
| **P2** | A.2 — Modal close fade animation | S | Mid |
| **P2** | B.2 — Rarity glow refinement | S | Mid |
| **P2** | B.3 — Skill tree node glass upgrade | M | Mid |
| **P2** | C.2 — Letter-spacing hierarchy | S | Mid |
| **P2** | C.3 — Tabular-nums on stat numbers | XS | Mid |
| **P2** | D.2 — Screen flash colour-coding | S | Mid |
| **P2** | D.3 — Camera shake spring easing | S | Mid |
| **P2** | E.2 — Background parallax depth | M | Mid |
| **P2** | F.2 — BGM crossfade | S | Mid |
| **P2** | G.2 — Equipment sprite consistency | L | Mid |
| **P3** | A.3 — Modal-stack z-index audit | S | Low |
| **P3** | D.4 — Skill-cast trail particles | M | Low |
| **P3** | E.3 — Time-of-day tint overlay | S | Low |
| **P3** | F.3 — UI click SFX library | M (audio) | Low |
| **P3** | G.3 — Idle animation variants | M | Low |
| **P3** | H.1-H.10 — Quick wins | XS-S each | Low-Mid |

**Recommended next pass** (one version's worth of work, ~300 LOC):
ship C.1 (font stack) + C.3 (tabular-nums) + D.1 (hit-stop curve) +
H.5 (HP critical pulse) + H.7 (boss letterbox) + H.8 (map name
flourish). These together would noticeably elevate the moment-to-moment
feel without big art-pipeline commitments.

---

*Generated as a companion to the 8-agent deep audit (v0.25.953 +
v0.25.954). Pair with `NPC_SPRITE_PROMPTS_HQ.md` (v0.25.949) for the
character-art side of the polish journey.*
