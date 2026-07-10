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
| `proj` | host→all | `{map, list:[enemy projectiles]}` | `_coopApplyProjectiles` |
| `haz` | host→all | `{map, list:[telegraphed hazards]}` | `_coopApplyHazards` |
| `hazhit` | host→all | `{map, x, r, d, c, sl}` | `_coopApplyHazHit` |
| `bosshit` | host→all | `{map, x, y, r, d, fr, sl, c}` | `_coopApplyBossHit` |
| `drop` | host→all | `{map, k, u, x, y, it/rr, nm, l}` | `_coopApplyDrop` |

All gated by same-map checks; ids are relay-assigned and echoed to everyone except
the sender.

## Certification status (automated 2-client live tests)

The co-op layer is exercised by real 2-browser Playwright tests against the relay
(`scripts/coop_*_test.mjs`). Current status — **90/90 passing** (run individually; a
back-to-back batch is timing-flaky under browser load — re-run a low suite alone):

- `coop_2client_test.mjs` (17/17): host election, full monster mirroring (matching
  uids, zero duplicates), shared HP (non-host damage reaches host + syncs back),
  shared kills + XP, host-side kills reaching the peer.
- `coop_edge_test.mjs` (10/10): solo fallback on a different map, switchover +
  local-purge when joining the host's map, host handoff (monsters survive, new
  host simulates).
- `coop_hardening_test.mjs` (7/7): forwarded damage is DEF-reduced host-side
  (10000 raw → 3333 vs DEF 600), host rejects damage in an invuln window, follower
  takes contact damage (no longer invincible).
- `coop_projectile_test.mjs` (8/8): host enemy projectiles mirror to the follower
  (damage + size preserved), the follower's own `updateProjectiles` applies RANGED
  damage, mirror removed when the host clears it, host injects no self-mirrors.
- `coop_hazard_test.mjs` (6/6): host meteor telegraphs mirror to the follower, the
  detonation `hazhit` strikes a follower standing in the radius (439 dmg), misses
  outside it, no page errors.
- `coop_bosshit_test.mjs` (9/9): %-maxHp proximity nuke hits in range / misses outside,
  arena-wide (r=0) hits anywhere, raw atk hit lands, i-frames negate, host no self-hit.
- `coop_elite_test.mjs` (7/7): a host Elite mirrors as an Elite (b===3), matching size/
  atk (not re-rolled to a plain mob).
- `coop_env_test.mjs` (7/7): host self-spawns timed lava hazards; a following guest
  spawns ZERO (no double-sim); the guest resumes local hazards when not following.
- `coop_loot_test.mjs` (9/9): follower receives item drops (full stats) + a boon-orb
  copy, coins excluded (no double-pay), picks up its copy (inventory grows).
- `coop_peerfeel_test.mjs` (6/6): peer seen, facing/anim on the wire, all render states
  don't throw, position interpolates toward the snapshot.

> The test harness pumps the outbound ticks (`_mpTick`/`_coopTickMonsters`) via
> `setInterval` because headless Chromium throttles `requestAnimationFrame`; all
> inbound handling and game logic run through the real code paths. In a real
> browser the rAF loop drives those ticks.

Fixed after the adversarial review + live tests (see git log): relay now forwards
`mon`/`dmg`/`kill` (was a total no-op) on all three relays; DEF/invuln/shield gates
applied host-side; followers take contact damage; follower duplicate/ghost mobs
purged; silent-host-drop re-election (~5s, was 30s); host-handoff uid collisions;
per-peer XP scaling + boss/bestiary progression.

v0.27.2 "sync ALL real-time elements" pass (5-dimension parallel-agent audit): closed
the remaining gaps a follower experienced differently from the host —
1. **Boss direct-hits** — 16 boss attacks wrote `player.hp` inside their AI tick
   (proximity nukes, ground quakes, cone bites, sustained fields), bypassing the
   projectile/hazard channels; a follower runs no boss AI, so it facetanked the whole
   moveset. Host now broadcasts each strike (`bosshit`); `_coopApplyBossHit` applies it
   to a follower in range — %-maxHp nukes as a fraction of the RECEIVER's maxHp (fair
   per-player), raw atk hits DEF-reducible, radius 0 = arena-wide. (raw hits carry the
   host's already-DEF-reduced value; a follower re-applies its own DEF → a slight
   over-reduction on the 2 raw sites — acceptable, guest still threatened.)
