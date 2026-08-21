# It's Him — Higgsfield generation record

**Status:** SHIPPED. The file beside this spec is the live clip. Per user:
"have a scene of the amnesiac regaining his memory at the distant part of
everdawn central and saying the words 'its him' make sure the audio is
audible, and then after that clip_the_last_winding should play.
clip_gravitos_to_guguma should not play at all."

## Slot

- **Path (exact):** `steam/higgsfield/cinematics/clip_amnesiac_its_him.mp4`
- Wired in `mojiworld_game.html` → `_amnesiacItsHimCutscene()`
  (`#amn-ih-vid`), played between the shadow reveal and The Last Winding.
  Full ending chain: defeat → A Mere Shadow → **IT'S HIM** → The Last
  Winding → game complete. The rebirth clip (clip_gravitos_to_guguma) is
  RETIRED from the chain — nothing calls it. Fail-open (NO_SOURCE fast-fail,
  12s ceiling) skips onward to The Last Winding. Title card at ~5.6s:
  ""IT'S HIM." / THE AMNESIAC REMEMBERS".
  Also listed in `steam/package.json` `extraResources`.

## What it shows (the lore beat)

Far from the Sanctum, in a quiet corner of Everdawn Central at dusk, the
Amnesiac's twelve forgotten ages come back at once — memory-shards sinking
into him, the fog lifting from his face into grief, recognition and horror
together. He turns to the camera and says the only words that matter, aloud:
**"It's him."** Every lantern in the square dims behind him. He is the one
character who KNEW the Kindest Hand before the lifting — the audience
surrogate confirming what the shadow-play just showed.

## AUDIO (the point of the clip)

Generated with `generate_audio: true`; the spoken line is IN the file's audio
track (verified: the mp4 carries a `soun` handler atom). The player runs the
overlay at volume 0.9 with the BGM ducked via `_vidDuckBgm`, so the line
lands over near-silence. The mute fallback exists only for the
autoplay-denied edge case — in real play the player has been interacting for
an entire boss fight, so unmuted playback is the normal path, and
`amnesiac_its_him_test.mjs` asserts it stays that way.

## Generation (2026-08-20, one attempt)

- Model **`seedance_2_0`** · 720p · 8 s · 16:9 · `generate_audio: true` ·
  **36 credits** (house economy; never 1080p).
- Job id: `aec6707c-0444-4495-807c-098228ad0b72`.
- References: `start_image` = `backgrounds/bg_v3_everdawn_central.webp`
  (1152×648 cover crop — the scene opens IN the town);
  `image_references` = `Sprites/npc/amnesiac.webp` flattened onto `#1a1626`.

### Prompt (verbatim)

> Cinematic dark-fantasy, hyper-detailed, volumetric night lighting, shallow
> depth of field. In a distant quiet corner of a pastel fantasy town square at
> dusk - warm lanterns, cobblestones, colourful rooftops far in the background
> - a lone hooded wanderer in worn traveller's clothes stands with his back
> half-turned, far from the camera. The camera slowly pushes in as fragmented
> glowing memory-shards drift around his head like tiny shattered glass
> lights, swirling faster, sinking into him. His eyes suddenly widen - the fog
> of twelve forgotten ages lifting from his face in one instant - grief,
> recognition and horror arriving together. He turns to face the camera,
> trembling, and speaks one clearly audible line aloud, his voice breaking,
> close-miked and intimate over dead silence: "It's him." The lantern light
> flickers; every light in the town square dims at once behind him; his breath
> fogs in air gone suddenly cold. Somber, dread-heavy, hushed finale tone; no
> music under the spoken line, then a single low ominous note after it. Film
> grain, epic cinematic scale. No text, no UI.

## QA (real-time playback captures; clip is 8.06s)

- ~1 s — the hooded Amnesiac small and distant in the Everdawn square, dusk,
  lanterns warm; art style matches the game's own town backdrop.
- ~4.5 s — mid-push: on-model Amnesiac (amber hooded cloak, downcast face)
  centered in the square.
- ~8 s — the close: facing the camera, eyes wide, stricken, the town dimmed
  behind him. Audio track confirmed in-container.

Guarded by `scripts/amnesiac_its_him_test.mjs` (11 checks): the audio track
in the file, unmuted volume-0.9 playback, chain plumbing to The Last Winding,
real playback, skip, fail-open ~0.3s.
