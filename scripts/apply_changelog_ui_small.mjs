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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> The smallest phones: Guguma&rsquo;s pill, the Level Up shortcuts and the name screen fit</span></h2>',
  '<p>A sweep of the main screens on the smallest common phone held sideways (568&times;320, the first iPhone SE) found three things still in the way. Only positions and sizes changed; nothing was restyled.</p>',
  '<ul>',
  '<li><b>Guguma&rsquo;s &ldquo;Ascend&rdquo; pill sat on a skill button.</b> At the level cap the pill looks for a spot with nothing under it, but on this screen every usual spot was taken and it settled on a locked skill button. It now finds the gap between the controls (just under the area name), shrinking slightly only if it has to.</li>',
  '<li><b>The Level Up window&rsquo;s shortcuts took two lines.</b> &ldquo;Achievements&rdquo; wrapped onto a row of its own. On narrow screens the six shortcuts now sit a little tighter, and on the smallest ones a little smaller, so they stay on one line.</li>',
  '<li><b>&ldquo;Enter Mojiworld&rdquo; was below the fold.</b> After <b>New Game</b> the logo kept the top of the title card and the name screen&rsquo;s buttons were out of sight under the &ldquo;More&rdquo; tab. The card now scrolls itself so the name field, <b>Enter Mojiworld</b> and <b>Back</b> are all on screen. The same goes for <b>Play Co-op</b> (the party code, <b>Play together</b> and <b>Back</b>), which was cut off on bigger phones too.</li>',
  '</ul>',
  '<p>The rest of the sweep &mdash; the title menu, character creation, the Level Up window and bag, Settings, the jukebox and the quest journal &mdash; already had its main button and its close button on screen.</p>',
  '<p><b>Verified</b> on 568&times;320, 667&times;375 and 844&times;390 touch screens: every screen&rsquo;s main button and close button on screen and tappable, the pill clear of every control (also after it re-checks its spot) and still opening Guguma&rsquo;s card, the shortcuts on one line, no page errors. The pill, the shortcuts and the name screen fail on the build before this change. The earlier phone checks (phone fit, notifications and Guguma&rsquo;s card, text fixes) still pass.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
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
