/* monster_animator_ui.js — controls panel, canvas drag/scroll, save + export.
 * Consumes the globals exposed by monster_animator_app.js (window.__animCore /
 * window.__anim). Persisting writes localStorage('lx_anim_calib'); when the tool
 * and game are served from the SAME origin (e.g. both via the local preview
 * server) the game's 'storage' listener applies edits live with no reload. */
(function () {
  'use strict';
  const core = window.__animCore, A = window.__anim;
  const LS_KEY = 'lx_anim_calib';
  const RANGES = { s: [0.3, 3, 0.01], dx: [-0.6, 0.6, 0.005], dy: [-0.6, 0.6, 0.005] };
  const isDefault = (v) => v.s === 1 && v.dx === 0 && v.dy === 0;

  function toast(msg) {
    const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1400);
  }

  // ---- persistence ----
  function compact() {
    const C = core.CALIB(), out = {};
    for (const t of Object.keys(C)) {
      const st = {};
      for (const s of core.STATES) { const v = C[t][s]; if (v && !isDefault(v)) st[s] = { s: +v.s.toFixed(4), dx: +v.dx.toFixed(4), dy: +v.dy.toFixed(4) }; }
      if (Object.keys(st).length) out[t] = st;
    }
    return out;
  }
  function persist(silent) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(compact())); if (!silent) toast('Saved — live in same-origin game tabs'); }
    catch (e) { toast('localStorage write failed'); }
  }

  // ---- controls panel ----
  function slider(st, k, v) {
    const [mn, mx, step] = RANGES[k];
    return `<div class="sl"><label>${k}</label>` +
      `<input type="range" data-st="${st}" data-k="${k}" min="${mn}" max="${mx}" step="${step}" value="${v}" />` +
      `<input type="number" data-st="${st}" data-k="${k}" min="${mn}" max="${mx}" step="${step}" value="${v}" /></div>`;
  }
  function card(st, v) {
    const dot = `<i class="dot" style="background:${core.COL[st]}"></i>`;
    return `<div class="scard" data-card="${st}">` +
      `<div class="srow"><h3>${dot}${st}</h3>` +
      `<button class="reset" data-reset="${st}">reset</button></div>` +
      slider(st, 's', v.s) + slider(st, 'dx', v.dx) + slider(st, 'dy', v.dy) + `</div>`;
  }
  window.__buildControls = function () {
    const cur = A.cur, body = document.getElementById('ctrlBody'), empty = document.getElementById('ctrlEmpty');
    if (!cur) { body.style.display = 'none'; empty.style.display = 'block'; return; }
    empty.style.display = 'none'; body.style.display = 'block';
    const ent = core.MAN[cur], C = core.CALIB()[cur];
    let html = `<div class="who">${cur}</div>` +
      `<div class="mut" style="font-size:11px;margin-bottom:10px">${ent.group} · base ${ent.base ? ent.base.w + '×' + ent.base.h : '—'} · click a state header to focus in overlay</div>`;
    for (const st of core.STATES) if (ent.states[st]) html += card(st, C[st]);
    html += `<button class="warn reset" id="resetAll" style="width:100%;margin-top:2px">Reset ${cur} to defaults</button>`;
    body.innerHTML = html;
    wire();
  };

  function syncCard(st) {
    const v = core.CALIB()[A.cur][st];
    ['s', 'dx', 'dy'].forEach(k => document.querySelectorAll(`[data-st="${st}"][data-k="${k}"]`).forEach(el => { el.value = v[k]; }));
  }
  function setVal(st, k, raw) {
    const [mn, mx] = RANGES[k]; let v = +raw; if (!isFinite(v)) return;
    v = Math.max(mn, Math.min(mx, v));
    core.CALIB()[A.cur][st][k] = v; syncCard(st); persist(true);
  }
  function wire() {
    document.querySelectorAll('#ctrlBody input').forEach(el => {
      el.addEventListener('input', () => setVal(el.dataset.st, el.dataset.k, el.value));
    });
    document.querySelectorAll('[data-reset]').forEach(b => b.onclick = () => {
      const st = b.dataset.reset; core.CALIB()[A.cur][st] = { s: 1, dx: 0, dy: 0 }; syncCard(st); persist(true); toast(st + ' reset');
    });
    document.querySelectorAll('[data-card]').forEach(c => c.addEventListener('mousedown', () => core.setFocus(c.dataset.card)));
    const ra = document.getElementById('resetAll');
    if (ra) ra.onclick = () => { for (const s of core.STATES) core.CALIB()[A.cur][s] = { s: 1, dx: 0, dy: 0 }; window.__buildControls(); persist(true); toast(A.cur + ' reset'); };
  }

  // ---- canvas drag (x/y) + wheel (scale) ----
  const cv = document.getElementById('stage');
  let drag = null;
  function stateAt(px) {
    if (A.overlay) return A.focusState;
    const cols = A.columns(); let best = null, bd = 1e9;
    for (const c of cols) { const d = Math.abs(px - c.cx); if (d < bd) { bd = d; best = c.state; } }
    return best;
  }
  function evtXY(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; }
  cv.addEventListener('mousedown', e => {
    if (!A.cur) return; const p = evtXY(e); const st = stateAt(p.x); if (!st) return;
    const g = A.stateGeom(st); const v = core.CALIB()[A.cur][st];
    drag = { st, x: p.x, y: p.y, dx0: v.dx, dy0: v.dy, ph: g.previewH }; core.setFocus(st);
  });
  window.addEventListener('mousemove', e => {
    if (!drag) return; const p = evtXY(e);
    const v = core.CALIB()[A.cur][drag.st];
    v.dx = Math.max(-0.6, Math.min(0.6, drag.dx0 + (p.x - drag.x) / drag.ph));
    v.dy = Math.max(-0.6, Math.min(0.6, drag.dy0 + (p.y - drag.y) / drag.ph));
    syncCard(drag.st);
  });
  window.addEventListener('mouseup', () => { if (drag) { persist(true); drag = null; } });
  cv.addEventListener('wheel', e => {
    if (!A.cur) return; e.preventDefault();
    const p = evtXY(e); const st = stateAt(p.x); if (!st) return;
    const v = core.CALIB()[A.cur][st];
    v.s = Math.max(0.3, Math.min(3, v.s + (e.deltaY < 0 ? 0.03 : -0.03)));
    core.setFocus(st); syncCard(st);
    clearTimeout(cv._w); cv._w = setTimeout(() => persist(true), 250);
  }, { passive: false });

  // ---- export anim_calib.js ----
  function exportFile() {
    const data = compact();
    const header =
      '// Baked per-(monster/boss, state) animation calibration.\n' +
      '// Authored with monster_animator.html. Game merges: localStorage > this file > {s:1,dx:0,dy:0}.\n' +
      '// s = size multiplier · dx/dy = nudge as a FRACTION of rendered sprite height (+dy = down).\n';
    const txt = header + 'window.LX_ANIM_CALIB = ' + JSON.stringify(data, null, 2) + ';\n';
    const blob = new Blob([txt], { type: 'text/javascript' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'anim_calib.js';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Downloaded anim_calib.js (' + Object.keys(data).length + ' entries)');
  }

  // ---- top bar wiring ----
  document.getElementById('q').addEventListener('input', e => core.buildList(e.target.value));
  document.getElementById('overlay').addEventListener('change', e => core.setOverlay(e.target.checked));
  const fpsEl = document.getElementById('fps');
  fpsEl.addEventListener('input', e => { core.setFps(+e.target.value); document.getElementById('fpsv').textContent = e.target.value; });
  document.getElementById('save').onclick = () => persist(false);
  document.getElementById('download').onclick = exportFile;

  // first paint of controls (in case an entity is preselected later)
  window.__buildControls();
})();
