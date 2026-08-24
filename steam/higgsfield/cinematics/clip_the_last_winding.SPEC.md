# The Last Winding — Higgsfield generation record

**Status:** SHIPPED. The file beside this spec is the live clip. It REPLACES
the six-stanza `epilogue_gravitos` text on the played ending path (per user:
"instead of the load of chunk of text after defeating gravitos, scrap that");
the stanzas survive solely as the fail-open cover when the clip cannot play.

## Slot

- **Path (exact):** `steam/higgsfield/cinematics/clip_the_last_winding.mp4`
- Wired in `mojiworld_game.html` → `_gugumaToyboxCutscene()` (`#gug-toy-vid`),
  played after `_gugumaRebirthCutscene`, in place of the epilogue text.
  Two exits: onClip (played/ended/skipped → mark `epilogue_gravitos` seen →
  `_showGameComplete`) and onFallback (missing/blocked/hung clip → the old
  `_playStoryBeat('epilogue_gravitos', ...)` text). Title card at ~5.2s:
  "THE LAST WINDING / THE KINDEST HAND IN EVERDAWN HAS FEATHERS".
  Also listed in `steam/package.json` `extraResources`.

## What it shows (the lore beat)

The dark mirror of `clip_gravitos_to_guguma`. That clip promised a sunrise;
this one takes it back. The chick stands alone as the first morning dies to
void; it calmly turns away; high in the dark, embers reassemble the
dragon-knight — the chick's own shadow becoming the titan — while ash falls.
Darkness closes until only the tiny golden body glows, framed by wings, and
the light goes out. The cycle is not hope. It is a winding.

## Generation (2026-08-20, one attempt)

- Model **`seedance_2_0`** · 720p · 8 s · 16:9 · `36 credits` (matches the
  rebirth-clip economy; never 1080p).
- Job id: `4b5869b0-6617-4026-be08-3866b31dd1f0`.
- References: `start_image` = `Sprites/npc/Guguma.webp` flattened onto
  `#fff8d6` (opens on-model); `image_references` =
  `Sprites/bosses/attack/gravitos3.webp` flattened onto `#05020a`
  (identity of what re-forms above him).
- Note: the tool suggested the "IN THE DARK" preset; declined
  (`declined_preset_id`) — literal seedance keeps the house style of the
  adjacent rebirth clip.

### Prompt (verbatim)

> Cinematic dark-fantasy, hyper-detailed, slow motion, volumetric lighting,
> shallow depth of field. A tiny adorable chibi canary chick - round
> lemon-yellow egg-shaped body, fluffy white belly, short stubby orange legs,
> tiny wing-tufts, a single curled sprout-feather on top of its head, big
> glossy black bead eyes with bright white catchlights, small orange
> triangular beak - stands alone on a vast dark empty plain as the golden
> sunrise behind it fades and dies, the warm morning light draining away into
> cold violet dusk and then lightless black void. The chick calmly turns away
> from the camera and looks up: high in the darkness, glowing embers drift
> upward and slowly reassemble the colossal silhouette of a demonic
> dragon-knight - near-black plated armour veined with glowing crimson magma
> cracks, huge dark bat-like dragon wings spreading open, a cold blue-white
> core igniting in its chest - while the chick's own long shadow stretches
> forward across the ground and becomes the titan's shape. Soft grey ash falls
> like snow. The tiny golden chick stands motionless, dwarfed beneath the
> reborn colossus, as darkness closes in from the edges of the frame until
> only one glowing golden eye remains in the black - and it slowly,
> deliberately blinks shut. Melancholy, tragic, ominous finale tone, mournful
> quiet strings, film grain, epic cinematic scale. No text, no UI.

## QA (real-time playback captures — serve.js has no Range support, so seek
##     -based capture silently freezes on one frame; play on the wall clock)

- 1.0 s — chick on-model, alone on the dark plain, sun low, ash motes.
- 3.5 s — the light visibly draining; the chick small against the horizon.
- 6.0 s — the full juxtaposition: back-turned chick dwarfed beneath the
  re-formed dragon-knight, wings spread, core lit, violet dead sky.
- 7.6 s — darkness closed to one faint pool of light on the chick, wing
  silhouettes framing it; the light failing.

Guarded by `scripts/the_last_winding_test.mjs` (12 checks): chain wiring, the
scrap (epilogue text never appears on the played path, stanzas reachable only
through the fallback), seen-marking parity, real playback, skip via the clip
exit, fail-open under a blocked clip in ~0.3s.
