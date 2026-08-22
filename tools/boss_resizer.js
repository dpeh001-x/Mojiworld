/* Boss Frame Resizer — resize a boss animation by its FINAL on-screen height.
 * ---------------------------------------------------------------------------
 * v1 of this tool exposed the machinery: source-canvas pixels, per-state s,
 * per-frame fs, three measurement modes, a draggable band, a reference picker.
 * Per user that was confusing. This version folds the whole size chain into ONE
 * number — the height in GAME PIXELS the sprite actually draws at — and you
 * resize that. The tool works backwards to the calibration.
 *
 * The chain it folds (mirrors _drawBossSprite with the runtime normaliser off):
 *   targetH = round(m.h x BOSS_DRAW_SCALE x sizeFactor x zodiacSizeMul)
 *             [baked into the manifest as state.game.targetH]
 *   drawn   = targetH x (frame content height / canvas height) x s x fs[i]
 * Typing a height solves s. "Even out frames" solves fs[].
 * ------------------------------------------------------------------------- */
'use strict';
(function () {
  const MAN = window.LX_BOSS_RESIZE || {};
  const BAKED = window.LX_ANIM_CALIB || {};
  const HITBOX = window.LX_ATK_HITBOX || {};
  const STATE_MS = { idle: 130, walk: 80, attack: 48, duck: 90, weave: 80 };
  const CLAMP = [0.2, 5];
  const BAND_T = 8;

  const $ = (id) => document.getElementById(id);
  const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c;
    if (x != null) n.textContent = x; return n; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  let toastT = 0;
  const toast = (m) => { const t = $('toast'); t.textContent = m; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1700); };

  const setOf = (t, s) => MAN[t] && MAN[t].states[s];
  const statesOf = (t) => MAN[t] ? Object.keys(MAN[t].states) : [];

  // ---- edit model, seeded from the hardbaked calib so nothing is stomped ----
  const edits = {};
  function calibOf(type, state) {
    const t = edits[type] || (edits[type] = {});
    if (!t[state]) {
      const b = (BAKED[type] && BAKED[type][state]) || null;
      t[state] = { s: b && +b.s > 0 ? +b.s : 1, dx: b && isFinite(+b.dx) ? +b.dx : 0,
        dy: b && isFinite(+b.dy) ? +b.dy : 0,
        fs: (b && Array.isArray(b.fs)) ? b.fs.map(Number) : null };
    }
    return t[state];
  }
  const fsAt = (t, s, i) => { const c = calibOf(t, s); return (c.fs && +c.fs[i] > 0) ? +c.fs[i] : 1; };

  // ---- measurement ---------------------------------------------------------
  const profCache = new Map();
  function prof(set, i) {
    const k = set.dir + '|' + i;
    let p = profCache.get(k);
    if (!p) { const b = atob(set.f[i].p); p = new Uint8Array(b.length);
      for (let j = 0; j < b.length; j++) p[j] = b.charCodeAt(j); profCache.set(k, p); }
    return p;
  }
  // Full drawn extent of a frame, in SOURCE px — what "how tall does this look"
  // means, and what the on-screen height is computed from.
  const srcH = (set, i) => set.f[i].c[1] - set.f[i].c[0] + 1;
  // Body height: the lower 55% of the canvas only. A reared weapon grows the
  // content box without the FIGURE growing (Barnaby's attack drifts 15.5% by
  // content and 0.0% by this), so evening out frames measures here — otherwise
  // levelling a set would shrink every wind-up pose.
  function bodyH(set, i) {
    const p = prof(set, i), N = p.length, b0 = Math.floor(0.45 * N);
    let t = -1, b = -1;
    for (let k = b0; k < N; k++) if (p[k] > BAND_T) { if (t < 0) t = k; b = k; }
    return t < 0 ? 0 : Math.round((b - t + 1) * set.h / N);
  }
  // FINAL on-screen height in game pixels, calibration included.
  function finalH(type, state, i, withCalib) {
    const set = setOf(type, state);
    if (!set || !set.game) return 0;
    const base = srcH(set, i) / set.h * set.game.targetH;
    return withCalib === false ? base : base * calibOf(type, state).s * fsAt(type, state, i);
  }
  // The state's representative height — the median frame, so a single wind-up
  // pose does not define the number you are typing into.
  function stateH(type, state, withCalib) {
    const set = setOf(type, state);
    if (!set || !set.game) return 0;
    return median(set.f.map((_, i) => finalH(type, state, i, withCalib)));
  }
  const idleH = (type) => statesOf(type).includes('idle') ? stateH(type, 'idle', true) : 0;

  // ---- entity list: ranked by the largest state-to-state size difference ----
  function spread(type) {
    const ih = idleH(type);
    if (!ih) return 0;
    let w = 0;
    for (const st of statesOf(type)) w = Math.max(w, Math.abs(stateH(type, st, true) / ih - 1) * 100);
    return w;
  }
  function buildList(filter) {
    const host = $('ents'); host.innerHTML = '';
    const q = (filter || '').toLowerCase();
    const names = Object.keys(MAN).filter(t => !q || t.toLowerCase().includes(q))
      .sort((a, b) => spread(b) - spread(a));
    for (const type of names) {
      const row = el('div', 'ent' + (type === cur.type ? ' sel' : ''));
      const left = el('div');
      left.appendChild(el('div', 'n', type));
      const h = idleH(type) || stateH(type, statesOf(type)[0], true);
      left.appendChild(el('div', 'g', Math.round(h) + ' px · ' + statesOf(type).join(' ')));
      const d = spread(type);
      const pill = el('span', 'pill ' + (d < 4 ? 'p-ok' : d < 12 ? 'p-warn' : 'p-bad'), d.toFixed(0) + '%');
      pill.title = 'largest state-to-state size difference';
      row.appendChild(left); row.appendChild(pill);
      row.onclick = () => select(type);
      host.appendChild(row);
    }
    if (!names.length) host.appendChild(el('div', 'empty', 'no boss matches that'));
  }

  const cur = { type: null, state: null, frame: 0, imgs: [], t0: 0 };
  function select(type) {
    cur.type = type;
    cur.state = statesOf(type)[0];
    cur.frame = 0; cur.t0 = performance.now();
    loadFrames(); buildList($('q').value); buildStates(); redraw();
  }
  function loadFrames() {
    const set = setOf(cur.type, cur.state);
    cur.imgs = [];
    if (!set) return;
    for (let i = 0; i < set.count; i++) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = set.dir + '_' + i + '.webp';
      cur.imgs.push(img);
    }
  }
  function buildStates() {
    const host = $('states'); host.innerHTML = '';
    for (const st of statesOf(cur.type)) {
      const b = el('button', st === cur.state ? 'on' : '', st);
      b.onclick = () => { cur.state = st; cur.frame = 0; cur.t0 = performance.now();
        loadFrames(); buildStates(); redraw(); };
      host.appendChild(b);
    }
  }
  function redraw() {
    const B = window.__BR;
    if (B.renderPanel) B.renderPanel();
    if (B.renderStrip) B.renderStrip();
  }

  window.__BR = { MAN, BAKED, HITBOX, STATE_MS, CLAMP, cur, edits, $, el, clamp, median, toast,
    setOf, statesOf, calibOf, fsAt, srcH, bodyH, finalH, stateH, idleH, buildList, buildStates,
    loadFrames, select, redraw };
})();

