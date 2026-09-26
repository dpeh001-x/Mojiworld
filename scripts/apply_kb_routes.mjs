// Keybinds, part 2 of 2: every input path and every label follows the binds (keybind audit, 2026-09-26).
// ============================================================================
// Per user: "ensure keybinds work properly without any issue at all". The audit's remaining findings:
//   7) the skill bar's key labels only rebuilt on a class / job change (a rebind showed the old letter until reload),
//      and the Block slot always said A.
//   8) PHONE: the skill buttons' icon / cooldown sweep read KEY_TO_SLOT[the button's default key] while taps route
//      through KEY_TO_SLOT_DEFAULT -> SLOT_TO_KEY, so after a swap a button showed one skill and cast another; and
//      with a skill on PgDn the MP button cast the skill instead of drinking.
//   9) the HUD "K Hotkeys" chip faked a raw K press - dead once the Hotkeys panel's key was moved.
//  10) CONTROLLER skill buttons sent the pad map's default letters untranslated: Basic Attack moved to R -> pad X dead.
//  11) a focused DROPDOWN (sort, Settings, Studio, Compendium) let game hotkeys through: W opened the World Map.
//  12) digit / punctuation binds didn't fire with Shift (the Dash key) held: the browser reports '%' for Shift+5.
//  13) resetting binds while holding a rebound move key left the hero walking (keyup re-resolved through the new binds).
//  14) prompts with hard-coded keys: the in-world "N Talk" / "N Open" pills, the K panel's "Press K to toggle" and
//      "Press Q ... journal", and the HUD's K chip.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxSbSig(')) { console.log('already applied'); process.exit(0); }   // one tag ("keybinds") marks both halves, so each detects itself by its own helper
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
const each = (a, b, n, what) => { const c = s.split(a).length - 1; if (c !== n) die(what + ' matched ' + c + ' (want ' + n + ')'); s = s.split(a).join(b); };

// helpers, beside the keydown they serve
once("function _lxKeyHoldsSkill(k) { try { return !!(typeof KEY_TO_SLOT !== 'undefined' && KEY_TO_SLOT[k]); } catch (e) { return false; } }", J(
  "function _lxKeyHoldsSkill(k) { try { return !!(typeof KEY_TO_SLOT !== 'undefined' && KEY_TO_SLOT[k]); } catch (e) { return false; } }",
  '// v0.30.x keybinds - the key an ACTION is on, as a label (prompts, the skill bar\'s Block slot, the HUD chip)',
  'function _lxKeyLabel(action) {',
  "  const ab = (typeof player !== 'undefined' && player && player.actionBinds) || {};",
  "  const k = (ab[action] !== undefined) ? ab[action] : ((typeof ACTION_KEY_DEFAULT === 'object') ? ACTION_KEY_DEFAULT[action] : '');",
  "  return k ? ((typeof _kbDisplay === 'function') ? _kbDisplay(k) : String(k).toUpperCase()) : '\\u2014';",
  '}',
  "function _lxRefreshBindLabels() { try { document.querySelectorAll('[data-lx-bindlabel]').forEach((el) => { const t = _lxKeyLabel(el.getAttribute('data-lx-bindlabel')); if (el.textContent !== t) el.textContent = t; }); } catch (e) {} }",
  '// v0.30.x keybinds - Shift changes what e.key reports for digits and punctuation (Shift+5 = \'%\'), so with Shift held for',
  '// Dash a key bound to 5 or ; never fired. Read such a press as its UNSHIFTED key when that key is bound and the shifted one',
  '// is not. The unshifted characters come from the real keyboard layout when the browser can tell (US layout otherwise).',
  "const _LX_UNSHIFT = { Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5', Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9', Digit0: '0',",
  "  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\\\', Semicolon: ';', Quote: \"'\", Comma: ',', Period: '.', Slash: '/', Backquote: '`' };",
  "try { if (navigator.keyboard && navigator.keyboard.getLayoutMap) navigator.keyboard.getLayoutMap().then((m) => { for (const c of Object.keys(_LX_UNSHIFT)) { const v = m.get(c); if (v) _LX_UNSHIFT[c] = String(v).toLowerCase(); } }).catch(() => {}); } catch (e) {}",
  'function _lxKeyBound(x) {',
  '  if (!x) return false;',
  "  if (typeof KEY_TO_SLOT !== 'undefined' && KEY_TO_SLOT[x]) return true;",
  "  if (typeof player === 'undefined' || !player) return false;",
  "  if ((player.cureKey || 'shift') === x || player.interactKey === x) return true;",
  '  const ab = player.actionBinds || {};',
  '  for (const a in ACTION_KEY_DEFAULT) { if (((ab[a] !== undefined) ? ab[a] : ACTION_KEY_DEFAULT[a]) === x) return true; }',
  '  return false;',
  '}',
  'function _lxUnshifted(e) {',
  "  const k = String((e && e.key) || '').toLowerCase();",
  '  if (!e || !e.shiftKey || !e.code) return k;',
  '  const u = _LX_UNSHIFT[e.code];',
  '  if (!u || u === k) return k;',
  '  return (_lxKeyBound(u) && !_lxKeyBound(k)) ? u : k;',
  '}'), 'the keydown helpers anchor');

