# Mojiworld → server-authoritative MMORPG roadmap

Snapshot v0.25.505. The client is a single 48k-line `mojiworld_game.html`. There's already a primitive multiplayer hook (`mpConnect` / `_mpTick` / `_mpHandle` at lines 12647–12798) that does position broadcast over a WebSocket — useful as the starting protocol but not as the security model.

This doc is **planning**, not code. Everything here is intentionally not-yet-implemented; the working single-player game stays the source of truth until each phase has a tested replacement.

## Threat model up front

The reason this is hard: every `Math.random()` that decides damage, drops, crits, or XP is currently authoritative on the client. A modified client wins the game in five minutes. The roadmap is structured around **moving authority server-side without breaking the offline single-player path**, so v0.25.505's core game keeps shipping while the MMO build emerges in parallel.

## Architecture target

```
┌─────────────────────────────┐         ┌──────────────────────────────────┐
│  Browser client             │  WSS    │  Game server (Node / Bun / Go)   │
│                             │ ◄─────► │                                  │
│  • Input → action commands  │         │  • Auth (HTTP)                   │
│  • Render + audio + UI      │         │  • Room (per-map) simulator       │
│  • Local prediction         │         │    – fixed 30 Hz tick            │
│  • Animation tween          │         │    – owns monsters, drops, RNG   │
│  • Particle / VFX           │         │    – validates skill casts       │
│                             │         │  • Persistence (Postgres)        │
│                             │         │  • Anti-cheat hooks              │
└─────────────────────────────┘         └──────────────────────────────────┘
                                                     │
                                                     ▼
                                          ┌──────────────────────┐
                                          │  Postgres            │
                                          │  – players row       │
                                          │  – inventories       │
                                          │  – audit log         │
                                          └──────────────────────┘
```

Three processes (auth, room sim, persistence) — separable later for scale, but ship them in one binary first.

## Phases

Each phase is independently shippable. Don't ship phase N+1 until N is healthy in production.

### Phase 0 — Decoupling (no behaviour change, ~1 week)

Goal: split the file into modules so server can import the bits it needs.

- Extract `MAPS`, `monsterTypes`, `SKILLS`, `EQUIPMENT_BASES`, `AFFIX_POOLS` into ES modules under `shared/` — these are pure data, no DOM.
- Extract `dmgRoll`, `rollCrit`, `rollDrop`, `rollAffixedItem`, `_maybeLevelUp`, level-curve math into `shared/sim/`.
- Extract collision helpers (`aabb`), platform check, gravity application, jump resolution into `shared/physics/`.
- The single-file `mojiworld_game.html` keeps working by inlining the modules at build time (esbuild bundle).

Why first: the server needs to run identical math. If "shared" code is duplicated between client and server, they will desync. One source.

### Phase 1 — Stateless auth + persistence (~1 week)

- HTTP service: `POST /signup`, `POST /login` → JWT.
- Postgres `players` table: id, username, password_hash, created_at + a `state JSONB` blob for the v0.25.504 save schema (`PLAYER_SAVE_FIELDS` + `GAME_SAVE_FIELDS` from line 12193).
- Replace `localStorage` save/load with HTTPS calls. Local cache stays as latency hide; server is source of truth on reconnect.
- The existing login screen at `#auth-overlay` already exists — wire it to real auth instead of the local-only stub.

Done when: a player can sign up on machine A, log in on machine B, and see the same character. No multiplayer yet — single-player just loads from server instead of localStorage.

### Phase 2 — Authoritative chat + presence (~3 days)

Easiest gameplay-irrelevant data to put on the server. Builds the room infrastructure without risking gameplay correctness.

