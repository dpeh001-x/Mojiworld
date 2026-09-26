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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> MojiMon, expeditions and Ascend: five fixes from the second bug hunt</span></h2>',
  '<p><b>Expeditions refunded their potions.</b> When a run ended by death, Bravo&rsquo;s Abandon or a clear, your wallet went back to its pre-run amount <em>including</em> what the run spent &mdash; every potion the auto-buy bought in the tower was free. The run&rsquo;s spending is now kept, as it already was when leaving by taxi or reloading.</p>',
  '<p><b>Species mastery counted mirages and away kills.</b> The 10,000-kill hunt that unlocks a MojiMon counted each Mirage Stalker copy (three kills per stalker) and kills your summon made while you were away &mdash; both of which count for nothing everywhere else. They no longer feed mastery.</p>',
  '<p><b>The minion cap pushed out your MojiMon.</b> A warlock&rsquo;s undead filling the minion cap removed your fielded MojiMon first, which then read as &ldquo;Your MojiMon was defeated!&rdquo; and started its 5-minute cooldown. The cap now trims your oldest <em>other</em> minions.</p>',
  '<p><b>H summoned your MojiMon while you were dead.</b> It was fielded under the death screen and burned its cooldown. You now summon once you are back up (your MojiMon still returns by itself after a map change).</p>',
  '<p><b>Ascend named an heirloom you never picked.</b> Ascending from the pause menu without choosing an heirloom said your first bag boon would be kept. With none chosen, none is named.</p>',
  '<p><b>Verified.</b> <code>scripts/pet_fixes_test.mjs</code> &mdash; 7 checks: the cap keeps your MojiMon; H does nothing while dead and works once alive; mastery counts a Mirage Stalker once and an away kill not at all; Ascend names no heirloom; an abandoned expedition keeps its potion; no page errors. 4 fail on the build before this fix.</p>',
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
