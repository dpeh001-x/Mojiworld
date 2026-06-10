# Ultimate Ultimate — Lv 50 B-slot capstone skill (DESIGN + BALANCE SPEC)

> **Status:** prep / spec only. No game code changed yet. Review before implementing.
> **Goal:** one capstone "ultimate ultimate" per final class (master), unlocked at **Lv 50**,
> bound to a brand-new **B** skill slot. One per master = **17 skills** (see roster).

---

## 1. Key decisions (confirmed)

- **Slot:** a new skill slot, internal id `'b'`, bound to the keyboard **B** key.
- **B-key conflict → resolved:** B is currently `inventory` (`ACTION_KEY_DEFAULT.inventory:'b'`,
  with an early-out `if (k === 'b') return;`). We **repurpose B for the ultimate** and make the
  **Bag button-only** (drop its keyboard shortcut; Bag stays reachable via its HUD/menu button).
- **Unlock level:** `SLOT_LEVEL_REQ.b = 50` (tier above the master signature `x`/G at Lv 39).
- **Tiering:** the B ultimate is the single strongest skill in each kit — highest MP, longest
  cooldown, biggest payoff. It is a clear capstone *above* the master signature (slot `x`).

## 2. Roster — 17 final classes (masters)

Confirmed from the `MASTERS` table. Mage has 3 jobs (archmage/warlock/priest); Priest currently
has only **one** master (Arch Bishop), so the total is **17**, not the codex's "16."

| Archetype | Class (job) | Masters |
| --- | --- | --- |
| Warrior | Berserker | warlord, doombringer |
| Warrior | Knight | crusader, dragoon |
| Rogue | Ninja | shadowlord, shinobi |
| Rogue | Assassin | nightreaper, phantom |
| Mage | Archmage | sage, elementalist |
| Mage | Warlock | lich, hexmaster |
| Mage | Priest | archbishop *(only 1 — see Open Decisions)* |
| Archer | Sniper | marksman, ballista |
| Archer | Ranger | beastmaster, skyhunter |

## 3. Balance philosophy & envelope

Skill damage is `floor(getAtk() * dmgPct + rng) * critMul`, with class ATK multipliers
(W ×1.00 / R ×1.15 / A ×1.25 / M ×1.32) and buff/gear/prestige stacking on top.

Reference ceilings in the current game:
- **Master signatures (slot x):** MP 30–60, cd 12k–45k ms, payoff ~2.6×–8.6× ATK.
- **Biggest existing:** Lich Soul Vortex (cd 45k, ~2.6×/s channel), Doombringer (10 cleaves),
  powerStrike (8.6×).

**The B ultimate sits one tier above all of that.** Target envelope:

| Lever | Martial (W/R/A) | Caster (Mage) | Rationale |
| --- | --- | --- | --- |
| MP cost | **55–70** | **85–100** | Mage Lv-50 pool ≈ 2370 vs martial ≈ 530; scale to pool. (All ×1.25 `MP_MUL` at runtime.) |
| Cooldown | **55,000–65,000 ms** | **60,000–75,000 ms** | Once-per-major-fight. Longer than Lich's 45 s — this is *the* button. |
| Total damage | **~12×–20× ATK** | **~18×–33× ATK** (spread AoE) | ~1.5–2× the master signature's payoff. |

**Why damage isn't the risk:** at Lv 50 a martial ATK ≈ 110–162, so even 20× ≈ 2,200–3,200 —
trivial vs apex bosses (Gravitos 21M HP). The balance levers that matter are **cooldown** (not
spammable) and **MP** (resource gate) plus **relative feel** vs the master signature. Each B
ultimate is tuned to feel like a clear capstone upgrade of that master's identity, not to
trivialize endgame HP pools. Utility ultimates (heals, summons, buffs, CC) are balanced by
duration + cooldown rather than raw damage.

## 4. The 17 ultimates

