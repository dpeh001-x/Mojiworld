// New-player feedback: four small places where a first-hour player was left guessing (pre-launch audit, 2026-09-27).
// ============================================================================
//   (death) Checked first, as asked: a death IS explained. Sampled every frame, the death card (with the coin / EXP
//      toll) is on top for its whole beat, and "Defeated! Lost N Mojicoins" shows over the Void arrival. No new card.
//   2) Hero names were changed silently: the filter dropped a tag's brackets and kept its letters ("<b>x</b>" became
//      "bxb", "<u>Zo</u>" became "uZou"). One cleaner (_lxCleanHeroName) now drops whole tag-like sequences and
//      entities before the usual allowed set (letters / digits / space / _ / -, 16 max), for the title, co-op, creation
//      and session paths. The title and co-op name fields show a live hint of the allowed characters and, when
//      something will be dropped, what the name will be saved as. Creation has no spare height (an in-flow line pushed
//      Next off a 720p screen), so there the same hint floats as a chip under the field only while something will be
//      dropped, and the field's tooltip lists the allowed characters. Names are still only written via textContent.
//   3) "Enter Mojiworld" greyed out for 2-5 s with nothing else happening: the button now reads "Creating hero..."
//      (the loading screen's own pulse) until creation opens, and gets its label back if it is unlocked again.
//   4) The tour's last step (U -> Skills) finishes with the U panel open, and its outro beat started over the panel:
//      the first Esc skipped that beat and the panel needed a second press. The outro now waits until no panel is open,
//      so one Esc closes the panel and the outro plays over the world.
//   5) The story cards' "click / tap / press Enter to continue" cue (gold at 0.4-0.55 alpha, pulsing down to 0.35
//      opacity) and the loading-screen tip (#8c7eaa at 0.75 over the key art) read dark on dark. Both are brighter,
//      the cue's pulse stays above 0.78, and the tip sits on a dark plate like the toasts.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxCleanHeroName(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
const HINT = 'Letters, numbers, spaces, - and _ \\u00b7 up to 16';

// 5) the story cue: brighter, firmer shadow, a pulse that stays readable (the death / epilogue variants included)
once('  @media (prefers-reduced-motion: reduce) { #story-beat-hint { animation: none; opacity: 0.6; } }', J(
  '  @media (prefers-reduced-motion: reduce) { #story-beat-hint { animation: none; opacity: 0.6; } }',
  '  /* v0.30.1189 newplayer-feedback - the cue read dark on dark (gold at 0.4-0.55 alpha pulsing down to 0.35 opacity). Brighter',
  '     gold, a firmer ink shadow, and a pulse that never drops under 0.78 - for the dialog, epilogue and death cards alike. */',
  '  #story-beat-overlay #story-beat-hint, #story-beat-overlay.mode-epilogue #story-beat-hint {',
  '    color: rgba(255,228,160,0.96); text-shadow: 0 1px 2px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.8); animation-name: lxStoryCueLit;',
  '  }',
  '  #story-beat-overlay.sb-death #story-beat-hint { color: rgba(222,226,248,0.9); animation-name: lxStoryCueLit; }',
  '  @keyframes lxStoryCueLit { 0%, 100% { opacity: 0.78; } 50% { opacity: 1; } }',
  '  @media (prefers-reduced-motion: reduce) { #story-beat-overlay #story-beat-hint { animation: none; opacity: 0.92; } }'), 'the story cue reduced-motion rule');
// 5) the loading tip: light text on a dark plate (the toast glass), not faint lilac on the key art
once('  #loading-overlay .lo-tip .kbd {', J(
  '  /* v0.30.1189 newplayer-feedback - the tip was #8c7eaa at 0.75 opacity over the painted key art: light text on a dark plate now */',
  '  #loading-overlay .lo-tip {',
  '    left: 0; right: 0; width: max-content; max-width: calc(100% - 32px); margin: 0 auto; padding: 4px 12px; border-radius: 9px;',
  '    background: rgba(18,10,32,0.72); border: 1px solid rgba(200,160,255,0.28);',
  '    color: #efe8fb; opacity: 1; text-shadow: 0 1px 2px rgba(0,0,0,0.85);',
  '  }',
  '  #loading-overlay .lo-tip .kbd {'), 'the loading tip kbd rule');
