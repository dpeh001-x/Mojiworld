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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Phones: notifications, the Level Up shortcuts and Guguma&rsquo;s offer stay out of the way</span></h2>',
  '<p>Three things on a landscape phone (844&times;390 and 667&times;375, touch) still sat on top of other things after the last round of phone fixes. Only positions, sizes and what is shown changed; nothing was restyled.</p>',
  '<ul>',
  '<li><b>Notifications covered the area chip and the quest tracker.</b> The last round moved the &ldquo;LUCID +12% EXP&rdquo; chip, the Multi chip and the quest tracker below the phone&rsquo;s menu buttons, into the top-right corner where notifications pop up, so every notification landed on them. On a phone the notifications now stack in the open space in the middle, under the area name, and stop above your skill buttons. On a computer they stay in the top-right corner.</li>',
  '<li><b>The Level Up window&rsquo;s shortcuts took two lines.</b> On a 667&nbsp;px phone, &ldquo;Achievements&rdquo; wrapped onto a row of its own. The shortcut buttons showed keyboard keys (<kbd>W</kbd> <kbd>Q</kbd> <kbd>Y</kbd> <kbd>L</kbd>) that a touch screen does not have. On a touch screen those keys are hidden now, like the close hints before them, and all six shortcuts fit on one line. A keyboard still sees them.</li>',
  '<li><b>Guguma&rsquo;s level-cap offer covered the controls.</b> When you first reach the level cap, Guguma&rsquo;s full card (the Heirloom pick, <b>Ascend</b> and <b>Later</b>) sat on the d-pad, the potions or the skill buttons. On a phone it now shrinks until it fits in the open space between the controls, and it keeps clear of the health panel, the area name and the quest tracker when there is room. On a screen too small even for that, Guguma folds it straight into her small &ldquo;Ascend with Guguma&rdquo; button. Moving the card could also raise a &ldquo;Something went wrong, but the game kept running&rdquo; notice on a phone; that is gone too. The card on a computer is unchanged.</li>',
  '</ul>',
  '<p><b>Verified.</b> An automated check measured on-screen positions on both phone sizes with touch and at 1280&times;720. On the phones, three notifications were raised at once and none covered the chips, the quest tracker or any touch button. The Level Up shortcuts sat on one line with no label cut, on two tabs. Guguma&rsquo;s card was checked when it first appears and again after <b>Later</b> and a tap on her button: it was clear of every touch button, with Ascend and Later still tappable. On the computer, the notifications, the shortcut keys and the card were as before. There were no errors. The phone checks fail on the build before this change.</p>',
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
