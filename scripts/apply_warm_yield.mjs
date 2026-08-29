// v0.30.279 — the asset cache-warmer now yields to gameplay.
// =============================================================================
// Per user: "further work on how we can reduce lag and improve smoothness and
// flow of gameplay".
//
// MEASURED. A 60s hitch-attribution probe (every frame >25ms recorded with
// what executed inside that exact frame) during genuine combat:
//
//   steady state:      212 fps · p95 8.3ms · p99 12.5ms  — pacing is CLEAN
//   but 34 hitches of 29-129ms, ALL clustered while the v0.26.x full-asset
//   cache warmer was sweeping: every hitch frame tagged with its fetches
//   (Sprites/monsters/idle/stormKitty_*, stump_*, thornmaw_*, ... — 3,319
//   fetches in the window) or sitting untagged between them.
//
//   Ruled out by the same probe: the save flush (2,552 bytes, 0.1ms —
//   nothing), localStorage traffic (96 writes, 3.6ms total over 60s).
//
// The warmer trickle-fetches the ~6.5k-file manifest (3 concurrent, 60ms
// steps) "so it never competes with gameplay" — but its guards (hidden tab,
// Save-Data, 2g) miss the one that matters: the FRAME BUDGET. On a machine
// already at 30fps the sweep runs for minutes straight through early play,
// which reads as "the game is just stuttery" — and then quietly stops being
// reproducible once the cache is warm.
//
// THE FIX: the pump yields while the player is actively IN GAME and frames
// are strained — LX_PERF.avgFrame > 17.5ms (below ~57fps) with the game
// unpaused parks the pump for 2.5s and checks again. Menus, pause screens
// and healthy machines warm exactly as before; the cursor keeps its resume
// behavior, so a weak machine still finishes warming — during the moments
// that don't cost gameplay. avgFrame is the same EWMA the lowFx ladder
// trusts, maintained by _perfTick every simulated frame.
//
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);

if (s.includes('warm-yield')) { console.log('already applied'); process.exit(0); }

const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

sub('pump yield gate',
  J("        const pump = () => {",
    "          if (document.hidden) { setTimeout(pump, 5000); return; }"),
  J("        const pump = () => {",
    "          if (document.hidden) { setTimeout(pump, 5000); return; }",
    "          // v0.30.279 warm-yield — the guard list above (hidden tab, Save-Data,",
    "          // 2g) missed the one that matters: the frame budget. Measured: every",
    "          // 29-129ms hitch in a 60s combat window carried this sweep's fetches.",
    "          // While the player is actively in game and frames are strained",
    "          // (avgFrame > 17.5ms = below ~57fps — the same EWMA the lowFx ladder",
    "          // trusts), park and re-check; menus, pause and healthy machines warm",
    "          // exactly as before, and the cursor still resumes across sessions.",
    "          if (typeof LX_PERF !== 'undefined' && LX_PERF.avgFrame > 17.5",
    "              && typeof game !== 'undefined' && game && game.paused === false) {",
    "            setTimeout(pump, 2500); return;",
    "          }"));

// ---- version bump -----------------------------------------------------------
sub('version', "GAME_VERSION = 'v0.30.278'", "GAME_VERSION = 'v0.30.279'");

const grew = s.length - n0;
if (grew < 500 || grew > 1600) {
  console.error(`ABORT: content moved ${n0} -> ${s.length} chars (${grew}), expected roughly +900`);
  process.exit(1);
}
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: cache-warm gameplay yield, v0.30.279 (${n0} -> ${s.length} chars, +${grew})`);
