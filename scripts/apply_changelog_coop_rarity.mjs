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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Co-op loot can no longer carry hidden code into your item windows</span></h2>',
  '<p>The pre-launch security audit found a hole in co-op. When you play with a party, the host&rsquo;s game shares every loot drop with you, and your game copied what it was sent almost as-is. A tampered host could send an item whose rarity label hid a piece of page code. Nothing looked wrong &mdash; but hovering that item in your bag, its tooltip, the Forge, the Reforge bench or the sell desk ran the code inside your game, the same page that keeps your cloud-save sign-in. The item then stayed in your save and did it again every session.</p>',
  '<ul>',
  '<li><b>Loot from a party member is cleaned the moment it arrives.</b> Its rarity must be one of the real five (Common, Rare, Epic, Legendary, God) &mdash; anything else becomes Common; its stars and tier must be real numbers; quote marks and angle brackets are removed from every name and label on it. The same goes for the rarity of the boon orbs a host shares.</li>',
  '<li><b>Every item window only prints a real rarity</b>, so even an item that somehow slipped through cannot break out of its colour label.</li>',
  '<li><b>Saves heal themselves.</b> When your save loads, any item in your bag or equipped with an unknown rarity becomes Common, and a broken star count is fixed. Nothing else in the save changes.</li>',
  '<li>Ordinary loot is untouched: an Epic drop from your party arrives exactly as the host rolled it, and <em>Hunter&rsquo;s Shortbow</em> keeps its apostrophe.</li>',
  '</ul>',
  '<p><b>Verified.</b> <code>scripts/coop_rarity_test.mjs</code> &mdash; 13 checks, playing as a party member who follows a host: a tampered drop and an ordinary Epic drop sent through the real co-op receiver and picked up by walking over them; then the bag, the tooltip with its comparison lines, the better-gear card, the equipped slot, the Forge, the Reforge bench and the sell desk were all opened and hovered, and a save holding the tampered item in the bag and in an equipped slot was loaded. On the build before this fix eight of the checks fail and the hidden code runs; on this build nothing runs, the tampered item arrives as a plain Common, the save comes back clean, the ordinary Epic arrives intact, and there are no page errors.</p>',
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
