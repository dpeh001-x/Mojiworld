// The title menu comes first: before it is up only the title's own art loads; the town, the backdrops next door, the
// character-creation parts and the NPC sheets start the moment it is (pre-launch, 2026-09-27; after lazy-art / lazy-art2 /
// lazy-fx).
// ============================================================================
// A cold first visit to play.moji-studios.com still fetched ~50 MB before the title menu could be clicked - about a
// minute on a 0.9 MB/s line - and almost none of it was the title's:
//   - the boot gate's first-paint set (BAZAAR + CRITICAL + the start map's backdrop): every town's backdrop (~15 MB),
//     the town NPC sheets (~4.6 MB), the grass tiles and the central floor, the portal, the U-panel tabs. The menu
//     (hide -> _showAuthGate) only came up once all of it had loaded;
//   - hide()'s decode gate: the start map's whole preload, raced against 8 s. On a new save the start map is the Void,
//     whose preload tracks every hair / head / eye / mouth sheet of the creator (~10.5 MB, 100 files), its cosmic tiles
//     and the deck icons. The preloader (and lazy-art's map wants) ask the boot image hold for them with now() /
//     want(), which walked straight past the hold.
// Now (window._lxTitleFirst; ?lxtf=0 - or ?lxhold=0, which turns the whole hold off - restores the old order):
//   1) the boot image hold keeps what the boot ASKS for too, until the menu is up: now() / want() / match() and a
//      _lxNow src put the image in firstQ instead of starting it, and release() starts firstQ first, ahead of the
//      ordinary held queue. Only the title's own art - the document's <img>s, CSS and <head> preloads - loads before
//      the menu, as before.
//   2) the menu waits for the title: the page itself (DOMContentLoaded - every script has run), its fonts and its
//      pictures (the loading overlay's <img>s, the <head>'s image preloads), 6 s at most for those. hide() no longer
//      waits on the start map's preload: it is asked for as before and starts at menu-up with the rest of firstQ.
//   3) the gate's own files (BAZAAR, CRITICAL, the start backdrop) start right after the menu is up, at low priority
//      (the start map's art, asked for at 'high', goes first); DEFERRED follows once they are in, as it followed the
//      reveal before. While the player waits on Continue / New Game (the commence and ready gates) these prefetches
//      pause, so the link is the waiting map's alone.
//   4) the boot prepares the map the world is ON (game.currentMap). It read the SAVE's map, but every resume lands in
//      town (loadState, v0.26.961): a Continue on a save made in, say, the Mushroom Forest preloaded that forest's
//      sheets and backdrop, gated the old title on its backdrop and ran the click's ready gate on it - for a map the
//      player was not entering. hide()'s start map, the start backdrop and _lxPredictStartMap now read the live map.
//   5) a menu click can now wait on art that arrives after the menu, behind a menu that looks idle: the pressed button
//      says "Loading your world..." while the commence / ready gate holds (New Game's Start already says "Creating hero").
//      And the gate's own "Finishing sprites... n/N" (shown when the menu is skipped) counts the watch list as it grows,
//      not as it was when the hold began (a neighbour's preload landing mid-hold read "-32% ... -193/599").
//   6) the save notices placed INTO the title menu (unreadable save, save format updated) waited 3 s / 6 s from the boot,
//      from when the menu was far off; they are placed at once now, so they are in the menu when it shows.
// Continue / New Game still pass the commence gate (every watched sprite of the start map - the town's backdrop, the
// creator's parts - loaded, bounded 45 s stall / 120 s cap) and the ready gate (the backdrop decoded, bounded), so the
// creator and the town open on loaded art, as before.
// Needs the boot image hold (v0.30.806) with lazy-art's want() (v0.30.1196). Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('window._lxTitleFirst = TF;')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
if (!s.includes('want: (img) => { if (!img) return false; img._lxWanted = true; return start(img); },')) die('the boot image hold with lazy-art\'s want() is not on this build');
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
const after = (a, add, what) => once(a, J(a, ...add), what);
const before = (a, add, what) => once(a, J(...add, a), what);
const T = 'v0.30.1254 title-first';

// 1) the hold: the boot's own asks wait for the menu too (firstQ), and go first when it is up
after('    let held = [], open = false, started = 0; const lazyQ = [];   // v0.30.1196 lazy-art - parked lazy images', [
  '    // ' + T + ' - TITLE FIRST: until the menu is up, art the boot ASKS for (now() / want() / match() - the start map\'s preload',
  '    // and wants, a portal neighbour\'s backdrop - and a _lxNow src) waits too, in firstQ, and starts FIRST when the menu is',
  '    // up. Only the title\'s own art (the document\'s <img>s, CSS, <head> preloads) loads before it. ?lxtf=0 turns it off.',
  '    const TF = !/[?&]lxtf=0\\b/.test(qs), firstQ = [];',
  '    window._lxTitleFirst = TF;',
  '    const tfDefer = (img) => { if (!img._lxTf) { img._lxTf = true; firstQ.push(img); } return true; };   // ' + T],
  'the hold state');