// 12) + 13) keydown: the unshifted key, and remember which game key each physical key set
once("  if (e && e.code) (window._lxDownByCode = window._lxDownByCode || {})[e.code] = String(e.key || '').toLowerCase();",
  "  if (e && e.code) (window._lxDownByCode = window._lxDownByCode || {})[e.code] = _lxUnshifted(e);   // v0.30.x keybinds - the key as the game reads it", 'the keydown code record');
once(J('  const rawKey = e.key.toLowerCase();', "  if (e.isTrusted && typeof _lxNoteInput === 'function') _lxNoteInput('kb');"),
  J('  const rawKey = _lxUnshifted(e);   // v0.30.x keybinds - Shift+5 reads as 5 when 5 is bound (Dash is Shift)', "  if (e.isTrusted && typeof _lxNoteInput === 'function') _lxNoteInput('kb');"), 'the keydown rawKey');
once(J('  const k = resolved;', '  const repeat = e.repeat;', '  game.keys[k] = true;'), J(
  '  const k = resolved;', '  const repeat = e.repeat;', '  game.keys[k] = true;',
  "  if (e.code) (window._lxDownResByCode = window._lxDownResByCode || {})[e.code] = k;   // v0.30.x keybinds - keyup clears exactly this (a rebind mid-hold left the hero walking)"),
  'the keydown game.keys set');
once('    if (_dc) delete _dc[e.code]; } catch (_e) {}', J(
  '    if (_dc) delete _dc[e.code];',
  "    const _dr2 = e.code && window._lxDownResByCode; if (_dr2 && _dr2[e.code] && typeof game !== 'undefined' && game && game.keys) { game.keys[_dr2[e.code]] = false; delete _dr2[e.code]; }   // v0.30.x keybinds",
  '  } catch (_e) {}'), 'the keyup release');

// 11) dropdowns are typing too
each("e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable",
  "e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable", 4, 'the typing guards');

// 7) the skill bar follows the binds
once("  const bs = _sbMakeSlot('skill-slot defense', 'A', _SB_SHIELD_ICON, blockTitle);",
  "  const bs = _sbMakeSlot('skill-slot defense', _lxKeyLabel('block'), _SB_SHIELD_ICON, blockTitle);   // v0.30.x keybinds - was always 'A'", 'the Block slot');
once('  _sbBuiltFor = `${player.cls}|${player.job}|${player.master}`;', J(
  '  _sbBuiltFor = _lxSbSig();',
  "  if (typeof _lxRefreshBindLabels === 'function') _lxRefreshBindLabels();"), 'the _sbBuild signature');
once('  const signature = `${player.cls}|${player.job}|${player.master}`;', '  const signature = _lxSbSig();', 'the renderSkillBar signature');
once('function _sbBuild() {', J(
  '// v0.30.x keybinds - the skill bar rebuilds when a key bind changes too (its labels froze until a class change or reload)',
  "function _lxSbSig() { let b = ''; try { for (const sl in SLOT_TO_KEY) b += sl + SLOT_TO_KEY[sl] + ','; } catch (e) {} const ab = (player && player.actionBinds) || {}; return `${player.cls}|${player.job}|${player.master}|${b}|${ab.block || ''}|${ab.characterK || ''}`; }",
  'function _sbBuild() {'), 'function _sbBuild');

