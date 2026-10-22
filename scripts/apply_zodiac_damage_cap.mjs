// Every zodiac sign one-shots a full-HP hero from range (zodiac damage cap, 2026-10-22) - Regulus's fix, for all twelve.
// ============================================================================
// Per user (after Regulus, v0.30.1850): the same fairness for every other zodiac boss, with one cap table for all twelve:
// Story 30%, Normal 45%, Hard 65%, Nightmare 85% of the hero's max HP per hit.
// Measured in each sign's arena against a geared at-level hero (devSetLevel + the best shop piece per slot), Lv 70-99,
// mage / archer / warrior, the resolver stepped by hand with the roll pinned at its top:
//   - every sign's shots land the flat zodiac roll (3,000-5,000 x the DEF ramp x difficulty; Scorpio 2,100-3,500) with no
//     ceiling: a Lv 70 mage (4,452 HP) took 104% from one shot on Normal and 207% on Nightmare, on every sign.
//   - Ariel's charge trail and Cracked Arena tile and Scorpio's Ambush are hazards sized from raw ATK through the generic
//     meteor path (DEF absorb, then _diffDmg with no attacker level: the arena's levelReq and x(1.3 + 0.08 per level of gap),
//     no cap): an Ambush took 145% on Normal, 290% on Nightmare. The Venom Deluge pool ticked the same ramp every 26 frames
//     with no i-frames (52% a tick on Normal, 157% in 1.2 s).
//   - stacked hits: a hazard's 400 ms window let a shot land on top (Aries trail + shot 160%); Sagittarius's Marked Shot hits
//     the mark AND fires its arrow with no window between; Pisces's Tidal Crush and Aquarius's Conductive Pool leave little or
//     no window before the next shot; Regulus's roar cone (15%) rides with a roar shot.
// Fix (every sign; Regulus keeps his v0.30.1850 shape, on the shared table):
//   1) one cap table, LX_ZODIAC_HIT_CAP, and one helper, _lxZodHitCap: a zodiac hit takes at most that share of max HP, AND
//      every capped zodiac hit inside 1.2 s (the window a shot already grants) shares that one cap, so a hazard, a cone or a
//      point-blank hit followed by a shot can never stack past it. _lxLeoHitCap / _lxLeoMeteorLoss now call these.
//   2) every zodiac shot (anything carrying _zodiacSign, a co-op guest's copy included) runs the cap - after Capricorn's 32%
//      floor, so on Story his shot lands 30%.
//   3) Ariel's trail and Cracked Arena tile and Scorpio's Ambush carry _zodiacSign: they land the sign's zodiac roll (as
//      Regulus's meteors do), capped, and a struck hero gets a shot's 1,200 ms window; the landing's residual is 35% of a
//      roll. The Venom Deluge pool ticks 16% of Scorpio's roll (its old share of an Ambush), capped with the window.
//   4) the untelegraphed direct hits - Sagittarius's Point-Blank Volley and Marked Shot, Pisces's Tidal Crush, Aquarius's
//      Conductive Pool - run the cap; Regulus's roar cone and Sun Pounce land in full but count toward the window.
//   5) co-op: a host hazhit carries zs (the sign); a guest lands the same roll, cap and window on its own DEF. A guest's
//      copy of a direct hit (bosshit) and the host's re-applied strike (_coopSelfBossHit) run the cap by their label.
// Telegraphed one-hit mechanics are untouched: HEAVENSPLIT (to 1 HP), Virgo's Judgment and her column's radiance, Taurus's
// goring charge (to 1 HP), Scorpio's Stinger (70% of the HP left, never lethal), Capricorn's Hoofquake (airborne dodges it,
// 90% ceiling), the Sun Pounce; so are contact, the signature swing / column traits' bands and every DoT.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxZodHitCap(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
const after = (a, add, what) => once(a, a + add, what);   // a line appended after an anchor that ends its line
const TAG = 'v0.30.1853 zodiac-damage-cap';
const C = ' /* ' + TAG + ' */';
const afterLine = (a, add, what) => {   // a new line after the line that holds the anchor (its tail comment kept)
  const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n);
  const i = s.indexOf(a), e = s.indexOf(EOL, i);
  s = s.slice(0, e) + EOL + add + s.slice(e);
};
const beforeLine = (a, add, what) => once(a, add + EOL + a, what);

