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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Save problems are explained where you can see them</span></h2>',
  '<p>A pre-launch playthrough as a brand-new and a returning player found four ways a save problem went unseen or was reported wrongly.</p>',
  '<ul>',
  '<li><b>A save that could not be read</b> was explained by a message that popped up behind the title screen and was gone before the menu appeared. Returning players saw only New Game, with Continue missing and no reason given. The message now sits inside the title menu, under Save Backups, and says the save is kept there. The &ldquo;save format updated&rdquo; notice now shows there too.</li>',
  '<li><b>Full browser storage</b> gave one warning (&ldquo;try removing painted layers in Wardrobe&rdquo;, which is the wrong advice for most players) and then stayed silent while nothing saved. The small &ldquo;saved&rdquo; chip in the corner now turns into a red <b>Not saving</b> badge that stays up until a save goes through. Hover over it or click it for advice: free up space in Save Backups or clear other site data, and export a Secure Save. Clicking it also opens Save Backups. The Wardrobe tip is added only if you actually have painted layers. If only your Wardrobe painting doesn&rsquo;t fit but your progress does, the game saves the painting inside your progress instead and no badge appears.</li>',
  '<li><b>An empty save</b> was treated as an &ldquo;older format&rdquo;. It produced a garbled message (&ldquo;vundefined&rdquo;) and left a junk entry in Save Backups. It is now reported as a save that could not be read, and nothing useless is kept.</li>',
  '<li><b>An old or minimal save</b> without health numbers loaded the hero at 100 HP out of 643. Missing HP and MP now start full. The title&rsquo;s Continue card also said &ldquo;saved just now&rdquo; for a save that was a day old, because it read the game&rsquo;s own save made while loading. It now shows when that save was really made.</li>',
  '</ul>',
  '<p><b>Verified.</b> A new browser test boots to the real title screen with an unreadable save, an empty save and a day-old minimal save, and checks that the notice is the topmost thing where it is drawn. It also fills the save slot during play and checks that the badge appears, stays through later failures, gives the right advice and clears once a save succeeds, and that running out of room for a painting alone does not raise it. Nine of its eleven checks fail on the build before this fix, and all eleven pass on the fixed build, three runs in a row.</p>',
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
