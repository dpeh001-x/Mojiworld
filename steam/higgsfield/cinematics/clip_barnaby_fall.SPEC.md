# clip_barnaby_fall.mp4: Barnaby's fall

Per user (v0.30.1608):
1. *"Using higgsfield generate 1 new video, when barnaby dies he transforms into the sundered smith by evil incarnation with forces that cause how gravitos warp to gravitos 3"*
2. then *"First create a scene of the distorted barnaby warping to become the barnaby in this video's first frame"*
3. and *"ship it to play after defeating young barnaby"*

**Where it plays:** once per save, 1.5 s after the first real kill of Young Confused Barnaby (the Lost Sentinel, the Confused Vigil).
- Echo Keeper rematches, expedition bosses and mirages never play it (`_lxBarnabyFallKill` from `killMonster` -> `_lxPlayBarnabyFall`).
- It is full screen with sound, like the captains' teaser. Tap or any key skips it, and a missing file closes it.
- The map's music steps aside and comes back after.
- The master advancement waits for it (`window._lxBarnabyFallPending` holds `openMasterAdvancement`). The mastery, its flashback and "The distortion closes behind you" (`advancement_2_done`) therefore follow the film.
- The file is warmed into the HTTP cache when he spawns.
- It is registered in `_LX_EXTRA_PAUSE_SURFACES`, the pad ids and `_cineAnythingOnScreen`.
- `scripts/barnaby_fall_test.mjs` pins all of it.

## Picture

Two Higgsfield **Seedance 2.5** `omni_reference` shots, 16:9, `generate_audio: false`. Each was made as two 480p drafts, then one was finalized at **1080p, bitrate high**.

| Part | Length | Inputs | Beat |
| --- | --- | --- | --- |
| The Vigil (0-10 s) | 10 s (drafts 2 x 30, final 120 credits) | `start_image`: `bg_v4_confusedVigil` above the forge film's own floor band, with `young_confused_barnaby` standing where Barnaby will stand. `end_image`: the forge film's first frame. Refs: young Barnaby, `npc/barnaby`. | He snaps between the walls. Crimson cracks split the Vigil like a broken mirror, and he clutches his head. It shatters onto the forge. A white flash and embers, and he is old Barnaby. |
| The forge (10-25 s) | 15 s (drafts 2 x 45, final 180 credits) | `start_image`: `bg_v3_sundered_forge` (cover crop 1152x648). Refs: `npc/barnaby`, `bosses/sundered_smith`, `fx/gravitos3_voidrift` (the rift of Gravitos's Ascendant form). | He staggers in and falls; his hammer drops. The crimson void rift tears open over him. Void fire lifts him; the iron helm closes over his face, and the molten-cracked armour forms. A fire burst ignites his eyes. He lands as the Sundered Smith and strikes; the rift snaps shut. |

Rejected drafts:
- A forge variant where he slumped over the anvil came back with blood on the anvil and his hands.
- A Vigil variant spun him around like a costume change.

The model skipped the prompt's anvil split: his last strike hits the floor in sparks.

**The join.** The Vigil render landed about 3.5% wider than the forge film's first frame. A grid search on stills found scale 1.035 at (-8, -16) px, and a 50/50 blend showed no double edges. The Vigil's last 2 s (he stands still) ease a cosine zoompan onto that framing (3x upscale first, so it cannot jitter), then a 0.2 s dissolve.

## Sound

One continuous track, all from the game's own audio. Times are in the joined film; the forge's cues are offset by 9.84 s.

| Time | Cue |
| --- | --- |
| 0 s | `bgm_distorted_portal` |
| 3.25 s | `mobs/mcryshard`, the cracks; a `ambient/void` swell |
| 3.9 s | `boss_young_confused_barnaby`, his grunt (x0.5: it runs about 18 dB hotter than the rest) |
| 4.95 s | `ui/qte_break`, the shatter |
| 5.8 s | `impact/slam_ult` + `impact/hit_mage_crit`, the flash |
| 5.9 s | `MagmaFoundry` rises into the forge |
| 11.3 s | Barnaby's fall: `mob_young_confused_barnaby_die` + a clang |
| 11.8 s | `The Singularity`, the Gravitos Ascendant theme; its first hit lands with the rift at 13.8 s |
| 13.1 s | `ambient/void`, the rift |
| 19.8 s | `slam_ult`, the fire burst |
| 21.1 s | `boss_sundered_smith`, his roar |
| 22.3 s | The hammer: `mob_sundered_smith_hit` + `qte_break` |

The premix is set to -16 LUFS with one static gain, then a 4x-oversampled `alimiter` at 0.74. Out: -16.4 LUFS, -2.2 dBFS peak.

## Encode

- **Video:** libx264 High, `-preset veryslow -tune animation`, CRF 25, the highest CRF with SSIM >= 0.985 against the lossless master (0.98514, compared with `setpts=N/24/TB` on both).
- **Audio:** AAC 192k, 48 kHz, `+faststart`.
- **Result:** 1920x1080, 24 fps, 24.88 s, 5.6 MB.
- **Credits:** 450 in all.
