/* Boss Frame Resizer — authoring UI for per-frame boss sprite scale.
 * ---------------------------------------------------------------------------
 * WHY: _BOSS_FRAME_TRUST_ALL = true, so the runtime never rescales a boss
 * frame any more — whatever size drift is baked into the art reaches the
 * screen. _drawBossSprite DOES honour a per-frame scale array (calib.fs[i],
 * foot-anchored) and scripts/apply_anim_patch.mjs already bakes it, but no
 * tool could author one, so no entity has ever had an fs. This is that tool.
 *
 * Two independent size faults, both authorable here:
 *   1. CROSS-STATE  — the figure occupies a different share of the canvas in
 *      one state than another (aetherion / towerArbiter attack frames draw the
 *      body at 58% of idle). Fixed with the per-state scale `s`.
 *   2. WITHIN-STATE — frames of one set disagree with each other. Fixed with
 *      `fs[i]`.
 * Not all drift is a fault: a reared weapon legitimately grows the content box
 * without the figure growing, which is why the measurement band is a first-
 * class control and nothing is ever auto-applied.
 * ------------------------------------------------------------------------- */
'use strict';
(function () {
  const MAN = window.LX_BOSS_RESIZE || {};
  const BAKED = window.LX_ANIM_CALIB || {};
  const HITBOX = window.LX_ATK_HITBOX || {};
  const STATE_MS = { idle: 130, walk: 80, attack: 48, duck: 90, weave: 80 };
  const BAND_T = 8;            // profile byte above which a row band counts as occupied
  const CLAMP = [0.2, 5];      // the game's own clamp in _lxAnimCalib

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, txt) => { const n = document.createElement(tag);
    if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  let toastT = 0;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1700);
  }

  // ---- edit model ---------------------------------------------------------
  // edits[type][state] = { s, dx, dy, fs:[] }. Seeded from the baked calib so
  // the tool round-trips whatever is already hardbaked instead of stomping it.
  const edits = {};
  function calibOf(type, state) {
    const t = edits[type] || (edits[type] = {});
    if (!t[state]) {
      const b = (BAKED[type] && BAKED[type][state]) || null;
      t[state] = {
        s: b && +b.s > 0 ? +b.s : 1,
        dx: b && isFinite(+b.dx) ? +b.dx : 0,
        dy: b && isFinite(+b.dy) ? +b.dy : 0,
        fs: (b && Array.isArray(b.fs)) ? b.fs.map(Number) : null,
      };
    }
    return t[state];
  }
  function fsAt(type, state, i) {
    const c = calibOf(type, state);
    return (c.fs && +c.fs[i] > 0) ? +c.fs[i] : 1;
  }
  function setFs(type, state, i, v) {
    const c = calibOf(type, state), n = setOf(type, state).count;
    if (!c.fs) c.fs = new Array(n).fill(1);
    c.fs[i] = clamp(+v || 1, CLAMP[0], CLAMP[1]);
    if (c.fs.every(x => Math.abs(x - 1) < 1e-6)) c.fs = null;
  }

  // ---- measurement (manifest only — never needs canvas pixel access) ------
  const profCache = new Map();
  function prof(set, i) {
    const key = set.dir + '|' + i;
    let p = profCache.get(key);
    if (!p) {
      const bin = atob(set.f[i].p);
      p = new Uint8Array(bin.length);
      for (let k = 0; k < bin.length; k++) p[k] = bin.charCodeAt(k);
      profCache.set(key, p);
    }
    return p;
  }
  // Returns {top, bottom, h} in SOURCE pixels for the chosen measurement mode.
  function span(set, i, mode, band) {
    const f = set.f[i];
    if (mode === 'solid' && f.s) return { top: f.s[0], bottom: f.s[1], h: f.s[1] - f.s[0] + 1 };
    if (mode === 'band') {
      const p = prof(set, i), N = p.length;
      const b0 = clamp(Math.floor(band[0] * N), 0, N - 1);
      const b1 = clamp(Math.ceil(band[1] * N), 1, N);
      let t = -1, b = -1;
      for (let k = b0; k < b1; k++) if (p[k] > BAND_T) { if (t < 0) t = k; b = k; }
      if (t < 0) return { top: 0, bottom: 0, h: 0 };
      const top = Math.round(t * set.h / N), bottom = Math.round((b + 1) * set.h / N) - 1;
      return { top, bottom, h: bottom - top + 1 };
    }
    return { top: f.c[0], bottom: f.c[1], h: f.c[1] - f.c[0] + 1 };
  }
  function heights(set, mode, band) {
    return set.f.map((_, i) => span(set, i, mode, band).h);
  }
  function driftPct(hs) {
    const v = hs.filter(h => h > 0);
    if (v.length < 2) return 0;
    const mn = Math.min(...v), mx = Math.max(...v);
    return mn > 0 ? (mx - mn) / mn * 100 : 0;
  }

  const setOf = (type, state) => MAN[type] && MAN[type].states[state];
  const statesOf = (type) => MAN[type] ? Object.keys(MAN[type].states) : [];

  // ---- entity list --------------------------------------------------------
  // Each row is badged with its worst CONTENT drift across states, which is the
  // cheap screen for "does this boss need looking at" — the honest verdict
  // still needs the band, and the panel says so once a boss is open.
  const worstDrift = {};
  for (const [type, e] of Object.entries(MAN)) {
    let w = 0;
    for (const st of Object.keys(e.states)) w = Math.max(w, driftPct(heights(e.states[st], 'content', [0, 1])));
    worstDrift[type] = w;
  }
  function buildList(filter) {
    const host = $('ents'); host.innerHTML = '';
    const q = (filter || '').toLowerCase();
    const names = Object.keys(MAN).filter(t => !q || t.toLowerCase().includes(q))
      .sort((a, b) => worstDrift[b] - worstDrift[a]);
    for (const type of names) {
      const row = el('div', 'ent' + (type === cur.type ? ' sel' : ''));
      const left = el('div');
      left.appendChild(el('div', 'n', type));
      left.appendChild(el('div', 'g', MAN[type].group + ' · ' + statesOf(type).join(' ')));
      const d = worstDrift[type];
      const pill = el('span', 'pill ' + (d < 3 ? 'p-ok' : d < 12 ? 'p-warn' : 'p-bad'), d.toFixed(0) + '%');
      pill.title = 'worst content-height drift across this boss’s states';
      row.appendChild(left); row.appendChild(pill);
      row.onclick = () => select(type);
      host.appendChild(row);
    }
    if (!names.length) host.appendChild(el('div', 'empty', 'no boss matches that'));
  }

  // ---- selection ----------------------------------------------------------
  const cur = { type: null, state: null, frame: 0, mode: 'content', band: [0.45, 1], imgs: [], t0: 0 };
  window.__BR = { cur, edits, MAN, calibOf, span, heights, driftPct, setOf };

  function select(type) {
    cur.type = type;
    cur.state = statesOf(type).includes('attack') ? 'attack' : statesOf(type)[0];
    cur.frame = 0; cur.t0 = performance.now();
    loadFrames();
    buildList($('q').value);
    buildStates();
    redraw();
  }
  // late-bound: the render half of the tool is the second IIFE below
  function redraw() {
    const B = window.__BR;
    if (B.renderPanel) B.renderPanel();
    if (B.renderStrip) B.renderStrip();
  }
  function loadFrames() {
    const set = setOf(cur.type, cur.state);
    cur.imgs = [];
    if (!set) return;
    for (let i = 0; i < set.count; i++) {
      const img = new Image();
      img.crossOrigin = 'anonymous';   // CDN art is ACAO:* — keeps the canvas clean
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

  window.__BR.redraw = redraw;
  window.__BR.loadFrames = loadFrames;
  window.__BR.buildStates = buildStates;
  window.__BR.select = select;
  window.__BR.buildList = buildList;
  window.__BR.toast = toast;
  window.__BR.fsAt = fsAt;
  window.__BR.setFs = setFs;
  window.__BR.clamp = clamp;
  window.__BR.median = median;
  window.__BR.el = el;
  window.__BR.$ = $;
  window.__BR.STATE_MS = STATE_MS;
  window.__BR.CLAMP = CLAMP;
  window.__BR.HITBOX = HITBOX;
  window.__BR.BAKED = BAKED;
  window.__BR.statesOf = statesOf;
})();

