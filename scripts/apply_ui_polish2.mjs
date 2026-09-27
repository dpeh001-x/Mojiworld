// UI polish, round 2 (ui-polish2): three leftovers the phone-fit, hud-clear and ui-text-fixes builders reported.
// ============================================================================
// 1) PHONE TOASTS. hud-clear (v0.30.1191) moved the affix chip, the Multi chip and the quest tracker below the phone's
//    menu row - into the top-right corner where the pop-up notifications stack. Three toasts covered all of them. Now,
//    with the touch deck up and no panel open, the stack sits in the free band between the HUD card and that column:
//    centred, under the menu row and the area nameplate, and it stops above the deck's buttons (_lxToastPhoneSpot,
//    asked by _lxToastDodge whenever a toast shows). Anywhere else the stack keeps its corner.
// 2) U PANEL SHORTCUT ROW ON A PHONE. The six shortcuts carried key chips (W / Q / Y / L) that a touch screen has no use
//    for, and at 667 px "Achievements" wrapped onto its own row. On a touch screen or a narrow window (the test the
//    close hints use since ui-text-fixes) the key chips are hidden, and the row is one line at 844 and 667.
// 3) THE EXPANDED GUGUMA CARD ON A PHONE. The level-cap offer (480 x 166) found no clear spot among the touch controls
//    and sat on the d-pad, the potions or the skill buttons (the dock's 15-point sampling stepped between small buttons).
//    With the deck up the card is now sized down (zoom 1 .. 0.6, the look untouched) until a spot clear of every deck
//    button exists - clear of the HUD card, nameplate and tracker too where possible - nearest the upper middle
//    (_lxAscendPhoneFit, from _lxAscendDock). If there is none even at 0.6 and Guguma raised it herself (the level-up
//    at the cap), it folds to the pill; one the player opened from the pill stays at the least-covered spot. The fit runs a
//    frame late (the card hidden meanwhile): moving the card inside its own ResizeObserver callback, as the dock did at
//    667x375, raised "ResizeObserver loop completed" and with it the "Something went wrong" toast.
// Placement, sizing and visibility only - no colours, fonts or borders change. Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxToastPhoneSpot(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// ---- the stylesheet (after phone-fit's block, ahead of ui-text-fixes') ----
once('<style id="lx-ui-text-fixes-css">', J(
  '<style id="lx-ui-polish2-css">',
  '  /* v0.30.1230 ui-polish2 - 1) phones: the toast stack centred in the free band (see _lxToastPhoneSpot); the plates keep their look */',
  '  #toast-container.lx-toast-phone { align-items: center; }',
  '  /* v0.30.1230 ui-polish2 - 2) the U panel\'s shortcut row on a touch screen or a narrow window (the close hints\' test since',
  '     ui-text-fixes): no keys to press, so the key chips go, and the six shortcuts fit on one line at 844 and 667 */',
  '  @media (pointer: coarse), (max-width: 900px) {',
  '    #attributes-modal#attributes-modal #u-jump-row#u-jump-row .u-jump kbd { display: none !important; }',
  '  }',
  '</style>',
  '<style id="lx-ui-text-fixes-css">'), 'the ui-text-fixes stylesheet');

// ---- 1) the toast stack on a phone ----
once('function _lxToastDodge() {', J(
  '// v0.30.1230 ui-polish2 - PHONES: the stack\'s corner (top-right, under the menu row) is where hud-clear put the affix chip, the',
  '// Multi chip and the quest tracker, so three toasts covered all of them. With the touch deck up and no panel open the stack',
  '// sits in the free band between the HUD card (left) and that column (right): centred, under the menu row and the area',
  '// nameplate, and it stops above the deck\'s buttons. false = not a phone layout (or no room): the stack keeps its corner.',
  'function _lxToastPhoneSpot(host, pr, k, reset) {',
  '  const b = document.body;',
  "  if (!b.classList.contains('mc-landscape') || b.classList.contains('hide-mobile-ctrl')) return false;",
  '  const W = window.innerWidth, H = window.innerHeight;',
  "  const box = (el) => { if (!el) return null; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return null;",
  '    const r = el.getBoundingClientRect(); return (r.width > 0 && r.height > 0) ? r : null; };',
  '  let top = 0, left = 0, right = W;',
  "  for (const el of document.querySelectorAll('#mobile-ctrl .mc-btn, #map-label')) { const r = box(el); if (r && r.bottom < H / 2) top = Math.max(top, r.bottom); }",
  "  const hud = box(document.getElementById('top-ui')); if (hud && hud.right < W / 2) left = hud.right;",
  "  for (const id of ['world-affix-pin', 'mp-btn', 'quest-tracker']) { const r = box(document.getElementById(id)); if (r && r.left > W / 2) right = Math.min(right, r.left); }",
  '  // the column: as wide as a toast may be (min(30vw, 340px) in the wrapper\'s px) and centred in the band',
  '  const tw = Math.min(right - left - 12, Math.min(W * 0.3, 340) * k + 8), cx = (left + right) / 2, x0 = cx - tw / 2, x1 = cx + tw / 2;',
  '  let bottom = H;',
  "  for (const el of document.querySelectorAll('#mobile-deck .mc-btn, #mobile-deck .mc-dpad, #skill-bar')) { const r = box(el);",
  '    if (r && r.top > top && r.left < x1 && r.right > x0) bottom = Math.min(bottom, r.top); }',
  '  const y0 = top + 4, maxH = bottom - 6 - y0;',
  '  if (tw < 90 || maxH < 40) return false;',
  '  const css = (px) => Math.round(px / k);   // viewport px -> the wrapper\'s own px',
  "  const key = ['ph', css(x0 - pr.left), css(pr.right - x1), css(y0 - pr.top), css(maxH)].join('|');",
  '  if (host._lxDodge === key) return true;',
  "  reset(); host._lxDodge = key; host.classList.add('lx-toast-phone');",
  "  host.style.left = css(x0 - pr.left) + 'px'; host.style.right = css(pr.right - x1) + 'px'; host.style.top = css(y0 - pr.top) + 'px'; host.style.maxHeight = css(maxH) + 'px';",
  '  return true;',
  '}',
  'function _lxToastDodge() {'), '_lxToastDodge signature');
