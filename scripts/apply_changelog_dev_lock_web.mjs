import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_CHANGELOG_FILE || 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const VER = process.env.LX_VER;
if (!VER) { console.error('ABORT: LX_VER unset'); process.exit(1); }
if (s.includes('>' + VER + ' <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>';   // (not '</header>' + a blank line: entries now follow it directly)
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const ENTRY = J(
  '</header>',
  '<h2>' + VER + ' <span class="tag"><span class="pill feat">feat</span> The dev lock icon is back on the public link, for testers &mdash; still behind its password, still not in the Steam app</span></h2>',
  '<p>Per user: <em>&ldquo;can we put back the dev mode with the lock icon for my tester to test&rdquo;</em>.</p>',
  '<p>v0.30.797 kept every developer tool to developer machines (a file opened locally, localhost, or a home-network address), so a tester playing the public link had no way in: no lock icon, no <code>?dev=1</code>, no backtick prompt. The faint &#128274; at the top-right is back on the public web. Clicking it asks for the dev password; the right one unlocks that browser for good (&#128275;, the dev console opens), and from then on it works like a developer machine &mdash; the console, the backtick, <code>?dev=1</code>, the phone&rsquo;s dev button and the developer settings rows. Every other visitor is exactly where v0.30.797 left them: a faint lock, and <code>?dev=1</code> or the backtick alone unlock nothing. The packaged Steam app still never shows any of it. <kbd>~</kbd> (Shift+backtick) locks a browser again.</p>',
  '<p><b>Verified.</b> <code>scripts/dev_lock_test.mjs</code> &mdash; 10 checks on a simulated public host: the lock is there; <code>?dev=1</code> and the backtick alone open nothing; a wrong password leaves it locked; the password unlocks it and opens the console; the browser is still unlocked on its next visit and the backtick opens the console; the packaged app shows no lock even with the flag set; localhost is unchanged. It fails 5 of 10 on the previous build. On a phone in landscape and on desktop the lock overlaps no button.</p>',
  '');   // a trailing EOL, so whatever followed </header> starts on its own line
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1200 || grew > 6000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
