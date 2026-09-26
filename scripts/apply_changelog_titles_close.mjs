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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> The Titles panel steps aside when you open another panel</span></h2>',
  '<p>Found in a bug hunt. With <b>Titles</b> open (from the Level Up panel&rsquo;s jump row), pressing <kbd>U</kbd> or <kbd>J</kbd> opened the Level Up panel or the Journal <em>underneath</em> it, so nothing seemed to happen until <kbd>Esc</kbd> took Titles down. The routine every panel calls to clear the screen first never closed Titles, because Titles is built and removed on its own rather than hidden like the others.</p>',
  '<p>Titles now closes with every other panel, and its own <kbd>Esc</kbd> listener goes with it, so it can never linger and swallow <kbd>Esc</kbd> for the next panel (reopening Titles no longer stacks a second one either). Its Close button and <kbd>Esc</kbd> work as before.</p>',
  '<p><b>Verified.</b> <code>scripts/titles_close_test.mjs</code> &mdash; 7 checks: <kbd>U</kbd> and <kbd>J</kbd> bring their panel up on top; one <kbd>Esc</kbd> then closes it; Titles reopened twice still closes on one <kbd>Esc</kbd>; closing all panels takes Titles down and unpauses; its Close button and <kbd>Esc</kbd> still work; no page errors. 4 of the 7 fail on the build before this fix.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 700 || grew > 4000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
