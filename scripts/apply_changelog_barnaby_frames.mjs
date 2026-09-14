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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Confused Barnaby stops walking through his own fight</span></h2>',
  '<p>Per user: <em>&ldquo;he is using his walking sprite way too much, ensure that he uses his other sprites that are already generated &hellip; especially when attacking or dashing&rdquo;.</em></p>',
  '<p><b>Measured first.</b> Over 600 frames of a live fight, counting which of his five sets each frame actually drew: walk 272, idle 175, attack 23, weave 0, duck 0. So 58% of his frames were the walk loop, 5% were his attack art, and two of his authored sets were never drawn at all &mdash; while his states over the same window were chase 128, dashIn 48, wind 35, jab 18, reposition 43. He was attacking and dashing; the draw simply wasn&rsquo;t showing it.</p>',
  '<p><b>Why.</b> A boss counts as attacking only while it is <em>planted</em> &mdash; hasn&rsquo;t moved for 140&nbsp;ms &mdash; or mid brace-dash. That rule is right for a boss that strolls through a wind-up and would otherwise freeze into its attack pose. Barnaby moves through nearly everything he does, so he was almost never planted: his wind-up and his jab fell through to the walk loop. His dash is one of the states that draw as movement by design, so that read as walking too.</p>',
  '<p><b>Now.</b> Two narrow opt-ins, both keyed to his type alone: his attack states draw his attack art whether or not he is moving, the same exemption the brace-dash already had; and his dash wears the weave lean he already has art for. Chase and reposition still walk, because that is what they are. No other boss can take either branch.</p>',
  '<table><thead><tr><th>Of his drawn frames</th><th>Before</th><th>After</th></tr></thead><tbody>',
  '<tr><td>Walk loop</td><td>58%</td><td>42.4%</td></tr>',
  '<tr><td>Attack art</td><td>5%</td><td>20.6%</td></tr>',
  '<tr><td>Weave (the dash lean)</td><td>never drawn</td><td>drawn</td></tr>',
  '</tbody></table>',
  '<p><b>A correction to v0.30.696.</b> That entry describes this change, but the build it shipped carried Mooma’s landing fix instead: two of my ship chains ran at once and shared the same scratch filenames, so one pushed the other’s build under its own message. Mooma’s fix is genuinely in from v0.30.696 (its own entry follows); Barnaby’s is this one. The chain now gives every run its own scratch names.</p>',
  '<p><code>scripts/barnaby_frames_test.mjs</code> &mdash; 6 checks over a live fight: his attack art is at least a fifth of his draws, the weave set is drawn at all, the walk loop is at most half of them, the walk loop is still used for actual walking, the sim is asserted to have stepped before anything is counted, and a control that the two opt-in tables name him and nobody else.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1500 || grew > 7000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
