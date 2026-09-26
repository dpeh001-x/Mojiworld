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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> A painted Wardrobe no longer makes the game hitch every time it saves</span></h2>',
  '<p>The pre-launch performance audit found that if you had painted your hero in the Wardrobe, <b>every save wrote your whole painting again</b> &mdash; up to 12 painted layers, 1 to 3&nbsp;MB of picture data. The game saves every few seconds in a fight, so a painted hero got a small freeze every 5&ndash;10 seconds in combat. The painting also took up most of the browser&rsquo;s save space, so fewer Save Backups fitted.</p>',
  '<ul>',
  '<li><b>Your painting is now kept on its own</b> and only written when you actually change it in the Wardrobe. An everyday save of a painted hero is as small and quick as an unpainted one.</li>',
  '<li><b>Older saves move over by themselves.</b> Your painting loads exactly as before, and the next save stores it the new way.</li>',
  '<li><b>Your painting still goes everywhere your save goes:</b> Save Backups (making and restoring them), Secure Save files and importing them, your online account&rsquo;s cloud save and Steam Cloud.</li>',
  '<li><b>New Game and Erase</b> clear the painting along with the save.</li>',
  '<li>If the browser&rsquo;s storage is too full to keep the painting separately, the save keeps it inside itself the old way, so nothing is lost. If even that does not fit, you get the usual &ldquo;save full&rdquo; warning, your progress is still saved, and your last saved painting stays.</li>',
  '</ul>',
  '<p><b>Verified.</b> <code>scripts/paint_save_test.mjs</code> &mdash; 20 checks on a hero painted with 12 layers of random noise, stored exactly the way the Wardrobe stores a painting, with every write to browser storage counted: the save stays small (the test hero wrote 3&nbsp;KB per save instead of 877&nbsp;KB), five saves in a row never rewrite the painting, changing one layer rewrites it once, a reload gives back identical paint and identical pixels on the hero, an old save moves over and keeps its painting, and a backup restore, a Secure Save export and import, the account cloud and Steam Cloud (both directions), a full storage, and New Game all behave as described above, with no page errors. 13 of the checks fail on the build before this fix.</p>',
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
