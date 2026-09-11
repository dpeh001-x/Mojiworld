import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Necromancer undead hit what they can reach &mdash; Gravitos included &mdash; and every one of them swings</span></h2>',
  '<p>Per user: <em>&ldquo;work on the summons, especially for necromancer, they seem to be jumping at gravitos but not dealing damage, make the summons AI smarter&rdquo;.</em></p>',
  '<p><b>Why they only hopped.</b> The raised undead attacked only when the middle of their body came within 30&nbsp;px of the middle of the target&rsquo;s. Gravitos is 380&nbsp;px tall, so a skeleton standing at his feet is about 174&nbsp;px below his middle, and their jump peaks about 121&nbsp;px up &mdash; still short. So they jumped at him over and over and almost never swung. Any monster much taller than about 90&nbsp;px had the same problem. And because the pack spreads out 42&nbsp;px apart around its target, against anything small the two outer minions stood just outside that circle and never swung at all.</p>',
  '<p><b>Now.</b> An undead swing lands whenever the minion is within arm&rsquo;s reach of the target&rsquo;s body &mdash; the same body monsters use to hit your minions, so the exchange is fair both ways. They jump only when the target is actually standing above them, on a ledge or hovering, never just because it is tall. When they pick a target, height is judged by the gap between bodies, so a tall boss on your floor counts as being on your level. The pack&rsquo;s spacing is capped so every flanker stays in reach, and the hit spark appears where the blow lands instead of up at the target&rsquo;s middle. Misses against high-evasion targets still happen as before. The MojiMon companion and the beast pets keep their own rules.</p>',
  '<table><thead><tr><th>Three undead for 480 frames (8&nbsp;s at 60&nbsp;fps) against</th><th>Before: swings &middot; jumps</th><th>After: swings &middot; jumps</th></tr></thead><tbody>',
  '<tr><td>Gravitos (340&times;380)</td><td>2 &middot; 6</td><td>52 &middot; 0</td></tr>',
  '<tr><td>A tall monster (Glasswind Hare, 108&times;167)</td><td>10 &middot; 14</td><td>51 &middot; 0</td></tr>',
  '<tr><td>A slime</td><td>20 &middot; 0</td><td>52 &middot; 0</td></tr>',
  '<tr><td>A slime on a ledge above</td><td>20 &middot; 3</td><td>52 &middot; 3</td></tr>',
  '</tbody></table>',
  '<p><code>scripts/summon_ai_test.mjs</code> &mdash; 5 checks, three undead raised beside one held target and watched for a fixed 480 game frames (a wall-clock window measured the test machine instead: drawing Gravitos can drop a headless page to about 11&nbsp;fps, and minions walk per frame): against Gravitos at least 30 swings with hits landing, and no more than 3 jumps; against a 100+&nbsp;px monster on the same floor, at least 30 swings with hits landing; against a slime, all three swing (at least 40 swings, where one minion alone manages about 20); and they still jump to reach, and hit, a slime standing on a ledge. The previous build fails the first four and passes the ledge check.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1500 || grew > 6000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
