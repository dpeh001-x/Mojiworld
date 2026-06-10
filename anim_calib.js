// Baked per-(monster/boss, state) animation calibration.
// Authored with monster_animator.html. Game merges: localStorage > this file > {s:1,dx:0,dy:0}.
// s = size multiplier · dx/dy = nudge as a FRACTION of rendered sprite height (+dy = down).
window.LX_ANIM_CALIB = {
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
      "s": 1.66,
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
      "dx": 0,
      "dy": 0.04
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
      "dx": 0.03,
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
    "walk": {
      "s": 1.03,
      "dx": 0,
      "dy": 0
    },
    "attack": {
      "s": 1.42,
      "dx": 0,
      "dy": 0
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
      "dx": 0,
      "dy": 0.02
    },
    "walk": {
      "s": 1,
      "dx": 0,
      "dy": 0.02
    },
    "attack": {
      "s": 1.78,
      "dx": 0,
      "dy": 0.03
    }
  },
  "towerSovereign": {
    "idle": {
      "s": 1,
      "dx": 0,
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
// Per-(type, state) ATTACK-HITBOX overrides (_atkMonBox), authored in
// monster_animator.html's hitbox editor. w/h = box size, ox = center x-offset,
// oy = bottom offset from the foot line (+down) - fractions of rendered sprite
// height. Empty = every entity keeps the game's default fraction box.
window.LX_ATK_HITBOX = {};
