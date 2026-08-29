// CHANGELOG.html entry for v0.30.283. Newest on top, under </header>.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
if (s.includes('>v0.30.283 <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const PRE = 'background:#0d0b14;border:1px solid #2a2438;border-radius:6px;padding:10px;overflow-x:auto';
const ENTRY = J(
  '</header>',
  '',
  '<h2>v0.30.283 <span class="tag"><span class="pill balance">balance</span> Necromancer &amp; Hexmaster tamed: G, B and the summons</span></h2>',
  '<p>Per user: <em>&ldquo;necromancer and hexmaster G and B skills deal way too much damage, summons also seem to deal alot of damage please nerf them&rdquo;.</em> Every offender turned out to be a named knob &mdash; several of them raised in earlier buff passes and compounding through the hex-spread cascade (ruptures chain on kills, so each point of rupture multiplier multiplied again through the pack).</p>',
  `<pre style="${PRE}"><code>summon atk multiplier        1.0  → 0.55   each undead hit at FULL player ATK,`,
  '                                            and Dark Pulse raises three; 0.55 sits',
  '                                            at the engine&rsquo;s own pet bar (mojimon: 50%)',
  'Grand Hex burst              1.5  → 1.0    (was buffed from 1.2)',
  'Grand Hex rupture            5.5  → 3.5    (was buffed from 4.0; chains on kills)',
  'Grand Hex rupture splash     0.55 → 0.40',
  'Soul Vortex tick             2.20 → 1.40   over its full 30s pool',
  'Necrotic Ascendance drain    3.0  → 2.0',
  'Pandemic Hex chain           0.50 → 0.35 (hi) · 0.35 → 0.25 (lo)</code></pre>',
  '<p>The kit is untouched &mdash; freeze, weaken, lifesteal windows, stack counts, cooldowns, and the echo/splash mechanics all stay; they simply ride the tamed parents. <code>scripts/warlock_nerf_test.mjs</code> &mdash; 5 checks across runtime constants, a genuinely raised skeleton&rsquo;s ATK ratio, and the inline cast multipliers; 4 fail on v0.30.282.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1200 || grew > 5000) { console.error(`ABORT: moved ${n0} -> ${s.length} (+${grew})`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: CHANGELOG v0.30.283 (+${grew} chars)`);
