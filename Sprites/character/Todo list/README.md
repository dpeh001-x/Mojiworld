# Character sprite review queue (v0.25.328)

This folder holds the **36 Ludo-generated character sprites** from the
v0.25.327 batch (since reverted). Each was authored using the
3/4-right side prefix from `CHARACTER_PROMPTS.md`, but pending review
before going live in the Q-key Character Studio.

## Contents

| Layer | Count | Filenames |
|---|---|---|
| `hair/`  | 12 | flow, ponytail, shaggy, spiky, flowy, ice_cream, pigeotto, pigtails, topknot, afro, undercut, ringlets |
| `eyes/`  | 12 | default, fierce, sparkle, sleepy, cat, closed, wink, glasses, scarred, heterochromia, cyber, teary |
| `mouth/` | 12 | default, grin, smirk, surprise, tongue, stoic, laugh, pout, fang, frown, blush, determined |

## How to promote a sprite into the live game

1. Move the approved `.webp` from `Todo list/<layer>/` to
   `Sprites/character/<layer>/`. (Filenames already line up — no rename
   needed.)
2. Add the id to the matching registry's `files` map in
   `maple_game.html` (`LX_HAIR` / `LX_EYES` / `LX_MOUTH`).
3. Add the picker entry in `HERO_VEC_HAIR_OPTIONS` /
   `HERO_VEC_EYE_OPTIONS` / `HERO_VEC_MOUTH_OPTIONS` so it shows up
   in the Q-key Character Studio.
4. For new hair ids: add to the `_migrateHairId` whitelist so saves
   persist them untouched.
5. Bump version + add changelog entry per the project's per-commit
   policy.

## Why this folder exists

v0.25.301 history: the previous Ludo batch (sparkle / star / sleepy /
puppy / cat eyes; grin / smirk / surprise / tongue / stoic / laugh
mouths; bob / emo / mohawk / pigtails / topknot hair) was rejected
wholesale because it didn't match the hand-painted look. To avoid a
repeat, this batch lands here first for human curation rather than
flipping the live picker by default.

The sprites can be safely deleted en masse if none meet the bar — the
generation prompts in `scripts/character_sprites.config.mjs` will
re-create the same set on demand.
