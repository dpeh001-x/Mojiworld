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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> The title menu comes up first: only its own art loads before it</span></h2>',
  '<p>On a first visit, about 50&nbsp;MB downloaded before you could click anything on the title menu: every town&rsquo;s backdrop, the town characters, every hairstyle, eye and mouth of the character creator, and the menu tabs. On a slow connection that was about a minute of loading screen, and almost none of it was on the title.</p>',
  '<ul>',
  '<li><b>The title menu now waits only for itself:</b> the game page, its fonts, the key art, the logo and the menu buttons.</li>',
  '<li><b>Everything else starts the moment the menu is up</b>, so it downloads while you read it. The map you are about to enter comes first: the creator&rsquo;s hairstyles and faces for a new hero, or the town for Continue, plus the backdrops of the maps next door. The other towns, their characters and the menu tabs follow.</li>',
  '<li><b>New Game and Continue still wait for your map&rsquo;s art</b> if you click before it has arrived, and the button you pressed now says <i>Loading your world&hellip;</i> while they do. The creator opens with every part drawn, and the town opens on its own backdrop, never blank hair or an empty sky.</li>',
  '<li>A save that could not be read is explained on the title menu from the moment it appears.</li>',
  '<li><b>Continue prepares the town.</b> Every saved game resumes in town, but a save made anywhere else used to load that other map&rsquo;s monsters and backdrop at start-up. The town is prepared instead now.</li>',
  '</ul>',
  '<p><b>Verified.</b> <code>scripts/title_first_test.mjs</code> boots the game from a fresh profile on a throttled 1.5&nbsp;MB/s line, once in the old order and once in the new one, in the same run:</p>',
  '<ul>',
  '<li>The title menu was ready after 19&nbsp;MB in 77 files at about 13&nbsp;s. In the old order it took 56&nbsp;MB in 222 files and about 38&nbsp;s. The key art, logo, buttons and fonts were all loaded when it appeared.</li>',
  '<li>New Game, clicked the moment the menu appeared, opened the creator with its hair, eyes, mouth, head and part pictures all loaded. The total time from page load was no longer than before.</li>',
  '<li>Continue on a save made in the Mushroom Forest prepared the town and not the forest. The town&rsquo;s backdrop was drawn in the first frame after the loading screen, and the total time was no longer than before.</li>',
  '<li>A returning player with the files already cached got the title in about 1.5&nbsp;s, down from about 5&nbsp;s.</li>',
  '<li>There were no page errors. The earlier start-up checks for boss art, map art and skill effects still pass.</li>',
  '</ul>',
  '<p>On the build before the fix, the size, time and &ldquo;starts right after the title&rdquo; checks fail.</p>',
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
