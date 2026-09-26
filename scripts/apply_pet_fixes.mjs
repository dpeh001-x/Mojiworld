// MojiMon / expedition / boon fixes from the second bug hunt (2026-09-26).
// ============================================================================
// 1) AN EXPEDITION'S END REFUNDED WHAT THE RUN SPENT. The restore puts the pre-run wallet back and then re-charges
//    game.expedition._spentInRun (the potion auto-buy, fares) - but _endExpedition replaced game.expedition with a
//    blank object first, so on death, Abandon or a clear the re-charge read 0 and every in-run potion was free.
//    The counter now rides across the reset.
// 2) MIRAGES AND AWAY-SUMMON KILLS FED SPECIES MASTERY. The bestiary count (the 10,000-kill MojiMon hunt) sat outside
//    the _isIllusionKill gate every other kill credit honours: a Mirage Stalker paid 3 mastery kills per real one,
//    and a parked MojiMon farmed mastery while its player was away. Gated like the rest.
// 3) THE MINION CAP EVICTED THE MOJIMON. It trimmed the oldest minions, and the MojiMon is almost always first - so
//    a warlock's undead pushed it out, the defeat detector saw it gone ("Your MojiMon was defeated!") and the 5-minute
//    cooldown ran. The cap now trims the oldest OTHER minions.
// 4) H SUMMONED THE MOJIMON WHILE YOU WERE DEAD. A player-called summon (H, the panel's Summon) now waits until you
//    are up; the free re-field after a map change is untouched.
// 5) ASCEND NAMED AN HEIRLOOM YOU NEVER PICKED: `game._heirloomIdx | 0` turned "none chosen" into bag slot 0.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) pet-fixes/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// 1) the run's spend survives the reset, so the restore re-charges it
const RESET = J(
  '  const _lootGone = _lxExpLootTally(_snap);   // v0.30.884 \u2014 loot rule: counted before the restore takes it',
  '  game.expedition = { active: false, floor: 0, bravoReady: false, currentQuest: null };',
  '  _expeditionRestorePlayer(_snap);');
once(RESET, J(
  '  const _lootGone = _lxExpLootTally(_snap);   // v0.30.884 \u2014 loot rule: counted before the restore takes it',
  '  // v0.30.1150 pet-fixes - the restore just below re-charges game.expedition._spentInRun (potions, fares); resetting the object',
  '  // first zeroed it, so death / Abandon / a clear refunded the whole run. Carry it across.',
  '  const _lxSpentRun = (game.expedition && game.expedition._spentInRun) | 0;',
  '  game.expedition = { active: false, floor: 0, bravoReady: false, currentQuest: null, _spentInRun: _lxSpentRun };',
  '  _expeditionRestorePlayer(_snap);'), 'the _endExpedition reset');

// 2) mastery only from real kills
once(J('  // Bestiary tracking drives cosmetic unlocks', "  trackPickup('kill', { type: m.type });"),
  J('  // Bestiary tracking drives cosmetic unlocks', "  if (!_isIllusionKill) trackPickup('kill', { type: m.type });   // v0.30.1150 pet-fixes - mirages and away-summon kills don't feed species mastery either"),
  'the bestiary trackPickup');

// 3) the cap never takes the MojiMon
once(J('  if (game.minions && game.minions.length > MAX_MINIONS) {', '    game.minions.splice(0, game.minions.length - MAX_MINIONS);', '  }'),
  J('  if (game.minions && game.minions.length > MAX_MINIONS) {',
    '    // v0.30.1150 pet-fixes - trim the oldest OTHER minions: the MojiMon sits first, and evicting it read as its defeat',
    '    let _over = game.minions.length - MAX_MINIONS;',
    '    for (let i = 0; i < game.minions.length && _over > 0;) { if (game.minions[i] && game.minions[i].mojimon) { i++; continue; } game.minions.splice(i, 1); _over--; }',
    '  }'), 'the minion cap');

// 4) no player-called summon while dead
once(J('function _mojimonSummon(type, opts) {', '  opts = opts || {};'),
  J('function _mojimonSummon(type, opts) {', '  opts = opts || {};',
    "  if (!opts.free && (!player || !(player.hp > 0))) return false;   // v0.30.1150 pet-fixes - H / Summon while dead fielded a MojiMon (and started its cooldown) under the death screen"),
  '_mojimonSummon');

// 5) "no heirloom chosen" stays none
once('  const _heirIdx = (game._heirloomIdx | 0),', "  const _heirIdx = (Number.isInteger(game._heirloomIdx) ? game._heirloomIdx : -1),   /* v0.30.1150 pet-fixes - `| 0` made \"none chosen\" into bag slot 0 */", 'the ascend heirloom index');

const grew = s.length - n0;
if (grew < 900 || grew > 2400) die('size moved ' + grew);
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
console.log('applied: pet-fixes (+' + grew + ' chars)');
