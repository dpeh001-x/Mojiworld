// CHANGELOG.html entry for v0.30.280. Newest on top, under </header>.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
if (s.includes('>v0.30.280 <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const PRE = 'background:#0d0b14;border:1px solid #2a2438;border-radius:6px;padding:10px;overflow-x:auto';
const ENTRY = J(
  '</header>',
  '',
  '<h2>v0.30.280 <span class="tag"><span class="pill balance">balance</span> Boss stat floors: every boss now out-stats its hunting ground</span></h2>',
  '<p>Per user: <em>&ldquo;ensure and make bosses stats considerably higher atk and significantly higher HP and DEF compared to normal surrounding monsters&rdquo;.</em> Audited table-vs-table in <code>data/monster_stats.js</code> (the declared single source of truth, applied verbatim at spawn by <code>_lxApplyStatTable</code> &mdash; verified live: spawned bosses track their rows within the &plusmn;5&ndash;8% per-spawn spread). A boss&rsquo;s &ldquo;surroundings&rdquo; = the strongest <em>normal</em> mob within its hunting band (lv&nbsp;&minus;8&hellip;+2).</p>',
  '<p><b>Floors enforced</b> (applied with margin at 8.2&times;/2.1&times;/2.1&times;): <b>HP &ge; 8&times;, ATK &ge; 2&times;, DEF &ge; 2&times;</b> the band max. This is the same defect v0.25.948 fixed once before (&ldquo;zodiac bosses much weaker than the monsters in the gate&rdquo;) &mdash; mob power crept past them again. The worst offenders:</p>',
  `<pre style="${PRE}"><code>pqConductor   HP  1.38× its band&rsquo;s mummy      →  8.2×   (12,461 → 73,900)`,
  'zodiac_virgo  HP  1.84× pathsBane              →  8.2×   (4.34M → 19.39M)',
  'octobaby      ATK 1.91× thornmaw               →  2.1×   (5,294 → 5,820)',
  'legosaurus    DEF 1.99× elderbark              →  2.1×   (702 → 745)',
  'leo…sagittarius DEF 1.75× ossuaryTyrant        →  2.1×   (1,200 → 1,441)',
  '',
  '17 rows raised in all: pqConductor, barnaby, sundered_smith, octobaby,',
  'kingKrook, legosaurus, and all twelve zodiacs. king, mooma, aetherion and',
  'gravitos (HP/ATK) already complied and are untouched.</code></pre>',
  '<p><b>Pacing preserved:</b> every raised HP re-derives exp/coin by the stat file&rsquo;s own boss rule (<code>exp&nbsp;=&nbsp;hp&times;0.055</code>, <code>coin&nbsp;=&nbsp;hp&times;0.017</code>) &mdash; fights lengthen, rewards lengthen with them. <b>Hierarchies preserved:</b> Gravitos stays the apex (21.0M&nbsp;HP &gt; zodiac peak 19.39M; DEF 1200&nbsp;&rarr;&nbsp;1540 to out-armour the zodiacs&rsquo; new 1441), and Krook&nbsp;=&nbsp;Octobaby on HP keeps the Lv-50 bulk band exact.</p>',
  '<p><b>Exempt by design:</b> mirrorSelf (mirrors the player &mdash; a trial, not a monster) and the tower pair (rescaled to player&nbsp;level&nbsp;+10 at spawn, v0.29.316 &mdash; their rows are seeds).</p>',
  '<p><code>scripts/boss_floor_test.mjs</code> &mdash; 7 checks: the floors for all 22 enforced bosses (fails on the old table with 17 violations), the apex and bulk-band hierarchies, the exp rule, and live spawns tracking the table. Note: the older inline <code>monsterTypes</code> numbers are dead for these stats and remain untouched; the older octobaby/krook tests read those inline values and stay green.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 2000 || grew > 7000) { console.error(`ABORT: moved ${n0} -> ${s.length} (+${grew})`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: CHANGELOG v0.30.280 (+${grew} chars)`);
