# clip_mira_aetherion.mp4: the Woman Who Turned Back becomes Aetherion

Per user (v0.30.1642):
1. *"Using higgsfield, generate a AAA cinematic scene : Now when distorted mira is defeated, get her to dramatically dissolve as she whispers "help me", leaves a drop of tear in here eyes( zoom in)  and dramatically transform into aetherion with a burst of surrounding white holy explosion and the map slowly crumbles from mira's map to form aetherion's lair, aetherion bursts out and shoots a fireball at the camera, then the camera zooms in head on and fades the whole scene should be at most 12 seconds, ensure audio is made as well"*
2. then *"use deathorb instead"*
3. then *"The film can be much more dark realistic anime style (less cartoon, more realism), the crumbling of the map can be made with more realism ,do not need to use the actual map but look similar, most important is to look realistic dramatic and portray the dark vibes"*
4. and *"ship it after defeating distorted mira"*

**Where it plays:** once per save, 1.5 s after the first real kill of the Woman Who Turned Back (`miraFallen`) on the Last Step.
- She revives once (`revivesOnce` at 30%), so her first fall never reaches `killMonster`'s tail and the film waits for the real one.
- Echo Keeper rematches, expedition bosses and mirages never play it.
- It is the second row of `LX_KILL_FILMS` (`_lxKillFilmKill` from `killMonster`, then `_lxPlayKillFilm`): full screen with sound, tap or any key skips, the map's music steps aside under a silent `bgm_sanctum` score and comes back after.
- It is warmed into the HTTP cache when she spawns (`_lxKillFilmWarm`).
- `scripts/mira_aetherion_test.mjs` pins it.

## Picture

1. **Key art first.** The game's chibi sprites as references kept the render cartoony, so each was first reimagined as dark semi-realistic anime key art with GPT Image 2.5 (high, 2k): her (from `bosses/miraFallen`), her kneeling on the mirror floor below the glass stair (the opening frame), Aetherion, his lair (from `bg_v3_aetherion`) and the death orb (from `p_deathorb`, which stayed flat until it had its own).
2. **Two Seedance 2.5 `omni_reference` shots**, 6 s each: two 480p drafts per shot, the better one finalized at 1080p with high bitrate.

| Shot | Beats |
| --- | --- |
| The Last Step | Her wings burn away into violet embers. A front-on extreme close-up: she whispers on two lip movements, a tear wells and falls. White cracks split her face, and she bursts into white light. |
| The lair | The glass stair shatters in heavy slabs, revealing a dark cavern and a portal ring. Aetherion bursts out in a flash and roars. His chest charges, and he fires the death orb into the lens. Through the void his face comes head-on, and the camera rushes into his gold eye. |

3. **Post.** Each shot is graded darker (`eq` contrast, gamma and saturation plus a vignette; the pinker lair harder). They are joined by a 0.3 s fade through her white blast, and fade to black on his eye. The result is 11.79 s.

An earlier toon-shaded version (216 credits) was replaced per user. This one cost 266 credits.

## Sound

**Music:** `bgm_sanctum` (his lair theme) is the only track. It starts at film 3.12 s from its file start, so its build rises under the tear, the cracks, the white blast and the shattering stair, and its hit (5.0 s into the file) lands on his burst from the portal at 8.12 s.

**Voice:** an ElevenLabs whisper ("[whispers] Help me...", a breathy take with no voiced harmonics), split so "help" lands on her first lip movement (2.54 s) and "me" on the second (3.21 s), with its own soft reverb.

**Effects** (6-9 dB under the music, soft attacks, every noise layer low-passed at or below 8 kHz):
- a low void drone and a faint sparkle under her dissolving;
- a glint on the tear;
- a riser under the cracks;
- a boom, a holy bell shimmer and an air burst on the white blast;
- glass shards and a low rumble on the stair;
- a boom on his burst, then his own boss roar (`boss_aetherion`);
- a void swell and a low hit on the orb, and a last soft hit on his eye.

ffmpeg `aevalsrc` chirps with a second harmonic and `asoftclip`; one shared `aecho` reverb, master high-pass at 35 Hz, -16 LUFS, a 4x-oversampled limiter at 0.89. Out: -16.0 LUFS, -2.0 dBFS peak.

## Encode

- **Video:** libx264 High, `-preset veryslow -tune animation`, CRF 20: the highest CRF with SSIM >= 0.985 against the lossless master (0.9856). The film grain needed it lower than the toon films.
- **Audio:** AAC 192k, `+faststart`.
- **Result:** 1920x1080, 24 fps, 11.79 s, 9.0 MB.
