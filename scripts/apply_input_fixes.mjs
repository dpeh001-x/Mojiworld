// Input + audio fixes from the second bug hunt (2026-09-26).
// ============================================================================
// 1) A SKILL ON E, O OR H ALSO FIRED THE KEY'S OWN ACTION (the quest-guide step, photo mode, MojiMon summon): the
//    skill pickup refused J / P / T / Enter / 1-9 but not these three hard-coded keys. They are refused now, and a
//    skill already bound to one of them (an older save) wins the key instead of firing both.
// 2) A SKILL ON AN ACTION'S OLD KEY NEVER CAST. Move Jump to R, then put a skill on Space: the pickup said "Bound
//    skill -> Space", but the keydown handler neutralises a remapped action's old default before the skill lookup
//    runs, so the skill was dead on every input (the phone's too). The pickup now refuses such a key, as its own
//    comment says it meant to.
// 3) MOVEMENT STUCK ON AFTER A SHIFTED RELEASE. Keydown and keyup read e.key, which Shift changes ('.' -> '>'):
//    hold a punctuation-bound Move Right, press Shift (dash), let go of '.', and the keyup cleared the wrong key -
//    the hero walked on until '.' was tapped again. The keyup now also releases whatever went down on that
//    physical key (e.code).
// 4) SFX AT 0% STILL PLAYED FOOTSTEPS AND DIALOGUE BLIPS: both are synthesised straight to the speakers and never
//    read the SFX volume (only full Mute stopped them). They follow it now.
// 5) SFX SET TO 0 AT THE START OF A SESSION CAME BACK. The first click warms every menu clip up at volume 0 and
//    then restored the volume it had saved - which, when the slider moved first, was the old one (a level-up
//    played at 0.6 with SFX at 0). It restores the clip's level at the CURRENT SFX setting.
// 6) PHONE: F BESIDE A CHEST DID NOTHING WITH A REBOUND PICKUP KEY OR F SKILL. The button sent a literal 'f', which
//    the phone's key translation rewrote to the Q skill's key while the chest handler waits for the Pickup key.
//    Beside a chest the button now opens it directly.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) input-fixes/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
if (!s.includes('function _isStaleDefault(physicalKey) {')) die('no _isStaleDefault');

// 1) + 2) the skill pickup refuses E / O / H / ` and a remapped action's old default
once("      const _HUD = ['9','0','p','j','i','m','enter','1','2','3','4','5','6','7','8','t'];",
  "      const _HUD = ['9','0','p','j','i','m','enter','1','2','3','4','5','6','7','8','t','e','o','h','`'];   // v0.30.1153 input-fixes - + E (quest guide), O (photo), H (MojiMon): hard-coded keys that also fired",
  'the skill pickup _HUD list');
once('      if (!_claimed && _HUD.indexOf(k) >= 0) _claimed = true;', J(
  '      if (!_claimed && _HUD.indexOf(k) >= 0) _claimed = true;',
  "      if (!_claimed && typeof _isStaleDefault === 'function' && _isStaleDefault(k)) _claimed = true;   // v0.30.1153 input-fixes - a remapped action's old key is neutralised before skills are looked up: a skill there never cast"),
  'the skill pickup claimed test');
// 1b) a skill already on E / O / H wins the key
once('window.addEventListener(\'keydown\', e => {', J(
  '// v0.30.1153 input-fixes - a key that holds a skill is the skill\'s (a bind made before E / O / H were refused fired both)',
  "function _lxKeyHoldsSkill(k) { try { return !!(typeof KEY_TO_SLOT !== 'undefined' && KEY_TO_SLOT[k]); } catch (e) { return false; } }",
  "window.addEventListener('keydown', e => {",
  "  if (e && e.code) (window._lxDownByCode = window._lxDownByCode || {})[e.code] = String(e.key || '').toLowerCase();   // v0.30.1153 input-fixes - what went down on this physical key (see keyup)"),
  'the keydown listener');
