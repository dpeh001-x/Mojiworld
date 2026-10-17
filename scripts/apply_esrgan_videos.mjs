// SHARPER BACKDROP CLIPS (esrgan-videos, 2026-10-17) - the game-file half (LX_APPLY).
// ============================================================================
// Per user: upscale the backdrop videos for free with the local AI upscaler (Real-ESRGAN), frame by frame, then picked option B:
// the 1080-class encode at crf 23 (13.5 MB for all five, smaller than before).
// What players saw: the five looping backdrop clips were 832-1344 px wide but drawn up to 2376 px (Everdawn Central) - soft.
// What changes (all in LX_APPLY2, scripts/apply_esrgan_videos_bake.mjs - this file only carries the version marker and this note):
//   - CLIPS: everdawn.mp4 1280x720 -> 1920x1080, weightbearerStair.mp4 1344x768 -> 1890x1080, gravitos / gravitosfinale /
//     thevoid.mp4 832x464 -> 1872x1044 - every frame upscaled by realesr-animevideov3, reduced once, tone-matched to its own
//     source frame (no brightness or colour drift), the Void's faint star dust kept from the source; re-encoded h264 High yuv420p
//     mp4 + faststart, no audio, the same frame rate, frame count, duration and seamless loop. Each keeps its exact old ASPECT,
//     and every clip draw sizes from the aspect (the bg slot, the bgNoMirror travel, the Void's cover-fit, the Stair sphere's
//     fractions), so each lands in exactly the box it did. sw.js is not bumped: the worker never caches .mp4 (films stay network-only).
// No draw code moves. Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('SHARPER BACKDROP CLIPS (esrgan-videos)')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
{
  const A = 'const _LX_MAP_VIDEO = {';
  once(A, J(
    '// v0.30.1837 esrgan-videos - SHARPER BACKDROP CLIPS (esrgan-videos). The five clips are AI-upscaled frame by frame at their EXACT old aspect',
    '// (the sizes in the notes below and in the Void\'s are the pre-upscale ones): everdawn 1920x1080, weightbearerStair 1890x1080, gravitos /',
    '// gravitosfinale / thevoid 1872x1044 - same codec, frame rate, frame count, duration and loop. Every draw sizes from the aspect, so nothing moves.',
    A), '_LX_MAP_VIDEO');
}
const grew = s.length - n0;
if (grew < 300 || grew > 900) die('size moved ' + grew);
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
console.log('applied: esrgan-videos (+' + grew + ' chars)');
