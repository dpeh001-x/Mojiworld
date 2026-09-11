// Per-skill sound tuning for the player's skill SFX.
//
// AUTHORED in tools/skill_sfx_tester.html (the tester's "Skill Sound Tuner"),
// handed back as an LX_SFX_PATCH:1 blob and BAKED here by
//   node scripts/apply_sfx_patch.mjs '<pasted text>'
// Do not hand-edit values in transit; re-run the tuner instead.
//
// Read by _lxSkillSfxTune() in mojiworld_game.html on every skill cast. Keys are
// SKILLS ids (plus extra cue ids such as deadeye_lock / deadeye_execute). Every
// field is optional, and a skill with no entry plays exactly as authored:
//   vol    0..2     loudness multiplier on the skill base volume (1 = as authored)
//   pitch  -12..12  semitones, tape-style: higher is also faster and shorter
//   start  s        seconds skipped at the head of the clip
//   end    s        second of the clip where it stops (absent = play to the end)
//   fade   s        fade-out length, ending at `end` (or at the clip's own end)
//   delay  s        wait between the cast and the sound, 0..1.5
//   file   path     play this clip instead of the skill's own (an audio/ path)
//   mute   true     this skill makes no sound
//   dur    s        length of the clip the trims were made against. Informational:
//                   scripts/skill_sfx_tune_test.mjs flags an entry whose clip has
//                   since been regenerated to a different length.
window.LX_SKILL_SFX_TUNE = {
};
