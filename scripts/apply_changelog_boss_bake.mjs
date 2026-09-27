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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> No more multi-second freeze after the Singularity, and a lighter first step into a boss arena</span></h2>',
  '<p>The pre-launch performance audit found two stalls in how the game measures boss art.</p>',
  '<ul>',
  '<li><b>A freeze of about five seconds on the next map after leaving the Gravitos arena.</b> The game measures each boss form&rsquo;s exact size from its idle frames. For Gravitos that is 27 frames, measured twice each, all in one go. The measuring waits behind the arena&rsquo;s art preparation, which pauses during the blackout and the entrance film. After a long fight it therefore landed wherever you had walked to by then. The forest froze for 4.9 s, and Scorpio&rsquo;s and King Krook&rsquo;s halls for about 5 s. The measuring now handles one frame at a time, prepares each image off the main thread and reads each frame once for both measurements. It stops the moment you leave that boss&rsquo;s map and finishes on your next visit. The sizes it finds are exactly the same.</li>',
  '<li><b>The first entry into a boss arena spent up to 1.4 s preparing the boss card&rsquo;s portrait while the map was loading.</b> The portrait is now decoded in the background and measured just after the map loads. The card still shows the boss&rsquo;s art, cropped and sized as before.</li>',
  '</ul>',
  '<p><b>Verified.</b> <code>scripts/boss_bake_test.mjs</code> runs 9 checks:</p>',
  '<ul>',
  '<li>The portrait scan runs outside the map load, for King Krook and for Scorpio, and both intro cards show their art.</li>',
  '<li>In a Gravitos fight whose art preparation is held, followed by a walk to the forest, no task measures more than one frame. No measuring pass reads frames by itself, and nothing of his is measured on the forest.</li>',
  '<li>Back in his arena, all three forms are measured there, one frame per task.</li>',
  '<li>Every size recorded (Gravitos&rsquo;s three forms, King Krook and Scorpio) equals the original measurement of the same frames. The values match the build before the fix.</li>',
  '<li>There are no page errors.</li>',
  '</ul>',
  '<p>On the build before the fix, five checks fail: one task measured 27 frames, one pass read 9, and 54 scans landed on the forest.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
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
