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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Gear stats after a class swap, unequipping into a full bag, and HP above max</span></h2>',
  '<p>Three gear bugs found in a bug hunt.</p>',
  '<p><b>Switching class kept the old class&rsquo;s gear stats.</b> Gear pays more on its own class (and a class set&rsquo;s bonus only counts for that class), but swapping class at the Amnesiac never refreshed the cached gear totals, and then filled your HP from them. A level-60 Warrior in the Doomforged set who became a Rogue showed <b>ATK 675 / DEF 165 / max HP 2562</b> instead of the true <b>343 / 97 / 1437</b>, with HP filled to 2562, until something else happened to refresh the stats. The swap now refreshes them before your HP is filled.</p>',
  '<p><b>Taking gear off ignored a full bag.</b> Clicking a worn piece put it back in the Equip tab even when the tab was full, so a full tab could go to 43/40. It is now refused with the same &ldquo;tab is full &mdash; free a slot first&rdquo; message the swap already gave.</p>',
  '<p><b>HP above max while the inventory stayed open.</b> Taking off a +HP piece left the HUD reading, say, <b>919 / 195</b> until you closed the panel. HP and MP now drop to the new max straight away when gear goes on or comes off.</p>',
  '<p><b>Verified.</b> <code>scripts/gear_fixes_test.mjs</code> &mdash; 6 checks: after a class swap the stats are the new class&rsquo;s and HP is filled to the true max; unequipping into a full tab is refused and, with room, still works; HP drops to the new max with the inventory open; no page errors. 5 of the 6 fail on the build before this fix.</p>',
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
