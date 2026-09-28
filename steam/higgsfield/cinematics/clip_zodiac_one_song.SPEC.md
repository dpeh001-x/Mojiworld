# The Twelve, One Song — Higgsfield generation record

**Status:** SHIPPED (v0.30.1411; soundtrack v0.30.1415). The file beside this spec is the live clip. Per user:
"generate 720p combined single short film regarding the zodiac reveal", then
(after a first cut built on the Codex portraits) "The zodiac used are wrong,
should use the ones in the boss, and then make sure they are more natural and
animated, do it in a more AAA cinematic action trailer style, but keep the
guguma chirping at the back", then "add sound to the zodiac trailer, make it real epic".

## Slot

- **Path (exact):** `steam/higgsfield/cinematics/clip_zodiac_one_song.mp4`
- Wired in `mojiworld_game.html` → `STORY_BEAT_CLIPS.zodiac_twelve_done`: the
  zodiac reveal that plays when the twelfth House falls (the twelfth sign
  exhales; the wheel turns; one song; the bird waits; Gravitos lifts his head).
  Plays once WITH its soundtrack (STORY_BEAT_CLIP_SOUND: unmuted at the cinematic
  volume, the music slider followed live, silent when the game is muted; the
  beat's score starts silent and rises when the clip ends or fails), then holds
  its last frame (Guguma) behind the stanza text; lazy, fail-open. Replaces `clip_101446` (a colonnade and a ring of glyphs),
  which is no longer played or packed; its file stays in the repo.
- Also listed in `steam/package.json` `extraResources`.

## What it shows

A trailer in four movements, cut together (white-flash cuts between the three
action segments, a dissolve into the finale):

1. **Aries, Taurus, Gemini, Cancer** — the skull-faced fire ram charges out of a
   wall of flame; the granite bull stamps, the ground splitting; the butterfly
   bursts up in a storm of glowing scales; the pearl crab surges from a wave.
2. **Leo, Virgo, Libra, Scorpio** — the sun-maned lion leaps roaring off a cliff;
   the golden winged bird dives past the camera; the lantern stag rears, its
   lanterns swinging like the pans of a balance; the crystal scorpion erupts.
3. **Sagittarius, Capricorn, Aquarius, Pisces** — the star-bodied stag with golden antlers gallops under a shooting
   star; the ice sea-goat breathes frost from a frozen summit; the crowned octopus
   rises out of a flooded ruin; the two koi spiral in a whirlpool until they blaze.
4. **Finale** — the Twelve as glowing starlight in a ring under the portal arch
   of the ruins; the camera plunges through the clouds to Everdawn Central,
   where Guguma, on the perch, chirps (eyes shut, beak open) and looks up at the
   Twelve in the sky: the held last frame.

The creatures are the IN-FIGHT boss art (`Sprites/bosses/zodiac/<sign>.webp`),
not the Codex portraits (`Sprites/zodiac/`), which the first cut used.

## Generation (2026-09-28)

- Model **`seedance_2_5`** · `omni_reference` · 720p · 16:9 · 8 s per segment ·
  `generate_audio: false` (story-scene films play muted) · **56 credits each,
  224 in all** (house economy; never 1080p).
- Segment jobs: `f718fdba-d3d1-40e6-9fbb-ba1796dd590c` (1),
  `e6376d0d-8bb0-4e41-8dc6-5d0db88c87df` (2),
  `fafd1c2e-0f60-4b98-a0e1-ac4d6273df32` (3),
  `9656c76d-6524-4445-b54e-0d3bcf8449e3` (4).
- References, each flattened onto `#1a1626`: the four fight sprites of each
  segment as separate `image_references`; the finale takes a 4×3 sheet of all
  twelve fight sprites, `Sprites/npc/Guguma_hi.webp` and Everdawn Central.
  Opening frames: the four zodiac arena backdrops
  (`backgrounds/bg_v3_cinematic_zodiac_{2,3,1,4}.webp`, 1152×648 cover crops).
- Prompt style: "AAA cinematic fantasy action trailer, hyper-detailed, dynamic
  sweeping camera, dramatic rim lighting, volumetric god rays, embers, sparks and
  particles, motion blur, fast cuts, epic scale, film grain", then four shots,
  one per creature, each "alive and moving naturally with weight and power".
- History: two earlier single 15 s takes on the Codex portraits (105 credits
  each; one duplicated the archer and lost Libra, the other lost the lion and
  the sea-goat) were not used.

## Sound (v0.30.1415)

Mixed from the game's own audio with ffmpeg, synced to the cut: 41 cues over two
music beds, every cue timed to a shot.

- **Music:** the zodiac boss theme (`audio/bgm_zodiac_boss.mp3` from 150 s, its
  climax) under the montage, held low for the first 0.8 s and slammed up on the
  ram's cut; "The Singularity" (`audio/The Singularity.mp3` from 10 s, where it
  builds) under the ring; both gone by 29.3 s. The music ducks under the
  creatures (sidechain, 5:1).
- **Hits:** a boom on every cut that matters (0.88, 7.92, 15.71, 23.05 s):
  `audio/skill/doombringer_apoc.mp3` plus `audio/impact/slam_ult.mp3` pitched
  down 7 semitones, with a reversed meteor and a reversed portal swelling into
  each.
- **The Twelve:** each creature's own boss voice
  (`audio/boss/boss_zodiac_<sign>.mp3`) on its shot, an element under it: fire
  (Aries), slam (Taurus), light (Gemini, Libra), splash (Cancer, Aquarius), a
  roar (Leo), a gale (Virgo), thunder (Scorpio), an arrow (Sagittarius), frost
  (Capricorn).
- **The finale:** a low rush for the plunge through the clouds (27.6 s), true
  silence, then Guguma (`audio/npc/npc_guguma.mp3`) on the beak at 29.55 s.
- **Master:** limiter, then loudnorm to -14 LUFS integrated (measured -14.9,
  LRA 5.1, peak -3.9 dBFS); AAC 192 kb/s, 48 kHz stereo.

## Encode

Four raw segments (1280×720, 24 fps, 8.04 s each). Cut with ffmpeg xfade: a 0.25 s
fade-to-white between segments 1-2 and 2-3, a 0.6 s dissolve into the finale; a CRF
12 master of 31.08 s, 746 frames. Shipped re-encode, the cinematic-slim recipe:
libx264 High / yuv420p, veryslow, **CRF 24** (the highest CRF with SSIM ≥ 0.985 vs
the master: 0.9851), +faststart → 7,679,279 bytes of video; with the soundtrack
muxed in (video stream copied untouched) → **8,425,351 bytes**.