// 1) the shared table, the window and the helpers, in place of Regulus's own table (his two helpers now call them)
once('const LX_LEO_HIT_CAP = { story: 0.30, normal: 0.45, hard: 0.55, nightmare: 0.65 };', J(
  '// ' + TAG + ' - ONE CAP FOR ALL TWELVE SIGNS (per user: Story 30%, Normal 45%, Hard 65%, Nightmare 85%; Regulus had 30/45/55/65).',
  '// A zodiac hit - a shot, a zodiac hazard, an untelegraphed direct hit - takes at most this share of the hero\'s max HP after every',
  '// multiplier, and every capped zodiac hit inside LX_ZODIAC_HIT_WIN_F frames (1.2 s, the window a shot already grants) shares the one',
  '// cap, so a hazard, a cone or a point-blank hit with a shot on top never stacks past it. A telegraphed hit (the roar cone, the Sun',
  '// Pounce) lands in full but counts toward the window (_lxZodHitNote). A tank never reaches the cap; it trims squishy builds and hard tiers.',
  'const LX_ZODIAC_HIT_CAP = { story: 0.30, normal: 0.45, hard: 0.65, nightmare: 0.85 };',
  'const LX_LEO_HIT_CAP = LX_ZODIAC_HIT_CAP;   // ' + TAG + ' - Regulus reads the shared table',
  'const LX_ZODIAC_HIT_WIN_F = 72;   // ' + TAG + ' - 1.2 s of game frames',
  'const LX_ZODIAC_POOL_MUL = 0.16;   // ' + TAG + ' - a Venom Deluge tick: its old share of an Ambush (ATK x0.11 vs x0.7)',
  'function _lxZodWin() {   // ' + TAG + ' - the capped zodiac hits of the last 1.2 s, as [frame, loss]',
  '  const now = game.time | 0; let w = game._lxZc; if (!Array.isArray(w)) w = game._lxZc = [];',
  '  for (let i = w.length - 1; i >= 0; i--) { const d = now - w[i][0]; if (d < 0 || d >= LX_ZODIAC_HIT_WIN_F) w.splice(i, 1); }',
  '  return w;',
  '}',
  'function _lxZodHitCap(v) {   // ' + TAG + ' - one zodiac hit: at most the tier\'s share of max HP, less what the window already took',
  '  if (!(v > 0) || typeof player === \'undefined\' || !player || typeof game === \'undefined\' || !game) return v;',
  '  const mh = Math.max(1, (typeof getMaxHp === \'function\') ? getMaxHp() : (player.maxHp || 100));',
  '  const f = LX_ZODIAC_HIT_CAP[(typeof _lxDiffTier === \'function\') ? _lxDiffTier() : \'normal\'] || LX_ZODIAC_HIT_CAP.normal;',
  '  const w = _lxZodWin(); let got = 0; for (const e of w) got += e[1];',
  '  v = Math.min(v, Math.max(1, Math.floor(mh * f) - got)); w.push([game.time | 0, v]); return v;',
  '}',
  'function _lxZodHitNote(v) { if (v > 0 && typeof game !== \'undefined\' && game) _lxZodWin().push([game.time | 0, v]); }   // ' + TAG + ' - lands in full, counts',
  'function _lxZodRollLoss(sign, mul) {   // ' + TAG + ' - the sign\'s zodiac roll (Scorpio\'s own 2,100-3,500) x mul, uncapped',
  '  const r = (sign === \'scorpio\') ? _lxRolledProjLoss(2100, 3500) : _lxRolledProjLoss(LX_ZODIAC_PROJ_MIN, LX_ZODIAC_PROJ_MAX);',
  '  return Math.max(1, Math.floor(r * ((mul > 0) ? mul : 1)));',
  '}',
  'function _lxZodMeteorLoss(mul, sign) { return _lxZodHitCap(_lxZodRollLoss(sign, mul)); }   // ' + TAG + ' - a zodiac hazard: the roll, capped',
  '// ' + TAG + ' - the direct hits a co-op peer receives as bosshit (sl, cut to 24) that run the cap',
  'const LX_ZODIAC_CAP_SL = ["Sagittarius\'s Point-Blank Volley", "Sagittarius\'s Marked Shot", "Pisces\'s Tidal Crush", "Aquarius\'s Conductive Pool"].map((t) => t.slice(0, 24));',
  'function _lxZodCapLabel(sl) { return LX_ZODIAC_CAP_SL.indexOf(String(sl || \'\').slice(0, 24)) >= 0; }   // ' + TAG), 'Regulus cap table');
