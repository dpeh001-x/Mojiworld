# Boon Ideas v2 — creative roster candidates (2026-07-31)

Follow-up to the v0.29.344 action boons ("rewrite a verb, not a number"),
per user: "generate more creative boon ideas". Every entry names its ENGINE
HOOK — the v0.29.344 lesson is that a boon design is only as strong as its
read-site, and three of the six shipped hooks needed live measurement to
find the real control point (see the Hyper Teleport commit).

Slot language: DASH / ATTACK / DEFENSE / ON-KILL / CAST / WILD.
One-per-type equip + 3-slot cap already enforced; nothing below stacks.

## Tier 1 — rides an existing choke-point, ships in an afternoon each

| Boon | Slot | Effect (roll range) | Engine hook |
| --- | --- | --- | --- |
| **Bullet Waltz** | DASH | For 1.2–2s after a dash, enemies and their projectiles near you move 40–70% slower | `_dashBoonBegin` stamps a timer; `updateMonsters`/`updateProjectiles` scale `m.speed`/`p.vx` while it holds — same pattern as freeze, but a field |
| **Mirror Step** | DASH | Dashing leaves a decoy afterimage that taunts enemies for 1.5–3s | `game.afterImages` + set `m.aggroTarget` to the decoy pos; aggro already retargets via `hitMonster` |
| **Crescendo** | ATTACK | Every 4th basic is a guaranteed crit with heavy knockback | counter beside the `_basicSkill` branch in `hitMonster`; force `isCrit`, add `m.vx` |
| **Executioner** | ATTACK | Basics instantly kill non-boss enemies below 8–18% max HP | post-damage check in `hitMonster`: `currentHp < maxHp*r` → `killMonster`. Excludes boss/miniboss/elite like Death Bloom |
| **Riposte Nova** | DEFENSE | A successful block releases a shockwave for 60–140% ATK | `triggerBlock()` — single call site, fires on every mitigated block; reuse `_dashNovaBurst` shape + `nova_ring` art |
| **Second Skin** | DEFENSE | Fully negate one hit every 8–14s | cooldown stamp checked in `_diffDmg` — the one function nearly every player-damage path already routes through |
| **Rampage Engine** | ON-KILL | Kills grant +2% ATK for 5s, stacking to 5–10 | `killMonster` pushes stacks, `getAtk` pct reads them — same pattern as `critStreak`. Pairs naturally with the Slaughter Ladder |
| **Golden Blood** | ON-KILL | Crits make enemies bleed 3–8% bonus coins on death | flag stamped by crit branch, cashed via `_grantMojicoins` — the v0.29.350 choke-point every coin path routes through |
| **Overflow Valve** | ON-KILL | Overkill damage on the killing blow carries to the nearest enemy | `hitMonster` knows `dmg` and `currentHp` at the kill; `overkill = dmg - hpLeft`, forward via one `hitMonster(next, overkill, false, 'bloom')`-style exempt tag |
| **Doppel Cast** | CAST | Skills have a 10–25% chance to cast twice | `castSkill` beside the Quickening `cdrChance` roll — identical shape, different payout |

## Tier 2 — needs one new primitive (still bounded)

| Boon | Slot | Effect | What's missing |
| --- | --- | --- | --- |
| **Venom Edge** | ATTACK | Basics apply stacking poison DoT | monsters have `burnTimer/burnDmg` but no poison channel; needs `m.poisonTimer` + a green tick in the burn drain loop |
| **Ricochet** | ATTACK | Projectile basics bounce once off world geometry | projectile update has no bounce branch for player shots; one reflection on platform AABB contact |
| **Loaded Dice** | WILD | Roll re-randomises every map change, 0–200% of normal max | `loadMap` hook that re-rolls this boon instance; needs a "volatile" flag so reroll pricing ignores it |
| **Pact of Glass** | WILD | +40–80% ATK, but max HP −35% | needs a negative-contribution convention in `_applyEquippedBoons` (all current mods are additive-positive; one guarded exception) |

## Tier 3 — system-level (design first, then build)

- **Duo boons for the action six.** `BOON_SYNERGIES` already implements
  Hades-style pair transformations (Sanguine Flame, Phoenix Heart…), but none
  reference the v0.29.344 verbs yet. Candidates:
  - *Supernova* (Nova Step + Flame Dash) — the end-of-dash nova ignites a
    lingering `flameTrail` ring at the blast edge.
  - *Winter Garden* (Death Bloom + Frostbite) — bloom detonations also freeze
    survivors caught in the radius.
  - *Quantum Double* (Hyper Teleport + Phantom Echo) — echoes originate from
    your pre-dash position, so blinking through a pack double-hits it.
  - *Guillotine* (Executioner + Crescendo) — the forced 4th-hit crit raises
    the execute threshold by half again.
- **Legendary tier.** A rare "prismatic" roll (e.g. 5% of boon drops) that
  lands 20% above `def.max` with a distinct card border — cheap to add
  (`rollBoonInstance` + card CSS), big chase value.
- **Cast slot proper.** Hades' fourth verb. Doppel Cast (Tier 1) seeds it;
  a true slot needs a summon/projectile primitive decoupled from class
  basics — the one genuinely new system in this document.

## Explicitly rejected

- **Time-stop on kill** — `game.time` drives save-critical timers; pausing it
  selectively is the class of bug the frame-locked sim exists to prevent.
- **Coin-cost "greed" boons** (pay coins per cast for damage) — collides with
  the Slaughter Ladder + bank-penalty economy shipped this week; revisit
  after that settles.
- **Anything stacking with itself** — one-per-type is a deliberate v0.26.400
  invariant; no boon below asks to break it.
