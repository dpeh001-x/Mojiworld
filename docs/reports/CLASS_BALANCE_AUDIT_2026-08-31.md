# Master-tier class balance audit — 2026-08-31 (v0.30.328)

Per user: *"necromancer class is too overpowered, do an extensive audit on the
different classes and suggest the list of skills to nerf."*

## Method

`scripts/class_master_audit.mjs` — every master line (enumerated at runtime
from `MASTERS`/`JOBS`), Lv 60, `getAtk`/`getDef`/`getMaxHp` solved to identical
values (ATK 300 / DEF 80 / HP 6000), rank-0 skills, no gear/boons, full kit
cast off cooldown for 35 s against normalised training dummies. One fresh page
per line; cross-class warm-up; damage read off dummy HP pools outside the
`hitMonster` hook; DPS per game-second; combo pinned. Two scenarios:
single target, and an 8-pack crowd.

Harness discovery worth recording: `applyJob`/`applyMaster` fire advancement
story beats that **pause the game**, and `castSkill` does not check pause — so
melee skills keep landing while the entire projectile/hazard sim is frozen.
Until the harness dismissed the beats, every projectile line and the
necromancer vortex measured near zero. This retroactively explains the
"first class in a page cannot fire projectiles" anomaly recorded in
`class_damage_dummy_test.mjs`.

## Ranking — single target (equal stats)

| # | master | line | DPS | vs median |
|---|--------|------|-----|-----------|
| 1 | **doombringer** | warrior→berserker | **7,529** | **2.45×** |
| 2 | **warlord** | warrior→berserker | **6,070** | **1.98×** |
| 3 | **shadowlord** | rogue→ninja | **5,603** | **1.82×** |
| 4 | nightreaper | rogue→assassin | 4,246 | 1.38× |
| 5 | skyhunter | archer→ranger | 4,019 | 1.31× |
| 6 | phantom | rogue→assassin | 4,002 | 1.30× |
| 7 | shinobi | rogue→ninja | 3,906 | 1.27× |
| 8 | beastmaster | archer→ranger | 3,476 | 1.13× |
| 9 | hexmaster* | mage→warlock | 3,139 | 1.02× |
| 10 | dragoon | warrior→knight | 3,006 | 0.98× |
| 11 | ballista | archer→sniper | 2,848 | 0.93× |
| 12 | marksman | archer→sniper | 2,843 | 0.93× |
| 13 | **necromancer** | mage→warlock | **2,814** | **0.92×** |
| 14 | archbishop | mage→priest | 2,348 | 0.76× |
| 15 | elementalist | mage→archmage | 1,858 | 0.60× |
| 16 | sage | mage→archmage | 1,672 | 0.54× |
| 17* | crusader | warrior→knight | ~3,808 | 1.24× (corrected) |

\* single-target only — see the cascade finding.

Crowd (8-pack) spot check: warlord 35.9k, doombringer 26.1k, shadowlord 13.4k,
sage 10.9k (6.5× its single-target — meteor multi-hit), necromancer 8.7k
(3.1×), hexmaster **10.7–16.7 MILLION** (see below).

## Findings

**1. Necromancer is NOT the damage outlier.** 13th of 17 single-target, at
0.92× median; crowd scaling 3.1× is mid-pack. The v0.30.284 pass (Soul Vortex
2.2×→1.40×/sec, one-pool rule) landed and worked. What players FEEL is its
**safety**: damage taken measured 9/s for the warlock lines vs 168–401/s for
the warrior lines in the same crowd — minions tank, drains heal, the ult
halves damage. Its risk-adjusted power is high while its raw damage is median.

**2. The real damage outliers are the berserker masters.** Doombringer at
2.45× and warlord at 1.98× median, both driven by the shared `aoe` tag
(42–44% of their damage) + `meleeSkill`, amplified by the stacking self-buffs
(warCry +55%, bloodlust +40%, rampage +80% — additive ATK% no other class
approaches; their live ATK read 821–1,056 against everyone else's 300).

**3. Hexmaster carries a degenerate rupture cascade.** Grand Hex's rupture
(5.5× ATK at 5 stacks) splashes 55% onto neighbours *and infects them*;
adjacent high-HP targets rupture each other in a self-sustaining chain.
Measured: **10.7–16.7M DPS** on an 8-pack of high-HP dummies, 100% from
`grandhex`+`grandhexRupture`, reproducible. Trash dies too fast to loop it,
but boss-plus-adds and elite pairs are exactly the dense long-lived clusters
the cascade needs.

**4. Bugs found in passing — one CORRECTED (v0.30.330):** the original audit
claimed crusader_ult 'never successfully casts'. That was the HARNESS, not the
game: the skill is a deliberate two-tap (arm, then release on a distinct
press), and the bot's every-frame spam kept re-hitting the still-held guard.
Verified live: arm -> release works, 60 s cooldown applies, the aegis shield
lands. With a two-tap-aware bot crusader measures ~3,808 DPS - mid-pack,
appropriate for the defensive master. `lich` remains a dangling
`master:'lich'` skill entry with no MASTERS row (unpickable).

## Suggested nerf list (in priority order)

| skill | change | why |
|---|---|---|
| `hexmaster_grandhex` rupture | per-target rupture cooldown (~3 s) AND splash cannot supply the 5th stack | kills the cascade; normal play (1–2 ruptures per pack) unchanged |
| `doombringer_ult` / berserker `aoe` line | −20–25% on the doombringer-tier aoe/apoc multipliers | 7.5k → ~5.6–6k, still #1–2 |
| berserker self-buff stack | bloodlust +40%→+30% ATK (or lower the ×4.0 ATK-buff ceiling to ×3.0) | trims BOTH doombringer and warlord without touching their kits |
| `shadowlord` shade proc | −15% shade damage | 47% of its output from one passive proc |
| **necromancer — no damage nerf** | if the safety feel needs tuning: minion taunt/aggro radius −25% or ult DR 50%→35% | its damage is already 13th/17; nerfing skills would bury it |

Buff-side (out of scope but measured): sage/elementalist at 0.54–0.60× median
single-target; crusader unplayable until its ult bug is fixed.
