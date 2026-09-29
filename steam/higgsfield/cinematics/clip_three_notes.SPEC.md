# Three Notes — Higgsfield generation record

**Status:** SHIPPED (v0.30.1426). The file beside this spec is the live clip. Per user:
"Think of where else to plant high yield films that will help improve the game
experience", then "go ahead with 1, 2 and 3,4 make all of them unique exciting
AAA cinematic grade". This is #3: the first zodiac kill, the moment that plants
the Twelve's mystery the zodiac trailer (`clip_zodiac_one_song`) pays off.

## Slot

- **Path (exact):** `steam/higgsfield/cinematics/clip_three_notes.mp4`
- Wired in `mojiworld_game.html` → `STORY_BEAT_CLIPS.first_zodiac_kill`, the
  backdrop of the `first_zodiac_kill` dialog beat (the Amnesiac: "the bird on the
  top perch just sang. Three notes, and it is nowhere near dawn"), which queues
  behind the fallen sign's last words. Plays once WITH its soundtrack
  (`STORY_BEAT_CLIP_SOUND`); a dialog beat whose film has sound owns the mix
  (v0.30.1418), so the map's music makes way and the scene's score
  (`bgm_zodiac_sanctum`, the Houses' theme the film ends on) waits silent and
  rises after. Warmed behind the sign's last words (`_sbPreloadClip` at the
  kill). Lazy, fail-open.
- Also listed in `steam/package.json` `extraResources`.

## What it shows (the lore beat)

Everdawn Central from its own backdrop, at the edge of a dawn that never comes.
The canary on the top perch (the bunting span, on-model from `Sprites/npc/Guguma.webp`
— nothing in the film names it; the epilogue does) wakes, lifts its head and
sings three notes out of turn, a ring of golden light pulsing out with each; the
camera pulls back as the townsfolk stop and look up, cranes over the blossom
roofs, and in the pale sky a ring of twelve constellations glimmers — one flares
and exhales a wave of warm light over the town. "Twelve ages of held breath — and
one of them just exhaled."

## Generation (2026-09-29, one attempt)

- Model **`seedance_2_0`** · std · 720p · 8 s · 16:9 · genre `epic` · bitrate
  `high` · `generate_audio: false` (the soundtrack is mixed from the game, see
  Sound) · **36 credits** (house economy; never 1080p).
- Job id: `5b6978d8-ff9d-4092-bce8-a418b65db806`.
- References: `start_image` = `backgrounds/bg_v3_everdawn_central.webp`
  (1152×648 cover crop); `image_references` = `Sprites/npc/Guguma.webp`
  flattened onto `#1a1626`.

### Prompt (verbatim)

> AAA cinematic anime fantasy, hand-painted style matching the references.
> Everdawn Central at the edge of a dawn that never comes: pink blossom trees,
> timbered houses and a stone plaza in hushed pale light, petals hanging in the
> still air. A string of festival bunting and lanterns spans high across the
> plaza, and on it perches a small round yellow canary (the reference character).
> Shot 1: extreme close-up as the canary lifts its head, its eye catching the
> light, and opens its beak to sing three bright notes; with each note a ring of
> golden light pulses outward through the air, stirring the blossoms. Shot 2: the
> camera pulls back and cranes up fast over the rooftops as swirls of petals
> rise, and small townsfolk below stop and look up. Shot 3: high above the town,
> a vast faint ring of twelve constellations glimmers in the pale sky; one of
> them flares brilliantly and fades out, exhaling a wave of warm golden light
> that washes over the whole town. Majestic, mysterious, wondrous tone;
> volumetric light, drifting petals, film grain. No text, no UI.

## Sound (v0.30.1426)

Mixed from the game's own audio with ffmpeg, synced to the picture (18 cues),
premixed, then one measured gain to -16 LUFS and a 4x-oversampled limiter
(measured -16.0 LUFS, -1.1 dBTP): Everdawn's morning air (`audio/ambient/town.mp3`)
and its theme, soft (`audio/bgm_mojiworld.mp3` from 20.5 s); the canary's own
voice (`audio/npc/npc_guguma.mp3`) cut to one cheep and sung as three RISING
notes on the beak (2.38 / 2.83 / 3.28 s: +0, +3, +7 semitones), each with a golden
chime and a felt low pulse under its ring; a gust as the camera pulls back and a
swell as it cranes over the roofs; the cosmic hum and the Zodiac Sanctum's theme
(`audio/bgm_zodiac_sanctum.mp3` from 3.5 s) under the ring of Houses; and a bloom
of light, a low boom and a shimmer as one flares (7.35 s). AAC 160 kb/s, 48 kHz
stereo.

## Encode

Re-encoded from the raw output (4,191,275 bytes): libx264 High, veryslow, the
highest CRF that keeps SSIM ≥ 0.985 against the raw — CRF 24, SSIM 0.9868 —
+faststart → 1,953,774 bytes. With the soundtrack muxed in (the video stream
copied untouched): **2,119,223 bytes**.
