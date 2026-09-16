# Skill Balance Sheet — v0.30.771 (Mojiworld)

Edit this sheet to retune skills. The format below maps directly to the values in `SKILLS` (metadata: `mp`, `cd`) and the `SKILL_FNS` bodies (damage formulas). After tweaking, paste the changed block back to me with "apply this" and I'll wire it into `mojiworld_game.html`.

**Damage notation:** `ATK × N` = `Math.floor(getAtk() × N)`. `+ flat` is a constant add. `crit` means the hit auto-crits. `area W×H` is the AoE rectangle. `radius R` is a circular AoE.

---

## Damage budgets — v0.30.771 (measured)

Per user (2026-09-16): **G and B** — the master signature and the master ultimate — of every class
deal about **1000% of that class's basic attack**, cumulative across their lines. Damage-over-time,
summon and channel skills deal that 1000% **over 10 seconds**. Skills that charge or carry a
requirement may reach **2500%** — Bastion of Dawn at a full Dawn Charge is the reference.
Q, C and the basic d/s/a/e/w kit are **out of scope** and were not changed.

These are measured, not derived: one cast at a stationary dummy (evasion 0, crits off, RNG pinned),
HP loss totalled over 10 s, lines counted at `hitMonster`. `scripts/skill_budget_test.mjs` is the
measurement with ±20% assertions; this table is from the run that passed.

Two definitions the table depends on: Deadeye (marksman G) and Protocol (marksman B) are budgeted on
the **full press window** (6 s at the 420 ms gate; 8 s at the 250 ms gate), because one press is not
the skill; Bastion of Dawn is released at t = 1 (held 10 s) and d = 1 (a full health bar banked).

Known bound: burn and poison ticks are clamped to 0.5% of the target's max HP per tick (0.1% on
bosses), so a DOT's budget binds first on bosses.

| class | key | skill | before | after | lines | budget |
|---|---|---|---:|---:|---:|---:|
| archer | G | Deadeye (`marksman_oneshot`) | 6389% | **1000%** | 81 | 1000% |
| archer | G | Siege Volley (`ballista_volley`) | 8462% | **1014%** | 106 | 1000% |
| archer | G | Call of the Wild (`beastmaster_pack`) | 9878% | **958%** | 39 | 1000% |
| archer | G | Gale Storm (`skyhunter_gale`) | 5498% | **996%** | 13 | 1000% |
| archer | B | Deadeye Protocol (`marksman_ult`) | 91975% | **1088%** | 155 | 1000% |
| archer | B | War Machine (`ballista_ult`) | 546% | **989%** | 11 | 1000% |
| archer | B | Apex Bond (`beastmaster_ult`) | 577% | **1080%** | 7 | 1000% |
| archer | B | Eye of the Tempest (`skyhunter_ult`) | 1586% | **983%** | 14 | 1000% |
| mage | G | Judgment of the Holy Grail (`archbishop_grail`) | 1994% | **1010%** | 7 | 1000% |
| mage | G | Pyre Columns (`sage_meteorshower`) | 767% | **1001%** | 3 | 1000% |
| mage | G | Prismatic Cascade (`elementalist_cascade`) | 782% | **941%** | 4 | 1000% |
| mage | G | Soul Vortex (`necromancer_harvest`) | 857% | **998%** | 18 | 1000% |
| mage | G | Grand Hex (`hexmaster_grandhex`) | 2152% | **1001%** | 12 | 1000% |
| mage | B | Meteor Sigil (`sage_ult`) | 300% | **998%** | 1 | 1000% |
| mage | B | Elemental Apotheosis (`elementalist_ult`) | 532% | **995%** | 2 | 1000% |
| mage | B | Necrotic Ascendance (`necromancer_ult`) | 1226% | **1047%** | 12 | 1000% |
| mage | B | Pandemic Hex (`hexmaster_ult`) | 1534% | **1056%** | 13 | 1000% |
| rogue | G | Kage Rush (`shinobi_seal`) | 248% | **1000%** | 1 | 1000% |
| rogue | G | Eclipse Massacre (`nightreaper_mark`) | 1149% | **1008%** | 11 | 1000% |
| rogue | G | Voidrift Execution (`phantom_cut`) | 3576% | **997%** | 7 | 1000% |
| rogue | B | Hundred-Hand Shadow Dance (`shinobi_ult`) | 1124% | **1002%** | 5 | 1000% |
| rogue | B | Bloodmoon Domain (`nightreaper_ult`) | 1767% | **1008%** | 16 | 1000% |
| rogue | B | Voidwalk (`phantom_ult`) | 636% | **998%** | 3 | 1000% |
| warrior | G | Warlord's Banner (`warlord_warcry`) | 595% | **970%** | 3 | 1000% |
| warrior | G | Blade of Calamity (`doombringer_apoc`) | 1118% | **1118%** | 11 | 1000% |
| warrior | G | Divine Aegis (`crusader_aegis`) | 832% | **857%** | 3 | 1000% |
| warrior | G | Sky Lance (`dragoon_skylance`) | 727% | **999%** | 2 | 1000% |
| warrior | B | War of Banners (`warlord_ult`) | 556% | **932%** | 2 | 1000% |
| warrior | B | Calamity Incarnate (`doombringer_ult`) | 4332% | **999%** | 8 | 1000% |
| warrior | B | Bastion of Dawn (`crusader_ult`) | 1784% | **2497%** | 3 | 2500% |
| warrior | B | Skyfall Dominion (`dragoon_ult`) | 2483% | **1009%** | 10 | 1000% |

