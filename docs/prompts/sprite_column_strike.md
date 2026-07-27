# columnStrike "Tomb Column" — Sprite Prompts (ludo.ai)

Asset-generation prompts for the **columnStrike VFX** (v0.26.350). Replaces
the procedural vertical energy beam at the `skill:'column'` render branch in
`mojiworld_game.html` with one **distinct ludo.ai sprite per caster**.

The engine stretches each sprite to the beam box (`width × full-viewport-
height`, ~110–176 px wide × ~880 px tall) and adds a subtle flicker-alpha.
Until a file lands, the caster falls back to the old procedural beam — so
these can be dropped in one at a time.

## Output spec (shared by all 6)

- **Size:** 256 × 1024 PNG (1:4 vertical), transparent background.
- **Shape:** a single vertical column of energy, centered horizontally,
  filling top-to-bottom. The column gets **stretched vertically** in-engine,
  so keep detail *bandable* — no single hero element that would smear; use a
  repeating/flowing vertical motif (rising motes, drifting runes, licking
  flame) that survives a 1:8-ish vertical stretch.
- **Edges:** soft translucent falloff on the left/right so it reads as light,
  not a hard slab. Bright hot core down the centerline (~30% width).
- **Top & bottom:** fade the very top and bottom ~5% to transparent so the
  off-screen buffer (the beam runs 200 px above and below the viewport)
  blends instead of cutting off hard.
- **No background, no ground, no character** — just the column on alpha.
- 16-bit painterly pixel-art VFX, vibrant, faint 1 px inner edge glow, no
  anti-aliased halo box.
- **Filenames → `Sprites/fx/`** (LX_FX prepends that dir):

| Caster | File | Hue |
| --- | --- | --- |
| Path's Bane | `fx_col_pathsbane.png` | necrotic withered green `#88aa66` |
| Archon | `fx_col_archon.png` | holy gold `#ffeeaa` |
| Rexy (boss) | `fx_col_blockrexy.png` | brick-fire orange `#ff8844` |
| Tomb Wraith | `fx_col_tombwraith.png` | spectral toxic-green `#aaff77` |
| Tomb Hexer | `fx_col_tombhexer.png` | arcane violet `#c88aff` |
| Zodiac | `fx_col_zodiac.png` | cosmic (tinted per-sign in engine) |

---

## 1 — Path's Bane (`fx_col_pathsbane.png`)
```
Vertical 256x1024 painterly pixel-art VFX column on transparent background.
A towering pillar of necrotic withered-green energy (#88aa66) crashing down
from above — sickly luminous core down the centerline, ragged decaying edges
that fray into floating ash motes and tiny withered glyphs drifting upward.
Faint bone-grey wisps spiraling around the shaft. Soft translucent green
falloff at the left/right edges, hot pale-green core. Top and bottom fade to
transparent. Reads as a reaper's grave-column of death magic. No background.
```

## 2 — Archon (`fx_col_archon.png`)
```
Vertical 256x1024 painterly pixel-art VFX column on transparent background.
A radiant pillar of holy gold light (#ffeeaa) descending from the heavens —
brilliant white-gold core, soft golden falloff edges, rising sparks and tiny
feather-glyphs of light drifting up the shaft, faint divine rune-rings
stacked vertically. Warm, blinding, celestial. Top and bottom fade to
transparent. Reads as an angelic judgment beam. No background.
```

## 3 — Rexy, the Warped Tyrant (`fx_col_blockrexy.png`)
```
Vertical 256x1024 painterly pixel-art VFX column on transparent background.
A roaring pillar of fiery molten brick and lava (#ff8844) — chunks of glowing
cracked toy-bricks tumbling within an updraft of orange flame, ember sparks
streaming upward, white-hot core down the centerline. Aggressive, blocky,
volcanic. Soft orange falloff edges. Top and bottom fade to transparent.
Reads as the block-king's eruption. No background.
```

## 4 — Tomb Wraith (`fx_col_tombwraith.png`)
```
Vertical 256x1024 painterly pixel-art VFX column on transparent background.
A spectral pillar of toxic phantom-green (#aaff77) — translucent ghostly
vapor rising in lazy coils, scattered pale skull-wisps and ectoplasmic
streaks, eerie luminous core. Cold, haunting, gaseous (lighter and more
diffuse than Path's Bane). Soft green falloff edges. Top and bottom fade to
transparent. Reads as a death-column from a spectral caster. No background.
```

## 5 — Tomb Hexer (`fx_col_tombhexer.png`)
```
Vertical 256x1024 painterly pixel-art VFX column on transparent background.
An arcane pillar of violet hex-energy (#c88aff) — swirling purple sigils and
hex-circles stacked up the shaft, crackling magenta lightning filaments,
luminous lavender core. Mystical, witchy, charged. Soft violet falloff edges.
Top and bottom fade to transparent. Reads as a curse-column of withered
glyph magic. No background.
```

## 6 — Zodiac casters (`fx_col_zodiac.png`)
```
Vertical 256x1024 painterly pixel-art VFX column on transparent background.
A cosmic pillar of starfield energy — deep indigo-to-white nebula gradient
with twinkling stars and tiny constellation lines drifting up the shaft,
luminous white core. Kept hue-neutral / blue-white so the engine can tint it
per zodiac sign (Taurus, Scorpio, Aquarius). Soft falloff edges. Top and
bottom fade to transparent. Reads as a celestial sign-beam. No background.
```

---

## Wiring (already in `mojiworld_game.html`, v0.26.350)

- LX_FX keys registered in the FX loader (`fx_col_*`).
- Each caster's `traits.columnStrike.sprite` points at its key; the zodiac
  builder stamps `fx_col_zodiac`.
- The spawn copies `cs.sprite → projectile._colSprite`.
- The `skill:'column'` render branch blits the sprite (1.6× width halo bleed,
  flicker alpha) when `_lxFxReady`, else the procedural beam.

Drop the PNGs in `Sprites/fx/` and they appear live on next load — no code
change needed.
