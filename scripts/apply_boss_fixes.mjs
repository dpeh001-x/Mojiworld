// Boss fixes from the second bug hunt (2026-09-26).
// ============================================================================
// 1) LIBRA'S ADDS OUTLIVED HER. killMonster sweeps a dead boss's summons for Mooma, Octobaby, Aetherion's choir, the
//    Sovereign and the Conductor ("a boss's summons do not outlive it") - but not Libra: her two Scale Lanterns
//    (~970k HP) and two Scale Stormcallers stayed alive after her death and kept hitting the player. Swept now, like
//    the choir (skipping anything already queued in this frame's _pendingKills).
// 2) THE INTRO CARD PLAYED FOR A BOSS THAT WAS NOT THERE. Re-entering an arena inside its 10-minute respawn window
//    paused the game on "KING GLOOPALOO / first kill" with no boss and the Echo Keeper standing there (every generic
//    arena and all twelve zodiacs). The spawn loop skips a defeated boss; the intro timer now asks the same question.
// 3) THE BOON WHEEL WAS LOST IF YOU LEFT WITHIN 1.5 s. The kill stamps the arena defeated at once, then opens the
//    wheel after 1.5 s - and that timer simply gave up if the map had changed (or you died in that window), so the
//    boon was gone for good (re-entry finds only the Echo Keeper, who pays none). A kill that earned a boon now keeps
//    it: the wheel opens as soon as you are up, unpaused and out of an expedition.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) boss-fixes/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
if (!s.includes('function showPowerupChoice(bossInfo) {')) die('no showPowerupChoice');

// 1) Libra's adds go with her (inserted above the Aetherion sweep's header, which other sessions extend)
const AEH = `  // v0.30.933 "a boss's summons do not outlive it" holds for Mooma's adds, Octobaby's legs, the Sovereign's shards and`;
once(AEH, J(
  "  // v0.30.1151 boss-fixes - Libra's summons too: her Scale Lanterns and Scale Stormcallers (_libraOrb) stayed up and kept hitting after her death",
  "  if (m.zodiacSign === 'libra' || m.type === 'zodiac_libra') {",
  '    for (let _li = game.monsters.length - 1; _li >= 0; _li--) {',
  '      const _lm = game.monsters[_li];',
  '      if (_lm && _lm !== m && _lm._libraOrb && !(game._pendingKills && game._pendingKills.includes(_lm))) { _lm.currentHp = 0; game.monsters.splice(_li, 1); }',
  '    }',
  '  }',
  AEH), 'the boss-summons sweep header');
// 2) no intro card for a boss the arena will not spawn
once('setTimeout(() => { if (game.currentMap === _biMap && game._bossIntroGen === _biGen && !game._gravitosCinePlaying) _playBossIntro(_bossSpawn.type); }, _introDelay);',
  'setTimeout(() => { if (game.currentMap === _biMap && game._bossIntroGen === _biGen && !game._gravitosCinePlaying && !(game.bossDefeated && game.bossDefeated[_biMap])) _playBossIntro(_bossSpawn.type); }, _introDelay);   /* v0.30.1151 boss-fixes - not for a boss still on its respawn window (the spawn loop skips it) */',
  'the loadMap boss-intro timer');

// 3) the boon a kill earned is kept when you leave or fall inside the 1.5 s reveal
once('function killMonster(m) {', J(
  '// v0.30.1151 boss-fixes - a boss kill that earned the boon wheel keeps it when you step out (or fall) inside the 1.5 s',
  '// reveal: the wheel opens as soon as you are up, unpaused and out of an expedition (retries for ~40 s, then lets go).',
  'function _lxDeliverPendingBoon(tries) {',
  '  const info = game._pendingBossBoon; if (!info) return;',
  "  const ok = player && player.hp > 0 && !(game.dying > 0) && !game.paused && !(game.expedition && game.expedition.active) && typeof showPowerupChoice === 'function';",
  '  if (ok) { game._pendingBossBoon = null; try { showPowerupChoice(info); } catch (e) {} return; }',
  '  if ((tries | 0) < 40) setTimeout(() => _lxDeliverPendingBoon((tries | 0) + 1), 1000); else game._pendingBossBoon = null;',
  '}',
  'function killMonster(m) {'), 'function killMonster');
once(J('    setTimeout(() => {', '      if (game.dying > 0 || (player && player.hp <= 0)) return;'), J(
  '    setTimeout(() => {',
  '      // v0.30.1151 boss-fixes - does this kill pay the wheel at all? (the same exclusions as below: a deferred twin, an echo /',
  '      // expedition boss, the Conductor) - if so, leaving or falling in this 1.5 s window queues it instead of losing it',
  "      const _lxBoonDue = () => { const _d = m._lxDeferredTakedown; return !(_lxDefer || (_d && (_d.echo || _d.exp)) || m._expeditionBoss || m._echoBoss || ((m._isTwin || m._isPiscesTwin) && !_d) || m.type === 'pqConductor'); };",
  "      if (game.dying > 0 || (player && player.hp <= 0)) { if (_lxBoonDue()) { game._pendingBossBoon = _bossInfo; setTimeout(() => _lxDeliverPendingBoon(0), 1200); } return; }"), 'the boon reveal death bail');
once('      if (_bossMapKey && game.currentMap !== _bossMapKey) return;',
  "      if (_bossMapKey && game.currentMap !== _bossMapKey) { if (_lxBoonDue()) { game._pendingBossBoon = _bossInfo; setTimeout(() => _lxDeliverPendingBoon(0), 1200); } return; }   // v0.30.1151 boss-fixes - queued, not lost",
  'the boon reveal map-change bail');

const grew = s.length - n0;
if (grew < 2000 || grew > 4500) die('size moved ' + grew);
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
console.log('applied: boss-fixes (+' + grew + ' chars)');
