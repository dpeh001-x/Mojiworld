import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_CHANGELOG_FILE || 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const VER = process.env.LX_VER;
if (!VER) { console.error('ABORT: LX_VER unset'); process.exit(1); }
if (s.includes('>' + VER + ' <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const ENTRY = J(
  '</header>',
  '',
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> DJ Vinyl&rsquo;s jukebox now carries &mdash; and can unlock &mdash; every BGM in the game</span></h2>',
  '<p>Per user: <em>&ldquo;ensure that the jukebox NPCs plays all the available BGM in the game&rdquo;</em>.</p>',
  '<p><b>Audited against the game&rsquo;s own music tables</b> &mdash; all 98 maps with a theme (42 distinct files), the generic boss theme, the default world theme and the start-page theme &mdash; rather than the audio folder, which also holds stingers, narration, ambience beds and backups.</p>',
  '<p><b>Three themes the game plays were never in the jukebox:</b></p>',
  '<ul><li><b>The Inner Dimension &middot; Confused Vigil &middot; Block-land Apex</b> &mdash; <code>bgm_king.mp3</code>, the arena theme those three were given in v0.29.631</li>',
  '<li><b>Bone Graveyard &amp; Crypt of Whispers</b> &mdash; <code>bgm_bone_graveyard.mp3</code>, played on four maps</li>',
  '<li><b>Moji is Loading</b> &mdash; the loading / start-page theme every player hears first</li></ul>',
  '<p><b>And two could never be unlocked.</b> The jukebox is a discovery log (v0.29.76, per user): a theme opens once it has played on a map. <b>Zodiac Hall (legacy)</b> was replaced by the Sanctum theme and plays nowhere, and the <b>title theme</b> plays before a save even loads &mdash; so both would have stayed &ldquo;??? &mdash; undiscovered&rdquo; forever. Those two now carry an <code>always</code> flag and are open from the start.</p>',
  '<p><b>The discovery lock itself is unchanged:</b> every other theme still has to be heard first, and the two new map themes unlock through the same hook the moment you enter one of their maps. There is one DJ Vinyl (Everdawn Central) and one catalogue, so this reaches every jukebox.</p>',
  '<p><b>Deliberately not added:</b> <code>audio/boss/</code> are 2&ndash;4 s intro stingers, <code>audio/story/</code> is narration, <code>audio/ambient/</code> are ambience beds, <code>audio/_themes_backup/</code> is five backups the game never references, and <code>bgm_glasswind.mp3</code> is the legacy file the listed Glasswind track replaced.</p>',
  '<p><code>scripts/jukebox_all_bgm_test.mjs</code> &mdash; 8 checks in a live game: every played theme is listed; every listed file exists on origin; every track is unlockable; discovery still locks on a fresh save; entering Bone Graveyard and the Inner Dimension through the real map path unlocks their themes; exactly the two <code>always</code> tracks are open on a fresh save; and all 46 rows, clicked one by one, each become the playing track with their own file. Against the previous build it fails exactly the four gaps above.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1500 || grew > 9000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
