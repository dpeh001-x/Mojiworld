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

  // ---- runtime state ----
  let cur = null, frames = {}, frameIdx = 0, fps = 8, lastT = 0, overlay = false, focusState = 'idle';

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
  function drawGround(cx, groundY, w, label, color) {
    ctx.strokeStyle = '#2a3346'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - w / 2, groundY + 0.5); ctx.lineTo(cx + w / 2, groundY + 0.5); ctx.stroke();
    if (label) { ctx.fillStyle = color; ctx.font = '600 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText(label, cx, groundY + 20); }
  }
  // exposed for chunk B (interaction needs column geometry)
  window.__anim = { get cur() { return cur; }, get overlay() { return overlay; }, get focusState() { return focusState; },
    stateGeom: (st) => stateGeom(MAN[cur], st), columns: () => columns, CALIB: () => CALIB };
  let columns = [];   // [{state, cx, groundY}]
  function frame(t) {
    requestAnimationFrame(frame);
    if (t - lastT > 1000 / fps) { frameIdx++; lastT = t; }
    paint();
  }
  // Pure draw of the current frameIdx — also called on demand (e.g. headless
  // verification, where requestAnimationFrame is paused for a hidden tab).
  function paint() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    columns = [];
    if (!cur) return;
    const ent = MAN[cur];
    const states = STATES.filter(s => ent.states[s]);
    const groundY = cv.height - 64;
    if (overlay) {
      const cx = cv.width / 2;
      drawGround(cx, groundY, cv.width * 0.8, '', '#fff');
      for (const st of states) { drawState(ent, st, cx, groundY, st === focusState ? 1 : 0.4); columns.push({ state: st, cx, groundY }); }
      ctx.fillStyle = COL[focusState]; ctx.font = '600 12px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('overlay — editing: ' + focusState, cx, groundY + 20);
    } else {
      const n = states.length, slotW = cv.width / n;
      states.forEach((st, i) => {
        const cx = slotW * (i + 0.5);
        drawState(ent, st, cx, groundY, 1);
        drawGround(cx, groundY, slotW * 0.86, st, COL[st]);
        columns.push({ state: st, cx, groundY, slotW });
      });
    }
  }
  requestAnimationFrame(frame);

  // expose a few bits chunk B + init use
  window.__animCore = { buildList, select, buildControls: () => buildControls(), loadCalib,
    setFps: (v) => { fps = v; }, setOverlay: (v) => { overlay = v; }, setFocus: (v) => { focusState = v; },
    fit, MAN, STATES, COL, DEF, CALIB: () => CALIB, reloadCalib: () => { CALIB = loadCalib(); },
    paint: () => paint(), step: () => { frameIdx++; paint(); } };
  // buildControls is defined in chunk B; declare a placeholder so early calls no-op.
  function buildControls() { if (window.__buildControls) window.__buildControls(); }

  buildList('');
  fit();
  window.addEventListener('resize', fit);
})();
