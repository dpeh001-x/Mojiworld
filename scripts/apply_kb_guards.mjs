// Keybinds, part 1 of 2: one set of rules for which keys a bind may take (keybind audit, 2026-09-26).
// ============================================================================
// Per user: "ensure keybinds work properly without any issue at all". An exhaustive audit found the four pickups
// (action chips, skill chips, the Keyboard-tab drop, and the Cure / Pickup chips) each checking a different list:
//   1) the KEYBOARD-TAB DROP checked nothing but Esc: a skill dropped on Space both jumped and cast; on W, Enter or K
//      it opened a panel and never cast; on a moved action's old key it never cast at all.
//   2) the skill chip waved Shift / PgUp / PgDn through every check - fine while Dash / the potions still sit there
//      (the skill's precedence guard wins), but once that action moved away the key is its neutralised old default
//      and the skill never cast ("Bound skill -> Shift", then nothing).
//   3) the Cure and Pickup keys were invisible to the action and skill pickups: Cure on R + Move Left on R walked AND
//      burned a Remedy on every press; Pickup on R + Jump on R jumped and opened chests; a skill on the Cure key
//      silently killed Cure.
//   4) a Pickup key on a moved action's old key did nothing (the keydown bails on neutralised keys before it).
//   5) the action / Cure / Pickup pickups accepted E, O, H, J, ` and the digits - keys the interface owns (photo mode,
//      the quest guide, MojiMon, the journal alias, emotes) - so World Map on O took photo mode's key.
//   6) Mute could never go back to M ("reserved by the interface").
// Now: one reserved list (_LX_UI_KEYS) for every pickup, except that an action may always return to its OWN default;
// one skill-key check (_lxSkillKeyProblem) shared by the skill chip and the Keyboard-tab drop; and the action / Cure /
// Pickup checks each know the others' keys. Every refusal says who owns the key.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxSkillKeyProblem(')) { console.log('already applied'); process.exit(0); }   // one tag ("keybinds") marks both halves, so each detects itself by its own helper
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// the shared rules, ahead of the pickups
once('(function _wireActionPickup() {', J(
  '// v0.30.1163 keybinds - ONE list of the keys the interface owns, for every pickup (the four used to disagree): Enter / Esc /',
  '// P / T / I / M / 9 / 0 as before, plus the hard-coded E (quest guide), O (photo mode), H (MojiMon), J (journal alias),',
  '// ` and the digits 1-8. An action may still take back its OWN default (Mute on M).',
  "const _LX_UI_KEYS = ['enter', 'escape', 'p', 't', 'i', 'm', '9', '0', '1', '2', '3', '4', '5', '6', '7', '8', 'e', 'o', 'h', 'j', '`'];",
  "function _lxUiKeyFor(k, action) { return _LX_UI_KEYS.indexOf(k) >= 0 && !(action && typeof ACTION_KEY_DEFAULT === 'object' && ACTION_KEY_DEFAULT[action] === k); }",
  '// v0.30.1163 keybinds - may this key hold a SKILL? null = yes, else who owns it. Shared by the skill chip and the Keyboard-tab drop.',
  '//   another skill\'s key: yes (a swap) | an interface key, the Cure key: no | an action\'s key: no - except Shift / PgUp / PgDn',
  '//   while their OWN action (Dash / the potions) is still there (the skill precedence guard wins) | a moved action\'s old key: no',
  '//   (the keydown neutralises it before skills are looked up, so the skill would never cast).',
  'function _lxSkillKeyProblem(k) {',
  "  if (!k || (typeof KB_NONBINDABLE !== 'undefined' && KB_NONBINDABLE.has(k))) return 'the interface';",
  "  if (typeof KEY_TO_SLOT !== 'undefined' && KEY_TO_SLOT[k]) return null;",
  "  if (_LX_UI_KEYS.indexOf(k) >= 0) return 'the interface';",
  "  const ab = (typeof player !== 'undefined' && player && player.actionBinds) || {};",
  '  for (const a in ACTION_KEY_DEFAULT) {',
  '    const cur = (ab[a] !== undefined) ? ab[a] : ACTION_KEY_DEFAULT[a];',
  "    if (cur === k) return ((k === 'shift' || k === 'pageup' || k === 'pagedown') && ACTION_KEY_DEFAULT[a] === k) ? null : a;",
  '  }',
  "  // the Cure key (an unset one is Shift - Reset deletes it) - checked after the Shift / Dash allowance above, since a skill on",
  "  // the default Shift is designed to win over both Dash and Cure; a Cure key of its own is Cure's alone",
  "  if (typeof player !== 'undefined' && player && (player.cureKey || 'shift') === k) return 'Cure';",
  "  if (typeof _isStaleDefault === 'function' && _isStaleDefault(k)) return 'a moved action (its old key stays silent)';",
  '  return null;',
  '}',
  '(function _wireActionPickup() {'), 'the action pickup IIFE');

