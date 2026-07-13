# 🗡️ Mojiworld — The Everdawn Cycle

> _Once upon a time…_ a 2D action-platformer RPG with roguelite loot and **drop-in co-op**. Four classes, eight job advancements, sixteen master classes, branching skill trees, affix-roll gear, star enhancement, procedural dungeons, and mini-bosses — all in a single HTML file, no build step.

**Current build: v0.29.25.** The whole game lives in `mojiworld_game.html` (open it in a browser and play). Since the last README, the project has grown a full **shared-world co-op layer** (fight the *same* monsters with a friend via a Party Code) and a **Steam desktop wrapper** — see below.

## 🎮 Play

**Open `mojiworld_game.html` in any modern browser.** Solo play needs zero setup — no install, no server, no accounts.

Play the latest `main` build straight from GitHub (correct MIME, always the branch tip):

**▶ https://raw.githack.com/dpeh001-x/Mojiworld/main/mojiworld_game.html**

Reviewers can bookmark the stable preview build (whatever is currently under review):

**▶ https://raw.githack.com/dpeh001-x/Mojiworld/preview/mojiworld_game.html**

### Optional visual modes (URL params)

| Param | Effect |
|---|---|
| `?art=cinematic` | High-fidelity cinematic background pack |
| `?artfx=soft` / `?artfx=vivid` / `?artfx=noir` | Scene post-processing (off by default): colour grade, bloom, film grain, depth fog, god rays, foliage framing, animated sky-life |

The plain bitmap art reads cleaner without post-processing, so the FX passes are an opt-in for power users.

## 🤝 Co-op multiplayer

Co-op is the headline feature now — not just presence + chat, but a **shared, host-authoritative world**: you and a friend fight the *same* monsters, with the same HP and the same kills, and split the XP/coins on the same map.

**How it works:** the game ships with a relay baked in — just **name your hero** and share a **Party Code**. The lowest-id player in the party hosts and simulates all monsters; everyone else mirrors them. No accounts, no server-side anti-cheat — the right trust model for playing with people you know. Chat and emotes relay across everyone in the room, and each partner shows a health bar above their head.

### Running your own relay (optional)

The relay is a small Node WebSocket server (`server/`, `mp/`, and a Cloudflare Workers variant in `mp-cf/`). The `server/` build also adds optional accounts, password auth, and per-account save persistence (SQLite, zero native deps):

```sh
cd server
npm install
npm start          # [levelx-server] listening on :8080
```

In-game, click **🌐 Multi**, point it at your `ws://…` URL, name your hero, and enter a Party Code. See `server/README.md` for the full HTTP/WebSocket protocol and Fly.io / Railway / VPS deploy notes, and `COOP_NOTES.md` for the netcode design and invariants.

## 🖥️ Steam

A desktop build (casual co-op pivot) is in progress under `steam/` — it wraps the same `mojiworld_game.html` as a native app with the shipped relay baked in. See `STEAM.md` for the packaging + launch guide.

## 🎯 Controls

Press **`?`** in-game for the live keybind panel (always current), or **`K`** / **`U`** for the character panel with a per-class skill reference. Skills sit in a left-hand cluster so you can attack without leaving WASD-adjacent position.

### Movement

| Action | Key |
|---|---|
| Move left / right | `←` `→` |
| Jump (double / triple) | `Space` |
| Enter portal | `↑` |
| Drop through platform | `↓` |
| Dodge / avoid | `Shift` |
| Block / parry | `A` |
| Quick dash | double-tap `←` or `→` |

### Combat

| Action | Key |
|---|---|
| Basic attack | `Z` |
| Skill 2 / 3 | `X` `S` |
| Skill 4 / 5 | `C` `D` |
| Class signature (Lv 10) | `F` |
| Class ultimate (Lv 10) | `V` |
| Master signature (Lv 20) | `G` |

### UI & utility

| Action | Key |
|---|---|
| Talk to NPC | `N` |
| Open chest / pickup | `F` |
| Inventory | `B` |
| Character panel (Level Up / Boons / Skills) | `K` or `U` |
| Codex of Mojiworld | `Y` |
| Wardrobe (Fashionista) | `Q` |
| HP / MP potion | `PgUp` / `PgDn` |
| Mute / unmute | `M` |
| Close menus | `Esc` |
| Help panel | `?` |
| Change class / master | `0` |
| Reset save (confirms) | `T` |
| Dev console | hold `1` + `2` + `3` |

## ⚔️ Classes

Pick one at character creation (gender toggle included), advance at level 10, master at level 20:

- **Warrior** → Berserker / Knight → Warlord, Doombringer, Crusader, Dragoon
- **Rogue** → Ninja / Assassin → Shadowlord, Shinobi, Nightreaper, Phantom
- **Mage** → Archmage / Warlock → Sage, Elementalist, Lich, Hexmaster
- **Archer** → Sniper / Ranger → Marksman, Ballista, Beastmaster, Skyhunter

Each class has a unique passive perk and a skill tree of unlockable nodes across three tiers. Choosing a job upgrades all your starter skills with job-specific effects.

## 🗺️ World

A dozen-plus interconnected maps — a hub village plus combat zones and boss arenas, including Sunset Coast, Emerald Thicket, Fungal Hollow, Elderwood Grove, Sky Garden, Frozen Peak, Lava Cavern, Jade Grove, Frostbite Hollow, the Clockwork Underpass, Azure Academia, and the Bastion, plus boss arenas like Gelwater Grotto and Queen's Hollow.

Every combat map spawns a **mini-boss** (an Elder variant of the strongest local mob) on a timer, dropping guaranteed epic loot and a powerup orb.

## 🎁 Features

- **Affix-roll loot** — prefixes + suffixes for roguelite-style randomized gear
- **Star enhancement** (★0 → ★10) at Brok the Blacksmith
- **Skill trees** — passive nodes branching across three tiers per class
- **Job basic-skill enhancements** — advancing upgrades every starter skill
- **Procedural pixel-art character** — base body + hair / armor / cape / weapon / helmet / shield / boots overlays, plus a Wardrobe
- **In-browser sprite maker** (`sprite_maker.html`) — generate your own style variants
- **Shared-world co-op** — same monsters, HP, kills, and XP with a friend
- **Death → respawn** at town with a Lumen penalty

## 📄 Docs

- `CHANGELOG.html` — the canonical, human-facing release notes (open in a browser)
- `COOP_NOTES.md` — co-op netcode design, invariants, and limitations
- `STEAM.md` — desktop packaging + Steam launch guide
- `server/README.md` — relay/backend API and deploy instructions

## 🛠️ Contributing

Branches, forks, and pull requests welcome. Every edit to `mojiworld_game.html` is live-previewed just by opening the file — no build step. `mojiworld_game.html` is a single ~6 MB file edited by parallel sessions, so keep changes small, atomic, and committed frequently.

## 📝 License

MIT
