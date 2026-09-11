// Necromancer undead strike by reach against the target's body, jump only at
// targets standing above them, and every flanker gets a swing.
// =============================================================================
// Per user: "work on the summons, especially for necromancer, they seem to be
// jumping at gravitos but not dealing damage, make the summons AI smarter".
//
// MEASURED FIRST (summon_ai_test: three undead raised beside one pinned,
// inert target for 8 s): against Gravitos (340 x 380) 7 swings, 3 damage, 11
// jumps and 73% of the time airborne; against a normal slime only 20 swings -
// one minion's worth - because the other two never swung at all.
//
// WHY. The undead attacked only when their CENTRE came within 30 px of the
// target's CENTRE. Gravitos's centre stands ~190 px off the floor and a 24 x 32
// skeleton's ~16 px, so from the floor the gap is ~174 px; _allyPlatformStep
// jumps whenever the target's centre is 28 px higher, and a jump (vy -11,
// gravity 0.5) peaks ~121 px up - still ~50 px short. They hopped at him for
// their whole life. Any monster much over ~90 px tall had the same problem.
// And the pack stands line-abreast 42 px apart around its target, so against
// anything small the flankers sat outside the 30 px circle and never swung.
//
// FIX (the undead only - the MojiMon companion and the pets keep their tuned
// rules):
//   1. STRIKE BY REACH. The swing lands when the minion's box, grown by
//      14 px sideways and 6 px up/down, overlaps the target's body - the same
//      raw body monsters use to hit minions, so the exchange is symmetric.
//   2. JUMP ONLY AT WHAT STANDS ABOVE. _allyPlatformStep takes an optional
//      { bodyAware } and, for the undead, jumps only when the target's FEET
//      are above the minion's head (a ledge, a hovering flier) and the bodies
//      are within 100 px sideways - never merely because the target is tall.
//   3. HEIGHT IS PRICED BY THE GAP BETWEEN BODIES, not centres, when choosing
//      a target - a tall boss on your floor is at your level.
//   4. FLANKERS STAY IN REACH. The line-abreast offset is capped to the
//      target's half width + the minion's + 10 px, so every flanker swings.
//   5. The hit spark is drawn where the blow lands, not at the target's
//      centre (190 px over the skeleton's head on Gravitos).
//
// Anchors are single lines where the source interleaves comments (the platform
// step has comment blocks between its statements).
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('_lxUndeadInReach')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- helpers + the optional argument, at the shared platform step -------------
sub('helpers', 'function _allyPlatformStep(ally, target) {',
  J('// v0.30.623 summon-ai - the undead strike by REACH against the target\'s body (per user: "they',
    '// seem to be jumping at gravitos but not dealing damage"). They struck only when their centre',
    '// came within 30 px of the target\'s centre, which a 24 x 32 skeleton can never do to anything',
    '// much over ~90 px tall: Gravitos\'s centre is ~174 px above one standing at his feet, and a jump',
    '// peaks ~121 px up. The swing now lands when the minion\'s box, grown by the reach below, overlaps',
    '// the target\'s raw body - the same body monsters use to hit the minions.',
    'const LX_UNDEAD_REACH_X = 14, LX_UNDEAD_REACH_Y = 6;',
    'function _lxUndeadInReach(mn, t) {',
    '  if (!mn || !t) return false;',
    '  return (mn.x - LX_UNDEAD_REACH_X) < (t.x + t.w) && (mn.x + mn.w + LX_UNDEAD_REACH_X) > t.x',
    '      && (mn.y - LX_UNDEAD_REACH_Y) < (t.y + t.h) && (mn.y + mn.h + LX_UNDEAD_REACH_Y) > t.y;',
    '}',
    '// Vertical gap between two bodies (0 when their spans overlap) - how far a minion really has to',
    '// climb to reach something, where a centre-to-centre distance made a tall boss read as high up.',
    'function _lxBodyGapY(a, b) {',
    '  return Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h));',
    '}',
    'const _LX_UNDEAD_STEP = { bodyAware: true };',
    'function _allyPlatformStep(ally, target, opts) {   // v0.30.623 summon-ai - opts.bodyAware (the undead)'));