// 8) phone: the sweep reads the button's slot the way its tap does; the potion buttons drink
once(J('      const slot = KEY_TO_SLOT[k];', '      if (!slot) continue;'), J(
  "      const slot = (typeof KEY_TO_SLOT_DEFAULT === 'object' && KEY_TO_SLOT_DEFAULT[k]) || KEY_TO_SLOT[k];   // v0.30.x keybinds - the button's slot, as its tap resolves it",
  '      if (!slot) continue;'), 'the deck cooldown sweep');
once('function _mkeyDispatch(type, k) {', J(
  'function _mkeyDispatch(type, k) {',
  "  // v0.30.x keybinds - the deck's HP / MP buttons ARE the potions: with a skill on PgUp / PgDn the keyboard's skill",
  '  // precedence cast the skill instead of drinking',
  "  if ((k === 'pageup' || k === 'pagedown') && typeof KEY_TO_SLOT !== 'undefined' && KEY_TO_SLOT[k]) {",
  "    if (type === 'keydown' && typeof _useBoundPotion === 'function' && typeof game !== 'undefined' && !game.paused && player && player.hp > 0) _useBoundPotion(k);   /* the K > Potions choice for that key, as the keyboard uses it */",
  '    return;',
  '  }'), 'function _mkeyDispatch');

// 9) the HUD chip opens the panel itself
once(J("    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));", "    window.dispatchEvent(new KeyboardEvent('keyup',   { key: 'k' }));", '  });', '})();'), J(
  "    if (typeof toggleKeybindModal === 'function') { toggleKeybindModal(); return; }   // v0.30.x keybinds - a faked K press was dead once the panel's key moved",
  "    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));",
  "    window.dispatchEvent(new KeyboardEvent('keyup',   { key: 'k' }));",
  '  });',
  '})();'), 'the HUD K chip');

// 10) controller skill buttons follow the skill binds (as the phone deck does)
once('  if (spec.k) return spec.k;', J(
  "  if (spec.k) {   // v0.30.x keybinds - a pad SKILL button follows its slot to the slot's current key (Basic Attack moved to R -> pad X is R)",
  "    const _sl = (typeof KEY_TO_SLOT_DEFAULT === 'object') && KEY_TO_SLOT_DEFAULT[spec.k];",
  "    if (_sl && typeof SLOT_TO_KEY === 'object' && SLOT_TO_KEY[_sl]) return ('' + SLOT_TO_KEY[_sl]).toLowerCase();",
  '    return spec.k;',
  '  }'), 'the pad key resolve');

// 14) labels that say the real key
each("'N', 'Open'", "_lxKeyLabel('talkNpc'), 'Open'", 2, 'the Open pills');
once("'N', 'Talk'", "_lxKeyLabel('talkNpc'), 'Talk'", 'the Talk pill');
once('            Keyboard Remap \u00b7 Press K to toggle', '            Keyboard Remap \u00b7 Press <span data-lx-bindlabel="characterK">K</span> to toggle', 'the K panel header');
once('Press <kbd>Q</kbd> any time to open the journal.', 'Press <kbd data-lx-bindlabel="questJournal">Q</kbd> any time to open the journal.', 'the K panel journal line');
once('    <kbd>K</kbd>Hotkeys &amp; Skills', '    <kbd data-lx-bindlabel="characterK">K</kbd>Hotkeys &amp; Skills', 'the HUD K chip label');
once('function renderKbmReference() {', J('function renderKbmReference() {', "  if (typeof _lxRefreshBindLabels === 'function') _lxRefreshBindLabels();   // v0.30.x keybinds"), 'renderKbmReference');

const grew = s.length - n0;
if (grew < 4000 || grew > 11000) die('size moved ' + grew);
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
console.log('applied: kb-routes (+' + grew + ' chars)');
