// Phone fit: seven screens that did not fit a landscape phone (or a 1280x720 window) (UI audit, 2026-09-27).
// ============================================================================
// Found by opening every panel at 667x375 and 844x390 with touch, and at 1280 / 1366 / 1920:
//   1) BLOCKER - character creation could not be finished on a 667x375 phone: the Back / LOOK-CLASS / NEXT row sat
//      below the screen inside a card that clips (overflow hidden), so a finger could not reach NEXT. On short screens
//      the card is now a column: the Guguma line and the title stay put, the page between them scrolls, and the nav
//      row stays pinned at the bottom. The look pickers measure their room against the scrolling page.
//   2) the jukebox could not be closed at 667x375: its top bar was wider than the card, so the only X was cut off
//      (Done is hidden on short screens). The katakana sticker steps aside below 760 px wide and the found counter
//      may shrink, so the X always stays on the card.
//   3) the Guguma "Ascend" pill (level cap) sat at z-index 100040 over every panel and the phone deck: taps on
//      Settings' Done, the shop's Buy, Level Up's + and the attack button hit the pill. It is under the panels now
//      (z 65), hidden while a panel or overlay is open, and docks where nothing clickable is underneath.
//   4) the title menu showed New Game and Co-op on a landscape phone; Settings, Save Backups and the links were
//      below the fold with no hint the menu scrolls. A "More" tab sits on its bottom edge while there is more.
//   5) the quest journal's category chips ran off the card at 667 px: the bar wraps and the chips wrap.
//   6) the Reforge Bench spilled out of its card at 667 px (column layout, a card capped at 92 pre-scale vh): the
//      card uses the real screen height and scrolls, so the Reforge button is reachable.
//   7) the U panel's header took half the panel (no inventory row above the fold at 1280x720, Achievements on a row
//      of its own): the crest, gaps and tab paddings are tighter and the shortcut row fits on one line. Sizes only.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxAscendDock(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// ---- the stylesheet: one new block after the last head-level sheet ----
const CSS = J(
  '<style id="lx-phone-fit-css">',
  '  /* v0.30.1182 phone-fit - 1) character creation on a short screen: header fixed, the page scrolls, the nav row stays pinned */',
  '  @media (max-height: 500px) {',
  '    #class-select-modal#class-select-modal .modal.cs-epic { display: flex !important; flex-direction: column !important; }',
  '    #class-select-modal#class-select-modal .modal.cs-epic > .guguma-chip, #class-select-modal#class-select-modal .modal.cs-epic > h2.cs-title { flex: 0 0 auto !important; }',
  '    #class-select-modal#class-select-modal .modal.cs-epic > .cs-page { flex: 0 1 auto !important; min-height: 0 !important; overflow-x: hidden !important; overflow-y: auto !important;',
  '      overscroll-behavior: contain; scrollbar-width: thin; }',
  '    #class-select-modal#class-select-modal .modal.cs-epic > .cs-page-nav { flex: 0 0 auto !important; width: 100% !important; box-sizing: border-box !important; }',
  '  }',
  '  /* v0.30.1182 phone-fit - 2) the jukebox X stays on the card: the sticker steps aside when narrow, the counter may shrink */',
  '  #jukebox-modal-bg #jukebox-modal .jb-top .jb-found, #jukebox-modal-bg #jukebox-modal .jb-top .jb-kata { flex: 0 1 auto; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }',
  '  @media (max-width: 760px) { #jukebox-modal-bg #jukebox-modal .jb-top .jb-kata { display: none; } }',
  '  /* v0.30.1182 phone-fit - 3) the Ascend pill hides while any panel or overlay is up (it sits under them anyway now) */',
  '  body.forced-modal #guguma-ascend, body.cinematic #guguma-ascend, body:has(.modal-overlay[style*="display: flex"]) #guguma-ascend,',
  '  body:has(#settings-modal-bg.on) #guguma-ascend, body:has(#jukebox-modal-bg.on) #guguma-ascend, body:has(#backup-modal-bg.on) #guguma-ascend,',
  '  body:has(#lx-pause) #guguma-ascend, body:has(#edicts-modal) #guguma-ascend, body:has(#titles-modal) #guguma-ascend,',
  '  body:has(#char-studio-overlay.open) #guguma-ascend, body:has(#char-studio-overlay.on) #guguma-ascend, body:has(#story-beat-overlay.on) #guguma-ascend,',
  '  body:has(#dialog[style*="display: block"]) #guguma-ascend { display: none !important; }',
  '  /* v0.30.1182 phone-fit - 4) the title menu\'s "More" tab, on the menu\'s bottom edge while it has more below */',
  '  #lx-more-cue { position: absolute; z-index: 6; display: none; align-items: center; gap: 5px; transform: translateX(-50%); margin: 0; padding: 5px 13px 5px 14px;',
  '    border: 2px solid #0c0b10; border-radius: 999px; background: #ffe45c; color: #0c0b10; box-shadow: 3px 3px 0 #ff2e88; cursor: pointer;',
  "    font: 900 11px/1 'Nunito', system-ui, sans-serif; letter-spacing: 1.6px; text-transform: uppercase; animation: lx-more-bob 1.3s ease-in-out infinite; }",
  '  #lx-more-cue.on { display: inline-flex; }',
  '  #loading-overlay .lo-stack.lx-more { -webkit-mask-image: linear-gradient(180deg, #000 calc(100% - 44px), rgba(0,0,0,0.3) 100%); mask-image: linear-gradient(180deg, #000 calc(100% - 44px), rgba(0,0,0,0.3) 100%); }',
  '  @keyframes lx-more-bob { 0%, 100% { translate: 0 0; } 50% { translate: 0 3px; } }',
  '  @media (prefers-reduced-motion: reduce) { #lx-more-cue { animation: none; } }',
  '  /* v0.30.1182 phone-fit - 5) the quest journal bar wraps, and so do its category chips */',
  '  #quest-modal .qj-bar { flex-wrap: wrap; row-gap: 6px; }',
  '  #quest-modal .qj-filter { flex-wrap: wrap; justify-content: flex-end; min-width: 0; max-width: 100%; row-gap: 6px; }',
  '  /* v0.30.1182 phone-fit - 6) the Reforge Bench on a narrow screen: the real screen height (vh is pre-scale in the wrapper), and it scrolls */',
  '  @media (max-width: 720px) {',
  '    #reforge-modal > .modal { max-height: calc(94vh / var(--game-scale-y, var(--game-scale, 1))) !important; overflow-x: hidden !important; overflow-y: auto !important; }',
  '    #reforge-modal #reforge-body { flex: 0 0 auto; min-height: auto; }',
  '    #reforge-modal #reforge-preview { flex: 0 0 auto; overflow: visible; }',
  '  }',
  '  /* v0.30.1182 phone-fit - 7) the U panel header, tighter (sizes only): the crest, the gaps, the tab paddings ("Level Up" no longer wraps on a',
  '     phone); the shortcut row on one line; the Ch / close-hint column clear of the X */',
  '  #attributes-modal#attributes-modal .u-header { padding: 2px 44px 6px 4px !important; margin: -2px -2px 6px !important; gap: 12px !important; }',
  '  #attributes-modal#attributes-modal .u-crest { width: 44px !important; height: 44px !important; flex: 0 0 44px !important; font-size: 23px !important; }',
  '  #attributes-modal#attributes-modal .u-identity { gap: 3px !important; }',
  '  #attributes-modal#attributes-modal #u-tabs { margin-bottom: 6px !important; padding: 3px !important; }',
  '  #attributes-modal#attributes-modal #u-tabs .inv-tab { padding: 5px 8px !important; white-space: nowrap; }',
  '  #attributes-modal#attributes-modal #u-jump-row#u-jump-row { gap: 4px; margin: 2px 0 0; padding: 5px 0 0; }',
  '  #attributes-modal#attributes-modal #u-jump-row#u-jump-row .u-jump { padding: 4px 8px 4px 6px; gap: 4px; font-size: 11px; }',
  '  #attributes-modal#attributes-modal #u-jump-row#u-jump-row .u-jump .uj-ico { width: 18px; height: 18px; flex: 0 0 18px; }',
  '  #attributes-modal#attributes-modal #u-inv-tabs { margin: 4px 0 2px !important; padding-top: 6px; padding-bottom: 9px; }',
  '  #attributes-modal#attributes-modal #u-inv-tabs .inv-tab { padding-top: 8px; padding-bottom: 8px; }',
  '</style>',
  '',
  '<div id="char-studio-overlay">');
