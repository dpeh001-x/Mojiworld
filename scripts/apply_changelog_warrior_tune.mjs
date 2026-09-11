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
  '<h2>' + VER + ' <span class="tag"><span class="pill balance">balance</span> Ground Slam hits softer and waits a second longer; War of Banners hits 50% harder</span></h2>',
  '<p>Per user: <em>&ldquo;Nerf the damage by groundslam and increase cooldown by 1s, Increase the damage dealt by war of banners&rdquo;.</em></p>',
  '<p><b>Measured first.</b> On a pinned dummy against a Lv&nbsp;50 Warlord (ATK 440, no crits), a single Ground Slam landed all eight of its hits for about 10&times; ATK, every 2.25&nbsp;s of real cooldown. Holding B through War of Banners&rsquo; 10&nbsp;s enrage went through 22 presses at about 9&times; ATK each &mdash; roughly 200&times; ATK per enrage, on a 60&nbsp;s cooldown. Per second of cooldown the two came out the same: a level-1 basic was keeping pace with the Lv&nbsp;50 ultimate.</p>',
  '<p><b>Ground Slam.</b> The cooldown the skill screen shows goes from 3&nbsp;s to <b>4&nbsp;s</b> (the real cooldown, after the game-wide 25% reduction, from 2.25&nbsp;s to 3&nbsp;s). Every part of the slam hits about 20% softer: the four spinning ticks 0.7 &rarr; 0.55&times; ATK, the landing 3.4 &rarr; 2.7&times;, each shockwave ring 1.5 &rarr; 1.2&times;. Together its sustained damage falls about 40%.</p>',
  '<p><b>War of Banners.</b> Both halves of every press hit <b>50% harder</b>: the sweep 2.4 &rarr; 3.6&times; ATK, the thrown banner 1.6&times; ATK&nbsp;+&nbsp;6 &rarr; 2.4&times; ATK&nbsp;+&nbsp;9. The enrage, its heal, the MP refund, how fast you can re-press and the 60&nbsp;s cooldown are unchanged.</p>',
  '<table><thead><tr><th>Measured</th><th>Before</th><th>After</th></tr></thead><tbody>',
  '<tr><td>Ground Slam cooldown (shown / real)</td><td>3&nbsp;s / 2.25&nbsp;s</td><td>4&nbsp;s / 3&nbsp;s</td></tr>',
  '<tr><td>Ground Slam damage per cast</td><td>10.2&ndash;10.8&times; ATK</td><td>8.1&times; ATK</td></tr>',
  '<tr><td>War of Banners damage per press</td><td>9.1&ndash;9.3&times; ATK</td><td>13.9&times; ATK</td></tr>',
  '<tr><td>War of Banners per enrage (22 presses)</td><td>200&ndash;204&times; ATK</td><td>305&times; ATK</td></tr>',
  '</tbody></table>',
  '<p><code>scripts/warrior_skill_tune_test.mjs</code> &mdash; 5 checks on the pinned dummy: Ground Slam&rsquo;s cooldown is 4&nbsp;s shown and 3&nbsp;s real; one cast deals 7.4&ndash;8.8&times; ATK (baseline 10.2&ndash;10.8&times;); it still lands all eight hits; a War of Banners press deals at least 12.5&times; ATK (baseline about 9&times;); and holding B still gets 15&ndash;30 presses through the enrage, followed by the ~60&nbsp;s lock. The before figures span two runs of the previous build.</p>',
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