- WebSocket gateway, JWT-authenticated.
- Rooms keyed by `mapId`. Player joins room on `loadMap`.
- Broadcast: chat, emotes, position, animation state — all the things `_mpTick` already sends.
- Server NEVER trusts position yet (it's just relayed). This phase is about presence, not authority.

Builds on existing `mpConnect/mpDisconnect/_mpHandle` (line 12647) — just point at the new WSS endpoint and add JWT.

### Phase 3 — Authoritative monsters (~2 weeks, the real work)

This is the hard one. Move monster simulation to the server.

- Server tick loop: 30 Hz fixed timestep.
- Per-map room owns the monster array. Spawn table runs server-side via `spawnFromMap` (line 14920) ported to shared/sim.
- Client-side monster array becomes a **replicated copy** — every server tick broadcasts changed mob positions (delta-encoded), HPs, AI states.
- Client keeps `updateMonsters` for interpolation between server snapshots, but monster AI decisions move server-side.
- Player-monster combat split:
  - Client sends `{ skillId, targetMobId, position }` on cast
  - Server validates: cooldown ready? MP available? mob in range? player not stunned/dead?
  - Server runs `hitMonster()` (line 22066) with server-side `Math.random()` for crit + damage roll
  - Server broadcasts: damage number, mob HP delta, drop spawn (if killed)
  - Client receives and animates — does NOT compute damage locally

Risks:
- Network latency = visible delay between cast and damage. Need predictive animation (play swing animation immediately on cast input, snap effect to server result).
- Tick-rate mismatch: client renders at 60 Hz, server ticks at 30 Hz → interpolate mob positions over 33 ms windows.

Done when: a single player + a single mob room desyncs by < 50 ms on a 100 ms RTT connection.

### Phase 4 — Authoritative drops, XP, levels, mesos (~1 week)

Now that the server runs damage, the kill-reward path is straightforward.

- Server-side `Math.random()` for drop tier, affix rolls (line 6990), elite roll (line 15012).
- Server computes XP/meso award per kill, broadcasts `{ playerId, expDelta, mesoDelta }`.
- Server computes level-up (`_maybeLevelUp`, line 22430) and broadcasts.
- Client `player.exp += X` becomes a broadcast handler, not a local mutation.
- Save scumming dies: server writes to DB on every meaningful state change (kill, level-up, item pickup) — a debounced flush like the current `_SAVE_DEBOUNCE_MS = 1500` (line 12244) is fine; reload from DB on reconnect.

### Phase 5 — Multi-player rooms + party system (~1 week)

The room infrastructure already exists (phase 2 + 3); this is gameplay glue.

- Multiple players in the same `mapId` see each other's positions, animations, damage numbers.
- Co-op XP bonus (`_coopXpMul`, line 22705) becomes server-validated.
- Party formation: invite + accept → shared XP bucket, drop visibility rules.
- PvP off by default; opt-in flag in player state.

### Phase 6 — Anti-cheat hardening (~ongoing)

- Rate-limit cast commands (max N per second per skill per player).
- Validate position deltas against max walk speed + jump arc per tick (snap-back if a player teleports faster than physics allows).
- Server-side audit log: every kill, drop, level-up, transaction → JSONB row. Catches outliers.
- Replay queue: store last 30 s of state per room for incident reconstruction.

## Hard things I'm explicitly punting on

- **Sharding**: one room = one process is fine until you hit ~50 players per map. After that, room subdivision or process spreading.
- **Voice chat**: out of scope.
- **Real-time PvP**: deserves its own simulation model (lockstep or rollback netcode). The above is designed for PvE co-op.
- **Mobile push notifications, friends list, achievements API**: ship after Phase 5.
- **Client-side prediction for own-player movement**: the existing client physics already runs predictively; the server just needs to validate, not recompute. Standard MMO pattern.

## What stays client-only (forever)

From the v0.25.504 audit, all of this is pure presentation and never needs to leave the browser:

- Particles, damage-number floats, after-images, smooth-FX trails, screen shake, camera (lines 6099–6119).
- Audio playback (every `audio.*` call, line 12500+).
- Animation pose tweens, hit-stop, blink-into-skin flashes.
- HUD layout, modals, inventory grid rendering, minimap.
- Cosmetic appearance (`player.look`, `player.lookCustom`, `player.cosmetics`).
- Cel-shading studio (key 6) and any other dev/edit-mode tools.

Server should not know or care about any of this.

## Existing code that already helps

- The save schema at lines 12191–12215 is a near-perfect Postgres column spec — port directly.
- `_mpTick` (line 12755) already runs at 100 ms intervals with delta-encoded position broadcast — bump frequency, add JWT, swap relay for authoritative.
- `_nearestTownId` BFS (line 16558) is a graph traversal over the map portal graph — useful for matchmaking ("put me in the nearest populated room").
- The death → respawn flow (`triggerDeath` line 16453, `respawnAtTown` line 16581) already centralises every death through one function — the right hook to grant server-authoritative death penalties.
- The save version field (`SAVE_VERSION`, line 12192) already exists for migration; bump it whenever the server schema breaks compatibility.

## Cost / time estimate (one engineer)

| Phase | Time | Risk |
|---|---|---|
| 0 — Module split | 1 week | Low (tooling work, no behaviour change) |
| 1 — Auth + DB | 1 week | Low (well-trodden) |
| 2 — Chat / presence | 3 days | Low |
| 3 — Authoritative monsters | 2 weeks | **High** (interpolation, latency hiding) |
| 4 — Drops / XP / mesos | 1 week | Medium |
| 5 — Multi-player rooms | 1 week | Medium (testing matrix) |
| 6 — Anti-cheat | ongoing | Medium |

**Total to first full MMO build: ~6–7 weeks of focused work.** Phases 0–2 can ship to production as "online single-player with chat" while 3–4 are in development.

## Recommended next concrete step

Phase 0, Step 1: extract `MAPS`, `monsterTypes`, `SKILLS` into separate `.js` files imported by `mojiworld_game.html` via `<script type="module">`. Single PR. No behaviour change. Confirms the build pipeline works end-to-end before the harder splits.

The single-file `mojiworld_game.html` constraint can be preserved with esbuild — bundle the modules back into one file for the static raw.githack URL while the server consumes them as ES modules directly.