once('<div id="char-studio-overlay">', CSS, 'the char-studio overlay (style anchor)');

// ---- 1) the look pickers: the room above ends at the scrolling page's top ----
once('      const roomAboveCss = (tr.top - mr.top) / scale - 12;', J(
  '      // v0.30.1182 phone-fit - on a short screen the page scrolls under a fixed header: the room above ends at the page top',
  "      const _lxPg = wrap.closest('.cs-page'), _lxPgTop = (_lxPg && getComputedStyle(_lxPg).overflowY !== 'visible') ? _lxPg.getBoundingClientRect().top : mr.top;",
  '      const roomAboveCss = (tr.top - Math.max(mr.top, _lxPgTop)) / scale - 12;'), 'the look-picker room above');

// ---- 3) the Ascend pill: under the panels, docked clear of anything clickable ----
once('function _gugumaAscendChip(show, expanded) {', J(
  '// v0.30.1182 phone-fit - THE ASCEND PILL STAYS CLEAR OF THE CONTROLS. It sat bottom-right at z-index 100040, over every',
  '// panel and the phone deck (Basic Attack, Settings\' Done, the shop\'s Buy, Level Up\'s +) and over the desktop minimap.',
  '// It sits under the panels now (z 65; the stylesheet hides it while one is open) and takes the first spot where',
  '// nothing but the game view is underneath: bottom-right, bottom-left, under the phone\'s top menu row, then the rest.',
  'function _lxAscendDock(el) {',
  "  el = el || document.getElementById('guguma-ascend');",
  '  if (!el || !el.isConnected) return;',
  '  const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;   // hidden while a panel is open: keep its spot',
  '  const W = window.innerWidth, H = window.innerHeight, w = r.width, h = r.height, m = 12;',
  "  const bare = (e) => !e || e === document.body || e === document.documentElement || e.id === 'game' || (e.classList && e.classList.contains('game-wrapper'));",
  '  const hits = (x, y) => { let n = 0; for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {',
  '    const px = x + (i + 0.5) * w / 5, py = y + (j + 0.5) * h / 3;',
  '    if (px < 0 || py < 0 || px > W || py > H) { n++; continue; }',
  '    if (!bare(document.elementsFromPoint(px, py).find((q) => !el.contains(q)))) n++; } return n; };',
  '  if (hits(r.left, r.top) === 0) return;   // where it is, nothing is underneath',
  '  let top = m;   // under the phone\'s top menu row',
  "  for (const b of document.querySelectorAll('.mc-menu, .mc-chat-btn')) { const q = b.getBoundingClientRect(); if (q.width && q.bottom < H / 3) top = Math.max(top, q.bottom + 8); }",
  '  const spots = [[W - m - w, H - m - h], [m, H - m - h], [(W - w) / 2, top], [W - m - w, top], [m, top], [(W - w) / 2, (H - h) / 2]];',
  '  let best = null, bestN = 1e9;',
  '  for (const [x, y] of spots) { const n = hits(x, y); if (n < bestN) { best = [x, y]; bestN = n; } if (!n) break; }',
  '  if (!best) return;',
  "  el.style.left = Math.max(0, Math.round(best[0])) + 'px'; el.style.top = Math.max(0, Math.round(best[1])) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto';",
  '}',
  "try { window.addEventListener('resize', () => { try { const el = document.getElementById('guguma-ascend'); if (!el) return;",
  "  el.style.left = ''; el.style.top = ''; el.style.right = '18px'; el.style.bottom = '18px'; _lxAscendDock(el); } catch (e) {} }); } catch (e) {}",
  '// v0.30.1182 phone-fit - the title menu scrolls on a short screen (a landscape phone shows New Game and Co-op; Settings,',
  '// Save Backups and the links sit below the fold) and nothing said so. A "More" tab sits on the menu\'s bottom edge',
  '// while there is more below; a tap scrolls on; it goes away at the end.',
  'function _lxTitleMoreCue(stack) {',
  "  const ov = document.getElementById('loading-overlay');",
  '  if (!stack || !ov || stack._lxMoreCue) return;',
  "  const cue = document.createElement('button'); cue.type = 'button'; cue.id = 'lx-more-cue'; cue.setAttribute('aria-label', 'More options below - scroll the menu');",
  "  cue.innerHTML = 'More <span aria-hidden=\"true\">\u25BE</span>';",
  "  cue.onclick = () => { try { stack.scrollBy({ top: Math.max(90, stack.clientHeight * 0.7), behavior: 'smooth' }); } catch (e) { stack.scrollTop += 120; } };",
  '  ov.appendChild(cue); stack._lxMoreCue = cue;',
  '  const sync = () => {',
  '    const more = stack.isConnected && stack.clientHeight > 0 && (stack.scrollHeight - stack.clientHeight - stack.scrollTop) > 8;',
  "    stack.classList.toggle('lx-more', more); cue.classList.toggle('on', more);",
  '    if (!more) return;',
  '    const sr = stack.getBoundingClientRect(), or = ov.getBoundingClientRect();',
  "    cue.style.left = Math.round(sr.left - or.left + sr.width / 2) + 'px'; cue.style.top = Math.round(sr.bottom - or.top - cue.offsetHeight / 2) + 'px';",
  '  };',
  "  stack.addEventListener('scroll', sync, { passive: true }); window.addEventListener('resize', sync); ov.addEventListener('animationend', sync);",
  "  try { const ro = new ResizeObserver(sync); ro.observe(stack); for (const c of stack.querySelectorAll('#lo-auth, #lo-menu, #menu-name-panel, #menu-coop-panel, #lo-links')) ro.observe(c); } catch (e) {}",
  '  sync(); setTimeout(sync, 400); setTimeout(sync, 1600); setTimeout(sync, 3200);',
  '}',
  'function _gugumaAscendChip(show, expanded) {'), '_gugumaAscendChip signature');
