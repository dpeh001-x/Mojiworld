// HUD clear (pre-launch audit npx #2 / #13, ui #8, 2026-09-27): four places where the HUD sat on top of the game.
// ============================================================================
//   1) The first quest's exit portal (Everdawn Central's right end, "-> Emerald Thicket"), its "Enter" plate and the
//      hero all sat under the quest tracker, Hotkeys, Taxi and the minimap; at the Void's right edge the hero walked
//      under the minimap and Hotkeys. The camera cannot frame them clear: it is pinned at the map's edge there, and the
//      Void is narrower than the screen. So the panels step aside instead: a short tick maps the hero's drawn box and
//      every on-screen portal (plus its plate while it shows) to screen px through the camera, and a right-hand HUD
//      panel over any of them fades to 0.3 (class lx-hud-yield - still clickable, hover brings it back).
//   2) The kill feed and coin pills ("+12 XP . +8") share bottom:182 with the quest tracker, so every pill landed on the
//      tracker's text. When their spot overlaps the tracker they now ride just above it (or beside a tall one).
//   3) Phones: the menu row (MAP ... CHAT) is fixed to the SCREEN's top edge, while the area nameplate, the world-affix
//      chip ("LUCID +12% EXP"), the quest tracker and the Multi chip live in the scaled game box and landed under it.
//      They drop below the row (68 screen px / the box's scale); chip and Multi share one line, the tracker sits under it.
//   4) A portal plate on a high perch is clamped to the top of the screen, and in the prologue that put
//      "Zodiac Sanctum (Lv 70+)" behind the Gravitos boss plate and the memory card. A plate that would land under the
//      boss plate, the prologue card or the area nameplate now hangs under the portal's floor instead.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxHudClearTick(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// the CSS: the yield class, and the phone re-flow under the menu row (a new block beside the nameplate's own one)
const ROW = 'calc((68px + env(safe-area-inset-top, 0px)) / var(--game-scale, 1))';
once('  <div id="map-label">The Void</div>', J(
  '  <style>',
  '    /* v0.30.1191 hud-clear - THE HUD MAKES WAY: a right-hand panel with the hero or a portal under it fades (see',
  '       _lxHudClearTick). Clicks still land on it, and pointing at it brings it back. */',
  '    .lx-hud-yield { opacity: 0.3 !important; transition: opacity 180ms ease; }',
  '    .lx-hud-yield:hover { opacity: 1 !important; }',
  '    /* v0.30.1191 hud-clear - PHONES: the menu row (MAP ... CHAT) is fixed to the SCREEN\'s top edge (14 px + a 46-50 px',
  '       button) but these live in the scaled 960x560 game box, where they landed under it. They drop below the row:',
  '       68 screen px = 68 / --game-scale box px. The Multi chip and the affix chip share that line, the tracker sits under it. */',
  '    body.mc-landscape:not(.hide-mobile-ctrl) #map-label { top: ' + ROW + '; }',
  '    body.mc-landscape:not(.hide-mobile-ctrl) #world-affix-pin { top: ' + ROW + '; right: calc(44px + env(safe-area-inset-right, 0px)); }',
  '    body.mc-landscape:not(.hide-mobile-ctrl) #mp-btn { top: ' + ROW + ' !important; right: calc(10px + env(safe-area-inset-right, 0px)) !important; }',
  '    body.mc-landscape:not(.hide-mobile-ctrl) #quest-tracker { top: calc(' + ROW.slice(5, -1) + ' + 32px); }',
  '  </style>',
  '  <div id="map-label">The Void</div>'), 'the nameplate div');

// the helpers, ahead of drawPortals
once('function drawPortals() {', J(
  '// v0.30.1191 hud-clear - which strips of the top of the screen are taken: the boss plate (drawSuperBossBar records its box),',
  '// the prologue\'s memory card and the area nameplate. [[x0, x1, bottom], ...] in canvas px; re-read every 10 frames, and',
  '// only asked while a portal plate is showing.',
  'let _lxTbAt = -1e9, _lxTbV = null;',
  'function _lxTopBands() {',
  '  const t = game.time | 0; if (_lxTbV && t >= _lxTbAt && t - _lxTbAt < 10) return _lxTbV;',
  '  const out = [];',
  '  if (game._bbLabelVeiled && game._lxBossPlateBox) out.push(game._lxBossPlateBox);',
  '  try {',
  "    const cv = document.getElementById('game'), R = cv && cv.getBoundingClientRect();",
  '    if (R && R.width > 0) {',
  '      const kk = W / R.width;',
  "      for (const id of ['prologue-hud', 'map-label']) {",
  "        const el = document.getElementById(id); if (!el || el.classList.contains('boss-veiled')) continue;",
  '        const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0) || parseFloat(getComputedStyle(el).opacity) < 0.05) continue;',
  '        out.push([(r.left - R.left) * kk, (r.right - R.left) * kk, (r.bottom - R.top) * kk + 4]);',
  '      }',
  '    }',
  '  } catch (e) {}',
  '  _lxTbAt = t; _lxTbV = out; return out;',
  '}',
  '// v0.30.1191 hud-clear - the world-y of a portal plate\'s top: where it has always sat (its bottom edge at feetY - 117), unless',
  '// that is under one of the strips above - then it hangs under the portal\'s floor. cx / w: the plate\'s world centre and width.',
  'function _lxPortalLblTop(feetY, h, cx, w) {',
  '  const top = Math.max(6, feetY - 143 - (h - 26));',
  '  const sTop = top - ((game.camera && game.camera.y) || 0), x0 = cx - w / 2 - ((game.camera && game.camera.x) || 0), x1 = x0 + w;',
  '  for (const b of _lxTopBands()) if (sTop < b[2] && x0 < b[1] && x1 > b[0]) return feetY + 8;',
  '  return top;',
  '}',
  'function drawPortals() {'), 'drawPortals');

