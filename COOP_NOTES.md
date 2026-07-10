# Co-op netcode — design, invariants, and known limitations

_v0.27.0 — the "fight the same monsters together" layer. Read this before
touching multiplayer code or flipping the Steam store page live._

## Model: host-authoritative over a dumb relay

The WebSocket server (`mp/server.mjs`, `mp-cf/`, `server/`) is a **presence
relay** — it forwards JSON messages between clients in a room and simulates
nothing. Co-op is a **client convention** layered on top:

- The **host** = the client with the **lowest `net.myId`** in the party.
  Recomputed on `welcome` / `joined` / `left` (`_coopRecomputeHost`); self-heals
  when the host leaves (next-lowest id takes over).
- The **host** simulates all monsters (exactly as in solo) and broadcasts their
  state (`{t:'mon', ...}`, ~10 Hz) via `_coopTickMonsters`.
- A **non-host on the host's current map** (`_coopFollowingHost()` true):
  - does **not** spawn its own monsters — `spawnMonster` returns a harmless stub;
  - does **not** run monster AI — `updateMonsters` early-returns after cosmetic
    housekeeping;
  - **mirrors** the host's monsters by `uid` (`_coopApplyMonsters`);
  - **predicts** damage locally + **forwards** it to the host (`_coopSendDamage`);
    the host is authoritative (`_coopHostApplyDamage`) and re-syncs true HP;
  - gets XP/coins from the host's `{t:'kill'}` broadcast (`_coopApplyKill`).

## The one hard invariant: solo is untouched

Every hook gates on `_coopFollowingHost()` or `net.isHost`, and `_coopActive()`
requires `net.connected`. **When disconnected, all of it is a no-op** — solo play
is byte-identical to before the pivot. Do not add a co-op hook that can run while
`!net.connected`. This is the invariant that lets the game ship.

## Graceful degradation

- Not connected → solo.
- Connected + you're the host → you simulate + broadcast (same as solo, plus sync).
- Connected + non-host on the **host's** map → you mirror.
- Connected + non-host on a **different** map than the host → you simulate that map
  locally (solo-for-this-map). Split up freely; rejoin the host's map to share again.

## Message protocol (co-op additions)

| `t` | dir | payload | handler |
| --- | --- | --- | --- |
| `mon` | host→all | `{map, list:[{u,x,y,vx,vy,f,h,m,t,b}]}` | `_coopApplyMonsters` |
| `dmg` | non-host→host | `{u,d,c,k}` | `_coopHostApplyDamage` (host only) |
| `kill` | host→all | `{u,e,c,x,y,map}` | `_coopApplyKill` |

All gated by same-map checks; ids are relay-assigned and echoed to everyone except
the sender.

## Known limitations / needs-playtesting (v1)

These are deliberate v1 scope cuts or areas that need **2-client QA** before launch.
The adversarial review pass (see git log) tightened the crash/desync-critical ones;
the rest are tuning:

1. **Boss-fight UI on the mirror.** Mirrored bosses render + take shared damage, but
   boss-specific chrome (HP bar, intro cinematic, arena-lock, defeat trigger) is
   driven by the host's spawn path. Verify the non-host sees a boss HP bar / can
   register the kill for gates. (Review-tracked.)
2. **XP fairness.** Peers receive **base** `m.exp` / `m.mojicoins` from the kill
   broadcast (no per-peer multipliers); the host gets its full multiplier stack.
   Acceptable for casual; unify later if it feels off.
3. **Dropped damage under load.** `dmg` events share the relay's per-socket rate
   limit (40/s). A very fast attacker could have some hits dropped. Batch damage
   per tick if playtesting shows it.
4. **Host migration monster identity.** `uid` is per-client (`game._monUid`). On a
   host handoff the new host re-broadcasts its own uids; peers reconcile. Confirm no
   duplicate/ghost monsters across a handoff in a live test.
5. **Mirror cleanup on host map-change while you stay.** If the host leaves the map
   and you remain, its mirrors may briefly become local until your next map load.

## Test matrix (minimum before store-live)

- [ ] Two clients, same party code + relay, same map: same monsters, positions,
      shared HP, one death, both gain XP/coins.
- [ ] Host leaves → other client takes over, monsters keep simulating.
- [ ] Non-host walks to a different map → local monsters spawn (solo), no ghosts.
- [ ] Boss fight together: both see the boss, both damage it, both get credit.
- [ ] Disconnect mid-fight → non-host resumes solo cleanly.
- [ ] Sustained heavy AoE from the non-host → damage still registers on the host.
