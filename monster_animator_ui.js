/* monster_animator_ui.js — controls panel, canvas drag/scroll, save + export.
 * Consumes the globals exposed by monster_animator_app.js (window.__animCore /
 * window.__anim). Persisting writes localStorage('lx_anim_calib'); when the tool
 * and game are served from the SAME origin (e.g. both via the local preview
 * server) the game's 'storage' listener applies edits live with no reload. */
(function () {
  'use strict';
  const core = window.__animCore, A = window.__anim;
  const LS_KEY = 'lx_anim_calib';
  const HB_LS_KEY = 'lx_atk_hitbox';
  const RANGES = { s: [0.3, 3, 0.01], dx: [-0.6, 0.6, 0.005], dy: [-0.6, 0.6, 0.005] };
  const HB_RANGES = { w: [0.05, 2.5, 0.005], h: [0.05, 2.5, 0.005], ox: [-1, 1, 0.005], oy: [-1, 1, 0.005] };
  const isDefault = (v) => v.s === 1 && v.dx === 0 && v.dy === 0;

  // ---- undo (snapshot stack of calib + hitbox, capped) ----
  const HIST = [];
  function snapshot() {
    HIST.push(JSON.stringify({ c: core.CALIB(), h: core.HBX() }));
    if (HIST.length > 80) HIST.shift();
    updateUndoBtn();
  }
  function undo() {
    const s = HIST.pop();
    if (!s) { toast('Nothing to undo'); updateUndoBtn(); return; }
    const d = JSON.parse(s);
    core.restore(d.c, d.h);
    persist(true); persistHB(true);
    window.__buildControls();
    toast('Undone'); updateUndoBtn();
  }
  function updateUndoBtn() {
    const b = document.getElementById('undo');
    if (b) { b.disabled = !HIST.length; b.style.opacity = HIST.length ? '1' : '.45'; }
  }

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
  // hitbox entries only exist when customized — persist them all, drop empties
  function compactHB() {
    const H = core.HBX(), out = {};
    for (const t of Object.keys(H)) {
      const st = {};
      for (const s of core.STATES) { const v = H[t][s]; if (v) st[s] = { w: +v.w.toFixed(4), h: +v.h.toFixed(4), ox: +v.ox.toFixed(4), oy: +v.oy.toFixed(4) }; }
      if (Object.keys(st).length) out[t] = st;
    }
    return out;
  }
  function persistHB(silent) {
    try { localStorage.setItem(HB_LS_KEY, JSON.stringify(compactHB())); if (!silent) toast('Hitboxes saved — live in same-origin game tabs'); }
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
  function hbSlider(st, k, v) {
    const [mn, mx, step] = HB_RANGES[k];
    return `<div class="sl"><label>${k}</label>` +
      `<input type="range" data-hbst="${st}" data-k="${k}" min="${mn}" max="${mx}" step="${step}" value="${v}" />` +
      `<input type="number" data-hbst="${st}" data-k="${k}" min="${mn}" max="${mx}" step="${step}" value="${v}" /></div>`;
  }
  function hbCard(st) {
    const custom = core.hbFor(A.cur, st);
    const v = custom || core.defaultHB(A.cur, st);
    return `<div class="scard" data-hbcard="${st}" style="border-color:${custom ? '#ff9e3d' : 'var(--line)'}">` +
      `<div class="srow"><h3><i class="dot" style="background:#ff9e3d"></i>${st} · atk hitbox${custom ? '' : ' <span class="mut">(default)</span>'}</h3>` +
      `<button class="reset" data-hbreset="${st}">default</button></div>` +
      hbSlider(st, 'w', v.w) + hbSlider(st, 'h', v.h) + hbSlider(st, 'ox', v.ox) + hbSlider(st, 'oy', v.oy) + `</div>`;
  }
  window.__buildControls = function () {
    const cur = A.cur, body = document.getElementById('ctrlBody'), empty = document.getElementById('ctrlEmpty');
    if (!cur) { body.style.display = 'none'; empty.style.display = 'block'; return; }
    empty.style.display = 'none'; body.style.display = 'block';
    const ent = core.MAN[cur], C = core.CALIB()[cur];
    let html = `<div class="who">${cur}</div>` +
      `<div class="mut" style="font-size:11px;margin-bottom:10px">${ent.group} · base ${ent.base ? ent.base.w + '×' + ent.base.h : '—'} · click a state header to focus in overlay</div>`;
    for (const st of core.STATES) if (ent.states[st]) html += card(st, C[st]);
    if (A.hbEdit) {
      html += `<div class="mut" style="font-size:11px;margin:8px 0 6px">ATK HITBOX — the region player attacks can hit. w/h/ox/oy are fractions of sprite height; oy = bottom offset from the feet (+down). Drag the box in the stage, or its corner handle to resize.</div>`;
      for (const st of core.STATES) if (ent.states[st]) html += hbCard(st);
    }
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
  // hitbox numeric edit: materialize from default on first touch, then mutate
  function setHBVal(st, k, raw) {
    const [mn, mx] = HB_RANGES[k]; let v = +raw; if (!isFinite(v)) return;
    v = Math.max(mn, Math.min(mx, v));
    let hb = core.hbFor(A.cur, st);
    if (!hb) { hb = core.defaultHB(A.cur, st); core.setHB(A.cur, st, hb); }
    hb[k] = v;
    document.querySelectorAll(`[data-hbst="${st}"][data-k="${k}"]`).forEach(el => { el.value = v; });
    persistHB(true);
  }
  function wire() {
    document.querySelectorAll('#ctrlBody input[data-st]').forEach(el => {
      el.addEventListener('focus', snapshot, { once: true });
      el.addEventListener('input', () => setVal(el.dataset.st, el.dataset.k, el.value));
    });
    document.querySelectorAll('#ctrlBody input[data-hbst]').forEach(el => {
      el.addEventListener('focus', snapshot, { once: true });
      el.addEventListener('input', () => setHBVal(el.dataset.hbst, el.dataset.k, el.value));
    });
    document.querySelectorAll('[data-reset]').forEach(b => b.onclick = () => {
      snapshot();
      const st = b.dataset.reset; core.CALIB()[A.cur][st] = { s: 1, dx: 0, dy: 0 }; syncCard(st); persist(true); toast(st + ' reset');
    });
    document.querySelectorAll('[data-hbreset]').forEach(b => b.onclick = () => {
      snapshot();
      const st = b.dataset.hbreset; core.clearHB(A.cur, st); persistHB(true); window.__buildControls(); toast(st + ' hitbox -> game default');
    });
    document.querySelectorAll('[data-card]').forEach(c => c.addEventListener('mousedown', () => core.setFocus(c.dataset.card)));
    const ra = document.getElementById('resetAll');
    if (ra) ra.onclick = () => {
      snapshot();
      for (const s of core.STATES) { core.CALIB()[A.cur][s] = { s: 1, dx: 0, dy: 0 }; core.clearHB(A.cur, s); }
      window.__buildControls(); persist(true); persistHB(true); toast(A.cur + ' reset');
    };
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
    if (!A.cur) return; const p = evtXY(e);
    // edit-hitbox mode is EXCLUSIVE: the sprite never drags. Corner handle =
    // resize; anywhere else in a state's column = move that state's box (no
    // need to start the drag inside the box — sprites often overhang it).
    if (A.hbEdit) {
      const rects = A.hbRects();
      let r = rects.find(r => Math.abs(p.x - (r.x + r.w)) <= 14 && Math.abs(p.y - (r.y + r.h)) <= 14);
      const onHandle = !!r;
      if (!r) r = rects.find(r => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
      if (!r) { const st = stateAt(p.x); r = rects.find(q => q.st === st); }
      if (!r) return;
      snapshot();
      let hb = core.hbFor(A.cur, r.st);
      if (!hb) { hb = core.defaultHB(A.cur, r.st); core.setHB(A.cur, r.st, hb); }
      drag = { kind: onHandle ? 'hbresize' : 'hbmove', st: r.st, x: p.x, y: p.y,
               ph: r.previewH, w0: hb.w, h0: hb.h, ox0: hb.ox, oy0: hb.oy };
      core.setFocus(r.st);
      return;
    }
    const st = stateAt(p.x); if (!st) return;
    snapshot();
    const g = A.stateGeom(st); const v = core.CALIB()[A.cur][st];
    drag = { kind: 'sprite', st, x: p.x, y: p.y, dx0: v.dx, dy0: v.dy, ph: g.previewH }; core.setFocus(st);
  });
  window.addEventListener('mousemove', e => {
    if (!drag) return; const p = evtXY(e);
    const ddx = (p.x - drag.x) / drag.ph, ddy = (p.y - drag.y) / drag.ph;
    if (drag.kind === 'hbmove' || drag.kind === 'hbresize') {
      const hb = core.hbFor(A.cur, drag.st); if (!hb) return;
      const cl = (v, r) => Math.max(r[0], Math.min(r[1], v));
      if (drag.kind === 'hbmove') {
        hb.ox = cl(drag.ox0 + ddx, HB_RANGES.ox);
        hb.oy = cl(drag.oy0 + ddy, HB_RANGES.oy);
      } else {
        // bottom-right handle: width grows symmetrically, height grows downward
        // (bottom edge follows the cursor; oy compensates so the TOP stays put).
        hb.w = cl(drag.w0 + ddx * 2, HB_RANGES.w);
        hb.h = cl(drag.h0 + ddy, HB_RANGES.h);
        hb.oy = cl(drag.oy0 + (hb.h - drag.h0), HB_RANGES.oy);
      }
      ['w', 'h', 'ox', 'oy'].forEach(k =>
        document.querySelectorAll(`[data-hbst="${drag.st}"][data-k="${k}"]`).forEach(el => { el.value = hb[k]; }));
      return;
    }
    const v = core.CALIB()[A.cur][drag.st];
    v.dx = Math.max(-0.6, Math.min(0.6, drag.dx0 + ddx));
    v.dy = Math.max(-0.6, Math.min(0.6, drag.dy0 + ddy));
    syncCard(drag.st);
  });
  window.addEventListener('mouseup', () => {
    if (!drag) return;
    if (drag.kind === 'sprite') persist(true); else { persistHB(true); window.__buildControls(); }
    drag = null;
  });
  cv.addEventListener('wheel', e => {
    if (!A.cur) return; e.preventDefault();
    const p = evtXY(e); const st = stateAt(p.x); if (!st) return;
    // edit-hitbox mode: wheel scales the BOX (uniform w+h), never the sprite.
    if (A.hbEdit) {
      if (!cv._wh) snapshot();           // one undo step per wheel burst
      let hb = core.hbFor(A.cur, st);
      if (!hb) { hb = core.defaultHB(A.cur, st); core.setHB(A.cur, st, hb); }
      const f = e.deltaY < 0 ? 1.04 : 1 / 1.04;
      const cl = (v, r) => Math.max(r[0], Math.min(r[1], v));
      hb.w = cl(hb.w * f, HB_RANGES.w);
      hb.h = cl(hb.h * f, HB_RANGES.h);
      ['w', 'h'].forEach(k =>
        document.querySelectorAll(`[data-hbst="${st}"][data-k="${k}"]`).forEach(el => { el.value = hb[k]; }));
      core.setFocus(st);
      clearTimeout(cv._wh); cv._wh = setTimeout(() => { persistHB(true); window.__buildControls(); cv._wh = null; }, 250);
      return;
    }
    if (!cv._w) snapshot();              // one undo step per wheel burst
    const v = core.CALIB()[A.cur][st];
    v.s = Math.max(0.3, Math.min(3, v.s + (e.deltaY < 0 ? 0.03 : -0.03)));
    core.setFocus(st); syncCard(st);
    clearTimeout(cv._w); cv._w = setTimeout(() => { persist(true); cv._w = null; }, 250);
  }, { passive: false });

  // ---- export anim_calib.js ----
  function exportFile() {
    const data = compact(), hbData = compactHB();
    const header =
      '// Baked per-(monster/boss, state) animation calibration + attack hitboxes.\n' +
      '// Authored with monster_animator.html. Game merges: localStorage > this file > defaults.\n' +
      '// CALIB: s = size multiplier; dx/dy = nudge as a FRACTION of rendered sprite height (+dy = down).\n' +
      '// HITBOX (_atkMonBox override): w/h = box size, ox = center x-offset, oy = bottom\n' +
      '// offset from the foot line (+down) — all fractions of rendered sprite height.\n' +
      '// Missing entries keep the game defaults.\n';
    const txt = header + 'window.LX_ANIM_CALIB = ' + JSON.stringify(data, null, 2) + ';\n' +
      'window.LX_ATK_HITBOX = ' + JSON.stringify(hbData, null, 2) + ';\n';
    const blob = new Blob([txt], { type: 'text/javascript' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'anim_calib.js';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Downloaded anim_calib.js (' + Object.keys(data).length + ' calib + ' + Object.keys(hbData).length + ' hitbox entries)');
  }

  // ---- top bar wiring ----
  document.getElementById('q').addEventListener('input', e => core.buildList(e.target.value));
  document.getElementById('overlay').addEventListener('change', e => core.setOverlay(e.target.checked));
  const hbEl = document.getElementById('hitbox');
  if (hbEl && core.setHitbox) hbEl.addEventListener('change', e => core.setHitbox(e.target.checked));
  const hbeEl = document.getElementById('hbedit');
  const hintEl = document.getElementById('hint');
  const HINT_SPRITE = 'Drag a sprite in the stage to nudge its X/Y · scroll-wheel over a sprite to scale';
  const HINT_HB = 'EDIT HITBOX: drag anywhere in a column to move that state’s box · drag the orange corner handle to resize · scroll-wheel to scale the box';
  if (hbeEl) hbeEl.addEventListener('change', e => {
    core.setHbEdit(e.target.checked);
    if (hintEl) hintEl.textContent = e.target.checked ? HINT_HB : HINT_SPRITE;
    window.__buildControls();
  });
  const fpsEl = document.getElementById('fps');
  fpsEl.addEventListener('input', e => { core.setFps(+e.target.value); document.getElementById('fpsv').textContent = e.target.value; });
  document.getElementById('save').onclick = () => { persist(false); persistHB(true); };
  document.getElementById('download').onclick = exportFile;
  const undoBtn = document.getElementById('undo');
  if (undoBtn) undoBtn.onclick = undo;
  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); undo(); }
    }
  });
  updateUndoBtn();

  // first paint of controls (in case an entity is preselected later)
  window.__buildControls();
})();
