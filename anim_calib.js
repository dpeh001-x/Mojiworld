// Baked per-(monster/boss, state) animation calibration + attack hitboxes.
// Authored with monster_animator.html. Game merges: localStorage > this file > defaults.
// CALIB: s = size multiplier; dx/dy = nudge as a FRACTION of rendered sprite height (+dy = down).
// HITBOX (_atkMonBox override): w/h = box size, ox = center x-offset, oy = bottom
// offset from the foot line (+down) — all fractions of rendered sprite height.
// Missing entries keep the game defaults.
window.LX_ANIM_CALIB = {
  "forgewight": {
    "attack": {
      "s": 1.87,
      "dx": 0.0301,
      "dy": 0.6
    }
  },
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
      "dx": 0.015,
      "dy": 0.025
    },
    "walk": {
      "s": 1.11,
      "dx": 0.04,
      "dy": 0.025
    },
    "attack": {
      "s": 1.1,
      "dx": 0,
      "dy": 0.025
    }
  },
  "aetherion": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.01
    },
    "walk": {
      "s": 1,
      "dx": -0.02,
      "dy": 0.01
    },
    "attack": {
      "s": 1.6,
      "dx": 0,
      "dy": 0
    }
  },
  "blockRexy": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.01
    },
    "walk": {
      "s": 1,
      "dx": -0.035,
      "dy": 0.015
    },
    "attack": {
      "s": 1.3,
      "dx": 0.09,
      "dy": 0
    }
  },
  "gravitos2star": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.025
    },
    "walk": {
      "s": 1.08,
      "dx": 0,
      "dy": 0.025
    },
    "attack": {
      "s": 2.34,
      "dx": 0.005,
      "dy": 0.38
    }
  },
  "gravitos2": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.03
    },
    "walk": {
      "s": 1.07,
      "dx": -0.0318,
      "dy": 0.0355
    },
    "attack": {
      "s": 1.35,
      "dx": -0.03,
      "dy": 0.035
    }
  },
  "gravitos3star": {
    "walk": {
      "s": 1.23,
      "dx": 0,
      "dy": 0.015
    },
    "attack": {
      "s": 2.48,
      "dx": 0.005,
      "dy": 0.38
    }
  },
  "gravitos3": {
    "walk": {
      "s": 1.23,
      "dx": 0,
      "dy": 0.025
    },
    "attack": {
      "s": 1.43,
      "dx": 0,
      "dy": 0.01
    }
  },
  "gravitos": {
    "walk": {
      "s": 1.1,
      "dx": 0,
      "dy": 0
    },
    "attack": {
      "s": 1.37,
      "dx": 0,
      "dy": 0
    }
  },
  "king": {
    "attack": {
      "s": 1.36,
      "dx": 0,
      "dy": 0
    }
  },
  "koopaKing": {
    "walk": {
      "s": 0.94,
      "dx": 0,
      "dy": 0
    },
    "attack": {
      "s": 1.11,
      "dx": 0,
      "dy": 0
    }
  },
  "mushmom": {
    "walk": {
      "s": 1.07,
      "dx": -0.045,
      "dy": 0
    },
    "attack": {
      "s": 1.35,
      "dx": 0.07,
      "dy": 0
    }
  },
  "octobaby": {
    "walk": {
      "s": 1.09,
      "dx": 0,
      "dy": 0
    },
    "attack": {
      "s": 1.26,
      "dx": 0,
      "dy": 0
    }
  },
  "pqConductor": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.01
    },
    "walk": {
      "s": 1.03,
      "dx": 0,
      "dy": 0.02
    },
    "attack": {
      "s": 1.42,
      "dx": 0.115,
      "dy": 0.005
    }
  },
  "sundered_smith": {
    "walk": {
      "s": 1.16,
      "dx": 0,
      "dy": 0
    },
    "attack": {
      "s": 1.51,
      "dx": 0,
      "dy": 0
    }
  },
  "towerArbiter": {
    "idle": {
      "s": 1,
      "dx": 0.085,
      "dy": 0.02
    },
    "walk": {
      "s": 1,
      "dx": 0.07,
      "dy": 0.02
    },
    "attack": {
      "s": 1.78,
      "dx": 0.085,
      "dy": 0.03
    }
  },
  "towerSovereign": {
    "idle": {
      "s": 1,
      "dx": 0.035,
      "dy": 0.01
    },
    "walk": {
      "s": 1,
      "dx": -0.04,
      "dy": 0.01
    },
    "attack": {
      "s": 1.3,
      "dx": -0.045,
      "dy": 0.01
    }
  },
  "young_confused_barnaby": {
    "walk": {
      "s": 1.04,
      "dx": 0,
      "dy": 0
    },
    "attack": {
      "s": 1.35,
      "dx": 0,
      "dy": 0
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
      "w": 0.4409,
      "h": 0.6227,
      "ox": 0,
      "oy": 0.0227
    },
    "walk": {
      "w": 0.55,
      "h": 0.6,
      "ox": 0,
      "oy": 0
    },
    "attack": {
      "w": 0.3955,
      "h": 0.55,
      "ox": 0.05,
      "oy": -0.0045
    }
  },
  "blockRexy": {
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
  "gravitos2star": {
    "idle": {
      "w": 0.6236,
      "h": 0.6682,
      "ox": 0.0182,
      "oy": -0.05
    },
    "walk": {
      "w": 0.66,
      "h": 0.6591,
      "ox": 0.0136,
      "oy": -0.0409
    },
    "attack": {
      "w": 0.6418,
      "h": 0.8,
      "ox": 0.0318,
      "oy": 0.0409
    }
  },
  "gravitos2": {
    "idle": {
      "w": 0.4964,
      "h": 0.7545,
      "ox": 0.0364,
      "oy": -0.0136
    },
    "walk": {
      "w": 0.5509,
      "h": 0.7227,
      "ox": 0.0091,
      "oy": -0.0045
    },
    "attack": {
      "w": 0.5418,
      "h": 0.7636,
      "ox": 0.0318,
      "oy": -0.0136
    }
  },
  "gravitos3star": {
    "idle": {
      "w": 0.8182,
      "h": 0.6,
      "ox": 0,
      "oy": -0.0227
    },
    "walk": {
      "w": 0.8182,
      "h": 0.6,
      "ox": 0.0136,
      "oy": -0.0545
    },
    "attack": {
      "w": 0.8455,
      "h": 0.8045,
      "ox": 0.0455,
      "oy": 0.0409
    }
  },
  "gravitos3": {
    "idle": {
      "w": 0.8182,
      "h": 0.6,
      "ox": 0.0318,
      "oy": -0.0773
    },
    "walk": {
      "w": 0.7727,
      "h": 0.6318,
      "ox": 0.0182,
      "oy": -0.0591
    },
    "attack": {
      "w": 0.6546,
      "h": 0.7,
      "ox": 0.0273,
      "oy": -0.0318
    }
  },
  "gravitos": {
    "idle": {
      "w": 0.5327,
      "h": 0.6591,
      "ox": 0,
      "oy": 0.0045
    },
    "walk": {
      "w": 0.4691,
      "h": 0.6818,
      "ox": 0.0136,
      "oy": 0.0136
    },
    "attack": {
      "w": 0.4509,
      "h": 0.7273,
      "ox": -0.0091,
      "oy": 0.0136
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
  "koopaKing": {
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
  "mushmom": {
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
