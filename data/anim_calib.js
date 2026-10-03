// Baked per-(monster/boss, state) animation calibration + attack hitboxes.
// Authored with monster_animator.html. Game merges: localStorage > this file > defaults.
// CALIB: s = size multiplier; dx/dy = nudge as a FRACTION of rendered sprite height (+dy = down).
// HITBOX (_atkMonBox override): w/h = box size, ox = center x-offset, oy = bottom
// offset from the foot line (+down) — all fractions of rendered sprite height.
// Missing entries keep the game defaults.
window.LX_ANIM_CALIB = {
  "deranged_kuro": {
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.1,
      "ft": [
        86,
        72,
        72,
        108,
        149,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "goblinMauler": {
    "attack": {
      "s": 1.05,
      "dx": 0,
      "dy": 0.075,
      "ft": [
        86,
        72,
        72,
        72,
        108,
        176,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "grumpsquid": {
    "walk": {
      "s": 1,
      "dx": 0,
      "dy": 0.015
    },
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        130,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "meloncholy": {
    "attack": {
      "ft": [
        86,
        72,
        108,
        135,
        108,
        72,
        72,
        72,
        115
      ],
      "ftAuto": true
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
      "dy": 0.015,
      "ft": [
        86,
        72,
        72,
        108,
        140,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "mournshade": {
    "attack": {
      "ft": [
        86,
        72,
        108,
        143,
        108,
        72,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "octoLegFreeze": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.01
    },
    "walk": {
      "s": 1,
      "dx": 0,
      "dy": 0.01
    },
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.01,
      "ft": [
        86,
        72,
        72,
        72,
        72,
        108,
        152,
        108,
        115
      ],
      "ftAuto": true
    }
  },
  "octoLegPoison": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.01
    },
    "walk": {
      "s": 1,
      "dx": 0,
      "dy": 0.01
    },
    "attack": {
      "s": 1,
      "dx": 0.03,
      "dy": 0.01,
      "ft": [
        86,
        72,
        72,
        72,
        72,
        72,
        108,
        165,
        115
      ],
      "ftAuto": true
    }
  },
  "octoLegSkillLock": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.01
    },
    "walk": {
      "s": 1,
      "dx": 0.03,
      "dy": 0.01
    },
    "attack": {
      "s": 1,
      "dx": 0.03,
      "dy": 0.01,
      "ft": [
        86,
        72,
        72,
        72,
        108,
        165,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "octoLegStun": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.01
    },
    "walk": {
      "s": 1,
      "dx": 0,
      "dy": 0.01
    },
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.01,
      "ft": [
        86,
        72,
        72,
        108,
        142,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "orange": {
    "attack": {
      "ft": [
        86,
        72,
        108,
        138,
        108,
        72,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "pinechad": {
    "attack": {
      "ft": [
        86,
        72,
        108,
        130,
        108,
        72,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "aetherion2": {
    "idle": {
      "s": 0.87,
      "dx": -0.0623,
      "dy": 0.0092
    },
    "walk": {
      "s": 0.87,
      "dx": -0.0548,
      "dy": 0.0092
    },
    "attack": {
      "s": 1.1415,
      "dx": -0.0114,
      "dy": 0.0059,
      "ft": [
        72,
        60,
        60,
        90,
        132,
        90,
        60,
        60,
        96
      ],
      "ftAuto": true
    }
  },
  "aetherion": {
    "idle": {
      "s": 1.58,
      "dx": -0.1388,
      "dy": 0.168
    },
    "walk": {
      "s": 1.0457,
      "dx": -0.13,
      "dy": 0.02
    },
    "attack": {
      "s": 1.6,
      "dx": -0.0535,
      "dy": -0.01,
      "ft": [
        72,
        60,
        60,
        90,
        132,
        90,
        60,
        60,
        96
      ],
      "ftAuto": true
    }
  },
  "gravitos2": {
    "idle": {
      "s": 1.04,
      "dx": 0,
      "dy": 0.0216
    },
    "walk": {
      "s": 1.04,
      "dx": 0,
      "dy": 0.0216
    },
    "attack": {
      "s": 1.04,
      "dx": 0,
      "dy": 0.0216,
      "ft": [
        72,
        60,
        60,
        60,
        60,
        90,
        132,
        90,
        96
      ],
      "ftAuto": true
    }
  },
  "gravitos2star": {
    "idle": {
      "s": 1.04,
      "dx": 0,
      "dy": 0.0216
    },
    "walk": {
      "s": 1.04,
      "dx": 0,
      "dy": 0.0216
    },
    "attack": {
      "s": 0.965,
      "dx": 0,
      "dy": 0.1144,
      "ft": [
        110,
        110,
        120,
        140,
        170,
        170,
        140,
        120,
        110
      ]
    }
  },
  "gravitos3": {
    "idle": {
      "s": 1.04,
      "dx": 0,
      "dy": 0.0129
    },
    "walk": {
      "s": 1.04,
      "dx": 0,
      "dy": 0.0129
    },
    "attack": {
      "s": 1.04,
      "dx": 0,
      "dy": 0.0129,
      "ft": [
        72,
        60,
        60,
        60,
        90,
        132,
        90,
        60,
        96
      ],
      "ftAuto": true
    }
  },
  "gravitos3star": {
    "idle": {
      "s": 1.04,
      "dx": 0,
      "dy": 0.0129
    },
    "walk": {
      "s": 1.04,
      "dx": 0,
      "dy": 0.0129
    },
    "attack": {
      "s": 1.3,
      "dx": 0,
      "dy": 0.0163,
      "ft": [
        110,
        110,
        120,
        140,
        170,
        170,
        140,
        120,
        110
      ]
    }
  },
  "gravitos": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.007
    },
    "walk": {
      "s": 1,
      "dx": 0,
      "dy": 0.007
    },
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.007,
      "ft": [
        72,
        60,
        101,
        126,
        171,
        136,
        90,
        66,
        91
      ]
    }
  },
  "legosaurus": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.033
    },
    "walk": {
      "s": 0.949,
      "dx": 0,
      "dy": 0.023
    },
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.028,
      "ft": [
        70,
        70,
        75,
        85,
        100,
        115,
        100,
        85,
        75
      ]
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
      "dy": 0.01,
      "ft": [
        72,
        60,
        60,
        60,
        90,
        132,
        90,
        60,
        96
      ],
      "ftAuto": true
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
      "dy": 0.01,
      "ft": [
        72,
        60,
        60,
        60,
        60,
        90,
        132,
        90,
        96
      ],
      "ftAuto": true
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
      "dy": 0,
      "ft": [
        72,
        60,
        60,
        60,
        90,
        132,
        90,
        60,
        96
      ],
      "ftAuto": true
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
      "dy": 0.01,
      "ft": [
        72,
        60,
        60,
        60,
        60,
        90,
        132,
        90,
        96
      ],
      "ftAuto": true
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
      "s": 0.84,
      "dx": 0,
      "dy": 0.015,
      "ft": [
        72,
        60,
        60,
        60,
        60,
        90,
        132,
        90,
        96
      ],
      "ftAuto": true
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
      "s": 1,
      "dx": 0,
      "dy": 0.007,
      "ft": [
        55,
        55,
        75,
        75,
        30,
        30,
        115,
        115,
        103,
        102,
        70,
        70,
        55,
        55,
        95,
        600
      ]
    }
  },
  "kingKrook": {
    "idle": {
      "s": 1.6,
      "dx": 0,
      "dy": 0.03
    },
    "walk": {
      "s": 1.6,
      "dx": 0,
      "dy": 0.03
    },
    "attack": {
      "s": 1.6,
      "dx": 0,
      "dy": 0.028,
      "ft": [
        72,
        60,
        60,
        90,
        132,
        90,
        60,
        60,
        96
      ],
      "ftAuto": true
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
      "dy": 0.005,
      "ft": [
        72,
        81,
        116,
        151,
        156,
        111,
        96,
        91,
        96
      ]
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
      "dy": 0,
      "ft": [
        72,
        60,
        60,
        60,
        60,
        90,
        132,
        90,
        96
      ],
      "ftAuto": true
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
      "dy": 0,
      "ft": [
        86,
        72,
        72,
        108,
        151,
        108,
        115
      ]
    }
  },
  "king": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0,
      "ft": [
        112,
        92,
        76,
        68,
        68,
        76,
        92,
        112,
        132
      ]
    },
    "walk": {
      "s": 1,
      "dx": 0,
      "dy": 0,
      "ft": [
        84,
        72,
        62,
        58,
        58,
        62,
        72,
        84,
        96
      ]
    },
    "attack": {
      "s": 1.3152,
      "dx": 0,
      "dy": 0,
      "ft": [
        72,
        60,
        90,
        132,
        90,
        60,
        60,
        60,
        96
      ],
      "ftAuto": true
    }
  },
  "zodiac_capricorn": {
    "zodiac/idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.0682
    },
    "zodiac/walk": {
      "s": 1,
      "dx": 0,
      "dy": 0.0682
    },
    "zodiac/attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.0682
    },
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.06,
      "ft": [
        72,
        60,
        60,
        90,
        132,
        90,
        60,
        60,
        96
      ],
      "ftAuto": true
    },
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.06
    },
    "walk": {
      "s": 1,
      "dx": 0,
      "dy": 0.06
    }
  },
  "gravitos3laser": {
    "attack": {
      "s": 1.04,
      "dx": 0,
      "dy": 0.0129,
      "ft": [
        72,
        60,
        60,
        90,
        132,
        90,
        60,
        60,
        96
      ],
      "ftAuto": true
    }
  },
  "gravitos3punch": {
    "attack": {
      "s": 1.04,
      "dx": 0,
      "dy": 0.0129,
      "ft": [
        76,
        66,
        66,
        61,
        116,
        101,
        146,
        121,
        91
      ]
    }
  },
  "gravitos3soul": {
    "attack": {
      "s": 1.04,
      "dx": 0,
      "dy": 0.0129,
      "ft": [
        86,
        81,
        76,
        61,
        91,
        106,
        126,
        81,
        96
      ]
    }
  },
  "legosaurusdash": {
    "attack": {
      "s": 1,
      "dx": 0.0249,
      "dy": 0.025,
      "ft": [
        700,
        150,
        64,
        64,
        64,
        64,
        64,
        30,
        30
      ]
    }
  },
  "gravitos2laser": {
    "attack": {
      "s": 1.04,
      "dx": 0,
      "dy": 0.0216,
      "ft": [
        72,
        60,
        60,
        81,
        151,
        96,
        60,
        51,
        56
      ]
    }
  },
  "gravitos2punch": {
    "attack": {
      "s": 1.04,
      "dx": 0,
      "dy": 0.0216,
      "ft": [
        72,
        60,
        60,
        90,
        132,
        90,
        60,
        60,
        96
      ],
      "ftAuto": true
    }
  },
  "gravitos2soul": {
    "attack": {
      "s": 1.04,
      "dx": 0,
      "dy": 0.0216,
      "ft": [
        72,
        60,
        60,
        90,
        132,
        90,
        60,
        60,
        96
      ],
      "ftAuto": true
    }
  },
  "towerSovereignswing": {
    "attack": {
      "s": 1,
      "dx": -0.0469,
      "dy": 0.02,
      "ft": [
        72,
        60,
        60,
        60,
        90,
        132,
        90,
        60,
        96
      ],
      "ftAuto": true
    }
  },
  "towerSovereigncolumn": {
    "attack": {
      "s": 1,
      "dx": -0.0427,
      "dy": 0.015,
      "ft": [
        72,
        90,
        132,
        90,
        60,
        60,
        60,
        60,
        96
      ],
      "ftAuto": true
    }
  },
  "towerSovereigncollapse": {
    "attack": {
      "s": 1,
      "dx": -0.0396,
      "dy": 0,
      "ft": [
        72,
        60,
        60,
        90,
        132,
        90,
        60,
        60,
        96
      ],
      "ftAuto": true
    }
  },
  "towerSovereignvolley": {
    "attack": {
      "s": 1,
      "dx": -0.0552,
      "dy": 0.015,
      "ft": [
        72,
        60,
        60,
        60,
        60,
        90,
        132,
        90,
        96
      ],
      "ftAuto": true
    }
  },
  "towerSovereigndrain": {
    "attack": {
      "s": 1.0109,
      "dx": -0.0458,
      "dy": 0.06,
      "ft": [
        72,
        60,
        60,
        60,
        90,
        132,
        90,
        60,
        96
      ],
      "ftAuto": true
    }
  },
  "kingKrookstomp": {
    "attack": {
      "s": 1.6,
      "dx": 0,
      "dy": 0,
      "ft": [
        72,
        60,
        60,
        60,
        60,
        90,
        132,
        90,
        96
      ],
      "ftAuto": true
    }
  },
  "zodiac_virgo": {
    "zodiac/idle": {
      "s": 1.246,
      "dx": 0,
      "dy": 0.019,
      "fs": [
        1.086,
        1.086,
        1.086,
        1.086,
        1.086,
        1.086,
        1.086,
        1.086,
        1.086
      ]
    },
    "zodiac/walk": {
      "s": 1.246,
      "dx": 0,
      "dy": 0.016,
      "fs": [
        1.055,
        1.055,
        1.055,
        1.055,
        1.055,
        1.055,
        1.055,
        1.055,
        1.055
      ]
    },
    "zodiac/attack": {
      "s": 1.246,
      "dx": 0,
      "dy": 0
    },
    "zodiac/fly": {
      "s": 1.14,
      "dx": 0,
      "dy": -0.062,
      "fs": [
        1.101,
        1.101,
        1.101,
        1.101,
        1.101,
        1.101,
        1.101,
        1.101,
        1.101
      ]
    },
    "attack": {
      "ft": [
        72,
        60,
        60,
        90,
        132,
        90,
        60,
        60,
        96
      ],
      "ftAuto": true
    }
  },
  "zodiac_taurus": {
    "zodiac/idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.009
    },
    "zodiac/walk": {
      "s": 1,
      "dx": 0,
      "dy": 0.009
    },
    "zodiac/attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.009
    },
    "zodiac/charge": {
      "s": 1.13,
      "dx": 0,
      "dy": 0.035
    },
    "attack": {
      "ft": [
        72,
        60,
        60,
        90,
        132,
        90,
        60,
        60,
        96
      ],
      "ftAuto": true
    }
  },
  "aetherion2lance": {
    "attack": {
      "s": 0.87,
      "dx": -0.0605,
      "dy": 0.0092,
      "ft": [
        72,
        72,
        72,
        72,
        72,
        72,
        72,
        72,
        72,
        37,
        37,
        37,
        37,
        37,
        37,
        37
      ]
    }
  },
  "aetherion2fracture": {
    "attack": {
      "s": 0.87,
      "dx": -0.0605,
      "dy": 0.0092,
      "ft": [
        83,
        83,
        83,
        83,
        83,
        83,
        52,
        52,
        52,
        52,
        52,
        52,
        52,
        52,
        52,
        52
      ]
    }
  },
  "aetherion2astral": {
    "attack": {
      "s": 0.87,
      "dx": -0.0604,
      "dy": 0.0092,
      "ft": [
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        100,
        47,
        47,
        47,
        47,
        47,
        47,
        47,
        47,
        47
      ]
    }
  },
  "aetherionastral": {
    "attack": {
      "s": 1.24,
      "dx": -0.108,
      "dy": -0.005,
      "ft": [
        110,
        110,
        120,
        140,
        170,
        170,
        140,
        120,
        110
      ]
    }
  },
  "zodiac_leo": {
    "zodiac/pounce": {
      "s": 1.4,
      "dx": 0.06,
      "dy": 0.29
    },
    "attack": {
      "ft": [
        72,
        60,
        60,
        90,
        132,
        90,
        60,
        60,
        96
      ],
      "ftAuto": true
    }
  },
  "gravitossoul": {
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.007,
      "ft": [
        110,
        110,
        120,
        140,
        170,
        170,
        140,
        120,
        110
      ]
    }
  },
  "gravitoslaser": {
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.007,
      "ft": [
        110,
        110,
        120,
        140,
        170,
        170,
        140,
        120,
        110
      ]
    }
  },
  "zodiac_aquarius": {
    "zodiac/idle": {
      "s": 1.279,
      "dx": 0,
      "dy": 0
    },
    "zodiac/walk": {
      "s": 1.279,
      "dx": 0,
      "dy": 0
    },
    "zodiac/attack": {
      "s": 1.279,
      "dx": 0,
      "dy": 0
    },
    "attack": {
      "ft": [
        72,
        60,
        60,
        60,
        60,
        90,
        132,
        90,
        96
      ],
      "ftAuto": true
    }
  },
  "zodiac_aries": {
    "zodiac/idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.013
    },
    "zodiac/walk": {
      "s": 1,
      "dx": 0,
      "dy": 0.013
    },
    "zodiac/attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.013
    },
    "attack": {
      "ft": [
        72,
        60,
        60,
        90,
        132,
        90,
        60,
        60,
        96
      ],
      "ftAuto": true
    }
  },
  "zodiac_cancer": {
    "zodiac/idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.029
    },
    "zodiac/walk": {
      "s": 1,
      "dx": 0,
      "dy": 0.029
    },
    "zodiac/attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.029
    },
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0,
      "ft": [
        72,
        60,
        60,
        60,
        60,
        90,
        132,
        90,
        96
      ]
    }
  },
  "zodiac_gemini": {
    "attack": {
      "ft": [
        72,
        60,
        60,
        90,
        132,
        90,
        60,
        60,
        96
      ],
      "ftAuto": true
    }
  },
  "zodiac_libra": {
    "attack": {
      "ft": [
        72,
        60,
        60,
        60,
        60,
        90,
        132,
        90,
        96
      ],
      "ftAuto": true
    }
  },
  "zodiac_pisces": {
    "zodiac/idle": {
      "s": 1.05,
      "dx": 0,
      "dy": 0
    },
    "zodiac/walk": {
      "s": 1.05,
      "dx": 0,
      "dy": 0
    },
    "zodiac/attack": {
      "s": 1.05,
      "dx": 0,
      "dy": 0
    },
    "attack": {
      "ft": [
        72,
        60,
        60,
        90,
        132,
        90,
        60,
        60,
        96
      ],
      "ftAuto": true
    }
  },
  "zodiac_sagittarius": {
    "zodiac/idle": {
      "s": 1.092,
      "dx": 0,
      "dy": 0.027
    },
    "zodiac/walk": {
      "s": 1.092,
      "dx": 0,
      "dy": 0.027
    },
    "zodiac/attack": {
      "s": 1.092,
      "dx": 0,
      "dy": 0.027
    },
    "attack": {
      "ft": [
        72,
        60,
        60,
        60,
        60,
        90,
        132,
        90,
        96
      ],
      "ftAuto": true
    }
  },
  "zodiac_scorpio": {
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0.125,
      "ft": [
        72,
        60,
        60,
        60,
        60,
        90,
        132,
        90,
        96
      ],
      "ftAuto": true
    },
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.125
    },
    "walk": {
      "s": 1,
      "dx": 0,
      "dy": 0.125
    }
  },
  "anglerfish": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        140,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "archon": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        130,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "axolotl": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        157,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "bellowsbat": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        174,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "blightElder": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        179,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "blockEle": {
    "attack": {
      "ft": [
        86,
        72,
        108,
        170,
        108,
        72,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "blockGary": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        163,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "blockHupo": {
    "attack": {
      "ft": [
        86,
        72,
        108,
        135,
        108,
        72,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "blockPopo": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        177,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "blockRhirhi": {
    "attack": {
      "ft": [
        86,
        72,
        108,
        176,
        108,
        72,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "blockTigreal": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        130,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "boneGolem": {
    "attack": {
      "ft": [
        86,
        72,
        108,
        148,
        108,
        72,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "boneWraith": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        130,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "bonebosn": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        130,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "brinekraken": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        137,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "cherub": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        141,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "cinderling": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        72,
        108,
        149,
        108,
        115
      ],
      "ftAuto": true
    }
  },
  "cloudbun": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        146,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "clownfish": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        154,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "conductorMech": {
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0,
      "ft": [
        86,
        72,
        72,
        72,
        72,
        108,
        172,
        108,
        115
      ]
    }
  },
  "cookie": {
    "attack": {
      "ft": [
        86,
        72,
        108,
        143,
        108,
        72,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "coralImp": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        135,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "cosmicMochi": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        151,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "drownedCur": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        150,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "echoKnight": {
    "idle": {
      "s": 1,
      "dx": 0,
      "dy": 0.005
    },
    "walk": {
      "s": 1,
      "dx": 0,
      "dy": -0.005
    },
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0,
      "ft": [
        86,
        72,
        72,
        108,
        155,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "elderbark": {
    "attack": {
      "ft": [
        86,
        72,
        108,
        138,
        108,
        72,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "emberling": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        142,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "expressTicketMech": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        72,
        108,
        176,
        108,
        115
      ],
      "ftAuto": true
    }
  },
  "fatDragon": {
    "attack": {
      "ft": [
        115,
        96,
        96,
        96,
        96,
        144,
        191,
        144,
        154
      ],
      "ftAuto": true
    }
  },
  "fatLizard": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        130,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "frog": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        172,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "frostkin": {
    "attack": {
      "ft": [
        86,
        72,
        108,
        166,
        108,
        72,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "glasswindHare": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        144,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "goblinScout": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        144,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "graveReaver": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        146,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "gummy": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        164,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "honeyBuzz": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        72,
        108,
        153,
        108,
        115
      ],
      "ftAuto": true
    }
  },
  "horny": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        159,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "jellyfish": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        154,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "lanternWisp": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        143,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "lichkin": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        141,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "mayo": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        147,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "mummy": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        72,
        72,
        108,
        148,
        115
      ],
      "ftAuto": true
    }
  },
  "mushpup": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        72,
        108,
        149,
        108,
        115
      ],
      "ftAuto": true
    }
  },
  "mushroom": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        72,
        108,
        163,
        108,
        115
      ],
      "ftAuto": true
    }
  },
  "nimbusFox": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        72,
        108,
        170,
        108,
        115
      ],
      "ftAuto": true
    }
  },
  "nougatBear": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        72,
        108,
        157,
        108,
        115
      ],
      "ftAuto": true
    }
  },
  "ossuaryTyrant": {
    "attack": {
      "ft": [
        86,
        72,
        108,
        152,
        108,
        72,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "pathsBane": {
    "walk": {
      "s": 1,
      "dx": 0,
      "dy": -0.005
    },
    "attack": {
      "s": 1,
      "dx": 0,
      "dy": 0,
      "ft": [
        86,
        72,
        72,
        108,
        179,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "pearlSprite": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        164,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "petalfly": {
    "attack": {
      "ft": [
        86,
        72,
        108,
        158,
        108,
        72,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "pufferfish": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        146,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "razorgale": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        161,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "sandhusk": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        153,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "scorpion": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        153,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "seahorse": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        136,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "seasponge": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        143,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "seastar": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        130,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "sepulchreHound": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        175,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "seraph": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        140,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "shardlich": {
    "idle": {
      "s": 0.7,
      "dx": 0,
      "dy": -0.01
    },
    "walk": {
      "s": 0.7,
      "dx": 0,
      "dy": -0.02
    },
    "attack": {
      "s": 0.74,
      "dx": 0,
      "dy": 0,
      "ft": [
        86,
        72,
        72,
        72,
        108,
        170,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "skeleton": {
    "attack": {
      "ft": [
        86,
        72,
        108,
        139,
        108,
        72,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "skywisp": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        72,
        108,
        181,
        108,
        115
      ],
      "ftAuto": true
    }
  },
  "slime": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        154,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "smithgolem": {
    "idle": {
      "s": 1.414,
      "dx": 0,
      "dy": 0
    },
    "walk": {
      "s": 1.414,
      "dx": 0,
      "dy": 0
    },
    "attack": {
      "s": 1.414,
      "dx": 0,
      "dy": 0,
      "ft": [
        86,
        72,
        72,
        108,
        149,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "snail": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        200,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "sparkSprite": {
    "attack": {
      "ft": [
        86,
        72,
        108,
        179,
        108,
        72,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "sparkling": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        154,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "spectreCannoneer": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        149,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "sproutle": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        72,
        108,
        158,
        108,
        115
      ],
      "ftAuto": true
    }
  },
  "stoneling": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        184,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "stormKitty": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        148,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "stump": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        130,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "thornmaw": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        140,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "thunderMole": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        142,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "ticketMech": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        130,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "tidefish": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        164,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "tideling": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        72,
        108,
        195,
        108,
        115
      ],
      "ftAuto": true
    }
  },
  "tidepoolTurtle": {
    "attack": {
      "ft": [
        86,
        72,
        108,
        147,
        108,
        72,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "tombKeeper": {
    "idle": {
      "s": 1.56,
      "dx": 0,
      "dy": 0
    },
    "walk": {
      "s": 1.56,
      "dx": 0,
      "dy": 0
    },
    "attack": {
      "s": 2.05,
      "dx": 0,
      "dy": 0,
      "ft": [
        86,
        72,
        72,
        72,
        108,
        145,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "tombWraith": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        148,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "towerHexer": {
    "attack": {
      "ft": [
        86,
        72,
        108,
        130,
        108,
        72,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "towerOssifer": {
    "attack": {
      "ft": [
        86,
        72,
        108,
        163,
        108,
        72,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "towerSeer": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        144,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "towerShardling": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        141,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "towerStalker": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        130,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "towerStormcaller": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        72,
        108,
        158,
        108,
        115
      ],
      "ftAuto": true
    }
  },
  "towerWarden": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        152,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "towerWisp": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        182,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "vigil_vermillion": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        72,
        108,
        141,
        108,
        115
      ],
      "ftAuto": true
    }
  },
  "voltipup": {
    "attack": {
      "ft": [
        86,
        72,
        108,
        144,
        108,
        72,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "willeo": {
    "attack": {
      "ft": [
        86,
        72,
        108,
        150,
        108,
        72,
        72,
        72,
        115
      ]
    }
  },
  "wraith": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        72,
        108,
        151,
        108,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "young_bloodthirsty_vermillion": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        130,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "zombie": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        139,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "sovCrownShard": {
    "idle": {
      "s": 2,
      "dx": 0,
      "dy": 0
    }
  },
  "towerArbiterverdict": {
    "attack": {
      "s": 2.18,
      "dx": 0.155,
      "dy": 0,
      "ft": [
        80,
        90,
        100,
        110,
        130,
        150,
        120,
        110,
        110
      ]
    }
  },
  "towerArbitercolumn": {
    "attack": {
      "s": 2.1,
      "dx": 0.14,
      "dy": 0.005,
      "ft": [
        100,
        110,
        120,
        130,
        160,
        140,
        120,
        110,
        110
      ]
    }
  },
  "scaleLanternA": {
    "attack": {
      "ft": [
        86,
        72,
        108,
        151,
        108,
        72,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "scaleLanternB": {
    "attack": {
      "ft": [
        86,
        72,
        108,
        152,
        108,
        72,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "scaleStormcaller": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        130,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "harea": {
    "attack": {
      "ft": [
        86,
        72,
        108,
        154,
        108,
        72,
        72,
        72,
        115
      ]
    }
  },
  "lady_honk": {
    "attack": {
      "ft": [
        86,
        72,
        72,
        108,
        138,
        108,
        72,
        72,
        115
      ],
      "ftAuto": true
    }
  },
  "taiger": {
    "attack": {
      "ft": [
        86,
        108,
        154,
        108,
        72,
        72,
        72,
        72,
        115
      ]
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
      "w": 0.6705,
      "h": 0.6,
      "ox": 0,
      "oy": 0
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
      "w": 0.4413,
      "h": 0.6708,
      "ox": 0.035,
      "oy": 0.0186
    },
    "walk": {
      "w": 0.5297,
      "h": 0.6949,
      "ox": 0.0104,
      "oy": 0.0189
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
      "w": 0.5996,
      "h": 0.6425,
      "ox": 0.0091,
      "oy": 0.0102
    },
    "walk": {
      "w": 0.6102,
      "h": 0.6093,
      "ox": 0.0263,
      "oy": 0.0056
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
      "w": 0.9436,
      "h": 0.7715,
      "ox": 0.0454,
      "oy": 0.0123
    },
    "attack": {
      "w": 0.705,
      "h": 0.7538,
      "ox": 0.0294,
      "oy": 0.0104
    }
  },
  "gravitos3star": {
    "idle": {
      "w": 0.7867,
      "h": 0.5769,
      "ox": -0.0333,
      "oy": 0.0164
    },
    "walk": {
      "w": 0.9677,
      "h": 0.7096,
      "ox": 0.1245,
      "oy": 0.0154
    },
    "attack": {
      "w": 1.0536,
      "h": 1.0025,
      "ox": 0.0718,
      "oy": 0.0359
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
      "w": 0.4123,
      "h": 0.5992,
      "ox": -0.0109,
      "oy": 0.0176
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
      "w": 1.088,
      "h": 0.6955,
      "ox": -0.0567,
      "oy": 0.0091
    },
    "walk": {
      "w": 1.008,
      "h": 0.6727,
      "ox": 0.0177,
      "oy": 0.0045
    },
    "attack": {
      "w": 1.374,
      "h": 0.6682,
      "ox": 0.0238,
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
  },
  "zodiac_scorpio": {
    "idle": {
      "w": 0.93,
      "h": 1.02,
      "ox": -0.029,
      "oy": 0.288
    },
    "walk": {
      "w": 0.96,
      "h": 1.02,
      "ox": -0.006,
      "oy": 0.288
    },
    "attack": {
      "w": 0.96,
      "h": 1.02,
      "ox": -0.006,
      "oy": 0.289
    }
  },
  "zodiac_sagittarius": {
    "idle": {
      "w": 0.5495,
      "h": 0.5495,
      "ox": 0,
      "oy": 0
    },
    "walk": {
      "w": 0.5495,
      "h": 0.5495,
      "ox": 0,
      "oy": 0
    },
    "attack": {
      "w": 0.5495,
      "h": 0.5495,
      "ox": 0,
      "oy": 0
    }
  },
  "zodiac_pisces": {
    "idle": {
      "w": 0.5714,
      "h": 0.5714,
      "ox": 0,
      "oy": 0
    },
    "walk": {
      "w": 0.5714,
      "h": 0.5714,
      "ox": 0,
      "oy": 0
    },
    "attack": {
      "w": 0.5714,
      "h": 0.5714,
      "ox": 0,
      "oy": 0
    }
  },
  "zodiac_aquarius": {
    "idle": {
      "w": 0.4691,
      "h": 0.4691,
      "ox": 0,
      "oy": 0
    },
    "walk": {
      "w": 0.4691,
      "h": 0.4691,
      "ox": 0,
      "oy": 0
    },
    "attack": {
      "w": 0.4691,
      "h": 0.4691,
      "ox": 0,
      "oy": 0
    }
  },
  "zodiac_virgo": {
    "idle": {
      "w": 0.5273,
      "h": 0.5273,
      "ox": 0,
      "oy": 0
    },
    "walk": {
      "w": 0.5273,
      "h": 0.5273,
      "ox": 0,
      "oy": 0
    },
    "attack": {
      "w": 0.5273,
      "h": 0.5273,
      "ox": 0,
      "oy": 0
    }
  },
  "gravitospunch": {
    "attack": {
      "w": 0.6668,
      "h": 0.606,
      "ox": 0,
      "oy": 0
    }
  },
  "gravitos2punch": {
    "attack": {
      "w": 0.7808,
      "h": 0.6813,
      "ox": 0,
      "oy": 0
    }
  },
  "gravitos2soul": {
    "attack": {
      "w": 0.6612,
      "h": 0.5769,
      "ox": 0,
      "oy": 0
    }
  },
  "gravitos2laser": {
    "attack": {
      "w": 0.6612,
      "h": 0.5769,
      "ox": 0,
      "oy": 0
    }
  }
};
