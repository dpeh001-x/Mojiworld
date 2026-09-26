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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Keybinds, SFX volume and the phone&rsquo;s F button: six input fixes</span></h2>',
  '<p>Six input and audio bugs from the second bug hunt.</p>',
  '<ul>',
  '<li><b>A skill on <kbd>E</kbd>, <kbd>O</kbd> or <kbd>H</kbd> fired twice over</b> &mdash; the skill <em>and</em> the key&rsquo;s own action (the quest guide, photo mode, MojiMon summon). Those keys are now refused for skills, like <kbd>J</kbd> and <kbd>P</kbd>; a skill already bound there takes the key over.</li>',
  '<li><b>A skill on an action&rsquo;s old key never cast.</b> Move Jump to <kbd>R</kbd>, put a skill on <kbd>Space</kbd>: it said &ldquo;Bound&rdquo;, but the skill was dead on every input. That key is now refused with a message instead.</li>',
  '<li><b>Movement stuck on after a Shift.</b> With Move Right on a punctuation key (e.g. <kbd>.</kbd>), letting go of it while holding <kbd>Shift</kbd> left the hero walking on their own. Keys are now released by the physical key.</li>',
  '<li><b>SFX at 0% still played footsteps and dialogue blips</b> (only Mute stopped them). They follow the SFX slider now.</li>',
  '<li><b>SFX set to 0 at the very start of a session came back</b> a moment later (a level-up rang out at 60%). The first-click sound warm-up now keeps your setting.</li>',
  '<li><b>Phone: F beside a chest did nothing</b> if you had moved the Pickup key or the F skill to another key. It opens the chest directly now.</li>',
  '</ul>',
  '<p><b>Verified.</b> <code>scripts/input_fixes_test.mjs</code> &mdash; 6 checks: E/O/H refused for skills; Space refused while it is Jump&rsquo;s old key; a Shift-release stops the hero; no footsteps or blips at SFX 0; on a phone, F beside a chest opens it with the F skill moved; no page errors. 5 of the 6 fail on the build before this fix. The first-click warm-up case was checked separately on the title screen.</p>',
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
