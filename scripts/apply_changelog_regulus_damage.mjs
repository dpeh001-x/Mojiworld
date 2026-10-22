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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Regulus&rsquo;s comets and roar no longer kill you in one hit</span></h2>',
  '<p>Per user: <i>Regulus projectile sometimes does insane damage that one hit kills the players, please do a check on it and ensure the damage is fair</i>.</p>',
  '<p><b>What was wrong.</b> Regulus has two kinds of ranged attack. His roar shots hit like every other zodiac boss&rsquo;s shots. His falling comets (the Sun Comet, and the three meteors of his Solar Flare) were worked out from his raw attack power instead, and that number got <i>bigger</i> the further your level was above his arena&rsquo;s. A level 70 mage at full health lost more than twice her health bar to one comet on Normal, and even on Story a comet took more than her whole bar. His roar could also kill outright on a high roll: its shockwave takes 15% of your health and the shot behind it could take the rest. Co-op partners were hit the same way.</p>',
  '<ul>',
  '<li><b>His comets now hit like his shots</b>: the same damage range as every zodiac shot, lowered by your defence, raised by the difficulty, and cut by blocking, a warrior&rsquo;s toughness and Aegis as before.</li>',
  '<li><b>No single hit of his ranged attacks can take more than a set share of your health</b>: 30% on Story, 45% on Normal, 55% on Hard, 65% on Nightmare. A whole roar (shockwave and shot) is at most 60% on Normal and 80% on Nightmare, so none of his attacks can take you from full health to zero.</li>',
  '<li><b>The Solar Flare counts as one hit.</b> After a meteor hits you, you get the same short protection a shot gives, so its three meteors can no longer all land on you.</li>',
  '<li><b>Co-op partners</b> take exactly the same, worked out from their own defence.</li>',
  '<li><b>He is still dangerous.</b> His Sun Pounce (the circle on the floor) is unchanged, and sturdy heroes never reach the limit: a warrior&rsquo;s hits from his roar shots are unchanged, and his comets now hit a warrior about as hard as his shots do.</li>',
  '</ul>',
  '<p><b>Measured</b> in his arena against heroes at the level shown, wearing the best shop gear for that level. The biggest single hit from his comets, meteors and roar shots, as a share of the hero&rsquo;s maximum health, before &rarr; now:</p>',
  '<table><tr><th>Hero</th><th>Story</th><th>Normal</th><th>Hard</th><th>Nightmare</th></tr>',
  '<tr><td>Level 70 mage</td><td>111% &rarr; 30%</td><td>222% &rarr; 45%</td><td>334% &rarr; 55%</td><td>445% &rarr; 65%</td></tr>',
  '<tr><td>Level 80 mage</td><td>88% &rarr; 24%</td><td>176% &rarr; 45%</td><td>264% &rarr; 55%</td><td>352% &rarr; 65%</td></tr>',
  '<tr><td>Level 90 mage</td><td>62% &rarr; 21%</td><td>125% &rarr; 37%</td><td>187% &rarr; 55%</td><td>250% &rarr; 65%</td></tr>',
  '<tr><td>Level 99 mage</td><td>76% &rarr; 19%</td><td>151% &rarr; 30%</td><td>227% &rarr; 55%</td><td>303% &rarr; 65%</td></tr>',
  '<tr><td>Level 80 archer</td><td>&ndash;</td><td>105% &rarr; 44%</td><td>&ndash;</td><td>210% &rarr; 65%</td></tr>',
  '<tr><td>Level 80 warrior</td><td>&ndash;</td><td>29% &rarr; 18%</td><td>&ndash;</td><td>58% &rarr; 32%</td></tr>',
  '<tr><td>Level 90 warrior</td><td>&ndash;</td><td>21% &rarr; 15%</td><td>&ndash;</td><td>41% &rarr; 18%</td></tr>',
  '</table>',
  '<p><b>Verified.</b> A browser test fights the real Regulus in his arena with a level 70 mage on Normal, a level 80 mage on Nightmare and a level 90 warrior on Normal, and records every hit. It checks the comet, the Solar Flare and the roar against the limits above, that the comet still takes at least 30% from the mage, that the warrior&rsquo;s hits are unchanged, that the Sun Pounce is unchanged, that god mode takes nothing, and that a co-op partner who receives the host&rsquo;s real comet and roar shot takes no more than the limit. On the build before, 9 of its 14 checks failed; now all 14 pass.</p>',
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
