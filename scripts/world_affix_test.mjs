// Certify v0.29.288 rotating world affixes: determinism, per-map/per-day
// independence, weight distribution, and that excluded maps stay clean.
import { readFileSync } from 'node:fs';
const src = readFileSync('mojiworld_game.html', 'utf8');
const grab = (name) => {
  const i = src.search(new RegExp('(?:^|\\n)(?:const |function )' + name + '\\b'));
  if (i < 0) throw new Error('not found: ' + name);
  let j = src.indexOf('{', i), d = 0, k = j;
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) break; } }
  return src.slice(i, name === 'WORLD_AFFIXES' || name === '_WORLD_AFFIX_WEIGHTS' ? src.indexOf(';', k) + 1 : k + 1);
};
// Stub the MAPS table + _monoNow the affix picker reads.
const harness = `
const MAPS = {
  town:    { isTown: true },
  arena:   { isBossArena: true },
  void:    { isVoid: true },
  forest:  {}, magmaFoundry: {}, cryptHollow: {}, jadeGrove: {}, duneSands: {},
  tower_b3:{}, clockworkA: {},
};
function _monoNow() { return 0; }
`;
const code = harness + [grab('WORLD_AFFIXES'), grab('_WORLD_AFFIX_WEIGHTS'),
  grab('_worldAffixDay'), grab('_worldAffixFor'), grab('_lxMulberry32'), grab('_lxSeedFromString')].join('\n');
const F = new Function(code + '; return {_worldAffixFor, WORLD_AFFIXES};')();

const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// 1) deterministic for a given (map, day)
const a1 = F._worldAffixFor('forest', 100), a2 = F._worldAffixFor('forest', 100);
ok('same (map, day) -> same affix', a1.id === a2.id, a1.id);

// 2) varies across days for one map
const days = new Set();
for (let d = 0; d < 200; d++) days.add(F._worldAffixFor('forest', d).id);
ok('one map rotates across days', days.size >= 4, [...days]);

// 3) varies across maps on one day
const perMap = ['forest', 'magmaFoundry', 'cryptHollow', 'jadeGrove', 'duneSands']
  .map(m => F._worldAffixFor(m, 7).id);
ok('maps differ on the same day', new Set(perMap).size >= 2, perMap);

// 4) excluded maps never get an affix
const excluded = ['town', 'arena', 'void', 'tower_b3', 'clockworkA', 'nonexistentMap'];
let leak = null;
for (const m of excluded) for (let d = 0; d < 400; d++) {
  if (F._worldAffixFor(m, d).id !== 'none') { leak = { m, d }; break; }
}
ok('towns / arenas / void / tower / clockwork stay unaffixed', leak === null, leak);

// 5) distribution roughly matches the weights over many (map, day) draws
const counts = {};
const maps = ['forest', 'magmaFoundry', 'cryptHollow', 'jadeGrove', 'duneSands'];
let total = 0;
for (const m of maps) for (let d = 0; d < 4000; d++) {
  const id = F._worldAffixFor(m, d).id;
  counts[id] = (counts[id] || 0) + 1; total++;
}
const pct = (id) => (counts[id] || 0) / total * 100;
ok('"none" stays dominant (45-60%)', pct('none') > 45 && pct('none') < 60, +pct('none').toFixed(1));
ok('every affix appears', F.WORLD_AFFIXES.every(a => (counts[a.id] || 0) > 0),
   Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, +(v / total * 100).toFixed(1) + '%'])));
// weights: none 52 / gilded 12 / teeming 10 / lucid 10 / hoarded 6 / restless 10  (of 100)
const expect = { none: 52, gilded: 12, teeming: 10, lucid: 10, hoarded: 6, restless: 10 };
const worst = Math.max(...Object.entries(expect).map(([k, w]) => Math.abs(pct(k) - w)));
ok('observed within 4pp of declared weights', worst < 4, { worstDeviationPP: +worst.toFixed(2) });

// 6) a rare affix is genuinely rare
ok('hoard-touched is the rarest (<8%)', pct('hoarded') < 8, +pct('hoarded').toFixed(1));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x !== undefined ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