// 5) + 6) the action pickup: the shared list, but its own default is always fine
once(J("      const _RESERVED = ['enter', 'escape', 'p', 't', 'i', 'm', '9', '0'];", '      if (_RESERVED.indexOf(k) >= 0) {'),
  J('      // v0.30.1163 keybinds - the shared list (+ E / O / H / J / ` / 1-8); an action may take back its own default (Mute on M)',
    '      if (_lxUiKeyFor(k, _actionPickup)) {'), 'the action pickup reserved list');
// 3) the action pickup knows the Cure and Pickup keys
once(J('    // Apply the new binding.', '    if (!player.actionBinds) player.actionBinds = { ...ACTION_KEY_DEFAULT };'), J(
  '    // v0.30.1163 keybinds - the Cure and Pickup keys live outside actionBinds: an action on one of them fired both (Move Left',
  '    // on the Cure key walked AND burned a Remedy). Refused - an action returning to its own default (Dash on Shift) excepted.',
  '    { const _own = ((player.cureKey || \'shift\') === k && ACTION_KEY_DEFAULT[_actionPickup] !== k) ? \'Cure\'   /* an unset Cure key is Shift (Reset deletes it) */',
  "        : (player.interactKey && player.interactKey === k && ACTION_KEY_DEFAULT[_actionPickup] !== k) ? 'Open Chest / Pickup' : null;",
  "      if (_own) { ev.preventDefault(); ev.stopPropagation(); showToast('\\u26A0 ' + _kbDisplay(k) + ' belongs to ' + _own + ' \\u2014 pick another', 'common');",
  "        _actionPickup = null; renderKbmReference(); if (typeof _kbRenderPotionBinds === 'function') _kbRenderPotionBinds(); return; } }",
  '    // Apply the new binding.',
  '    if (!player.actionBinds) player.actionBinds = { ...ACTION_KEY_DEFAULT };'), 'the action pickup apply');

// 5) + 3) + 4) the Cure / Pickup check: the shared list, each other's key, effective action binds; Pickup refuses a moved
// action's old key (the keydown drops those before the chest line)
once("function _lxKeyClaimedBy(k, allowSkill) {", "function _lxKeyClaimedBy(k, allowSkill, self) {   // v0.30.1163 keybinds - self: 'cure' | 'interact'", '_lxKeyClaimedBy signature');
once("  if (['enter', 'escape', 'p', 't', 'i', 'm', '9', '0'].indexOf(k) >= 0) return 'the interface';", J(
  "  if (_LX_UI_KEYS.indexOf(k) >= 0) return 'the interface';   // v0.30.1163 keybinds - the shared list",
  "  if (self !== 'cure' && typeof player !== 'undefined' && player && (player.cureKey || 'shift') === k) return 'Cure';   // an unset Cure key is Shift",
  "  if (self !== 'interact' && typeof player !== 'undefined' && player && player.interactKey && player.interactKey === k) return 'Open Chest / Pickup';",
  "  if (self === 'interact' && typeof _isStaleDefault === 'function' && _isStaleDefault(k)) return 'a moved action (its old key stays silent)';",
  "  { const _ab = (typeof player !== 'undefined' && player && player.actionBinds) || {}; for (const a in ACTION_KEY_DEFAULT) { if (self === 'cure' && a === 'dodge' && k === 'shift') continue;   /* Cure shares Shift with Dash by design - it can go home */",
  "    const cur = (_ab[a] !== undefined) ? _ab[a] : ACTION_KEY_DEFAULT[a]; if (cur && String(cur).toLowerCase() === k) return a; } }"),
  '_lxKeyClaimedBy reserved line');
