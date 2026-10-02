# clip_four_captains.mp4 — the four captains' teaser

Per user (v0.30.1554): *"The introduction needs to be dramatic and epic showing the prowess of each of them, use higgsfield to
generate a strong introductory video to show them make it like a strong cinematic teaser better than AAA standard anime
videos"* — Will, Hera, Lady Hong and Taiga, the four order captains.

**Where it plays:** at a key milestone, per user (*"ship it at a key milestone"*). It plays once per save, full screen with
sound, on the first level-up at or past the class trial (`JOB_ADVANCE_LEVEL`, Lv 20). That is where Old Arlen's Act I line,
"At Lv 20, one of them will want to see you", comes due (`_lxCaptainsTeaserMilestone` -> `_lxPlayCaptainsTeaser`).

- The Lv 20 advancement toasts wait for it (`window._lxTeaserPending`), so "Speak to <your captain>" follows the film.
- A save already past Lv 20 sees it on its next level-up.
- A boss arena, the tower or an expedition defers it to the next level-up. Levels 18-19 warm the file into the HTTP cache. Tap or any key skips. The map's music steps aside (a silent cinematic score owns the mix) and is handed
back on close. Registered in `_LX_EXTRA_PAUSE_SURFACES`, the pad ids and `_cineAnythingOnScreen`.
`scripts/captains_teaser_test.mjs` pins all of it.

## Picture

Five Higgsfield **Seedance 2.5** `omni_reference` shots, 8 s each, 16:9. Each was made as a 480p draft (24 credits), then
finalized at **1080p, bitrate high** (60 credits). `generate_audio: false`.

