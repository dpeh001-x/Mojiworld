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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> MojiMon Hunt Progress, made cute to match</span></h2>',
  '<p>Per user: <em>&ldquo;do the same cute style for the hunt progress&rdquo;</em> &mdash; the list at the bottom of the MojiMon tab of the species you are working towards binding.</p>',
  '<p>It now sits in a plush card like the ones above it, under a &#128062; <b>HUNT PROGRESS</b> title with a gold <b>10,000 kills to bind</b> chip. Each species is a rounded row: its sprite in a pastel bubble, its name in Fredoka, a candy progress bar &mdash; a dark track with little milestone dots at a quarter, half and three quarters, and a glossy lilac-to-pink fill &mdash; and its count on a pill (&ldquo;7,240 / 10,000&rdquo;).</p>',
  '<p>A species you can bind right now goes <b>mint</b>: a mint row and a full mint bar, its sprite bobs, and its pill says <b>&#9939; Ready to bind!</b>. The note under the list (&ldquo;Eligible species found &mdash; get close to a wild one to bind it!&rdquo;) is a mint pill with a sparkle.</p>',
  '<p>Same list (the top 8 species you have not bound yet, by kills), same order, same numbers. It keeps its look in the low-graphics mode, stops bobbing for <em>reduce motion</em> and fits a phone held sideways.</p>',
  '<p><b>Verified.</b> <code>scripts/mm_hunt_test.mjs</code> &mdash; 11 checks: no card before any kills; the top 8 unbound species by kills, most first, with a bound species and non-species keys left out; the title and the kills-to-bind chip; species past the bar are mint with a full bar and &ldquo;Ready to bind&rdquo;; every other bar fills to its real share with its real count; every row has its sprite and name; the eligible note appears with an eligible species and goes away (with the mint) when there is none; nothing spills and every bar has room on desktop and a phone; no page errors. <code>mm_roster_test</code>, <code>mm_cards_test</code> and <code>u_panel_text_test</code> still pass.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1800 || grew > 8000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
