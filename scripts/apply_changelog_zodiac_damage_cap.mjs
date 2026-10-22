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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> No zodiac boss can kill you from full health with one hit</span></h2>',
  '<p>After the Regulus fix, per user: the same fairness for every zodiac boss, with one limit for all twelve.</p>',
  '<p><b>What was wrong.</b> Every zodiac boss&rsquo;s shots hit for a big flat amount with no upper limit. A level 70 mage at full health lost her whole bar to one shot on Normal, and twice her bar on Nightmare, from any of the eleven other signs. Some ground attacks were worse, because they were worked out from the boss&rsquo;s raw attack power and grew the further your level was above the arena&rsquo;s: Scorpio&rsquo;s Ambush took 145% of that mage&rsquo;s health on Normal, and the lingering Venom Deluge pools took half her bar every half second. Some attacks also left no breathing room before the next one, so two hits could land almost together: Ariel&rsquo;s charge trail with a shot on top, Sagittarius&rsquo;s Marked Shot (it hits the mark and its arrow lands right after), Pisces&rsquo;s Tidal Crush, Aquarius&rsquo;s lightning pool, Regulus&rsquo;s roar shockwave with a shot behind it.</p>',
  '<ul>',
  '<li><b>One limit for every zodiac boss:</b> no single hit from a shot or a ground attack can take more than 30% of your health on Story, 45% on Normal, 65% on Hard or 85% on Nightmare. Regulus uses the same limits now (his were 55% on Hard and 65% on Nightmare).</li>',
  '<li><b>Hits that land close together share the limit.</b> Everything a zodiac boss lands on you within about one second counts toward the same limit, so a ground attack, a shockwave or a point-blank kick with a shot right behind it can no longer add up past it.</li>',
  '<li><b>Ariel&rsquo;s charge trail and cracked tiles, and Scorpio&rsquo;s Ambush</b> now hit like those bosses&rsquo; shots (Scorpio&rsquo;s are still 30% gentler than the others), and after one hits you, you get the same short protection a shot gives. Scorpio&rsquo;s venom pools now nibble (about a tenth of a mage&rsquo;s health on Normal each tick) instead of biting.</li>',
  '<li><b>Co-op partners</b> get exactly the same limits, worked out from their own health and defence.</li>',
  '<li><b>They are still dangerous.</b> Sturdy heroes never reach the limit, so a warrior takes the same as before. The big warned moves are unchanged: the desperation strike that leaves you on 1 health, Virgo&rsquo;s Judgment and her rare pillar of judgment, Taurus&rsquo;s goring charge, Scorpio&rsquo;s Stinger, Capricorn&rsquo;s Hoofquake (jump to dodge it) and Regulus&rsquo;s Sun Pounce. So are the bosses&rsquo; body hits and their signature swings.</li>',
  '</ul>',
  '<p><b>Measured</b> in each boss&rsquo;s arena against a level 70 mage wearing the best shop gear for her level (the squishiest hero we test). Her worst single hit, and in brackets the worst two hits landing together, as a share of her maximum health, before &rarr; now:</p>',
  '<table><tr><th>Boss</th><th>Normal</th><th>Nightmare</th></tr>',
  '<tr><td>Ariel (Aries)</td><td>104% (182%) &rarr; 45% (45%)</td><td>207% (364%) &rarr; 85% (85%)</td></tr>',
  '<tr><td>Taur, Gem &amp; Mini, Cancer, Virga, Libra, Caprikor</td><td>104% &rarr; 45%</td><td>207% &rarr; 85%</td></tr>',
  '<tr><td>Regulus (Leo)</td><td>45% (60%) &rarr; 45% (45%)</td><td>65% (80%) &rarr; 85% (85%)</td></tr>',
  '<tr><td>Scorpio</td><td>145% (217%) &rarr; 45% (45%)</td><td>290% (435%) &rarr; 85% (85%)</td></tr>',
  '<tr><td>Sagitta (Sagittarius)</td><td>104% (113%) &rarr; 45% (45%)</td><td>207% (225%) &rarr; 85% (85%)</td></tr>',
  '<tr><td>Aqua (Aquarius)</td><td>104% (139%) &rarr; 45% (45%)</td><td>207% (242%) &rarr; 85% (85%)</td></tr>',
  '<tr><td>Pisces</td><td>104% (117%) &rarr; 45% (45%)</td><td>207% (233%) &rarr; 85% (85%)</td></tr>',
  '</table>',
  '<p><b>Verified.</b> A browser test goes to each of the twelve arenas and sets off each boss&rsquo;s real attacks against a level 70 mage on every difficulty, a level 99 archer and a level 90 warrior, always with the highest possible damage roll, and adds a shot the moment the hero can be hit again. It checks that no hit and no pair of hits passes the limit, that the highest roll lands exactly on the limit for every boss, that the warrior&rsquo;s hits are unchanged, that Capricorn&rsquo;s Hoofquake is unchanged, and that a co-op partner who receives the host&rsquo;s real Ambush and lightning pool stays under the limit too. On the build before, 15 of its 18 checks failed; now all 18 pass. Regulus&rsquo;s own test now checks his new Nightmare limit and passes.</p>',
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
