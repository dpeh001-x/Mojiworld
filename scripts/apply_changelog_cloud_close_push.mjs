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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Closing the tab no longer drops your last minutes from the cloud save</span></h2>',
  '<p><b>What you saw.</b> With a cloud account, the game sends your save to the cloud while you play (at most every 15 seconds) and once more as the tab closes. That last send used a kind of request browsers only allow for small messages (up to 64&nbsp;KB), and a late-game save is about 87&nbsp;KB &mdash; so it was silently refused. It had also restarted the 15-second timer, so the save made as the tab hid was held back too. Whatever you did in the last seconds before closing reached the cloud only the next time you played &mdash; and if you picked up on another device first, it simply was not there.</p>',
  '<p><b>What happens now.</b></p>',
  '<ul>',
  '<li>The moment the game is hidden &mdash; switching tabs or apps, minimising, or closing &mdash; your latest save goes to the cloud right away, as an ordinary request that has no size limit. The page is almost always still alive at that point.</li>',
  '<li>As the tab closes, the game only uses the small-message request for a save that fits. A bigger save is packed (compressed to roughly a quarter of its size) &mdash; once the cloud server has been updated to accept packed saves; until then that last send is skipped, because the send as the game was hidden already carried it.</li>',
  '<li>A save the cloud already has is not sent again, and the usual 15-second rhythm is kept.</li>',
  '</ul>',
  '<p>The cloud server part needs a server update from the team before packed saves are accepted; everything else works now, with the current server.</p>',
  '<p><b>Verified.</b> A test runs the real cloud server code, both the current one and the updated one, with a padded 90&nbsp;KB save: the save made just before hiding the tab lands in the cloud; a real tab close lands it too (packed, one request) on the updated server; a small save still goes the old way; nothing is sent twice; the current server never receives a packed save and still gets the save from the moment the tab was hidden; the updated server stores packed saves exactly and refuses oversized or broken ones. The build before this fix fails six of the twelve checks.</p>',
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