**Design rules:**
1. **Echo the G theme** — same fantasy/element/identity as the master's G (slot `x`) signature.
2. **Distinct mechanic** — not a numeric scale-up; the `↳` note states how it diverges.
3. **Interactive hook (NEW)** — every ultimate is something you *play*, not just fire: a recast
   finisher, hold-to-aim/charge, a transformation stance, a bullet-time paint window, a steerable
   entity, or a build-up→detonate loop. The **Hook** column tags it. This is what makes it feel
   like an *ultimate ultimate*, and it rewards skilled use (more agency = more payoff).

All entries: `slot:'b'`, Lv 50. `id` = `<master>_ult`. Dmg = total ≈× ATK. MP is raw (×1.25 runtime).
*Hook legend:* 🔁 recast-finisher · ⏳ bullet-time · 🎯 hold-to-aim/charge · 🦋 transform stance ·
🕹️ steerable · 📈 build-up→detonate.

### Warrior

| Master | Ultimate (id) | Icon | MP | CD | Hook | Effect (echoes G; ↳ distinct) |
| --- | --- | --- | --- | --- | --- | --- |
| Warlord | War of Banners `warlord_ult` | 🚩 | 70 | 62000 | 🔁📈 | Raise a **rally field**: enemies inside are slowed 40%, you + allies gain stacking +ATK/sec, and every kill inside plants a soldier-banner. **Recast** to ORDER the charge — you and all summoned soldiers blink to the farthest foe and detonate in a city-wide shockwave (scales with banners planted). ↳ *Commandable, escalating battlefield with a player-timed finisher — not a static buff aura.* |
| Doombringer | Calamity Incarnate `doombringer_ult` | 🗡️ | 72 | 66000 | 🦋 | **Wield the colossal blade for 6 s** (transformation): huge attack hitbox, every Z is a screen-wide 4× cleave that fires a ground-rift shockwave; ends with an auto overhead Ragnarok strike (10×). ↳ *A weapon-transformation stance you fight in, not one scripted multi-cleave.* |
| Crusader | Bastion of Dawn `crusader_ult` | 🛡️ | 68 | 62000 | 📈🔁 | Become a **living bastion**: a dome that fully blocks incoming damage and **converts it into stored holy light** for 4 s (you + allies safe inside). Auto-releases (or **recast**) as a holy nova scaling with damage absorbed. ↳ *Bait-and-convert damage into your nuke — not flat DR + orbs.* |
| Dragoon | Skyfall Dominion `dragoon_ult` | 🐉 | 62 | 56000 | 🕹️ | Leap up and **hover with free aerial movement** (untargetable) 3 s, raining dragon-lances wherever you fly and **painting impact marks**; slam down to detonate every mark at once (bigger the more ground you covered). ↳ *A piloted aerial bombing run, not a single fixed dive.* |

### Rogue

| Master | Ultimate (id) | Icon | MP | CD | Hook | Effect (echoes G; ↳ distinct) |
| --- | --- | --- | --- | --- | --- | --- |
| Shadowlord | Shadow Sovereign `shadowlord_ult` | 🌑 | 62 | 62000 | 📈🔁 | Split into a **shadow swarm** 8 s: every dodge/dash leaves an attacking after-image and your hits are echoed by all clones (combo chains). **Recast** to collapse every clone onto the cursor target in a simultaneous assassination. ↳ *A growing echo-combo army you detonate on demand, not autonomous sentinels.* |
| Shinobi | Hundred-Hand Shadow Dance `shinobi_ult` | 🎴 | 60 | 56000 | ⏳ | Enter **bullet-time** (world at 30%) 2.5 s; every foe you touch/aim gains slash-marks. On exit you teleport-chain through all marked foes, damage scaling with total marks (rewards painting many). ↳ *A bullet-time mark-painting combo, not one fixed zip.* |
| Nightreaper | Bloodmoon Domain `nightreaper_ult` | 🌒 | 62 | 60000 | 📈 | Summon a **blood-eclipse domain** 5 s: ALL your hits crit + bleed; any foe dying inside releases a soul-scythe that auto-seeks the next target (chain reaction). Execute threshold rises the longer it holds. ↳ *A self-feeding kill-chain domain, not a fixed dagger-rain.* |
| Phantom | Voidwalk `phantom_ult` | 🕳️ | 62 | 60000 | 🕹️🔁 | **Phase into the void**: untargetable, free movement, attacks pierce walls + DEF, while a rift drags foes toward a singularity you reposition. **Recast** to pin + implode it (8×). ↳ *You walk the void and place the collapse, not a fixed pull-vortex.* |

