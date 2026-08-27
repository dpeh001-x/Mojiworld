// The world map is not a shelter, and not an exit, while you are shackled.
// =============================================================================
// Per user: "can escape being chained by opening the world map".
//
// Two separate holes, and closing either alone leaves the escape intact:
//
//   PARKED   Opening any panel sets game.paused, and the shackle QTE ticks from
//            the update loop, so the SHACKLED card sat there with a stopped
//            clock. This is precisely the class v0.29.610 named for photo mode
//            ("photo mode is not a shelter ... the whole effect could be waited
//            out from inside the camera"), and it fixed it by keeping the timer
//            running. The map cannot be fixed that way, because of the second
//            hole.
//
//   CANCELLED  The map offers fast travel, and loadMap ends an active QTE with
//            _qteEnd(false). So you did not merely wait the shackle out - you
//            left, and it was cancelled outright with no consequence.
//
// Guard A blocks OPENING; guard B refuses TRAVEL. Both, because a map already
// open when the chains land would otherwise still be an exit, and because the
// travel gate is shared by other callers.
//
// Guard A sits in toggleWorldMap(), not on the W key: there are THREE entry
// points - the key handler, the HUD/gamepad route, and the quest auto-open -
// and guarding the key would have moved the hole rather than closed it.
// CLOSING is never blocked, so this cannot trap the panel open.
//
// Godmode is exempt, matching every other CC gate in the file.
//
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
if (s.includes('_lxShackledBlocksMap')) { console.log('already applied'); process.exit(0); }

const sub = (label, anchorRaw, afterRaw) => {
  const anchor = anchorRaw.split('\n').join(EOL);
  const after = afterRaw.split('\n').join(EOL);
  const c = s.split(anchor).length - 1;
  if (c !== 1) { console.error(`ABORT ${label}: anchor matched ${c}, expected 1`); process.exit(1); }
  s = s.replace(anchor, after);
};

// ---- shared predicate ------------------------------------------------------
sub('helper', 'function toggleWorldMap() {',
`// v0.30.x - shackled means shackled. Shared by the map's open gate and its
// fast-travel gate so the two can never drift apart. Godmode exempt, matching
// every other CC gate in this file.
function _lxShackledBlocksMap() {
  return (typeof _QTE !== 'undefined' && _QTE.active
          && typeof player !== 'undefined' && player && !player._god);
}
function toggleWorldMap() {`);

// ---- guard A: opening ------------------------------------------------------
// Placed AFTER the close branch, so closing an already-open map still works.
sub('open-gate', `  // v0.29.372 — close whatever else is up first (see toggleQuestJournal).
  // W over an open Quest Journal used to leave both panels live and stacked.
  if (typeof closeAllModals === 'function') closeAllModals();`,
`  // v0.30.x - THE MAP IS NOT A SHELTER (per user: "can escape being chained by
  // opening the world map"). Opening pauses the sim, and the shackle QTE ticks
  // in the update loop, so the SHACKLED card parked with a stopped clock - the
  // same shape v0.29.610 fixed for photo mode. Below the close branch on
  // purpose: closing is never blocked, so this cannot trap the panel open.
  if (_lxShackledBlocksMap()) {
    if (typeof showToast === 'function') showToast('\\u26D3\\uFE0F SHACKLED - break free first', 'danger');
    return;
  }
  // v0.29.372 — close whatever else is up first (see toggleQuestJournal).
  // W over an open Quest Journal used to leave both panels live and stacked.
  if (typeof closeAllModals === 'function') closeAllModals();`);

// ---- guard B: travelling ---------------------------------------------------
sub('travel-gate', `      const _md = (typeof MAPS !== 'undefined' && MAPS[id]) || m || {};
      if (_md.isBossArena && _md.taxiAccessible !== true) return { ok: false, reason: '🔒 walk in' };
      return { ok: true };`,
`      const _md = (typeof MAPS !== 'undefined' && MAPS[id]) || m || {};
      if (_md.isBossArena && _md.taxiAccessible !== true) return { ok: false, reason: '🔒 walk in' };
      // v0.30.x exploit FIX, same family as the two above: fast travel ENDED an
      // active shackle, because loadMap calls _qteEnd(false). A map opened
      // before the chains landed would still have been an exit, so the refusal
      // lives here as well as on the open gate.
      if (_lxShackledBlocksMap()) return { ok: false, reason: '\\u26D3\\uFE0F shackled' };
      return { ok: true };`);

writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size <= n0) { console.error('ABORT: tmp not larger'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: ${n0} -> ${s.length} chars`);
console.log('  guard A: toggleWorldMap refuses to OPEN while shackled');
console.log('  guard B: W-map fast travel refuses while shackled');
