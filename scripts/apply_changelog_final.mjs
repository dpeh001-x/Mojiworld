import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
if (s.includes('>v0.30.297 <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const PRE = 'background:#0d0b14;border:1px solid #2a2438;border-radius:6px;padding:10px;overflow-x:auto';
const ENTRY = J(
  '</header>',
  '',
  '<h2>v0.30.297 <span class="tag"><span class="pill balance">balance</span> Four zodiac threats: Scorpio&rsquo;s touch, Capricorn&rsquo;s volley, Aquarius&rsquo;s seal, Pisces&rsquo;s bite</span></h2>',
  '<p>Per user, four requests in one pass:</p>',
  `<pre style="${PRE}"><code>scorpio     contact damage  >= 40% of the player's max HP`,
  "capricorn   projectiles     >= 32% of the player's max HP",
  'aquarius    projectiles     seal potions for 45s',
  'pisces      atk             x2  (35,139 -> 70,278)</code></pre>',
  '<p><b>Where these had to land, and why.</b> Contact and projectile damage both finish inside the engine&rsquo;s band clamp, whose floor and cap are fractions of a <em>level reference</em> (the squishiest class&rsquo;s HP at the boss&rsquo;s level) &mdash; not of the player&rsquo;s own pool. A rule written as &ldquo;% of the player&rsquo;s max HP&rdquo; therefore has to apply <em>after</em> that clamp, against <code>getMaxHp()</code>, which is exactly where all three floors sit. They run after block, warrior DR and aegis, so they raise the floor rather than bypassing mitigation, and every one is god-gated.</p>',
  '<p><b>Tagged, not special-cased.</b> Zodiac bosses fire from five different places (generic shot, column lanes, the phase nova, the phase shot, the homing shot), so each spawn now stamps the firing sign and a single rule block in the impact resolver reads it. A sixth spawn added later inherits the behaviour for free. The Aquarius seal counts in <code>game.time</code>, the same 60&nbsp;Hz clock the potion cooldown already uses, so it pauses with the game instead of draining behind a menu, and it is enforced at both potion chokepoints beside the existing map-level <code>noPotion</code> gate.</p>',
  '<p><code>scripts/zodiac_threats_test.mjs</code> &mdash; 8 checks, all driven through the real damage paths rather than by reading source, since each rule sits behind a clamp that could swallow it. Measured: capricorn <b>32%</b> vs an untouched sign&rsquo;s <b>0%</b>; scorpio <b>140%</b> vs libra&rsquo;s <b>7.1%</b>; the seal at exactly <b>2,700 frames</b> with a drink refused. The first run could not tell the floors apart at all &mdash; a default test character has ~292 max HP while the zodiac band already floors at a multiple of that, so every sign one-shot it; the suite now gives the test player a pool comparable to the level reference so the per-sign floor is the only variable.</p>',
  '<p><b>Worth flagging:</b> a 45-second potion seal is a long time in a Lv-90 fight, and Scorpio&rsquo;s touch at 40% max HP means three contacts kill from full. Both are exactly as requested; say the word and either number is a one-line tune.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1500 || grew > 6000) { console.error(`ABORT: moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: CHANGELOG v0.30.297 (+${grew} chars)`);
