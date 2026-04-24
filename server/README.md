# LevelX backend server (v0.25.0)

Node.js WebSocket + HTTP server with **accounts**, **password authentication**, **session tokens**, **per-account save persistence**, and a **room-based WebSocket relay** for multiplayer presence and chat.

- Stack: Node 22+, `ws`. Uses Node's built-in `node:sqlite` (experimental in 22, stable in 24+) — no native module compile, zero extra deps.
- Storage: a single SQLite database file (`./data/levelx.db` by default).
- Passwords hashed with Node's built-in `crypto.scrypt` (OWASP-approved).
- Session tokens are HMAC-signed JWT-lite — stateless, no session table.
- OAuth columns (`oauth_provider`, `oauth_subject`) exist on the accounts table so Google/Discord SSO can drop in later without a schema change.
- WebSocket auth is **optional** — an unauthenticated "guest" socket can still join rooms, chat, and see peers. Logging in just upgrades the socket to an account so server-side saves work.

## Quick start (local)

```sh
cd server
npm install
cp .env.example .env       # optional; generate a SECRET for persistent sessions
npm start
# [levelx-server v0.25.0] listening on :8080
```

Health check: `curl http://localhost:8080/health`

Open the game (`maple_game.html`), click **🌐 Multi**, connect to `ws://localhost:8080`, pick a room name.

## HTTP API

All bodies + responses are JSON. Authenticated routes expect `Authorization: Bearer <token>`.

| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| `GET` | `/` · `/health` | — | `{ ok, version, rooms, totalPlayers, accounts, saves }` | Load-balancer probe. |
| `POST` | `/api/register` | `{ username, password, email? }` | `201 { token, user }` or `400/409 { error }` | Username 3-20 `[a-zA-Z0-9_]`, password 8-200 chars, email optional. Rate-limited to 5/min/IP. |
| `POST` | `/api/login` | `{ username, password }` | `200 { token, user }` or `401 { error }` | Rate-limited to 10/min/IP. Uniform 401 on any failure. |
| `POST` | `/api/logout` | — | `{ ok }` | Advisory — tokens are stateless. Clients just drop the token. |
| `GET` | `/api/me` | — | `{ user }` or `401` | Who am I? |
| `GET` | `/api/save` | — | `{ data, updatedAt }` or `401` | Fetch the player's server-side save. |
| `PUT` | `/api/save` | JSON object | `{ ok, updatedAt }` or `401/400` | Store a save blob. 2 MB request cap, 1 MB DB cap. |
| `DELETE` | `/api/account` | — | `{ ok }` or `401/404` | Self-service account delete (cascades to save). |
| `ALL` | `/api/oauth/:provider` | — | `501` | Stub — OAuth flow not implemented yet. |

CORS is fully open (`Access-Control-Allow-Origin: *`) — tighten per deploy if you want.

## WebSocket protocol (unchanged wire format + one new auth message)

### Client → Server

| `t` | fields | meaning |
|---|---|---|
| `auth` | `token` | Promote the socket to an authed account. Response: `auth_ok` or `error`. Optional — skip for guest mode. |
| `hello` | `name, cls, job, master, level, map, room` | Join a room. Server replies with `welcome`. |
| `state` | `x, y, vx, vy, facing, map, hp, maxHp, mp, maxMp, level, cls, job, master, anim` | Movement / stat tick. Server-side rate-limit ≥ 40 ms/player. |
| `chat` | `text` | 60-char max (client enforces). Server trims to 200. |
| `map` | `map` | Announce map change so peers can hide the ghost. |
| `emote` | `kind` | Emoji glyph for emote bubble. |
| `save` | `data` | Persist save blob server-side. Requires prior `auth`. |

### Server → Client

| `t` | fields | meaning |
|---|---|---|
| `auth_ok` | `user` | After successful `auth`. |
| `welcome` | `id, room, players[], authed` | You joined a room. |
| `joined` | `id, name, cls, …` | New player entered the room. |
| `left` | `id` | A player disconnected. |
| `state` | `id, x, y, vx, vy, facing, map, …` | Peer state. |
| `chat` | `id, name, text` | Chat message (echoed to sender). |
| `emote` | `id, kind` | Peer emoted. |
| `save_ok` | `updatedAt` | After `save`. |
| `error` | `code, message` | e.g. `room_full`, `bad_token`, `unauthed`. |

