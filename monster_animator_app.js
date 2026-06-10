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
  let showHitbox = false, hbEdit = false;
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
  window.addEventListener('storage', (e) => { if (!e || e.key === null || e.key === 'lx_mob_scale') _mobScaleLS = null; });
  function liveMobScale(t) {
    const ls = _mobScaleMap();
    let v;
    if (Object.prototype.hasOwnProperty.call(ls, t)) v = +ls[t];
    else { const baked = window.LX_MOB_SCALE_DATA || {}; v = +baked[t]; }
    return (isFinite(v) && v > 0) ? clamp(v, 0.3, 4) : 1;
  }

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
    const previewH = baseK(ent) * sizeFactor(ent.group, info.w, info.h);
    const targetW = previewH * (info.w / info.h);
    const baseH = (ent.base && ent.base.h) || info.h;
    const baseFrac = (ent.base && ent.base.botFrac != null) ? ent.base.botFrac : 0.92;
    const usedBotFrac = clamp(baseFrac * baseH / info.h, 0.3, 1.3);   // game divides base bbox by THIS frame's height
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
    cur = t; frames = loadFrames(MAN[t]); frameIdx = 0;
    _mobScaleLS = null;   // re-read live plant-scale on entity switch (same-tab edits)
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
    const img = arr[frameIdx % arr.length];
    if (!img.complete || !img.naturalWidth) return;
    const c = CALIB[cur][st];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, groundY);
    ctx.translate(c.dx * g.previewH, c.dy * g.previewH);
    ctx.scale(c.s, c.s);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, -g.targetW / 2, -g.usedBotFrac * g.previewH, g.targetW, g.previewH);
    ctx.restore();
  }
  // Gameplay hitbox overlay. In-game: hitbox = m.w × m.h, sprite renders at
  // spriteH = m.h × mul × sizeFactor(base) foot-anchored at the hitbox's
  // bottom-center. The animator normalizes the base sprite to DISPLAY_H, so
  // in preview px: hbH = DISPLAY_H / (mul × sizeFactor(base)), hbW by aspect.
  // Deliberately NOT affected by calib s/dx/dy — the game hitbox never moves;
  // seeing the sprite drift against the fixed box is the point of the toggle.
  function drawHitbox(ent, cx, groundY) {
    const hb = HB[cur];
    if (!hb || !hb.w || !hb.h) return;
    const b = ent.base || (ent.states.idle ? { w: ent.states.idle.w, h: ent.states.idle.h } : { w: 768, h: 768 });
    const sf = sizeFactor(ent.group, b.w, b.h);
    // Monsters: mul computed LIVE (1.5 × current plant-scale) so R-key editor
    // changes reflect instantly; bosses use the snapshot mul (BOSS_DRAW_SCALE
    // has no localStorage override channel).
    const scale = ent.group === 'boss' ? 1 : liveMobScale(cur);
    const mul = ent.group === 'boss' ? (hb.mul || 2) : 1.5 * scale;
    const hbH = DISPLAY_H / (mul * sf);
    const hbW = hbH * (hb.w / hb.h);
    ctx.save();
    ctx.strokeStyle = '#7CFC00'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.fillStyle = 'rgba(124,252,0,0.07)';
    ctx.fillRect(cx - hbW / 2, groundY - hbH, hbW, hbH);
    ctx.strokeRect(cx - hbW / 2, groundY - hbH, hbW, hbH);
    ctx.setLineDash([]);
    ctx.fillStyle = '#9dff4d'; ctx.font = '600 10px system-ui'; ctx.textAlign = 'center';
    const _scaleTag = (ent.group !== 'boss' && Math.abs(scale - 1) > 0.001) ? ` · scale ${scale.toFixed(2)}` : '';
    ctx.fillText(`hitbox ${hb.w}×${hb.h}${hb.f ? ' · flies' : ''}${_scaleTag}`, cx, groundY - hbH - 5);
    ctx.restore();
  }
  // Editable ATTACK hitbox overlay (orange). Solid = customized, dashed =
  // game default. Returns the on-canvas rect so the UI layer can hit-test
  // drags (body = move, bottom-right handle = resize).
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
    ctx.fillText('atk box' + (custom ? '' : ' (default)'), x + w / 2, y - 5);
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
    if (t - lastT > 1000 / fps) { frameIdx++; lastT = t; }
    paint();
  }
  // Pure draw of the current frameIdx — also called on demand (e.g. headless
  // verification, where requestAnimationFrame is paused for a hidden tab).
  function paint() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    columns = []; hbRects = [];
    if (!cur) return;
    const ent = MAN[cur];
    const states = STATES.filter(s => ent.states[s]);
    const groundY = cv.height - 64;
    if (overlay) {
      const cx = cv.width / 2;
      drawGround(cx, groundY, cv.width * 0.8, '', '#fff');
      for (const st of states) { drawState(ent, st, cx, groundY, st === focusState ? 1 : 0.4); columns.push({ state: st, cx, groundY }); }
      if (showHitbox) drawHitbox(ent, cx, groundY);
      // overlay mode: edit only the focused state's box (stacked boxes confuse)
      if (hbEdit && ent.states[focusState]) { const r = drawAtkHitbox(ent, focusState, cx, groundY); if (r) hbRects.push(r); }
      ctx.fillStyle = COL[focusState]; ctx.font = '600 12px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('overlay — editing: ' + focusState, cx, groundY + 20);
    } else {
      const n = states.length, slotW = cv.width / n;
      states.forEach((st, i) => {
        const cx = slotW * (i + 0.5);
        drawState(ent, st, cx, groundY, 1);
        if (showHitbox) drawHitbox(ent, cx, groundY);
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
    setHitbox: (v) => { showHitbox = v; _mobScaleLS = null; },   // toggle re-reads live scale too
    setHbEdit: (v) => { hbEdit = v; },
    fit, MAN, STATES, COL, DEF, CALIB: () => CALIB, reloadCalib: () => { CALIB = loadCalib(); },
    // ---- attack-hitbox model API (consumed by monster_animator_ui.js) ----
    HBX: () => HBX, hbFor, defaultHB: (t, st) => defaultHB(MAN[t], st),
    setHB: (t, st, v) => { (HBX[t] = HBX[t] || {})[st] = v; },
    clearHB: (t, st) => { if (HBX[t]) delete HBX[t][st]; },
    // undo support: wholesale state restore (deep objects come pre-cloned)
    restore: (c, h) => { if (c) CALIB = c; if (h) HBX = h; },
    paint: () => paint(), step: () => { frameIdx++; paint(); } };
  // buildControls is defined in chunk B; declare a placeholder so early calls no-op.
  function buildControls() { if (window.__buildControls) window.__buildControls(); }

  buildList('');
  fit();
  window.addEventListener('resize', fit);
})();
