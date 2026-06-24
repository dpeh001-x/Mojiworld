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

## Files

| File | Role |
| --- | --- |
| `src/index.js` | Worker (routes WS to the DO) + `MojiRoom` Durable Object (relay + persistence) |
| `wrangler.toml` | Worker + DO config (SQLite class = free plan) |
| `_cf_test.mjs` | Local protocol + persistence test (13 assertions) |
