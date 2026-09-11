// Codex cohorts: the Magma Foundry's Greater and Apex studies open together.
// =============================================================================
// Per user: "for smith golem apex quest pls try to align it together with the
// other monsters in the magma foundry at the same time".
//
// WHY THEY WERE APART. _generateBestiaryQuests placed every tier per creature:
// the first study at natural level - 2, the Greater Study at + 3, the Apex
// Study at + 6. The Foundry's four residents sit at natural 60 / 62 / 65 / 66,
// so their Apex Studies opened at 66, 68, 71 and 72 - the Smith Golem's three
// and five levels after the first two, though all four live on the same map
// and are farmed in the same runs.
//
// WHY THE GREATER TIER MOVES TOO. One shared Apex level on its own cannot keep
// the codex's order: anything under 70 opens the Bellowsbat's Apex before its
// own Greater Study (69), and anything at 70+ delays the other three instead
// of bringing the Smith Golem forward. So a listed map is a COHORT: its
// residents' Greater Studies open at one level - the roster's average natural
// level + 3, raised if needed so it still follows every resident's first study
// - and their Apex Studies together three levels later, the same spacing the
// per-creature rule used. For the Foundry: Greater 66, Apex 69 (Smith Golem's
// Apex 71 -> 69). The first study stays per creature (it is the introduction).
//
// ONLY THE UNLOCK LEVEL MOVES. A study's hunt size and pay are still worked out
// from the creature's own level (_gLv / aLv). This is load-bearing: the codex
// clamps a study's coins at level x 800 and that clamp BINDS for these studies,
// so a first draft that let the shared level drive pay re-priced all eight -
// and _lxTrimQuestPay's single median calibration then carried that into the
// coins of 248 unrelated quests (up to ~1.3%). Measured with a whole-table diff
// against the previous build; with pay left per creature the diff is exactly
// the eight levelReq values.
//
// Residents are read from the map's spawn table, so a mob added to the Foundry
// joins without an edit. Every other map keeps the per-creature rule. Players
// who already unlocked a study keep it: tickQuestUnlocks never re-locks an
// unlocked non-boss quest.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('LX_CODEX_COHORT_MAPS')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. the cohort table + level resolver, just above the generator ---------
sub('cohort helper', 'function _generateBestiaryQuests() {',
  J('// v0.30.607 codex-cohort - per user: "for smith golem apex quest pls try to align it together',
    '// with the other monsters in the magma foundry at the same time". Codex tiers were placed per',
    '// creature (Greater at natural + 3, Apex at + 6), so a map whose residents span several levels',
    '// opened its studies one at a time: the Foundry\'s four Apex Studies at 66, 68, 71 and 72. A map',
    '// listed here is a COHORT: its residents\' Greater Studies OPEN at one level - the roster\'s',
    '// average natural level + 3, raised if needed so it still follows every resident\'s first study',
    '// (natural - 2) - and their Apex Studies together three levels later. A single shared Apex level',
    '// alone could not keep the order (under 70 it opens the Bellowsbat\'s Apex before its Greater).',
    '// Only the unlock level moves: hunt size and pay stay on the creature\'s own level, because the',
    '// codex coin clamp (level x 800) binds for these studies and _lxTrimQuestPay\'s median calibration',
    '// would carry any re-pricing into every other quest. Residents come from the map\'s spawn table.',
    "const LX_CODEX_COHORT_MAPS = ['magmaFoundry'];",
    'function _lxCodexCohortLevels(monId) {',
    '  const memo = _lxCodexCohortLevels._m || (_lxCodexCohortLevels._m = Object.create(null));',
    '  if (monId in memo) return memo[monId];',
    '  let res = null;',
    '  try {',
    '    for (const mapId of LX_CODEX_COHORT_MAPS) {',
    "      const sp = (typeof MAPS !== 'undefined' && MAPS[mapId] && MAPS[mapId].spawns) || [];",
    '      const ids = [...new Set(sp.map((e) => e && e.type).filter(Boolean))];',
    '      if (!ids.includes(monId)) continue;',
    "      const lv = ids.map((t) => (typeof MOB_NATURAL_LEVEL !== 'undefined' && MOB_NATURAL_LEVEL[t]) || 0).filter((n) => n > 0);",
    '      if (!lv.length) break;',
    '      const mean = Math.round(lv.reduce((a, b) => a + b, 0) / lv.length);',
    '      const greater = Math.max(mean + 3, Math.max(...lv) - 2 + 1);',
    '      res = { greater, apex: greater + 3, map: mapId };',
    '      break;',
    '    }',
    '  } catch (e) { res = null; }',
    '  return (memo[monId] = res);',
    '}',
    'function _generateBestiaryQuests() {'));

// ---- 2. Greater: opens at the cohort level; count + pay stay on _gLv ---------
sub('greater lv', '      const _gLv = Math.max(_lvlReq + 5, lvl + 3);',
  J('      const _gLv = Math.max(_lvlReq + 5, lvl + 3);',
    '      const _coh = _lxCodexCohortLevels(monId);   // v0.30.607 codex-cohort - a cohort\'s Greater Studies open together (count + pay stay on _gLv)'));
sub('greater levelReq', '        levelReq: Math.max(_lvlReq + 5, lvl + 3),',
  '        levelReq: _coh ? _coh.greater : _gLv,   // v0.30.607 codex-cohort - was the _gLv formula written a second time');

// ---- 3. Apex: opens at the cohort level; count + pay stay on aLv -------------
sub('apex lv', '      const aLv = lvl + 6;',
  J('      const aLv = lvl + 6;',
    '      const _cohA = _lxCodexCohortLevels(monId);   // v0.30.607 codex-cohort - and their Apex Studies three levels later (count + pay stay on aLv)'));
sub('apex levelReq', '        levelReq: aLv,',
  '        levelReq: _cohA ? _cohA.apex : aLv,   // v0.30.607 codex-cohort');

const grew = s.length - n0;
if (grew < 1500 || grew > 5000) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: codex cohort - Magma Foundry Greater/Apex studies open together, pay per creature (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