once(J("  const reset = () => { if (!host._lxDodge) return; host._lxDodge = null; host.classList.remove('lx-dodge', 'lx-dodge-left', 'lx-dodge-dim', 'lx-dodge-narrow');",
  "    for (const p of ['left', 'right', 'top', 'maxWidth']) host.style[p] = ''; host.style.removeProperty('--lx-toast-max'); };"),
  J("  const reset = () => { if (!host._lxDodge) return; host._lxDodge = null; host.classList.remove('lx-dodge', 'lx-dodge-left', 'lx-dodge-dim', 'lx-dodge-narrow', 'lx-toast-phone');   // v0.30.1230 ui-polish2 - + the phone spot",
    "    for (const p of ['left', 'right', 'top', 'maxWidth', 'maxHeight']) host.style[p] = ''; host.style.removeProperty('--lx-toast-max'); };"), "_lxToastDodge's reset");
once('  if (!U) { reset(); return; }', "  if (!U) { if (!_lxToastPhoneSpot(host, pr, k, reset)) reset(); return; }   // v0.30.1230 ui-polish2 - no panel: on a phone, the free band", "_lxToastDodge's no-panel exit");

// ---- 3) the expanded Guguma card on a phone ----
once('function _lxAscendDock(el) {', J(
  '// v0.30.1230 ui-polish2 - PHONES: THE EXPANDED CARD FITS BETWEEN THE CONTROLS. The pill finds a clear spot (below), but the full',
  '// card (the level-cap offer, 480 x 166) had none: wherever it went it sat on the d-pad, the potions or the skill buttons, and the',
  '// 15-point sampling below could step between small buttons. With the touch deck up the card is sized down (zoom 1 .. 0.6 - the',
  '// look untouched) until a spot clear of every deck button exists - clear of the HUD card, nameplate and tracker too if it can',
  '// be at 0.72 or more - nearest the upper middle. None even at 0.6: an offer Guguma raised herself (the level-up at the cap)',
  '// folds to the pill; one the player opened from the pill stays, at the least-covered spot. true = placed here.',
  'function _lxAscendPhoneFit(el) {',
  '  const b = document.body, card = el.firstElementChild;',
  "  if (!card || !card.classList.contains('guguma-tutorial')) return false;   // the pill: the dock below",
  "  if (!b.classList.contains('mc-landscape') || b.classList.contains('hide-mobile-ctrl')) {   // not a phone layout (any more): full size, next frame",
  "    if (card.style.zoom) { el._lxFitW = 0; requestAnimationFrame(() => { card.style.zoom = ''; }); } return false; }",
  '  const W = window.innerWidth, H = window.innerHeight, m = 6;',
  "  const rects = (sel) => [...document.querySelectorAll(sel)].map((q) => { const cs = getComputedStyle(q); if (cs.display === 'none' || cs.visibility === 'hidden') return null;",
  '    const r = q.getBoundingClientRect(); return (r.width && r.height) ? [r.left - m, r.top - m, r.right + m, r.bottom + m] : null; }).filter(Boolean);',
  "  const hard = rects('#mobile-deck .mc-btn, #mobile-deck .mc-dpad, #mobile-ctrl .mc-btn, #mobile-ctrl-toggle, #skill-bar, #fullscreen-btn, #settings-btn');",
  "  const soft = rects('#top-ui, #map-label, #world-affix-pin, #mp-btn, #quest-tracker, #minimap');",
  '  const hit = (x, y, w, h, L) => L.some((q) => x < q[2] && x + w > q[0] && y < q[3] && y + h > q[1]);',
  '  const r0 = el.getBoundingClientRect();',
  '  const keep = hard.map((q) => [q[0] + 4, q[1] + 4, q[2] - 4, q[3] - 4]);   // placed with 6 px to spare, kept while 2 px remain (a pulsing button does not re-fit it)',
  '  if (el._lxFitW === W && el._lxFitH === H && card.style.zoom && !hit(r0.left, r0.top, r0.width, r0.height, keep)) return true;   // placed, still clear',
  "  if (el._lxNoFit === W + 'x' + H) return false;   // nothing fits this screen (opened from the pill): the dock's spot, not a re-try every tick",
  '  // the fit resizes the card, and a resize inside the card\'s own ResizeObserver callback is a loop error: it runs next frame,',
  '  // the card out of sight until then (no flash of the full-size card over the deck)',
  '  if (!el._lxFitNow) {',
  "    el.style.visibility = 'hidden';",
  '    if (!el._lxFitQ) { el._lxFitQ = true; requestAnimationFrame(() => { el._lxFitQ = false; el._lxFitNow = true;',
  "      try { _lxAscendDock(el); } catch (e) {} finally { el._lxFitNow = false; el.style.visibility = ''; } }); }",
  '    return true;',
  '  }',
  '  const spotAt = (z, needSoft) => {',
  '    card.style.zoom = String(z);',
  '    const r = el.getBoundingClientRect(), w = r.width, h = r.height; if (w > W || h > H) return null;',
  '    const ax = (W - w) / 2, ay = (H - h) * 0.4, xs = new Set([m, W - m - w, ax]), ys = new Set([m, H - m - h, ay]);',
  '    for (const q of hard.concat(soft)) { xs.add(q[2]); xs.add(q[0] - w); ys.add(q[3]); ys.add(q[1] - h); }',
  '    let best = null;',
  '    for (const x of xs) { if (x < 0 || x + w > W) continue;',
  '      for (const y of ys) { if (y < 0 || y + h > H || hit(x, y, w, h, hard) || (needSoft && hit(x, y, w, h, soft))) continue;',
  '        const d = Math.hypot(x - ax, y - ay); if (!best || d < best[2]) best = [x, y, d]; } }',
  '    return best;',
  '  };',
  '  const Z = [1, 0.9, 0.8, 0.72, 0.66, 0.6];',
  '  let pick = null;',
  '  for (const z of Z) { if (z < 0.72) break; const p = spotAt(z, true); if (p) { pick = [z, p]; break; } }',
  '  if (!pick) for (const z of Z) { const p = spotAt(z, false); if (p) { pick = [z, p]; break; } }',
  '  el._lxFitW = W; el._lxFitH = H;',
  '  if (!pick) {',
  "    if (el._lxAuto) { el._lxAuto = false; _gugumaAscendChip(true, false); return true; }   // (a frame callback here, not the observer's)",
  "    el._lxNoFit = W + 'x' + H; return false;   // opened from the pill: the smallest size, at the dock's least-covered spot",
  '  }',
  '  card.style.zoom = String(pick[0]);',
  "  el.style.left = Math.round(pick[1][0]) + 'px'; el.style.top = Math.round(pick[1][1]) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto';",
  '  return true;',
  '}',
  'function _lxAscendDock(el) {'), '_lxAscendDock signature');
