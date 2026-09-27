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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Going down shows the DOWNED card again, and your HP reads 0</span></h2>',
  '<p>Per user: <em>&ldquo;when I am downed it puts my HP as 1 instead of 0 and does not show the DOWNED UI HUD&rdquo;</em>.</p>',
  '<ul>',
  '<li><b>No DOWNED card.</b> The game plays a quiet 5-second &ldquo;onboarding&rdquo; down (no card) while a new player is still in the prologue or the tour. It decided that partly from a &ldquo;tour finished&rdquo; flag &mdash; and a character whose flag was never set counted as mid-tour forever, so every down was the silent one: no card, no countdown, a quiet respawn. Now a down is an onboarding down only while the prologue, a story scene or the tour card is actually on screen, and the card stays hidden only over the prologue and story scenes. During the tour you get the card with its short countdown.</li>',
  '<li><b>HP 1 instead of 0.</b> While you are down the game holds your HP at 1 behind the scenes, so nothing can kill you in the middle of the countdown &mdash; and the HUD showed that 1. The HP number and bar now read 0 while you are down, and your real HP again the moment you are back up.</li>',
  '</ul>',
  '<p><b>Verified.</b> <code>scripts/downed_ui_test.mjs</code> &mdash; 8 checks through the real lethal-hit chain: an ordinary down (card + 0 HP), the reported case (tour flag never set: card, 0 HP, the full 30 s window), a down during a story scene (still silent), a down during the tour (card and its 5 s countdown), the HUD back to real HP after, no page errors. The build before this fix fails 5 of them.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 300 || grew > 4000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