once("el.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:100040;max-width:min(520px,92vw);'; document.body.appendChild(el); }",
  "el.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:65;max-width:min(520px,92vw);'; document.body.appendChild(el); }   /* v0.30.1182 phone-fit - under the panels (was 100040, over all of them) */" + EOL +
  "  if (!el._lxDockRO) { try { el._lxDockRO = new ResizeObserver(() => _lxAscendDock(el)); el._lxDockRO.observe(el); } catch (e) {} }   // v0.30.1182 phone-fit - docks whenever it shows or changes size", 'the Ascend chip creation');
once('      else if (!ok && shown) _gugumaAscendChip(false);', J(
  '      else if (!ok && shown) _gugumaAscendChip(false);',
  '      else if (ok && shown) _lxAscendDock();   // v0.30.1182 phone-fit - re-dock if a control moved under it'), 'the Ascend guard');

// ---- 4) the title menu hooks its "More" tab when the menu comes up ----
once('    try { _lxMenuInit(); } catch (e) {}   // v0.27.8 — Steam-style main menu', J(
  '    try { _lxMenuInit(); } catch (e) {}   // v0.27.8 — Steam-style main menu',
  '    try { _lxTitleMoreCue(stack); } catch (e) {}   // v0.30.1182 phone-fit - a "More" tab while the menu scrolls'), 'the title menu init');

const grew = s.length - n0;
if (grew < 7000 || grew > 14000) die('size moved ' + grew);
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
console.log('applied: phone-fit (+' + grew + ' chars)');