/* ---- stage: the sprite at its true final size, on a game-pixel ruler ------
 * One stage pixel is one game pixel wherever the boss fits, so the number in
 * the panel and the figure on screen are the same thing. The view scale is
 * fixed per BOSS, not per state, or switching idle->walk would rescale the
 * canvas and hide the very size change you are looking for.
 * ----------------------------------------------------------------------- */
(function () {
  const B = window.__BR, cur = B.cur, $ = B.$, el = B.el;
  const stage = $('stage'), sx = stage.getContext('2d');
  const GROUND = 578, CX = 470;

  function viewScale() {
    let tall = 1;
    for (const st of B.statesOf(cur.type))
      for (let i = 0; i < B.setOf(cur.type, st).count; i++)
        tall = Math.max(tall, B.finalH(cur.type, st, i, true), B.finalH(cur.type, st, i, false));
    return Math.min(1, (GROUND - 46) / tall);
  }

  function gameFrameIndex(n, ms, t) {
    if (n < 2) return 0;
    const period = (n - 1) * 2, k = Math.floor(t / ms) % period;
    return k < n ? k : period - k;
  }

  // Draw one frame so its CONTENT sits exactly `h` game px tall, feet on the
  // ground line — the same foot anchoring the game uses.
  function drawFrame(img, set, h, k, alpha) {
    if (!img || !img.complete || !img.naturalWidth) return;
    const i = cur.frame;
    const cH = B.srcH(set, i), top = set.f[i].c[0], bot = set.f[i].c[1];
    const canvasH = h * (set.h / cH);              // whole canvas height at this content height
    const canvasW = canvasH * (set.w / set.h);
    const belowFeet = (set.h - 1 - bot) / set.h * canvasH;   // gap under the content, kept
    sx.save();
    sx.globalAlpha = alpha;
    sx.drawImage(img, CX - canvasW * k / 2, GROUND - (canvasH - belowFeet) * k,
                 canvasW * k, canvasH * k);
    sx.restore();
    return { topY: GROUND - (canvasH - belowFeet) * k + (top / set.h) * canvasH * k };
  }

  function ruler(k) {
    sx.strokeStyle = '#2c2340'; sx.fillStyle = '#6f658c';
    sx.font = '10px ui-monospace,Consolas,monospace'; sx.textAlign = 'left';
    sx.lineWidth = 1;
    for (let g = 0; g <= 900; g += 50) {
      const y = GROUND - g * k;
      if (y < 26) break;
      sx.globalAlpha = g % 100 ? 0.35 : 0.7;
      sx.beginPath(); sx.moveTo(34, y + .5); sx.lineTo(stage.width - 8, y + .5); sx.stroke();
      if (!(g % 100)) { sx.globalAlpha = 1; sx.fillText(g + '', 6, y + 3); }
    }
    sx.globalAlpha = 1;
  }

  function paint() {
    sx.clearRect(0, 0, stage.width, stage.height);
    const set = cur.type && B.setOf(cur.type, cur.state);
    if (!set) return;
    const k = viewScale();
    const n = set.count, ms = B.STATE_MS[cur.state] || 100;
    if ($('play').checked) cur.frame = gameFrameIndex(n, ms, performance.now() - cur.t0);
    if (cur.frame >= n) cur.frame = 0;
    ruler(k);

    // the idle height, so every other state has something to agree with
    const ih = B.idleH(cur.type);
    if (ih) {
      const y = GROUND - ih * k;
      sx.strokeStyle = '#ffcc66'; sx.setLineDash([6, 4]); sx.lineWidth = 1;
      sx.beginPath(); sx.moveTo(34, y + .5); sx.lineTo(stage.width - 8, y + .5); sx.stroke();
      sx.setLineDash([]);
      sx.fillStyle = '#ffcc66'; sx.font = '11px ui-sans-serif,system-ui'; sx.textAlign = 'right';
      sx.fillText('idle ' + Math.round(ih) + 'px', stage.width - 12, y - 5);
    }

    // ground
    sx.strokeStyle = '#4a3d6b'; sx.lineWidth = 2;
    sx.beginPath(); sx.moveTo(34, GROUND + 1); sx.lineTo(stage.width - 8, GROUND + 1); sx.stroke();

    const img = cur.imgs[cur.frame];
    const hNow = B.finalH(cur.type, cur.state, cur.frame, true);
    if ($('before').checked) {
      const hWas = B.finalH(cur.type, cur.state, cur.frame, false);
      drawFrame(img, set, hWas, k, 0.28);
      sx.fillStyle = 'rgba(157,146,187,.85)'; sx.font = '11px ui-sans-serif,system-ui';
      sx.textAlign = 'left';
      sx.fillText('ghost = original ' + Math.round(hWas) + 'px', 40, GROUND - hWas * k - 8);
    }
    drawFrame(img, set, hNow, k, 1);

    sx.textAlign = 'left'; sx.fillStyle = '#c08cff';
    sx.font = '600 12px ui-sans-serif,system-ui';
    sx.fillText(Math.round(hNow) + ' px', 40, GROUND - hNow * k - 24);
    sx.fillStyle = '#6f658c'; sx.font = '11px ui-monospace,Consolas,monospace';
    sx.fillText(`${cur.type} / ${cur.state} — frame ${cur.frame}/${n - 1} · ${ms}ms`
      + (k < 0.999 ? `  ·  view ${(k * 100).toFixed(0)}%` : '  ·  1:1'), 40, 18);
  }
  B.paint = paint;
  (function loop() { paint(); requestAnimationFrame(loop); })();

  // ---- frame strip: every frame's final height, at a glance ---------------
  B.renderStrip = function () {
    const host = $('strip'); host.innerHTML = '';
    const set = cur.type && B.setOf(cur.type, cur.state);
    if (!set) return;
    const hs = set.f.map((_, i) => B.finalH(cur.type, cur.state, i, true));
    const med = B.median(hs);
    for (let i = 0; i < set.count; i++) {
      const cell = el('div', 'fr' + (i === cur.frame ? ' on' : ''));
      const cv = el('canvas'); cv.width = 140; cv.height = 100;
      const c2 = cv.getContext('2d'), img = cur.imgs[i];
      const draw = () => {
        c2.clearRect(0, 0, cv.width, cv.height);
        if (!img.complete || !img.naturalWidth) return;
        const kk = (cv.height * 0.92) / Math.max(...hs);
        const cH = B.srcH(set, i), bot = set.f[i].c[1];
        const canvasH = hs[i] * (set.h / cH), canvasW = canvasH * (set.w / set.h);
        const below = (set.h - 1 - bot) / set.h * canvasH;
        c2.drawImage(img, cv.width / 2 - canvasW * kk / 2, cv.height - 2 - (canvasH - below) * kk,
                     canvasW * kk, canvasH * kk);
      };
      draw(); img.addEventListener('load', draw, { once: true });
      cell.appendChild(cv);
      const dev = med > 0 ? (hs[i] / med - 1) * 100 : 0;
      const t = el('div', 't', Math.round(hs[i]) + 'px');
      t.style.color = Math.abs(dev) < 1.5 ? '#7ddba0' : Math.abs(dev) < 6 ? '#ffcc66' : '#ff7a7a';
      cell.appendChild(t);
      cell.onclick = () => { $('play').checked = false; cur.frame = i; B.renderStrip(); };
      host.appendChild(cell);
    }
  };
})();