// the old trailing loop read only explicit binds and knew nothing of Cure sharing Shift with Dash: the loop above replaces it
once(J("  const ab = (typeof player !== 'undefined' && player && player.actionBinds) || ((typeof ACTION_KEY_DEFAULT !== 'undefined') ? ACTION_KEY_DEFAULT : {});",
  "  for (const a in ab) if (String(ab[a] || '').toLowerCase() === k) return a;"),
  '  // v0.30.1163 keybinds - (the action check moved up: effective binds, and Cure may share Shift with Dash)', "_lxKeyClaimedBy's old action loop");
once('_lxKeyClaimedBy(k, false)', "_lxKeyClaimedBy(k, false, 'cure')", 'the Cure pickup call');
once('_lxKeyClaimedBy(k, true)', "_lxKeyClaimedBy(k, true, 'interact')", 'the Pickup pickup call');

// 1) + 2) the skill chip: the shared check
{
  const START = "    if (k !== 'pageup' && k !== 'pagedown' && k !== 'shift' && !(typeof KEY_TO_SLOT !== 'undefined' && KEY_TO_SLOT[k])) {";
  const END = '    if (!player.keybinds) player.keybinds = { ...KEY_TO_SLOT_DEFAULT };';
  const a = s.indexOf(START), b = s.indexOf(END, a);
  if (a < 0 || s.indexOf(START, a + 1) >= 0 || b < 0 || b - a > 3000) die('the skill pickup check block not found cleanly');
  s = s.slice(0, a) + J(
    '    // v0.30.1163 keybinds - the shared skill-key check (it also covers Shift / PgUp / PgDn once their own action has moved,',
    '    // the Cure key, and a moved action\'s old key); the Keyboard-tab drop now asks the same question',
    '    { const _why = _lxSkillKeyProblem(k);',
    "      if (_why) { if (typeof showToast === 'function') showToast('\\u26A0 ' + _kbDisplay(k) + ' belongs to ' + _why + ' \\u2014 pick another', 'common');",
    "        _skillPickup = null; if (typeof renderKbmReference === 'function') renderKbmReference(); if (typeof renderKeybindKeyboard === 'function') renderKeybindKeyboard(); return; } }",
    '') + s.slice(b);
}
// 1) the Keyboard-tab drop
once(J('  if (!isBindable) {', "    showToast('That key isn\\'t bindable for skills', 'common');", '    return;', '  }'), J(
  '  if (!isBindable) {', "    showToast('That key isn\\'t bindable for skills', 'common');", '    return;', '  }',
  "  { const _why = _lxSkillKeyProblem(lk);   // v0.30.1163 keybinds - the drop used to accept anything but Esc",
  "    if (_why) { showToast('\\u26A0 ' + _kbDisplay(lk) + ' belongs to ' + _why + ' \\u2014 pick another', 'common'); return; } }"), 'onKeybindKeyClick bindable check');

const grew = s.length - n0;
if (grew < 2500 || grew > 8000) die('size moved ' + grew);
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
console.log('applied: kb-guards (+' + grew + ' chars)');
