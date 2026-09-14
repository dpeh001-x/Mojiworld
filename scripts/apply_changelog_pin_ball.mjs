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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> The map pin is a ball from the mid down</span></h2>',
  '<p>Per user: <em>&ldquo;this guguma pin can be more spherical from the mid and bottom section&rdquo;.</em></p>',
  '<p><b>Why it was an egg.</b> The pin head is Guguma&rsquo;s own art cut by one ellipse, and that ellipse sat high &mdash; its centre at 46% of the crop &mdash; and closed below the crop&rsquo;s bottom edge. So its widest point was up near his eyes and its lower arc pinched inward all the way to the needle. Measured against the circle through its own widest row, the mid and underside were 8.1% off it on average and 20.6% at worst, and the underside only reached 0.74 of the radius before his silhouette ran out.</p>',
  '<p><b>Why a rounder ellipse was not the answer.</b> Closing the bottom arc inside the crop closes the top arc too, and that shears his tuft off. So the cut is a union now: a circle, plus everything above that circle&rsquo;s centre. Below the centre the circle rules, and the mid and the underside are one round arc; above it his own silhouette rules, so the tuft, the crown and his outline are still his. The circle is 232&nbsp;px in both axes, the largest that stays inside his body&rsquo;s own width &mdash; every edge of the pin is still his art, with nothing invented to fill a gap.</p>',
  '<table><thead><tr><th>Mid and underside, measured</th><th>Before</th><th>After</th></tr></thead><tbody>',
  '<tr><td>Deviation from a circle (rms)</td><td>8.1%</td><td><b>1.2%</b></td></tr>',
  '<tr><td>Worst single row</td><td>20.6%</td><td><b>2.0%</b></td></tr>',
  '<tr><td>How far the underside reaches</td><td>0.74 of the radius</td><td><b>0.88</b></td></tr>',
  '</tbody></table>',
  '<p>21 shapes were built and measured to pick it. <code>scripts/gen_guguma_pin.mjs --legacytop</code> still builds the old cut.</p>',
  '<p><code>scripts/pin_ball_test.mjs</code> &mdash; 6 checks: the mid and bottom sit under 3% rms of a true circle; the underside reaches past 0.85 of the radius; his top still deviates far more than his bottom, which is what proves the tuft and crown were not shaved into a ball; the needle still narrows to a spike below the head; the packed atlas cell the game draws is the new pin, with all 386 icons still in the map; and a control that the previously shipped pin fails the circle check, so the measure discriminates.</p>',
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
