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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> King Krook walks instead of slipping and sliding</span></h2>',
  '<p>Per user: <em>&ldquo;King krook still moves in a slip and sliding manner. He needs to move more normally, fix it&rdquo;</em>.</p>',
  '<p><b>The walk.</b> His walk art barely strides &mdash; short legs under the belly, the cape hem on the floor &mdash; but its nine frames were not drawn on one registration: the whole figure sits at a different place in each. Measured in his arena, his belly swung across <b>58 px</b> every stride (forward in frames 3&ndash;4, back in 5&ndash;6) while he moved steadily over the floor: a body lurching back and forth over his feet &mdash; the slip-and-slide. Each walk frame is now shifted so his body holds one place over his feet (measured: within 2 px across the whole cycle), and the walk set is lined up with his idle set, so starting and stopping no longer nudges him 15 px either. The legs, tail and cape still animate; only the drift is gone.</p>',
  '<p><b>The claw.</b> His claw swipe drove him forward at full lunge speed for its whole 700&nbsp;ms, so the swipe pose skated 150&ndash;170 px across the floor. It is now a step into the swipe that eases to a stop by 300&nbsp;ms (about 30&ndash;45 px) and he is planted for the strike. Its hitbox, damage and timing are unchanged.</p>',
  '<p><b>Verified.</b> <code>scripts/krook_walk_test.mjs</code> &mdash; 6 checks in his arena with the hero walked wall to wall: the registration table matches the shipped art (<code>scripts/gen_krook_walk_reg.mjs --check</code>); he walks through his cycle; his belly holds within 6 px frame to frame (it swung 58); walk and idle place it within 4 px (15 off before); the claw travels under 60 px (150&ndash;170 before); no page errors. The current build fails 4 of the 6.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1200 || grew > 6000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
