# Setshard tuning reference

Every dial that decides how setshards (`◈`) are earned and spent. All of them
live in **`mojiworld_game.html`** — the game is one file, so the practical way
to find a knob is to search for the constant name, not to trust a line number.
Line numbers below are correct as of **v0.29.791** and will drift.

---

## 1. Boss drop — the main faucet

This is the one to change for "bosses should drop more/fewer shards".

| What | Where | Current |
| --- | --- | --- |
| Payout formula | search `const _fullShards = Math.min` (~L80216) | `min(100, max(1, floor(bossLevel * 1.0)))` |
| Refight multiplier | search `LX_REFIGHT_SHARD_MUL` (~L38424) | `0.40` |

```js
const _fullShards = Math.min(100, Math.max(1, Math.floor(_bossLvl * 1.0)));
//                            ^cap                              ^coefficient
```

- **Coefficient** — shards per boss level. `1.0` means a Lv 50 boss pays 50.
- **Cap** — the ceiling for the highest bosses. Gravitos (Lv 100) sits exactly on it.
- A first clear pays `_fullShards`; every later kill pays `_fullShards × LX_REFIGHT_SHARD_MUL`, minimum 1.

What the current curve pays: Lv 10 → 10 ◈ · Lv 30 → 30 ◈ · Lv 50 → 50 ◈ · Lv 70 → 70 ◈ · Lv 100 → 100 ◈.
A full tour of the eight unique bosses ≈ **330 ◈**.

### ⚠ Change this in TWO places

The pre-fight **drop preview** — the panel that tells the player what the boss
will pay before they commit — keeps its own copy of the formula. Search
`const _shards = Math.min` (~L39875) and keep it identical, or the preview
advertises a number the kill will not honour.

---

## 2. Non-boss drops

Search `LX_DUST_TRICKLE_CHANCE` (~L52142). The three sit together:

```js
const LX_DUST_TRICKLE_CHANCE = 0.005;                     // plain monsters → 1 ◈
const LX_SHARD_ELITE = { chance: 0.25, min: 1, max: 2 };  // Elite
const LX_SHARD_ELDER = { chance: 0.50, min: 2, max: 3 };  // Elder (mini-boss)
```

Yield per kill: normal **0.005** · Elite **0.38** · Elder **1.25**.
Elites are ~3% of spawns, so across 100 kills normals contribute ~0.5 ◈ against
an Elite's ~1.1 ◈ — the rare tier out-earns the whole common population.

**A reanimating Elite pays on its second death.** Elites carry `revivesOnce`
~18% of the time (Elders 13%); a reanimating mob leaves the kill handler before
the shard roll and pays when it dies for real. Expected behaviour, not a bug —
but it will skew any drop-rate test that kills each spawn only once.

---

## 3. Other boss rewards on a refight

Search `LX_REFIGHT_REWARD_MUL` (~L38425). One multiplier, applied to both the
recipe-scroll roll and the gear roll for a boss already cleared:

| Reward | First clear | Refight (× 0.40) |
| --- | --- | --- |
| Recipe scroll | 15% | 6% |
| Gear drop | 1.8% | 0.72% |

A refight is decided by `game._bossKills` — a persistent per-boss counter that
survives the 10-minute respawn re-arm **and** a reload. It is not the
`bossDefeated` flag, which the respawn clears.

---

## 4. Sinks — what shards buy

| Sink | Search | Current |
| --- | --- | --- |
| Craft Set Piece | `CRAFT_COST_SHARDS` (~L86973) | `1000` |
| Transcend | `TRANSCEND_COST` (~L86544) | `4000` |
| Reforge Bench | `const COST = 500` | `500` |
| Respec Talent | `const COST = 1500` | `1500` |

**Prices are written into the UI too** — confirm dialogs, button labels, Brok's
menu rows, the HUD tooltip and several comments. Those are what the player reads
*before* spending, so change them with the constant. After editing, sweep for the
old number to be sure none survived:

```bash
grep -n "200◈\|100◈\|300◈\|800◈" mojiworld_game.html
```

---

## 5. Sanity check after any change

The economy only makes sense as a ratio of faucet to sink:

| | Craft cost | Boss tour | Tours per craft |
| --- | --- | --- | --- |
| v0.29.775 and earlier | 200 ◈ | 164 ◈ | 0.8 |
| Current | 1000 ◈ | 330 ◈ | **3.0** |

If crafting feels out of reach, `CRAFT_COST_SHARDS` is the first dial; the
Elite/Elder rates are the second, since they are the main non-boss faucet.

House rules that apply to edits here: **atomic writes only** on
`mojiworld_game.html`, match-count guards on every replace, and stage explicit
paths — never `git add -A`. See `CLAUDE.md`.