| Shot | start_image (cover crop of the map's own backdrop) | reference | beat |
| --- | --- | --- | --- |
| Will | `bg_v3_bastionThrone` | `Sprites/npc/will.webp` | shadow floods the throne room; the blade lights white; one crescent of light splits the tide |
| Hera | `bg_v3_azureAbode` | `Sprites/npc/hera.webp` | pages lift into a spiral; constellations draw themselves; a sapphire sphere bursts across the clouds |
| Lady Hong | `bg_v3_emeraldVillage` | `Sprites/npc/Lady Hong.webp` | tea, a petal; the jade bow drawn in one motion; a crimson arrow through the grove |
| Taiga | `bg_v3_shadowWovenHood` | `Sprites/npc/Taiga.webp` | an iaido stance under the lanterns; five shadow clones with violet-flame katanas; a storm of violet slashes cuts every lantern in half; he sheathes, and a crescent splits the moon |
| The four | `bg_v3_distortedThreshold` | all four refs, each its own `image_references` | from behind as the sky tears; turn to the front, four lights in a row; they step toward the tear |

Taiga's shot was redone per user (*"Taiga needs a way more flashy amazing ninja samurai skill"*). Two drafts were made: A
(shadow clones, the moon cut) and B (lightning dashes, a shadow dragon). A's slashes read clearly, so A was finished. Credits
in all: 420 for the first cut, plus 108 for Taiga's redo.

The references are the sprites the player sees on each captain's map, flattened on `#1a1626`. Higgsfield suggested its
"IN THE DARK" preset for three shots. It was declined with `declined_preset_id` so the literal prompt was kept.

## Edit (45.33 s, 24 fps)

The edit runs:

- **0.0 s:** a title card on black, *"Since the Pause, / FOUR HAVE HELD UP THE WORLD"*.
- **2.5 s:** a fade into Will.
- **10.29 s, 18.08 s, 25.88 s:** 0.25 s fadewhite cuts into Hera, Lady Hong and Taiga.
- **33.32 s:** a 0.6 s dissolve into the four.
- **The end:** the last frame holds 4 s under a dimmer for the end card, then fades to black. The card reads
  *"EVERDAWN / THE FOUR CAPTAINS / WILL · HERA · LADY HONG · TAIGA"*, with each name in its captain's colour. It replaced
  "HOLD · NAME · KEEP · GO" per user, since the creeds meant nothing to a viewer.

A name card appears on each captain's held beat:

- WILL — HIGH COMMANDER · THE STEADFAST
- HERA — ARCHMAGE OF THE AZURE ACADEMIA
- LADY HONG — THE DIVINE ARCHER OF THE GROVE
- TAIGA — THE IMPERIAL SHADOW

The cards are rendered by Chrome in the game's own Cinzel, Alegreya SC and Cormorant (`assets/fonts`).

## Voices

Per user, *"their voices can be improved"*. Each captain speaks one line of their own, in a Higgsfield **Seed Audio** preset
voice. The voices were shortlisted by the preview's median pitch, then picked by speech length and pitch on the actual
line, at `speech_rate -10`, 48 kHz:

| Captain | Line | Voice | Pitch |
| --- | --- | --- | --- |
| Will | "So long as Justice's Breath answers my hand... no shadow passes." (his greeting) | Sterling | 82 Hz |
| Hera | "Name it truly... or not at all." (the Academia's founding rule) | Vesper | 151 Hz |
| Lady Hong | "Aim through... not at." (the Grove's one rule before the bow) | Hana | 172 Hz |
| Taiga | "The Hood has ears... most of them are mine." (his greeting) | Gideon | 69 Hz |

Each line was trimmed, high-passed at 75 Hz, compressed 3:1, given a short double echo for air, and loudnorm'd to -16 LUFS.
Each sits on its shot:

- Will's "answers my hand" lands as the blade lights.
- Hera speaks as the pages lift.
- Lady Hong speaks just before the loose.
- Taiga's "...mine" lands as the clones appear.

Also tried: Alistair and Caspian for Will, who stretched the pauses to 7 s. The image-reference voices came out high and
about 15 dB quiet.

## Sound

The rest of the score is built from the game's own audio. The music is the zodiac boss theme (`audio/bgm_zodiac_boss.mp3`
from 0 s, fading in 1.2 s and out over the last 2.6 s). It is sidechain-ducked under the voices and effects. Each effect is
cued to a flash or impact frame measured in the picture (YAVG peaks and scene cuts):

- **Will:** `warrior_holy` as the blade lights, `hit_warrior_crit` and `slam_ult` on the slash.
- **Hera:** `mage_holy` under the pages, `mage_thunder` and `hit_mage_crit` on the burst.
- **Lady Hong:** `archer_charged` on the draw, `archer_arrow` and `hit_archer_crit` on the loose.
- **Taiga:** `rogue_vanish` and `shadowlord_clones` as the clones burst, `rogue_shadow` on the dash, then `shadowlord_ult`
  with three `hit_rogue_crit` and a `hit_warrior_crit` through the slash storm. Then `rogue_shadow` out of the smoke, a soft
  `hit_rogue_crit` on the sheathe, and `slam_ult` with `mage_thunder` as the moon splits.
- **The four:** `mage_thunder` as the sky tears, `warrior_holy` and `holyShield` on the four lights, `slam_ult` and
  `hit_warrior_crit` as they step, `slam_ult` under the end card.

Mastering: the premix got -0.6 dB, then a 4x-oversampled `alimiter` at 0.74, for **-14.4 LUFS integrated and -1.1 dBFS
peak** after AAC 192k.

## Encode

The master was rendered near-lossless (x264 CRF 10). The ship encode is libx264 High / yuv420p, veryslow, **CRF 26**: the
highest CRF with SSIM ≥ 0.985 against the master (0.98542). CRF 27 gave 0.98389, because Taiga's slash storm is fine detail.
It has `+faststart` and is **14,584,525 bytes**.

SSIM was compared frame by frame, with `setpts=N/24/TB` on both inputs. The mkv master's millisecond timebase otherwise pairs
neighbouring frames during motion, which reads as ~0.966 at every CRF.