### Mage

| Master | Ultimate (id) | Icon | MP | CD | Hook | Effect (echoes G; ↳ distinct) |
| --- | --- | --- | --- | --- | --- | --- |
| Sage | Meteor Sigil `sage_ult` | ☄️ | 92 | 62000 | 🎯📈 | **Hold to grow a targeting sigil** and stamp multiple impact points; release to drop a comet sized to the charge that links all stamps with a fire-web (16× core + web ticks). ↳ *A player-aimed, charge-scaled armageddon, not 5 random meteors.* |
| Elementalist | Elemental Apotheosis `elementalist_ult` | 🌀 | 100 | 66000 | 🦋🔁 | **Ascend to elemental form** 6 s: your Z cycles Fire→Ice→Lightning→Arcane (each empowered + AoE). **Recast** to fire a Convergence beam combining whichever elements you used — more variety = bigger beam. ↳ *An elemental stance + combo payoff, not a fixed sequence.* |
| Lich | Necrotic Ascendance `lich_ult` | ☠️ | 92 | 72000 | 📈🔁 | For 8 s every foe you damage drops a soul that **raises a skeletal thrall** to fight for you. **Recast** (or on end) to consume all thralls in a death-nova scaling with thrall count; you heal per soul. ↳ *Raise an army then detonate it, not a sustained drain.* |
| Hexmaster | Pandemic Hex `hexmaster_ult` | 🧿 | 85 | 65000 | 📈 | Infect the nearest foe with a **contagious curse** that spreads on contact/death; each spread stacks -DEF/-ATK + a doom timer, and every cursed death jumps the curse onward + erupts (9×). ↳ *A viral, self-propagating plague, not a one-shot AoE hex.* |
| Arch Bishop | Apotheosis `archbishop_ult` | ⚜️ | 100 | 72000 | 🕹️ | Ascend: **you cannot die** for the duration (lethal hits heal instead) and you **steer a roaming pillar of light** across the field that judges all it sweeps (10×, ×1.5 vs dark/undead). Ends with full HP+MP restore. ↳ *A steerable holy beam + cheat-death, not fixed pillars.* |

### Archer

| Master | Ultimate (id) | Icon | MP | CD | Hook | Effect (echoes G; ↳ distinct) |
| --- | --- | --- | --- | --- | --- | --- |
| Marksman | Deadeye Protocol `marksman_ult` | 🎯 | 65 | 58000 | ⏳🎯 | Enter **focus** (time at 20%); **paint up to 5 targets/weakpoints** by aiming. On release, fire simultaneous guaranteed-crit piercing rounds to every painted point, damage scaling per target painted. ↳ *A bullet-time multi-paint volley, not one instant rail.* |
| Ballista | War Machine `ballista_ult` | 🛡️ | 70 | 62000 | 🕹️🎯 | **Mount a siege platform you aim**: hold to sweep explosive bolts wherever you point, with a charge meter for an "anchor shot" mega-bolt. ↳ *A player-manned, aimable war engine, not a fixed channel or auto-turret.* |
| Beastmaster | Apex Bond `beastmaster_ult` | 🐺 | 65 | 68000 | 🦋🕹️ | **Fuse with a colossal apex beast** (ride transformation): bigger hitbox, hold-direction trampling charges, a fear-roar, and a leap-slam. ↳ *Become/ride the beast, not summon detached wolves.* |
| Skyhunter | Eye of the Tempest `skyhunter_ult` | 🌪️ | 65 | 56000 | 🕹️📈 | Summon a **storm-eye you steer**: it rains homing arrows on everything in range and sucks in enemy projectiles; arrows that kill **split into more arrows** (cascade). ↳ *A steerable storm with a kill-cascade, not a one-time fan.* |

