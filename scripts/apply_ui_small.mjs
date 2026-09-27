// UI on the smallest phones (ui-small): what 568x320 landscape (iPhone SE 1st gen, touch) still got wrong after phone-fit
// and ui-polish2.
// ============================================================================
// 1) THE ASCEND PILL SAT ON A SKILL BUTTON. At the level cap Guguma's "Ascend" pill docks where nothing but the game view is
//    underneath (phone-fit). At 568x320 all six of its spots were taken (the d-pad, the potions, the skill buttons, the
//    menu row), so it took the least-covered one - over a locked skill button, which the dock never saw: a locked button
//    lets touches through, so its point test (elementsFromPoint) skips it, and the 15 sample points can step between
//    small buttons. Now the dock also counts every touch-deck button by its box (_lxAscendDeckHits), and when all six
//    spots are taken on a phone the pill tries every spot flush against a control's edge - full size first, then sized
//    down (0.9 / 0.8 / 0.7, the look untouched) - and takes the clear one nearest the middle under the menu row
//    (_lxAscendPillSpot). A size change runs a frame later (never inside the pill's own ResizeObserver callback - that
//    is the "ResizeObserver loop" error ui-polish2 hit); a window resize starts it at full size again.
// 2) THE U PANEL'S SHORTCUT ROW WRAPPED. On touch and narrow screens every panel is 92vw of the real window (not of the
//    scaled game box), so at 568 the row is ~453 px wide and the six shortcuts (~536 px) put "Achievements" on a line of
//    its own. Sizes only, in steps by window width: tighter padding and gaps (<= 700), then each shortcut scaled
//    (0.86 at <= 620, 0.76 at <= 540). Colours, fonts and borders are untouched.
// 3) THE NAME STEP'S BUTTONS WERE BELOW THE FOLD. After New Game (and Play Co-op) on a 320 px tall screen the logo kept
//    the top of the title card, the name field sat at the bottom edge, and "Enter Mojiworld" and Back were out of sight
//    under the "More" tab. Now the card scrolls itself so the panel's buttons are in view above that tab, never past the
//    field that takes the focus (_lxMenuShow).
// Placement and sizing only - no colours, fonts or borders change. Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxAscendPillSpot(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// ---- 2) the stylesheet (after ui-polish2's block, ahead of ui-text-fixes') ----
once('<style id="lx-ui-text-fixes-css">', J(
  '<style id="lx-ui-small-css">',
  '  /* v0.30.1240 ui-small - 2) the U panel\'s shortcut row on a small phone: every panel is 92vw of the real window there, so at',
  '     568x320 the row is ~453 px and the six shortcuts (~536 px) wrapped. Sizes only, in steps: tighter padding and gaps,',
  '     then each shortcut scaled. The look (colours, font, borders) is untouched. */',
  '  @media (max-width: 700px) {',
  '    #attributes-modal#attributes-modal #u-jump-row#u-jump-row { gap: 3px; }',
  '    #attributes-modal#attributes-modal #u-jump-row#u-jump-row .u-jump { padding: 4px 5px 4px 4px; gap: 3px; }',
  '    #attributes-modal#attributes-modal #u-jump-row#u-jump-row .u-jump .uj-ico { width: 16px; height: 16px; flex: 0 0 16px; }',
  '  }',
  '  @media (max-width: 620px) { #attributes-modal#attributes-modal #u-jump-row#u-jump-row .u-jump { zoom: 0.86; } }',
  '  @media (max-width: 540px) { #attributes-modal#attributes-modal #u-jump-row#u-jump-row .u-jump { zoom: 0.76; } }',
  '</style>',
  '<style id="lx-ui-text-fixes-css">'), 'the ui-text-fixes stylesheet');

