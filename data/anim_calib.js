// Baked per-(monster/boss, state) animation calibration + attack hitboxes.
// Authored with monster_animator.html. Game merges: localStorage > this file > defaults.
// CALIB: s = size multiplier; dx/dy = nudge as a FRACTION of rendered sprite height (+dy = down).
// HITBOX (_atkMonBox override): w/h = box size, ox = center x-offset, oy = bottom
// offset from the foot line (+down) — all fractions of rendered sprite height.
// Missing entries keep the game defaults.
window.LX_ANIM_CALIB = {
  "goblinMauler": {
    "attack": {
      "s": 1.05,
      "dx": 0,
      "dy": 0.075
    }
  },
  "grumpsquid": {
    "walk": {
      "s": 1,
      "dx": 0,
      "dy": 0.015
    }
  },
  "meloncholy": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.01
    },
    "walk": {
      "s": 1,
      "dx": 0,
      "dy": 0.025
    },
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.02
    }
  },
  "mirageStalker": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.015
    },
    "walk": {
      "s": 1,
      "dx": 0,
      "dy": 0.02
    },
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.015
    }
  },
  "mournshade": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.035
    },
    "walk": {
      "s": 1,
      "dx": 0,
      "dy": 0.025
    },
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.015
    }
  },
  "octoLegFreeze": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.03
    },
    "walk": {
      "s": 1,
      "dx": 0,
      "dy": 0.03
    },
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.03
    }
  },
  "octoLegPoison": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.03
    },
    "walk": {
      "s": 1,
      "dx": 0,
      "dy": 0.03
    },
    "attack": {
      "s": 1,
      "dx": 0.03,
      "dy": 0.03
    }
  },
  "octoLegSkillLock": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.03
    },
    "walk": {
      "s": 1,
      "dx": 0.03,
      "dy": 0.03
    },
    "attack": {
      "s": 1,
      "dx": 0.03,
      "dy": 0.03
    }
  },
  "octoLegStun": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.03
    },
    "walk": {
      "s": 1,
      "dx": 0,
      "dy": 0.03
    },
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.03
    }
  },
  "orange": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.025
    },
    "walk": {
      "s": 1,
      "dx": 0,
      "dy": 0.04
    },
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.035
    }
  },
  "pinechad": {
    "idle": {
      "s": 1.31,
      "dx": 0,
      "dy": 0.025
    },
    "walk": {
      "s": 1.34,
      "dx": 0,
      "dy": 0.02
    },
    "attack": {
      "s": 1.34,
      "dx": 0,
      "dy": 0.025
    }
  },
  "aetherion2": {
    "idle": {
      "s": 0.87,
      "dx": -0.015,
      "dy": 0.025
    },
    "walk": {
      "s": 1.1442,
      "dx": -0.04,
      "dy": 0.025
    },
    "attack": {
      "s": 1.1415,
      "dx": 0,
      "dy": 0.0254
    }
  },
  "aetherion": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.01
    },
    "walk": {
      "s": 1.0457,
      "dx": -0.02,
      "dy": 0.01
    },
    "attack": {
      "s": 1.6,
      "dx": 0,
      "dy": 0.01
    }
  },
  "gravitos2": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.045
    },
    "walk": {
      "s": 1,
      "dx": 0,
      "dy": 0.045
    },
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.025
    }
  },
  "gravitos2star": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.045
    },
    "walk": {
      "s": 1,
      "dx": 0,
      "dy": 0.045
    },
    "attack": {
      "s": 0.965,
      "dx": 0,
      "dy": 0.0294
    }
  },
  "gravitos3": {
    "idle": {
      "s": 1.02,
      "dx": 0,
      "dy": 0.03
    },
    "walk": {
      "s": 1.22,
      "dx": 0,
      "dy": 0.05
    },
    "attack": {
      "s": 1.12,
      "dx": 0,
      "dy": 0.04
    }
  },
  "gravitos3star": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.03
    },
    "walk": {
      "s": 1.23,
      "dx": 0,
      "dy": 0.05
    },
    "attack": {
      "s": 2.8,
      "dx": 0.0105,
      "dy": 0.3875
    }
  },
  "gravitos": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.015
    },
    "walk": {
      "s": 1.0281,
      "dx": 0,
      "dy": 0.015
    },
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.015
    }
  },
  "legosaurus": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.035
    },
    "walk": {
      "s": 0.949,
      "dx": 0,
      "dy": 0.035
    },
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.035
    }
  },
  "mooma": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.01
    },
    "walk": {
      "s": 0.949,
      "dx": 0,
      "dy": 0.01
    },
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.01
    }
  },
  "pqConductor": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.02
    },
    "walk": {
      "s": 1.02,
      "dx": 0,
      "dy": 0.02
    },
    "attack": {
      "s": 1.4,
      "dx": 0.1211,
      "dy": 0.01
    }
  },
  "sundered_smith": {
    "idle": {
      "s": 0.79,
      "dx": 0.135,
      "dy": 0
    },
    "walk": {
      "s": 0.8702,
      "dx": 0.17,
      "dy": 0
    },
    "attack": {
      "s": 1.09,
      "dx": 0.265,
      "dy": 0
    }
  },
  "towerSovereign": {
    "idle": {
      "s": 0.59,
      "dx": -0.025,
      "dy": 0.01
    },
    "walk": {
      "s": 0.55,
      "dx": -0.035,
      "dy": 0.01
    },
    "attack": {
      "s": 0.72,
      "dx": -0.025,
      "dy": 0.01
    }
  },
  "young_confused_barnaby": {
    "idle": {
      "s": 0.84,
      "dx": 0,
      "dy": 0.015
    },
    "walk": {
      "s": 0.86,
      "dx": 0,
      "dy": 0
    },
    "attack": {
      "s": 0.8617,
      "dx": 0,
      "dy": -0.01
    },
    "duck": {
      "s": 0.9017,
      "dx": 0,
      "dy": 0
    },
    "weave": {
      "s": 0.8758,
      "dx": 0,
      "dy": 0
    }
  },
  "gravitospunch": {
    "attack": {
      "s": 1.01,
      "dx": 0,
      "dy": 0.015
    }
  },
  "kingKrook": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.04
    },
    "walk": {
      "s": 1.655,
      "dx": 0,
      "dy": 0.0797
    },
    "attack": {
      "s": 1.4946,
      "dx": 0,
      "dy": 0.0532
    }
  },
  "towerArbiter": {
    "idle": {
      "s": 1,
      "dx": 0.045,
      "dy": 0.015
    },
    "walk": {
      "s": 1.515,
      "dx": 0.065,
      "dy": 0.02
    },
    "attack": {
      "s": 1.77,
      "dx": 0.115,
      "dy": -0.005
    }
  },
  "octobaby": {
    "walk": {
      "s": 1.07,
      "dx": 0,
      "dy": 0
    },
    "attack": {
      "s": 1.23,
      "dx": 0,
      "dy": 0
    }
  },
  "forgewight": {
    "walk": {
      "s": 1.01,
      "dx": 0,
      "dy": 0
    },
    "attack": {
      "s": 1.26,
      "dx": 0,
      "dy": 0
    }
  },
  "king": {
    "attack": {
      "s": 1.3152,
      "dx": 0,
      "dy": 0
    }
  },
  "zodiac_capricorn": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.0682
    },
    "walk": {
      "s": 1,
      "dx": 0,
      "dy": 0.0682
    },
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.0682
    }
  },
  "gravitos3laser": {
    "attack": {
      "s": 1.0658,
      "dx": 0,
      "dy": 0.026
    }
  },
  "gravitos3punch": {
    "attack": {
      "s": 1.0478,
      "dx": 0,
      "dy": 0.0294
    }
  },
  "gravitos3soul": {
    "attack": {
      "s": 1.0432,
      "dx": 0,
      "dy": 0.0294
    }
  },
  "legosaurusdash": {
    "attack": {
      "s": 1,
      "dx": 0.0249,
      "dy": 0.0805
    }
  },
  "gravitos2laser": {
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.0298
    }
  },
  "gravitos2punch": {
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.0298
    }
  },
  "gravitos2soul": {
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.0294
    }
  }
};
window.LX_ATK_HITBOX = {
  "aetherion2": {
    "idle": {
      "w": 0.6705,
      "h": 0.6,
      "ox": 0,
      "oy": 0
    },
    "walk": {
      "w": 0.625,
      "h": 0.5864,
      "ox": 0,
      "oy": -0.0136
    },
    "attack": {
      "w": 0.6341,
      "h": 0.6091,
      "ox": 0,
      "oy": 0.0091
    }
  },
  "aetherion": {
    "idle": {
      "w": 0.3628,
      "h": 0.5563,
      "ox": 0.0039,
      "oy": 0.009
    },
    "walk": {
      "w": 0.382,
      "h": 0.5746,
      "ox": 0.0254,
      "oy": 0.0313
    },
    "attack": {
      "w": 0.6728,
      "h": 0.7004,
      "ox": -0.0496,
      "oy": 0.0189
    }
  },
  "gravitos2": {
    "idle": {
      "w": 0.4589,
      "h": 0.6976,
      "ox": 0.0364,
      "oy": 0.0193
    },
    "walk": {
      "w": 0.5509,
      "h": 0.7227,
      "ox": 0.0108,
      "oy": 0.0197
    },
    "attack": {
      "w": 0.5009,
      "h": 0.706,
      "ox": 0.0318,
      "oy": -0.0136
    }
  },
  "gravitos2star": {
    "idle": {
      "w": 0.6236,
      "h": 0.6682,
      "ox": 0.0095,
      "oy": 0.0106
    },
    "walk": {
      "w": 0.6346,
      "h": 0.6337,
      "ox": 0.0274,
      "oy": 0.0058
    },
    "attack": {
      "w": 0.6418,
      "h": 0.8,
      "ox": 0.0318,
      "oy": 0.0409
    }
  },
  "gravitos3": {
    "idle": {
      "w": 0.4732,
      "h": 0.642,
      "ox": 0.0197,
      "oy": 0.0023
    },
    "walk": {
      "w": 0.7727,
      "h": 0.6318,
      "ox": 0.0372,
      "oy": 0.0101
    },
    "attack": {
      "w": 0.6546,
      "h": 0.7,
      "ox": 0.0273,
      "oy": 0.0097
    }
  },
  "gravitos3star": {
    "idle": {
      "w": 0.8182,
      "h": 0.6,
      "ox": -0.0346,
      "oy": 0.0171
    },
    "walk": {
      "w": 0.8182,
      "h": 0.6,
      "ox": 0.1053,
      "oy": 0.013
    },
    "attack": {
      "w": 0.8455,
      "h": 0.8045,
      "ox": 0.0576,
      "oy": 0.0288
    }
  },
  "gravitos": {
    "idle": {
      "w": 0.3597,
      "h": 0.5934,
      "ox": 0,
      "oy": 0.0339
    },
    "walk": {
      "w": 0.401,
      "h": 0.5828,
      "ox": -0.0106,
      "oy": 0.0171
    },
    "attack": {
      "w": 0.3564,
      "h": 0.5748,
      "ox": -0.0091,
      "oy": 0.0136
    }
  },
  "kingKrook": {
    "idle": {
      "w": 0.6455,
      "h": 0.6,
      "ox": 0,
      "oy": 0
    },
    "walk": {
      "w": 0.6818,
      "h": 0.6,
      "ox": 0,
      "oy": 0
    },
    "attack": {
      "w": 0.6,
      "h": 0.6591,
      "ox": 0.0136,
      "oy": -0.0136
    }
  },
  "king": {
    "idle": {
      "w": 0.6623,
      "h": 0.6545,
      "ox": 0,
      "oy": -0.0045
    },
    "walk": {
      "w": 0.6896,
      "h": 0.6091,
      "ox": 0.0227,
      "oy": -0.0182
    },
    "attack": {
      "w": 0.6714,
      "h": 0.6591,
      "ox": 0,
      "oy": 0.0136
    }
  },
  "legosaurus": {
    "idle": {
      "w": 0.6764,
      "h": 0.6955,
      "ox": 0.0227,
      "oy": 0.0091
    },
    "walk": {
      "w": 0.5309,
      "h": 0.6727,
      "ox": 0.0364,
      "oy": 0.0045
    },
    "attack": {
      "w": 0.6491,
      "h": 0.6682,
      "ox": -0.0273,
      "oy": -0.0409
    }
  },
  "mooma": {
    "idle": {
      "w": 0.5052,
      "h": 0.7182,
      "ox": 0,
      "oy": 0
    },
    "walk": {
      "w": 0.5052,
      "h": 0.7182,
      "ox": 0,
      "oy": 0
    },
    "attack": {
      "w": 0.5052,
      "h": 0.7182,
      "ox": -0.0364,
      "oy": -0.0045
    }
  },
  "octobaby": {
    "idle": {
      "w": 0.8472,
      "h": 0.75,
      "ox": -0.0182,
      "oy": 0
    },
    "walk": {
      "w": 0.9108,
      "h": 0.7773,
      "ox": -0.0182,
      "oy": 0
    },
    "attack": {
      "w": 0.8927,
      "h": 0.8227,
      "ox": -0.0091,
      "oy": -0.0136
    }
  },
  "pqConductor": {
    "idle": {
      "w": 0.3255,
      "h": 0.6136,
      "ox": -0.0636,
      "oy": 0.0091
    },
    "walk": {
      "w": 0.4255,
      "h": 0.6273,
      "ox": -0.0545,
      "oy": 0.0273
    },
    "attack": {
      "w": 0.3073,
      "h": 0.5818,
      "ox": -0.0636,
      "oy": 0
    }
  },
  "sundered_smith": {
    "idle": {
      "w": 0.4909,
      "h": 0.5818,
      "ox": -0.1636,
      "oy": -0.0182
    },
    "walk": {
      "w": 0.4818,
      "h": 0.6,
      "ox": -0.1409,
      "oy": 0
    },
    "attack": {
      "w": 0.6091,
      "h": 0.6591,
      "ox": -0.25,
      "oy": -0.0091
    }
  },
  "towerArbiter": {
    "idle": {
      "w": 0.4287,
      "h": 0.5909,
      "ox": 0.0318,
      "oy": -0.0091
    },
    "walk": {
      "w": 0.4196,
      "h": 0.6,
      "ox": -0.0545,
      "oy": 0
    },
    "attack": {
      "w": 0.4741,
      "h": 0.6045,
      "ox": -0.0409,
      "oy": 0.0136
    }
  },
  "towerSovereign": {
    "idle": {
      "w": 0.3925,
      "h": 0.6,
      "ox": 0.0727,
      "oy": 0.0182
    },
    "walk": {
      "w": 0.5834,
      "h": 0.5955,
      "ox": 0,
      "oy": -0.0045
    },
    "attack": {
      "w": 0.6288,
      "h": 0.6,
      "ox": 0,
      "oy": 0.0045
    }
  },
  "young_confused_barnaby": {
    "idle": {
      "w": 0.5182,
      "h": 0.7409,
      "ox": -0.0182,
      "oy": -0.0091
    },
    "walk": {
      "w": 0.5818,
      "h": 0.7591,
      "ox": 0.0045,
      "oy": 0.0136
    },
    "attack": {
      "w": 0.5545,
      "h": 0.7409,
      "ox": -0.0182,
      "oy": 0
    }
  }
};
