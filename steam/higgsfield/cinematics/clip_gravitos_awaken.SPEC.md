# clip_gravitos_awaken.mp4 - Gravitos awakens (form 1 -> form 2)

Plays when Gravitos's first form goes down in the Singularity (`LX_KILL_FILMS._gravitosAwaken`, triggered from
killMonster's form-transformation branch; once per save, skippable). The hero is immune from the killing blow until the
film closes, plus 1.5 s; his `gravitos_awakened` speech waits for it.

Per user (2026-10-09): "Make epic cinematics with semi-realistic with milder anime style of when gravitos first form is
defeated a ghastly evil aura occurs and he undergoes an epic transformation to gravitos2 form. use higgsfield, make it 5s
and include audio", then "dark and semi realistic with a realistic version of the singularity as the backdrop",
"slightly more realistic", "the camera should revolve and zoom into gravitos2 face", "head on from the front"; picked
draft 1 ("use this").

- 5.05 s, 1920x1080, 24 fps, H.264 High (CRF 20, SSIM 0.987 vs the raw HEVC final), AAC 160 kb/s stereo, +faststart,
  5.4 MB. Integrated loudness -16.4 LUFS; the sound is the model's own (rumble, cracking, lightning, the closing roar).
- Shots: form 1 kneels under the black sun, his chest star dies, a violet ghost-smoke aura with skull faces boils out of his
  cracks and violet lightning crawls over the floor (0-1.5 s); the blue armour burns into molten obsidian, two more arms
  tear out and he rises as form 2 (1.5-3.5 s); head-on push to his roaring face (3.5-5 s).
- Made on Higgsfield: gpt_image_2_5 key frames (2k, high) re-imagining the game's own sprites (Sprites/bosses/gravitos,
  gravitos2) and backdrop (backgrounds/bg_v3_gravitosArena) as dark semi-realistic CG - start eb78e958 (form 1 kneeling),
  end 4e4a28a0 (form 2 face, head-on), reference e40b43df (form 2 full body); seedance_2_5 omni_reference 5 s, audio on,
  draft a48d6249 (15 credits) finalized 1080p/high as 860f61b4 (60 credits).
