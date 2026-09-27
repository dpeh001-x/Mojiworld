// Save notices: a player whose save fails is told so, where they can see it (pre-launch new-player audit, 2026-09-27).
// ============================================================================
// Four ways a save problem went unseen or was mis-reported:
//   1) An unreadable save, or one from an older format, was explained by a toast 3-6 s after load. Toasts (z 400) sit
//      under the title overlay (z 9999) and expire long before the menu shows, so a returning player saw only
//      "New Game" with Continue gone and no reason. The notice now sits inside the title menu, under Save Backups
//      (the existing amber .menu-warn card); if the title is skipped (resume / deep link) it becomes a toast after.
//   2) A full browser storage warned ONCE ("Save full - try removing painted layers in Wardrobe", wrong for most
//      players) and every later failed save was silent. The corner save chip now turns into a sticky red
//      "Not saving" badge (the danger-toast palette) until a save lands again; its tooltip and click give generic
//      advice (free space in Save Backups / clear site data, export a Secure Save). The Wardrobe hint is added only
//      when painted layers actually exist. With the separate paint key (v0.30.1181) a paint record that does not fit
//      falls back inline and returns normally, so only a failed MAIN save (_lxPaintWrite rethrows) raises the badge.
//   3) A `{}` save (no version, no hero) was taken for an older format ("save vundefined vs game v1"), kept as a junk
//      Save Backups slot and a _recover copy. It is treated as corrupt now, and a blob with no hero in it is not kept.
//   4) A minimal / old save without hp / mp loaded the hero at the sanitizer's 100 HP (of 643). Missing hp / mp now
//      default to the full pools. The title's "saved just now" read the boot's own autosave stamp; it now shows the
//      stamp of the save being continued (nothing when the save had none).
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxSaveNotice(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// 2) the sticky badge's look: the danger toast's palette on the existing corner chip
once(J('  #save-indicator.blip {', '    opacity: 1;', '    transform: translateY(0);', '  }'), J(
  '  #save-indicator.blip {', '    opacity: 1;', '    transform: translateY(0);', '  }',
  '  /* v0.30.1186 save-notices - saves are failing: the chip stays up as a red "Not saving" badge (danger-toast palette) until one lands */',
  '  #save-indicator.lx-save-fail {',
  '    opacity: 1; transform: none; pointer-events: auto; cursor: pointer;',
  '    background: linear-gradient(135deg, rgba(64,18,28,0.92), rgba(30,12,40,0.9));',
  '    border-color: rgba(230,90,90,0.75); color: #ffdcdc; box-shadow: 0 0 8px rgba(255,70,70,0.35);',
  '  }'), 'the save-indicator blip rule');

// 1) + 2) + 3) the shared helpers, ahead of the unloadable-save keeper
once('function _lxKeepUnloadableSave(raw, label) {', J(
  '// v0.30.1186 save-notices - a save notice the player can actually see. While the title overlay is up (z 9999 over the toasts,',
  '// and the menu appears long after a 3-6 s toast has expired) it goes INTO the title menu, under Save Backups, on the',
  '// menu\'s own amber warning card; if the menu is skipped (resume / deep link) it is shown as a toast once the overlay lifts.',
  'function _lxSaveNotice(msg, kind) {',
  '  try {',
  "    const ov = document.getElementById('loading-overlay');",
  "    const up = !!ov && !ov.classList.contains('fade') && getComputedStyle(ov).display !== 'none';",
  "    const menu = up && document.getElementById('lo-menu');",
  '    if (menu) {',
  "      let n = document.getElementById('menu-save-notice');",
  "      if (!n) { n = document.createElement('div'); n.id = 'menu-save-notice'; n.className = 'menu-warn'; n.setAttribute('role', 'alert'); n.style.margin = '2px 0 0'; menu.appendChild(n); }",
  '      n.textContent = msg; n.hidden = false;',
  '      let seen = false;',
  '      const iv = setInterval(() => {',
  '        try {',
  "          if (ov.classList.contains('menu-up') && getComputedStyle(menu).display !== 'none') seen = true;",
  "          if (ov.classList.contains('fade') || getComputedStyle(ov).display === 'none') { clearInterval(iv); if (!seen && typeof showToast === 'function') showToast(msg, kind); }",
  '        } catch (e) { clearInterval(iv); }',
  '      }, 500);',
  '      return;',
  '    }',
  '  } catch (e) {}',
  "  try { if (typeof showToast === 'function') showToast(msg, kind); } catch (e) {}",
  '}',
  '// v0.30.1186 save-notices - may these bytes hold a hero? Unparseable bytes: maybe (keep them). A parsed blob without a',
  '// player object (`{}`, null, a number): no - nothing to restore, so no junk Save Backups slot or _recover copy.',
  'function _lxSaveMayHoldHero(raw) {',
  "  try { const o = JSON.parse(raw); return !!(o && typeof o === 'object' && o.player && typeof o.player === 'object'); } catch (e) { return true; }",
  '}',
  '// v0.30.1186 save-notices - the title\'s "saved X ago": the stamp of the save being continued, not the boot\'s own autosave',
  "function _lxMenuSaveT(meta) { return (typeof window._lxLoadedSaveT === 'number') ? window._lxLoadedSaveT : ((meta && meta.t) || 0); }",
  '// v0.30.1186 save-notices - saves are failing: advice that fits most players (the Wardrobe hint only with painted layers)',
  'function _lxSaveFailAdvice(why) {',
  "  if (why === 'blocked') return '\\u26A0 Progress is not saving: this browser is blocking site storage. Allow storage for this site to keep playing safely.';",
  '  let paint = false;',
  "  try { paint = (typeof player.customPaint === 'string' && !!player.customPaint) || (!!player.customPaintLayers && Object.keys(player.customPaintLayers).length > 0); } catch (e) {}",
  "  return '\\u26A0 Progress is not saving: browser storage is full. Free up space (delete old snapshots in Save Backups, or clear other site data) and export a backup (Save Backups \\u25B8 Secure Save).'",
  "    + (paint ? ' Painted Wardrobe layers take a lot of room too - removing some helps.' : '');",
  '}',
  '// v0.30.1186 save-notices - the corner save chip becomes a sticky "Not saving" badge while saves fail (why: \'full\' | \'blocked\'),',
  '// and goes back to the quiet "saved" blip the moment one lands (why: null). Click it for the advice + Save Backups.',
  'function _lxSaveFailing(why) {',
  '  try {',
  "    const el = document.getElementById('save-indicator');",
  '    if (!why) {',
  "      if (typeof game !== 'undefined' && game) { game._saveFailing = null; game._quotaWarned = false; game._saveDisabledWarned = false; }",
  "      if (el && el.classList.contains('lx-save-fail')) { el.classList.remove('lx-save-fail'); if (el._lxOrigText != null) el.textContent = el._lxOrigText; el.title = el._lxOrigTitle || 'Progress saved'; el.onclick = null; }",
  '      return;',
  '    }',
  "    if (typeof game !== 'undefined' && game) game._saveFailing = why;",
  '    if (!el) return;',
  "    if (!el.classList.contains('lx-save-fail')) { el._lxOrigText = el.textContent; el._lxOrigTitle = el.title; }",
  "    el.classList.add('lx-save-fail'); el.textContent = '\\u26A0 Not saving';",
  '    el.title = _lxSaveFailAdvice(why) + \' (click for Save Backups)\';',
  "    el.onclick = () => { try { showToast(_lxSaveFailAdvice(why), 'danger'); if (typeof openBackupModal === 'function') openBackupModal(); } catch (e) {} };",
  '  } catch (e) {}',
  '}',
  'function _lxKeepUnloadableSave(raw, label) {',
  "  if (!_lxSaveMayHoldHero(raw)) return;   // v0.30.1186 save-notices - `{}` has no hero to restore: no junk slot"), 'the unloadable-save keeper');

// 2) saveState: a landed save clears the badge; a failed one raises it (and the one-time toast gives the right advice)
once("    if (typeof _blipSaveIndicator === 'function') _blipSaveIndicator();", J(
  "    if (game._saveFailing) _lxSaveFailing(null);   // v0.30.1186 save-notices - saving again: the sticky badge goes",
  "    if (typeof _blipSaveIndicator === 'function') _blipSaveIndicator();"), 'the save-landed blip');
once(J('    if (isQuota) {', '      if (!game._quotaWarned) {'), J(
  "    try { _lxSaveFailing(isQuota ? 'full' : 'blocked'); } catch (_) {}   // v0.30.1186 save-notices - sticky until a save lands",
  '    if (isQuota) {', '      if (!game._quotaWarned) {'), 'the quota branch');
once("          showToast('⚠ Save full — try removing painted layers in Wardrobe', 'danger');",
  "          showToast(_lxSaveFailAdvice('full'), 'danger');   // v0.30.1186 save-notices - was the Wardrobe hint for everyone", 'the quota toast');

// 3) loadState: no version and no player is a broken save, not an older one
once('    if (s && s.v !== SAVE_VERSION) {', J(
  "    // v0.30.1186 save-notices - `{}` / null / a bare value is not an older format (\"save vundefined vs game v1\", a junk backup):",
  "    // it is corrupt, and goes down the could-not-be-read path.",
  "    if (!s || typeof s !== 'object' || (s.v == null && !s.player)) throw new Error('save holds no version and no hero');",
  '    if (s && s.v !== SAVE_VERSION) {'), 'the save-version check');
// 1) the older-format notice: in the title menu, and no "vundefined"
once("            showToast('⚠ Save format updated (v' + s.v + ' → v' + SAVE_VERSION + '). Starting fresh.', 'rare');",
  "            _lxSaveNotice('⚠ Save format updated (' + (s.v == null ? 'unversioned' : 'v' + s.v) + ' → v' + SAVE_VERSION + '). Your old save is kept in Save Backups; starting fresh.', 'rare');   // v0.30.1186 save-notices",
  'the older-format toast');
// 4) + the title stamp: remember the loaded save's own stamp
once('    if (!s || !s.player || !s.player.cls) return false;', J(
  '    if (!s || !s.player || !s.player.cls) return false;',
  "    try { window._lxLoadedSaveT = (+s.t > 0) ? +s.t : 0; } catch (e) {}   // v0.30.1186 save-notices - the stamp of the save being continued"), 'the no-hero bail');
// 4) missing hp / mp: remember it before the sanitizer fills in 100 / 50 ...
once('    _sanitizePlayerSaveNumerics(s.player);', J(
  "    var _lxNoHp = !(typeof s.player.hp === 'number' && isFinite(s.player.hp)), _lxNoMp = !(typeof s.player.mp === 'number' && isFinite(s.player.mp));   // v0.30.1186 save-notices",
  '    _sanitizePlayerSaveNumerics(s.player);'), 'the numeric sanitizer call');
// ... and start such a hero at full pools
once('    player.mp = (!player.mp || player.mp <= 0 || !isFinite(player.mp)) ? _safeMaxMp : Math.min(player.mp, _safeMaxMp);', J(
  '    player.mp = (!player.mp || player.mp <= 0 || !isFinite(player.mp)) ? _safeMaxMp : Math.min(player.mp, _safeMaxMp);',
  '    if (_lxNoHp) player.hp = _safeMaxHp; if (_lxNoMp) player.mp = _safeMaxMp;   // v0.30.1186 save-notices - an old / minimal save starts at full, not at 100 of 643'),
  'the hp/mp clamp');
// 1) + 3) the could-not-be-read path: no junk copies of a hero-less blob, and a notice the title shows
once(J('      if (_raw) {', "        if (!localStorage.getItem(SAVE_KEY + '_recover')) localStorage.setItem(SAVE_KEY + '_recover', _raw);"), J(
  '      const _lxHero = !!_raw && _lxSaveMayHoldHero(_raw);   // v0.30.1186 save-notices - `{}` holds no hero: nothing to keep',
  '      if (_raw) {',
  "        if (_lxHero && !localStorage.getItem(SAVE_KEY + '_recover')) localStorage.setItem(SAVE_KEY + '_recover', _raw);"), 'the corrupt-save recover copy');
once("          try { showToast('\\u26A0 Your save could not be read. It is kept in Save Backups as \"could not load\" - restore it from there.', 'danger'); } catch (_) {}", J(
  '          // v0.30.1186 save-notices - shown in the title menu (a toast here sat under the title overlay and expired unseen)',
  "          try { _lxSaveNotice(_lxHero ? '\\u26A0 Your save could not be read. It is kept in Save Backups as \"could not load\" - restore it from there.'",
  "            : '\\u26A0 Your save could not be read: it was empty, with no hero to restore. Starting a new adventure.', 'danger'); } catch (_) {}"), 'the corrupt-save toast');
// the title's Continue card: the loaded save's stamp
once("          + (meta.map ? ' · ' + meta.map : '') + (meta.t ? ' · saved ' + (typeof _lxTimeAgo === 'function' ? _lxTimeAgo(meta.t) : '') : '');",
  "          + (meta.map ? ' · ' + meta.map : '') + (_lxMenuSaveT(meta) ? ' · saved ' + (typeof _lxTimeAgo === 'function' ? _lxTimeAgo(_lxMenuSaveT(meta)) : '') : '');   // v0.30.1186 save-notices",
  'the Continue card stamp');

const grew = s.length - n0;
if (grew < 5000 || grew > 9500) die('size moved ' + grew);
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
console.log('applied: save-notices (+' + grew + ' chars)');
