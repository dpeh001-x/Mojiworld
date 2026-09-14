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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> B and G damage: gold, 30&nbsp;px, detonating &mdash; and no total</span></h2>',
  '<p>Per user, over a screenshot of the number in play: <em>&ldquo;The GB font should be this still, bigger, bolder and more fancy looking, and should appear like maplestory volcano or other AAA high impact damage effect&rdquo;</em>, then <em>&ldquo;There should not be a B / G total displayed&rdquo;</em> and <em>&ldquo;make the damage appear in an explosive AAA style&rdquo;</em>.</p>',
  '<p><b>Gold, not lava-red.</b> v0.30.729 ran the magma ramp all the way down to <code>#b81a05</code>. The glyph in the screenshot is the <em>gold</em> one, so the ramp is re-weighted to stay gold end to end &mdash; near-white crown, bright yellow, amber body, heating into orange only at the very bottom edge. &ldquo;Volcano&rdquo; here is the weight and the glow, not literal red.</p>',
  '<table><thead><tr><th></th><th>Before</th><th>After</th></tr></thead><tbody>',
  '<tr><td>Normal attack hit</td><td>14</td><td>14 (untouched)</td></tr>',
  '<tr><td>Crit</td><td>18</td><td>18 (untouched)</td></tr>',
  '<tr><td>B / G number</td><td>24</td><td><b>30</b></td></tr>',
  '<tr><td>Black anchor</td><td>7&nbsp;px</td><td><b>9&nbsp;px</b></td></tr>',
  '<tr><td>Coloured halo</td><td>7&nbsp;px @ 0.35</td><td><b>11&nbsp;px @ 0.50</b></td></tr>',
  '<tr><td>Inner rim</td><td>crits only</td><td><b>3&nbsp;px, always</b></td></tr>',
  '<tr><td>Specular crown</td><td>0.40 over 38%</td><td><b>0.75 over 46%</b></td></tr>',
  '</tbody></table>',
  '<p>The <b>inner rim</b> is what does most of the &ldquo;fancy&rdquo; work &mdash; a bright cream stroke sitting over the black one, so the glyph reads as a double outline rather than a flat sticker. Crits already had a 2&nbsp;px version of it; these get a wider one, always.</p>',
  '<p><b>Explosive.</b> The ember puff became a detonation: 16 particles thrown <em>radially</em> rather than drifting upward, fast enough to clear the glyph, plus a shockwave flash landing on the same frame at the same point &mdash; that pairing is what the eye reads as a blast instead of confetti. The number itself now slams in, its pop-in overshoot going past even a crit&rsquo;s (3.6 against 2.6). Under particle pressure it degrades to a thinner ring rather than vanishing, because an ultimate lands on a room.</p>',
  '<p><b>No total.</b> The running total is gone from B/G columns. Removing it was not a deletion &mdash; it had a load-bearing job. The column&rsquo;s <em>liveness</em> test was &ldquo;does the total still live&rdquo;; with no total that is false on <em>every</em> hit, so each hit would have started a fresh column and the stack would never have built. A totalless column now carries a flag and is judged on its own freshness instead. The embers also used to ride the total, so they come off the row now. Deadeye passes no flag and keeps its own total and tally untouched.</p>',
  '<p><code>scripts/gb_gold_test.mjs</code> &mdash; 8 checks, including the two traps above: that four stacked hits land in <b>four rows of one column</b> (not four columns of one row), and that Deadeye still builds its total at its own size. The colour and the paint are measured off a real bake &mdash; the crown reads <code>rgb(255,246,196)</code> and the body <code>rgb(151,94,10)</code>, gold-family the whole way, where v0.30.729&rsquo;s base measured a green channel of 26. The blast asserts both the particle count and the flash, and that a basic attack gets neither.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 2000 || grew > 11000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
