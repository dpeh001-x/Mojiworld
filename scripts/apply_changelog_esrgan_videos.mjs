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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Sharper animated backdrops (Everdawn, the Void, the Singularity, the Stair)</span></h2>',
  '<p><b>What you saw:</b> the five moving backdrops (Everdawn Central, The Void, the Singularity before and after Gravitos\u2019s second form, and The Weight-Bearer\u2019s Stair) were small video clips, 832 to 1344 pixels wide, stretched across the whole screen, so they looked soft.</p>',
  '<ul>',
  '<li><b>Redrawn frame by frame.</b> Every frame of each clip was enlarged by an AI upscaler built for video, running on our own machine, then colour-matched to the original frame so nothing got brighter or darker. The Void keeps every faint star of its original sky.</li>',
  '<li><b>Same clips, same place.</b> Each clip keeps its exact shape, length, speed and seamless loop, so it fills exactly the same part of the screen as before. Everdawn is now 1920 x 1080, the Stair 1890 x 1080 and the other three 1872 x 1044.</li>',
  '<li><b>Smaller download.</b> The five clips together are now 12.7 MB instead of 14.7 MB, even though they are about twice as sharp.</li>',
  '</ul>',
  '<p><b>Verified.</b> Side-by-side captures in the game, frame for frame; a test checks every clip, that each still plays at the same length and fills exactly the same box on screen, and that it now draws from at least 1.4 times as many picture pixels.</p>',
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
