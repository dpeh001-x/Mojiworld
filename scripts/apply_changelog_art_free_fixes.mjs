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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Cleaner, crisper effects, backdrops and world map</span></h2>',
  '<p>An art check found that many pictures still carried marks left by image compression: a faint grid of little squares and blotchy patches, most visible in smooth glows, dark skies and soft gradients. A lot of the spell and attack effects also looked slightly soft around their edges.</p>',
  '<ul>',
  '<li><b>1082 pictures across 187 effects</b> are cleaned and sharpened: your skills&rsquo; bursts, slashes and projectiles, the ground hazards, and the bosses&rsquo; and monsters&rsquo; own swings and shots. Edges are crisper and the blotches are gone.</li>',
  '<li><b>The world map</b> is cleaned and sharpened the same way, so its rivers, roads and landmarks read crisply instead of smudged.</li>',
  '<li><b>9 map backgrounds</b> lose most of their square grid. (The other backgrounds the check flagged could not be cleaned without making them several times bigger to download, so they stay as they were for now.)</li>',
  '<li><b>Five menu backgrounds</b> (the Edicts panel, the misty graveyard behind the words you see when you fall, the Judgement Seal button challenge, the boon-choice card and the MojiMon tab) are clean, with no square grid at all.</li>',
  '</ul>',
  '<p><b>Nothing else changes.</b> Every picture keeps its name, its size and its exact outline, so effects sit, scale and hit exactly where they did. No new art was generated: the same pictures were cleaned. The game downloads about 8 MB more in total. Returning players get the new art straight away.</p>',
  '<p><b>Verified.</b> A test checks that every replaced picture is the reviewed clean one, at its old size, with its outline unchanged pixel for pixel. It also measures that the compression grid is down on the effects, the world map and every cleaned background, and that the game loads and plays the cleaned effects.</p>',
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
