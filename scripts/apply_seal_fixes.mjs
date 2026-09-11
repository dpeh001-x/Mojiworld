// Seal fixes: revives are never blocked by the heal lock, and the heal lock and
// potion seal stop draining while the game is paused.
// =============================================================================
// Found by the debugging sweep (per user: "do a series of debugging, look for
// glitches ... look for any loopholes and inconsistencies thoroughly"); both are
// regressions from v0.30.588 (heal lock) and v0.30.297 (potion seal).
//
// 1. REVIVE UNDER THE HEAL LOCK. The lock is an accessor on player.hp that
//    refuses any write raising hp. _tryCheatDeathRevive restores hp by plain
//    assignment - Second Wind to 50%, Miracle Evasion and Phoenix Heart to 1 -
//    so under the lock the revive was SPENT, hp stayed 0, and because the revive
//    reported success the death path never ran either: the player sat at 0 HP,
//    downed with no banner and the world frozen until the lock lapsed (audit
//    control run: no lock -> 156 HP; locked -> 0). Gravitos comets come in
//    volleys and the first one seals, so this is how Second Wind normally
//    failed in that fight. A raise from 0 or below is a revive, not a heal: the
//    setter now lets it through.
//
// 2. SEALS DRAINED WHILE PAUSED. Both seals are timed on game.time, which the
//    main loop advances every frame BEFORE any pause gate (game.time++ then
//    `if (!game.paused ...)`). Audit: 660 paused frames ran a 600-frame heal
//    lock out and a 900-frame potion seal down to 236; the potion seal's own
//    comment says it "pauses with the game instead of draining behind a menu".
//    The Quest Journal (Q) and photo mode (O) pause mid-fight with no combat
//    check. While paused or in photo mode every live seal deadline - and the
//    grace / start marks the v0.30.614 and v0.30.621 caps read - now moves with
//    the clock, so the time left is exactly what it was when the menu opened.
//    The same clock ran two more timers out behind a pause: the 3 s potion
//    cooldown (a loophole - open a menu mid-fight and the cooldown is gone)
//    and Gravitos's one-hit-KO warning (unpausing mid-warning fired the strike
//    on the first frame, with no warning left). Both hold too. Photo mode
//    freezes the world (the loop's `frozen` gate), so it counts as paused.
//    Hit-stop (<= 150 ms) is left alone.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';   // a chain builds in a private copy
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) seal-fix/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. a raise from 0 or below is a revive ------------------------------------
sub('revive', "      if (typeof nv === 'number' && nv > _v && _lxHealLocked()) { player._healBlockedAt = game.time | 0; return; }",
  "      if (typeof nv === 'number' && nv > _v && _v > 0 && !window._lxHpRestore && _lxHealLocked()) { player._healBlockedAt = game.time | 0; return; }   // v0.30.633 seal-fix - a raise from 0 or below is a revive (Second Wind / Miracle / Phoenix), not a heal; _lxHpRestore = an undo of damage, not a heal");

// ---- 1a. the paused-player snapshot restore (v0.29.674 ghost statue) is an undo, not a heal -----
sub('ghost restore', "    if (_pSnap) { for (const _k in _pSnap) player[_k] = _pSnap[_k]; }",
  "    if (_pSnap) { window._lxHpRestore = true; try { for (const _k in _pSnap) player[_k] = _pSnap[_k]; } finally { window._lxHpRestore = false; } }   // v0.30.633 seal-fix - the undo passes the heal lock");

// ---- 1b. the lock refuses HP drinks only: Status Cure (clears poison / slow, no HP) and Warp pass --
sub('cure', "  if (typeof _lxHealLocked === 'function' && _lxHealLocked() && p.type !== 'mp') {",
  "  if (typeof _lxHealLocked === 'function' && _lxHealLocked() && (p.type === 'hp' || p.type === 'full')) {   // v0.30.633 seal-fix - only HP drinks are refused; Status Cure and Warp restore no HP");

// ---- 2. seals hold while paused ---------------------------------------------------
sub('pause hold', J('  game.time++;', '  if (_LX_PREWARM_Q.length) _lxPrewarmDrain();'),
  J('  game.time++;',
    '  // v0.30.633 seal-fix - the heal lock and the potion seal are timed on game.time, which this line advances every',
    '  // frame even while the game is paused (menus, photo mode), so a seal ran out behind a menu - though the seal\'s',
    '  // own comment promises it "pauses with the game". While paused, every live seal deadline (and the grace /',
    '  // start marks the seal caps read) moves with the clock, so the time left is what it was when the menu opened.',
    '  // Not in co-op: there a pause does not stop the world (v0.29.674 ghost statue), so every timer keeps running.',
    '  if ((game.paused || game._photoMode) && !(typeof _coopActive === \'function\' && _coopActive()) && typeof player !== \'undefined\' && player) {',
    '    const _sfT = game.time | 0;',
    '    if ((player._healLockUntil | 0) >= _sfT) {',
    '      player._healLockUntil = (player._healLockUntil | 0) + 1;',
    '      if (player._healLockStart != null) player._healLockStart = (player._healLockStart | 0) + 1;',
    '    }',
    '    if ((player._healLockNextAt | 0) > _sfT) player._healLockNextAt = (player._healLockNextAt | 0) + 1;',
    '    if ((player._potionLockUntil | 0) >= _sfT) player._potionLockUntil = (player._potionLockUntil | 0) + 1;',
    '    if ((player._potionSealNextAt | 0) > _sfT) player._potionSealNextAt = (player._potionSealNextAt | 0) + 1;',
    '    if ((player._potionCdHp | 0) > _sfT) player._potionCdHp = (player._potionCdHp | 0) + 1;',
    '    if ((player._potionCdMp | 0) > _sfT) player._potionCdMp = (player._potionCdMp | 0) + 1;',
    '    const _sfMs = game.monsters;',
    '    if (_sfMs) for (let _sfI = 0; _sfI < _sfMs.length; _sfI++) { const _sfM = _sfMs[_sfI]; if (_sfM && _sfM._ohkoWarnUntil != null && _sfM._ohkoWarnUntil > _sfT) _sfM._ohkoWarnUntil++; }',
    '  }',
    '  if (_LX_PREWARM_Q.length) _lxPrewarmDrain();'));

const grew = s.length - n0;
if (grew < 600 || grew > 3000) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: seal fixes - revive through the heal lock, seals hold while paused (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
