# The Mirror Breaks — Higgsfield generation record

**Status:** SHIPPED (v0.30.1426). The file beside this spec is the live clip. Per user:
"Think of where else to plant high yield films that will help improve the game
experience", then "go ahead with 1, 2 and 3,4 make all of them unique exciting
AAA cinematic grade". This is #2: the job advancement at level 20, the first
big "you became something" moment, which used to be three lines of text.

## Slot

- **Path (exact):** `steam/higgsfield/cinematics/clip_mirror_breaks.mp4`
- Wired in `mojiworld_game.html` → `STORY_BEAT_CLIPS.advancement_1_done`, the
  backdrop of the `advancement_1_done` epilogue beat that plays after the job is
  chosen (`_advCommitJob`). Plays once WITH its soundtrack
  (`STORY_BEAT_CLIP_SOUND`), the scene's score (`bgm_interdimensional_ascension`,
  the theme the film ends on) waiting silent and rising after. Warmed while the
  job is chosen (`openAdvancement` → `_sbPreloadClip`). Lazy, fail-open (the beat
  reads as text-only).
- Also listed in `steam/package.json` `extraResources`.

## What it shows (the lore beat)

The Inner Dimension, from the trial arena's own backdrop (violet starlit void,
the stone pillar with the round seal, the still pool, the candle tree). The
reflection in the pool is the Mirror Self, "the prisoner of the Inner Dimension":
a crack flashes across the water and it shatters into mirror shards that spiral
into a vortex around the seal; the seal bursts open in god rays and the
adventurer's silhouette walks into the light. "Your reflection shatters. The
Inner Dimension lets you go." The player's own figure is only ever a silhouette,
so the film never contradicts their class or gear.

## Generation (2026-09-29, one attempt)

- Model **`seedance_2_0`** · std · 720p · 8 s · 16:9 · genre `epic` · bitrate
  `high` · `generate_audio: false` (generated silent; the soundtrack is mixed from
  the game, see Sound) · **36 credits** (house economy; never 1080p).
- Job id: `826d1673-c5cd-4b2a-a0cd-5eaaba1db7b0`.
- References: `start_image` = `backgrounds/bg_v3_innerDimension.webp`
  (1152×648 cover crop — the scene opens IN the trial arena).

### Prompt (verbatim)

> Epic dark-fantasy anime cinematic, AAA game cutscene quality, hand-painted
> style matching the reference. The Inner Dimension: a violet starlit void with
> ancient stone ruins, a carved pillar bearing a great round seal, a glassy still
> pool and a twisted old tree holding candles. Shot 1: the camera glides low
> across the mirror-still pool; in the water stands the reflection of a lone
> young adventurer, a dark silhouette, but the reflection's eyes glow violet and
> it moves on its own. Shot 2: hairline cracks race across the water's surface
> like breaking glass in a flash of light, and the reflection SHATTERS into
> thousands of glittering mirror shards that explode upward in slow motion, each
> shard catching starlight. Shot 3: the shards spiral into a roaring vortex of
> violet and gold light around the pillar; the great round seal cracks open and
> floods the ruins with blinding white-gold light, and the adventurer's
> silhouette strides forward into the light, cape snapping in the wind. Dynamic
> sweeping camera, volumetric god rays, rich particles, dramatic contrast, film
> grain. No text, no UI.

## Sound (v0.30.1426)

Mixed from the game's own audio with ffmpeg, synced to the picture (15 cues),
premixed, then one measured gain to -16 LUFS and a 4x-oversampled limiter
(measured -16.3 LUFS, -0.6 dBTP): the void's air (`audio/ambient/void.mp3`) and
the trial arenas' own theme (`audio/bgm_king.mp3` from 3 s) under the still pool;
the Mirror Self stirring in its own boss voice, low and echoing (0.45 s); a crack
(1.42 s) and its own death-cry as the reflection shatters (1.55 s,
`audio/monster/mob_mirrorSelf_die.mp3`) over a low boom; glittering shards; the
vortex swelling into the seal (3.55 s); the seal breaking open on a deep boom
(5.3 s) with the victory sting, a holy shimmer and the Interdimensional Ascension
theme entering (`audio/bgm_interdimensional_ascension.mp3` from 4.6 s). AAC
160 kb/s, 48 kHz stereo.

## Encode

Re-encoded from the raw output (5,797,698 bytes): libx264 High, veryslow, the
highest CRF that keeps SSIM ≥ 0.985 against the raw — CRF 22, SSIM 0.9867 —
+faststart → 3,453,580 bytes. With the soundtrack muxed in (the video stream
copied untouched): **3,618,475 bytes**.