once("  if (k === 'e') {", "  if (k === 'e' && !_lxKeyHoldsSkill(k)) {   /* v0.30.1153 input-fixes */", "the E handler");
once("  if (k === 'o') { if (!e.repeat && typeof togglePhotoMode === 'function') togglePhotoMode(); e.preventDefault(); return; }",
  "  if (k === 'o' && !_lxKeyHoldsSkill(k)) { if (!e.repeat && typeof togglePhotoMode === 'function') togglePhotoMode(); e.preventDefault(); return; }", 'the O handler');
once("  if (k === 'h') { if (typeof _mojimonQuickSummon === 'function') _mojimonQuickSummon(); return; }",
  "  if (k === 'h' && !_lxKeyHoldsSkill(k)) { if (typeof _mojimonQuickSummon === 'function') _mojimonQuickSummon(); return; }", 'the H handler');

// 3) keyup releases what went down on the physical key
once("window.addEventListener('keyup', e => {", J(
  "window.addEventListener('keyup', e => {",
  "  // v0.30.1153 input-fixes - Shift changes e.key ('.' -> '>'): a key pressed plain and released under Shift came up as a different",
  '  // key and stayed held (the hero walked on). Release whatever went DOWN on this physical key too.',
  "  try { const _dc = e.code && window._lxDownByCode; const _dk = _dc && _dc[e.code];",
  "    if (_dk && typeof game !== 'undefined' && game && game.keys) { game.keys[_dk] = false; const _dr = (typeof _resolveActionKey === 'function') ? _resolveActionKey(_dk) : _dk; if (_dr) game.keys[_dr] = false; }",
  '    if (_dc) delete _dc[e.code]; } catch (_e) {}'), 'the keyup listener');

// 4) footsteps and dialogue blips follow the SFX volume
once(J('      g.gain.setValueAtTime(0.04, c.currentTime);', '      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.045);'), J(
  "      const _bv = 0.04 * ((typeof _SFX_MASTER_VOL === 'number') ? _SFX_MASTER_VOL : 1);   // v0.30.1153 input-fixes - the SFX volume (0 = silent)",
  '      if (!(_bv > 0)) { try { o.disconnect(); g.disconnect(); } catch (e) {} return; }',
  '      g.gain.setValueAtTime(_bv, c.currentTime);',
  '      g.gain.exponentialRampToValueAtTime(Math.min(0.001, _bv * 0.5), c.currentTime + 0.045);'), 'the dialogue blip gain');
once('    const vol = tone[3] * Math.max(0.35, Math.min(1, strength || 1));', J(
  "    const vol = tone[3] * Math.max(0.35, Math.min(1, strength || 1)) * ((typeof _SFX_MASTER_VOL === 'number') ? _SFX_MASTER_VOL : 1);   // v0.30.1153 input-fixes - the SFX volume",
  '    if (!(vol > 0)) { try { src.disconnect(); flt.disconnect(); } catch (e) {} return; }'), 'the footstep volume');

// 5) the first-click warm-up restores at the current SFX level
const LVL = "(typeof el._sfxBase === 'number' && typeof _SFX_MASTER_VOL === 'number') ? el._sfxBase * _SFX_MASTER_VOL : _origVol";
once('            try { el.pause(); el.currentTime = 0; el.volume = _origVol; } catch (_) {}',
  `            try { el.pause(); el.currentTime = 0; el.volume = ${LVL}; } catch (_) {}   // v0.30.1153 input-fixes - today's SFX level, not the one saved before a slider move`,
  'the warm-up restore');
once('            try { el.volume = _origVol; } catch (_) {}', `            try { el.volume = ${LVL}; } catch (_) {}`, 'the warm-up failed-restore');

// 6) phone F beside a chest opens it directly
once(J('    active = true;', '    activeKey = pick();'), J(
  "    if (fState() === 'interact' && chestNear() && typeof tryInteract === 'function') { try { tryInteract('chest'); } catch (e) {} return; }   // v0.30.1153 input-fixes - a literal 'f' was rewritten to the Q skill's key; the chest waits for the Pickup key",
  '    active = true;',
  '    activeKey = pick();'), 'the F button press');

const grew = s.length - n0;
if (grew < 2000 || grew > 6000) die('size moved ' + grew);
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
console.log('applied: input-fixes (+' + grew + ' chars)');