2. **Loot drops** — all drop creation lived in host-only `killMonster`, so guests saw
   ZERO gear/boon-orb loot. Host `_coopTickDrops` broadcasts item drops + boon orbs
   (`drop`); each guest gets its OWN instanced copy, picked up by its own pickup loop.
   Coins are NOT synced (guests are paid numerically via `kill`).
3. **Environmental double-sim** — timed lava/ceiling hazards + wind gusts ran locally
   on followers ON TOP of the host's synced mirrors (~2× hazards at unseen positions =
   unfair deaths). Spawning gated behind `!_coopFollowingHost()`; weather cosmetics
   still run.
4. **Elite variants** — the `mon` snapshot's `b` flag only carried boss/mini, so an
   Elite on the host re-rolled as a plain mob on the guest (wrong name/size/atk/hitbox +
   corrupt contact prediction). Folded elite into `b===3` (zero extra bytes).
5. **Remote-player feel** — peers rendered as a static, non-interpolated pill though
   facing/anim/vx/vy were on the wire. `_mpDrawPeers` now lerp-smooths position, flips
   by facing, walk-bobs, flashes a swing on attack, and greys/`DOWN`-tags a KO'd peer.
Live-certified 2-client: coop_bosshit 9/9, coop_elite 7/7, coop_env 7/7, coop_loot 9/9,
coop_peerfeel 6/6. Still cosmetic-only / deferred: monster status tints, enrage
particles, pet/summon rendering on peers, full player-projectile VFX, a revive mechanic,
chest-state sync (per-client chests are fine for casual co-op), portal auto-follow.

v0.27.1 Steam launch hunt (5-dimension parallel-agent audit): kill-frame idempotency
(a redelivered `kill` no longer double-awards XP/coins); all host-only guards fail
CLOSED (reject missing/mismatched sender id — the relay stamps id, so legit frames
still pass); mon/proj/haz/hazhit appliers ignore straggler frames once the follower
falls back to local sim (a late frame could purge freshly-spawned locals); orphan-
mirror cleanup now also drops mirrored enemy projectiles + hazards on host-leaves-map;
reconnect race fixed (stale `onclose` guarded by socket identity, can't clobber a live
reconnect). A parallel UI audit also fixed a first-session soft-lock (panels opened
over the class-select gate were unclosable) — see CHANGELOG v0.27.1.

## Known limitations / needs live human QA (v1)

The launch bug hunt hardened the co-op layer substantially (guest damage now equals
solo — the full hitMonster multiplier stack runs before the forward; DEF/invuln/
shield gates + an anti-one-shot cap host-side; host-only trust on mon/kill/proj; XP
with xpCurveMul + PQ damper; level-scaled coins; trackPickup progression; on-the-fly
uids for boss adds; orphan-mirror cleanup; **enemy-projectile sync**). Remaining are
minor polish:

1. **RANGED damage — DONE (projectile sync shipped).** The host now broadcasts enemy
   (monster-fired) projectiles; followers inject them into their own `game.projectiles`
   and the existing `updateProjectiles` collides them with the local player, so
   followers take ranged damage and co-op boss fights are no longer facetankable.
   Live-certified 2-client (`scripts/coop_projectile_test.mjs`, 8/8).
   **Ground HAZARDS — DONE (hazard sync shipped).** The host now also broadcasts
   telegraphed ground hazards (meteor reticles etc.) as visual `_coopMirror` hazards
   (`{t:'haz'}`) and, on detonation, a strike event (`{t:'hazhit'}`) that
   `_coopApplyHazHit` applies to the follower's player if they stand in the radius.
   Telegraph-heavy bosses (zodiac meteors) now threaten guests too. Live-certified
   2-client (`scripts/coop_hazard_test.mjs`, 6/6).
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
