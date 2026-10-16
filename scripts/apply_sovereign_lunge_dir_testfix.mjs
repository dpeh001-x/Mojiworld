// boss_dead_traits_test's Sovereign holder for the hourglass lunge stood 187 px (centre to centre) from the hero - point-blank for a
// 255 px wide boss, which is exactly the lunge v0.30.x sovereign-lunge-dir stops opening (it needs the hero a stride clear of his body,
// 188 px) and stops running 460 px from (it now ends at the hero). Moved to x 100 (493 px away): he braces, draws his lane and runs a
// 420 px lunge, so the three rows (braces / publishes a lane / commits > 300 px) test what they always meant. Passes on origin too.
// Guarded + atomic + idempotent. EOL-agnostic (one-line replace).
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
const F = process.env.LX_TEST_FILE || 'C:/Users/dpeh0/Mojiworld/scripts/boss_dead_traits_test.mjs';
let s = readFileSync(F, 'utf8');
const NEW = "const ar = mk('towerSovereign', 100);   // v0.30.x sovereign-lunge-dir - 493 px from the hero: at 400 (187 px) he stands too close to lunge";
if (s.includes(NEW)) { console.log('already applied'); process.exit(0); }
const A = "const ar = mk('towerSovereign', 400);";
const n = s.split(A).length - 1; if (n !== 1) { console.error('ABORT anchor matched ' + n); process.exit(1); }
s = s.replace(A, () => NEW);
writeFileSync(F + '.tmp', s, 'utf8');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) { console.error('ABORT rename kept failing: ' + lastErr.code); process.exit(1); }
}
console.log('applied: boss_dead_traits_test Sovereign holder at x 100');
