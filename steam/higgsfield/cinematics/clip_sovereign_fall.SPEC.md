# The Sovereign Falls — Higgsfield generation record

**Status:** SHIPPED. The file beside this spec is the live clip. Per user:
"Generate a video using higgsfield when the towersovereign is slain at the b10
map, the towersovereign dissolves and disintegrates only to see the amnesiac
laid kneeling down unconscious" / "make it dramatic and cinematic 720p" /
"ensure that sound is generated as well".

## Slot

- **Path (exact):** `steam/higgsfield/cinematics/clip_sovereign_fall.mp4`
- Wired in `mojiworld_game.html` → `_sovereignFallCutscene()`
  (`#sov-fall-vid`). **It is his death scene, not an expedition-completion
  screen** (per user, v0.30.701: "wire it to play when the tower sovereign
  dies"), so it plays wherever he dies — 1.5 s after the kill, so his death FX
  and the floor's loot sweep land first.
  - `killMonster()` owns the general case: any `towerSovereign` death that is
    not a mirage plays it. That matters, because `_bossRushRoster()` is every
    boss in the MojiDex and therefore carries him, and the Echo Keeper can
    re-summon him — neither route goes anywhere near an expedition.
  - `_expeditionMobKilled()` claims it first (`m._sovFallPlayed = true`) in
    the B10 final-boss branch, because it alone has something to hold behind
    the scene: `_completeExpedition()` is its `onDone`, so the results screen
    opens when the scene ends.
  - The claim flag makes it fire **exactly once per monster**, and his
    `revivesOnce` means the first fall reanimates him and never reaches the
    hook — the scene lands on the real death.
  - The legacy zodiac final boss is untouched: it still completes plainly and
    never sees a scene.
- Fail-open on the house contract (NO_SOURCE fast-fail, two 4 s re-arms, a
  11.5 s ceiling): a missing or blocked file completes the run immediately, so
  a dropped clip can never cost a player their expedition.
- Unlike the Gravitos arena, B10 can still hold live mobs when its boss dies
  and this overlay covers the screen for eight seconds — so the scene holds
  the floor (`game.paused`, restored on exit) and calls `_lxCineHold(15000)`
  so the StuckPauseWatchdog does not fight a pause that is on purpose.
- Warmed on spawn from `spawnMonster()` - every route that can put him on a
  floor goes through it - fetching the ~4 MB clip into the HTTP cache while
  the fight runs (once per session, `window._lxSovCineWarm`), so the cut
  plays frame-one. It lived in the expedition's own boss spawn until
  v0.30.701, which left a Boss Rush Sovereign facing a cold fetch.
- Title card at ~5.4 s, on the reveal: "THE SOVEREIGN FALLS / AND THE AMNESIAC
  IS LEFT KNEELING".
- Also listed in `steam/package.json` `extraResources`.

## What it shows (the lore beat)

The Apex Sanctum at the crown of the tower. The Sovereign of the Spire —
"crowned by everyone who climbed this far and then stopped" — takes the kill,
sinks to one knee, and the flame on his staff goes out. Light opens along the
seams of his robes and he comes apart from the feet up into a storm of violet
and gold ash; the staff falls and shatters. The ash sweeps past camera, thins,
settles. What is left standing at the apex is not a victor: it is the
Amnesiac, small in his orange hood, kneeling collapsed on the scorched floor
with his head bowed, unconscious and alone.

## AUDIO

Generated with `generate_audio: true` — the mix is IN the file (verified: the
mp4 carries a `soun` handler atom; measured mean −20.8 dB, peak −5.7 dB, with
the per-frame RMS rising from −26 dB into the disintegration). The overlay
plays at volume 0.9 with the map/boss bed ducked via `_vidDuckBgm`, so the
collapse lands over near-silence; the mute path exists only for the
autoplay-denied edge case, and `sovereign_fall_test.mjs` asserts unmuted
playback stays the normal one.

## Generation (2026-09-14, one attempt)

- Model **`seedance_2_0`** · **720p** · 8 s · 16:9 · `mode: std` ·
  `genre: epic` · `generate_audio: true` (house economy; never 1080p).
- Job id: `f612aa57-2334-496f-a8a7-56b99d496740`.
- References: `Sprites/bosses/towerSovereign.webp` (1656×1314) and
  `Sprites/npc/amnesiac.webp` (768×1036), both flattened onto `#0a0512` —
  submitted as `start_image` + `image_references`, which the backend resolved
  to two reference images, so both characters read on model.
- The tool proposed its "Disintegration" preset; declined, because the preset
  ends at the dissolve and the reveal of the kneeling Amnesiac is the point.

### Prompt (verbatim)

> Dark-fantasy game cinematic, painterly hand-illustrated style, dramatic and
> cinematic. Setting: the Apex Sanctum at the crown of a ruined tower -
> cracked obsidian floor, broken arches, a bleeding crimson-violet sky, ash
> drifting on the wind.
>
> 0-2s: The Tower Sovereign from the start image - a towering figure in deep
> violet and gold robes, masked crown, tall flaming staff - staggers and sinks
> to one knee, defeated. The flame on his staff gutters and dies. Slow
> push-in. Hairline seams of white-gold light open across his robes and mask
> from within.
>
> 2-5s: He disintegrates. The body breaks apart from the feet upward into a
> rising storm of glowing violet-gold ash and cinders, robes shredding into
> embers, the staff falling and shattering on the stone. The ember cloud
> blooms outward and sweeps past the camera, filling the frame with drifting
> light.
>
> 5-8s: The embers thin and settle. Revealed on the scorched floor where the
> Sovereign stood, exactly matching the reference image: the Amnesiac - a
> small figure in a bright orange hooded coat - kneeling collapsed, head
> bowed, arms hanging limp, unconscious and alone. The camera cranes slowly
> down and holds on them as the last cinders fall and the sanctum darkens to
> silence.
>
> Slow deliberate camera, volumetric god rays through the ash, high contrast
> rim light, shallow depth of field, subtle film grain. No text, no captions,
> no on-screen UI.
>
> Audio: a deep receding roar and cracking stone as the Sovereign breaks
> apart, a swelling low choir and a single struck bell at the disintegration,
> then the music falling away to wind, soft ember crackle and quiet as the
> kneeling figure is revealed.

## QA (frame captures across the 8.06 s clip)

- ~0.1 s — the Sovereign standing, flaming staff lit, ruined sanctum and
  crimson sky behind; on model against `towerSovereign.webp`.
- ~1 s — down on one knee, the staff falling out of his hand.
- ~2 s — push-in on the mask and shoulders as the seams light.
- ~3 s — the body shattering into violet shards and gold cinders.
- ~4 s — full ash storm sweeping past camera; frame is embers alone.
- ~5 s — the ash thinning, a small orange hood visible far down the floor.
- ~6–8 s — the Amnesiac kneeling, head bowed, arms limp, the last cinders
  falling; camera holds. On model against `Sprites/npc/amnesiac.webp`.

Guarded by `scripts/sovereign_fall_test.mjs` (27 checks): the clip beside the
game at 1280×720 with an audio track, the kill-chain wiring (only the
Sovereign; completion reached on every path including a throw), the warm
fetch, real unmuted playback at volume 0.9, the held-and-released floor, skip,
fail-open in ~0.2 s with no stuck pause, an integration pass that kills a
Sovereign inside a live expedition and proves completion waits for the scene
and then lands, and a real-pipeline pass that spawns a Sovereign on a live map
with no expedition anywhere, kills him through `killMonster` twice (the first
fall reanimates and plays nothing), and proves the real death opens the scene,
holds the floor, releases it, and fires exactly once. On v0.30.698 that same
pass reads `sceneOnDeath: false`.
