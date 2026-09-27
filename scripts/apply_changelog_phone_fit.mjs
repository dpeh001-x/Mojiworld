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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Phone fit: character creation can be finished on a small phone, and six other screens fit</span></h2>',
  '<p>A layout pass on a landscape phone (667&times;375 and 844&times;390, touch) and a 1280&times;720 window found screens you could not use. Only sizes, scrolling and positions changed; the looks are the same.</p>',
  '<ul>',
  '<li><b>Character creation (the big one).</b> On a 667&times;375 phone the <b>Next</b> button sat below the screen inside a box that does not scroll, so a new player could not get past the look page. On short screens the page between the title and the buttons now scrolls, and the Back / Look &middot; Class / Next row stays pinned at the bottom.</li>',
  '<li><b>Jukebox.</b> On a small phone its top bar was wider than the console, so the only &#10005; was cut off (and there is no Esc on a phone). The katakana sticker steps aside on narrow screens, and the &#10005; always stays on the console.</li>',
  '<li><b>Guguma&rsquo;s &ldquo;Ascend&rdquo; pill</b> (at the level cap) floated over every window and the touch buttons: a tap on Settings&rsquo; Done, the shop&rsquo;s Buy, Level Up&rsquo;s + or the attack button hit the pill. It now hides while any window is open, sits under the windows, and parks where no button or the minimap is underneath (on a phone, under the top menu row; on a desktop with the minimap in the corner, bottom-left).</li>',
  '<li><b>Title menu.</b> On a landscape phone only New Game and Play Co-op showed; Settings, Save Backups and the community links were below the fold with no hint. A yellow <b>More &#9662;</b> tab now sits on the menu&rsquo;s bottom edge while there is more below, and a tap scrolls on.</li>',
  '<li><b>Quest journal.</b> The category chips (All / Story / Class / Bounties) ran off the card on a small phone; they wrap onto their own row now.</li>',
  '<li><b>Reforge Bench.</b> On a small phone the bench spilled out of its card and the Reforge button was off screen. The card uses the full screen height and scrolls.</li>',
  '<li><b>Level Up (U) panel.</b> The header took about half the panel: at 1280&times;720 the Items tab showed no items without scrolling, and Achievements sat on a row of its own. The crest, gaps and tab spacing are tighter, the six shortcuts fit on one row, the first row of items shows straight away, &ldquo;Level Up&rdquo; no longer wraps on a phone, and the channel chip no longer hides under the &#10005;.</li>',
  '</ul>',
  '<p><b>Verified.</b> <code>scripts/phone_fit_test.mjs</code> &mdash; 23 checks with real taps and finger drags at 667&times;375 and 844&times;390 (touch) and 1280&times;720: every title option on screen or reachable with the More tab; Next reachable and turning the page; the jukebox &#10005; on screen and closing it; the Ascend pill hidden under Settings, Level Up, the shop and the jukebox, below the windows and clear of every touch button and the minimap; the journal chips inside the card; the Reforge button reachable with gear on; an item row above the fold and the shortcuts on one row in the U panel; no page errors. Fifteen of them fail on the build before this fix, including Next and the jukebox &#10005; at 667&times;375.</p>',
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
