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
  '<h2>' + VER + ' <span class="tag"><span class="pill art">art</span> Aquarius stops glaring through her own idle</span></h2>',
  '<p>Per user, over a screenshot of the fight: <em>&ldquo;some of the sprites eyes look a little creepy, for the sequence involving this eyes regenerate to make it look more kawaii cuter looking&rdquo;.</em></p>',
  '<p><b>Measured first, so the right loop got re-rolled.</b> Her eyes are two big round cyan lamps, so counting the bright-cyan pixels in the bell of every frame of every loop she owns says plainly which sequence misbehaves:</p>',
  '<table><thead><tr><th>Loop</th><th>Per-frame eye glow</th><th>Floor</th></tr></thead><tbody>',
  '<tr><td>walk</td><td>10732, 10368, 6865, 7449, 10063, 10194, 7826, 9015, 10560</td><td>6865</td></tr>',
  '<tr><td>attack</td><td>10736, 11575, 9577, 15744, 47180, 11885, 11285, 10027, 10566</td><td>9577</td></tr>',
  '<tr><td><b>idle</b></td><td>10715, 11218, <b>3450, 2984, 2766, 2746, 2785</b>, 9395, 10401</td><td><b>2746</b></td></tr>',
  '</tbody></table>',
  '<p>Five of her nine <b>idle</b> frames sat at roughly a quarter of the light the other two loops carry. Walk and attack were never the problem &mdash; and that made idle the odd one out among her own three loops, not just against the request.</p>',
  '<p><b>Why.</b> The shared idle prompt in the zodiac runner asks for &ldquo;an occasional blink&rdquo;, and on a bell-headed jellyfish the model drew that blink as the eyes <em>narrowing into dark lidded slits</em> &mdash; held across five of nine frames. At nine frames a loop that is not a blink; it is a slow glare, which is exactly what reads as creepy.</p>',
  '<p><b>Now.</b> A per-sign idle override (the same mechanism Pisces already uses) drops the blink entirely and pins her eyes wide, round, glowing and sweet in every frame; the life stays in the bell&rsquo;s breathing, the drifting tentacles and the twinkling stars. Her idle floor goes <b>2746 &rarr; 7007</b>, comfortably clear of the walk loop&rsquo;s own 6865, and the dimmest frame is now 65% of the brightest rather than 25%.</p>',
  '<p><b>Two fixes to the runner itself.</b> It predated ludo.ai&rsquo;s job API and read the POST&rsquo;s receipt as if it were the result, so every call would have died on &ldquo;no usable frames&rdquo;; it now polls like the FX generators. And it gained <code>--mode</code>, so fixing one loop no longer re-rolls the two beside it that were already right.</p>',
  '<p><code>scripts/aquarius_eyes_test.mjs</code> &mdash; 5 checks, and the bar is not a magic number: it is derived at run time from her own <b>walk</b> loop, the known-good reference the art already shipped, so the test keeps its meaning if she is ever redrawn again. It also asserts the loop still <em>moves</em> (nine frames, not nine copies of one drawing) and carries a control that walk and attack were left untouched.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 2000 || grew > 9000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
