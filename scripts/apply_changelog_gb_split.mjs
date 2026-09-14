import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_CHANGELOG_FILE || 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const VER = process.env.LX_VER;
if (!VER) { console.error('ABORT: LX_VER unset'); process.exit(1); }
if (s.includes('>' + VER + ' <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const ENTRY = J(
  '</header>',
  '',
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> B and G hits break into a stack of lines</span></h2>',
  '<p>Per user: <em>&ldquo;the damage numbers and fonts for the B and G skills that I asked to edit previously needs to be bigger, bolder looking with slight graffiti look and it should stack, so split the damage into multiple lines but the calculation of the damage should be similar for example: 2 hits at 50% or 3 hits at 33.3% or 4 hits at 25% or 5 hits at 20%&rdquo;.</em></p>',
  '<p><b>The split.</b> One B or G hit now writes several lines instead of one, on the ladder the request gives &mdash; bigger hits earn more lines:</p>',
  '<table><thead><tr><th>Hit</th><th>Lines</th><th>Each</th><th>Sum</th></tr></thead><tbody>',
  '<tr><td>500</td><td>2</td><td>250, 250</td><td>500</td></tr>',
  '<tr><td>4,321</td><td>3</td><td>1441, 1440, 1440</td><td>4,321</td></tr>',
  '<tr><td>54,321</td><td>4</td><td>13581, 13580, 13580, 13580</td><td>54,321</td></tr>',
  '<tr><td>654,321</td><td>5</td><td>130865, then 130864 &times;4</td><td>654,321</td></tr>',
  '</tbody></table>',
  '<p>The parts are integer, with the remainder riding the <em>first</em> line, so they add up to the hit <b>exactly</b> rather than to a rounded-down approximation of it &mdash; 1,001 over three lines is 335 + 333 + 333, not three 333s that quietly lose 2.</p>',
  '<p><b>And the damage itself does not move.</b> That is the part of the request doing the most work &mdash; <em>&ldquo;the calculation of the damage should be similar&rdquo;</em> &mdash; so this is presentation only. Nothing in the split path touches <code>currentHp</code>, and the column&rsquo;s running total still counts the hit once however many lines show it. The test measures it directly rather than reasoning about it: the same blow lands with the column open and with it shut, and the monster loses the same 2,764 either way.</p>',
  '<p><b>The look.</b> The column was built for Deadeye, where rows are deliberately <em>smaller</em> than a lone hit (size &minus;5, capped at 14) so the total carries the weight &mdash; the opposite of what is wanted here. Split rows get their own size (19), their own row pitch to sit in without colliding (27 instead of 20), an 8&nbsp;px black outline instead of 5, and a slight alternating lean of about 4.6&deg; so the stack reads hand-sprayed rather than tabulated. The total above them grows too, 22 &rarr; 28, so it still leads the column.</p>',
  '<p>The lean is <em>baked</em> into the settled bitmap as well as applied on the live pop-in path. Those are two different renderers &mdash; the settled one blits a raster whose gate is <code>!rot</code> &mdash; so a lean applied only to the live path would have snapped every number straight the instant it stopped animating.</p>',
  '<p><b>A basic attack does not split.</b> <code>_lxGbStack</code> deliberately lets a basic join the column while the window is open (same foe, same moment), but a basic is not a B or G skill, so it keeps its old slim single row. Deadeye is exempt for its own reason: its lines are already one-per-shot with their own tally, and splitting those would be splitting a split.</p>',
  '<p><code>scripts/gb_split_test.mjs</code> &mdash; 7 checks: the ladder, exact summation, the damage being untouched, the sizes, the lean alternating rather than all tilting one way, the sim asserted to have stepped first, and the basic-attack control. Each line also records the exact part it stands for, because <code>_lxDeFmt</code> abbreviates past 10k (&ldquo;13.6K&rdquo;) &mdash; the drawn text cannot be added back up, so the invariant is checked against the numbers rather than the glyphs.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 2000 || grew > 10000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
