// Combat fixes from the bug hunt (2026-09-26).
// ============================================================================
// 1) THE MAGE'S UP-WARP IGNORED FREEZE AND STUN. The double-tap branch (arrows -> dash, up x2 -> the mage's warp)
//    only checked hitStun, then called castSkill('blink'), which checks no crowd control either: a frozen or
//    stunned mage double-tapped up and blinked ~160 px, paying MP and cooldown, while the keyed blink in the same
//    state was refused. v0.30.919 gave quickDash and tryPortal the _lxPlayerHeld() guard; this branch was missed.
// 2) SIEGE VOLLEY SURVIVED A STAGGER. Its description (and its tick's comment) says it "ends early if MP runs out
//    or you are staggered", but the stagger test sat below updatePlayer's hit-stun early return, so it could never
//    be true - a stagger only paused the volley, which then kept firing. The hit-stun branch now ends it.
// 3) THE ZOMBIE'S POISON CLOUD ALWAYS LANDED ON THE FLOOR. poisonCloud pinned the puddle at y=470, so a zombie up
//    on a platform (the tower spawns most of its mobs on them) poisoned the floor ~170 px below and never the player
//    fighting it. It now lands at the zombie's feet, like shockwave.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) combat-fixes/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
if (!s.includes('function _lxPlayerHeld() {')) die('no _lxPlayerHeld');

// 1) the double-tap branch honours freeze / stun / downed / QTE
const TAP = J(
  "    (k === 'arrowleft' || k === 'arrowright' || (k === 'arrowup' && player.cls === 'mage')) &&",
  '    !game.paused && player.hp > 0 && player.hitStun <= 0',
  '  ) {');
once(TAP, J(
  "    (k === 'arrowleft' || k === 'arrowright' || (k === 'arrowup' && player.cls === 'mage')) &&",
  '    !game.paused && player.hp > 0 && player.hitStun <= 0 &&',
  "    !(typeof _lxPlayerHeld === 'function' && _lxPlayerHeld())   // v0.30.1134 combat-fixes - a frozen / stunned mage could double-tap-warp (quickDash + tryPortal already had this)",
  '  ) {'), 'the double-tap branch');

// 2) a stagger ends Siege Volley
const STUN = J(
  '  const stunned = player.hitStun > 0;',
  '  if (stunned) {',
  '    _lxTickPlayerTimers(dt);   // v0.30.x \u2014 CC does not stop the clock');
once(STUN, J(
  '  const stunned = player.hitStun > 0;',
  '  if (stunned) {',
  '    // v0.30.1134 combat-fixes - "ends early if ... you are staggered": the volley\'s own stagger test sits below this return and',
  '    // could never fire, so a stagger only paused the channel. End it here.',
  '    if (player._ballistaChannel) player._ballistaChannel = null;',
  '    _lxTickPlayerTimers(dt);   // v0.30.x \u2014 CC does not stop the clock'), 'the hit-stun branch');

// 3) the zombie's puddle at its feet
once("      cx: px, x: px - 38, y: 470, w: 76, h: 18,",
  "      cx: px, x: px - 38, y: m.y + m.h - 10, w: 76, h: 18,   // v0.30.1134 combat-fixes - at the caster's feet (was y 470: the floor, even under a zombie on a platform)",
  'the poisonCloud hazard');

const grew = s.length - n0;
if (grew < 400 || grew > 1400) die('size moved ' + grew);
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
console.log('applied: combat-fixes (+' + grew + ' chars)');
