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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Keybinds, audited end to end: fourteen fixes so every key does one thing, and the thing it says</span></h2>',
  '<p>Per user: <em>&ldquo;ensure keybinds work properly without any issue at all&rdquo;</em>. A full audit rebound every action (18 of them) to letters, digits, punctuation, arrows, Space and Shift, every skill slot, the Cure and Pickup keys, and drove the K panel, reloads, resets, held keys, typing, the phone deck and a controller. The basics held; these fourteen did not.</p>',
  '<p><b>Which keys a bind may take &mdash; now one set of rules for every chip.</b></p>',
  '<ul>',
  '<li>Dropping a skill on the <b>Keyboard tab</b> took any key: on <kbd>Space</kbd> it jumped <em>and</em> cast, on <kbd>W</kbd> it opened the map and never cast. It now refuses the same keys the skill chip does.</li>',
  '<li>A skill on <kbd>Shift</kbd>, <kbd>PgUp</kbd> or <kbd>PgDn</kbd> never cast once Dash or the potion had moved away. Refused with a message now (it is fine while Dash/the potion is still there).</li>',
  '<li>The <b>Cure</b> and <b>Pickup</b> keys were invisible to the other chips: Move Left on the Cure key walked <em>and</em> burned a Remedy each step; Jump on the Pickup key jumped and opened chests; a skill on the Cure key quietly killed Cure. Each chip now knows the others&rsquo; keys.</li>',
  '<li>A Pickup key on a moved action&rsquo;s old key did nothing &mdash; refused now.</li>',
  '<li>Actions, Cure and Pickup could take <kbd>E</kbd> <kbd>O</kbd> <kbd>H</kbd> <kbd>J</kbd> and the digits, keys the interface already uses (World Map on <kbd>O</kbd> took photo mode&rsquo;s key). One shared reserved list for all of them now.</li>',
  '<li><b>Mute</b> could never go back to <kbd>M</kbd>. An action can always return to its own key.</li>',
  '<li>A skill may still sit on <kbd>Shift</kbd>, <kbd>PgUp</kbd> or <kbd>PgDn</kbd> while Dash or the potion is there (it wins the key, as designed), and <b>Cure</b> can always go back to <kbd>Shift</kbd>, which it shares with Dash.</li>',
  '</ul>',
  '<p><b>Every input path and label follows your binds.</b></p>',
  '<ul>',
  '<li>The <b>skill bar</b> showed the old letters until a reload, and Block always said <kbd>A</kbd>. It updates the moment you rebind.</li>',
  '<li><b>Phone:</b> after swapping skills, a button showed one skill and cast another; with a skill on PgDn the MP button cast the skill. Both fixed &mdash; the HP/MP buttons follow your K&nbsp;&#9656;&nbsp;Potions choice.</li>',
  '<li>The HUD <b>Hotkeys</b> chip stopped opening the panel once its key moved; it opens it directly now and shows your key.</li>',
  '<li><b>Controller</b> skill buttons ignored keyboard skill rebinds; they follow them now, like the phone deck.</li>',
  '<li>With a <b>dropdown</b> focused (sort, Settings, the Studio), game keys still fired &mdash; <kbd>W</kbd> opened the World Map. Dropdowns count as typing now.</li>',
  '<li>Punctuation binds didn&rsquo;t fire while holding <kbd>Shift</kbd> (the Dash key), because Shift changes the character; they do now (your real keyboard layout is used).</li>',
  '<li>Resetting binds while holding a rebound move key left the hero walking. Fixed.</li>',
  '<li>Prompts that named fixed keys &mdash; the in-world <b>N&nbsp;Talk</b> / <b>N&nbsp;Open</b>, the K panel&rsquo;s &ldquo;Press K&rdquo; and &ldquo;Press Q&rdquo;, the HUD&rsquo;s K &mdash; now show the key you actually bound.</li>',
  '</ul>',
  '<p><b>Verified.</b> <code>scripts/keybinds_test.mjs</code> &mdash; 17 checks through the real K panel: the Keyboard-tab drop, Shift after Dash moves, Cure and Pickup against actions, the reserved list and Mute on M, the skill bar and Block labels, the HUD chip, the controller, a focused dropdown, a Shift-held punctuation bind, a reset mid-hold, the Cure key after a Reset, a skill on a Cure key of its own, Cure back on Shift, the phone MP button with a skill on PgDn, an ordinary rebind, no page errors. The first six fail on the build before this fix (the rest had no hooks to test before). The full audit matrix was re-run on the fixed build.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 700 || grew > 5500) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
