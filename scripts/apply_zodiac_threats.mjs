// v0.30.297 — four zodiac boss threats, per user.
// =============================================================================
//   1. "make scorpio boss contact damage at least 40% of players max HP"
//   2. "make capricor projectiles deal at least 32% of players max HP"
//   3. "For aqua boss, if touched by some projectiles, players are unable to
//      use potions for 45 seconds"
//   4. "Make pisces boss atk 2x higher"           <- data/monster_stats.js,
//                                                    see apply_pisces_atk.mjs
//
// HOW THE ENGINE ALREADY WORKS, and why these land where they do:
//
// Contact and projectile damage both finish inside _gravBandClamp(dmg, band),
// where floor/cap are FRACTIONS of band.ref — and ref defaults to getMaxHp()
// (the player's real max HP) when omitted. The zodiac touch band is
// {floor 0.15, cap 0.60} against _refLoAtLv (the squishiest class's HP at the
// boss's level), NOT against the player's own pool. So a floor expressed as
// "% of the PLAYER's max HP" has to be applied after that clamp, against
// getMaxHp() — which is exactly what these do.
//
// The projectiles are tagged rather than special-cased at each site: zodiac
// bosses fire from FIVE places (generic shoot, columnStrike lanes, the phase
// nova, the phase shot, the homing shot), so each spawn now stamps
// _zodiacSign and ONE rule block in the impact resolver reads it. Adding a
// sixth spawn later inherits the behaviour for free.
//
// Every rule is _god-gated (the harness and debug flight stay unhittable) and
// sits after the existing band clamps, so block / warrior DR / aegis are all
// still applied first — these raise the FLOOR, they do not bypass mitigation.
//
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;

if (s.includes('_zodiacSign:') || s.includes('_potionLockUntil')) { console.log('already applied'); process.exit(0); }

const eolAt = (a) => { const i = s.indexOf(a); return (i >= 0 && s.substr(i + a.length, 2) === '\r\n') ? '\r\n' : '\n'; };
const sub = (label, anchor, lines, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(lines.join(eolAt(anchor)));
};

// ---- 1. stamp the firing sign on every zodiac projectile --------------------
sub('generic shoot tag',
  '    _zodiacAttacker: !!m.zodiacBoss,',
  ['    _zodiacAttacker: !!m.zodiacBoss,',
   "    _zodiacSign: m.zodiacSign || null,   // v0.30.297 — per-sign projectile rules read this at impact"]);

sub('zodiac AI tags',
  '          _zodiacAttacker: true,',
  ['          _zodiacAttacker: true,',
   "          _zodiacSign: m.zodiacSign || null,   // v0.30.297"], 2);

sub('column tag',
  "            damage: _csDmg, owner: 'enemy', skill: 'column',",
  ["            damage: _csDmg, owner: 'enemy', skill: 'column',",
   "            _zodiacSign: m.zodiacSign || null,   // v0.30.297 — a pillar is a projectile too"]);

// ---- 2. the per-sign projectile rules, one place ---------------------------
sub('projectile rules',
  '        if (p._normalMob && _projLost > 0) _projLost = Math.min(_projLost, Math.floor((p.damage || dmg) * 1.35));',
  ['        if (p._normalMob && _projLost > 0) _projLost = Math.min(_projLost, Math.floor((p.damage || dmg) * 1.35));',
   '        // v0.30.297 — PER-SIGN PROJECTILE RULES (per user). Applied AFTER the',
   '        // band clamps above, so block / warrior DR / aegis still mitigate',
   '        // first; this raises the floor rather than bypassing defence. Keyed',
   '        // on the sign stamped at every zodiac projectile spawn.',
   "        if (p._zodiacSign === 'capricorn' && !player._god && _projLost > 0) {",
   '          // "capricor projectiles deal at least 32% of players max HP"',
   "          const _capMax = (typeof getMaxHp === 'function') ? getMaxHp() : (player.maxHp || 100);",
   '          const _capFloor = Math.max(1, Math.floor(_capMax * 0.32));',
   '          if (_projLost < _capFloor) _projLost = _capFloor;',
   '        }',
   "        if (p._zodiacSign === 'aquarius' && !player._god) {",
   '          // "if touched by some projectiles, players are unable to use',
   '          // potions for 45 seconds". game.time is the 60Hz sim counter, the',
   '          // same clock the potion cooldown already uses, so the seal pauses',
   '          // with the game instead of draining behind a menu.',
   '          const _seal = (game.time | 0) + 2700;',
   '          if ((player._potionLockUntil | 0) < _seal) {',
   '            const _wasSealed = (player._potionLockUntil | 0) > (game.time | 0);',
   '            player._potionLockUntil = _seal;',
   "            if (!_wasSealed && typeof showToast === 'function') showToast('🧪 POTIONS SEALED — 45s', 'epic');",
   '          }',
   '        }']);

// ---- 3. Scorpio's touch floor ----------------------------------------------
sub('scorpio contact floor',
  '      player.hp -= (player._god ? 0 : _shownDmg);',
  ['      // v0.30.297 — SCORPIO CONTACT FLOOR (per user: "at least 40% of',
   '      // players max HP"). The zodiac touch band above is a fraction of the',
   '      // level reference, not of the player\'s pool, so the floor is applied',
   '      // here against getMaxHp(). After mitigation, as with every other rule',
   '      // in this pass.',
   "      if (m.zodiacSign === 'scorpio' && !player._god && _shownDmg > 0) {",
   "        const _scMax = (typeof getMaxHp === 'function') ? getMaxHp() : (player.maxHp || 100);",
   '        const _scFloor = Math.max(1, Math.floor(_scMax * 0.40));',
   '        if (_shownDmg < _scFloor) _shownDmg = _scFloor;',
   '      }',
   '      player.hp -= (player._god ? 0 : _shownDmg);']);

// ---- 4. the potion seal, at both gates -------------------------------------
sub('potion seal gates',
  '  if (game.mapData && game.mapData.noPotion) {',
  ['  // v0.30.297 — AQUARIUS POTION SEAL. Placed beside the map noPotion gate,',
   '  // which is the same shape and already covers every potion path: this',
   '  // function and useQuickPotion are the two chokepoints _useBoundPotion and',
   '  // the inventory both route through.',
   '  if ((player._potionLockUntil | 0) > (game.time | 0)) {',
   '    const _left = Math.ceil(((player._potionLockUntil | 0) - (game.time | 0)) / 60);',
   "    if (typeof showToast === 'function') showToast('🧪 Potions sealed by the Tidesworn — ' + _left + 's', 'common');",
   "    if (typeof audio !== 'undefined' && audio && audio.play) audio.play('hit');",
   '    return;',
   '  }',
   '  if (game.mapData && game.mapData.noPotion) {'], 2);

const grew = s.length - n0;
if (grew < 2000 || grew > 5000) {
  console.error(`ABORT: content moved ${n0} -> ${s.length} chars (${grew}), expected roughly +3000`);
  process.exit(1);
}
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: scorpio 40% touch floor, capricorn 32% projectile floor, aquarius 45s potion seal (+${grew})`);
