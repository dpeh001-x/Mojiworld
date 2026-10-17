// GRAVITOS FORM 3 RE-DRAWN WITH A STEADIER FACE (gravitos3-esrgan, 2026-10-17) - the game-file half (LX_APPLY).
// ============================================================================
// Per user ("Ship it", after a free local Real-ESRGAN sample showed a steadier face than the paid upscale that shipped in v0.30.1828).
// What players saw: since v0.30.1828 Gravitos's third form is sharp, but the paid AI upscaler re-invented small face details on every
// frame (the mouth and nose lines change shape between idle frames), so his face shimmered while he stood still.
// What changes (all in LX_APPLY2, scripts/apply_gravitos3_esrgan_bake.mjs - this file only carries the version marker and this note):
//   - ART: the same 69 form-3 frames re-made from the same pre-v0.30.1828 originals with the free Real-ESRGAN anime model (deblock,
//     x4 upscale, the SAME single reduction onto the same canvas with the same per-set alignment, the same light sharpen and encoding).
//     Two clean-ups: no pixel ends darker than the original's darkest pixel nearby (the model crushed near-black to pure black), and
//     the 2 px just inside the outline are lifted toward the original where the model drew a dark rim (flame edges).
//   - Every frame's outline (alpha) is v0.30.1828's byte for byte, so feet, size, reach and every pixel table built from the outline
//     stay as they are; calibration and hit boxes are untouched. sw.js CACHE +1 (frames replaced under their own names).
// No code, bake base, timing or AI moves. Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('GRAVITOS FORM 3 STEADIER FACE')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
{
  const A = 'function _lxBossBakeBaseFor(subdir, type) {';
  once(A, J(
    '// v0.30.1834 gravitos3-esrgan - GRAVITOS FORM 3 STEADIER FACE (per user: "Ship it"). The 69 form-3 frames are re-made from the same originals',
    '// with the free Real-ESRGAN anime upscaler instead of the paid one, which re-invented his mouth / nose lines on every frame (face shimmer).',
    '// Same canvases, same one-pass reduction and per-set alignment, same outline (alpha) byte for byte; near-black kept off pure black and the',
    '// dark rim inside the outline lifted. These bases are unchanged. Frames, tables, sw.js: scripts/apply_gravitos3_esrgan_bake.mjs (v0.30.1834 gravitos3-esrgan).',
    A), '_lxBossBakeBaseFor');
}
const grew = s.length - n0;
if (grew < 500 || grew > 1400) die('size moved ' + grew);
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
console.log('applied: gravitos3-esrgan (+' + grew + ' chars)');
