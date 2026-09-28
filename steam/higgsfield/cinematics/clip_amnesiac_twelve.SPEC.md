# One Step Behind — Higgsfield generation record

**Status:** SHIPPED (v0.30.1390). The file beside this spec is the live clip. Per user:
"add more story beats for Mira and the Amnesiac and generate necessary 720p
short films as well" / "Make this beat specific when beating all the zodiac
bosses, then there will be a reveal that mira is the amnesiac's sister".

## Slot

- **Path (exact):** `steam/higgsfield/cinematics/clip_amnesiac_twelve.mp4`
- Wired in `mojiworld_game.html` → `STORY_BEAT_CLIPS.amnesiac_twelve_dream`,
  the backdrop of the `amnesiac_twelve_dream` beat: his half of the reveal,
  played by `_lxSiblingBeatFirst` the first time you talk to him after Mira's
  scene (`mira_twelve_reveal`), before his dialogue opens. Muted, plays once
  and holds its last frame behind the stanza text, lazy, fail-open.
- Also listed in `steam/package.json` `extraResources`.

## What it shows (the lore beat)

Everdawn Central at the edge of morning: the game's own town backdrop, the
Amnesiac small and still in the square, looking up a long road to a gate
glowing on a hill. A glowing memory of a silver-haired woman in white and
gold fades in one step behind him, and is gone by ~4 s. The camera pushes
in to his face; by the last frame his mouth has opened on a word he cannot
say yet. ("A woman one step behind me, the whole way up.")

## Generation (2026-09-28, one attempt)

- Model **`seedance_2_0`** · std · 720p · 8 s · 16:9 · genre `drama` ·
  `generate_audio: false` (story-beat clips play muted) · **36 credits**
  (house economy; never 1080p).
- Job id: `f448dcae-fdbf-4ffb-82b3-2da2b5fb3f76`.
- References: `start_image` = `backgrounds/bg_v3_everdawn_central.webp`
  (1152×648 cover crop — the scene opens IN the town);
  `image_references` = `Sprites/npc/amnesiac.webp` and
  `Sprites/npc/sage_mira.webp`, each flattened onto `#1a1626`.

### Prompt (verbatim)

> Cinematic fantasy, hyper-detailed, soft volumetric pre-dawn light, shallow
> depth of field. A pastel fantasy town square at the edge of morning: pink
> blossom trees, timbered houses, cathedral spires far in the background,
> petals drifting on a slow wind. A lone hooded wanderer in a worn amber cloak
> stands very still in the square, looking up the long road toward a faint
> glowing gate on a distant hill. His thumb slowly turns a ring that is not on
> his hand. For a heartbeat, a translucent memory of a silver-haired woman in
> white and gold robes appears one step behind him, glowing softly, then
> dissolves into drifting petals. The camera slowly pushes in on his face: his
> eyes widen with quiet recognition, grief and tenderness. Hushed, bittersweet,
> intimate tone. Film grain, epic cinematic scale. No text, no UI.

## Encode

Raw 2,794,626 bytes (H.264, index at the end). Shipped re-encode, the
cinematic-slim recipe: libx264 High / yuv420p, veryslow, **CRF 26** (the
highest CRF tried; SSIM vs the raw 0.9852 ≥ 0.985), +faststart, no audio
track; same 1280×720, 24 fps, 193 frames, 8.04 s → **951,863 bytes**.

## QA (frame captures)

- ~0.5 s — the Everdawn Central backdrop; the on-model Amnesiac (amber hooded
  cloak) small in the square, a gate glowing at the top of the road.
- ~1.5-3.5 s — the memory: on-model Mira, haloed, one step behind him.
- ~4 s — she is gone; he is alone in the square again.
- ~6.5-8 s — the push-in to his face; the held frame, lips parted. No
  captions or UI.

Guarded by `scripts/mira_brother_test.mjs`.