once('  const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;   // hidden while a panel is open: keep its spot',
  J('  const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;   // hidden while a panel is open: keep its spot',
    '  if (_lxAscendPhoneFit(el)) return;   // v0.30.1230 ui-polish2 - the expanded card on a phone: sized and placed clear of the deck'), "_lxAscendDock's first measure");
once('  if (!el._lxDockRO) { try { el._lxDockRO = new ResizeObserver(() => _lxAscendDock(el)); el._lxDockRO.observe(el); } catch (e) {} }   // v0.30.1182 phone-fit - docks whenever it shows or changes size',
  J('  if (!el._lxDockRO) { try { el._lxDockRO = new ResizeObserver(() => _lxAscendDock(el)); el._lxDockRO.observe(el); } catch (e) {} }   // v0.30.1182 phone-fit - docks whenever it shows or changes size',
    "  el._lxAuto = !!(expanded && window._lxAscAuto); el._lxFitW = 0; el._lxNoFit = '';   // v0.30.1230 ui-polish2 - raised by Guguma (may fold on a phone) or opened by the player"), "_gugumaAscendChip's dock observer");
once('  _gugumaAscendChip(true, !quiet);',
  '  window._lxAscAuto = !quiet; try { _gugumaAscendChip(true, !quiet); } finally { window._lxAscAuto = false; }   // v0.30.1230 ui-polish2 - Guguma raised it herself',
  "_gugumaAscendPrompt's raise");

const grew = s.length - n0;
if (grew < 5000 || grew > 12000) die('size moved ' + grew);
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
console.log('applied: ui-polish2 (+' + grew + ' chars)');