// 2) the name hint's look, on the title card and in character creation
once('  #loading-overlay .coop-code-row { display: flex; gap: 6px; align-items: stretch; }', J(
  '  /* v0.30.1189 newplayer-feedback - the live hint under each hero-name field (allowed characters / what will be saved) */',
  '  #loading-overlay .lx-name-hint { margin: -3px 0 9px; font-size: 10.5px; line-height: 1.4; color: #cfc6e0; letter-spacing: 0.2px; text-align: center; }',
  '  /* v0.30.1189 newplayer-feedback - creation has no spare height (an in-flow line pushed Next off a 720p screen): a floating chip',
  '     under the field, shown only while something typed will be dropped; the field tooltip lists the allowed characters */',
  '  #class-select-modal .cs-field:has(> #hero-name-hint) { position: relative; }',
  "  #class-select-modal .lx-name-hint { display: none; position: absolute; left: 50%; top: 100%; transform: translateX(-50%); z-index: 6; width: max-content; max-width: 250px; margin-top: 4px; padding: 3px 9px; border-radius: 8px; background: rgba(24,12,44,0.95); border: 1px solid rgba(255,216,160,0.55); box-shadow: 0 4px 12px rgba(0,0,0,0.5); font: 700 10px/1.35 'Nunito', system-ui, sans-serif; letter-spacing: 0.2px; text-align: center; pointer-events: none; }",
  '  #class-select-modal .lx-name-hint.lx-fix { display: block; }',
  '  #loading-overlay .lx-name-hint.lx-fix, #class-select-modal .lx-name-hint.lx-fix { color: #ffd8a0; }',
  '  #loading-overlay .coop-code-row { display: flex; gap: 6px; align-items: stretch; }'), 'the co-op code row rule');
// 2) the hint elements
once('<input class="auth-input" id="auth-user" placeholder="Character name" autocomplete="off" maxlength="16" spellcheck="false" autocapitalize="off">', J(
  '<input class="auth-input" id="auth-user" placeholder="Character name" autocomplete="off" maxlength="16" spellcheck="false" autocapitalize="off">',
  '          <div class="lx-name-hint" id="auth-user-hint" aria-live="polite">Letters, numbers, spaces, - and _ &middot; up to 16</div><!-- v0.30.1189 newplayer-feedback -->'), 'the title name field');
once('<input class="auth-input" id="menu-coop-name" placeholder="Character name" autocomplete="off" maxlength="16" spellcheck="false" autocapitalize="off">', J(
  '<input class="auth-input" id="menu-coop-name" placeholder="Character name" autocomplete="off" maxlength="16" spellcheck="false" autocapitalize="off">',
  '          <div class="lx-name-hint" id="menu-coop-name-hint" aria-live="polite">Letters, numbers, spaces, - and _ &middot; up to 16</div><!-- v0.30.1189 newplayer-feedback -->'), 'the co-op name field');
once('<input id="hero-name-input" maxlength="16" placeholder="Hero">', J(
  '<input id="hero-name-input" maxlength="16" placeholder="Hero" title="Letters, numbers, spaces, - and _ (up to 16)">',
  '              <div class="lx-name-hint" id="hero-name-hint" aria-live="polite">Letters, numbers, spaces, - and _ &middot; up to 16</div><!-- v0.30.1189 newplayer-feedback -->'), 'the creation name field');