## ⚔ WARRIOR (13 skills)

class: warrior
name of skill: Slash, key: Z
damage calculator: ATK × 1.6 (auto-crit)
number of monsters: 1 (single-target swing in front)

class: warrior
name of skill: Power Strike, key: X
damage calculator: ATK × 0.9 + 4 per arc × 3 arcs (high / mid / low)
number of monsters: unlimited per arc (3-line cleave); final arc stuns 0.5 s

class: warrior
name of skill: Ground Slam, key: S
damage calculator: ATK × 2.3 + random[0..12] per hit
number of monsters: unlimited within radius (radial AoE around player)

class: warrior
name of skill: Rush, key: C
damage calculator: ATK × 0.4 per pierced enemy
number of monsters: unlimited along dash path

class: warrior
name of skill: War Cry, key: D
damage calculator: ATK × 0.9 per hit (also +50 % ATK buff for 6 s)
number of monsters: unlimited within radial sound-wave radius

class: warrior · berserker
name of skill: Bloodlust, key: F
damage calculator: 0 (buff: 12 s rage with +ATK / lifesteal / speed; basic Z attacks gain shockwaves while active)
number of monsters: 0 directly (modifies basic attacks)

class: warrior · berserker
name of skill: Rampage, key: V
damage calculator: ATK × ~1.5 per tick × 3 s spinning AoE
number of monsters: unlimited within spin radius

class: warrior · knight
name of skill: Guardian, key: F
damage calculator: 0 (buff: 80 % damage reduction for 5 s)
number of monsters: 0

class: warrior · knight
name of skill: Holy Shield, key: V
damage calculator: ATK × 1.8 per nearby enemy on cast (auto-crit) + 4 s invuln + reflect
number of monsters: unlimited within nearby radius on cast

class: warrior · berserker · master Warlord
name of skill: Warlord's Banner, key: G
damage calculator: ATK × 1.4 + 12 + stacks × 4 per fan hit (also +ATK / heal / +50 % range buff for 6 s)
number of monsters: unlimited in forward fan

class: warrior · berserker · master Doombringer
name of skill: Blade of Calamity, key: G
damage calculator: ATK × 2.4 per cleave × 9 cleaves + ATK × 2.8 final slam
number of monsters: unlimited in front per cleave

class: warrior · knight · master Crusader
name of skill: Divine Aegis, key: G
damage calculator: ATK × 1.7 per orb strike (5 hovering orbs for 8 s) + heal 60 % maxHP + half damage taken
number of monsters: unlimited (orbs strike enemies in their pendulum path)

class: warrior · knight · master Dragoon
name of skill: Sky Lance, key: G
damage calculator: ATK × 2.0 + 25 ground slam + ATK × 1.2 piercing fall
number of monsters: unlimited in slam radius + line

---

## 🗡 ROGUE (13 skills)

class: rogue
name of skill: Stab, key: Z
damage calculator: ATK × ~1.0 (lightning thrust)
number of monsters: 1 (single-target)

class: rogue
name of skill: Backstab, key: X
damage calculator: ATK × varies per stab + random[0..4] × 3 stabs (triple-crit finisher)
number of monsters: 1 (single target chain)

class: rogue
name of skill: Throw Dagger, key: S
damage calculator: ATK × 1.05 + 4 per dagger × 5 lanes (up to 6 with multishot mod)
number of monsters: up to 5–6 (one per lane in fan spread)

class: rogue
name of skill: Smoke Dash, key: C
damage calculator: ATK × laneDmg per dash hit + ATK × 0.8 per smoke tick × 3 ticks
number of monsters: unlimited along dash corridor + smoke trail