once(J('  const mh = Math.max(1, (typeof getMaxHp === \'function\') ? getMaxHp() : (player.maxHp || 100));',
  '  const f = LX_LEO_HIT_CAP[(typeof _lxDiffTier === \'function\') ? _lxDiffTier() : \'normal\'] || LX_LEO_HIT_CAP.normal;',
  '  return Math.min(v, Math.max(1, Math.floor(mh * f)));'),
  '  return _lxZodHitCap(v);   // ' + TAG + ' - the shared table and window', 'Regulus cap body');
once('  return _lxLeoHitCap(Math.max(1, Math.floor(_lxRolledProjLoss(LX_ZODIAC_PROJ_MIN, LX_ZODIAC_PROJ_MAX) * ((mul > 0) ? mul : 1))));',
  "  return _lxZodMeteorLoss(mul, 'leo');   // " + TAG, 'Regulus meteor body');

// 2) every zodiac shot runs the cap - after Capricorn's floor (so the cap is the last word), before Aquarius's seal
{
  const LEO = "        if (p._zodiacSign === 'leo' && _projLost > 0 && !player._god) _projLost = _lxLeoHitCap(_projLost);";
  const n = s.split(LEO).length - 1; if (n !== 1) die('Regulus shot cap matched ' + n);
  const i = s.indexOf(LEO), e = s.indexOf(EOL, i);
  s = s.slice(0, i) + s.slice(e + EOL.length);   // his own line goes: the generic one below covers him
  beforeLine("        if (p._zodiacSign === 'aquarius' && !player._god && _projLost > 0) {",
    '        if (p._zodiacSign && _projLost > 0 && !player._god) _projLost = _lxZodHitCap(_projLost);   // ' + TAG + ' - one zodiac shot takes at most LX_ZODIAC_HIT_CAP of max HP, nor stacks past it in 1.2 s', 'Aquarius seal');
}
// 3) the ATK-sized zodiac hazards carry their sign
once("damage: m.atk * 0.5, owner: 'enemy', radius: 90 });",
  "damage: m.atk * 0.5, owner: 'enemy', radius: 90, _zodiacSign: m.zodiacSign || null" + C + " });", 'Aries charge trail');
after('          _ariesCrack: true,', EOL + '          _zodiacSign: m.zodiacSign || null,   // ' + TAG + ' - the zodiac roll, capped (was ATK x0.7 through the level-gap ramp)', 'Cracked Arena tile');
after("        _sourceLabel: 'a Scorpio Ambush',", EOL + "        _zodiacSign: m.zodiacSign || null,   // " + TAG + " - Scorpio's roll, capped (was ATK x0.7 through the level-gap ramp)", 'Scorpio Ambush');
after("      owner: 'enemy', damage: dmg, _owner: m,", ' _zodiacSign: m.zodiacSign || null,   // ' + TAG + " - a tick is 16% of Scorpio's roll, capped", 'Venom Deluge pool');
// 4) the meteor resolver: the fall, its window, the landing; the co-op detonation and a guest's copy
afterLine('        if (h._leoMeteor && _pLost > 0 && !player._god) _pLost = _lxLeoMeteorLoss(1);',
  "        if (h._zodiacSign && !h._leoMeteor && _pLost > 0 && !player._god) _pLost = _lxZodMeteorLoss(1, h._zodiacSign);   // " + TAG + " - Ariel's trail and tile, Scorpio's Ambush: the sign's roll, capped", 'meteor fall hit');
afterLine('        if (h._leoMeteor) player.invulnerable = 1200;', "        if (h._zodiacSign) player.invulnerable = 1200;   // " + TAG + " - a shot's window", 'meteor fall window');
afterLine('          if (h._leoMeteor && _mLost > 0 && !player._god) _mLost = _lxLeoMeteorLoss(_landMul);',
  '          if (h._zodiacSign && !h._leoMeteor && _mLost > 0 && !player._god) _mLost = _lxZodMeteorLoss(_landMul, h._zodiacSign);   // ' + TAG + ' - the residual is 35% of a roll, capped', 'meteor landing');
