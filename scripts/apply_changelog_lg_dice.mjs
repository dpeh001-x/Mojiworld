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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Innate Growth&rsquo;s bonus rolls are three tossed dice, not a bar chart &mdash; and no Last level banner</span></h2>',
  '<p>Per user, on the Innate Growth card: <em>&ldquo;condense the bonus roll section, there is no need for bar charts for that section, but make it easy to understand&rdquo;</em> and <em>&ldquo;make the design artistic&rdquo;</em>; then <em>&ldquo;remove the part of the last level&rdquo;</em>.</p>',
  '<p>The three bar-chart columns are gone. The section now reads in one line &mdash; &ldquo;Each level rolls <b>+0, +1 or +2 SP</b>.&rdquo; with a white <b>Total +90 SP</b> pill beside it &mdash; and one row of three <b>tossed dice</b>: a +0 face (a dash), a +1 face (one pip), a +2 face (two pips), grey to white by value like the columns were, each tilted as if just thrown, with how often it came up (&ldquo;+1 &times;58&rdquo;). Hover a die and it spins. The luck pill (&ldquo;A bit unlucky &middot; avg +0.92&rdquo;) and every number are unchanged; the card stays black and white outside its four stat tiles.</p>',
  '<p><b>No Last level banner.</b> The white &ldquo;Last level: +2 SP &middot; JACKPOT!&rdquo; strip at the foot of the card is gone &mdash; the dice already tally every roll. A character who has not levelled yet still sees &ldquo;No level-ups yet&rdquo;.</p>',
  '<p><b>Verified.</b> <code>innate_card_test</code> &mdash; its bar-height step now checks that there is no bar chart, that the three dice show 0, 1 and 2 pips, and that the total names the bonus SP; its three last-roll checks now check there is no banner; the tally, luck pill, colour and no-italics checks are unchanged &mdash; 21/21.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 800 || grew > 4000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
