// Ariel, Capricorn and Pisces's signature swing hits a squishy hero for up to 47% of max HP on every tier (zodiac melee cap, 2026-10-22).
// ============================================================================
// v0.30.1853 (zodiac-damage-cap) capped every zodiac shot, hazard and untelegraphed direct hit at Story 30% / Normal 45% /
// Hard 65% / Nightmare 85% of max HP, with a shared 1.2 s stack window. The signature heavy swing of the three swinging signs
// (Aries, Capricorn, Pisces: traits.bigMelee kind 'swing', ATK x1.3) was left out: it resolves as an enemy projectile through
// the generic boss heavy band, which clamps to 92% of the level bar (a raw number at the boss's level), not to the hero's pool.
// Measured with the real swing, geared Lv 70 heroes: 36-47% of max HP, the same on every difficulty.
// Per user ("cap them to 45%"): the swing now takes at most 45% of the hero's max HP, flat on EVERY tier - a lighter swing is
// unchanged (it is not trimmed to Story's 30%). It counts toward the 1.2 s window (_lxZodHitNote), so a shot landing on top of
// a swing shares the tier's cap; the swing itself is never trimmed by the window (that would cut it below 45% on Story, and below
// the swing's own value after a shot), so a shot followed by a swing can still reach shot + 45% - in play the 1.2 s i-frames a
// hit grants already keep the two apart. A co-op guest's copy of the swing carries the flag and runs the same cap on its own bar.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxZodSwingCap(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const TAG = 'v0.30.1869 zodiac-melee-cap';
const afterLine = (a, add, what) => {   // a new line after the line that holds the anchor (its tail comment kept)
  const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n);
  const i = s.indexOf(a), e = s.indexOf(EOL, i);
  s = s.slice(0, e) + EOL + add + s.slice(e);
};

// 1) the cap and its helper, next to v0.30.1853's shared zodiac table and window (the helper needs _lxZodHitNote)
afterLine('function _lxZodCapLabel(sl) {', J(
  '// ' + TAG + ' - THE SIGNATURE SWING IS CAPPED TOO (per user: "cap them to 45%"). Aries, Capricorn and Pisces\'s heavy swing lands',
  '// through the boss heavy band (a share of the level bar, not of the hero\'s pool): 36-47% of a geared Lv 70 hero\'s max HP on every',
  '// tier. It now takes at most 45% of max HP, flat on every tier (a lighter swing is unchanged, never trimmed to Story\'s 30%), and it',
  '// counts toward the 1.2 s window, so a shot on top shares the tier\'s cap. The window never trims the swing itself.',
  'const LX_ZODIAC_SWING_CAP = 0.45;',
  'function _lxZodSwingCap(v) {   // ' + TAG + ' - one signature swing: at most 45% of max HP; it counts toward the window',
  '  if (!(v > 0) || typeof player === \'undefined\' || !player) return v;',
  '  const mh = Math.max(1, (typeof getMaxHp === \'function\') ? getMaxHp() : (player.maxHp || 100));',
  '  v = Math.min(v, Math.max(1, Math.floor(mh * LX_ZODIAC_SWING_CAP))); _lxZodHitNote(v); return v;',
  '}'), 'zodiac cap label helper');
// 2) the swing carries the sign (only a zodiac boss's swing: every other swinger keeps its band)
afterLine("              _swingType: m.type,   // v0.29.812",
  "              _lxZodSwing: m.zodiacSign || (m.zodiacBoss ? 'zodiac' : null),   // " + TAG + ' - a zodiac signature swing: capped at 45% of max HP where it lands', 'swing projectile');
// 3) the resolver: after the boss band (and after the zodiac shot cap, which a swing never runs), before the HP write
afterLine('        if (p._zodiacSign && _projLost > 0 && !player._god) _projLost = _lxZodHitCap(_projLost);',
  '        if (p._lxZodSwing && _projLost > 0 && !player._god) _projLost = _lxZodSwingCap(_projLost);   // ' + TAG + ' - at most 45% of max HP on every tier; counts toward the window', 'projectile resolver');
// 4) co-op: a guest's copy of the swing keeps the flag, so its own resolver runs the same cap on the guest's bar
afterLine("_COOP_HZ_XF.push('_vfx');",
  "_COOP_PJ_XF.push('_lxZodSwing');   // " + TAG + " - a guest's copy of a zodiac swing runs the same 45% cap on its own bar", 'coop projectile fields');

const grew = s.length - n0;
if (grew < 1200 || grew > 2000) die('size moved ' + grew);
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
console.log('applied: zodiac-melee-cap (+' + grew + ' chars)');
