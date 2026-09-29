# The Title's Sky — Higgsfield generation record

**Status:** SHIPPED (v0.30.1426); HD since v0.30.1433. Per user: "Think of where else to plant high yield
films that will help improve the game experience", then "go ahead with 1, 2 and
3,4 make all of them unique exciting AAA cinematic grade". This is #1: the title
screen, the surface every player sees on every launch.

## Slot

- **Path (exact):** `backgrounds/title_sky_loop.mp4` (this record lives with the
  other film records; the loop sits with the map backdrop videos, and
  `backgrounds/**` is already packed for the Steam build).
- Wired in `mojiworld_game.html` → `LX_TITLE_LOOP` / `_lxTitleLoopArm` /
  `_lxTitleLoopStart`, armed where the title menu goes up (`menu-up`). A muted,
  looping `<video id="lo-title-loop">` INSIDE `#loading-overlay .lo-bg`, over the
  4K key art (`backgrounds/title_keyart_pop_4k.webp`), so it rides the same Ken
  Burns drift and sits under the same vignette.
- Only the sky: the loop is placed on the key art's own pixels (its 1920×624 frame
  is the art's x 14..3825, y 0..1239 — the art is drawn center/cover, the loop is
  re-placed on every resize) and masked opaque to 81.7% of its height, fading out
  by 96.2% — across the far hills, where the loop and the still agree (measured:
  the sky changes up to ~20 levels, the horizon band 4-8). The heroes, the town
  and the tower keep the crisp 4K still.
- Nothing is requested until the title menu has been up 2.5 s (never at boot);
  reduced motion, data saver and 2G skip it; a background tab waits until it is
  looked at; it fades in over the still it starts on; it is torn down when the
  overlay leaves (`.fade`) or on any error. The still is always the fallback.

## What it shows

The key art alive: the pop sunburst pulses and swells, the clouds roll, the
crystal spire shimmers, and the sun swells toward a dawn that never comes, then
settles back — the world stuck at almost-morning.

## Generation (2026-09-29, one attempt)

- Model **`seedance_2_0`** · std · 720p · 8 s · 16:9 · genre `auto` · bitrate
  `high` · `generate_audio: false` · **36 credits** (house economy; never 1080p).
- Job id: `ee1453d7-b90f-47cb-b78f-e1ed13ed7da0`.
- References: `start_image` AND `end_image` = the key art itself
  (`backgrounds/title_keyart_pop_4k.webp`, centred to 16:9 — 3811×2144 from x 14 —
  at 1280×720), so the film starts on the still it is laid over.

### Prompt (verbatim)

> Living title-screen artwork, locked-off static camera: the framing never moves
> and the final frame returns exactly to the first. The vibrant hand-painted
> pop-art fantasy scene comes alive with energetic, seamless looping motion: the
> huge sunburst of colored light rays behind the sun slowly rotates and pulses
> with energy; blazing clouds of magenta, orange and violet drift and roll across
> the sky; the giant sun glows and shimmers with heat haze, holding still on the
> horizon at the edge of dawn; the tall rainbow crystal atop the castle tower
> pulses with prismatic light and throws sparkles into the air; glittering light
> motes and petals float on a warm wind across the valley; the four young
> adventurers on the hill stand watching the horizon, their hair, capes and
> scarves fluttering in the breeze; the small round yellow chick at their feet
> hops and bobs happily; grass and flowers sway. Rich saturated colors, crisp
> clean line art, cinematic lighting, AAA game title screen. No text, no logo, no
> UI.

## Loop + encode

The camera held (the output is on the art's pixels), but the end frame did not
return to the start (the sunburst and the sun grow through the clip) and the
foreground line art shimmers at 720p. So: the top 416 rows only (the sky, down to
the far hills), played forward and then backward (frames 0..192, 191..1 — a 16 s
ping-pong whose wrap is two neighbouring frames; the sun rises and falls back),
libx264 High, veryslow, CRF 23 (SSIM 0.9866 against the lossless ping-pong),
+faststart, no audio → **1,370,237 bytes**.

## HD pass (v0.30.1433)

Per user: "ensure this is HD HQ and then ship all of the videos in" (about the
living-title preview). The same take, rebuilt from the raw output: the sky
(top 416 rows) motion-interpolated 24 → 48 fps (`minterpolate` mci / aobmc /
bidir — no artefacts on the rays or clouds at 1:1), upscaled 1.5× to 1920×624
(Lanczos + contrast-adaptive sharpening 0.35; beside the 4K key art at the same
scale the halftone, cloud edges and rays hold), then the same forward-and-back
loop (764 frames, 15.92 s). libx264 High, veryslow, `-tune animation`, the
highest CRF that keeps SSIM ≥ 0.985 against a near-lossless reference — CRF 19,
SSIM 0.9859 — +faststart → **5,249,810 bytes**. The game code is unchanged: it
places the loop by the art's coordinates, not its pixel size.

The full-frame composite — this loop laid on the 4K key art exactly as the
title shows it, cover-scaled to 1920×1080 (the sky lands at 0,0,1920,624) —
ships for the store and socials as
`steam/assets/trailer/mojiworld_living_title_1080p.mp4` (48 fps, 15.92 s,
CRF 16, 9,437,080 bytes).
