// v0.30.281 (part 3) — Stage-1 swarm relief on the lowFx ladder.
// =============================================================================
// Per user: "there is alot of lag in the 1st stage".
//
// Measured in the Underpass (23-mech swarm live): p95 frame time 25.1ms vs
// 8.3ms in the forest on the same rig — the stage IS hitchy. Two named
// contributors: the asset cache-warmer colliding with the stage (161ms of
// fetch + pump in one 6s profile — already parked on strained machines by
// v0.30.279), and the densest swarm in the game (monsterCap 24, every mech
// animated) on top of the map's full background stack.
//
// The relief rides the existing ladder: when lowFx is engaged — i.e. the
// machine is already measurably struggling — the Underpass swarm cap drops
// 24 -> 16. Healthy machines keep the full Ticket-Panic density. Kill pacing
// barely moves: the respawn drip honors the cap and backfills on every kill,
// so the 150-kill count grinds at nearly the same rate with 8 fewer mechs
// alive (and drawn, and ticked) at any instant.
//
// _normMonsterCap is the single choke point — both the initial spawn pass
// and the respawn drip route through it.
//
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);

if (s.includes('STAGE-1 SWARM RELIEF')) { console.log('already applied'); process.exit(0); }

const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

sub('cap relief',
  J("function _normMonsterCap(raw) {",
    "  const base = raw || 15;",
    "  return Math.round(15 + (base - 15) * _SPAWN_VAR_KEEP);",
    "}"),
  J("function _normMonsterCap(raw) {",
    "  const base = raw || 15;",
    "  let _cap = Math.round(15 + (base - 15) * _SPAWN_VAR_KEEP);",
    "  // v0.30.281 — STAGE-1 SWARM RELIEF (per user: 'there is alot of lag in",
    "  // the 1st stage'). The Underpass runs the densest swarm in the game and",
    "  // measured p95 25ms vs the forest's 8ms. When lowFx is engaged — the",
    "  // machine is already struggling — hold 16 mechs alive instead of 24;",
    "  // the respawn drip backfills each kill, so the 150-kill grind paces",
    "  // almost identically with a third less to draw and tick per frame.",
    "  // Healthy machines keep the full Ticket-Panic density.",
    "  if (_cap > 16",
    "      && typeof game !== 'undefined' && game && game.currentMap === 'clockworkUnderpassLobby'",
    "      && typeof _perfLowFx === 'function' && _perfLowFx()) _cap = 16;",
    "  return _cap;",
    "}"));

const grew = s.length - n0;
if (grew < 400 || grew > 1400) {
  console.error(`ABORT: content moved ${n0} -> ${s.length} chars (${grew})`);
  process.exit(1);
}
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: stage-1 swarm relief (+${grew})`);