once('if (u == null) return false; img._lxHeldSrc = null; started++; dSrc.set.call(img, u);',
  'if (u == null) return false; if (TF && !open) return tfDefer(img);   /* ' + T + ' - asked for before the menu: starts at menu-up, first */ img._lxHeldSrc = null; started++; dSrc.set.call(img, u);',
  'the hold start()');
before("        if (open || this._lxNow === true || typeof v !== 'string' || !RX.test(v) || this.isConnected) {", [
  "        if (TF && !open && this._lxNow === true && typeof v === 'string' && RX.test(v) && !this.isConnected) { this._lxHeldSrc = v; tfDefer(this); return; }   // " + T + ' - the boot gate\'s own files wait for the menu too'],
  'the hold src setter');
after('      if (open) return; open = true;', [
  '      for (const im of firstQ.splice(0)) if (im._lxHeldSrc != null && !(im._lxLazy === true && !im._lxWanted)) start(im);   // ' + T + ' - what the boot asked for goes first'],
  'the hold release()');
after('        parked: lazyQ.concat(held).filter((im) => im._lxLazy === true && !im._lxWanted && im._lxHeldSrc != null).length }) };', [
  '    window._lxBootHold.tf = () => ({ on: TF, waiting: firstQ.filter((im) => im._lxHeldSrc != null).length });   // ' + T + ' - diagnosis / tests'],
  'the hold API');

// 3) the boot gate's files start once the menu is up, behind the start map's art
after("  const DEFERRED = REQUIRED.filter(p => !BAZAAR_PATHS.has(p) && !CRITICAL_PATHS.has(p) && !(typeof _lxLazyBgPath === 'function' && _lxLazyBgPath(p)) && !(typeof _lxArt2LazyPath === 'function' && _lxArt2LazyPath(p)));   // v0.30.1196 lazy-art - a parked backdrop waits for its map", [
  '  // ' + T + ' - with title-first the menu no longer waits for BAZAAR / CRITICAL / the start backdrop: their pools are queued',
  '  // here (_tfQ) and start once the menu is up (see THE TITLE GATE below); DEFERRED still follows them',
  '  const _tfOn = !!window._lxTitleFirst, _tfQ = [];',
  '  // ' + T + ' - these are prefetches nothing at the door waits on (other towns, their NPCs, the tabs): they wait while the',
  '  // hold still has queued art to start (the start map\'s and the registries - what Continue / New Game will wait for) and',
  '  // while the player waits at Continue / New Game (the commence and ready gates hold the overlay)',
  "  const _tfBusy = () => { if (window._lxSpriteGateHolding || window._lxReadyGateRunning) return true; try { const H = window._lxBootHold, st = H && H.stats(); return !!(st && st.open && st.held > 0); } catch (e) { return false; } };",
  '  const _tfCalm = () => new Promise((res) => { const t = () => _tfBusy() ? setTimeout(t, 250) : res(); t(); });',
  '  const _gatePool = (n, list, fn) => _tfOn ? new Promise((res) => { _tfQ.push(() => _lxAsyncPool(n, list, (p) => _tfCalm().then(() => fn(p))).then(res, res)); }) : _lxAsyncPool(n, list, fn);',
  '  // ' + T + ' - the map the world is ON: every resume lands in town (loadState), whatever map the save was made on',
  "  const _tfMap = () => { try { return (_tfOn && typeof game !== 'undefined' && game && game.currentMap && typeof MAPS !== 'undefined' && MAPS[game.currentMap]) ? game.currentMap : null; } catch (e) { return null; } };",
  '  // ' + T + ' - a menu click can now wait on the start map\'s art (it arrives after the menu), behind a menu that looks idle:',
  '  // the button pressed says so while the commence / ready gate holds, like New Game\'s "Creating hero..." (v0.30.1189)',
  '  const _tfWaitLabel = () => {',
  '    try {',
  "      const a = document.getElementById('lo-auth'), b = window._lxTfPressed;",
  "      if (!_tfOn || !a || !a.classList.contains('shown') || !b || b._lxTfWait || b.id === 'auth-submit') return;",
  "      b._lxTfWait = true; b.setAttribute('aria-busy', 'true');",
  "      const el = (b.id === 'menu-continue' && document.getElementById('menu-continue-sub')) || b;",
  "      el.innerHTML = '<span class=\"pulse\">Loading your world\\u2026</span>';",
  '    } catch (e) {}',
  '  };'],
  'the boot DEFERRED list');
