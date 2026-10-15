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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Libra and the Tower Arbiter no longer have art sliced off by a straight line</span></h2>',
  '<p>A few frames of two bosses&rsquo; animations had part of their art cut off by a hard, perfectly straight vertical line &mdash; as if someone had trimmed the picture with scissors. The game draws each frame whole, so for that instant the cut showed on screen:</p>',
  '<ul>',
  '<li><b>Libra</b> &mdash; in two frames of her burst attack the light rays ran straight off the right edge of the picture and stopped dead there.</li>',
  '<li><b>The Tower Arbiter</b> &mdash; the tip of his sword when he raises and swings it, the edge of his gauntlet and of his sword&rsquo;s crossguard, the light rays of his pillar strike (they had been faded, but still all stopped on one invisible line), the curl of his flaming verdict arc and its flame flicks and embers, and the sparks and dust of his swing.</li>',
  '</ul>',
  '<p>Now the sliced art finishes the way it was meant to: the Arbiter&rsquo;s sword ends in a point, his rays and flames trail off naturally, and Libra&rsquo;s rays taper to a point just before the edge of her picture. Everything else in those frames is exactly as it was &mdash; only the part past the cut was redrawn &mdash; so the animations play at the same size, in the same place and with the same timing.</p>',
  '<p><b>Verified.</b> A browser test checks that each repaired picture is the reviewed one, at its old size; that Libra&rsquo;s two frames no longer touch the right edge; that no repaired frame still ends on a hard straight line; and that both bosses spawn and animate through their repaired frames with no errors. The checks fail on the build before this change.</p>',
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
