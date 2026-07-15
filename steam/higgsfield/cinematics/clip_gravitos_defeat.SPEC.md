# Gravitos Defeat Cinematic — Higgsfield generation spec

**Status:** the in-game defeat cutscene ships with a **procedural black-flame
disintegration** (canvas) as of v0.29.93. This clip is an optional drop-in that
auto-plays fullscreen the instant it exists — no code change needed.

## Drop-in slot (exact)

- **Output path (must match exactly):** `steam/higgsfield/cinematics/clip_gravitos_defeat.mp4`
- Wired in `mojiworld_game.html` → `_gravitosDefeatCutscene()` (`#grav-def-vid`).
  On `canplay` it fades in over the procedural canvas and plays with audio;
  on error/missing it silently stays on the procedural scene. Fail-open — a bad
  or absent file can never soft-lock the endgame.
- Plays the moment **Gravitos' 3rd (Ascendant) form** is defeated at The
  Singularity, ~1.9 s after the kill (loot rain lands first), then hands off to
  the epilogue → game-complete.

## Recommended generation (matches the shipped entry clip pipeline)

- Model `seedance_2_0` · **720p** (36 cr, per project economy note — never 1080p) ·
  **6–8 s** · epic genre · `generate_audio` on · reference-driven identity.
- **Reference image (v2, current):** the user-supplied Gravitos 3rd-form art —
  a colossal **demonic dragon-knight**: near-black plated armor veined with
  glowing crimson magma cracks, huge dark bat/dragon wings rimmed with
  red-orange fire, a blazing yellow-white core in the chest, horned helm,
  glowing yellow eyes, wreathed in red & orange flames on black. (Supersedes
  the earlier purple void-titan look.) Feed this identity as the reference
  image when Higgsfield upload is available.

### Prompt (v2 — matches the demonic dragon-knight reference, more cinematic)

> Cinematic, dramatic, hyper-detailed dark-fantasy, shallow depth of field,
> slow motion, volumetric lighting. A colossal demonic dragon-knight boss is
> defeated: near-black plated armor veined with glowing crimson magma cracks,
> huge dark bat-like dragon wings rimmed with red-orange fire, a blazing
> yellow-white core burning in its chest, horned helm, glowing yellow eyes. Its
> body ignites and **disintegrates into black flames** — dark fire tongues with
> crimson and hot-orange cores erupt across its armor, consuming it from the
> ground up as glowing embers and ash peel away and spiral upward. The wings
> crumble to cinders, the chest-core cracks and flares, and the whole silhouette
> collapses inward into a single searing point, then a blinding white flash with
> lens flare. Deep black void background, dense volumetric embers, drifting
> smoke, god-rays, rim lighting, high contrast, epic cinematic scale, film
> grain. No text, no UI.

## Generating (when Higgsfield is authorized)

Higgsfield MCP requires OAuth, which is unavailable in headless/non-interactive
sessions. Authorize it via claude.ai connector settings (or `/mcp` in an
interactive Claude Code session), then generate at 720p, download to the path
above, and commit. The cutscene picks it up automatically.
