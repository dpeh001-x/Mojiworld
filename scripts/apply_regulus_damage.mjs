// Regulus's ranged hits one-shot a full-HP player (regulus damage, 2026-10-22).
// ============================================================================
// Per user: "Regulus projectile sometimes does insane damage that one hit kills the players, please do a check on it and
// ensure the damage is fair".
// Measured in his arena (zod_leo) on a geared at-level hero (devSetLevel + the best shop piece per slot, as gear_allowance):
//   - his SUN COMET and the three SOLAR FLARE meteors are meteor_warn hazards sized from his raw ATK (14,230 at Lv 78; the
//     comet carries x1.4, a flare meteor x1.2) and resolved by the generic meteor path: DEF absorb, then _diffDmg with no
//     attacker level, which falls back to the arena's levelReq (70) and MULTIPLIES by 1.3 + 0.08 per level the hero is
//     above it (x2.1 at Lv 80, x3.6 at Lv 99) - no zodiac band, no cap. A Lv 70 mage (4,452 HP) took 9,901 (222%) from
//     one comet on Normal and 4,950 (111%) on Story; a Lv 80 mage 176% on Normal. Every other Regulus shot already lands
//     the flat zodiac roll (3,000-5,000 x the DEF ramp x difficulty); his meteors were the one ranged attack outside it.
//     In co-op the host forwards the raw ATK figure (hazhit d) and the guest runs the same chain, so a guest is one-shot too.
//   - his ROAR fires the 15%-of-max-HP cone (lrRoar, no i-frames) AND a cone of shots that land the zodiac roll, so a Lv 70
//     mage took 15% + up to 103% (118% in one sample) on Normal - "sometimes", on a high roll.
// Fix (Regulus only; every other zodiac and boss is unchanged):
//   1) his two meteors are tagged (_leoMeteor) and land the zodiac projectile roll (_lxRolledProjLoss: 3,000-5,000, the DEF
//      ramp, difficulty, expedition, block / warrior DR / Aegis / Holy Shield) instead of ATK x the level-gap ramp; the
//      landing's 35% residual is 35% of a roll. A struck hero gets the 1,200 ms window a shot gives (it was 400 ms), so the
//      Flare's three meteors 220 ms apart count as one hit, not three.
//   2) every Regulus ranged hit - his shots (roar cone, phase nova) and his meteors - is capped per hit at a share of the
//      hero's max HP: Story 30%, Normal 45%, Hard 55%, Nightmare 65% (LX_LEO_HIT_CAP). The roar's cone (15%) stays, so a
//      whole roar is at most 60% on Normal, 80% on Nightmare: no single Regulus attack one-shots a full-HP hero. Tanks never
//      reach the cap (a Lv 90 warrior lands ~10-15%), so the cap only trims the squishy classes and the hard difficulties.
//   3) co-op: the host's hazhit carries lm:1 and a guest lands the same roll and cap on its own DEF (and the same 1,200 ms);
//      a guest's copy of a Regulus shot already carries _zodiacSign, so the shot cap covers it there too.
// The Sun Pounce (45% of max HP, telegraphed 1.3 s), his contact and HEAVENSPLIT are untouched.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxLeoHitCap(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
const TAG = 'v0.30.1850 regulus-damage';

