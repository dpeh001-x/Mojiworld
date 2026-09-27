// UI text fixes: text that overlapped, clipped, or named keys a phone does not have (UI + new-player audits, 2026-09-27).
// ============================================================================
// Builds on phone-fit (v0.30.1182), which already made character creation, the jukebox, the Ascend pill, the title menu,
// the journal chips, the Reforge Bench and the U panel header fit a phone. What was left:
//   1) the tour card sat ON TOP of the panels it sends you into. While U or Q was open the card went "ghost" (faded), but
//      its Skip / Back / Next row, its fold handle and its key chips stayed solid over the panel's content. Now the card
//      steps aside completely while a panel is open, and comes back the moment the panel closes. Objectives still tick
//      while it is hidden; the 15 s countdown before the next step (v0.30.1188) waits until the card is back, so no step
//      goes by unread.
//   2) the tour's step name in the card's corner was cut to "LEVEL UP & ALLOCATE POI..." - it wraps to a second line now.
//   3) phones were told "Press W to close" (world map), "press Y to close" (MojiDex), "Press U to close" (U panel) and
//      "Enter send, Esc cancel" (chat). On a touch screen (the phone deck's own test: a coarse pointer or a narrow window)
//      they say "Tap X to close" (each panel has an X) and "tap Send"; a controller still gets its B glyph, a desktop the key.
//   4) the Compendium's "A Bestiary of Everdawn" sticker sat on its "0 / 131 catalogued - 0 felled" count on a phone:
//      when the header is narrow, the count drops to its own line under the sticker.
//   5) character creation on a short screen: Guguma's bubble ran into the "Choose your story" banner (the bubble is
//      nudged 12 px down from its slot), and the intro's em dash wrapped onto a line by itself.
//   6) the shop said "Your Mojicoins: 1000000000" (so did the forge, the crafting bench and the taxi); they read
//      1,000,000,000 now. A long name in the "Welcome, <name>!" toast ran out of the toast; long words wrap inside it.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxCloseHint(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// ---- the stylesheet: one new block after the last head-level sheet (phone-fit's) ----
const CSS = J(
  '<style id="lx-ui-text-fixes-css">',
  '  /* v0.30.1193 ui-text-fixes - 1) while a panel is open the tour card steps aside entirely (ghosted, its nav row, fold handle and',
  '     key chips still drew over the panel). The ghost watch clears the class when the panel closes, and the card is back. */',
  '  #tutorial-modal#tutorial-modal.tut-dock.tut-ghost, #tutorial-modal#tutorial-modal.tut-dock.tut-ghost * { visibility: hidden !important; }',
  '  /* v0.30.1193 ui-text-fixes - 2) the step name in the card\'s corner wraps to a second line instead of ending in "..." */',
  '  #tutorial-modal#tutorial-modal#tutorial-modal.tut-dock:not(.tut-collapsed) #tut-step-title { white-space: normal; text-overflow: clip; overflow-wrap: break-word; text-wrap: balance; }',
  '  /* v0.30.1193 ui-text-fixes - 4) a narrow Compendium header: the count gets its own line under the sticker instead of sitting on it */',
  '  #mojidex-modal .mjx-head { container-type: inline-size; }',
  '  @container (max-width: 940px) { #mojidex-modal .mjx-head .mjx-count { position: static; display: block; width: fit-content; max-width: 100%; margin: 9px 0 0 6px; text-align: left; } }',
  '  /* v0.30.1193 ui-text-fixes - 5) a short screen: the banner starts below Guguma\'s bubble (the bubble sits 12 px below its slot) */',
  '  @media (max-height: 500px) { #class-select-modal#class-select-modal .modal.cs-epic > h2.cs-title { margin-top: 14px !important; } }',
  '  /* v0.30.1193 ui-text-fixes - 6) a word longer than the toast (a 16-letter name) wraps inside it instead of running out of the stack */',
  '  #toast-container .toast { overflow-wrap: anywhere; }',
  '</style>',
  '<div id="char-studio-overlay">');
once('<div id="char-studio-overlay">', CSS, 'the char-studio overlay (style anchor)');

// ---- 1b) a step that ticks while the card is hidden under a panel keeps its 15 s read (v0.30.1188): the countdown waits ----
once("        if (--_left > 0) { _nbLabel(); return; }", J(
  "        if (_md.classList.contains('tut-ghost')) return;   // v0.30.1193 ui-text-fixes - hidden under an open panel: the 15 s read waits for the card",
  "        if (--_left > 0) { _nbLabel(); return; }"), 'the tour advance countdown');