class: rogue
name of skill: Flurry, key: D
damage calculator: ATK × 0.85 + random[0..4] per slash (multi-strike along blink path)
number of monsters: unlimited along blink corridor

class: rogue · ninja
name of skill: Shadow Strike, key: F
damage calculator: ATK × 1.9 (auto-crit, teleport behind target)
number of monsters: 1 (single target)

class: rogue · ninja
name of skill: Death Blossom, key: V
damage calculator: ATK × 1.15 per hit × 3 fast waves × up to 5 nearby enemies
number of monsters: 5 per wave (15 total over 3 waves)

class: rogue · assassin
name of skill: Smoke Bomb, key: F
damage calculator: ATK × 0.7 per hit (also invuln + heal 30 % for 3 s)
number of monsters: unlimited within smoke radius

class: rogue · assassin
name of skill: Voidrift Blink, key: V
damage calculator: ATK × 2.0 × ramp per zip × 3 charges (ramp grows with consecutive use)
number of monsters: unlimited in each zip path × 3 zips

class: rogue · ninja · master Shadowlord
name of skill: Mirror Shadow, key: G
damage calculator: ATK × 2.2 per clone strike × 3 clones for 15 s (≈ 1 strike / 0.5 s each)
number of monsters: unlimited within each clone's circular AoE

class: rogue · ninja · master Shinobi
name of skill: Kage Rush, key: G
damage calculator: ATK × 2 + 20 per zip slash × multiple zips across map
number of monsters: unlimited in each zip path

class: rogue · assassin · master Nightreaper
name of skill: Eclipse Massacre, key: G
damage calculator: ATK × varies + 20 per dagger × 10 batches (rains on every visible enemy) + aftershock nova
number of monsters: every visible enemy on screen

class: rogue · assassin · master Phantom
name of skill: Voidrift Execution, key: G
damage calculator: ATK × dmgPct + random[0..6] per execute (always crit, ignores DEF) × up to 6 marked enemies + final shadow nova
number of monsters: up to 6 marked + nova around final target

---

## 🔮 MAGE (16 skills)

class: mage
name of skill: Magic Bolt, key: Z
damage calculator: ATK × ~1.0 (arcane projectile, 0.3 s recast)
number of monsters: 1 (single target per bolt)

class: mage
name of skill: Fireball, key: X
damage calculator: ATK × 2.5 + 15 (impact) — explodes in 90 px AoE on hit
number of monsters: unlimited within 90 px explode radius

class: mage
name of skill: Ice Spike, key: S
damage calculator: ATK × 1.9 + 8 (freezes target on hit)
number of monsters: 1 (single target, freezes)

class: mage
name of skill: Dimensional Warp, key: C
damage calculator: ATK × 1.5 per mob in swept path (rect = path expanded 100 px horizontal × 50 px vertical) + 180-frame invuln
number of monsters: unlimited within swept rect

class: mage
name of skill: Arcane Burst, key: D
damage calculator: ATK × 2.4 (radial AoE 320 px around player)
number of monsters: unlimited within 320 px

class: mage · archmage
name of skill: Meteor, key: F
damage calculator: ATK × ~3.5 + flat (single meteor from above)
number of monsters: unlimited within meteor impact radius

class: mage · archmage
name of skill: Elemental Convergence, key: V
damage calculator: ATK × 2.4 × jumpMul + 12 per chain hop (fire → ice → lightning) + ATK × 0.06 burn DoT
number of monsters: chain to 3+ enemies

class: mage · warlock
name of skill: Soul Siphon, key: F
damage calculator: ATK × 0.9 + 8 per drain (also drains HP → MP)
number of monsters: unlimited within 220 × 140 rect around player

class: mage · warlock
name of skill: Dark Pulse, key: V
damage calculator: ATK × ~2.0 per hit (large AoE with 100 % lifesteal)
number of monsters: unlimited within AoE

class: mage · priest
name of skill: Holy Light, key: F
damage calculator: ATK × 1.10 (AoE 650 × 440) + self-heal 25–100 % maxHP scaling on ATK + Prism Charge +1 (cap 5)
number of monsters: unlimited within 650 × 440 rect

class: mage · priest
name of skill: Celestial Aurora, key: V
damage calculator: ATK × 0.45 per tick × 5 ticks (550 × 100 field, 5 s) + heal player 20 % maxHP+MP per tick (+5 % per Prism Charge consumed) + cleanse on cast
number of monsters: unlimited within 550 × 100 field

