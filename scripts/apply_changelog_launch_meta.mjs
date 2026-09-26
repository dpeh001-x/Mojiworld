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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Launch tidy-up: link previews, no dev lock for players, a leaner web build and a portable zip that builds</span></h2>',
  '<p>From the pre-launch infrastructure audit. None of this changes how the game plays; it is what a new player sees before and around it.</p>',
  '<ul>',
  '<li><b>Link previews.</b> Sharing <b>play.moji-studios.com</b> in Discord, X or a chat app showed a bare address. It now shows the game&rsquo;s name, a one-line description and the title key art. The site also has a web app manifest (name, icons, full screen, landscape) for &ldquo;Add to Home Screen&rdquo;, and a <code>robots.txt</code>.</li>',
  '<li><b>The little lock in the top-right corner is gone for players.</b> It was the developer&rsquo;s door, and every visitor saw it. Testers open the site once with <code>?devlock=1</code> to get it back; on a developer&rsquo;s own machine it is still there. The Steam build never had it and still does not.</li>',
  '<li><b>A leaner, safer web build.</b> The site no longer publishes repository files players never need (<code>.gitignore</code>, the standby relay blueprint, the package files), and of the cinematics folder it ships only the clips the game actually plays &mdash; all 22 of them today &mdash; not the review page or thumbnails. The data tables now load with the game&rsquo;s version in their address, so right after an update a browser can no longer pair the new game with ten-minute-old tables.</li>',
  '<li><b>Portable zip.</b> The Windows zip build stopped with an error before it ever produced a zip, and would have packed old audio backups. It now builds, and leaves the backups out. Its <code>PLAY_ME_FIRST.txt</code> and the launcher&rsquo;s &ldquo;no Node.js&rdquo; fallback now send you to <b>play.moji-studios.com</b>.</li>',
  '<li><b>README.</b> Two stale control rows are gone: <kbd>T</kbd> is the co-op ping now, not &ldquo;reset save&rdquo;, and the hold-<kbd>1</kbd>+<kbd>2</kbd>+<kbd>3</kbd> dev console no longer exists. The Download section says the first release is coming soon. The Steam build&rsquo;s version number follows the game&rsquo;s again.</li>',
  '</ul>',
  '<p><b>Verified.</b> A test boots the game and reads the share tags and the manifest (every icon loads); opens it as the public site, where the lock is gone, then with <code>?devlock=1</code>, where it is back, and as the Steam app, where it never shows; runs the new deploy steps on a copy of the site; checks the README, launcher and Steam version; and builds a portable zip in a temporary folder with no backups inside. The share-tag, lock and zip checks fail on the build before this change. The full site assembly was also dry-run on a copy of the repository.</p>',
  '');
s = s.replace(ANCHOR, () => ENTRY);
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