/* ---- panel: one number, and the two buttons that move it ----------------- */
(function () {
  const B = window.__BR, cur = B.cur, $ = B.$, el = B.el;

  // Typing a height solves the per-state scale: drawn = natural x s, so
  // s = wanted / natural. Everything else in the chain is already inside
  // `natural`, which is the point of this rewrite.
  function setHeight(px) {
    const nat = B.stateH(cur.type, cur.state, false);
    if (!nat) return;
    const c = B.calibOf(cur.type, cur.state);
    c.s = B.clamp(px / nat, B.CLAMP[0], B.CLAMP[1]);
    B.redraw();
  }
  // Level the frames of one state against each other. Measured on the LOWER
  // BODY, not the full extent, so a reared weapon or an outstretched limb does
  // not read as the figure growing and get shrunk away.
  function evenOut(on) {
    const set = B.setOf(cur.type, cur.state), c = B.calibOf(cur.type, cur.state);
    if (!on) { c.fs = null; B.redraw(); return; }
    const body = set.f.map((_, i) => B.bodyH(set, i));
    const good = body.filter(h => h > 0);
    if (!good.length) { B.toast('cannot measure this set'); return; }
    const ref = B.median(good);
    c.fs = body.map(h => h > 0 ? +B.clamp(ref / h, B.CLAMP[0], B.CLAMP[1]).toFixed(4) : 1);
    if (c.fs.every(v => Math.abs(v - 1) < 1e-6)) c.fs = null;
    B.redraw();
  }

  B.renderPanel = function () {
    const host = $('ctrlBody'), set = cur.type && B.setOf(cur.type, cur.state);
    $('ctrlEmpty').style.display = set ? 'none' : '';
    host.style.display = set ? '' : 'none';
    if (!set) return;
    host.innerHTML = '';
    if (!set.game) {
      host.appendChild(el('div', 'sec', 'No game size is known for this entity, so a final height cannot be shown.'));
      return;
    }
    const now = B.stateH(cur.type, cur.state, true);
    const was = B.stateH(cur.type, cur.state, false);
    const ih = B.idleH(cur.type);
    const c = B.calibOf(cur.type, cur.state);

    // ---- the one number ----
    const s1 = el('div', 'sec');
    s1.appendChild(el('h2', null, cur.state + ' — final height'));
    const big = el('div', 'big', Math.round(now) + '');
    big.appendChild(el('small', null, 'px on screen'));
    s1.appendChild(big);
    if (Math.abs(now - was) > 0.5) {
      const d = el('div', 'delta', 'was ' + Math.round(was) + 'px  ·  ' +
        ((now / was - 1) * 100 >= 0 ? '+' : '') + ((now / was - 1) * 100).toFixed(1) + '%');
      d.style.color = '#c08cff'; s1.appendChild(d);
    }
    const range = el('input'); range.type = 'range';
    range.min = Math.round(was * 0.4); range.max = Math.round(was * 2.2);
    range.step = 1; range.value = Math.round(now);
    range.style.marginTop = '12px';
    range.oninput = () => setHeight(+range.value);
    s1.appendChild(range);
    const numRow = el('div', 'row'); numRow.style.marginTop = '8px';
    const num = el('input'); num.type = 'number'; num.step = '1';
    num.min = '10'; num.max = '2000'; num.value = Math.round(now);
    num.onchange = () => setHeight(+num.value);
    numRow.appendChild(num);
    if (ih && cur.state !== 'idle') {
      const mi = el('button', 'ghost', 'match idle');
      mi.title = 'set this state to ' + Math.round(ih) + 'px';
      mi.onclick = () => { setHeight(ih); B.toast(cur.state + ' -> ' + Math.round(ih) + 'px'); };
      numRow.appendChild(mi);
    }
    s1.appendChild(numRow);
    if (ih && cur.state !== 'idle') {
      const off = (now / ih - 1) * 100;
      const line = el('div', 'delta', Math.abs(off) < 0.5 ? 'matches idle'
        : (off > 0 ? '+' : '') + off.toFixed(0) + '% vs idle (' + Math.round(ih) + 'px)');
      line.style.color = Math.abs(off) < 4 ? '#7ddba0' : Math.abs(off) < 12 ? '#ffcc66' : '#ff7a7a';
      s1.appendChild(line);
    }
    host.appendChild(s1);

    // ---- every state at a glance, click to jump ----
    const s2 = el('div', 'sec');
    s2.appendChild(el('h2', null, 'all states'));
    for (const st of B.statesOf(cur.type)) {
      const h = B.stateH(cur.type, st, true);
      const r = el('div', 'kv');
      r.appendChild(el('span', null, st));
      const b = el('b', null, Math.round(h) + ' px');
      if (ih) b.style.color = Math.abs(h / ih - 1) < .04 ? '#7ddba0'
        : Math.abs(h / ih - 1) < .12 ? '#ffcc66' : '#ff7a7a';
      r.appendChild(b);
      r.onclick = () => { cur.state = st; cur.frame = 0; cur.t0 = performance.now();
        B.loadFrames(); B.buildStates(); B.redraw(); };
      s2.appendChild(r);
    }
    host.appendChild(s2);

    // ---- the only other control ----
    const s3 = el('div', 'sec');
    s3.appendChild(el('h2', null, 'frames'));
    const hs = set.f.map((_, i) => B.finalH(cur.type, cur.state, i, true));
    const med = B.median(hs);
    const pulse = med > 0 ? (Math.max(...hs) - Math.min(...hs)) / med * 100 : 0;
    const bodyHs = set.f.map((_, i) => B.bodyH(set, i)).filter(h => h > 0);
    const bodyPulse = bodyHs.length ? (Math.max(...bodyHs) - Math.min(...bodyHs)) / B.median(bodyHs) * 100 : 0;
    s3.appendChild(el('div', 'delta', 'frame-to-frame spread ' + pulse.toFixed(0) + '%'));
    const lab = el('label', 'chk'); lab.style.marginTop = '9px';
    const cb = el('input'); cb.type = 'checkbox'; cb.checked = !!c.fs;
    cb.onchange = () => evenOut(cb.checked);
    lab.appendChild(cb); lab.appendChild(el('span', null, 'even out frames'));
    s3.appendChild(lab);
    if (pulse > 6 && bodyPulse < 3) {
      s3.appendChild(el('div', 'warnbox', 'That spread is pose, not size — the body holds to '
        + bodyPulse.toFixed(1) + '% while the full extent moves ' + pulse.toFixed(0)
        + '%, so a weapon or limb is reaching out of frame. Levelling here would only flatten the wind-up; the body is already even.'));
    }
    s3.appendChild(el('div', 'note', 'Levelling measures the lower body, so a reared weapon does not count as the figure growing.'));
    host.appendChild(s3);

    // ---- export ----
    const s4 = el('div', 'sec');
    s4.appendChild(el('h2', null, 'export'));
    const ta = el('textarea'); ta.readOnly = true; ta.value = B.patchJSON();
    s4.appendChild(ta);
    const btn = el('button', 'primary', 'Copy patch');
    btn.style.width = '100%'; btn.style.marginTop = '7px';
    btn.onclick = B.copyPatch;
    s4.appendChild(btn);
    s4.appendChild(el('div', 'note', 'Paste in chat to have it hardbaked. Carries every state of '
      + 'this boss plus its existing attack hitbox, because the applier replaces the whole entity block.'));
    host.appendChild(s4);
  };
  B.setHeight = setHeight;
  B.evenOut = evenOut;
})();

