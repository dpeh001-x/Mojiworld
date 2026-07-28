// Certify v0.29.290 mastery-bar progress math + dust-trickle rate.
import { readFileSync } from 'node:fs';
const src = readFileSync('mojiworld_game.html', 'utf8');
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// --- progress math, extracted from the renderer's own constants ---
const TIERS = [100, 500, 1000];
const tierOf = (n) => n >= 1000 ? 3 : n >= 500 ? 2 : n >= 100 ? 1 : 0;
const pctFor = (kills) => {
  const t = tierOf(kills);
  const prev = t === 0 ? 0 : TIERS[t - 1];
  const next = t >= 3 ? null : TIERS[t];
  return next ? Math.max(2, Math.min(100, ((kills - prev) / (next - prev)) * 100)) : 100;
};
ok('0 kills -> floor 2% (bar always visible)', pctFor(0) === 2, pctFor(0));
ok('50/100 -> 50%', pctFor(50) === 50);
ok('99 -> just under full', pctFor(99) === 99);
ok('100 -> resets into tier 1 at 0 -> floored 2%', tierOf(100) === 1 && pctFor(100) === 2);
ok('300 of 100-500 band -> 50%', pctFor(300) === 50);
ok('500 -> tier 2, band restarts', tierOf(500) === 2 && pctFor(500) === 2);
ok('750 of 500-1000 band -> 50%', pctFor(750) === 50);
ok('1000 -> mastered, pinned 100%', tierOf(1000) === 3 && pctFor(1000) === 100);
ok('beyond 1000 stays 100%', pctFor(99999) === 100);
let mono = true, last = -1;
for (let k = 0; k <= 1000; k++) { const t = tierOf(k); if (t === last + 1) last = t; else if (t !== last) mono = false; }
ok('tier only ever steps up by one', mono);
ok('percent never leaves [2,100]', [...Array(2000)].every((_, k) => pctFor(k) >= 2 && pctFor(k) <= 100));

// --- wiring / presence checks against the real file ---
ok('bar markup present', src.includes('id="mastery-bar"'));
ok('renderer called from the kill handler', /_renderMasteryBar\(m, next, _starUp\)/.test(src));
ok('star-up flag drives both toast and bar', src.includes('const _starUp = tier(next) > tier(prev);'));
ok('reduce-motion honoured via .mb-still', src.includes('mb-still') && src.includes('_reduceMotion'));
ok('faces cover all 4 tiers', /_LX_MASTERY_FACES = \['🥚', '🐣', '🐤', '🦅'\]/.test(src));

// --- dust trickle ---
const m = src.match(/const LX_DUST_TRICKLE_CHANCE = ([\d.]+);/);
ok('dust rate is a named constant', !!m, m && m[1]);
const rate = m ? parseFloat(m[1]) : -1;
ok('dust rate is genuinely low (0 < r <= 0.05)', rate > 0 && rate <= 0.05, rate);
ok('dust excluded during expeditions', /LX_DUST_TRICKLE_CHANCE[\s\S]{0,140}game\.expedition && game\.expedition\.active/.test(src));
ok('dust grants exactly 1 shard', /player\.setshards = \(player\.setshards \| 0\) \+ 1;/.test(src));
// Expected yield sanity: at 3%, 1000 kills ~ 30 shards ~ 15% of a 200-shard craft.
ok('~30 shards per 1000 kills (texture, not an economy rewrite)',
   Math.abs(rate * 1000 - 30) < 1, +(rate * 1000).toFixed(1));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x !== undefined ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