/* ---- render half: stage, frame strip -------------------------------------
 * The stage shows the SAME frame twice, playing in sync: "as authored" on the
 * left and "with calibration" on the right. That side-by-side is the whole
 * point of the tool — a size pulse is invisible in numbers and obvious when
 * the two figures are running next to each other.
 * Geometry mirrors the game under _BOSS_FRAME_TRUST_ALL: every frame of a set
 * shares one canvas, that canvas maps to a CONSTANT on-screen box, and the
 * scale (s x fs[i]) is applied about the foot point — ctx.translate(footX,
 * footY); ctx.scale(v, v) — exactly as _drawBossSprite does it.
 * ----------------------------------------------------------------------- */
(function () {
  const B = window.__BR, cur = B.cur, $ = B.$, el = B.el;
  const stage = $('stage'), sx = stage.getContext('2d');
  // The box a frame's canvas maps to, and the foot line. H0 is re-fitted per
  // set so the LARGEST fs still draws inside the stage - a frame scaled 1.4x
  // was running off the top and reading as 'no change' when it was the biggest
  // change on screen.
  const GROUND = 400, H_MAX = 236;
  let H0 = H_MAX;
  function fitH0(set) {
    let mx = 1;
    for (let i = 0; i < set.count; i++) mx = Math.max(mx, B.fsAt(cur.type, cur.state, i));
    mx *= Math.max(1, B.calibOf(cur.type, cur.state).s);
    H0 = Math.min(H_MAX, (GROUND - 12) / mx);
    B.GEO = { GROUND, H0 };
  }

  function curSet() { return B.setOf(cur.type, cur.state); }
  function refHeight() {
    const set = curSet(); if (!set) return 0;
    const hs = B.heights(set, cur.mode, cur.band).filter(h => h > 0);
    if (!hs.length) return 0;
    switch (cur.ref || 'median') {
      case 'first': return B.heights(set, cur.mode, cur.band)[0] || hs[0];
      case 'max': return Math.max(...hs);
      case 'min': return Math.min(...hs);
      case 'idle': {
        const idle = B.setOf(cur.type, 'idle');
        if (!idle) return B.median(hs);
        const ih = B.heights(idle, cur.mode, cur.band).filter(h => h > 0);
        return ih.length ? B.median(ih) * (set.h / idle.h) : B.median(hs);
      }
      default: return B.median(hs);
    }
  }

  function gameFrameIndex(n, ms, t) {
    // ping-pong over the contiguous run, the game's _bossLoopFrame cadence
    if (n < 2) return 0;
    const period = (n - 1) * 2, k = Math.floor(t / ms) % period;
    return k < n ? k : period - k;
  }

  function drawSide(cx, img, set, scale, label, tint) {
    const k = H0 / set.h, W0 = set.w * k;
    sx.save();
    sx.translate(cx, GROUND);
    sx.scale(scale, scale);
    if (img && img.complete && img.naturalWidth) sx.drawImage(img, -W0 / 2, -H0, W0, H0);
    sx.restore();
    sx.fillStyle = tint; sx.font = '600 11px ui-sans-serif,system-ui';
    sx.textAlign = 'center';
    sx.fillText(label, cx, GROUND + 34);
  }

  // refScale: the scale the REFERENCE is drawn at on this side (1 for the
  // authored figure, the state's s for the calibrated one). Without it the
  // dashed line sat at the unscaled reference while the figure was drawn at
  // s x fs, so a correctly-normalised set still looked like it overshot.
  function drawSpanBar(cx, set, sp, scale, ref, color, refScale) {
    if (!sp.h) return;
    const k = H0 / set.h;
    const yb = GROUND - (set.h - sp.bottom - 1) * k * scale;
    const yt = GROUND - (set.h - sp.top) * k * scale;
    // track the ACTUAL scaled half-width, else a scaled-up frame draws over its own bar
    const x = Math.min(stage.width - 46, cx + (set.w * k) / 2 * scale + 14);
    sx.strokeStyle = color; sx.lineWidth = 2;
    sx.beginPath(); sx.moveTo(x, yt); sx.lineTo(x, yb);
    sx.moveTo(x - 5, yt); sx.lineTo(x + 5, yt);
    sx.moveTo(x - 5, yb); sx.lineTo(x + 5, yb); sx.stroke();
    if ($('ghost').checked && ref > 0) {
      const yRef = yb - ref * k * (refScale || 1);   // the target span height on THIS side
      sx.strokeStyle = '#ffcc66'; sx.lineWidth = 1; sx.setLineDash([5, 4]);
      sx.beginPath(); sx.moveTo(cx - 130, yRef); sx.lineTo(cx + 130, yRef); sx.stroke();
      sx.setLineDash([]);
    }
    sx.fillStyle = color; sx.font = '10px ui-monospace,Consolas,monospace';
    sx.textAlign = 'left';
    sx.fillText(Math.round(sp.h * scale) + 'px', x + 8, (yt + yb) / 2);
  }

  function drawBand(set) {
    if (cur.mode !== 'band') return;
    const k = H0 / set.h;
    for (const [f, lbl] of [[cur.band[0], 'band top'], [cur.band[1], 'band bottom']]) {
      const y = GROUND - (1 - f) * set.h * k;
      sx.strokeStyle = 'rgba(192,140,255,.55)'; sx.lineWidth = 1; sx.setLineDash([3, 3]);
      sx.beginPath(); sx.moveTo(0, y); sx.lineTo(stage.width, y); sx.stroke(); sx.setLineDash([]);
      sx.fillStyle = 'rgba(192,140,255,.75)'; sx.font = '10px ui-sans-serif';
      sx.textAlign = 'left'; sx.fillText(lbl, 6, y - 3);
    }
  }

  function paint() {
    sx.clearRect(0, 0, stage.width, stage.height);
    const set = curSet();
    if (!set) return;
    fitH0(set);
    const n = set.count;
    const ms = B.STATE_MS[cur.state] || 100;
    if ($('play').checked) cur.frame = gameFrameIndex(n, ms, performance.now() - cur.t0);
    const i = Math.min(cur.frame, n - 1);
    const img = cur.imgs[i];
    const c = B.calibOf(cur.type, cur.state);
    const fsv = $('applyfs').checked ? B.fsAt(cur.type, cur.state, i) : 1;
    const sv = $('applyfs').checked ? c.s : 1;

    // ground line
    sx.strokeStyle = '#3a2f55'; sx.lineWidth = 1;
    sx.beginPath(); sx.moveTo(0, GROUND + .5); sx.lineTo(stage.width, GROUND + .5); sx.stroke();
    drawBand(set);

    const sp = B.span(set, i, cur.mode, cur.band);
    const ref = refHeight();
    drawSide(250, img, set, 1, 'as authored', '#9d92bb');
    drawSpanBar(250, set, sp, 1, ref, '#9d92bb', 1);
    drawSide(650, img, set, fsv * sv, 'with calibration', '#c08cff');
    drawSpanBar(650, set, sp, fsv * sv, ref, '#c08cff', sv);

    sx.textAlign = 'left'; sx.fillStyle = '#6f658c'; sx.font = '11px ui-monospace,Consolas,monospace';
    sx.fillText(`${cur.type} / ${cur.state} — frame ${i}/${n - 1} · ${ms}ms · s=${c.s.toFixed(3)} fs=${fsv.toFixed(3)}`, 10, 16);
    sx.fillText(`ref ${Math.round(ref)}px (${cur.ref || 'median'})`, 10, 30);
  }
  B.paint = paint;   // exposed so a headless check can drive a frame without rAF
  (function loop() { paint(); requestAnimationFrame(loop); })();

  // ---- frame strip --------------------------------------------------------
  B.renderStrip = function () {
    const host = $('strip'); host.innerHTML = '';
    const set = curSet(); if (!set) return;
    const hs = B.heights(set, cur.mode, cur.band), ref = refHeight();
    for (let i = 0; i < set.count; i++) {
      const cell = el('div', 'fr' + (i === cur.frame ? ' on' : ''));
      const cv = el('canvas'); cv.width = 148; cv.height = 110;
      const c2 = cv.getContext('2d');
      const img = cur.imgs[i];
      const paintThumb = () => {
        c2.clearRect(0, 0, cv.width, cv.height);
        if (!img.complete || !img.naturalWidth) return;
        const k = cv.height / set.h * 0.95, w = set.w * k, h = set.h * k;
        const v = $('applyfs').checked ? B.fsAt(cur.type, cur.state, i) : 1;
        c2.save(); c2.translate(cv.width / 2, cv.height - 2); c2.scale(v, v);
        c2.drawImage(img, -w / 2, -h, w, h); c2.restore();
      };
      paintThumb(); img.addEventListener('load', paintThumb, { once: true });
      cell.appendChild(cv);
      const dev = ref > 0 && hs[i] > 0 ? (hs[i] * B.fsAt(cur.type, cur.state, i) / ref - 1) * 100 : 0;
      const t = el('div', 't', `${i} · ${hs[i]}px`);
      const v = el('div', 'v', (dev >= 0 ? '+' : '') + dev.toFixed(1) + '%');
      v.style.color = Math.abs(dev) < 1 ? '#7ddba0' : Math.abs(dev) < 5 ? '#ffcc66' : '#ff7a7a';
      const inp = el('input'); inp.type = 'number'; inp.step = '0.005'; inp.min = '0.2'; inp.max = '5';
      inp.value = B.fsAt(cur.type, cur.state, i).toFixed(3);
      inp.onchange = () => { B.setFs(cur.type, cur.state, i, inp.value); B.renderStrip(); B.renderPanel(); };
      inp.onclick = (e) => e.stopPropagation();
      cell.appendChild(t); cell.appendChild(v); cell.appendChild(inp);
      cell.onclick = () => { $('play').checked = false; cur.frame = i; B.renderStrip(); };
      host.appendChild(cell);
    }
  };
})();

