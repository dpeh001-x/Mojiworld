// Cinematics, re-encoded smaller (cinematic-slim), game-file half: a one-line marker only.
// ============================================================================
// Ten cinematics the game plays were 6-16 MB each (100.4 MiB together), served straight from GitHub Pages - the two
// prologue clips (clip_prologue_pov, clip_prologue_punch, ~10 MB each) play for EVERY new player, and eight of the ten
// had their index at the end of the file, so the browser had to fetch the tail before the first frame. They were
// re-encoded in place under their own names (H.264 High / yuv420p, CRF per clip for SSIM >= 0.985 vs the original,
// same resolution / fps / duration, audio untouched, +faststart): 22.5 MiB together now. The bytes ship through
// scripts/apply_cinematic_slim_assets.mjs (LX_APPLY2). No sw.js bump: .mp4 is not in its ASSET_RE.
// The game needs no behaviour change: no clip URL carries a version query and nothing keys a cache on these files by
// version, so this script only records the new sizes next to the clip table. Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
// The marker below (and the changelog entry) describe ALL TEN clips replaced - refuse to ship them with the assets
// half's SKIP_C2PA switch on (per user 2026-09-27: all ten, the six C2PA manifests dropped).
{
  const A2 = readFileSync(new URL('./apply_cinematic_slim_assets.mjs', import.meta.url), 'utf8');
  const m = A2.match(/^const SKIP_C2PA = (true|false);/gm) || [];
  if (m.length !== 1) { console.error('ABORT SKIP_C2PA switch not found once in apply_cinematic_slim_assets.mjs'); process.exit(1); }
  if (/true/.test(m[0])) { console.error('ABORT SKIP_C2PA is true: the marker and changelog text describe all ten clips replaced'); process.exit(1); }
}
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes(' cinematic-slim - ten cinematics')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

once('const STORY_BEAT_CLIPS = {', J(
  '// v0.30.1212 cinematic-slim - ten cinematics re-encoded in place under their own names (H.264, SSIM >= 0.985 vs the originals, +faststart; 100.4 -> 22.5 MiB): here gravitos_s1 15.9 -> 3.1, amnesiac_s1 12.6 -> 1.0, forge_s1 11.9 -> 2.6, 100640 10.8 -> 1.9, 093232 6.1 -> 3.5 MiB; elsewhere prologue_pov 10.4 -> 3.1, prologue_punch 10.1 -> 2.7, prologue_void_transcend 6.9 -> 2.3, everdawn_welcome 8.2 -> 1.4, gravitos_defeat_dragonknight 7.5 -> 1.0. No clip URL carries a version, so no code changes.',
  'const STORY_BEAT_CLIPS = {'), 'the STORY_BEAT_CLIPS table');

const grew = s.length - n0;
if (grew < 300 || grew > 700) die('size moved ' + grew);
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
console.log('applied: cinematic-slim marker (+' + grew + ' chars)');
