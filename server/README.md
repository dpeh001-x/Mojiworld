# LevelX multiplayer server

A minimal WebSocket relay + presence hub for LevelX multiplayer. Runs as a single Node.js process — no database, no persistence. Rooms are created on first join, destroyed when the last player leaves.

## Local run

```sh
cd server
npm install
npm start
# [levelx-server] listening on port 8080
```

Then in the game, open the Multiplayer modal (🌐 button) and connect to `ws://localhost:8080`. The URL persists in `localStorage.levelx_mp_url` so you only enter it once.

## Protocol

All JSON frames over a single WebSocket connection.

### Client → Server

| `t` | fields | meaning |
|---|---|---|
| `hello` | `name, cls, job, master, level, map, room` | Join a room. Server responds with `welcome`. Room ids are lowercased and capped at 24 chars; default `lobby`. |
| `state` | `x, y, vx, vy, facing, map, hp, maxHp, mp, maxMp, level, cls, job, master, anim` | Movement / stat tick. Rate-limited to ≥ 40 ms per player on the server. |
| `chat` | `text` | Chat line. Trimmed, control chars stripped, capped at 200 chars. |
| `map` | `map` | Announce a map change so peers can hide the ghost. |
| `emote` | `kind` | Emoji glyph for emote bubble. |

### Server → Client

| `t` | fields | meaning |
|---|---|---|
| `welcome` | `id, room, players[]` | Your assigned id + everyone already in the room. |
| `joined` | `id, name, cls, …` | A new player entered your room. |
| `left` | `id` | A player disconnected. |
| `state` | `id, x, y, vx, vy, facing, map, …` | Peer position / stat update. |
| `chat` | `id, name, text` | Chat line (echoed to sender too). |
| `emote` | `id, kind` | Peer emoted. |
| `error` | `code, message` | e.g. `room_full`. |

## Limits

- **16 players / room.** Hard cap. Going higher needs a proper interest-management layer.
- **40 ms state-tick floor.** 25 Hz per player is plenty for WASD sync.
- **200-char chat cap.** Control characters are stripped.
- **60 s idle kick.** Sockets that send nothing for a minute get dropped.

## Deploy to Fly.io

A `Dockerfile` is included. One-shot deploy:

```sh
cd server
# First time only:
fly launch --no-deploy           # creates fly.toml; pick a name like levelx-mp
fly deploy
```

Fly.io's free allowance covers a single small instance. The server reads `process.env.PORT` so it works without config.

## Deploy to Railway

```sh
railway login
railway init
railway up
```

Railway also reads `PORT` from the platform. The included `Dockerfile` works out of the box.

## Deploy on any VPS

```sh
# On the box:
git clone <repo>
cd LevelX/server
npm ci
PORT=8080 node server.js
# Use pm2 / systemd / docker to keep it running
```

Put this behind a reverse proxy (nginx/caddy) with TLS. Browsers won't talk to a plain `ws://` endpoint from an HTTPS page — you need `wss://` in production.

## Health check

`GET /` or `GET /health` returns a JSON blob with version and room/player counts. Useful for load balancer probes.

## What this server does NOT do (yet)

- **Authoritative combat.** Monsters, damage, and loot are still client-side; everyone instances their own mobs. Future work: move combat simulation to the server.
- **Accounts / persistence.** There is no database. Sessions die when the server restarts.
- **Anti-cheat.** State coming from clients is trusted. Fine for co-op, bad for competitive.
- **Voice / party / guild.** Text chat only.

See `CHANGELOG.html` v0.24.0 for the client wiring and the full feature list.
