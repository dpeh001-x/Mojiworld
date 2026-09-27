// A down always shows the DOWNED card and reads 0 HP on the HUD (user report, 2026-09-27).
// ============================================================================
// Per user: "experienced a bug when I am downed it puts my HP as 1 instead of 0 and does not show the DOWNED UI HUD".
//   1) The HUD printed the held-at-1 HP (v0.29.944's invariant: downed = hp 1, so no death gate fires mid-window).
//      The number and the bar now read 0 while downed; the internal hp stays 1 (the invariant is untouched).
//   2) The DOWNED card never showed when _isOnboardingActive() was true - and one of its clauses is simply
//      "!player._tutorialSeen", so a character whose tour flag was never stamped counted as mid-onboarding FOREVER:
//      every down was the silent 5 s onboarding down (no card, hp 1 on the HUD, a quiet respawn). A down now counts
//      as onboarding only while the onboarding is actually on screen - the prologue, a story beat, or the tour card
//      itself - and the card stays silent only in the prologue and story beats (where it would sit over a cinematic).
//      During the tour the down keeps its short 5 s window but shows the card and its countdown.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxDownOnboarding(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// 1) HUD: 0 HP while downed (number + bar); the stat cache learns the downed flag so the number redraws on the change
once('const _hpPct = Math.max(0, Math.min(100, (player.hp / _safeMaxHp) * 100));',
  'const _hpPct = player._downed ? 0 : Math.max(0, Math.min(100, (player.hp / _safeMaxHp) * 100));   // v0.30.1248 downed-ui - a down reads 0 (hp is held at 1 inside)',
  'the HUD hp percent');
once('if (_sc.hp !== player.hp || _sc.mhp !== maxHp', 'if (_sc.hp !== player.hp || _sc.dn !== !!player._downed || _sc.mhp !== maxHp', 'the stat-cache test');
once('_sc.hp = player.hp; _sc.mhp = maxHp;', '_sc.hp = player.hp; _sc.dn = !!player._downed; _sc.mhp = maxHp;', 'the stat-cache write');
once("_uiSetText(d['hp-text'],  _fmtBig(Math.max(0, Math.ceil(player.hp)))",
  "_uiSetText(d['hp-text'],  _fmtBig(player._downed ? 0 : Math.max(0, Math.ceil(player.hp)))", 'the HUD hp text');

// 2) which downs are onboarding downs, and which of those stay silent
once('function _coopTryDowned() {', J(
  '// v0.30.1248 downed-ui - a down is an ONBOARDING down (short 5 s window, no revive) only while onboarding is on screen: the',
  '// prologue, a story beat, or the tour card itself. _isOnboardingActive() also answers yes for any character whose',
  "// _tutorialSeen was never stamped, which made every down silent for that character forever (no DOWNED card).",
  'function _lxDownOnboarding() {',
  '  try {',
  '    if (window._prologueActive || window._prologuePending) return true;',
  "    if (document.body && document.body.classList.contains('sb-active')) return true;",
  "    const tut = document.getElementById('tutorial-modal');",
  "    if (tut && !tut.hidden && getComputedStyle(tut).display !== 'none') return true;",
  '  } catch (e) {}',
  '  return false;',
  '}',
  '// v0.30.1248 downed-ui - the DOWNED card stays hidden only where it would sit over a cinematic (the prologue, a story beat).',
  'function _lxDownSilent() {',
  "  try { return !!(window._prologueActive || window._prologuePending || (document.body && document.body.classList.contains('sb-active'))); } catch (e) { return false; }",
  '}',
  'function _coopTryDowned() {'), 'the _coopTryDowned head');
once('  const _onboarding = _isOnboardingActive();', '  const _onboarding = _lxDownOnboarding();   // v0.30.1248 downed-ui - on screen, not "tour flag unset"', 'the onboarding read');
once('  player._downedSilent = _onboarding;', '  player._downedSilent = _onboarding && _lxDownSilent();   // v0.30.1248 downed-ui - the tour shows the card too', 'the silent flag');

const grew = s.length - n0;
if (grew < 1200 || grew > 3500) die('moved ' + grew);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) die('tmp small');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code);
}
console.log('applied: downed-ui (+' + grew + ' chars)');
