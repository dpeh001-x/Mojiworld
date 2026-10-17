// GRAVITOS FORM 3 IN HIGH DEFINITION (gravitos3-hq, 2026-10-17) - the game-file half (LX_APPLY).
// ============================================================================
// Per user: "lets use the current calibrations as I see on the current link's, just need to make the sprite art of the gravitos3
// more HQ", then (from a sample sheet) method A: "Remove the compression blocks, AI upscale, shrink back, light sharpen" - the slight
// shimmer on his face between frames accepted.
// What players saw: Gravitos's third form was soft and blocky next to forms 1 and 2. Its 69 frames were made from 720p video (a 1.5x
// upscale) and saved with visible 4x4 compression blocks, and the game draws form 3 at about 1 source pixel per screen pixel, so
// nothing hid it.
// What changes (all in LX_APPLY2, scripts/apply_gravitos3_hq_bake.mjs - this file only carries the version marker and this note):
//   - ART: all 69 form-3 frames (idle, walk, the slam, the fire beam, the punch, the soul drain, the supernova) re-drawn sharp: each
//     frame deblocked, upscaled 4K by an AI upscaler, reduced ONCE onto its unchanged canvas and lightly sharpened. Every frame keeps
//     the approved outline byte for byte (alpha copied from the approved alignment), so feet, size and reach stay where they were tuned.
//   - ALIGNMENT (the user-approved "default-aligned" calibration): the slam, fire beam and punch sets are scaled once (x1.0062 /
//     x1.0065 / x1.0061 about the back heel) and the slam, beam, punch and soul drain nudged 1.65-3 px so each set's first frame
//     stands exactly where idle's does; his one calibration stands 0.013 deeper (feet on the floor); the supernova is drawn at idle's
//     size (s 1.3 -> 1.0485) with its hit region scaled to stay the same box in the world.
// No bake base, timing or AI moves. Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('GRAVITOS FORM 3 IN HIGH DEFINITION')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
{
  const A = 'function _lxBossBakeBaseFor(subdir, type) {';
  once(A, J(
    '// v0.30.1828 gravitos3-hq - GRAVITOS FORM 3 IN HIGH DEFINITION (per user: "make the sprite art of the gravitos3 more HQ", keeping the approved',
    '// alignment). His 69 form-3 frames were soft video frames with 4x4 compression blocks, drawn at ~1 source px per screen px. Each frame is now',
    '// deblocked, AI-upscaled to 4K, reduced once onto its own unchanged canvas and lightly sharpened; its outline (alpha) is the approved one byte',
    '// for byte. The slam / beam / punch / soul-drain sets carry the approved one-transform alignment (frame 0 on idle\'s), form 3\'s one calibration',
    '// stands 0.013 deeper and the supernova is drawn at idle\'s size (s 1.0485, its hit region scaled to the same world box). These bases are',
    '// unchanged (same canvases). Frames, tables, calibration and test pins: scripts/apply_gravitos3_hq_bake.mjs (v0.30.1828 gravitos3-hq).',
    A), '_lxBossBakeBaseFor');
}
const grew = s.length - n0;
if (grew < 700 || grew > 1600) die('size moved ' + grew);
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
console.log('applied: gravitos3-hq (+' + grew + ' chars)');
