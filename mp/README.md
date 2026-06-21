# Mojiworld — multiplayer server

The game (`mojiworld_game.html`) **already ships a complete multiplayer client**:
a `net` object, `mpConnect()`, presence ticks (`_mpTick`, 70 ms), ghost-peer
rendering (`_mpDrawPeers`), a "🌐 Multi" panel with URL / name / room / channel
inputs, rooms, channels, chat, emotes, and co-op XP sharing. What it was missing
is a **server that speaks its protocol**. This directory is that server, plus a
lightweight test peer.

The game itself was **not modified** — it was already wired for this.

## Run it

```bash
cd mp
npm install
npm start          # serves the game + the WebSocket relay on :8080
```

Then, in **two** browsers / tabs:

1. Open `http://localhost:8080/mojiworld_game.html`
2. Start a character so you're in a real map (not the title screen — see note below)
3. Click **🌐 Multi**, enter URL `ws://localhost:8080`, a name, room `lobby`, **Connect**
4. Do the same in the second tab → you'll see each other move, chat, and emote.

> **Note — presence only broadcasts during active play.** The game calls
> `_mpTick()` inside the gated update block (`if (player.hp > 0 && !game.paused
> && !frozen)`). On the title/menu screen (`game.currentMap === 'void'`,
> `game.paused === true`) it connects and *receives* peers but doesn't send its
> own position until you're in-world. This is expected, not a bug.

### Lightweight test peer

Booting two full games is heavy. `http://localhost:8080/` serves `mp_demo.html`
— a tiny client that speaks the exact same protocol. Set its **room** and **map**
to match a running game (channel 1) and it appears in the game's world (and vice
versa). Great for quick checks.

## Protocol (defined by the in-game client)

| Dir | Message | Fields |
| --- | --- | --- |
| C→S | `hello` | name, room, cls, job, master, level, map, x, y, facing, hp, maxHp, mp, maxMp |
| C→S | `state` | x, y, vx, vy, facing, map, hp, maxHp, mp, maxMp, level, cls, job, master, anim |
| C→S | `chat` / `emote` | text / kind |
| S→C | `welcome` | id, room, players[] (full presence of everyone already in the room) |
| S→C | `joined` / `left` | id (+ presence on join) |
| S→C | `state` / `chat` / `emote` | server stamps the sender's `id` |

Rooms are `<baseRoom>__ch<channel>` — the client appends the channel, so
populations on different channels never see each other.

## Verify

```bash
node _smoke_test.mjs       # 10 assertions — protocol + channel isolation (server on :8080)
node _fid_regress.mjs      # 8 assertions — fidelity-audit fixes (server on :8108)
```

`_smoke_test` covers welcome, joined, state relay, **channel isolation**, chat,
and left. The live game path was additionally verified end-to-end: the real game
client connected, received a peer on the same map, rendered it via
`_mpDrawPeers()` without error, and its own `_mpTick()` broadcast reached the peer
(bidirectional).

## Hardening (from a parallel fidelity audit)

Five agents stress-tested the relay (protocol/field fidelity, room lifecycle,
load to N=100, fuzzing, connection lifecycle). Field fidelity was perfect (every
field the client sends survives byte-exact) and isolation/ordering were correct.
Six issues were found and fixed in `server.mjs`:

- **null-frame crash** — `JSON.parse('null')` then `msg.t` killed the process;
  now non-object frames are ignored and the handler is wrapped in try/catch.
- **silent half-open drops** — added a ping/pong heartbeat (`HB_MS`, default 15s)
  that `terminate()`s sockets that stop responding, so dead peers don't linger.
- **double-`hello` ghost/room leak** — one identity per socket; a second `hello`
  is ignored.
- **flood amplification** — per-socket token-bucket rate limit (`RATE`/`BURST`).
- **oversized/unsanitized input** — `maxPayload: 64 KB`; every relayed string
  field is control-char-stripped and capped (name no longer an XSS/relay-bomb).
- **unbounded send queues** — `state` (droppable, newest-wins) is shed to any
  socket whose `bufferedAmount` exceeds `MAX_BUFFERED`, bounding memory/latency.

Still **deferred** (bigger change, only matters past ~20–50 concurrent players in
one room): the per-message O(N²) fanout. The proper fix is tick-batched per-room
snapshots + map-scoped interest management; naive map-scoping alone regresses the
map-change case, so it's left for the authoritative-server rewrite below.

## Files

| File | Role |
| --- | --- |
| `server.mjs` | Hardened room-based presence relay + static host (one dep, `ws`) |
| `mp_demo.html` | Lightweight test peer (same protocol) |
| `_smoke_test.mjs` | Headless protocol test (10 assertions) |
| `_fid_regress.mjs` | Regression test for the audit fixes (8 assertions) |

## Deploy

The static game can stay on GitHub Pages, but the **server must run somewhere**
(Render / Fly.io / Railway / a VPS). Use `wss://` behind TLS and point the
in-game Multi panel URL at it. `PORT` is read from the environment.

## Toward true MMO-lite (persistent, authoritative)

This server is a **relay** — clients are authoritative for their own avatar,
which is right for co-op presence but trusts clients. To reach persistent
MMO-lite:

1. **Server-side saves.** Persist each account's position/level/inventory
   server-side (SQLite/Postgres), keyed on an authenticated account rather than
   the client's local save. Restore on `hello`.
2. **Authoritative movement & combat.** Accept *input* instead of positions;
   integrate movement and run monster/loot simulation on the server so the world
   is identical for everyone and cheat-resistant.
3. **Scale.** Swap the hand-rolled `ws` relay for **Colyseus** (rooms + schema
   state sync) or **PartyKit** (Cloudflare Durable Objects) when player counts grow.
