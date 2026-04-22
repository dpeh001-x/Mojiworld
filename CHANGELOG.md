# Changelog — `claude/debug-connection-zGgar`

Three commits on top of `main` (v0.9.8). All gameplay changes are contained in `maple_game.html`. No new dependencies, no asset files, no build step.

| Commit | Lines | Scope |
| --- | --- | --- |
| Phase 1 — save persistence + Web Audio SFX | +143 / −2 | Foundation |
| Phase 2 — achievements, daily, respec, prestige, combo milestones | +~270 | Retention hooks |
| Phase 3 — juice pass (flash, scaled shake/numbers, drop FX, squash, boss) | +~75 | Polish |

> **Note.** An earlier implementation of these three phases (targeting v0.5.1) was preserved locally at tag `phase-1-2-3-on-v0.5.1`. This branch is the rebuild on top of v0.9.8, which had moved substantially in the meantime (new bosses like Gravitos, minimap/taxi, chibi character rewrite, etc.).

---

## Phase 1 — Save persistence + Web Audio SFX

**Save / load (versioned localStorage).**
- `saveState() / loadState() / clearSave() / hasSave()` helpers with explicit field whitelists.
- `SAVE_VERSION = 1` gate — future schema changes migrate or fall back cleanly.
- Autosave hooks: every 15 s of wall time, on class-select, level-up, boss-kill, respawn, tab-hide, and `beforeunload`.
- Continue-from-save always lands in town with clean transient state — never loads into `hp ≤ 0` or a mid-boss killbox.
- Phase-2 placeholder fields (`achievements`, `dailyState`, `prestige`, `comboRecord`, `muted`) pre-added to the schema so Phase 2 doesn't need a version bump.

**Web Audio (synthesized, no assets).**
- 4 SFX via `AudioContext` oscillator envelopes: hit (240 Hz square blip), crit (520/780 Hz two-tone), level-up (C-E-G triangle arpeggio), death (180 Hz saw slide).
- Initialized on first user gesture (class-select click, `keydown`, or `pointerdown`) — satisfies Chrome/Safari autoplay policy.
- `M` key toggles mute, persisted in save.

---

## Phase 2 — Retention hooks

**🏆 Achievements + codex** (press `C`)
- 12 milestones tracked in `game.achievements`, persisted via Phase 1 schema.
- Modal shows unlocked/locked rows, live kill counter, best-ever combo (`game.comboRecord`).
- Hooks fire from `killMonster`, level-up, `bumpCombo`, and `attemptEnhance`.

**🌅 Daily login + rotating challenge**
- Deterministic UTC-day rotation (`Math.floor(Date.now() / 86400000) % 4`): 50 kills, reach level 15, enhance once, 30-hit combo.
- Streak bonus: `+200 × min(7, streak)` Lumens on login.
- HUD banner top-right shows challenge + progress bar + streak.
- Rolls on new-game class-select and on every load.

**⟳ Respec** (button inside the attributes modal, opened with `U`)
- Cost: `2000 × max(1, level − 5)` Lumens.
- Refunds all allocated AP to `skillPoints`, resets `milestonesUnlocked`. Live cost shown in the modal.

**✨ Prestige / Ascension**
- Auto-offered when the player reaches level 50.
- Each ascension: +30 % XP, +30 % damage, +1 permanent starting AP — all stackable.
- Resets level/exp/attrs/job/master/inventory/bosses.
- `getAtk()` applies `game.prestige.dmgMult`. All XP gains (normal + super-boss) apply `game.prestige.xpMult`.

**⚡ Combo milestone buffs** (inside `bumpCombo`)
- Cross 50 hits → +50 % ATK for 8 s.
- Cross 100 hits → next 3 crits guaranteed.
- Cross 150 hits → +100 % XP for 10 s.
- Timer buffs decay via the existing `player.buffs` tick loop.

---

## Phase 3 — Juice pass

**Every swing** now fires an extra screen flash — `flash(0.1)` on basic hits, `flash(0.35)` on crits — on top of the existing shake/hit-stop/audio/particles.

**Damage-scaled feedback.**
- Screen shake scales with `finalDmg`: `addShake((isCrit ? 5 : 1.8) + min(6, finalDmg/200))`.
- Damage-number font size scales with damage for both normal and crit, so a 500-damage crit visibly towers over a 40-damage jab.

**Drop-rarity theatrics.**
- `emitRarityBurst(x, y, rarity)` fires rarity-keyed bursts on every loot site (normal, mini-boss, boss extras, super-boss pile):
  - **Rare** → 14 blue particles + small flash.
  - **Epic** → 24 purple particles + `flash(0.18)` + `addShake(2.5)`.
  - **Legendary** → 40 gold particles + `flash(0.35)` + `addShake(5)` + level-up chime.
- `emitNearMiss(x, y)` teases 6 gray sparkles when a drop roll failed by < 4 % margin.

**Enemy squash-stretch on hit.**
- `hitMonster` sets `m.scaleX / m.scaleY` (1.22 / 0.74 on crit, 1.14 / 0.82 on normal).
- `updateMonsters` eases them back to 1.0 at 22 %/frame.
- The `drawMonster` call site wraps in `ctx.save / scale / restore` anchored at the sprite's feet, so the entire monster pops without floating.

**Boss phase transitions.**
- Aetherion phase 2 + phase 3 now call `addHitStop` + `audio.play('crit')` for cinematic punch.
- Gravitos (v0.9.x addition) gets the same treatment — phase 2 and phase 3 both carry a hit-stop + audio cue.

---

## How to try it

```bash
git fetch origin claude/debug-connection-zGgar
git switch claude/debug-connection-zGgar
open maple_game.html
```

Or drop the file into any static server / preview. No install step.

### Verification checklist

1. **Save.** Pick a class, reach level 2, kill a mob, refresh. Expect `Welcome back!` toast + same level/mesos/map (you'll land in town).
2. **Audio.** Hit a mob → tick. Land a crit → bright two-tone. Level-up → 3-note rise. `M` toggles mute.
3. **Daily.** Banner top-right shows progress. Complete the challenge → reward toast.
4. **Codex.** Press `C` — 12 achievements, live kill count, best combo. Kill the first mob → `First Blood` unlocks.
5. **Respec.** Open attributes (`U`), click Respec, confirm → AP refunded, milestones cleared.
6. **Prestige.** Dev console (hold `1+2+3`) → set level 50 → kill a mob → ascend prompt. After: L1 with permanent ×1.3 XP / ×1.3 DMG.
7. **Combos.** Farm a weak mob past 50 / 100 / 150 hits — three escalating buffs.
8. **Juice.** A 500-damage crit should be visibly huge; rare drops glint, legendary drops explode. Aetherion and Gravitos phase shifts hit-stop the frame.

### Controls summary

| Key | Action |
|---|---|
| `C` | Open codex / achievements |
| `U` | Character sheet (attributes, respec) |
| `K` | Skill tree |
| `B` | Inventory |
| `M` | Mute / unmute |
| `F` | Interact |
| `R` / `T` | Quick HP / MP potion |
| `1+2+3` (hold) | Dev console |
