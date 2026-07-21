/* monster_animator_compose.js — COMPOSE mode for monster_animator.html.
 * Overlays DIFFERENT sprites on one stage, each an independent layer with its
 * own state (idle/walk/attack), position, scale and opacity — for aligning a
 * summon beside a hero, an FX over a boss, size comparisons, scene mock-ups.
 * Session-only: the composition lives in localStorage('lx_compose_scene') and
 * NEVER touches the game's anim_calib data. Loaded after app.js + ui.js. */
(function () {
  'use strict';
  const core = window.__animCore;
  const cv = document.getElementById('stage');
  const STATES = core.STATES, MAN = core.MAN;
  const LS = 'lx_compose_scene';

  let LAYERS = [];        // {type, state, x, y, scale, alpha, frames, _rect}
  let active = -1, drag = null;

  const statesOf = (t) => STATES.filter(s => MAN[t] && MAN[t].states[s]);

  // ---- layer management ----
  function addLayer(type) {
    if (!MAN[type]) return;
    const L = { type, state: statesOf(type)[0] || 'idle', x: cv.width / 2, y: cv.height - 64,
                scale: 1, alpha: 1, frames: core.loadFramesFor(type) };
    L.x += (LAYERS.length % 5) * 46 - 92;   // stagger so new layers don't perfectly stack
    LAYERS.push(L); active = LAYERS.length - 1;
    buildPanel(); save();
  }
  function removeLayer(i) { LAYERS.splice(i, 1); if (active >= LAYERS.length) active = LAYERS.length - 1; buildPanel(); save(); }
  function raise(i) { if (i < LAYERS.length - 1) { const [l] = LAYERS.splice(i, 1); LAYERS.splice(i + 1, 0, l); active = i + 1; buildPanel(); save(); } }
  function lower(i) { if (i > 0) { const [l] = LAYERS.splice(i, 1); LAYERS.splice(i - 1, 0, l); active = i - 1; buildPanel(); save(); } }
  function clearAll() { LAYERS = []; active = -1; buildPanel(); save(); }

  // ---- persistence (scene only; frames rehydrated on load) ----
  function save() {
    try {
      localStorage.setItem(LS, JSON.stringify(LAYERS.map(l => ({
        type: l.type, state: l.state, x: Math.round(l.x), y: Math.round(l.y),
        scale: +l.scale.toFixed(3), alpha: +l.alpha.toFixed(2) }))));
    } catch (_) {}
  }
  function load() {
    try {
      const a = JSON.parse(localStorage.getItem(LS) || '[]');
      LAYERS = a.filter(o => MAN[o.type]).map(o => ({ ...o, frames: core.loadFramesFor(o.type) }));
      active = LAYERS.length ? 0 : -1;
    } catch (_) { LAYERS = []; active = -1; }
  }

  // ---- render ----
  function drawLayer(ctx, L, frameIdx) {
    const arr = L.frames[L.state]; if (!arr || !arr.length) return;
    // v0.29.139 — compose layers use the same game-accurate per-mode clock
    // (idle ping-pong 130ms / walk 80ms / attack 48ms) when game timing is on.
    const idx = (core.gameFrameIndex && core.getGameTiming && core.getGameTiming())
      ? core.gameFrameIndex(L.state, arr)
      : (frameIdx % arr.length);
    if (idx < 0) return;
    const img = arr[idx];
    if (!img || !img.complete || !img.naturalWidth) return;
    // v0.29.x — pass the live frame + idle set so the game's content-norm
    // (cross-state size constancy) applies on the compose stage too.
    const g = core.composeGeom(L.type, L.state, img, L.frames.idle); if (!g) return;
    // v0.29.x — monster attack-box multiplier (game's _ATK_FRAME_SCALE): padded
    // attack canvases draw into a proportionally larger box, anchor scaled too.
    const _am = g.atkMul || 1;
    const w = g.targetW * L.scale * _am, h = g.previewH * L.scale * _am;
    const x = L.x - w / 2, y = L.y - g.usedBotFrac * g.previewH * L.scale * _am;   // foot-anchored at (L.x, L.y)
    ctx.save();
    ctx.globalAlpha = L.alpha;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
    L._rect = { x, y, w, h };
  }
  function paint(ctx, cv, frameIdx) {
    const gy = cv.height - 64;
    ctx.strokeStyle = '#2a3346'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(0, gy + 0.5); ctx.lineTo(cv.width, gy + 0.5); ctx.stroke();
    ctx.setLineDash([]);
    if (!LAYERS.length) {
      ctx.fillStyle = '#8a97ad'; ctx.font = '13px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('Compose mode — click entities on the left to add them as layers.', cv.width / 2, cv.height / 2);
      return;
    }
    LAYERS.forEach((L, i) => {
      drawLayer(ctx, L, frameIdx);
      if (i === active && L._rect) {
        ctx.strokeStyle = '#5b8cff'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
        ctx.strokeRect(L._rect.x, L._rect.y, L._rect.w, L._rect.h); ctx.setLineDash([]);
        ctx.fillStyle = '#5b8cff'; ctx.font = '600 10px system-ui'; ctx.textAlign = 'left';
        ctx.fillText(L.type + ' · ' + L.state, L._rect.x, L._rect.y - 4);
      }
    });
  }

  // ---- interaction (capture-phase so the calibration handlers never fire) ----
  function xy(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; }
  function layerAt(p) {
    for (let i = LAYERS.length - 1; i >= 0; i--) { const r = LAYERS[i]._rect; if (r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return i; }
    return -1;
  }
  cv.addEventListener('mousedown', e => {
    if (!core.getCompose()) return;
    e.stopImmediatePropagation();
    const p = xy(e), i = layerAt(p);
    if (i < 0) return;
    active = i; drag = { i, px: p.x, py: p.y, ox: LAYERS[i].x, oy: LAYERS[i].y };
    buildPanel();
  }, true);
  window.addEventListener('mousemove', e => {
    if (!drag) return;
    const p = xy(e), L = LAYERS[drag.i];
    L.x = drag.ox + (p.x - drag.px); L.y = drag.oy + (p.y - drag.py);
    syncInputs(drag.i);
  }, true);
  window.addEventListener('mouseup', () => { if (drag) { save(); drag = null; } }, true);
  cv.addEventListener('wheel', e => {
    if (!core.getCompose()) return;
    e.stopImmediatePropagation(); e.preventDefault();
    const p = xy(e); let i = layerAt(p); if (i < 0) i = active; if (i < 0) return;
    const L = LAYERS[i];
    L.scale = Math.max(0.15, Math.min(6, L.scale * (e.deltaY < 0 ? 1.05 : 1 / 1.05)));
    active = i; syncInputs(i);
    clearTimeout(cv._cw); cv._cw = setTimeout(save, 250);
  }, true);

  // buildPanel / syncInputs defined in the panel section below.
  function buildPanel() {}
  function syncInputs() {}

  // ---- toggle wiring ----
  const _origBuild = window.__buildControls;
  window.__buildControls = function () { if (core.getCompose()) buildPanel(); else _origBuild(); };
  const box = document.getElementById('compose');
  if (box) box.addEventListener('change', e => {
    core.setCompose(e.target.checked);
    const hint = document.getElementById('hint');
    if (e.target.checked) {
      if (!LAYERS.length) load();
      buildPanel();
      if (hint) hint.textContent = 'COMPOSE: click entities (left) to add layers · drag to move · scroll to scale · adjust the active layer on the right';
    } else {
      window.__buildControls();
      if (hint) hint.textContent = 'Drag a sprite in the stage to nudge its X/Y · scroll-wheel over a sprite to scale';
    }
  });

  window.__compose = { addLayer, paint, layers: () => LAYERS };
  // panel API used by the panel section
  window.__composeInternal = { get LAYERS() { return LAYERS; }, get active() { return active; }, set active(v) { active = v; },
    removeLayer, raise, lower, clearAll, save, statesOf,
    setBuildPanel: (fn) => { buildPanel = fn; }, setSyncInputs: (fn) => { syncInputs = fn; } };
})();

/* ---- compose controls panel (right column) ---- */
(function () {
  'use strict';
  const CI = window.__composeInternal;
  function numRow(i, k, v, mn, mx, step) {
    return `<div class="sl"><label>${k}</label>` +
      `<input type="range" data-lk="${k}" data-li="${i}" min="${mn}" max="${mx}" step="${step}" value="${v}" />` +
      `<input type="number" data-lk="${k}" data-li="${i}" min="${mn}" max="${mx}" step="${step}" value="${v}" /></div>`;
  }
  function syncInputs(i) {
    const L = CI.LAYERS[i]; if (!L) return;
    ['scale', 'x', 'y', 'alpha'].forEach(k =>
      document.querySelectorAll(`[data-li="${i}"][data-lk="${k}"]`).forEach(el => { el.value = (k === 'x' || k === 'y') ? Math.round(L[k]) : L[k]; }));
  }
  function setLayerVal(i, k, raw) {
    const L = CI.LAYERS[i]; if (!L) return; let v = +raw; if (!isFinite(v)) return;
    L[k] = (k === 'x' || k === 'y') ? v : Math.max(k === 'alpha' ? 0.05 : 0.15, v);
    syncInputs(i); CI.save();
  }
  function buildPanel() {
    const body = document.getElementById('ctrlBody'), empty = document.getElementById('ctrlEmpty');
    empty.style.display = 'none'; body.style.display = 'block';
    const L = CI.LAYERS;
    let html = `<div class="who">Compose · ${L.length} layer${L.length !== 1 ? 's' : ''}</div>` +
      `<div class="mut" style="font-size:11px;margin-bottom:8px">Click entities on the left to add layers · drag on stage to move · scroll to scale. Session-only — never changes game calibration.</div>`;
    if (!L.length) html += `<div class="empty" style="padding:20px 8px">No layers yet.</div>`;
    L.forEach((l, i) => {
      const on = i === CI.active;
      const opts = CI.statesOf(l.type).map(s => `<option value="${s}"${s === l.state ? ' selected' : ''}>${s}</option>`).join('');
      html += `<div class="scard" data-lc="${i}" style="border-color:${on ? '#5b8cff' : 'var(--line)'};cursor:pointer">` +
        `<div class="srow"><h3 style="gap:6px">${on ? '▸ ' : ''}${l.type}</h3>` +
        `<span style="display:flex;gap:4px">` +
        `<button class="reset" data-lraise="${i}" title="bring forward">↑</button>` +
        `<button class="reset" data-llower="${i}" title="send back">↓</button>` +
        `<button class="reset warn" data-lrm="${i}" title="remove">✕</button></span></div>` +
        `<div class="sl"><label>st</label><select data-lst="${i}" style="grid-column:2/4;background:var(--bg);border:1px solid var(--line);color:var(--txt);border-radius:6px;padding:3px 5px;font-size:11px">${opts}</select></div>` +
        numRow(i, 'scale', l.scale, 0.15, 6, 0.01) + numRow(i, 'x', Math.round(l.x), 0, 4000, 1) +
        numRow(i, 'y', Math.round(l.y), 0, 3000, 1) + numRow(i, 'alpha', l.alpha, 0.05, 1, 0.05) + `</div>`;
    });
    if (L.length) html += `<button class="warn reset" id="composeClear" style="width:100%;margin-top:2px">Clear all layers</button>`;
    body.innerHTML = html;
    document.querySelectorAll('[data-lc]').forEach(c => c.addEventListener('mousedown', e => {
      if (e.target.closest('button,select,input')) return; CI.active = +c.dataset.lc; buildPanel();
    }));
    document.querySelectorAll('select[data-lst]').forEach(s => s.addEventListener('change', () => { CI.LAYERS[+s.dataset.lst].state = s.value; CI.save(); }));
    document.querySelectorAll('#ctrlBody input[data-lk]').forEach(el => el.addEventListener('input', () => setLayerVal(+el.dataset.li, el.dataset.lk, el.value)));
    document.querySelectorAll('[data-lrm]').forEach(b => b.onclick = () => CI.removeLayer(+b.dataset.lrm));
    document.querySelectorAll('[data-lraise]').forEach(b => b.onclick = () => CI.raise(+b.dataset.lraise));
    document.querySelectorAll('[data-llower]').forEach(b => b.onclick = () => CI.lower(+b.dataset.llower));
    const c = document.getElementById('composeClear'); if (c) c.onclick = () => CI.clearAll();
  }
  CI.setBuildPanel(buildPanel);
  CI.setSyncInputs(syncInputs);
})();

