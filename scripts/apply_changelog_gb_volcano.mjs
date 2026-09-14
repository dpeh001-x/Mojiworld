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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> B and G damage erupts instead of splitting</span></h2>',
  '<p>Per user: <em>&ldquo;The new G and B skill damage is horrendous, revert to original, change it to volcano style effect, larger than the normal attack damage size&rdquo;.</em></p>',
  '<p><b>The split is gone.</b> Everything <b>v0.30.724</b> added is reverted: one hit writes one number again &mdash; no 2/3/4/5-line fractions, no alternating tilt, no lean baked into the settled bitmap. The column itself stays, since that was asked for separately (<em>&ldquo;make them stacked just like the style in deadeye protocol&rdquo;</em>) and was not what was called horrendous.</p>',
  '<p><b>A defect that shipped inside v0.30.724, found while reverting it.</b> The original code read <code>if (!c.sum) { &hellip;create&hellip; } else { &hellip;move the total to the array tail&hellip; }</code>, and 724 inserted its own <code>if (split) &hellip; else &hellip;</code> between the two halves &mdash; which silently re-parented that <code>else</code> onto the new <code>if</code>. So on a split column the running total was never moved back to the tail, and the <code>MAX_DN</code> cap evicts from the <em>head</em>: the total could be dropped while its own rows survived. The original nesting is restored verbatim, and the test now asserts the total sits at the array tail.</p>',
  '<p><b>Larger than a normal attack, as asked.</b> A normal hit pushes size 14 and a crit 18. The column then <em>shrank</em> its rows to 11&ndash;14, because it was inherited from Deadeye where the total is meant to carry the weight &mdash; so a master skill&rsquo;s numbers were rendering <em>smaller than a basic attack&rsquo;s</em>. That is inverted now:</p>',
  '<table><thead><tr><th></th><th>Before</th><th>After</th></tr></thead><tbody>',
  '<tr><td>Normal attack hit</td><td>14</td><td>14 (untouched)</td></tr>',
  '<tr><td>Crit</td><td>18</td><td>18 (untouched)</td></tr>',
  '<tr><td>B / G row</td><td>11&ndash;14</td><td><b>24</b></td></tr>',
  '<tr><td>B / G running total</td><td>22</td><td><b>30</b></td></tr>',
  '</tbody></table>',
  '<p><b>The volcano.</b> Three things, all riding render sites that already existed. A <b>magma ramp</b> &mdash; white-hot at the crown through yellow and orange into deep red at the base, cached per size exactly like the crit gradient beside it (measured: <code>rgb(255,242,192)</code> at the top, <code>rgb(184,26,5)</code> at the bottom). <b>Molten colours</b> on the rows and a hotter amber on the total, in place of flat white and gold. And <b>embers</b> &mdash; a small upward spray of hot particles thrown off the total as it climbs, with gravity so they arc over and fall back. The ember burst is capped and skipped entirely when the particle budget is already under pressure, because an ultimate lands on a room rather than on one foe.</p>',
  '<p><code>scripts/gb_volcano_test.mjs</code> &mdash; 8 checks: one number per hit at every magnitude, no lean left on the entry <em>or</em> anywhere in the source, rows clearing a crit and the total clearing the rows, the four-stop ramp read off a real gradient rather than assumed from the constants, embers firing on a B/G hit and not on a basic, the damage still identical with the column open and shut, and a control that a basic attack keeps its old slim row and the total stays at the array tail.</p>',
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
