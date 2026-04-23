# 🗡️ LevelX — Shardfall Expedition

A 2D action-platformer RPG with roguelite elements. Four classes, eight job advancements, sixteen master classes, skill trees, affix-roll loot, star enhancement, procedural dungeons, and mini-bosses.

## 🎮 Play

**Open `maple_game.html` in a browser.** No build step, no server.

Live play URL (once GitHub Pages is enabled): **https://dpeh001-x.github.io/LevelX/maple_game.html**

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
| Interact / Talk (next to NPC) | `F` |
| Inventory | `B` |
| Level-up panel | `K` or `U` |
| Skill reference | `I` |
| Codex / achievements | `N` |
| Help panel | `?` |
| Mute / unmute | `M` |
| HP / MP potion (3 s CD, buys with Lumen if none) | `R` / `T` (or `PgUp` / `PgDn`) |
| Reset save (confirms) | `9` |
| Re-pick job / master | `0` |
| Dev console | hold `1` + `2` + `3` |

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
