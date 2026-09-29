# The Distortion Closes — Higgsfield generation record

**Status:** SHIPPED (v0.30.1426). The file beside this spec is the live clip. Per user:
"Think of where else to plant high yield films that will help improve the game
experience", then "go ahead with 1, 2 and 3,4 make all of them unique exciting
AAA cinematic grade". This is #4: the master advancement at level 40.

## Slot

- **Path (exact):** `steam/higgsfield/cinematics/clip_distortion_closes.mp4`
- Wired in `mojiworld_game.html` → `STORY_BEAT_CLIPS.advancement_2_done`, the
  backdrop of the `advancement_2_done` epilogue beat that plays after the mastery
  is chosen ("The distortion closes behind you. You have out-wanted a sentinel who
  never decided which wall to hold ... The Singularity is nearer now — and it can
  feel you coming."). Plays once WITH its soundtrack (`STORY_BEAT_CLIP_SOUND`),
  the scene's score (`The Singularity.mp3`, the theme the film ends on) waiting
  silent and rising after. Warmed while the mastery is chosen
  (`openMasterAdvancement` → `_sbPreloadClip`). Lazy, fail-open.
- Also listed in `steam/package.json` `extraResources`.

## What it shows (the lore beat)

The Distorted Portal's Threshold from its own backdrop (the blood-red storm, the
black pagoda). The Lost Sentinel, Young Confused Barnaby, on-model from his boss
still, drops to one knee, finally still; the tear of warped space convulses and
collapses in a shockwave of lightning and debris, the storm blasts open into
night; and the camera surges away to the Singularity's own arena, where the black
sphere before the blazing ring pulses once, as if it senses someone coming.

## Generation (2026-09-29, one attempt)

- Model **`seedance_2_0`** · std · 720p · 8 s · 16:9 · genre `epic` · bitrate
  `high` · `generate_audio: false` (the soundtrack is mixed from the game, see
  Sound) · **36 credits** (house economy; never 1080p).
- Job id: `ecb3c59c-35ce-4f80-aa6b-d5447df9aa3c`.
- References: `start_image` = `backgrounds/bg_v3_distortedThreshold.webp`
  (1152×648 cover crop); `image_references` = `Sprites/bosses/young_confused_barnaby.webp`
  flattened onto `#1a1626`, and `backgrounds/bg_v3_gravitosArena.webp` (1152×648
  cover crop) for the last shot.

### Prompt (verbatim)

> Epic dark-fantasy anime cinematic, AAA boss-defeat cutscene, hand-painted style
> matching the references. The Distorted Threshold: a blood-red storm sky over a
> black pagoda tower and silent rooftops. Shot 1: a colossal tear of warped space
> hangs in the storm, rippling like broken glass; before it the Lost Sentinel, a
> red-haired, red-bearded, bare-chested warrior (the reference character), drops
> to one knee, exhausted, his fists finally lowered. Shot 2: the tear convulses
> and collapses inward with a shockwave that blasts the storm clouds apart,
> lightning forking outward, embers and debris whipping past the camera in slow
> motion, and the sky clears into deep night. Shot 3: the camera surges up and
> away across the dark to a vast ruined colosseum where an enormous black sphere
> hangs before a blazing white ring (the Singularity, from the reference); it
> pulses once, deep and ominous, as if it senses someone coming. Thunderous scale,
> dramatic lighting, volumetric light, film grain. No text, no UI.

## Sound (v0.30.1426)

Mixed from the game's own audio with ffmpeg, synced to the picture (20 cues),
premixed, then one measured gain to -16 LUFS and a 4x-oversampled limiter
(measured -15.8 LUFS, -3.1 dBTP): the storm (`audio/ambient/storm.mp3`) and the
Distorted Portal's own theme climbing (`audio/bgm_distorted_portal.mp3` from 4 s);
thunder; the Sentinel's own boss voice (1.25 s) and his defeat cry as he falls to
one knee (2.12 s), with the knee's thud; a lightning crack as the tear appears
(2.92 s) and a riser into the collapse, which lands on the theme's peak (3.83 s:
a boom doubled an octave down, space shattering, thunder); debris; the void's air
in the quiet after; the cut to the Singularity on its own theme
(`audio/The Singularity.mp3` from 3 s, 5.62 s) and the sphere's pulse (6.05 s): a
sub boom under Gravitos's own voice, pitched down (`audio/boss/boss_gravitos.mp3`).
AAC 160 kb/s, 48 kHz stereo.

## Encode

Re-encoded from the raw output (4,532,617 bytes): libx264 High, veryslow, the
highest CRF that keeps SSIM ≥ 0.985 against the raw — CRF 24, SSIM 0.9868 —
+faststart → 2,065,813 bytes. With the soundtrack muxed in (the video stream
copied untouched): **2,231,384 bytes**.
