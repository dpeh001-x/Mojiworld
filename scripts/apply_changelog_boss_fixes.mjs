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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Libra&rsquo;s summons die with her, no intro card for a boss that isn&rsquo;t there, and a quick exit keeps your boon</span></h2>',
  '<p>Three boss bugs from the second bug hunt.</p>',
  '<p><b>Libra&rsquo;s summons outlived her.</b> Every other boss&rsquo;s adds vanish when it dies, but Libra&rsquo;s two Scale Lanterns (~970k HP) and two Scale Stormcallers stayed up after her death and kept hitting you. They now go with her.</p>',
  '<p><b>The intro card played for a dead boss.</b> Walking back into an arena within its 10-minute respawn window froze the game on the boss&rsquo;s intro card (&ldquo;KING GLOOPALOO&rdquo;) with no boss there, only the Echo Keeper &mdash; in every arena and all twelve zodiacs. The card now only plays when the boss actually appears.</p>',
  '<p><b>A quick exit lost the boon wheel.</b> The wheel opens 1.5&nbsp;s after a boss dies; stepping through the exit portal (or falling to a last hit) inside that window lost the boon for good, while the arena went on its 10-minute cooldown. The boon is now kept and the wheel opens as soon as you are back up and playing.</p>',
  '<p><b>Verified.</b> <code>scripts/boss_fixes_test.mjs</code> &mdash; 5 checks: Libra&rsquo;s four adds are gone the moment she dies and deal no more damage; no intro card while an arena&rsquo;s boss is on its respawn window, and the card is back with the boss; stepping out right after a kill still opens the boon wheel; no page errors. 3 of the 5 fail on the build before this fix.</p>',
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
