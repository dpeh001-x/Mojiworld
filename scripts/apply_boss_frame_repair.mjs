// Boss frames sliced by a straight vertical line - Libra and the Tower Arbiter (boss frame repair, 2026-10-15).
// ============================================================================
// Some boss animation frames had their art cut off by a hard straight vertical line, and the game draws every frame
// whole, so the cut showed on screen for that frame. Two kinds:
//   - a cut INSIDE the canvas (transparent room beyond it): the Tower Arbiter's sword tip (column 1, 8), gauntlet (column
//     2), crossguard tip (column 4), the light rays of his pillar strike (column 5, 6, 7 - frames 5-7 had been softened
//     with a fade, so the rays still all stopped on one line), the flame flicks and embers of his verdict (5, 6, 7) and
//     the sparks of his swing (attack 6);
//   - art running into the canvas BORDER: Libra's attack frames 5 and 6, whose light rays ran off the right edge.
// The fix is ART ONLY, shipped by the LX_APPLY2 half (scripts/apply_boss_frame_repair_assets.mjs): the repaired WEBPs
// replace the old ones under the same names, same canvas sizes, so frame sizes, bake bases and the anim calibration are
// untouched. Inside-canvas cuts: ludo.ai image edit continued the cut art past the line, and only the part beyond the cut
// (plus a 14 px feathered seam; the fade band on column 5-6) was blended back - the body stays pixel-identical. Libra:
// a deterministic taper (an alpha erosion that grows toward the border) ends every ray in a point 8 px before the edge -
// colours untouched, no new art, the same rule on both frames. data/sprite_edges.js is re-probed for the two Libra
// frames (their right edge no longer touches), sprite_bbox.js where a frame's top row moved, and sw.js's CACHE is bumped.
// This script only leaves the version marker in the game file (the pipeline needs a game change to version the ship).
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('BOSS FRAMES UN-SLICED')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

{
  const A = 'function _lxBossBakeBaseFor(subdir, type) {';
  once(A, J(
    '// v0.30.1776 boss-frame-repair - BOSS FRAMES UN-SLICED (art only, per user). Frames whose art a straight vertical line cut off',
    '// were repaired under their own names at their own canvas sizes, so this table, the anim calibration and the frame index',
    '// still hold: the Tower Arbiter\'s column 1/2/4/5/6/7/8, verdict 5/6/7 and attack 6 (the cut art continued past the line,',
    '// blended back beyond it only) and Libra\'s attack 5/6 (the rays taper to a point before the right border). The list, the',
    '// before/after hashes and the edge-table updates live in scripts/apply_boss_frame_repair_assets.mjs.',
    A), '_lxBossBakeBaseFor');
}

const grew = s.length - n0;
if (grew < 400 || grew > 1500) die('size moved ' + grew);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000000) die('tmp small');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code);
}
console.log('applied: boss-frame-repair (+' + grew + ' chars)');
