# Gravitos → Guguma Rebirth Cinematic — Higgsfield generation record

**Status:** SHIPPED (v0.29.964). The file beside this spec is the live clip.
Pairs with the v0.29.961/.962 "Kindest Hand" text thread (parallel work
line): the clip shows the event, the epilogue stanzas name its meaning.

## Slot

- **Path (exact):** `steam/higgsfield/cinematics/clip_gravitos_to_guguma.mp4`
- Wired in `mojiworld_game.html` → `_gugumaRebirthCutscene()` (`#gug-reb-vid`),
  played between `_gravitosDefeatCutscene` and the `epilogue_gravitos` beat.
  Fail-open: missing/blocked clip (or a hung load, 4 s guard) skips straight
  to the epilogue text, which carries the same reveal in stanza form. Also
  listed in `steam/package.json` `extraResources`.

## What it shows (the lore beat)

The defeated dragon-knight's black flames unburden rather than consume him:
the ember spiral contracts to a warm point and re-forms into **Guguma** — the
canary from the void-entry eye-zoom — standing in the first true sunrise.
Final shot pushes into his glossy black eye with the sunrise reflected: the
mirror of the game's OPENING shot. See
`docs/design/lore_everdawn_cycle.md` §6 (The Cycle Completes).

## Generation (2026-08-20, one attempt)

- Model **`seedance_2_0`** · 720p · std · 8 s · 16:9 · genre `epic` ·
  `generate_audio: true` · **36 credits** (matches the defeat-clip economy
  note; never 1080p).
- Job id: `7fba8814-d5d3-493d-85a3-9098a3ea6b2f`.
- References: `start_image` = `Sprites/bosses/attack/gravitos3.webp`
  flattened onto `#05020a` void black (the clip opens on-model);
  `image_references` = `Sprites/npc/Guguma.webp` flattened onto `#fff8d6`
  (identity of what re-forms).

### Prompt (verbatim)

> Cinematic dark-fantasy, hyper-detailed, slow motion, volumetric lighting,
> shallow depth of field. In a deep black void filled with drifting embers, a
> colossal demonic dragon-knight — near-black plated armor veined with glowing
> crimson magma cracks, huge dark bat-like dragon wings rimmed with red-orange
> fire, a blazing yellow-white core burning in its chest, horned helm, glowing
> yellow eyes — kneels, exhausted, and finally lets go: its armor crumbles
> into black flames, glowing embers and ash peel away from its silhouette and
> spiral upward. The ember spiral contracts into a single small warm point of
> golden light, which gently condenses and re-forms into a tiny adorable chibi
> canary chick — round lemon-yellow egg-shaped body, fluffy white belly, short
> stubby orange legs, tiny wing-tufts, a single curled sprout-feather on top
> of its head, big glossy black bead eyes with bright white catchlights, small
> orange triangular beak. The tiny chick stands exactly where the titan stood
> as the black void softens into the first true sunrise: warm golden morning
> light, god-rays, drifting sparks becoming dawn motes. The camera slowly
> pushes in toward the chick's glossy black eye with the sunrise reflected in
> it, until the reflection fills the frame. Gentle, hopeful, awe-struck finale
> tone, film grain, epic cinematic scale. No text, no UI.

## QA (frame captures, headless playback)

- 0.3 s — dragon-knight on-model in the void, embers drifting.
- 2.5 s — body fully mid-disintegration: black-flame ember spiral, wing
  wreckage at the frame edges.
- 4.5 s — Guguma on-model (lemon body, white belly, sprout curl, bead eyes)
  standing where the titan stood; sunrise + god-rays; titan's wing wreckage
  framing left/right.
- 7.6 s — the eye push-in: sunrise reflection fills the frame (mirrors the
  opening void-entry zoom).
