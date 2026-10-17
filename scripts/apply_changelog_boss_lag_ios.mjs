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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Bosses on iPhone and iPad keep their poses ready for the whole fight, and every sprite looks exactly the same</span></h2>',
  '<p>On an iPhone or iPad, a big boss&rsquo;s poses did not fit in the memory the game sets aside for pictures. In the middle of a fight the game threw some of his poses away and had to prepare them again the next time he used them, and for that moment he stood frozen in his last pose. Your skill effects were thrown away the same way, down to the small sparks of a basic hit, and unpacking them again made the game stutter.</p>',
  '<ul>',
  '<li><b>A boss&rsquo;s poses now take about a third of the memory.</b> Most of each pose is empty space around him. The game now keeps only the strips that hold part of him, packed tightly, and puts them back together, pixel for pixel, every time he is drawn. Nothing is scaled or redrawn, so he looks exactly as he did.</li>',
  '<li><b>His whole current form now stays ready for the fight</b>, Gravitos included, even at the sharpest display setting. The memory this frees goes to your skills and his attacks, and the small effects you use all the time are kept.</li>',
  '<li><b>Entering a boss arena</b> now prepares his opening poses first and your skills next, behind the loading screen, and no longer prepares hit-flash copies from pictures that are still being unpacked (that froze the screen for a moment).</li>',
  '<li><b>The memory limit is the same as before.</b> The most the game holds at once during a boss fight is about half of what it was.</li>',
  '</ul>',
  '<p><b>Measured</b> with the old and new builds running side by side, posing as an iPhone (at its usual setting and at the sharpest one), an iPad and a computer. A level-200 bot fought Gravitos (all three forms), Mira, Aetherion (both forms) and the Tower Sovereign in their own arenas. A stutter is a frame that took the game more than 33 ms.</p>',
  '<ul>',
  '<li><b>iPhone at its sharpest setting:</b> across the four fights the bosses prepared a pose again 599 times; now never. Stutters 75 &rarr; 43 (3.7 s &rarr; 2.2 s of freezing in total). The most picture memory held at once fell from 277 to 196 million pixels (on average 128 &rarr; 103).</li>',
  '<li><b>iPhone at its usual setting:</b> poses prepared again 118 &rarr; 0, stutters 42 &rarr; 27, skill effects unpacked again mid-fight 884 &rarr; 188.</li>',
  '<li><b>iPad:</b> poses prepared again 490 &rarr; 1, stutters 81 &rarr; 53 (4.2 s &rarr; 2.7 s), the most picture memory held at once 290 &rarr; 171 million pixels.</li>',
  '<li><b>Loading into an arena on a phone</b> takes the same time or less (Mira and Aetherion at the sharpest setting: about 7 s &rarr; 5 s), and more of your skills are ready when it lifts.</li>',
  '<li><b>On a computer nothing changes:</b> it has the memory to keep the old way.</li>',
  '</ul>',
  '<p><b>Verified.</b> A browser test posing as an iPhone at the sharpest setting fights Gravitos in the Singularity. It checks that his poses are stored the new way, that his whole form stays ready, and that none of his poses is thrown away or prepared again during the fight (the build before threw away over a hundred and prepared about ninety again in the same 25 seconds). It then draws his poses both ways, old and new, and compares them pixel by pixel: as they are, through the game&rsquo;s own sprite drawing at three sizes, with the hit flash and the freeze tint, as part of a larger picture, and as the real boss on screen, facing left and right. They are identical. It repeats the comparison as a computer at 2x, where the game keeps the old way.</p>',
  '');
s = s.replace(ANCHOR, () => ENTRY);
if (s.includes('@@NUMBERS@@')) { console.error('ABORT: numbers placeholder left in'); process.exit(1); }
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