// ---- 1) the Ascend pill ----
once('function _lxAscendDock(el) {', J(
  '// v0.30.1240 ui-small - THE TOUCH DECK BY ITS BOXES. A locked skill button lets touches through, so the dock\'s point test',
  '// (elementsFromPoint) never saw it, and 15 sample points can step between small buttons: at 568x320 the pill settled on',
  '// a locked skill button. Every visible deck button counts here by its box (2 px to spare). [] = not a phone layout.',
  'function _lxAscendDeckRects() {',
  '  const b = document.body;',
  "  if (!b.classList.contains('mc-landscape') || b.classList.contains('hide-mobile-ctrl')) return [];",
  '  const out = [];',
  "  for (const q of document.querySelectorAll('#mobile-deck .mc-btn, #mobile-deck .mc-dpad, #mobile-ctrl .mc-btn, #mobile-ctrl-toggle, #skill-bar, .mc-menu, .mc-chat-btn, #fullscreen-btn, #settings-btn')) {",
  "    const cs = getComputedStyle(q); if (cs.display === 'none' || cs.visibility === 'hidden') continue;",
  '    const r = q.getBoundingClientRect(); if (r.width && r.height) out.push([r.left, r.top, r.right, r.bottom]);',
  '  }',
  '  return out;',
  '}',
  'function _lxAscendDeckHits(x, y, w, h, R) {   // v0.30.1240 ui-small - deck buttons under a box, weighted over the point samples',
  '  R = R || _lxAscendDeckRects(); let n = 0;',
  '  for (const q of R) if (x < q[2] + 2 && x + w > q[0] - 2 && y < q[3] + 2 && y + h > q[1] - 2) n++;',
  '  return n * 3;',
  '}',
  '// v0.30.1240 ui-small - A SMALL PHONE: THE PILL FINDS THE GAP BETWEEN THE CONTROLS. Called when the dock\'s six spots are all',
  '// taken. Tries every spot flush against a deck button\'s edge (and the dock\'s own anchors), full size first, then sized',
  '// down (0.9 / 0.8 / 0.7 - the look untouched), and takes the one clear of every deck button and of anything but the game',
  '// view (the dock\'s point test), nearest the middle under the menu row. A size change is applied a frame later: this runs',
  '// inside the pill\'s own ResizeObserver callback, where a resize is a loop error. true = placed (or placing next frame).',
  'function _lxAscendPillSpot(el, w, h, top) {',
  '  const pill = el.firstElementChild, W = window.innerWidth, H = window.innerHeight;',
  "  if (!pill || pill.id !== 'guguma-ascend-pill' || !w || !h) return false;",
  '  const R = _lxAscendDeckRects(); if (!R.length) return false;   // not a phone layout: the dock\'s spot stands',
  "  const bare = (e) => !e || e === document.body || e === document.documentElement || e.id === 'game' || (e.classList && e.classList.contains('game-wrapper'));",
  '  const clear = (x, y, pw, ph) => { for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {',
  '    if (!bare(document.elementsFromPoint(x + (i + 0.5) * pw / 5, y + (j + 0.5) * ph / 3).find((q) => !el.contains(q)))) return false; } return true; };',
  '  const z0 = parseFloat(pill.style.zoom) || 1, m = 4;',
  '  for (const z of [1, 0.9, 0.8, 0.7]) {',
  '    const pw = w * z / z0, ph = h * z / z0, ax = (W - pw) / 2, ay = Math.min(top, H - m - ph);',
  '    const xs = new Set([m, W - m - pw, ax]), ys = new Set([m, H - m - ph, ay, (H - ph) / 2]);',
  '    for (const q of R) { xs.add(q[2] + m); xs.add(q[0] - m - pw); ys.add(q[3] + m); ys.add(q[1] - m - ph); }',
  '    const C = [];',
  '    for (const x of xs) { if (x < 0 || x + pw > W) continue;',
  '      for (const y of ys) { if (y < 0 || y + ph > H || _lxAscendDeckHits(x, y, pw, ph, R)) continue; C.push([x, y, Math.hypot(x - ax, y - ay)]); } }',
  '    C.sort((a, b) => a[2] - b[2]);',
  '    const pick = C.slice(0, 60).find((c) => clear(c[0], c[1], pw, ph));',
  '    if (!pick) continue;',
  "    const put = () => { el.style.left = Math.round(pick[0]) + 'px'; el.style.top = Math.round(pick[1]) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; };",
  '    if (z === z0) put();',
  "    else requestAnimationFrame(() => { try { if (el.firstElementChild !== pill) return; pill.style.zoom = (z === 1) ? '' : String(z); put(); } catch (e) {} });",
  '    return true;',
  '  }',
  '  return false;',
  '}',
  'function _lxAscendDock(el) {'), '_lxAscendDock signature');
