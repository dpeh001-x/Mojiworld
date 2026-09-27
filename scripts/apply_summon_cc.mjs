// Summons keep fighting while the player is stunned or frozen (deferred from a past bug hunt as "needs an updatePlayer refactor").
// ============================================================================
// Bug: updatePlayer has three crowd-control early returns - hit-stun (a stagger, the electric-shock mini-stun), the
// freeze / stun gate (frozenTimer, stunTimer) and the shackle QTE - and every one of them returns BEFORE the code that
// runs the player's summons. So for as long as the player was stunned or frozen:
//   - War Machine turrets, Shadow Clones and the Sovereign Shade stopped firing / pulsing;
//   - the Soul Ward, Grand Hex and Divine Aegis orbs hung in the air and struck nothing;
//   - Beastmaster pack wolves, the Wild Bond wolf, the Apex Bond werewolf and the Skyhunter eagle froze mid-stride;
//   - the Arch Bishop's Hallowed Field aura stopped refreshing and ran out.
// Their lifetimes froze too, so a stun also stretched the summon (and the Aegis half-damage shield). The necromancer's
// minions and the MojiMon were never affected: they live in game.minions, ticked from the main loop.
// Fix: the three summon blocks are wrapped IN PLACE as function declarations inside updatePlayer (hoisted, so the
// early returns above them can call them; the code itself does not move, so the normal frame runs exactly as
// before). The normal frame calls each at its old spot; the three CC gates call all three before they return. Each
// gate returns, so a frame runs them exactly once either way. The player's own input, movement, skills and the
// Siege Volley channel stay blocked. Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxSummonWardTick(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
// wrap [start .. end-anchor] in place: both anchors unique, in order, and the region inside updatePlayer and of sane size
const U0 = s.indexOf('function updatePlayer(dt) {');
if (U0 < 0 || s.indexOf('function updatePlayer(dt) {', U0 + 1) >= 0) die('updatePlayer not found cleanly');
const U1 = s.indexOf(EOL + '}' + EOL, U0);
const wrap = (start, end, head, tail, lo, hi, what) => {
  const a = s.indexOf(start), b = s.indexOf(end);
  if (a < 0 || s.indexOf(start, a + 1) >= 0) die(what + ' start matched ' + (a < 0 ? 0 : 2));
  if (b < 0 || s.indexOf(end, b + 1) >= 0) die(what + ' end matched ' + (b < 0 ? 0 : 2));
  if (!(U0 < a && a < b && b < U1)) die(what + ' not in order inside updatePlayer');
  if (b - a < lo || b - a > hi) die(what + ' region is ' + (b - a) + ' chars');
  const e = b + end.length;
  s = s.slice(0, a) + head + s.slice(a, e) + tail + s.slice(e);
};
const HOIST = '(a function declaration: hoisted, so the CC gates above can call it; the code did not move)';

// 1 of 3: the Hallowed Field aura and the Soul Ward / Grand Hex / Divine Aegis orbs
wrap('  // v0.25.512 \u2014 Arch Bishop passive: "The Hallowed Field". Refreshes',
  J('    if (aegis.life <= 0) player._aegis = null;', '  }'),
  J('  // v0.30.1213 summon-cc - SUMMONS, WARDS AND AURAS RUN WHILE YOU ARE STUNNED OR FROZEN (1 of 3: the Hallowed Field',
    '  // aura, the Soul Ward / Grand Hex / Divine Aegis orbs). The CC early returns above used to skip all of it, so the',
    '  // orbs hung still and the aura lapsed. ' + HOIST,
    '  function _lxSummonWardTick(dt) {', ''),
  J('', '  }   // v0.30.1213 summon-cc - end of _lxSummonWardTick', '  _lxSummonWardTick(dt);   // v0.30.1213 summon-cc - the normal frame, at the old spot'),
  6000, 40000, 'the ward / orb block');

// 2 of 3: the Sovereign Shade, the Shadow Clones and the War Machine turrets
wrap('  if (player._shade) _tickSovereignShade(dt);',
  J('    if (!player._ballistaTurrets.length) player._ballistaTurrets = null;', '  }'),
  J('  // v0.30.1213 summon-cc - (2 of 3: the Sovereign Shade, the Shadow Clones, the War Machine turrets) ' + HOIST,
    '  function _lxSummonTurretTick(dt) {', ''),
  J('', '  }   // v0.30.1213 summon-cc - end of _lxSummonTurretTick', '  _lxSummonTurretTick(dt);   // v0.30.1213 summon-cc - the normal frame, at the old spot'),
  3000, 20000, 'the shade / clone / turret block');

// 3 of 3: the Beastmaster pack, the Wild Bond wolf, the Apex Bond werewolf and the Skyhunter eagle
wrap('  // Beastmaster pack (up to 2 wolves; v0.25.540)',
  J('      }', '    }', '  }', '', '  // Rage mode'),
  J('  // v0.30.1213 summon-cc - (3 of 3: the Beastmaster pack, the Wild Bond wolf, the Apex Bond werewolf, the Skyhunter eagle)',
    '  // ' + HOIST,
    '  function _lxSummonPetTick(dt) {', ''),
  '', 8000, 40000, 'the pack / pet block');
once(J('  }', '', '  // Rage mode'), J('  }', '  }   // v0.30.1213 summon-cc - end of _lxSummonPetTick',
  '  _lxSummonPetTick(dt);   // v0.30.1213 summon-cc - the normal frame, at the old spot', '', '  // Rage mode'), 'the pet block close');

// the three CC gates: each runs all three before it returns (one call a frame - the gate returns, the normal spots are skipped)
const RUN = '_lxSummonWardTick(dt); _lxSummonTurretTick(dt); _lxSummonPetTick(dt);';
once(J('    _lxTickBlockTimers(dt);   // v0.30.919 nor the block / parry clocks', '    player.hitStun -= dt;'),
  J('    _lxTickBlockTimers(dt);   // v0.30.919 nor the block / parry clocks',
    '    ' + RUN + '   // v0.30.1213 summon-cc - nor your summons, orbs and auras',
    '    player.hitStun -= dt;'), 'the hit-stun gate');
once(J('    _lxTickBlockTimers(dt);   // v0.30.919 nor the block / parry clocks', "    player.state = 'idle';", '    if (player.onGround) player.vx *= 0.8;'),
  J('    _lxTickBlockTimers(dt);   // v0.30.919 nor the block / parry clocks',
    '    ' + RUN + '   // v0.30.1213 summon-cc - nor your summons, orbs and auras',
    "    player.state = 'idle';", '    if (player.onGround) player.vx *= 0.8;'), 'the freeze / stun gate');
once(J('    else {', '      _qteFrame(dt);', "      player.state = 'idle';"),
  J('    else {', '      ' + RUN + '   // v0.30.1213 summon-cc - nor while shackled', '      _qteFrame(dt);', "      player.state = 'idle';"),
  'the shackle QTE gate');

const grew = s.length - n0;
if (grew < 1200 || grew > 3500) die('size moved ' + grew);
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
console.log('applied: summon-cc (+' + grew + ' chars)');