// 1) the cap table + the two helpers, beside the zodiac roll they extend
{
  const A = 'const LX_ZODIAC_PROJ_MIN = 3000, LX_ZODIAC_PROJ_MAX = 5000;';
  once(A, J(A,
    '// ' + TAG + ' - REGULUS NEVER ONE-SHOTS FROM RANGE (per user: "Regulus projectile sometimes does insane damage that one hit kills the',
    '// players ... ensure the damage is fair"). One hit of his - a shot (roar cone, phase nova) or a meteor (Sun Comet, Solar Flare) - takes',
    '// at most this share of the hero\'s max HP, after every multiplier. His meteors were sized from his raw ATK through the level-gap ramp',
    '// (a Lv 70 mage lost 222% to one comet); they now land the zodiac roll like his shots. A whole roar (15% cone + a shot) stays under the',
    '// bar on every tier; a tank never reaches the cap, so it only trims squishy builds and the hard tiers.',
    'const LX_LEO_HIT_CAP = { story: 0.30, normal: 0.45, hard: 0.55, nightmare: 0.65 };',
    'function _lxLeoHitCap(v) {   // ' + TAG,
    '  if (!(v > 0) || typeof player === \'undefined\' || !player) return v;',
    '  const mh = Math.max(1, (typeof getMaxHp === \'function\') ? getMaxHp() : (player.maxHp || 100));',
    '  const f = LX_LEO_HIT_CAP[(typeof _lxDiffTier === \'function\') ? _lxDiffTier() : \'normal\'] || LX_LEO_HIT_CAP.normal;',
    '  return Math.min(v, Math.max(1, Math.floor(mh * f)));',
    '}',
    'function _lxLeoMeteorLoss(mul) {   // ' + TAG + ' - a Regulus meteor: the zodiac roll (DEF ramp, difficulty, block / DR / Aegis), x mul, capped',
    '  return _lxLeoHitCap(Math.max(1, Math.floor(_lxRolledProjLoss(LX_ZODIAC_PROJ_MIN, LX_ZODIAC_PROJ_MAX) * ((mul > 0) ? mul : 1))));',
    '}'), 'zodiac roll constants');
}
// 2) his shots: capped after the zodiac roll (a guest's copy carries _zodiacSign, so it is capped there too)
{
  const A = J("          if (p._zodiacSign === 'scorpio') _projLost = _lxRolledProjLoss(2100, 3500);   // v0.30.1661 scorpio-dmg-cut - Scorpio's own roll, 30% under the other eleven's 3,000-5,000 (per user)",
    '        }');
  once(A, J(A,
    "        if (p._zodiacSign === 'leo' && _projLost > 0 && !player._god) _projLost = _lxLeoHitCap(_projLost);   // " + TAG + ' - one Regulus shot never takes more than LX_LEO_HIT_CAP of max HP'), 'zodiac roll block');
}
// 3) his two meteors carry the tag
once("type: 'meteor_warn', x: tx, y: 440, cx: tx, timer: 70, damage: m.atk * 1.4, color: '#ffaa33', owner: 'enemy', radius: 90,",
  "type: 'meteor_warn', x: tx, y: 440, cx: tx, timer: 70, damage: m.atk * 1.4, color: '#ffaa33', owner: 'enemy', radius: 90, _leoMeteor: true /* " + TAG + ' - lands the zodiac roll, capped (_lxLeoMeteorLoss) */,', 'Sun Comet spawn');
once("damage: m.atk * 1.2, color: '#ffaa33', owner: 'enemy', radius: 90,",
  "damage: m.atk * 1.2, color: '#ffaa33', owner: 'enemy', radius: 90, _leoMeteor: true /* " + TAG + ' */,', 'Solar Flare spawn');
// 4) the fall: a Regulus meteor lands the roll, and the hero gets a shot's i-frame window
{
  const A = J('        player.hp = Math.max(0, player.hp - _pLost);', '        player.invulnerable = 400;');
  once(A, J(
    '        if (h._leoMeteor && _pLost > 0 && !player._god) _pLost = _lxLeoMeteorLoss(1);   // ' + TAG + ' - the zodiac roll, capped (was ATK x1.2-1.4 through the level-gap ramp)',
    A,
    '        if (h._leoMeteor) player.invulnerable = 1200;   // ' + TAG + " - a shot's window: the Flare's three meteors 220 ms apart are one hit"), 'meteor fall hit');
}
// 5) the landing: 35% of a roll after a fall hit, a full roll otherwise
{
  const A = '          if (h._gravBlue && _mLost > LX_GRAV_METEOR_CAP) _mLost = LX_GRAV_METEOR_CAP;   // v0.30.816 grav-meteor-cap';
  const n = s.split(A).length - 1; if (n !== 1) die('meteor landing matched ' + n);
  const i = s.indexOf(A), e = s.indexOf(EOL, i);
  s = s.slice(0, e) + EOL + '          if (h._leoMeteor && _mLost > 0 && !player._god) _mLost = _lxLeoMeteorLoss(_landMul);   // ' + TAG + ' - the residual is 35% of a roll, capped' + s.slice(e);
}
// 6) co-op: the host's detonation says it is a Regulus meteor
{
  const A = "            hf: h._hpFloorPct > 0 ? h._hpFloorPct : undefined,   // v0.30.1730 bughunt4 - Aetherion's 20% floor reaches a guest";
  once(A, J(A, '            lm: h._leoMeteor ? 1 : undefined,   // ' + TAG + ' - a guest lands the same roll and cap on its own DEF'), 'hazhit broadcast');
}
// 7) co-op guest: the same roll, cap and window
{
  const A = J('  player.hp -= _lxLost(_hzLost);', '  player.lastHitTime = game.time;', '  player.invulnerable = 600;');
  once(A, J(
    '  if (+msg.lm === 1 && _hzLost > 0) _hzLost = _lxLeoMeteorLoss(1);   // ' + TAG + " - a Regulus meteor (the guest never runs the fall: a full roll, as the host's fall)",
    A,
    '  if (+msg.lm === 1) player.invulnerable = 1200;   // ' + TAG), 'hazhit guest apply');
}

const grew = s.length - n0;
if (grew < 2200 || grew > 4200) die('size moved ' + grew);
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
console.log('applied: regulus-damage (+' + grew + ' chars)');
