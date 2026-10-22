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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Zodiac signature swings take at most 45% of your health</span></h2>',
  '<p>Per user (&ldquo;cap them to 45%&rdquo;), following the zodiac damage limit in v0.30.1853.</p>',
  '<p><b>What was happening.</b> Three zodiac bosses have a big signature swing: Ariel the Ember Ram (Aries), Caprikor the Peaklord (Capricorn) and Pisces the Twin Current. The last update put a limit on every zodiac shot and ground attack, but left these swings alone. They hit a fragile hero for up to 47% of her health, and the same on every difficulty. A shot landing right after a swing also did not count the swing, so the two together could reach 92% on Normal.</p>',
  '<ul>',
  '<li><b>A signature swing now takes at most 45% of your health, on every difficulty.</b> Swings that already hit for less are unchanged, Story included. On Story the swing keeps its own 45% limit instead of dropping to the 30% limit for shots.</li>',
  '<li><b>A swing now counts toward the zodiac limit for hits that land close together.</b> A shot that lands within about a second of a swing shares that difficulty&rsquo;s limit with it, so the two together stay within it. In normal play the short protection after a hit already keeps them apart, so this only matters if that protection is cut short. A swing that lands after a shot is not reduced below its own 45% limit.</li>',
  '<li><b>Co-op partners</b> get exactly the same limit, worked out from their own health.</li>',
  '</ul>',
  '<p><b>Measured</b> in each boss&rsquo;s arena with the boss&rsquo;s real swing, against level 70 heroes wearing the best shop gear for their level. Here is the worst swing as a share of maximum health. It is the same on every difficulty, before &rarr; now:</p>',
  '<table><tr><th>Boss</th><th>Mage</th><th>Archer</th><th>Warrior</th><th>Mage: a swing, then a shot (Normal)</th></tr>',
  '<tr><td>Ariel (Aries)</td><td>36% &rarr; 36%</td><td>27.5%</td><td>10%</td><td>81% &rarr; 45%</td></tr>',
  '<tr><td>Caprikor (Capricorn)</td><td>44.8% &rarr; 44.8%</td><td>34.1%</td><td>12.4%</td><td>89.8% &rarr; 45%</td></tr>',
  '<tr><td>Pisces</td><td>46.7% &rarr; 45%</td><td>35.6%</td><td>12.9%</td><td>91.7% &rarr; 45%</td></tr>',
  '</table>',
  '<p><b>Verified.</b> A browser test goes to each of the three arenas and sets off the boss&rsquo;s real swing against a level 70 mage, archer and warrior on every difficulty, always with the highest possible damage roll. It checks that no swing passes 45%, and that a lighter swing is unchanged. It also checks that a shot landing right after a swing stays within the difficulty&rsquo;s limit, that a swing after a shot is not cut below its own limit, that a co-op partner who receives the host&rsquo;s swing gets the same limit, and that an ordinary monster&rsquo;s swing is not affected. On the build before, 5 of its 11 checks failed. Now all 11 pass, and the earlier zodiac and Regulus damage tests still pass.</p>',
  '');
s = s.replace(ANCHOR, () => ENTRY);
if (s.includes('@@')) { console.error('ABORT: placeholder left in'); process.exit(1); }
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