// ---- 3) the close hints: one helper for the fixed footers, the U panel header and the chat bar ----
once(J('// the HUD strip and the hotkey hint keep their keyboard markup and re-render from it', 'function _lxRefreshPrompts() {'), J(
  '// v0.30.1193 ui-text-fixes - "PRESS W TO CLOSE" ON A PHONE. The fixed close hints (world map, MojiDex, U panel) and the chat',
  '// bar named keys a touch screen does not have. On a touch screen - the phone deck\'s own test (_isMobileClient: a coarse',
  '// pointer or a narrow window) - they say "Tap \u2715 to close" (each of those panels has its \u2715) and "tap Send" (the phone',
  '// keyboard\'s Send key sends). A controller keeps its B glyph (_lxPadKeys) and a desktop keeps the key.',
  'function _lxTouchHints() {',
  "  if (typeof _lxInputDevice !== 'undefined' && _lxInputDevice === 'pad') return false;",
  "  try { return typeof _isMobileClient === 'function' && !!_isMobileClient(); } catch (e) { return false; }",
  '}',
  'function _lxCloseHint(s) {',
  "  if (typeof _lxInputDevice !== 'undefined' && _lxInputDevice === 'pad') return _lxPadKeys(s);",
  "  if (typeof s !== 'string' || !_lxTouchHints()) return s;",
  "  return s.replace(/\\b([Pp])ress\\s+(?:<kbd>[^<]{1,12}<\\/kbd>|[A-Z])\\s+to close\\b/g, (m, P) => (P === 'P' ? 'Tap' : 'tap') + ' \\u2715 to close');",
  '}',
  "function _lxRefreshCloseHints() {   // v0.30.1193 ui-text-fixes - the static footers keep their keyboard markup and re-render from it",
  "  for (const el of document.querySelectorAll('.wm-hd-key, .cdx-foot')) { if (el.dataset.kbHtml == null) el.dataset.kbHtml = el.innerHTML; const h = _lxCloseHint(el.dataset.kbHtml); if (el.innerHTML !== h) el.innerHTML = h; }",
  '}',
  '// v0.30.1193 ui-text-fixes - once the panels exist, and again when the window crosses the phone breakpoint',
  '(function _lxWireCloseHints() {',
  '  const run = () => { try { _lxRefreshCloseHints(); } catch (e) {} };',
  "  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();",
  "  try { const mq = window.matchMedia('(pointer: coarse), (max-width: 900px)'); if (mq.addEventListener) mq.addEventListener('change', run); } catch (e) {}",
  '})();',
  '// the HUD strip and the hotkey hint keep their keyboard markup and re-render from it',
  'function _lxRefreshPrompts() {'), 'the _lxRefreshPrompts header');
once("for (const el of document.querySelectorAll('.wm-hd-key, .cdx-foot')) { if (el.dataset.kbHtml == null) el.dataset.kbHtml = el.innerHTML; el.innerHTML = _lxPadKeys(el.dataset.kbHtml); }",
  "_lxRefreshCloseHints();   // v0.30.1193 ui-text-fixes - the same footers, said the touch way on a phone too", 'the footer refresh loop');
once("<span class=\"u-close-hint\">${_lxPadKeys('Press <kbd>U</kbd> to close')}</span>",
  "<span class=\"u-close-hint\">${_lxCloseHint('Press <kbd>U</kbd> to close')}</span><!-- v0.30.1193 ui-text-fixes - tap on a phone -->", 'the U panel close hint');
once(J('  net.chatOpen = true;', "  inp.value = '';", "  inp.style.display = 'block';"), J(
  '  net.chatOpen = true;', "  inp.value = '';",
  "  // v0.30.1193 ui-text-fixes - a phone has no Enter or Esc: its keyboard's Send key sends, and dismissing the keyboard cancels",
  "  try { if (inp.dataset.kbPh == null) inp.dataset.kbPh = inp.placeholder; inp.placeholder = _lxTouchHints() ? 'Say something\\u2026 (max 60 chars \\u00b7 tap Send)' : inp.dataset.kbPh; } catch (e) {}",
  "  inp.style.display = 'block';"), '_mpOpenChat');

// ---- 5) the em dash rides with "stride" ----
once('your shape, your speech, your stride \u2014<br>', 'your shape, your speech, your stride&nbsp;\u2014<br><!-- v0.30.1193 ui-text-fixes - the dash never wraps alone -->', 'the creation preamble');

// ---- 6) Mojicoins with separators, like every other count ----
const FMT = 'Math.floor(player.mojicoins || 0).toLocaleString()';
once("document.getElementById('shop-mojicoins').textContent = player.mojicoins;", "document.getElementById('shop-mojicoins').textContent = " + FMT + ";   // v0.30.1193 ui-text-fixes - 1,000,000,000, not 1000000000", 'the shop balance');
once("document.getElementById('enhance-lumens').textContent = player.mojicoins;", "document.getElementById('enhance-lumens').textContent = " + FMT + ";   // v0.30.1193 ui-text-fixes - separators", 'the forge balance');
once('  lumEl.textContent = player.mojicoins;', '  lumEl.textContent = ' + FMT + ';   // v0.30.1193 ui-text-fixes - separators', 'the crafting balance');
once("document.getElementById('taxi-lumens').textContent = player.mojicoins;", "document.getElementById('taxi-lumens').textContent = " + FMT + ";   // v0.30.1193 ui-text-fixes - separators", 'the taxi balance');

const grew = s.length - n0;
if (grew < 3000 || grew > 7500) die('size moved ' + grew);
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
console.log('applied: ui-text-fixes (+' + grew + ' chars)');
