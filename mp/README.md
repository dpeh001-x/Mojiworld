# Mojiworld — MMO-lite multiplayer prototype

A working proof-of-concept for turning Mojiworld into a persistent, shared-world
multiplayer game. It demonstrates the three primitives a single static HTML file
cannot provide on its own:

1. **Authoritative shared world** — a Node WebSocket server (`server.mjs`) holds
   the canonical player records and broadcasts the world to everyone at 20 Hz.
2. **Many players, realtime** — clients connect to a room, send their state at
   15 Hz, and render every other player with snapshot interpolation.
3. **Server-side persistence** — each player gets a token (in `localStorage`);
   the server saves their record to `players.json`, so position/HP/level survive
   a reload or reconnect. This is the defining MMO-lite feature `localStorage`
   alone can't give you (it's per-browser, not shared/authoritative).

> This is intentionally a **prototype**, kept entirely outside the 5.3 MB
> `mojiworld_game.html` so it can't trigger the file-safety / parallel-session
> hazards documented in `CLAUDE.md`. `mp_net.js` is written to drop straight
> into the real game (see *Integration* below).

## Run it

```bash
cd mp
npm install
npm start
# -> open http://localhost:8787/  in two tabs / browsers
```

Move with `WASD` / arrows. Each tab is a separate player. Reload a tab — the
server puts you back where you were.

## Verify the netcode (headless)

```bash
node _smoke_test.mjs      # server must be running
```

Drives two real WebSocket clients through the server and asserts: distinct IDs,
B receives A's broadcast position/anim/facing, and a reconnect with the same
token restores the saved position/HP/level. 7 assertions, exits non-zero on any
failure.

## Files

| File | Role |
| --- | --- |
| `server.mjs` | WebSocket server + static file host + JSON persistence + 20 Hz tick |
| `mp_net.js` | Reusable client module (`LXNet`) — connect, throttled send, interpolation. **No DOM/canvas assumptions** |
| `mp_demo.html` | Tiny canvas client that proves it end-to-end |
| `_smoke_test.mjs` | Headless two-client integration test |

## Integrating into `mojiworld_game.html`

`mp_net.js` is deliberately renderer-agnostic. On a dedicated gameplay branch:

1. Add `<script src="mp/mp_net.js"></script>` and call `LXNet.connect(...)` once.
2. In the main `loop()`, after `updatePlayer`, call
   `LXNet.sendState({ x: player.x, y: player.y, anim: player.anim, facing: player.facing, hp: player.hp, level: player.level })`.
3. After drawing the local player, iterate `LXNet.interpolated(performance.now())`
   and reuse the existing player-draw code to render each remote avatar.

Milestone order (lowest risk first): **see each other move** → shared chat/emotes
→ shared monsters & loot → server-side progression saves.

## Hardening toward a real MMO

The prototype trusts client-reported positions (semi-authoritative) to stay
small. To make it cheat-resistant and truly authoritative:

- **Send input, not position.** Clients send held keys; the server integrates
  movement in the tick loop and owns every coordinate.
- **Server-side combat.** Move monster simulation, damage, and loot rolls to the
  server so clients can only *request* actions.
- **Scale-up framework.** For real player counts, swap the hand-rolled `ws`
  server for **Colyseus** (rooms + schema state sync) or **PartyKit**
  (Cloudflare Durable Objects). `mp_net.js`'s message shape maps cleanly onto
  either.
- **Real persistence.** Replace `players.json` with SQLite/Postgres; key on an
  authenticated account rather than a `localStorage` token.

## Deploy

The static `mojiworld_game.html` can stay on GitHub Pages, but the **server must
run somewhere** (Render, Fly.io, Railway, or a PartyKit deploy). Point the client
at that host with `LXNet.connect({ url: 'wss://your-server.example' })`.