/* ---- control half: verdict, cross-state, solve, export ------------------- */
(function () {
  const B = window.__BR, cur = B.cur, $ = B.$, el = B.el;

  function curSet() { return B.setOf(cur.type, cur.state); }
  function num(val, step, min, max, on) {
    const i = el('input'); i.type = 'number'; i.step = step; i.min = min; i.max = max;
    i.value = (+val).toFixed(3); i.onchange = () => on(+i.value); return i;
  }
  function kv(k, v, color) {
    const r = el('div', 'kv'); r.appendChild(el('span', null, k));
    const b = el('b', null, v); if (color) b.style.color = color;
    r.appendChild(b); return r;
  }
  // Figure size of a state relative to idle, measured the same way. This is the
  // CROSS-STATE fault (aetherion attack draws the body at 58% of its idle), and
  // it is fixed with one `s` per state — fs is for frames disagreeing INSIDE a
  // state. Normalising by canvas share, so sets on different canvases compare.
  function relToIdle(state) {
    const set = B.setOf(cur.type, state), idle = B.setOf(cur.type, 'idle');
    if (!set || !idle) return null;
    const a = B.heights(set, cur.mode, cur.band).filter(h => h > 0);
    const b = B.heights(idle, cur.mode, cur.band).filter(h => h > 0);
    if (!a.length || !b.length) return null;
    return (B.median(a) / set.h) / (B.median(b) / idle.h);
  }

  B.renderPanel = function () {
    const host = $('ctrlBody'), set = curSet();
    $('ctrlEmpty').style.display = set ? 'none' : '';
    host.style.display = set ? '' : 'none';
    if (!set) return;
    host.innerHTML = '';
    const c = B.calibOf(cur.type, cur.state);
    const hs = B.heights(set, cur.mode, cur.band);
    const dContent = B.driftPct(B.heights(set, 'content', cur.band));
    const dBand = B.driftPct(B.heights(set, 'band', cur.band));
    const dNow = B.driftPct(hs);
    const after = B.driftPct(hs.map((h, i) => h * B.fsAt(cur.type, cur.state, i)));

    const s1 = el('div', 'sec'); s1.appendChild(el('h2', null, 'drift - ' + cur.state));
    s1.appendChild(kv('content (alpha>16)', dContent.toFixed(1) + '%'));
    s1.appendChild(kv('measured (' + cur.mode + ')', dNow.toFixed(1) + '%'));
    s1.appendChild(kv('after calibration', after.toFixed(1) + '%',
      after < 1 ? '#7ddba0' : after < 5 ? '#ffcc66' : '#ff7a7a'));
    // The trap this tool exists to avoid: a reared weapon grows the content box
    // while the body holds still. Normalising THAT shrinks the wind-up pose.
    if (dContent > 6 && dBand < 2) {
      const w = el('div', 'warnbox');
      w.innerHTML = '<b>Content drift here is pose, not size.</b> The full extent varies '
        + dContent.toFixed(0) + '% but the band holds to ' + dBand.toFixed(1)
        + '% - a weapon or limb is reaching out of frame. Normalising on <i>content</i> would '
        + 'shrink the wind-up. Leave this state alone, or switch to <b>band</b>.';
      s1.appendChild(w);
    } else if (dNow < 2) {
      s1.appendChild(el('div', 'okbox', 'Consistent under the current measure - nothing to fix here.'));
    }
    host.appendChild(s1);

    const s2 = el('div', 'sec'); s2.appendChild(el('h2', null, 'figure size vs idle'));
    for (const st of B.statesOf(cur.type)) {
      const r = relToIdle(st);
      if (r == null) continue;
      const row = el('div', 'row'); row.style.justifyContent = 'space-between';
      const lab = el('span', null, st); lab.style.flex = '1';
      const val = el('b', null, (r * 100).toFixed(0) + '%');
      val.style.color = Math.abs(r - 1) < .04 ? '#7ddba0' : Math.abs(r - 1) < .12 ? '#ffcc66' : '#ff7a7a';
      row.appendChild(lab); row.appendChild(val);
      if (Math.abs(r - 1) >= .04) {
        const b = el('button', 'ghost', 'match idle');
        b.title = 'set s = ' + (1 / r).toFixed(3) + ' for ' + st;
        b.onclick = () => {
          B.calibOf(cur.type, st).s = B.clamp(1 / r, B.CLAMP[0], B.CLAMP[1]);
          B.toast(st + ' s = ' + (1 / r).toFixed(3)); B.renderPanel();
        };
        row.appendChild(b);
      }
      s2.appendChild(row);
    }
    s2.appendChild(el('div', 'note', 'Median figure height as a share of its own canvas, against idle. '
      + 'One scale per state fixes this axis; fs fixes frames disagreeing inside a state.'));
    host.appendChild(s2);

    const s3 = el('div', 'sec'); s3.appendChild(el('h2', null, 'solve fs'));
    const refRow = el('div', 'row');
    refRow.appendChild(el('span', null, 'reference'));
    const sel = el('select');
    for (const [v, t] of [['median', 'median frame'], ['first', 'frame 0'], ['max', 'tallest'],
                          ['min', 'shortest'], ['idle', 'idle set']]) {
      const o = el('option', null, t); o.value = v;
      if ((cur.ref || 'median') === v) o.selected = true;
      sel.appendChild(o);
    }
    sel.onchange = () => { cur.ref = sel.value; B.renderPanel(); B.renderStrip(); };
    refRow.appendChild(sel); s3.appendChild(refRow);
    const solve = el('button', 'primary', 'Solve fs for ' + cur.state);
    solve.style.marginTop = '8px'; solve.style.width = '100%';
    solve.onclick = () => {
      const m = B.heights(set, cur.mode, cur.band), hh = m.filter(h => h > 0);
      if (!hh.length) return;
      const idleSet = B.setOf(cur.type, 'idle');
      const idleRef = () => {
        if (!idleSet) return B.median(hh);
        const ih = B.heights(idleSet, cur.mode, cur.band).filter(h => h > 0);
        return ih.length ? B.median(ih) * (set.h / idleSet.h) : B.median(hh);
      };
      const target = { median: B.median(hh), first: m[0], max: Math.max(...hh),
                       min: Math.min(...hh), idle: idleRef() }[cur.ref || 'median'];
      let clamped = 0;
      for (let i = 0; i < set.count; i++) {
        if (!m[i]) continue;
        const want = target / m[i];
        if (want < B.CLAMP[0] || want > B.CLAMP[1]) clamped++;
        B.setFs(cur.type, cur.state, i, want);
      }
      B.toast('solved ' + cur.state + (clamped ? ' - ' + clamped + ' clamped' : ''));
      B.renderPanel(); B.renderStrip();
    };
    s3.appendChild(solve);
    s3.appendChild(el('div', 'note', 'fs[i] = reference / measured[i], applied about the feet, so an '
      + 'under-drawn frame grows in place instead of hopping. Clamped to the game 0.2-5 range.'));
    host.appendChild(s3);

    const s4 = el('div', 'sec'); s4.appendChild(el('h2', null, cur.state + ' calib'));
    for (const [k, step, mn, mx] of [['s', '0.005', '0.2', '5'], ['dx', '0.005', '-1.5', '1.5'],
                                     ['dy', '0.005', '-1.5', '1.5']]) {
      const r = el('div', 'row'); r.style.marginBottom = '5px';
      const lab = el('span', null, k); lab.style.width = '22px';
      r.appendChild(lab);
      r.appendChild(num(c[k], step, mn, mx, (v) => { c[k] = v; B.renderPanel(); }));
      s4.appendChild(r);
    }
    s4.appendChild(el('div', 'note', 'dx / dy are fractions of the rendered sprite height, as the game reads them.'));
    host.appendChild(s4);

    const s5 = el('div', 'sec'); s5.appendChild(el('h2', null, 'export'));
    const ta = el('textarea'); ta.readOnly = true; ta.value = B.patchJSON();
    s5.appendChild(ta);
    const btn = el('button', 'primary', 'Copy patch');
    btn.style.width = '100%'; btn.style.marginTop = '7px';
    btn.onclick = B.copyPatch;
    s5.appendChild(btn);
    s5.appendChild(el('div', 'note', 'Paste in chat to have it hardbaked (scripts/apply_anim_patch.mjs). '
      + 'The blob carries every state of this boss plus its existing attack hitbox, because the '
      + 'applier replaces the whole entity block.'));
    host.appendChild(s5);
  };
})();

