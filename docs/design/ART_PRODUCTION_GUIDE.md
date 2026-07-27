# LevelX 2D Side-Scroller MMORPG Art Production Guide

This guide is for generating premium-quality 2D MMO side-scroller art and integrating it quickly into LevelX.

## Target visual bar

Aim for:
- Clean silhouette readability at gameplay scale (960×560 viewport)
- Layered depth (foreground / midground / background separation)
- Cohesive painterly-anime palette with controlled saturation
- Strong value grouping so characters stay readable over scenery

Avoid direct imitation of any existing commercial game's protected style. Build a distinct visual identity.

## Background generation spec

- Aspect ratio: **16:9**
- Suggested size: **2048×1152** (or 1792×1024)
- Format: PNG
- Composition rules:
  - Keep the horizon around lower-middle of frame
  - Reserve central traversal lane with lower contrast
  - Push detail to side thirds and distant layers
  - Keep top 20% relatively uncluttered for UI legibility

### Prompt template

Use this template with your image model:

"High-end 2D side-scroller MMORPG environment concept art, side view, whimsical fantasy biome, layered parallax depth, painterly anime background, atmospheric perspective, crisp shape language, gameplay-readable composition, no characters, no UI, clean silhouettes, premium game-art finish, 16:9"

Add biome modifiers (forest, alpine, crystal cave, ruins, sky islands, volcanic pass) and time-of-day descriptors (golden hour, moonlit, misty dawn).

## Integration workflow

1. Export selected finals into `backgrounds/`.
2. Keep core slots updated (`bg_forest.png`, `bg_valley.png`, etc.) for guaranteed fallback.
3. For extra variety, keep additional cinematic variants in `backgrounds/` and run with `?art=cinematic`.
4. Choose post-processing profile per biome tone: `?artfx=soft` (balanced), `?artfx=vivid` (festival zones), `?artfx=noir` (dark/late-game maps).
5. Validate in-game readability by opening `mojiworld_game.html` and checking combat scenes.

## Quality checklist before shipping

- Does player silhouette remain clear over bright + dark zones?
- Is there clear depth separation at camera scroll speed?
- Are edges free of AI artifacts (warping, melting details, broken geometry)?
- Are color temperatures consistent with map fantasy theme?
- Is the scene distinct from known third-party game IPs?
