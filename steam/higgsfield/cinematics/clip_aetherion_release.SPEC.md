# clip_aetherion_release.mp4: Aetherion's release

Per user (v0.30.1645):
1. *"Generate a similar theme looking scene whereby aetherion is defeated, his soul is released and dispersed, with a faint thank you. and then the sanctum deforms and then gravitos arena gradually starts to build from the crumbles of aetherion sanctum"*
2. then *"make it in 12 seconds with audio"*, *"play it after aetherion is defeated"* and *"this needs to be aetherion's 2nd form being defeated"*
3. and *"ship this after aetherion 2 death"*

**Where it plays:** once per save, 1.5 s after Aetherion's first real death in his second form.
- He evolves at 50% HP (`_aetherionEvolved`). The row's `need: '_aetherionEvolved'` keeps a first-form kill from playing it; that kill leaves it unseen for the next one.
- Echo Keeper rematches, expedition bosses and mirages never play it.
- It is the third row of `LX_KILL_FILMS` (`_lxKillFilmKill`, then `_lxPlayKillFilm`): full screen with sound, tap or any key skips, the map's music steps aside under a silent "The Singularity" score and comes back after.
- It is warmed into the HTTP cache when he spawns.
- His last-words card ("I WAS THE ANSWER ONCE.") and the Amnesiac's farewell (`warden_falls`) used to open 3.5 s after his death. They now wait while a kill film is pending or playing, then run as before.
- `scripts/aetherion_release_test.mjs` pins it.

## Picture

1. **Key art first** (GPT Image 2.5, high, 2k), from the game's own art:
   - his second form (`bosses/aetherion2`) as a realistic upright gold-armoured dragon with his halo ring;
   - him kneeling, defeated, in his lair with the halo broken (the opening frame);
   - the Singularity (`bg_v3_gravitosArena`) as a realistic ruined colosseum under the black sun.
   The lair key art is the one made for `clip_mira_aetherion`.
2. **Two Seedance 2.5 `omni_reference` shots:** two 480p drafts each, the better one finalized at 1080p with high bitrate.

| Shot | Length | Beats |
| --- | --- | --- |
| His release | 6 s | The halo flares and breaks. He glows from within. A close-up as he whispers and closes his eyes. His ghostly soul rises out of him while the body falls to glittering dust. |
| The Singularity | 7 s | The sanctum twists and deforms, and the portal collapses. The rubble swirls up and locks into the colosseum. The oculus flares, and the black sun appears with its corona. |

3. **Post.** Each shot is graded darker (`eq` plus a vignette). The second loses its first 11 frames of still lair. They are joined by a 0.625 s dissolve through the lair, with a 0.5 s fade to black at the end: 288 frames, exactly 12.0 s.

## Sound

**Music:** "The Singularity" (Gravitos's arena theme) is the only track. It starts from its file start at film 1.27 s and fades in from 4.6 s as his soul rises. Its quiet bars sit under the deforming sanctum, its rise under the arena building, and its peak (8.9 s into the file) lands on the black sun's flash at 10.17 s.

**Voice:** per user *"the whisper can be the same female whisper"*: the same ElevenLabs voice (Luna) that whispers "help me" in `clip_mira_aetherion`, here "[whispers] Thank you..." (no voiced harmonics). "Thank" lands on his lips at 3.28 s, with its own soft reverb. A male take (Orion) was made first and replaced.

**Effects** (6-9 dB under the music, soft attacks, noise low-passed at or below 8 kHz):
- the sanctum's ambience (`ambient/cosmic`) under his release;
- `mcryshard` and soft bells on the halo breaking;
- a riser and a low swell as he glows, faded at the cut;
- bells, an airy rise and a dust crackle as his soul leaves;
- a rumble, a warped groan and a soft implosion as the sanctum deforms;
- a stone grind and three low thuds as the arena locks together;
- a boom, an air burst and a low hum on the black sun.

ffmpeg `aevalsrc` chirps with a second harmonic and `asoftclip`; one shared `aecho` reverb, master high-pass at 35 Hz, a 4x-oversampled limiter at 0.79 (the AAC encode added ~1.8 dB of peak at 0.89). Out: -16.6 LUFS, -1.4 dBFS peak.

## Encode

- **Video:** libx264 High, `-preset veryslow -tune animation`, CRF 21: the highest CRF with SSIM >= 0.985 against the lossless master (0.9851).
- **Audio:** AAC 192k, `+faststart`.
- **Result:** 1920x1080, 24 fps, 12.0 s, 7.3 MB.
- **Cost:** 243 Higgsfield credits.
