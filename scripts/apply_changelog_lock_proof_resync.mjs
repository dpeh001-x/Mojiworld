import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_CHANGELOG_FILE || 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const VER = process.env.LX_VER;
if (!VER) { console.error('ABORT: LX_VER unset'); process.exit(1); }
if (s.includes('>' + VER + ' <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>';
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const ENTRY = J(
  '</header>',
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> A stuck lock file can no longer hold up an update</span></h2>',
  '<p>Nothing in the game changes in this update.</p>',
  '<p><b>Behind the scenes.</b> Three times in two days, a stuck lock file in the build folder stopped updates from going out until someone cleared it by hand. The cause was another coding app that has the same folder open. While files change it re-checks them about once a second and cancels each check that a newer one replaces. A check cancelled at the wrong moment leaves its lock behind for good. An update rewrites dozens of files, which is when that app checks fastest, so one of these locks appeared in the middle of an update.</p>',
  '<p>The update tools no longer need that lock:</p>',
  '<ul>',
  '<li>they refresh their copy of the published files directly, without the lock, so a stuck lock can neither stop an update nor let it go out with old files;</li>',
  '<li>they download every file they need in one go instead of one at a time;</li>',
  '<li>they move a lock aside (never delete it) once it is provably abandoned: at least two minutes old, with no program old enough to own it still running;</li>',
  '<li>the check that runs when a work session starts no longer takes the lock at all.</li>',
  '</ul>',
  '<p><b>Verified.</b> A new test reproduces the cause: a check cancelled midway leaves the lock, and the old refresh then fails. With that lock in place, the new refresh works, writes exactly the bytes a normal refresh would, and leaves the lock untouched. It also fetches every missing file in one download from a partial copy of the project. The clean-up step only moves a lock that nothing running could still own.</p>',
  '');
s = s.replace(ANCHOR, () => ENTRY);
const grew = s.length - n0;
if (grew < 300 || grew > 6000) { console.error('ABORT: moved ' + grew); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) { console.error('ABORT: rename kept failing: ' + lastErr.code); process.exit(1); }
}
console.log('applied: CHANGELOG ' + VER + ' (+' + grew + ' chars)');