class: mage · archmage · master Sage
name of skill: Meteor Shower, key: G
damage calculator: ATK × ~3.0 per meteor × 5 meteors over an area
number of monsters: unlimited per meteor impact

class: mage · archmage · master Elementalist
name of skill: Prismatic Cascade, key: G
damage calculator: ATK × ~2.0 per element × 4 elements (amplifying) — fire / ice / lightning / nature
number of monsters: unlimited per element strike

class: mage · warlock · master Necromancer
name of skill: Soul Vortex, key: G
damage calculator: ATK × 1.40 per tick × ~225 ticks over 30 s (320 px vortex, 30 % HP drain → caster)
number of monsters: unlimited within 320 px

class: mage · warlock · master Hexmaster
name of skill: Grand Hex, key: G
damage calculator: ATK × 0.20 per burn tick × ~12 ticks (8 s DoT) + freeze 2 s on every enemy
number of monsters: every enemy on screen

class: mage · priest · master Arch Bishop
name of skill: Judgment of the Holy Grail, key: G
damage calculator: ATK × 2.4 per pillar × 7 pillars + 6 % maxMP refund per pillar that connects
number of monsters: 7 (one pillar targets the highest-HP enemy in range each)

---

## 🏹 ARCHER (13 skills)

class: archer
name of skill: Arrow Shot, key: Z
damage calculator: (ATK × 1.3 + 4) × aimMul per arrow
number of monsters: 1 (single arrow per shot)

class: archer
name of skill: Multi Shot, key: X
damage calculator: ATK × 1.5 + 5 per arrow × 3 arrows
number of monsters: 3 (one per lane in fan spread)

class: archer
name of skill: Charged Shot, key: S
damage calculator: ATK × 3.5 + 20 (piercing arrow)
number of monsters: unlimited along arrow line

class: archer
name of skill: Evade Burst, key: C
damage calculator: ATK × 0.4 + 4 (back-flip explosion) + 2 follow-up arrows at ATK × 1.0 + 4 each
number of monsters: unlimited within blast radius

class: archer
name of skill: Eagle Eye, key: D
damage calculator: 0 (buff: +40 % crit chance for 8 s)
number of monsters: 0

class: archer · sniper
name of skill: Railshot, key: F
damage calculator: ATK × ~1.55 + 12 per hit (instant pierce along line; consecutive hits empower next)
number of monsters: unlimited along straight line

class: archer · sniper
name of skill: Arrow Rain, key: V
damage calculator: ATK × 1.8 + 8 per arrow (rains over an area)
number of monsters: unlimited per arrow within rain area

class: archer · ranger
name of skill: Wild Bond, key: F
damage calculator: 0 directly (summons wolf companion: 60 s timer OR 10 000 HP, deals ATK × 1.4 per attack)
number of monsters: 1 per wolf attack (single target chase-and-bite, ~600 ms attack CD)

class: archer · ranger
name of skill: Elemental Arrows, key: V
damage calculator: ATK × 1.8 + 6 per arrow × 6 elements (fire / ice / lightning / nature / light / dark) — pierce
number of monsters: unlimited per arrow line

class: archer · sniper · master Marksman
name of skill: One Shot One Kill, key: G
damage calculator: ATK × 7 + 60 (auto-crit, pierces) + 12 % chance instakill (non-boss)
number of monsters: unlimited along arrow line

class: archer · sniper · master Ballista
name of skill: Siege Volley, key: G
damage calculator: ATK × 0.85 + 5 per arrow × ~106 arrows over 8 s channel (Hold G, drains MP)
number of monsters: unlimited along arrow stream

class: archer · ranger · master Beastmaster
name of skill: Call of the Wild, key: G
damage calculator: 0 directly (summons up to 4 oversized wolves, 100 s life, 10 000 HP each, each deals ATK × 1.1 per attack)
number of monsters: 1 per wolf attack × 4 wolves (max 4 single-target hits per ~500 ms cycle)

class: archer · ranger · master Skyhunter
name of skill: Gale Storm, key: G
damage calculator: ATK × 2.3 + 12 per arrow × 10 homing arrows (cannot miss)
number of monsters: 1 per arrow (homes to nearest, repeats)

---

## Editing protocol

When you want to retune a skill, edit the **damage calculator** and/or **number of monsters** line and paste the modified block back. I'll translate the change into the right `SKILLS` entry (for `mp` / `cd`) and the right `SKILL_FNS` body (for damage formula / target count / radius). For brand-new skills, also include a `key:` and a one-line description and I'll wire the skill from scratch.
