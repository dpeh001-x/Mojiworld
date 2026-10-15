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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> The Tower Arbiter&rsquo;s animations are redrawn with nothing sliced off</span></h2>',
  '<p>Many of the Tower Arbiter&rsquo;s animation frames had part of their art cut off by a hard, perfectly straight line, as if trimmed with scissors: the point of his raised sword sheared flat across the top of his pillar strike, the light rays of that strike all stopping on one invisible line or along the floor, the embers and flame flicks of his burning sword halved, and his sword running off the bottom of the picture as he walked.</p>',
  '<p>The cause was in how the frames were made: the animation tool only ever drew inside a tight box around his standing pose, so anything his motion reached beyond that box was cut flat on its edge. His animations are now redrawn from his own art with that box opened up and room around him:</p>',
  '<ul>',
  '<li><b>Idle and walk</b> &mdash; the same knight breathing and marching; his sword point now always stays above the floor.</li>',
  '<li><b>Swing</b> &mdash; violet crescents of light trail his greatsword as he winds up and cleaves - kept low enough that nothing leaves the top of the screen.</li>',
  '<li><b>Pillar strike</b> &mdash; he raises his sword point to the sky and its blade lights up as he calls the pillar down; the pillar itself is still the game&rsquo;s own effect.</li>',
  '<li><b>Burning verdict</b> &mdash; he holds his greatsword inverted, point planted at his feet, and fire kindles at the crossguard, runs down the blade, blazes and dies back &mdash; the flame stays on the steel and everything stays low.</li>',
  '</ul>',
  '<p>He stands on the same feet line, with the same timing and the same hit areas. His size and place were also checked in the game, pose by pose: idle, walk, swing and lunge match, and his pillar strike and burning verdict, which used to draw him a little small and off to one side (the pillar) or noticeably big (the verdict), now draw him at exactly his idle size, on his idle&rsquo;s feet line, with his helm where the idle&rsquo;s is. His lunge already had nothing cut off and its pictures are unchanged.</p>',
  '<p><b>Verified.</b> A checker that looks for art ending on a hard straight line (at the picture&rsquo;s edges, along the floor, or anywhere inside it) passes on every one of his new frames and flags the old ones; a browser test confirms every set loads and plays in the game, that his body is drawn at the same on-screen height and feet line as before, that his existing swing, lunge and ward tests still pass, and that there are no errors.</p>',
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