once(J('        if (window._lxSpriteGateHolding) return;   // second click while holding — the running hold finishes the job', '        window._lxSpriteGateHolding = true;'), J(
  '        if (window._lxSpriteGateHolding) return;   // second click while holding — the running hold finishes the job',
  '        window._lxSpriteGateHolding = true;',
  '        _tfWaitLabel();   // ' + T + ' - the pressed button says it is loading'),
  'the commence gate hold');
once(J('      window._lxReadyGateRunning = true;', '      window._lxSpriteGateHolding = true;'), J(
  '      window._lxReadyGateRunning = true;',
  '      window._lxSpriteGateHolding = true;',
  '      _tfWaitLabel();   // ' + T),
  'the ready gate hold');
once("      const mapId = (sv && sv.game && sv.game.currentMap) || 'town';",
  "      const mapId = _tfMap() || (sv && sv.game && sv.game.currentMap) || 'town';   // " + T + ' - the live map first',
  'the start backdrop map');
once('    _lxAsyncPool(6, DEFERRED, p => loadOne(p, false).then(() => {   // v0.26.962 — pooled x6',
  '    _lxAsyncPool(6, DEFERRED, p => (_tfOn ? _tfCalm() : Promise.resolve()).then(() => loadOne(p, false)).then(() => {   // v0.26.962 — pooled x6   // ' + T + ' - paused while the door holds',
  'the DEFERRED pool');
after('      const _startId = (() => {', [
  '        { const _m0 = _tfMap(); if (_m0) return _m0; }   // ' + T + ' - the map the world is on (a resume is in town, not the save\'s map)'],
  'hide() start map');
after(J('function _lxPredictStartMap() {', '  let m = null;'), [
  "  try { if (window._lxTitleFirst && typeof game !== 'undefined' && game && game.currentMap && typeof MAPS === 'object' && MAPS[game.currentMap]) return game.currentMap; } catch (e) {}   // " + T + ' - the map the world is on (every resume lands in town)'],
  '_lxPredictStartMap');
once("    if (isCritical && 'fetchPriority' in img) img.fetchPriority = 'high';",
  "    if (isCritical && 'fetchPriority' in img) img.fetchPriority = _tfOn ? 'low' : 'high';   // " + T + ' - after the menu: behind the start map\'s own art',
  'loadOne priority');
once('  _lxAsyncPool(8, BAZAAR, p => loadOne(p, true).then(() => { bzLoaded++; update(); }))',
  '  _gatePool(8, BAZAAR, p => loadOne(p, true).then(() => { bzLoaded++; update(); }))   // ' + T, 'the BAZAAR pool');
once('  _lxAsyncPool(8, CRITICAL, p => loadOne(p, true).then(() => { critLoaded++; update(); }))',
  '  _gatePool(8, CRITICAL, p => loadOne(p, true).then(() => { critLoaded++; update(); }))   // ' + T, 'the CRITICAL pool');
once('  _lxAsyncPool(2, _startBgPaths, p => loadOne(p, true).then(() => { startBgLoaded++; update(); }))',
  '  _gatePool(2, _startBgPaths, p => loadOne(p, true).then(() => { startBgLoaded++; update(); }))   // ' + T, 'the start backdrop pool');
once(J('    if (gatedLoaded() < gatedCount()) return;', '    if (revealed) return;'), J(
  '    if (gatedLoaded() < gatedCount()) return;',
  '    if (revealed) { if (_tfOn) startDeferred(); return; }   // ' + T + ' - the menu came first; DEFERRED follows the gate\'s files'),
  'maybeReveal');
