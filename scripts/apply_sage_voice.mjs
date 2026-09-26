// "???" (Sage Mira) gets a voice that matches her (per user, 2026-09-26: "regenerate ??? NPC sound voice, as it
// doesnt match"). The clip itself - audio/npc/npc_mystery_sage.mp3 - is replaced by apply_sage_voice_assets.mjs
// (with the service-worker cache bump that a same-name replacement needs); this marks the one game line that picks
// the clip, so the change is findable from the code.
// Guarded + atomic + idempotent.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) sage-voice/.test(s)) { console.log('already applied'); process.exit(0); }
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const A = "  if (name === '???') return 'mystery_sage';";
const n = s.split(A).length - 1;
if (n !== 1) die('the ??? voice key line matched ' + n);
s = s.replace(A, () => A + "   // v0.30.1155 sage-voice - Sage Mira: recast as a soft, airy young elf woman (f0 ~380 Hz; the old clip was a 130 Hz sigh)");
const grew = s.length - n0;
if (grew < 60 || grew > 400) die('size moved ' + grew);
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
console.log('applied: sage-voice (+' + grew + ' chars)');
