# clip_mira_ashes.mp4: the Smith's ashes

Per user (v0.30.1635):
1. *"When the sundered forge dies, itll dissolve into ashes and get absorb by the boss distorted mira's hands in her specialised map and then she will summon her shards and face directly at the camera straight on before facing you off in an epic death duel"*
2. then *"Make the characters more anime partial 3d styled, shorten the film to 10s. It should be in the style of the gravitos ending videos"*
3. then *"USE ZODIAC_BOSS instead, and soften the other SFX"*
4. and *"ship it after defeating the sundered smith. So when fighting the distorted mira boss, that map bgm should be this same zodiac boss bgm"*

**Where it plays:** once per save, 1.5 s after the first real kill of the Sundered Smith in his forge.
- Echo Keeper rematches, expedition bosses and mirages never play it.
- It is the first row of `LX_KILL_FILMS`: `_lxKillFilmKill` from `killMonster`, then `_lxPlayKillFilm`.
- It is full screen with sound, like Barnaby's fall. Tap or any key skips it, and a missing file closes it. The map's music steps aside and comes back after.
- It is warmed into the HTTP cache when he spawns (`_lxKillFilmWarm`).
- The overlay id `kill-film-overlay` is registered in `_LX_EXTRA_PAUSE_SURFACES`, the pad ids and `_cineAnythingOnScreen`.
- Her map, the Last Step, now plays the same zodiac boss theme (`_BGM_MAP_FILES.lastStep`).
- `scripts/mira_ashes_test.mjs` pins all of it.

## Picture

Two Higgsfield **Seedance 2.5** `omni_reference` shots at **720p**, made directly with no draft (7 credits a second), two variants each, and the better one kept.

**Style:** the Gravitos ending films (`clip_gravitos_defeat_dragonknight`, `clip_gravitos_shadow_reveal`): dark 3D-anime CG, toon-shaded glossy models, volumetric god-rays, fog, rim light and slow single moves. The game backdrops are NOT inputs: a flat backdrop, even as a reference, pulled the render back to flat 2D. The setting is in words; only the character art is referenced.

| Shot | Length | References | Beat |
| --- | --- | --- | --- |
| The forge | 4 s (a re-roll without the backdrop ref, 28 credits) | `bosses/sundered_smith` | His molten glow dies, he crumbles to ash, hammer and all, and the ash spirals away toward a violet glow. |
| The Last Step | 7 s | `bg_v3_lastStep`, `bosses/miraFallen`, `monsters/miraEchoShard` | The ash is absorbed into her hands in a violet flash; lightning floods her wings; a ring of crystal shards erupts; her red eyes open straight into the lens; the camera pulls back behind the hero's silhouette. |

The shots are joined by a 0.4 s white flare, trimmed to 10.0 s with a 0.35 s fade, and upscaled 720p to 1080p (Lanczos + `cas=0.35`). An earlier 22.7 s 2D version (414 credits) was replaced per user.

## Sound

**Music:** `bgm_zodiac_boss` is the only track. It starts 1.56 s into the file at film 0, so:
- its quiet intro sits under the forge;
- its ramp (5.2 s into the file) lands on the cut to her at 3.64 s;
- its strong bars carry the absorb, the lightning and the shards;
- its dip sits under her stare;
- its hit (10.70 s into the file) lands on the face-off at 9.14 s.

It is lightly ducked under her voice.

**Effects** (softened per user, 6-9 dB under the music, soft attacks):
- a low drone and the Smith's death cry, pitched down;
- velvet-noise ember crackle;
- a wind panned left to right with the ash;
- a riser and low thuds (ffmpeg `aevalsrc` with a second harmonic and `asoftclip`);
- `mcryshard` on the shards;
- her own voice, `boss_miraFallen` (choir and three bells), on the stare.

One shared `aecho` reverb, master high-pass at 35 Hz, -16 LUFS, limiter at -1 dBFS. Out: -16.0 LUFS, -2.8 dBFS peak.

## Encode

- **Video:** libx264 High, `-preset veryslow -tune animation`, CRF 22, the highest CRF with SSIM >= 0.985 against the lossless 1080p master (0.9856).
- **Audio:** AAC 192k, `+faststart`.
- **Result:** 1920x1080, 24 fps, 10.0 s, 4.4 MB.