// 2) THE TITLE GATE
before('  function maybeReveal() {', [
  '  // ' + T + ' - THE TITLE GATE. The menu used to wait for the gate\'s files above (every town\'s backdrop, the town NPC',
  '  // sheets, the grass tiles, the UI tabs) and, in hide(), for the start map\'s preload (every character-creation part on a',
  '  // new save): ~50 MB before the title on a first web visit. It now waits for what it shows: the page itself',
  '  // (DOMContentLoaded - every script has run), its fonts and its own pictures (the loading overlay\'s <img>s, the images',
  '  // the <head> preloads - the key art), 6 s at most for those. Then the menu comes up (the hold lets the start map\'s art',
  '  // go first) and the gate\'s files start behind it.',
  '  if (_tfOn) {',
  '    const _tfT0 = Date.now();',
  '    const _tfArtIn = () => {',
  "      for (const im of (overlay ? overlay.querySelectorAll('img') : [])) if (im.getAttribute('src') && !im.complete) return false;",
  "      const got = new Set(); try { for (const e of performance.getEntriesByType('resource')) got.add(e.name); } catch (e) { return true; }",
  "      for (const l of document.querySelectorAll('link[rel=\"preload\"][as=\"image\"]')) if (l.href && !got.has(l.href)) return false;",
  '      return true;',
  '    };',
  '    const _tfTick = () => {',
  '      if (revealed) { for (const f of _tfQ.splice(0)) { try { f(); } catch (e) {} } return; }   // ' + T + ' - revealed some other way',
  "      let ok = document.readyState !== 'loading';",
  "      if (ok && Date.now() - _tfT0 < 6000) { try { ok = (!document.fonts || document.fonts.status === 'loaded') && _tfArtIn(); } catch (e) {} }",
  '      if (!ok) { setTimeout(_tfTick, 50); return; }',
  '      revealed = true;',
  "      if (bar) bar.style.width = '100%';",
  '      try { window._lxTitleFirstAt = Math.round(performance.now()); } catch (e) {}   // ' + T + ' - when the menu was asked for (tests)',
  "      try { const a = document.getElementById('lo-auth'); if (a) a.addEventListener('click', (ev) => { const b = ev.target && ev.target.closest && ev.target.closest('button'); if (b) window._lxTfPressed = b; }, true); } catch (e) {}   // " + T + ' - for _tfWaitLabel',
  '      hide();',
  '      for (const f of _tfQ.splice(0)) { try { f(); } catch (e) {} }   // ' + T + ' - the gate\'s files, now the menu is up',
  '    };',
  '    setTimeout(_tfTick, 0);',
  '  }'],
  'maybeReveal head');
// 2) hide(): the start map's preload is asked for as before, but the menu does not wait on it
before("            if (status) status.innerHTML = '<span class=\"pct\">100%</span> · <span class=\"pulse\">Decoding world… ' + d + '/' + t + '</span>';", [
  '            if (_shown && _tfOn) return;   // ' + T + ' - the menu is up; this line is its own now'],
  'hide() preload progress');
once('      Promise.race([_mapPre, new Promise((res) => setTimeout(res, 8000))]).then(_proceed, _proceed);', J(
  '      // ' + T + ' - the start map\'s art (asked for above) starts at menu-up, ahead of everything else; Continue / New Game',
  '      // wait for it at the commence gate (bounded), so the menu itself does not',
  '      if (_tfOn) _proceed(); else Promise.race([_mapPre, new Promise((res) => setTimeout(res, 8000))]).then(_proceed, _proceed);'),
  'hide() decode gate');
// 5) the commence gate's "Finishing sprites... n/N" counted against the watch list as it was when the hold began; preloads
//    that land in it during the hold (a portal neighbour's, 3 s after the boot) read "-32% ... -193/599". It is shown on
//    the loading screen when the menu is skipped (New Game over a saved hero reloads straight into the gate)
once(J("          const _pct = Math.round(((_total - n) / Math.max(1, _total)) * 100);",
  "          _st.innerHTML = '<span class=\"pct\">' + _pct + '%</span> · <span class=\"pulse\">Finishing sprites… ' + (_total - n) + '/' + _total + '</span>';"), J(
  "          const _tt = Math.max(_total, n, (window._lxSpriteWatch || []).length);   // " + T + ' - the list grows during the hold',
  "          const _pct = Math.round(((_tt - n) / Math.max(1, _tt)) * 100);",
  "          _st.innerHTML = '<span class=\"pct\">' + _pct + '%</span> · <span class=\"pulse\">Finishing sprites… ' + (_tt - n) + '/' + _tt + '</span>';"),
  'the commence gate progress');
// 6) the save notices that go INTO the title menu (v0.30.1186) waited 3 s / 6 s from the boot - from when the menu used to
//    be far off. The menu is up about a second after that point now: they are placed at once, so they are in it when it shows
once(J("Starting a new adventure.', 'danger'); } catch (_) {}", '        }, 3000);'), J(
  "Starting a new adventure.', 'danger'); } catch (_) {}",
  '        }, window._lxTitleFirst ? 0 : 3000);   // ' + T + ' - in the menu before it shows (it is up ~1 s after the boot now)'),
  'the unreadable-save notice');
once(J("starting fresh.', 'rare');   // v0.30.1186 save-notices", '          }', '        }, 6000);'), J(
  "starting fresh.', 'rare');   // v0.30.1186 save-notices", '          }',
  '        }, window._lxTitleFirst ? 0 : 6000);   // ' + T + ' - in the menu before it shows; a toast only if the menu is skipped'),
  'the save-format notice');

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
console.log('applied: title-first (+' + grew + ' chars)');