// 1) the yield tick, beside the helpers above
once("// v0.30.1191 hud-clear - which strips of the top of the screen are taken", J(
  '// v0.30.1191 hud-clear - THE HUD MAKES WAY. Every 6th frame: the hero\'s drawn box (art + name tag, wider than the hitbox) and',
  '// every on-screen portal (+ its plate while it shows) go to screen px through the camera; a listed panel over any of them',
  '// gets lx-hud-yield (opacity 0.3), with 10 px of hysteresis so an edge does not flicker. Panel and canvas rects are',
  '// re-read every 30 frames only (they move on resize, a drag or a new tracker row), so the tick forces no layout.',
  "const _LX_HUD_YIELD_IDS = ['quest-tracker', 'hotkey-hint', 'taxi-btn', 'minimap', 'world-affix-pin', 'pq-objective-pin', 'lx-corner'];",
  'let _lxHcN = 0, _lxHcRectN = -1e9, _lxHcRects = null, _lxHcCv = null;',
  'function _lxHudClearTick() {',
  '  if ((++_lxHcN) % 6) return;',
  '  try {',
  "    if (typeof game === 'undefined' || !game || !game.camera || typeof player === 'undefined' || !player) return;",
  '    if (!_lxHcRects || _lxHcN - _lxHcRectN >= 30) {',
  "      _lxHcRectN = _lxHcN; _lxHcRects = []; const cv = document.getElementById('game'); _lxHcCv = cv ? cv.getBoundingClientRect() : null;",
  '      for (const id of _LX_HUD_YIELD_IDS) { const el = document.getElementById(id); if (!el) continue; const r = el.getBoundingClientRect(); _lxHcRects.push([el, (r.width > 0 && r.height > 0) ? r : null]); }',
  '    }',
  '    const R = _lxHcCv; if (!R || !(R.width > 0)) return;',
  '    const k = R.width / W, cx = game.camera.x || 0, cy = game.camera.y || 0;',
  '    const box = (x, y, w, h) => [R.left + (x - cx) * k, R.top + (y - cy) * k, R.left + (x + w - cx) * k, R.top + (y + h - cy) * k];',
  '    const T = [box(player.x - 22, player.y - 48, player.w + 44, player.h + 70)];',
  '    const pcx = player.x + player.w / 2, pfy = player.y + player.h;',
  '    for (const po of (game.portals || [])) {',
  '      const sx = po.x - cx; if (sx + 110 < 0 || sx - 110 > W) continue;',
  "      const fy = (typeof po.y === 'number') ? po.y : ((typeof _defaultPortalY === 'function') ? _defaultPortalY(po.x) : 480);",
  '      T.push(box(po.x - 56, fy - 142, 112, 142));',
  '      if (Math.abs(pcx - po.x) < 100 && Math.abs(pfy - fy) < 120) { const lw = po._lblW || 150, lh = po._lblH || 46; T.push(box(po.x - lw / 2, _lxPortalLblTop(fy, lh, po.x, lw), lw, lh)); }',
  '    }',
  '    for (const e of _lxHcRects) {',
  "      const el = e[0], r = e[1], on = el.classList.contains('lx-hud-yield'), m = on ? 10 : 0;",
  '      let hit = false;',
  '      if (r) for (const t of T) if (t[0] < r.right + m && t[2] > r.left - m && t[1] < r.bottom + m && t[3] > r.top - m) { hit = true; break; }',
  "      if (hit !== on) el.classList.toggle('lx-hud-yield', hit);",
  '    }',
  '  } catch (e) {}',
  '}',
  "// v0.30.1191 hud-clear - which strips of the top of the screen are taken"), 'the helper block head');