/* ---- patch export + input wiring ----------------------------------------- */
(function () {
  const B = window.__BR, cur = B.cur, $ = B.$;

  // apply_anim_patch.mjs is DECLARATIVE per entity: it replaces the entity's
  // whole calib block, and DELETES its hitbox when the patch carries none. So
  // emit every state that has (or had) a value, and carry the baked hitbox
  // through untouched - otherwise baking a resize would silently drop an
  // authored attack hitbox.
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
  $('mode').onclick = (e) => {
    const b = e.target.closest('button[data-m]');
    if (!b) return;
    cur.mode = b.dataset.m;
    for (const x of $('mode').querySelectorAll('button')) x.classList.toggle('on', x === b);
    B.redraw();
  };
  for (const id of ['applyfs', 'ghost']) $(id).onchange = () => B.redraw();
  $('play').onchange = () => { cur.t0 = performance.now(); };
  $('reset').onclick = () => {
    if (!cur.type) return;
    B.calibOf(cur.type, cur.state).fs = null;
    B.toast('fs cleared for ' + cur.state);
    B.redraw();
  };
  $('copy').onclick = () => B.copyPatch();

  // Drag on the stage to set the measurement band - a pair of fractions of the
  // canvas height, measured up from the ground. This is how you tell the tool
  // "measure the torso and ignore the hammer".
  let dragging = null;
  const stage = $('stage');
  const fracAt = (ev) => {
    const r = stage.getBoundingClientRect();
    const y = (ev.clientY - r.top) * (stage.height / r.height);
    const G = B.GEO || { GROUND: 400, H0: 236 };
    return B.clamp(1 - (G.GROUND - y) / G.H0, 0, 1);
  };
  stage.addEventListener('pointerdown', (e) => {
    if (cur.mode !== 'band' || !cur.type) return;
    const f = fracAt(e);
    dragging = Math.abs(f - cur.band[0]) < Math.abs(f - cur.band[1]) ? 0 : 1;
    cur.band[dragging] = f;
    stage.setPointerCapture(e.pointerId);
    B.redraw();
  });
  stage.addEventListener('pointermove', (e) => {
    if (dragging == null) return;
    cur.band[dragging] = fracAt(e);
    if (cur.band[0] > cur.band[1]) { cur.band.reverse(); dragging = 1 - dragging; }
    B.redraw();
  });
  stage.addEventListener('pointerup', () => { dragging = null; });

  B.buildList('');
})();
