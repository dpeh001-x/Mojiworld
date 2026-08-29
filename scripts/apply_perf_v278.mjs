// v0.30.278 — late-game lag: loot piles get a cull + a cap, and the render
// ladder gets one last rung for desktops that are still drowning.
// =============================================================================
// Per user: "improve on the multikill lag and boss fight lags".
//
// MEASURED first (headless probe host; the user's machine runs ~3.5x slower):
//
//   drawDrops ms/call by pile size:  0: 0.003   100: 0.18   300: 1.31
//   -> ~4.5ms/frame on the user's machine at 300 coins — ~15% of the whole
//      frame budget at 30fps, every frame, while an AoE-farm pile stands.
//   game.drops is the ONE combat queue _trimVisualQueues does not cap (an
//   80-kill wipe left 298 on the ground), and drawDrops the one per-frame
//   draw pass with no viewport cull.
//
//   The multikill wipe itself is fixed (v0.30.277: 55 -> ~12ms task). Its
//   aftermath spike was traced: main-thread events cap at 12ms Layout +
//   7.5ms MajorGC — the rest of the headless spike is raster, not game code.
//   A REAL boss fight (warrior melting Krook + Octobaby to 12%) measures
//   211-231fps / worst 16.5ms here — boss JS is simply not hot. What is left
//   for a machine like the user's is PIXELS, which is what the ladder's
//   resolution governor exists for — except it refuses to act at dpr 1.
//
// THE THREE CHANGES:
//
// 1. drawDrops culls off-camera drops, like every sibling draw pass
//    (drawProjectiles/Particles/DamageNumbers/Hazards all reject early).
//
// 2. _trimVisualQueues caps drops at 240 by MERGING the oldest coin into the
//    next-oldest coin (value summed, nothing the player earned is lost;
//    items / potions / boss noMagnet loot are never touched). A farm session
//    converges to a bounded pile instead of growing without limit.
//
// 3. LX_DRS floor 1.0 -> 0.75 on DESKTOP only. The governor is the ladder's
//    deliberate last resort — it only ever acts after veryLowFx is engaged
//    AND frames stay above 22ms — but at dpr 1 it declared "nothing to
//    trade" and gave up. A 0.75 step renders 44% fewer canvas pixels, which
//    is the one lever that scales with EVERYTHING (boss fights, wipes,
//    dense late-game maps). Mobile keeps floor 1.0 by construction, exactly
//    as the original design states — resolved at tick time because
//    _IS_MOBILE_AT_LOAD declares later in the file (TDZ at init).
//    The quarter-bucketed bake caches (v0.30.255/256) already re-key on any
//    scale change, and _lxApplyRenderScale is mechanically correct for any
//    dpr > 0 (verified: it just resizes the backing store + setTransform).
//
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);

if (s.includes('_lxDrsFloorNow') || s.includes('drop-pile cap')) { console.log('already applied'); process.exit(0); }

const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. drawDrops: viewport cull -------------------------------------------
sub('drops cull',
  "    const sx = d.x - game.camera.x;",
  J("    const sx = d.x - game.camera.x;",
    "    // v0.30.278 — off-camera drops draw nothing, like every sibling pass.",
    "    // Measured: 1.31ms/call at a 300-coin pile (~4.5ms on a weak machine),",
    "    // and drops sit in fixed piles so most of a big farm pile is off-screen",
    "    // the moment the player walks on.",
    "    if (sx < -40 || sx > W + 40) continue;"));

// ---- 2. _trimVisualQueues: coin-merge cap ----------------------------------
sub('drops cap',
  "  if (game._fadingMonsters && game._fadingMonsters.length > 24) {",
  J("  // v0.30.278 — drop-pile cap. drops was the ONE combat queue with no cap:",
    "  // an 80-kill wipe leaves ~300 on the ground and a farm session grows the",
    "  // pile without limit, paying draw + magnet-scan cost per coin per frame.",
    "  // Over 240, the oldest COIN merges its value into the next-oldest coin —",
    "  // the total the player earned is preserved exactly; items, potions and",
    "  // boss walk-over loot are never touched.",
    "  if (game.drops && game.drops.length > 240) {",
    "    for (let _di = 0; _di < game.drops.length - 1 && game.drops.length > 240; ) {",
    "      const _da = game.drops[_di];",
    "      if (!_da || _da.type !== 'mojicoin') { _di++; continue; }",
    "      let _dj = _di + 1;",
    "      while (_dj < game.drops.length && (!game.drops[_dj] || game.drops[_dj].type !== 'mojicoin')) _dj++;",
    "      if (_dj >= game.drops.length) break;   // fewer than two coins left — nothing mergeable",
    "      game.drops[_dj].value = (game.drops[_dj].value || 0) + (_da.value || 0);",
    "      game.drops.splice(_di, 1);",
    "    }",
    "  }",
    "  if (game._fadingMonsters && game._fadingMonsters.length > 24) {"));

// ---- 3. DRS: desktop floor 0.75 --------------------------------------------
sub('drs floor decl',
  "  floor: 1.0,",
  J("  floor: 1.0,          // mobile floor — desktop resolves via _lxDrsFloorNow() (v0.30.278)",
    "  floorDesktop: 0.75,  // v0.30.278 — one rung below native: 44% fewer pixels, the last resort after veryLowFx"));

sub('drs floor helper + gate',
  "  if (ceil <= 1.01) return;                          // nothing to trade at scale 1",
  J("  // v0.30.278 — the effective floor. Desktop may go BELOW native scale as a",
    "  // true last resort (the down-step still requires veryLowFx + sustained",
    "  // >22ms frames first); mobile keeps 1.0 by construction. Resolved here,",
    "  // not in the initializer: _IS_MOBILE_AT_LOAD declares later in the file.",
    "  const _floorNow = _lxDrsFloorNow();",
    "  if (ceil <= 1.01 && _floorNow >= 0.99) return;   // nothing to trade at scale 1 (mobile)"));

sub('drs down floor a',
  "  if (cur > LX_DRS.floor + 0.01",
  "  if (cur > _floorNow + 0.01");
sub('drs down floor b',
  "    const next = Math.max(LX_DRS.floor, Math.round((cur - 0.25) * 4) / 4);",
  "    const next = Math.max(_floorNow, Math.round((cur - 0.25) * 4) / 4);");

sub('drs helper fn',
  "function _lxDrsTick(frame, time) {",
  J("function _lxDrsFloorNow() {",
    "  return (typeof _IS_MOBILE_AT_LOAD !== 'undefined' && _IS_MOBILE_AT_LOAD) ? LX_DRS.floor : LX_DRS.floorDesktop;",
    "}",
    "function _lxDrsTick(frame, time) {"));

// ---- version bump -----------------------------------------------------------
sub('version', "GAME_VERSION = 'v0.30.277'", "GAME_VERSION = 'v0.30.278'");

const grew = s.length - n0;
if (grew < 1500 || grew > 4200) {
  console.error(`ABORT: content moved ${n0} -> ${s.length} chars (${grew}), expected roughly +2800`);
  process.exit(1);
}
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: drops cull + coin-merge cap + desktop DRS floor 0.75, v0.30.278 (${n0} -> ${s.length} chars, +${grew})`);
