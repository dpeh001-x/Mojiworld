# The Twelve and the Last Step — Higgsfield generation record

**Status:** SHIPPED (v0.30.1390). The file beside this spec is the live clip. Per user:
"add more story beats for Mira and the Amnesiac and generate necessary 720p
short films as well" / "Make this beat specific when beating all the zodiac
bosses, then there will be a reveal that mira is the amnesiac's sister".

## Slot

- **Path (exact):** `steam/higgsfield/cinematics/clip_mira_twelve.mp4`
- Wired in `mojiworld_game.html` → `STORY_BEAT_CLIPS.mira_twelve_reveal`, the
  backdrop of the `mira_twelve_reveal` beat. `_lxSiblingReveal()` queues that
  beat right behind `zodiac_twelve_done` (from both of its triggers: the
  twelfth zodiac kill and `_lxZodiacTwelveReconcile`); a save that beat the
  Twelve before this build hears it the next time it talks to Mira or the
  Amnesiac (`_lxSiblingBeatFirst`). Muted, plays once and holds its last frame
  behind the stanza text, lazy, fail-open (the beat reads as text-only).
- Also listed in `steam/package.json` `extraResources`.

## What it shows (the lore beat)

The Gate at night: the game's own backdrop, the Hourglass glowing in the
arch, Mira small on the last step. The zodiac wheel lights up across the sky
and turns for the first time since the dreaming stopped. She stands, the
camera pushes in, and it ends over her shoulder as she looks down the long
road toward a distant town: toward Everdawn Central, where her brother turns
a ring that is no longer on his hand.

## Generation (2026-09-28, one attempt)

- Model **`seedance_2_0`** · std · 720p · 8 s · 16:9 · genre `drama` ·
  `generate_audio: false` (story-beat clips play muted) · **36 credits**
  (house economy; never 1080p).
- Job id: `a61b9181-6411-4afb-b80b-022ada73b08b`.
- References: `start_image` = `backgrounds/bg_v3_wayfarersLantern2.webp`
  (1152×648 cover crop — the scene opens AT the gate);
  `image_references` = `Sprites/npc/sage_mira.webp` flattened onto `#1a1626`.

### Prompt (verbatim)

> Cinematic dark-fantasy, hyper-detailed, volumetric firelight and starlight,
> shallow depth of field. A towering carved stone gate in a crimson forest at
> night: an hourglass glows in the arched doorway, braziers burn, worn stone
> steps lead up to it. A silver-haired woman in white and gold robes sits alone
> on the last step, small against the gate, as she has for ages. Above the
> gate, twelve zodiac constellations form a vast wheel across the starry sky,
> and for the first time the wheel begins to turn, stars sweeping in slow
> golden arcs. She lifts her head and slowly rises to her feet, long silver
> hair stirring in a sudden warm wind, embers drifting up around her. The
> camera slowly pushes in as she turns to look down the long road below toward
> a distant town at the edge of dawn; her eyes glisten with quiet, bittersweet
> resolve. Somber, tender, hushed tone. Film grain, epic cinematic scale. No
> text, no UI.

## Encode

Raw 4,843,713 bytes (H.264, index at the end). Shipped re-encode, the
cinematic-slim recipe: libx264 High / yuv420p, veryslow, **CRF 22** (the
highest CRF with SSIM ≥ 0.985 vs the raw: 0.9862), +faststart, no audio
track; same 1280×720, 24 fps, 193 frames, 8.04 s → **2,941,005 bytes**.

## QA (frame captures)

- ~0.5 s — the game's Gate backdrop, Mira tiny on the steps below the Hourglass.
- ~2.5 s — push-in; a golden zodiac wheel appears over the gate.
- ~4.5 s — Mira at the arch, the wheel turning in the sky through it.
- ~6.5 s — on-model Mira (silver hair, white and gold robes) on the threshold.
- ~8 s — the held frame: over her shoulder, a winding road down to a town at
  dusk under the wheel. Decorative pseudo-lettering on the wheel's rim; no
  captions or UI.

Guarded by `scripts/mira_brother_test.mjs`.
