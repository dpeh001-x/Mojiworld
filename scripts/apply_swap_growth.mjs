// The pre-advancement class swap keeps what your levels earned (bug hunt, 2026-09-26).
// ============================================================================
// The Amnesiac's "try a different path" swap keeps your level (its dialog says so), but applyClass() resets max
// HP / MP / ATK / DEF to the new class's LEVEL-1 base, and the per-level growth only ever lands inside _maybeLevelUp.
// So a Lv-19 Warrior who became a Rogue was a Lv-19 Rogue with Lv-1 stats - HP 100, MP 50, ATK 15, DEF 3 against a
// native Lv-19 Rogue's 496 / 266 / 51 / 21 - for good (the load-time repair only lifts to the class base).
// Fix:
//   1) the swap re-grants (level - 1) levels of the NEW class's growth, through _devLevelGains - the table the dev
//      level tool already uses, identical to _maybeLevelUp's numbers - then refills HP/MP.
//   2) a save already hurt by it heals on load: a character with no job and no master is exactly class base + its
//      levels' growth + whatever it invested on top, never less, so anything below that floor is lifted to it.
//      Jobs and masters are left alone (a few carry negative stats, so the floor would not hold for them).
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) swap-growth/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
if (!s.includes('function _devLevelGains(cls) {')) die('no _devLevelGains');

// 1) the swap re-grants the levels' growth
const SW = J('        applyClass(next);', "        if (typeof showToast === 'function') showToast(`\u27F3 You are now");
once(SW, J(
  '        applyClass(next);',
  '        // v0.30.1133 swap-growth - applyClass hands the new class its LEVEL-1 HP/MP/ATK/DEF, but the level stays: give back',
  "        // (level - 1) levels of the NEW class's growth (a Lv-19 swap was a Lv-19 Rogue on Lv-1 stats), then refill",
  "        try { const _g = _devLevelGains(player.cls), _n = Math.max(0, (player.level | 0) - 1);",
  '          player.maxHp += _g.hp * _n; player.maxMp += _g.mp * _n; player.baseAtk += _g.atk * _n; player.baseDef += _g.def * _n;',
  "          if (typeof invalidateEquipBonusCache === 'function') invalidateEquipBonusCache();",
  '          player.hp = getMaxHp(); player.mp = getMaxMp(); } catch (e) {}',
  "        if (typeof showToast === 'function') showToast(`\u27F3 You are now"), 'the swap applyClass(next)');

// 2) the load-time repair lifts a jobless save to its level's floor
const LIFT = "        _lift('baseAcc',   0,              'ACC');";
once(LIFT, J(LIFT,
  '        // v0.30.1133 swap-growth - a character with NO job and NO master is exactly class base + (level - 1) levels of',
  '        // growth + what it invested on top, never less; the pre-advancement class swap used to drop the growth (a Lv-19',
  '        // Rogue on Lv-1 stats). Lift such a save to its level\'s floor. Jobs / masters are left out: a few carry negative',
  '        // stats, so the floor would not hold for them.',
  "        if (!player.job && !player.master && (player.level | 0) > 1 && typeof _devLevelGains === 'function') {",
  '          const _g = _devLevelGains(player.cls), _n = (player.level | 0) - 1, _grown = [];',
  "          const _liftG = (k, min, label) => { if (typeof player[k] === 'number' && player[k] < min) { _grown.push(label); player[k] = min; } };",
  "          _liftG('maxHp', (_cs.hp || 1) + _g.hp * _n, 'Max HP');",
  "          _liftG('maxMp', (_cs.mp || 0) + _g.mp * _n, 'Max MP');",
  "          _liftG('baseAtk', (_cs.atk || 0) + _g.atk * _n, 'ATK');",
  "          _liftG('baseDef', (_cs.def || 0) + _g.def * _n, 'DEF');",
  "          if (_grown.length && typeof showToast === 'function') setTimeout(() => showToast('\\u{1F6E0} Restored the stats your levels earned \u2014 ' + _grown.join(', ') + ' (lost in a class swap).', 'epic'), 1800);",
  '        }'), 'the load-time _lift(baseAcc)');

const grew = s.length - n0;
if (grew < 1500 || grew > 3500) die('size moved ' + grew);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000000) die('tmp small');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code);
}
console.log('applied: swap-growth (+' + grew + ' chars)');
