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
- **Reference image:** the Gravitos 3rd-form / character art (living-void titan,
  molten-orange veins, violet aura, glowing eyes) — same identity fed to the
  entry clip. Use `Sprites/bosses/gravitos3.png` or the user's supplied key art.

### Prompt

> Cinematic, dramatic, semi-realistic. A colossal void-titan boss (dark purple
> armored body laced with molten-orange cracks, glowing eyes, violet aura) is
> defeated. Its body ignites and **disintegrates into black flames** — dark
> fire tongues with violet and hot-orange cores erupt across its form,
> consuming it from the ground up as ash and embers peel away and spiral
> upward. The chest-core cracks and the whole silhouette collapses inward into
> a single bright point, then a white flash. Deep black void background,
> volumetric embers, heavy atmosphere, slow-motion, high contrast, epic scale.
> No text, no UI.

## Generating (when Higgsfield is authorized)

Higgsfield MCP requires OAuth, which is unavailable in headless/non-interactive
sessions. Authorize it via claude.ai connector settings (or `/mcp` in an
interactive Claude Code session), then generate at 720p, download to the path
above, and commit. The cutscene picks it up automatically.