> **Per-master fit:** each ultimate still keys to its G signature's fantasy (Warlord/banners,
> Doombringer/giant blade, Crusader/holy aegis, Lich/soul-undeath, Skyhunter/homing arrows,
> Phantom/void-phase, Beastmaster/beasts) — but now delivers it through an **interactive hook**
> that rewards play, so it's a dramatic, skill-expressive capstone rather than a fire-and-forget nuke.

## 5. Implementation checklist (exact anchors)

Line numbers drift (file is edited concurrently) — match by the **anchor text**.

1. **New slot id `'b'` (keyboard B → slot `b`)**
   - `KEY_TO_SLOT_DEFAULT` (anchor `const KEY_TO_SLOT_DEFAULT = Object.freeze({`): add `b: 'b',`.
   - `SLOT_LEVEL_REQ` (anchor `const SLOT_LEVEL_REQ = {`): add `b: 50,`.
   - Skill-bar slot iteration (anchor `for (const slotId of ['d','s','a','e','w','q','c','x'])`):
     append `'b'` → `[...,'x','b']`. Also any other place that hard-codes this 8-slot list
     (grep `'d','s','a','e','w','q','c','x'`) — update **all** occurrences (skill bar build,
     keybind modal, mobile deck, save/migrate).
   - `SLOT_TO_KEY` rebuilds automatically from `KEY_TO_SLOT`.

2. **Free the B key from inventory (Bag → button-only)**
   - `ACTION_KEY_DEFAULT` (anchor `inventory:    'b',`): set to `inventory: ''` (or remove) so no
     key opens the bag, **or** rebind inventory to a free key if you change your mind later.
   - Keydown handler early-out (anchor `if (k === 'b') return;`): **remove** it so B flows through
     to the skill-cast path. Verify the inventory open is still reachable via its HUD/menu button
     (grep `openInventory`/`inventory-modal` toggling button). Add a Bag HUD button if none exists.

3. **17 `SKILLS` entries** (anchor `const SKILLS = {` … `skyhunter_gale:`)
   - Add one `<master>_ult` entry per roster row: `{ name, icon, cls, job, master, slot:'b', mp, cd, desc }`.
   - `cls/job/master` must match each master (e.g. `cls:'mage', job:'warlock', master:'lich'`).
   - `skillsForClass()` (anchor `function skillsForClass(`) already filters by cls/job/master — no change.

4. **17 `SKILL_FNS` implementations** (anchor `const SKILL_FNS = {`)
   - One no-arg function per id. Reuse existing helpers: `performMelee`, `performAround`,
     projectile pushes, `spawnSpriteBurst`, buff timers, `homing:true` projectiles, the
     meteor/pillar hazard pipelines, summon patterns. Many ultimates are scaled-up clones of the
     master signature in `SKILL_FNS` — start from those.

5. **Keybind (K) modal** — add the `b` slot row + keyboard-reference entry; confirm remap writes
   `player.keybinds.b`. (anchors: the K-modal keyboard widget + `applyKeybinds()`.)

6. **Existing-save migration** — `applyKeybinds()` rebuilds `KEY_TO_SLOT` from `player.keybinds`.
   Old saves have no `b` entry. Add a merge so missing default keys (incl. `b`) are backfilled
   from `KEY_TO_SLOT_DEFAULT`, else Lv-50+ veterans can't cast the ultimate. **Required.**

