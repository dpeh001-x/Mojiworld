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
node _smoke_test.mjs       # server must be running
```

10 assertions covering welcome, joined, state relay, **channel isolation**, chat,
and left. The live game path was additionally verified end-to-end: the real game
client connected, received a peer on the same map, rendered it via
`_mpDrawPeers()` without error, and its own `_mpTick()` broadcast reached the peer
(bidirectional).

## Files

| File | Role |
| --- | --- |
| `server.mjs` | Room-based presence relay + static host. ~90 lines, one dep (`ws`) |
| `mp_demo.html` | Lightweight test peer (same protocol) |
| `_smoke_test.mjs` | Headless protocol test |

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