// 2) the kill feed / coin pills: off the tracker
once('function showCoinToast(amt, rarity) {', J(
  '// v0.30.1191 hud-clear - the pills\' own spot (bottom:182, right:10) is the quest tracker\'s too. When it overlaps the tracker',
  '// the zone moves just above it (room for four pills below the top-right chips), else beside it; measured when a pill is',
  '// added and cached until the tracker or the window changes. No tracker, or a tracker dragged away: the CSS spot.',
  'let _lxCzKey = null;',
  'function _lxCoinZoneClear(host) {',
  '  try {',
  "    const qt = document.getElementById('quest-tracker'), qr = qt ? qt.getBoundingClientRect() : null;",
  '    const on = !!(qr && qr.width > 0 && qr.height > 0);',
  "    const key = on ? [qr.left, qr.top, qr.right, qr.bottom, innerWidth, innerHeight].map(Math.round).join(',') : '';",
  '    if (key === _lxCzKey) return;',
  "    _lxCzKey = key; host.style.bottom = ''; host.style.right = '';",
  '    if (!on) return;',
  '    const P = host.offsetParent, pr = P && P.getBoundingClientRect(); if (!pr || !(P.offsetWidth > 0)) return;',
  '    const k = pr.width / P.offsetWidth, hr = host.getBoundingClientRect();',
  '    const x0 = hr.right - Math.max(hr.width, 150 * k), y0 = hr.bottom - 4 * 24 * k;   // four pills stack up from the bottom-right corner',
  '    if (!(x0 < qr.right + 4 * k && hr.right > qr.left - 4 * k && y0 < qr.bottom + 4 * k && hr.bottom > qr.top - 4 * k)) return;',
  '    const cs = getComputedStyle(host), b0 = parseFloat(cs.bottom) || 0, r0 = parseFloat(cs.right) || 0;',
  '    const above = qr.top - 6 * k - 4 * 24 * k >= pr.top + 96 * k;',
  '    const by = above ? qr.top - 6 * k : qr.bottom, rx = above ? qr.right : qr.left - 8 * k;',
  "    host.style.bottom = (b0 + (hr.bottom - by) / k).toFixed(1) + 'px'; host.style.right = (r0 + (hr.right - rx) / k).toFixed(1) + 'px';",
  '  } catch (e) {}',
  '}',
  'function showCoinToast(amt, rarity) {'), 'showCoinToast');
once(J('  host.appendChild(t);', '  setTimeout(() => { if (t && t.parentNode) t.parentNode.removeChild(t); }, 3200);'),
  J('  host.appendChild(t);', '  _lxCoinZoneClear(host);   // v0.30.1191 hud-clear', '  setTimeout(() => { if (t && t.parentNode) t.parentNode.removeChild(t); }, 3200);'), 'the coin pill append');
once(J('  host.appendChild(t);', '  host._lxAgg = { t: _tNow, el: t, exp: _exp, moj: _moj };'),
  J('  host.appendChild(t);', '  _lxCoinZoneClear(host);   // v0.30.1191 hud-clear', '  host._lxAgg = { t: _tNow, el: t, exp: _exp, moj: _moj };'), 'the kill pill append');

// 4) the portal plate's y, and the boss plate's box
once('        Math.round(Math.max(6, _lblFeetY - 143 - ((po._lblH || 46) - 26))),',
  '        Math.round(_lxPortalLblTop(_lblFeetY, po._lblH || 46, po.x, po._lblW || 150)),   // v0.30.1191 hud-clear - under its floor when the top strip is taken',
  'the portal plate y');
once('  const x = Math.round((W - barW) / 2), y = Math.max(34, Math.round(24 + 12 + _bbTall));', J(
  '  const x = Math.round((W - barW) / 2), y = Math.max(34, Math.round(24 + 12 + _bbTall));',
  '  // v0.30.1191 hud-clear - the plate\'s box for _lxTopBands: the bar, plus the frame\'s bottom rail when the art is in',
  '  game._lxBossPlateBox = [x, x + barW, y + barH + (_bbTall > 0 ? (_BB_GEOM.H - _BB_GEOM.hy1) * barH / (_BB_GEOM.hy1 - _BB_GEOM.hy0) : 0) + 4];'),
  'the boss plate geometry');

// 1) the tick, beside the minimap update
once('  if (game.time % 4 === 0 && !_lxRenderOnly) drawMinimap();   // hz-smooth', J(
  '  if (game.time % 4 === 0 && !_lxRenderOnly) drawMinimap();   // hz-smooth',
  "  if (!_lxRenderOnly && typeof _lxHudClearTick === 'function') _lxHudClearTick();   // v0.30.1191 hud-clear - the HUD makes way for the hero / portals"),
  'the minimap tick');

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
console.log('applied: hud-clear (+' + grew + ' chars)');