7. **Mobile touch deck** — the on-screen skill deck renders from the slot list; a **9th button**
   is needed for slot `b`. Check deck layout/CSS fits 9 (anchor: mobile control deck DOM/CSS).

8. **Controls/help text** — update the strip `<kbd>B</kbd> Bag` (anchor `>B</kbd> Bag`) → reflect
   B = Ultimate; move the Bag mention to its button. Update the K-modal reference + any "I skills ref".

9. **CHANGELOG.html** — add a `feat` entry on implementation (per repo changelog policy).

## 6. Risks & open decisions

- **Priest has only 1 master** (archbishop) → 17 ultimates, not 16. Options: (a) ship 17 as-is;
  (b) add a 2nd Priest master first (out of scope here). Recommend (a).
- **Bag discoverability:** dropping the B shortcut means the Bag *must* have an obvious HUD button.
  Verify/ add one before shipping, or players lose quick inventory access.
- **Mobile 9-button deck** may need a layout pass (wrap to 2 rows or shrink buttons).
- **Power creep vs PvE:** damage is deliberately modest in absolute terms (see §3); if these feel
  weak vs trash and strong vs nothing, the lever to pull is cooldown, not damage.
- **Cast-lock interactions:** channelled ultimates (Nightreaper, Phantom, Lich, Arch Bishop) must
  set/clear the cast-lock so they can't be interrupted into a broken state (mirror existing
  channelled signatures).
- **Icons:** each ultimate uses an icon *distinct from* its own G signature (so the skill bar
  reads B ≠ G at a glance). Cross-class repeats are fine (Crusader 🛡️ vs Ballista 🛡️; different
  classes never share a bar) but swap if you want every glyph unique.
- **New engine primitives (scope ↑):** the interactive hooks need a few reusable systems the
  current skills don't all have. Build these once, reuse across ultimates:
  - **🔁 Recast** — a skill that arms a window and re-triggers on the next B press (Warlord,
    Crusader, Shadowlord, Phantom, Elementalist, Lich). Needs a per-player "armed ultimate" state
    + a B-press router that fires the finisher instead of re-casting; auto-fires on timeout.
  - **⏳ Bullet-time** — a global time-scale multiplier on enemy/projectile updates while the
    player acts at normal speed (Shinobi, Marksman). Check the update loop uses a `dt` we can
    scale; exclude the player + UI. Reuse the existing eclipse/slow infra if present.
  - **🦋 Transform stance** — temporary state altering the player's basic attack + hitbox
    (Doombringer, Elementalist, Beastmaster). Needs a stance flag the melee/Z path reads.
  - **🕹️ Steerable entity** — a player-controlled summon/cursor (Dragoon hover, Phantom
    singularity, Arch Bishop pillar, Ballista platform, Skyhunter storm-eye, Beastmaster mount).
    Needs an input-capture mode that maps movement keys to the entity, not the player.
  - **📈 Build-up→detonate** — accumulate stacks/summons/marks then release (most of the above).
  - **📌 Contagion tag** — Hexmaster's spreading curse needs a per-enemy infect flag + spread tick.
  These are the bulk of the added complexity vs the v1 designs — worth a small **primitives
  commit** before the per-skill work. Fallbacks: any hook can degrade to an auto-resolved version
  (e.g. recast auto-fires, steer becomes auto-aim) if a primitive proves too costly.

## 7. Suggested implementation order (when greenlit)

1. Slot infra (steps 1–2) + save migration (6) — smallest, highest-risk-of-conflict; commit alone.
2. Skill-bar + keybind modal + mobile deck rendering (3-header, 5, 7) with one placeholder skill.
3. **Interactive-hook primitives** (recast router, bullet-time scale, transform-stance flag,
   steerable-entity input mode, contagion tag) — one commit, with a trivial test skill exercising each.
4. SKILLS entries + SKILL_FNS, **one archetype per commit** (W, R, M, A) — 4 commits. Build each
   ultimate on the primitives from step 3.
5. Help text (8) + CHANGELOG (9).

