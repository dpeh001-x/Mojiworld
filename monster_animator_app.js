/* monster_animator_app.js — drives monster_animator.html.
 * Replays idle/walk/attack for any animated monster/boss using the SAME
 * foot-anchor + sizeFactor math as the game, and lets you hand-tune a per-state
 * { s, dx, dy } calibration. Saves live to localStorage('lx_anim_calib') (the
 * running game picks it up via its 'storage' listener) and exports anim_calib.js. */
(function () {
  'use strict';
  const MAN = window.LX_ANIM_MANIFEST || {};
  const BAKED = window.LX_ANIM_CALIB || {};
  const LS_KEY = 'lx_anim_calib';
  const STATES = ['idle', 'walk', 'attack'];
  const COL = { idle: '#4cc9f0', walk: '#ffd166', attack: '#ef476f' };
  const DEF = () => ({ s: 1, dx: 0, dy: 0 });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const DISPLAY_H = 220;            // on-screen px the BASE sprite renders to

  // ---- merged calibration (baked file < localStorage), mutated live ----
  function loadCalib() {
    let ls = null; try { ls = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (_) {}
    const out = {};
    for (const t of Object.keys(MAN)) {
      out[t] = {};
      for (const s of STATES) {
        const b = BAKED[t] && BAKED[t][s], l = ls && ls[t] && ls[t][s], e = l || b || DEF();
        out[t][s] = { s: +e.s > 0 ? +e.s : 1, dx: +e.dx || 0, dy: +e.dy || 0 };
      }
    }
    return out;
  }
  let CALIB = loadCalib();

  // ---- per-(type, state) ATTACK hitbox (the game's _atkMonBox override) ----
  // Units are FRACTIONS of the rendered visual height (same basis as calib
  // dx/dy): w/h = box size, ox = horizontal offset of box center from the foot
  // anchor, oy = offset of box BOTTOM from the foot line (+down). An entry only
  // exists when customized; otherwise the game keeps its default fraction box.
  const HB_LS_KEY = 'lx_atk_hitbox';
  const HB_BAKED = window.LX_ATK_HITBOX || {};
  function loadHitbox() {
    let ls = null; try { ls = JSON.parse(localStorage.getItem(HB_LS_KEY) || 'null'); } catch (_) {}
    const out = {};
    for (const t of Object.keys(MAN)) {
      out[t] = {};
      for (const s of STATES) {
        const e = (ls && ls[t] && ls[t][s]) || (HB_BAKED[t] && HB_BAKED[t][s]) || null;
        if (e) out[t][s] = { w: +e.w || 0.5, h: +e.h || 0.5, ox: +e.ox || 0, oy: +e.oy || 0 };
      }
    }
    return out;
  }
  let HBX = loadHitbox();
  // The game's DEFAULT attack box for (ent, st), in editor units — mirrors
  // _atkMonBox: centred fraction f of the visual box (monsters f=0.90, centred
  // vertically; bosses f=0.60, anchored at the foot growing upward).
  function defaultHB(ent, st) {
    const g = stateGeom(ent, st); if (!g) return { w: 0.5, h: 0.5, ox: 0, oy: 0 };
    const f = ent.group === 'boss' ? 0.60 : 0.90;
    const aspect = g.targetW / g.previewH;
    return ent.group === 'boss'
      ? { w: +(f * aspect).toFixed(4), h: f, ox: 0, oy: 0 }
      : { w: +(f * aspect).toFixed(4), h: f, ox: 0, oy: +(-(1 - f) / 2).toFixed(4) };
  }
  const hbFor = (t, st) => (HBX[t] && HBX[t][st]) || null;

  // ---- runtime state ----
  let cur = null, frames = {}, frameIdx = 0, fps = 8, lastT = 0, overlay = false, focusState = 'idle';
  // v0.29.139 — GAME-ACCURATE playback + scale (reconciled per user: "the
  // editor must play exactly what plays in the game, to on-screen scale").
  //   gameTiming (default ON): per-mode frame clocks lifted verbatim from the
  //     game — idle 130ms PING-PONG (_bossPingPongFrame: 0..n-1..1, 2n-2 step
  //     sequence), walk 80ms + attack 48ms straight loops (_bossLoopFrame) —
  //     driven by the same wall-clock modulo the game uses. The old flat-fps
  //     linear index remains only when the toggle is off.
  //   gameScale (default ON): render at the game's ON-SCREEN pixel size —
  //     targetH = hitbox.h x (boss ? mul||2 : 1.5) x sizeFactor(frame) x
  //     plantScale — instead of the DISPLAY_H-normalized preview size.
  //   No additional frames: only the leading run of DECODED frames plays
  //     (exact _readyN semantics); a 1-frame set holds static, never repeats
  //     or pads. The ping-pong seam means idle never double-plays frame 0/n-1
  //     back-to-back — identical to in-game.
  let gameTiming = true, gameScale = true, nowT = 0;
  const GAME_FRAME_MS = { idle: 130, walk: 80, attack: 48 };   // _BOSS_IDLE/WALK/ATK_FRAME_MS
  function decodedN(arr) {   // mirrors the game's monotonic _readyN cache
    let n = arr._readyN || 0;
    while (n < arr.length && arr[n] && arr[n].complete && arr[n].naturalWidth > 0) n++;
    return (arr._readyN = n);
  }
  function gameFrameIndex(st, arr, t) {
    const n = decodedN(arr);
    if (n === 0) return -1;              // nothing decoded -> draw nothing (game falls to static)
    if (n === 1) return 0;               // single frame holds
    if (st === 'idle') {                 // _bossPingPongFrame
      const seqLen = 2 * n - 2;
      const i = Math.floor(t / GAME_FRAME_MS.idle) % seqLen;
      return i < n ? i : seqLen - i;
    }
    return Math.floor(t / GAME_FRAME_MS[st] ) % n;   // _bossLoopFrame
  }
  // v2 — SINGLE hitbox model. The old green read-only "gameplay hitbox" +
  // orange "edit hitbox" pair confused (per user); now one editable box.
  let hbEdit = false, compose = false;
  const HB = window.LX_MOB_HITBOX || {};   // per-type gameplay hitbox (monster_hitboxes.js)
  // ---- LIVE mob plant-scale (mirrors the game's _lxMobScale merge) ----
  // localStorage 'lx_mob_scale' (R-key Monster Plant editor) > baked
  // mob_offsets.js (window.LX_MOB_SCALE_DATA) > 1. Cached; invalidated by the
  // cross-tab 'storage' event (editing scales in the game tab updates the
  // hitbox here live) and on entity select / hitbox toggle for same-tab edits.
  let _mobScaleLS = null;
  function _mobScaleMap() {
    if (_mobScaleLS) return _mobScaleLS;
    try { _mobScaleLS = JSON.parse(localStorage.getItem('lx_mob_scale') || '{}') || {}; }
    catch (_) { _mobScaleLS = {}; }
    return _mobScaleLS;
  }
  // v0.26.x — full key-3 (Monster Plant) sync: BOTH live tables mirrored.
  // lx_mob_scale multiplies the rendered sprite height in-game (targetH =
  // m.h x 1.5 x sizeFactor x scale); lx_mob_yoff adds raw world-px to the
  // draw-Y (positive = down). localStorage edit > baked mob_offsets.js > 1/0.
  let _mobYoffLS = null;
  function _mobYoffMap() {
    if (_mobYoffLS) return _mobYoffLS;
    try { _mobYoffLS = JSON.parse(localStorage.getItem('lx_mob_yoff') || '{}') || {}; }
    catch (_) { _mobYoffLS = {}; }
    return _mobYoffLS;
  }
  window.addEventListener('storage', (e) => {
    if (!e || e.key === null || e.key === 'lx_mob_scale' || e.key === 'lx_mob_yoff') {
      _mobScaleLS = null; _mobYoffLS = null;
      if (window.__buildControls) window.__buildControls();   // refresh the plant readout live
    }
  });
  function liveMobScale(t) {
    const ls = _mobScaleMap();
    let v;
    if (Object.prototype.hasOwnProperty.call(ls, t)) v = +ls[t];
    else { const baked = window.LX_MOB_SCALE_DATA || {}; v = +baked[t]; }
    return (isFinite(v) && v > 0) ? clamp(v, 0.3, 4) : 1;
  }
  function liveMobYOff(t) {
    const ls = _mobYoffMap();
    if (Object.prototype.hasOwnProperty.call(ls, t)) return (+ls[t]) || 0;
    const baked = window.LX_MOB_OFFSET_DATA || {};
    return (+baked[t]) || 0;
  }
  // Monster Plant values apply to MONSTERS only (bosses render through
  // _drawBossSprite, which has no key-3 channel).
  const plantScale = (t) => (MAN[t] && MAN[t].group === 'boss') ? 1 : liveMobScale(t);
  const plantYOff  = (t) => (MAN[t] && MAN[t].group === 'boss') ? 0 : liveMobYOff(t);

  // ===== faithful render model (mirrors mojiworld_game.html) =====
  function sizeFactor(group, w, h) {
    const ref = group === 'boss' ? 1024 : 768, f = Math.max(w, h) / ref;
    return group === 'boss' ? clamp(f, 0.7, 1.6) : clamp(f, 0.85, 1.2);
  }
  // K so the base sprite renders to DISPLAY_H; every state scales relative to it.
  function baseK(ent) {
    const b = ent.base || (ent.states.idle ? { w: ent.states.idle.w, h: ent.states.idle.h } : { w: 768, h: 768 });
    return DISPLAY_H / sizeFactor(ent.group, b.w, b.h);
  }
  function stateGeom(ent, st) {
    const info = ent.states[st]; if (!info) return null;
    // v0.26.x — key-3 sync: the Monster Plant scale multiplies the rendered
    // height exactly like the game (targetH = m.h x 1.5 x sizeFactor x scale).
    // Folding it in HERE keeps every fraction-of-height unit (calib dx/dy,
    // atk-hitbox w/h/ox/oy) on the same basis as the game's visH.
    const _ps = plantScale(cur);
    const hb = HB[cur];
    // v0.29.139 — gameScale (default ON): render at the game's ON-SCREEN size,
    // targetH = hb.h x (boss ? mul||2 : 1.5) x sizeFactor(THIS frame) x scale —
    // the exact in-game formula, so 1 editor px == 1 game logical px. Falls
    // back to the DISPLAY_H-normalized preview when toggled off or when the
    // type has no hitbox entry.
    const _gameBase = (gameScale && hb && hb.h)
      ? hb.h * (ent.group === 'boss' ? (hb.mul || 2) : 1.5)
      : null;
    const previewH = (_gameBase != null ? _gameBase : baseK(ent)) * sizeFactor(ent.group, info.w, info.h) * _ps;
    const targetW = previewH * (info.w / info.h);
    const baseH = (ent.base && ent.base.h) || info.h;
    const baseFrac = (ent.base && ent.base.botFrac != null) ? ent.base.botFrac : 0.92;
    const usedBotFrac = clamp(baseFrac * baseH / info.h, 0.3, 1.3);   // game divides base bbox by THIS frame's height
    // world-px -> preview-px ratio for this type (for the key-3 y-offset):
    // game base targetH = hb.h x mul x sizeFactor(base) x scale; preview base
    // height = DISPLAY_H x scale -> scale cancels out of the ratio. In
    // gameScale mode preview px == world px, so the ratio is exactly 1.
    const pxRatio = _gameBase != null ? 1
      : (hb && hb.h)
      ? DISPLAY_H / (hb.h * (ent.group === 'boss' ? (hb.mul || 2) : 1.5) * sizeFactor(ent.group, (ent.base && ent.base.w) || info.w, baseH))
      : 1;
    const yoffPx = plantYOff(cur) * pxRatio;
    return { previewH, targetW, usedBotFrac, yoffPx };
  }
  // Compose-mode geometry: same render math as stateGeom but keyed to an
  // EXPLICIT type (not the single `cur`), so multiple different sprites can be
  // sized correctly on one stage. Returns preview px height + width for (type,st).
  function composeGeom(type, st) {
    const ent = MAN[type]; if (!ent) return null;
    const info = ent.states[st]; if (!info) return null;
    const _ps = (ent.group === 'boss') ? 1 : liveMobScale(type);
    // v0.29.139 — compose stage honors gameScale too (relative sizes between
    // sprites then match the game exactly).
    const _chb = HB[type];
    const _cBase = (gameScale && _chb && _chb.h)
      ? _chb.h * (ent.group === 'boss' ? (_chb.mul || 2) : 1.5)
      : baseK(ent);
    const previewH = _cBase * sizeFactor(ent.group, info.w, info.h) * _ps;
    const targetW = previewH * (info.w / info.h);
    const baseH = (ent.base && ent.base.h) || info.h;
    const baseFrac = (ent.base && ent.base.botFrac != null) ? ent.base.botFrac : 0.92;
    const usedBotFrac = clamp(baseFrac * baseH / info.h, 0.3, 1.3);
    return { previewH, targetW, usedBotFrac };
  }

  // ===== entity list =====
  const listEl = document.getElementById('list');
  const allTypes = Object.keys(MAN).sort((a, b) => {
    const ga = MAN[a].group, gb = MAN[b].group;
    if (ga !== gb) return ga === 'boss' ? -1 : 1;
    return a.localeCompare(b);
  });
  function buildList(filter) {
    const f = (filter || '').trim().toLowerCase();
    listEl.innerHTML = '';
    for (const t of allTypes) {
      if (f && !t.toLowerCase().includes(f) && MAN[t].group.indexOf(f) < 0) continue;
      const ent = MAN[t];
      const row = document.createElement('div');
      row.className = 'row' + (t === cur ? ' sel' : '');
      const have = STATES.filter(s => ent.states[s]).map(s => `<i class="dot" style="background:${COL[s]}"></i>`).join('');
      row.innerHTML = `<span class="tag ${ent.group}">${ent.group === 'boss' ? 'B' : 'M'}</span>` +
        `<span class="nm">${t}</span><span style="margin-left:auto;display:flex;gap:3px">${have}</span>`;
      row.onclick = () => select(t);
      listEl.appendChild(row);
    }
  }

  // ===== frame loading =====
  function loadFrames(ent) {
    const out = {};
    for (const st of STATES) {
      const info = ent.states[st]; if (!info) continue;
      out[st] = [];
      for (let i = 0; i < info.count; i++) {
        const img = new Image();
        img.src = `${info.dir}_${i}.webp`;
        out[st].push(img);
      }
    }
    return out;
  }

  function select(t) {
    // compose mode: list clicks ADD the entity as an overlay layer instead of
    // switching the single calibration target.
    if (compose && window.__compose) { window.__compose.addLayer(t); return; }
    cur = t; frames = loadFrames(MAN[t]); frameIdx = 0;
    _mobScaleLS = null; _mobYoffLS = null;   // re-read live key-3 values on entity switch (same-tab edits)
    buildList(document.getElementById('q').value);
    buildControls();
  }

  // ===== render loop =====
  const cv = document.getElementById('stage'), ctx = cv.getContext('2d');
  function fit() {
    const w = document.getElementById('stagewrap').clientWidth - 4;
    cv.width = Math.max(560, w); cv.height = document.getElementById('stagewrap').clientHeight - 4;
  }
  function drawState(ent, st, cx, groundY, alpha) {
    const g = stateGeom(ent, st); if (!g) return;
    const arr = frames[st]; if (!arr || !arr.length) return;
    // v0.29.139 — game-accurate frame pick: per-mode clock + idle ping-pong +
    // decoded-only (_readyN). Legacy flat-fps linear index when toggled off.
    const idx = gameTiming ? gameFrameIndex(st, arr, nowT) : (frameIdx % arr.length);
    if (idx < 0) return;
    const img = arr[idx];
    if (!img.complete || !img.naturalWidth) return;
    const c = CALIB[cur][st];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, groundY);
    ctx.translate(c.dx * g.previewH, c.dy * g.previewH);
    ctx.scale(c.s, c.s);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    // key-3 y-offset rides INSIDE the calib transform, mirroring the game where
    // _lxMobYOff joins dyOffset (which the calib scale wraps).
    ctx.drawImage(img, -g.targetW / 2, -g.usedBotFrac * g.previewH + (g.yoffPx || 0), g.targetW, g.previewH);
    ctx.restore();
  }
  // THE hitbox (orange, editable) — the region player attacks can hit
  // (_atkMonBox override). v2: the old green read-only gameplay box was
  // removed (per user — two boxes confused); this single box is the only one.
  // All scaling is hardbaked into its px size: units are fractions of the
  // rendered sprite height, and stateGeom's previewH already folds in
  // sizeFactor AND the live Monster Plant scale — what you see is the final
  // scaled box. Solid = customized, dashed = game default. Returns the
  // on-canvas rect so the UI layer can hit-test drags (body = move,
  // bottom-right handle = resize).
  function drawAtkHitbox(ent, st, cx, groundY) {
    const g = stateGeom(ent, st); if (!g) return null;
    const custom = hbFor(cur, st);
    const hb = custom || defaultHB(ent, st);
    const w = hb.w * g.previewH, h = hb.h * g.previewH;
    const x = cx + hb.ox * g.previewH - w / 2;
    const y = groundY + hb.oy * g.previewH - h;
    ctx.save();
    ctx.strokeStyle = custom ? '#ff9e3d' : 'rgba(255,158,61,0.6)';
    ctx.lineWidth = 1.5; if (!custom) ctx.setLineDash([6, 4]);
    ctx.fillStyle = 'rgba(255,158,61,0.08)';
    ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    // corner resize handle — drawn large enough to actually grab (14px target)
    ctx.fillStyle = '#ff9e3d';
    ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 1;
    ctx.fillRect(x + w - 7, y + h - 7, 14, 14);
    ctx.strokeRect(x + w - 7, y + h - 7, 14, 14);
    ctx.font = '600 10px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('hitbox' + (custom ? '' : ' (default)'), x + w / 2, y - 5);
    ctx.restore();
    return { x, y, w, h, st, previewH: g.previewH };
  }
  function drawGround(cx, groundY, w, label, color) {
    ctx.strokeStyle = '#2a3346'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - w / 2, groundY + 0.5); ctx.lineTo(cx + w / 2, groundY + 0.5); ctx.stroke();
    if (label) { ctx.fillStyle = color; ctx.font = '600 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText(label, cx, groundY + 20); }
  }
  // exposed for chunk B (interaction needs column geometry)
  window.__anim = { get cur() { return cur; }, get overlay() { return overlay; }, get focusState() { return focusState; },
    stateGeom: (st) => stateGeom(MAN[cur], st), columns: () => columns, CALIB: () => CALIB,
    get hbEdit() { return hbEdit; }, hbRects: () => hbRects };
  let columns = [];   // [{state, cx, groundY}]
  let hbRects = [];   // [{x,y,w,h,st,previewH}] — attack-hitbox rects this paint
  function frame(t) {
    requestAnimationFrame(frame);
    nowT = t;   // v0.29.139 — wall-clock for the game-accurate per-mode frame clocks
    if (t - lastT > 1000 / fps) { frameIdx++; lastT = t; }
    paint();
  }
  // Pure draw of the current frameIdx — also called on demand (e.g. headless
  // verification, where requestAnimationFrame is paused for a hidden tab).
  function paint() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    columns = []; hbRects = [];
    // compose mode owns the whole stage — overlay of arbitrary sprites.
    if (compose && window.__compose) { window.__compose.paint(ctx, cv, frameIdx); return; }
    if (!cur) return;
    const ent = MAN[cur];
    const states = STATES.filter(s => ent.states[s]);
    const groundY = cv.height - 64;
    if (overlay) {
      const cx = cv.width / 2;
      drawGround(cx, groundY, cv.width * 0.8, '', '#fff');
      for (const st of states) { drawState(ent, st, cx, groundY, st === focusState ? 1 : 0.4); columns.push({ state: st, cx, groundY }); }
      // overlay mode: edit only the focused state's box (stacked boxes confuse)
      if (hbEdit && ent.states[focusState]) { const r = drawAtkHitbox(ent, focusState, cx, groundY); if (r) hbRects.push(r); }
      ctx.fillStyle = COL[focusState]; ctx.font = '600 12px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('overlay — editing: ' + focusState, cx, groundY + 20);
    } else {
      const n = states.length, slotW = cv.width / n;
      states.forEach((st, i) => {
        const cx = slotW * (i + 0.5);
        drawState(ent, st, cx, groundY, 1);
        if (hbEdit) { const r = drawAtkHitbox(ent, st, cx, groundY); if (r) hbRects.push(r); }
        drawGround(cx, groundY, slotW * 0.86, st, COL[st]);
        columns.push({ state: st, cx, groundY, slotW });
      });
    }
  }
  requestAnimationFrame(frame);

  // expose a few bits chunk B + init use
  window.__animCore = { buildList, select, buildControls: () => buildControls(), loadCalib,
    setFps: (v) => { fps = v; }, setOverlay: (v) => { overlay = v; }, setFocus: (v) => { focusState = v; },
    // v0.29.139 — game-accurate playback + on-screen-scale toggles
    setGameTiming: (v) => { gameTiming = !!v; }, getGameTiming: () => gameTiming,
    setGameScale: (v) => { gameScale = !!v; }, getGameScale: () => gameScale,
    gameFrameIndex: (st, arr) => gameFrameIndex(st, arr, nowT),   // compose layers share the clock
    _setNow: (t) => { nowT = t; },   // headless-verification hook (rAF is suspended in hidden tabs)
    setHbEdit: (v) => { hbEdit = v; _mobScaleLS = null; },   // toggle re-reads live scale too
    // key-3 (Monster Plant) live values for the panel readout
    plantScale, plantYOff,
    fit, MAN, STATES, COL, DEF, CALIB: () => CALIB, reloadCalib: () => { CALIB = loadCalib(); },
    // ---- attack-hitbox model API (consumed by monster_animator_ui.js) ----
    HBX: () => HBX, hbFor, defaultHB: (t, st) => defaultHB(MAN[t], st),
    setHB: (t, st, v) => { (HBX[t] = HBX[t] || {})[st] = v; },
    clearHB: (t, st) => { if (HBX[t]) delete HBX[t][st]; },
    // undo support: wholesale state restore (deep objects come pre-cloned)
    restore: (c, h) => { if (c) CALIB = c; if (h) HBX = h; },
    // ---- compose mode (multi-sprite overlay) API ----
    setCompose: (v) => { compose = v; }, getCompose: () => compose,
    composeGeom, loadFramesFor: (t) => loadFrames(MAN[t]),
    baseK: (t) => (MAN[t] ? baseK(MAN[t]) : DISPLAY_H), DISPLAY_H,
    paint: () => paint(), step: () => { frameIdx++; paint(); } };
  // buildControls is defined in chunk B; declare a placeholder so early calls no-op.
  function buildControls() { if (window.__buildControls) window.__buildControls(); }

  buildList('');
  fit();
  window.addEventListener('resize', fit);
})();
