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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Big fights: a third less restyling every frame - the combo counter&rsquo;s pop no longer stops the page</span></h2>',
  '<p>A performance audit traced a crowded fight &mdash; sixty monsters, hits landing every frame, toasts and a climbing combo &mdash; and found the browser re-working the interface&rsquo;s styles several times a frame, most of them forced in the middle of the game&rsquo;s own work. The biggest part of that (page-wide &ldquo;is this open?&rdquo; style rules) was already cleared by the fight-lag fixes just before this one; the biggest cause of our own was left.</p>',
  '<ul>',
  '<li><b>The combo counter&rsquo;s pop</b> made the browser stop and re-measure the whole page on every frame that landed a hit, just to restart a little bounce &mdash; about one restyle in three during a fight. It restarts the very same bounce now without stopping anything: the pop is copied from the stylesheet once, so it looks exactly as designed, pops on every hit, and the red shake when a big combo breaks still wins over it.</li>',
  '</ul>',
  '<p>Nothing looks different: the combo number, its pop and break flash, toasts moving aside for panels, monster chat bubbles over their heads and the HP and MP readouts all behave as before.</p>',
  '<p><b>Verified.</b> <code>scripts/recalc_perf_test.mjs</code> runs the same 60-monster fight on the build before this change and on this one, side by side in the same browser, and traces both in the same windows, so the machine&rsquo;s load lands on both alike. Style recalculations per frame: <b>3.1 &rarr; 2.1</b> (a third fewer); time spent in them: about a third less. That check fails on the old build. The same run confirms the combo count, that the pop restarts on every hit and is the stylesheet&rsquo;s own frame for frame, the break flash, toasts dodging an open panel, chat bubbles following their monsters, the HUD numbers, and no page errors.</p>',
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
