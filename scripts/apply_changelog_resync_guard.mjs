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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Pisces&rsquo;s pearl-comet swing is drawn whole again, and lost fixes can no longer slip back in</span></h2>',
  '<p>Since v0.30.1786, Pisces&rsquo;s swing strike (the pearl comet) was drawn with its left and right sides softly faded away, as if the art had been cut off there. It was not cut: that update had quietly put back the measurements of the old purple wave the comet replaced, and dropped the measurements of the comet&rsquo;s nine animation frames.</p>',
  '<p>The comet&rsquo;s own measurements are back, so it is drawn whole from its very first frame.</p>',
  '<p><b>Behind the scenes.</b> That update was built from an out-of-date copy of the game&rsquo;s data: a stuck lock file had silently stopped the update tools from refreshing their copy for about two days. Every update since 15 October was checked row by row for anything it undid by accident. This was the only damage still live (the Sundered Smith&rsquo;s walk and cast, undone the same way, had already been put right). The update tools now:</p>',
  '<ul>',
  '<li>stop with a clear message, naming the stuck lock and its age, when they cannot refresh their copy, instead of carrying on;</li>',
  '<li>check every refreshed file against the published one before changing anything;</li>',
  '<li>keep the full output of a failed check in a log file and say where it is.</li>',
  '</ul>',
  '<p><b>Verified.</b> A new test compares all ten comet measurements with what the game itself measures on the published art (they match; before the fix nine were missing and one was wrong), and runs the refresh in a scratch project with a stuck lock file: it now stops and says why, and a file that does not match the published one is caught.</p>',
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