// 2) + 4) the helpers (top level of the main script, so the later script's title / LXAuth paths see them too)
once('function _wireTutorialButtons() {', J(
  '// v0.30.1189 newplayer-feedback - ONE hero-name cleaner for the title, co-op, creation and session paths. The old filter',
  '// dropped only a tag\'s brackets and kept its letters ("<b>x</b>" -> "bxb"); whole tag-like sequences (a partial one still',
  '// being typed included) and entities go first now, then the same allowed set: Unicode letters / digits, space, _ and -,',
  '// 16 max. Names are still only ever shown through textContent / escaping - nothing here relies on this for safety.',
  'function _lxCleanHeroName(raw) {',
  "  return String(raw == null ? '' : raw).replace(/<\\/?[A-Za-z!][^<>]*(?:>|$)/g, '').replace(/&#?[A-Za-z0-9]+;/g, '')",
  "    .replace(/[^\\p{L}\\p{N} _-]/gu, '').trim().slice(0, 16);",
  '}',
  '// v0.30.1189 newplayer-feedback - the live hint under a name field: the allowed characters, or what the name will be saved as',
  'const _LX_NAME_HINTS = { \'auth-user\': \'auth-user-hint\', \'menu-coop-name\': \'menu-coop-name-hint\', \'hero-name-input\': \'hero-name-hint\' };',
  'function _lxNameHintUpdate(input) {',
  '  try {',
  '    const h = input && document.getElementById(_LX_NAME_HINTS[input.id]); if (!h) return;',
  "    const raw = String(input.value || '').trim(), clean = _lxCleanHeroName(raw);",
  "    const fix = !!raw && clean !== raw;",
  "    h.textContent = !fix ? '" + HINT + "'",
  "      : clean ? 'Will be saved as \\u201c' + clean + '\\u201d \\u00b7 only letters, numbers, spaces, - and _'",
  "      : 'Only letters, numbers, spaces, - and _ are kept';",
  "    h.classList.toggle('lx-fix', fix);",
  '  } catch (e) {}',
  '}',
  "try { document.addEventListener('input', (e) => { if (e.target && _LX_NAME_HINTS[e.target.id]) _lxNameHintUpdate(e.target); }, true); } catch (e) {}",
  '// v0.30.1189 newplayer-feedback - the tour\'s last step (U -> Skills) finishes with the U panel still open, and the outro beat',
  '// started over it: the first Esc skipped a beat the player had barely seen, and the panel needed a second press. The outro',
  '// waits until no panel is open (up to 10 min), so one Esc closes the panel and the outro then plays over the world.',
  'function _lxTutOutroWhenFree(tries) {',
  '  tries = tries | 0;',
  "  try { if (tries < 1500 && typeof _anyOtherModalOpen === 'function' && _anyOtherModalOpen()) { setTimeout(() => _lxTutOutroWhenFree(tries + 1), 400); return; } } catch (e) {}",
  "  if (typeof _playStoryBeat === 'function') _playStoryBeat('tutorial_outro');",
  '}',
  'function _wireTutorialButtons() {'), 'the tutorial button wiring');
// 4) the outro waits for the panels
once("if (typeof _playStoryBeat === 'function') _playStoryBeat('tutorial_outro'); }",
  "_lxTutOutroWhenFree(); }   // v0.30.1189 newplayer-feedback - played over the still-open U panel and ate the first Esc", 'the tutorial outro call');

// 2) the four filters -> the one cleaner
once("    const clean = String(name || '').replace(/[^\\p{L}\\p{N} _-]/gu, '').trim().slice(0, 16);",
  "    const clean = (typeof _lxCleanHeroName === 'function') ? _lxCleanHeroName(name) : String(name || '').replace(/[^\\p{L}\\p{N} _-]/gu, '').trim().slice(0, 16);   // v0.30.1189 newplayer-feedback",
  'LXAuth.character');
once("        const v = nameInput.value.replace(/[^\\p{L}\\p{N} _-]/gu, '').trim().slice(0, 16);",
  "        const v = _lxCleanHeroName(nameInput.value);   // v0.30.1189 newplayer-feedback - whole tags go (was \"<u>Zo</u>\" -> \"uZou\")",
  'the creation name input');
once("      let name = ($('menu-coop-name').value || '').replace(/[^\\p{L}\\p{N} _-]/gu, '').trim().slice(0, 16);",
  "      let name = _lxCleanHeroName($('menu-coop-name').value);   // v0.30.1189 newplayer-feedback",
  'the co-op name');
once("      let name = (user.value || '').replace(/[^\\p{L}\\p{N} _-]/gu, '').trim().slice(0, 16);",
  "      let name = _lxCleanHeroName(user.value);   // v0.30.1189 newplayer-feedback - whole tags go (was \"<b>x</b>\" -> \"bxb\")",
  'the title name');
// 3) the busy label
once('    const lock = (locked) => { submit.disabled = user.disabled = !!locked; };', J(
  '    const lock = (locked) => { submit.disabled = user.disabled = !!locked;',
  '      // v0.30.1189 newplayer-feedback - 2-5 s pass between this click and character creation; the greyed button said nothing',
  "      try { if (locked) { if (submit._lxLabel == null) submit._lxLabel = submit.textContent; submit.innerHTML = '<span class=\"pulse\">Creating hero\\u2026</span>'; submit.setAttribute('aria-busy', 'true'); }",
  "            else if (submit._lxLabel != null) { submit.textContent = submit._lxLabel; submit._lxLabel = null; submit.removeAttribute('aria-busy'); } } catch (e) {} };"),
  'the title submit lock');

const grew = s.length - n0;
if (grew < 4500 || grew > 8000) die('size moved ' + grew);
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
console.log('applied: newplayer-feedback (+' + grew + ' chars)');