once("    if (!bare(document.elementsFromPoint(px, py).find((q) => !el.contains(q)))) n++; } return n; };",
  "    if (!bare(document.elementsFromPoint(px, py).find((q) => !el.contains(q)))) n++; } return n + _lxAscendDeckHits(x, y, w, h); };   // v0.30.1240 ui-small - + deck buttons by their boxes",
  "_lxAscendDock's point test");
once('  for (const [x, y] of spots) { const n = hits(x, y); if (n < bestN) { best = [x, y]; bestN = n; } if (!n) break; }',
  J('  for (const [x, y] of spots) { const n = hits(x, y); if (n < bestN) { best = [x, y]; bestN = n; } if (!n) break; }',
    '  if (bestN > 0 && _lxAscendPillSpot(el, w, h, top)) return;   // v0.30.1240 ui-small - all six taken (a small phone): the gap between the controls'),
  "_lxAscendDock's spot loop");
once("  el.style.left = ''; el.style.top = ''; el.style.right = '18px'; el.style.bottom = '18px'; _lxAscendDock(el); } catch (e) {} }); } catch (e) {}",
  "  if (el.firstElementChild && el.firstElementChild.id === 'guguma-ascend-pill') el.firstElementChild.style.zoom = '';   /* v0.30.1240 ui-small - full size again on a new screen */\n  el.style.left = ''; el.style.top = ''; el.style.right = '18px'; el.style.bottom = '18px'; _lxAscendDock(el); } catch (e) {} }); } catch (e) {}".replace('\n', EOL),
  "the pill's resize handler");

// ---- 3) the name / co-op step on a short screen ----
once(J("      el.style.display = (p === id) ? (p === 'lo-menu' ? 'flex' : 'block') : 'none';", '    }', '  }'), J(
  "      el.style.display = (p === id) ? (p === 'lo-menu' ? 'flex' : 'block') : 'none';",
  '    }',
  "    // v0.30.1240 ui-small - a short screen (568x320): the logo kept the top of the card and the step's buttons sat below the fold,",
  '    // under the "More" tab. The card scrolls itself so the panel\'s last button clears that tab (36 px), never past the',
  '    // field that takes the focus. Measured next frame, the panel\'s slide-in offset taken out.',
  "    if (id !== 'lo-menu') requestAnimationFrame(() => { try {",
  "      const pn = document.getElementById(id), st = pn && pn.closest('.lo-stack'); if (!st || !pn.offsetHeight) return;",
  "      const f = pn.querySelector(id === 'menu-coop-panel' ? '#menu-coop-code' : '#auth-user') || pn, sr = st.getBoundingClientRect();",
  '      const k = st.offsetHeight / (sr.height || 1), dy = new DOMMatrix(getComputedStyle(pn).transform).f;',
  '      const need = pn.getBoundingClientRect().bottom - dy - (sr.bottom - 36), room = f.getBoundingClientRect().top - dy - sr.top - 4;',
  '      if (need > 0 && room > 0) st.scrollTop += Math.min(need, room) * k;',
  '    } catch (e) {} });',
  '  }'), "_lxMenuShow's panel switch");

const grew = s.length - n0;
if (grew < 4000 || grew > 9000) die('size moved ' + grew);
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
console.log('applied: ui-small (+' + grew + ' chars)');
