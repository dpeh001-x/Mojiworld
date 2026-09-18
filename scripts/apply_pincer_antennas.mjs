// The Pincer grows no antennas - the game-file half: a note on the monster's entry pointing at the art fix, so the
// next person to regenerate or recalibrate its frames knows idle 5-6 were edited by hand and why.
// (The art itself: scripts/apply_pincer_antennas_files.mjs -> scripts/fix_pincer_antennas.mjs.)
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) pincer-antennas/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const A = "  scorpion: { name:'Pincer',";
const c = s.split(A).length - 1;
if (c !== 1) { console.error('ABORT scorpion entry: matched ' + c + ', expected 1'); process.exit(1); }
s = s.replace(A, [
  '  // v0.30.868 pincer-antennas — per user: "the monster "pincer" is growing antennas out of nowhere". Two of its 27 frames',
  '  // (idle 5-6, the happy squint) had a pair of antennas the rest of the set does not; they were cut out and the head',
  '  // redrawn by scripts/fix_pincer_antennas.mjs. Regenerating the idle set would bring them back - check before you do.',
  A,
].join(EOL));
const grew = s.length - n0;
if (grew < 200 || grew > 600) { console.error('ABORT: size moved ' + grew); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000000) { console.error('ABORT: tmp small'); process.exit(1); }
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) { console.error('ABORT: rename kept failing: ' + lastErr.code); process.exit(1); }
}
console.log('applied: pincer-antennas note (+' + grew + ' chars)');