## Environment variables

See `.env.example`.

| Var | Default | Required in prod | Notes |
|---|---|---|---|
| `SECRET` | ephemeral | **yes** | HMAC signing key for session tokens. `openssl rand -hex 32`. |
| `PORT` | `8080` | no | Platforms inject their own. |
| `DB_PATH` | `./data/levelx.db` | no | Mount a volume at this path for persistence. |
| `SESSION_TTL_DAYS` | `30` | no | Token lifetime. |
| `MAX_PER_ROOM` | `16` | no | Room hard cap. |
| `MAX_CHAT_LEN` | `200` | no | Server-side chat trim (clients cap at 60 already). |
| `MAX_NAME_LEN` | `20` | no | Display-name trim. |
| `NODE_ENV` | `development` | **set to `production` on deploy** | Missing `SECRET` in prod = hard fail. |

## Deploy

### Fly.io

```sh
cd server
cp fly.toml.example fly.toml
fly launch --no-deploy
fly volumes create levelx_data --size 1
fly secrets set SECRET=$(openssl rand -hex 32)
fly deploy
```

The volume mount at `/app/data` keeps the SQLite DB across redeploys. Fly's free tier covers a single small instance.

### Railway

```sh
cd server
cp railway.json.example railway.json
railway login
railway init
railway variables set SECRET=$(openssl rand -hex 32)
railway variables set NODE_ENV=production
railway variables set DB_PATH=/data/levelx.db
railway volume create --mount /data --size 1GB
railway up
```

### Any VPS (systemd example)

```sh
# On the box:
git clone <your-repo>
cd LevelX/server
npm ci
export SECRET=$(openssl rand -hex 32)
export NODE_ENV=production
export DB_PATH=/var/lib/levelx/levelx.db
mkdir -p /var/lib/levelx
node server.js
# Put this behind nginx/caddy with TLS so browsers can talk to wss://.
```

Systemd unit sketch:

```ini
[Unit]
Description=LevelX game server
After=network.target

[Service]
User=levelx
WorkingDirectory=/opt/LevelX/server
Environment=SECRET=CHANGE_ME
Environment=NODE_ENV=production
Environment=DB_PATH=/var/lib/levelx/levelx.db
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Browsers require `wss://` (TLS) when the game is served over HTTPS. Put the server behind a reverse proxy (nginx, caddy, Cloudflare) and terminate TLS there.

## Database schema

```sql
CREATE TABLE accounts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email          TEXT UNIQUE COLLATE NOCASE,
  password_hash  BLOB,
  password_salt  BLOB,
  created_at     INTEGER NOT NULL,
  last_login_at  INTEGER,
  oauth_provider TEXT,
  oauth_subject  TEXT,
  UNIQUE (oauth_provider, oauth_subject)
);

CREATE TABLE saves (
  account_id INTEGER PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
```

## Security notes

- Passwords use **scrypt** (Node stdlib) with 16-byte random per-password salts. 64-byte output. No pepper (yet).
- Verification is **constant-time** (`crypto.timingSafeEqual`).
- Session tokens are **stateless HMAC-SHA256** signed JSON — no server-side session table, no refresh complexity. Rotation is handled by letting tokens expire (default 30 days).
- **No revocation list** in this iteration. Stolen tokens are valid until expiry. Add a `revoked_tokens` table if this becomes critical.
- **Rate limits** are in-memory (per-process). For multi-instance deploys, move to Redis.
- CORS is wide open — tighten to your game's origin when you deploy publicly.
- `/api/oauth/*` is a stub returning `501`. Do NOT enable it until the flow is implemented.

## What's still missing (next milestone)

- **Authoritative combat.** Mobs + damage + loot are still client-side; every client instances their own monsters.
- **Client-side login UI.** The current game client still runs as a guest. v0.25.1 will wire the register/login forms into the Multiplayer modal and start syncing saves via `/api/save`.
- **Trading / parties / guilds.** Social layer beyond chat.
- **Anti-cheat.** Server trusts client state. Fine for co-op with friends; bad for competitive PvP.
- **Email verification / password reset.** Skipped entirely — add an SMTP provider and `reset_tokens` table when you want it.