afterLine('            lm: h._leoMeteor ? 1 : undefined,',
  '            zs: (h._zodiacSign && !h._leoMeteor) ? String(h._zodiacSign).slice(0, 12) : undefined,   // ' + TAG + " - a guest lands the sign's roll and cap on its own DEF", 'hazhit broadcast');
afterLine('  if (+msg.lm === 1 && _hzLost > 0) _hzLost = _lxLeoMeteorLoss(1);',
  '  if (msg.zs && +msg.lm !== 1 && _hzLost > 0) _hzLost = _lxZodMeteorLoss(1, String(msg.zs).slice(0, 12));   // ' + TAG + " - a zodiac hazard: a full roll, as the host's fall", 'hazhit guest apply');
afterLine('  if (+msg.lm === 1) player.invulnerable = 1200;', '  if (msg.zs) player.invulnerable = 1200;   // ' + TAG, 'hazhit guest window');
// 5) the Venom Deluge pool: a tick is 16% of the sign's roll, capped (a guest's mirror carries no owner: its label says Scorpio)
once("            player.hp -= (player._god ? _lxLost(0, dmg) : _lxLost(((typeof _diffDmg === 'function') ? _diffDmg(dmg) : dmg)));", J(
  "            const _zpS = h._zodiacSign || (h._owner && h._owner.zodiacSign) || (/Scorpio/.test(String(h._sourceLabel || '')) ? 'scorpio' : null);   // " + TAG,
  "            let _zpL = player._god ? 0 : ((typeof _diffDmg === 'function') ? _diffDmg(dmg) : dmg);   // " + TAG + ' - a paused hero or a Second Skin negate still takes nothing',
  '            if (_zpS && _zpL > 0) _zpL = _lxZodHitCap(_lxZodRollLoss(_zpS, LX_ZODIAC_POOL_MUL));   // ' + TAG + ' - was ATK through the level-gap ramp, every 26 frames',
  '            player.hp -= (player._god ? _lxLost(0, dmg) : _lxLost(_zpL));'), 'venom pool tick');
// 6) the untelegraphed direct hits run the cap; Regulus's cone and pounce count toward the window
for (const [v, what] of [['_kd', 'Point-Blank Volley'], ['_sd', 'Marked Shot'], ['_td', 'Tidal Crush']]) {
  const A = "_lxLost((typeof _diffDmg === 'function') ? _diffDmg(" + v + ", (typeof _mobLevel === 'function') ? _mobLevel(m) : 0, true) : " + v + ')';
  once(A, '_lxLost(_lxZodHitCap(' + A.slice('_lxLost('.length, -1) + ')' + C + ')', what);
}
beforeLine('            player.hp -= (player._god ? 0 : _shock);', '            if (!player._god) _shock = _lxZodHitCap(_shock);   // ' + TAG + ' - capped; a shot on top shares the cap', 'Conductive Pool');
afterLine("            player.hp -= _lxLost((typeof _diffDmg === 'function') ? _diffDmg(_d, 0, true) : _d);",
  '            _lxZodHitNote(_lxShownLost());   // ' + TAG + ' - the Sun Pounce lands in full (telegraphed) and counts toward the window', 'Sun Pounce');
afterLine('    player.hp -= (player._god ? 0 : _rd);', '    if (!player._god) _lxZodHitNote(_rd);   // ' + TAG + ' - the roar cone lands in full and counts: a roar shot on top shares the cap', 'roar cone');
// 7) co-op: a guest's copy of a zodiac direct hit, and the host's own re-applied strike, run the cap by their label
beforeLine('  player.hp -= _lxLost(_bhLost);', '  if (_bhLost > 0 && _lxZodCapLabel(msg.sl)) _bhLost = _lxZodHitCap(_bhLost);   // ' + TAG + ' - on the guest\'s own bar', 'bosshit guest apply');
once("  player.hp -= _lxLost((typeof _diffDmg === 'function') ? _diffDmg(dmg, 0, isFrac) : dmg);",
  "  { let _sbL = (typeof _diffDmg === 'function') ? _diffDmg(dmg, 0, isFrac) : dmg; if (_sbL > 0 && _lxZodCapLabel(label)) _sbL = _lxZodHitCap(_sbL); player.hp -= _lxLost(_sbL); }   // " + TAG, 'self boss hit');

const grew = s.length - n0;
if (grew < 4500 || grew > 7000) die('size moved ' + grew);
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
console.log('applied: zodiac-damage-cap (+' + grew + ' chars)');