// ---- the body-aware jump rule (callers without the option keep the old rule) ---
sub('jump rule', '    if (tgtY < allyY - 28 && _dxT < 120 && (!ally._jumpUntil || game.time >= ally._jumpUntil)) {',
  J('    // v0.30.623 summon-ai - { bodyAware }: jump only when the target STANDS above (its feet over this',
    '    // ally\'s head) and the bodies are within 100 px sideways, never merely because it is tall.',
    '    // Callers without the option keep the centre rule above exactly.',
    '    const _wantJump = (opts && opts.bodyAware)',
    '      ? ((target.y + (target.h || 0)) < ally.y - 6 && (_dxT - ((target.w || 0) + (ally.w || 0)) / 2) < 100)',
    '      : (tgtY < allyY - 28 && _dxT < 120);',
    '    if (_wantJump && (!ally._jumpUntil || game.time >= ally._jumpUntil)) {'));

// ---- target choice: height priced by the gap between bodies (undead) ----------
sub('strict dy', J(
  '        const _dyAbs = Math.abs(dy);',
  "        if (_dyAbs > (typeof _ALLY_DY_MAX === 'number' ? _ALLY_DY_MAX : 200)) continue;"),
  J('        const _dyAbs = mn.mojimon ? Math.abs(dy) : _lxBodyGapY(mn, m);   // v0.30.623 summon-ai - undead: the gap between bodies, not centres',
    "        if (_dyAbs > (typeof _ALLY_DY_MAX === 'number' ? _ALLY_DY_MAX : 200)) continue;"));
sub('fallback dy', J(
  '          const _dyAbs = Math.abs(dy);',
  '          if (_dyAbs > _mnDyMax * _rx) continue;'),
  J('          const _dyAbs = mn.mojimon ? Math.abs(dy) : _lxBodyGapY(mn, m);   // v0.30.623 summon-ai',
    '          if (_dyAbs > _mnDyMax * _rx) continue;'));

// ---- flankers stay inside reach ----------------------------------------------
sub('flank cap', '      const dx = (tcx + mn._offX) - _mnCx;',
  J('      // v0.30.623 summon-ai - the line-abreast offset is capped to the target\'s half width + the',
    '      // minion\'s + 10 px, so against something small every flanker still stands in reach.',
    '      const _offCap = (tgt.w || 0) / 2 + mn.w / 2 + 10;',
    '      const dx = (tcx + (mn.mojimon ? mn._offX : Math.max(-_offCap, Math.min(_offCap, mn._offX)))) - _mnCx;'));

// ---- the undead use the body-aware jump ---------------------------------------
sub('step call', '    _allyPlatformStep(mn, tgt);',
  '    _allyPlatformStep(mn, tgt, mn.mojimon ? null : _LX_UNDEAD_STEP);   // v0.30.623 summon-ai');

// ---- strike by reach; the spark where the blow lands ----------------------------
sub('strike', J(
  '      const _mr = mn.mojimon ? Math.max(30, (mn.w + tgt.w) * 0.45) : 30;',
  '      if (_ddx*_ddx + _ddy*_ddy < _mr * _mr) {'),
  J('      const _mr = mn.mojimon ? Math.max(30, (mn.w + tgt.w) * 0.45) : 30;',
    '      // v0.30.623 summon-ai - the undead strike by reach against the body (see _lxUndeadInReach);',
    '      // the MojiMon keeps its size-aware centre radius.',
    '      if (mn.mojimon ? (_ddx*_ddx + _ddy*_ddy < _mr * _mr) : _lxUndeadInReach(mn, tgt)) {'));
sub('spark', "        spawnSmoothImpact(_tcx, _tcy, '#9944cc');",
  J("        if (mn.mojimon) spawnSmoothImpact(_tcx, _tcy, '#9944cc');",
    "        else spawnSmoothImpact(Math.max(tgt.x, Math.min(tgt.x + tgt.w, mn.x + mn.w / 2)), Math.max(tgt.y, Math.min(tgt.y + tgt.h, mn.y + mn.h / 2)), '#9944cc');   // v0.30.623 summon-ai - where the blow lands"));

const grew = s.length - n0;
if (grew < 2000 || grew > 6000) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: summon AI - reach strike, body-aware jump, body-gap targeting, flank cap (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
