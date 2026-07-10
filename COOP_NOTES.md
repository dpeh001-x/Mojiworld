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

## Certification status (automated 2-client live tests)

The co-op layer is exercised by real 2-browser Playwright tests against the relay
(`scripts/coop_*_test.mjs`). Current status — **34/34 passing**:

- `coop_2client_test.mjs` (17/17): host election, full monster mirroring (matching
  uids, zero duplicates), shared HP (non-host damage reaches host + syncs back),
  shared kills + XP, host-side kills reaching the peer.
- `coop_edge_test.mjs` (10/10): solo fallback on a different map, switchover +
  local-purge when joining the host's map, host handoff (monsters survive, new
  host simulates).
- `coop_hardening_test.mjs` (7/7): forwarded damage is DEF-reduced host-side
  (10000 raw → 3333 vs DEF 600), host rejects damage in an invuln window, follower
  takes contact damage (no longer invincible).

> The test harness pumps the outbound ticks (`_mpTick`/`_coopTickMonsters`) via
> `setInterval` because headless Chromium throttles `requestAnimationFrame`; all
> inbound handling and game logic run through the real code paths. In a real
> browser the rAF loop drives those ticks.

Fixed after the adversarial review + live tests (see git log): relay now forwards
`mon`/`dmg`/`kill` (was a total no-op) on all three relays; DEF/invuln/shield gates
applied host-side; followers take contact damage; follower duplicate/ghost mobs
purged; silent-host-drop re-election (~5s, was 30s); host-handoff uid collisions;
per-peer XP scaling + boss/bestiary progression.

## Known limitations / needs live human QA (v1)

The launch bug hunt hardened the co-op layer substantially (guest damage now equals
solo — the full hitMonster multiplier stack runs before the forward; DEF/invuln/
shield gates + an anti-one-shot cap host-side; host-only trust on mon/kill; XP with
xpCurveMul + PQ damper; level-scaled coins; trackPickup progression; on-the-fly uids
for boss adds; orphan-mirror cleanup). One real gap remains, plus minor polish:

1. **⚠️ THE co-op launch decision — followers take no RANGED damage.** Followers
   take **contact** damage from mirrored monsters, but ranged/AoE/telegraph attacks
   (projectiles, meteors, hazards) are host-spawned and **not networked**, so a
   follower can facetank a ranged boss. Non-boss co-op is fine; **co-op BOSS fights
   are trivialized for guests.** Options before store-live: (a) implement enemy-
   projectile sync (the proper fix — a focused, separately-tested feature, ~contact-
   tick sized), or (b) **gate co-op entry on boss arenas** (host-only bosses) so the
   headline bosses aren't visibly broken. Do NOT ship co-op boss fights as-is.
2. **XP is approximate (fair, not identical).** Peers scale the host's base kill exp
   by their own xpBoost / early-level / event / xpCurveMul / PQ-damper; combo and
   prestige stay host-side (not networked).
3. **Dropped damage under extreme load.** `dmg` events share the relay's 40/s cap;
   a very-high-APM AoE build could shed a few hits. Batch per-tick if playtests show it.
4. **Fully-minimized host.** Alt-tabbed/occluded hosts keep simulating (Electron
   anti-throttle + powerSaveBlocker); a fully minimized host may slow rAF — followers
   detect the quiet host (~5s) and fall back to local sim, so nobody freezes.
5. **Boss-fight chrome on the mirror.** Mirrored bosses render, take shared damage,
   and the kill stamps the peer's bossDefeated + bestiary (trackPickup) — but the boss
   HP bar / intro cinematic on the follower needs a human eyeball in a live boss run.
6. **Setshards / boon pick on shared boss kills.** Guests don't yet receive Setshards
   or a boon pick from a host-landed boss kill (LOW; deferred).

## Test matrix (minimum before store-live)

- [ ] Two clients, same party code + relay, same map: same monsters, positions,
      shared HP, one death, both gain XP/coins.
- [ ] Host leaves → other client takes over, monsters keep simulating.
- [ ] Non-host walks to a different map → local monsters spawn (solo), no ghosts.
- [ ] Boss fight together: both see the boss, both damage it, both get credit.
- [ ] Disconnect mid-fight → non-host resumes solo cleanly.
- [ ] Sustained heavy AoE from the non-host → damage still registers on the host.