/* ---- export + wiring ----------------------------------------------------- */
(function () {
  const B = window.__BR, cur = B.cur, $ = B.$;

  // apply_anim_patch.mjs is declarative per entity: it replaces the whole calib
  // block and DELETES the hitbox when the patch carries none. Emit every state,
  // and carry the baked hitbox through untouched.
  B.patchJSON = function () {
    const type = cur.type;
    if (!type) return '';
    const calib = {};
    const states = new Set([...Object.keys(B.BAKED[type] || {}), ...Object.keys(B.edits[type] || {})]);
    for (const st of states) {
      const c = B.calibOf(type, st);
      const e = { s: +(+c.s).toFixed(4), dx: +(+c.dx).toFixed(4), dy: +(+c.dy).toFixed(4) };
      if (c.fs && c.fs.some(v => Math.abs(v - 1) > 1e-6)) e.fs = c.fs.map(v => +(+v).toFixed(4));
      if (e.s !== 1 || e.dx !== 0 || e.dy !== 0 || e.fs) calib[st] = e;
    }
    const out = { LX_ANIM_PATCH: 1, type, calib };
    if (B.HITBOX[type]) out.hitbox = B.HITBOX[type];
    return JSON.stringify(out);
  };
  B.copyPatch = function () {
    const s = B.patchJSON();
    if (!s) return;
    (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject())
      .then(() => B.toast('patch copied - paste it in chat'))
      .catch(() => B.toast('copy blocked - select the text in the export box'));
  };

  $('q').oninput = () => B.buildList($('q').value);
  $('play').onchange = () => { cur.t0 = performance.now(); };
  $('before').onchange = () => B.redraw();
  $('copy').onclick = () => B.copyPatch();
  $('revert').onclick = () => {
    if (!cur.type) return;
    delete B.edits[cur.type];
    B.toast('reverted ' + cur.type);
    B.buildList($('q').value); B.redraw();
  };
  B.buildList('');
})();
