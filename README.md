# 🗡️ LevelX — Shardfall Expedition

A 2D action-platformer RPG with roguelite elements. Four classes, eight job advancements, sixteen master classes, skill trees, affix-roll loot, star enhancement, procedural dungeons, and mini-bosses. **v0.24.0 adds optional multiplayer** — run the server in `server/` and friends can join your room to run around and chat together.

## 🎮 Play

**Open `maple_game.html` in a browser.** Solo play needs no setup.

Optional art mode: append `?art=cinematic` for the high-fidelity background pack.
Optional scene post-processing: append `?artfx=soft` (default), `?artfx=vivid`, `?artfx=noir`, or `?artfx=0` to disable.
Outdoor maps now include a built-in art pass (depth fog, god rays, foreground foliage framing) to improve scene depth and character readability.
Bitmap backgrounds also get an animated sky-life layer (moving cloud wisps + distant birds) for a more alive painterly feel.

Live play URL (once GitHub Pages is enabled): **https://dpeh001-x.github.io/LevelX/maple_game.html**

## 🌐 Multiplayer (optional, v0.24.0)

```sh
cd server
npm install
npm start         # [levelx-server] listening on port 8080
```

In the game, click **🌐 Multi** (top-right of the HUD), enter `ws://localhost:8080`, pick a name + room, hit **Connect**. Share the URL + room name with a friend. See `server/README.md` for Fly.io / Railway / VPS deploy instructions and the full protocol table.

**Scope.** Presence + chat + emote relay across everyone in the same room. Combat and mobs are still per-client — two players next to the same Slippy are each fighting their own. Server-authoritative combat is the next milestone.

## 🎯 Controls

Skills are laid out as a left-hand cluster (`Z X S C D F V G`) so you can reach every attack without leaving WASD-adjacent position. Press `?` in-game for a live keybind panel that shows your current class's skill names + cooldowns, or `I` for a short skill reference card.

### Movement

| Action | Key |
|---|---|
| Move left / right | `←` `→` |
| Jump (double / triple) | `Space` |
| Drop through platform | `↓` + `Space` |
| Enter portal | `↑` |
| Dodge roll | `Shift` |
| Block / Parry | `A` |
| Quick dash | double-tap `←` or `→` |

### Combat

| Action | Key |
|---|---|
| Basic attack | `Z` |
| Skill 2 | `X` |
| Skill 3 | `S` |
| Skill 4 | `C` |
| Skill 5 | `D` |
| Job signature (Lv 10) | `F` |
| Job ultimate (Lv 10) | `V` |
| Master signature (Lv 20) | `G` |

### UI & utility

| Action | Key |
|---|---|
| Talk to NPC (when one is in range) | `N` |
| Codex / achievements (when no NPC is in range) | `N` |
| Open chest / pick up drop | `F` |
| Inventory | `B` |
| Character panel — Level Up / Boons / Skills | `K` or `U` |
| Help panel | `?` |
| Mute / unmute | `M` |
| HP / MP potion (3 s CD, buys with Lumen if none) | `R` / `T` (or `PgUp` / `PgDn`) |
| Reset save (confirms) | `9` |
| Re-pick job / master | `0` |
| Dev console | hold `1` + `2` + `3` |

> `N` is context-aware: next to an NPC it opens their dialog, otherwise it opens the Codex. `F` is reserved for chest / pickup / job signature skill — pressing `F` next to an NPC still talks as a legacy fallback, but `N` is the primary talk key.

## ⚔️ Classes

Pick one at character creation (gender toggle included), advance at level 10, master at level 20:

- **Warrior** → Berserker / Knight → Warlord, Doombringer, Crusader, Dragoon
- **Rogue** → Ninja / Assassin → Shadowlord, Shinobi, Nightreaper, Phantom
- **Mage** → Archmage / Warlock → Sage, Elementalist, Lich, Hexmaster
- **Archer** → Sniper / Ranger → Marksman, Ballista, Beastmaster, Skyhunter

Each class has a unique passive perk and a skill tree of 6 unlockable nodes branching across 3 tiers.

## 🗺️ World

Nine interconnected maps: Everdawn Village, Sunset Coast, Emerald Thicket, Fungal Hollow, Elderwood Grove, Sky Garden, Frozen Peak, Lava Cavern, plus two boss arenas (Gelwater Grotto, Queen's Hollow).

Every combat map gets a **mini-boss** (Elder variant of the strongest local mob) every 60–90 seconds. Mini-bosses drop guaranteed epic loot + a powerup orb.

## 🎁 Features

- **16 equipment affixes** (prefixes + suffixes) for roguelite-style randomized gear
- **Star enhancement** system (★0 → ★10) at Brok the Blacksmith
- **Skill tree** — 24 passive nodes across 4 classes
- **Job basic-skill enhancements** — choosing a job upgrades all your starter skills with unique effects
- **Procedural pixel-art character** — base body + hair/armor/cape/weapon/helmet/shield/boots overlays
- **In-browser sprite maker** (`sprite_maker.html`) — generate your own 40+ style variants
- **Death → respawn** at town with 50% Lumen penalty

## 🤝 Contributing

Branches, forks, and pull requests welcome. Every edit to `maple_game.html` is live-previewed just by opening the file. No build step.

## 📝 License

MIT
