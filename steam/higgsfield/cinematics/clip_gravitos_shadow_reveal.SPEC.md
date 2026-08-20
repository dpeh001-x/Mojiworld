# A Mere Shadow — Higgsfield generation record

**Status:** SHIPPED. The file beside this spec is the live clip. Per user:
"from the clip_gravitos_defeat_dragonknight should extend and continue to
reveal that guguma was the mastermind of moji world and that gravitos is a
mere shadow of it."

## Slot

- **Path (exact):** `steam/higgsfield/cinematics/clip_gravitos_shadow_reveal.mp4`
- Wired in `mojiworld_game.html` → `_gravitosShadowRevealCutscene()`
  (`#grav-shd-vid`), played after `_gravitosDefeatCutscene`. The full ending chain is now:
  defeat → **A MERE SHADOW** → the Amnesiac's "It's him" → The Last Winding
  → game complete. (The rebirth clip clip_gravitos_to_guguma is RETIRED from
  the chain per user — it does not play.)
  Fail-open: missing/blocked/hung clip (NO_SOURCE fast-fail, 12s ceiling)
  skips straight to the Amnesiac scene. Title card at ~5.2s: "A MERE SHADOW /
  GUGUMA HELD THE LIGHT ALL ALONG".
  Also listed in `steam/package.json` `extraResources`.

## What it shows (the lore beat)

The direct continuation of the defeat clip, opened FROM its own final visible
frame (a 3.6s playback capture — the crumbling knight, core ablaze; the clip's
last ~1.2s is already black, so the capture point is the last on-model pose).
As the fragments peel away, every light dies but one: the titan flattens into
a two-dimensional shadow-puppet on the void, golden marionette strings climb
to a tiny canary perched in the single warm spotlight — the wing that cast the
shadow all along — and when the wing lowers, the colossus crumples like
dropped cloth. The chick looks into the camera as the light narrows to
nothing. Gravitos was never the mastermind. He was the lantern show.

## Generation (2026-08-20, one attempt)

- Model **`seedance_2_0`** · 720p · 8 s · 16:9 · **36 credits** (house
  economy; never 1080p).
- Job id: `025b8731-a668-45b2-8201-d11585247dd1`.
- References: `start_image` = real-time playback capture of
  `clip_gravitos_defeat_dragonknight.mp4` at t≈3.6s (1280×720 — the defeat
  clip is 6.08s with a black tail from ~4.8s, measured);
  `image_references` = `Sprites/npc/Guguma.webp` flattened onto `#fff8d6`
  (media reused from the Last Winding generation).

### Prompt (verbatim)

> Cinematic dark-fantasy, hyper-detailed, slow motion, volumetric lighting,
> dramatic chiaroscuro. A colossal demonic dragon-knight - near-black plated
> armour veined with glowing crimson magma cracks, huge dark wings, a blazing
> white-orange core in its chest - is crumbling and disintegrating in beams of
> pale light. As the last fragments peel away, every light source dies except
> one small warm spotlight from high above, and the truth is revealed: the
> towering titan was never solid - it flattens and thins into a colossal
> two-dimensional SHADOW cast on a wall of black void, like a shadow-puppet in
> a lantern show. Fine golden threads of light, like marionette strings, run
> from the shadow's wings and limbs upward through the darkness. The camera
> slowly tilts up along the strings to their source: a tiny adorable chibi
> canary chick - round lemon-yellow egg-shaped body, fluffy white belly, tiny
> wing-tufts, a single curled sprout-feather on its head, big glossy black
> bead eyes, small orange triangular beak - perched calmly in the single beam
> of warm light, one small wing raised, casting the giant dragon shadow with
> its own tiny silhouette against the lantern light. The chick slowly lowers
> its wing and the colossal shadow crumples and collapses like dropped cloth
> into the dark below. The chick tilts its head and looks directly into the
> camera, eyes calm and unreadable, as the warm light narrows around it and
> everything else goes black. Ominous, tragic, quiet-horror finale tone; a
> single sad music-box melody; film grain, epic cinematic scale. No text,
> no UI.

## QA (real-time playback captures; clip is 8.06s)

- ~1 s — the crumbling knight, continuity with the defeat clip's final pose.
- ~4.5 s — THE image: the chick suspended in one warm spotlight, golden
  marionette strings running from its body down to the horned silhouette
  rising from the dark below.
- ~8 s — the chick close, facing the camera, strings trailing beneath its
  feet, the light dying around it.

Guarded by `scripts/gravitos_shadow_reveal_test.mjs` (8 checks): chain wiring
(the reveal receives the Amnesiac continuation as its onDone, so order is
structural), real playback, skip, fail-open onward in ~0.3s.
`guguma_rebirth_test.mjs` now guards the INVERSE (the rebirth never plays);
`amnesiac_its_him_test.mjs` and `the_last_winding_test.mjs` cover the rest.
