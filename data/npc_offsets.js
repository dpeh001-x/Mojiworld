/* NPC sprite calibration — baked from the key-4 "NPC Plant" dev overlay.
   LX_NPC_OFFSET_DATA: px added to the sprite draw-Y (+ = down toward the floor).
   LX_NPC_SCALE_DATA:  visual size multiplier (1 = unchanged, clamps 0.3-4).
   Live localStorage edits ('lx_npc_yoff' / 'lx_npc_scale') override these. */
window.LX_NPC_OFFSET_DATA = {
  "Daisy": -2,
  "Fashionista": -4,
  "Flop": -2,
  "High Marshal Vermillion": -5,
  "Mope": -2,
  "Munch": -2,
  "Nurse Joyce": -1,
  "Oakhart": -3,
  "Old Arlen": -3,
  "Petunia": -2,
  "The Amnesiac": -1,
  "Will": 2,
};
window.LX_NPC_SCALE_DATA = {
  "Daisy": 0.926,
  "Fashionista": 1.13,
  "Felina": 1.16,
  "Flop": 0.926,
  "Guguma": 0.8,
  "High Marshal Vermillion": 1.15,
  "Mope": 0.926,
  "Munch": 0.926,
  "Nurse Joyce": 1.18,
  "Oakhart": 1.19,
  "Old Arlen": 1.14,
  "Petunia": 0.95,
  "Stormbearer": 0.67,
  "The Amnesiac": 1.2,
  "Will": 1.1,
};
