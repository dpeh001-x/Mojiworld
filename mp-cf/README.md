# Mojiworld multiplayer — Cloudflare Durable Objects (stable MMO-lite)

The stable, always-on home for multiplayer, on **your own Cloudflare account**
(the same place your studio site lives). A single **Durable Object** holds all
rooms in memory — a port of the fidelity-tested relay in [`../mp/server.mjs`](../mp/server.mjs) —
and **persists per-player saves** to DO storage, so a returning player respawns
where they logged off.

Why this over the Render relay:
- **No cold start.** A DO spins up in ~ms on first connect and stays warm while
  players are on — vs Render free's ~30-60 s wake.
- **Persistent.** Saves survive restarts/deploys (DO storage, SQLite-backed).
- **Free-tier friendly** and scales by room later (shard the single DO by channel).
- Same `wss://` protocol the in-game client already speaks — **co-op works with no
  game changes**; persistence needs one small client hook (below).

## Deploy (your Cloudflare account — ~3 min)

```bash
cd mp-cf
npm install
npx wrangler login        # opens a browser to authorize your Cloudflare account
npx wrangler deploy
```

You get a URL like `https://mojiworld-mp.<your-subdomain>.workers.dev`. The
WebSocket endpoint is the same host with **`wss://`**:
`wss://mojiworld-mp.<your-subdomain>.workers.dev`.

**Point the game at it** (one Actions variable; I can run this for you):

```bash
gh variable set MP_WSS_URL --body "wss://mojiworld-mp.<your-subdomain>.workers.dev"
```

…then redeploy Pages. The in-game **🌐 Multi → Connect** now uses the DO.

### Own-domain endpoint (optional)
To serve it from `mp.moji-studios.com` instead of `*.workers.dev`, uncomment the
`[[routes]]` block in `wrangler.toml`, add a Cloudflare DNS record for `mp`, and
redeploy. Set `MP_WSS_URL = wss://mp.moji-studios.com`.

## Verify locally

```bash
npx wrangler dev --port 8789          # miniflare emulates the DO + WebSockets
node _cf_test.mjs                     # 13 assertions: protocol + persistence
```

## Persistence — the one remaining client hook

The DO **already stores and returns saves** (verified). To make the game *use*
them, the in-game `net` client needs two tiny additions (a deliberate next step,
because it overrides the existing single-player `localStorage` save and that
reconciliation is a design choice):

1. **Send a stable token** in the `hello` (so the server knows which save is
   yours): add `token: <a uuid persisted in localStorage>` to the hello object in
   `mpConnect` (`mojiworld_game.html`).
2. **Apply the save on welcome:** in `_mpHandle`'s `welcome` case, if `msg.you` is
   present, restore `player.x/y` (and optionally map/level) from it.

Until then the DO runs as a stable always-on relay (co-op works); saves are stored
server-side but not yet applied on login.

## Cost / scaling notes

- WebSocket messages count toward Workers usage. A single global DO is plenty for
  MMO-lite; if you outgrow it, shard by channel (route each `__ch<N>` to its own
  DO via `idFromName(channel)`).
- For lower cost at idle, switch to the **WebSocket Hibernation API**
  (`state.acceptWebSocket`) — more complex (in-memory room maps must be rebuilt
  from `getWebSockets()`), so deferred until traffic justifies it.

## Launch hardening (mp-relay, 2026-09-27)

- **Frame cap:** inbound frames over 64 KB are dropped unread; the sender gets one `error{code:'frame_too_large'}`.
- **Room cap:** 5 players per party-code room (the game's party of five); 50 per public lobby channel
  (`lobby__ch1..5`, under the game's 64-peer view; the game moves a player on from a full one). Counted per player
  token, so a re-join past your own half-dead socket or a second tab is never locked out; 2x cap sockets is the
  hard bound. `error{code:'room_full'}` + close.
- **Hibernation API:** sockets are `state.acceptWebSocket()`ed; an idle DO is evicted (no duration billed) and
  rebuilt from per-socket attachments on wake. The game's `{"t":"ka"}` keepalive is answered by the runtime.
  The reaper is an alarm (was a `setInterval` that kept the DO awake); positions save on leave and at most once a
  minute while connected, only when changed (was every 15 s).
- **Per-room Durable Objects (opt-in):** a socket dialled as `wss://<host>/?room=<room id>` goes to
  `idFromName('room:' + id)`. The shipped client dials the bare URL and names its room only in `hello`, so it
  stays on the `global` DO together with the whole `/api`. Moving the client to `?room=` is a separate, coordinated
  change: members of one party on old and new builds would otherwise sit in different DOs.
- **Auth:** PBKDF2-SHA256 (100k) for new passwords; a legacy SHA-256 account is verified and re-hashed on its next
  good login; sessions expire after a year unused (sliding; older tokens start their clock on first use); one
  `401 Invalid username or password.` for unknown user and wrong password; an alarm sweeps lapsed `rl:` / `fail:` /
  `tok:` keys.
- **Tunables** (wrangler `[vars]`, bounded): `ROOM_CAP`, `LOBBY_CAP`, `IDLE_KILL_MS`, `SAVE_MS`, `TOKEN_TTL_MS`, `GC_MS`,
  `THROTTLE_MS`, `FAIL_TTL_MS`.
- **Rollback caution:** an account that logged in on this build is stored as PBKDF2; an older build cannot verify it.

## Files

| File | Role |
| --- | --- |
| `src/index.js` | Worker (routes WS to the DO) + `MojiRoom` Durable Object (relay + persistence) |
| `wrangler.toml` | Worker + DO config (SQLite class = free plan) |
| `_cf_test.mjs` | Local protocol + persistence test (13 assertions) |
