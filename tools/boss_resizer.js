/* Boss Animation Resizer — one size per ANIMATION, not per frame.
 * ---------------------------------------------------------------------------
 * Per user: "it should not be a frame by frame calibrator, it should be an
 * animation by animation calibrator i.e walking, attack, etc. for all the
 * different types of animation available for that boss".
 *
 * So: pick a boss, and every animation it owns appears at once as a card —
 * idle, walk, attack, duck, weave, and for the multi-form bosses each form's
 * cast sets too (gravitos2 laser / punch / soul / star ...). Every card plays
 * live at its TRUE final size in game pixels, on a shared ground line and a
 * shared scale, with one editable height under it. Cards that disagree with
 * the boss's idle height are the bug, and they are visibly the odd one out.
 *
 * The size chain folded into that one number (mirrors _drawBossSprite with the
 * runtime normaliser off):
 *   targetH = round(m.h x BOSS_DRAW_SCALE x sizeFactor x zodiacSizeMul)
 *             [baked per state into the manifest as state.game.targetH]
 *   drawn   = targetH x (frame content height / canvas height) x calib.s
 * Typing a height solves calib.s. There is no per-frame authoring here at all;
 * any fs[] already hardbaked is passed through the export untouched.
 * ------------------------------------------------------------------------- */
'use strict';
(function () {
  const MAN = window.LX_BOSS_RESIZE || {};
  const BAKED = window.LX_ANIM_CALIB || {};
  const HITBOX = window.LX_ATK_HITBOX || {};
  const STATE_MS = { idle: 130, walk: 80, attack: 48, duck: 90, weave: 80 };
  const CLAMP = [0.2, 5];

  const $ = (id) => document.getElementById(id);
  const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c;
    if (x != null) n.textContent = x; return n; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  let toastT = 0;
  const toast = (m) => { const t = $('toast'); t.textContent = m; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1700); };

  // ---- grouping: manifest keys are calib keys, bosses are what you pick -----
  // gravitos ships eleven calib keys (three forms x their cast sets); they are
  // all ONE boss with many animations, which is the view this tool wants.
  function bossOf(key) {
    if (key.startsWith('zodiac_')) return key;
    if (key.startsWith('gravitos')) return 'gravitos';
    if (key.startsWith('aetherion')) return 'aetherion';
    if (key.startsWith('legosaurus')) return 'legosaurus';
    return key;
  }
  // Human label for a (key, state) pair: the form, then the move.
  function animLabel(key, state) {
    const boss = bossOf(key);
    if (key === boss) return state;
    let rest = key.slice(boss.length);            // '2star', 'dash', '2', ...
    const form = rest.match(/^(\d+)/);
    const move = rest.replace(/^\d+/, '');
    const parts = [];
    if (form) parts.push('form ' + form[1]);
    parts.push(move || state);
    return parts.join(' · ');
  }

  const BOSSES = {};
  for (const [key, e] of Object.entries(MAN)) {
    const b = bossOf(key);
    (BOSSES[b] || (BOSSES[b] = [])).push(...Object.keys(e.states).map(st => ({ key, state: st })));
  }
  // Reading order, not disk order: form 1 before form 2, and within a form
  // idle -> walk -> attack -> the cast sets. Sorting by key name alone put
  // 'soul' ahead of 'laser' and scattered the forms.
  const MOVE = { idle: 0, walk: 1, attack: 2, dash: 3, duck: 4, weave: 5,
                 laser: 6, punch: 7, soul: 8, star: 9 };
  const rank = (a) => {
    const boss = bossOf(a.key);
    const rest = a.key === boss ? '' : a.key.slice(boss.length);
    const form = (rest.match(/^(\d+)/) || [0, 1])[1] | 0;
    const move = rest.replace(/^\d+/, '') || a.state;
    return [form || 1, MOVE[move] != null ? MOVE[move] : 20, move];
  };
  for (const list of Object.values(BOSSES)) {
    list.sort((a, b) => { const x = rank(a), y = rank(b);
      return (x[0] - y[0]) || (x[1] - y[1]) || String(x[2]).localeCompare(String(y[2])); });
  }

  // ---- edit model, seeded from the hardbaked calib so nothing is stomped ----
  const edits = {};
  function calibOf(key, state) {
    const t = edits[key] || (edits[key] = {});
    if (!t[state]) {
      const b = (BAKED[key] && BAKED[key][state]) || null;
      t[state] = { s: b && +b.s > 0 ? +b.s : 1, dx: b && isFinite(+b.dx) ? +b.dx : 0,
        dy: b && isFinite(+b.dy) ? +b.dy : 0,
        // never authored here any more, only carried through
        fs: (b && Array.isArray(b.fs)) ? b.fs.map(Number) : null };
    }
    return t[state];
  }

  // ---- measurement ---------------------------------------------------------
  const setOf = (key, state) => MAN[key] && MAN[key].states[state];
  const srcSpan = (set, i) => set.f[i].c[1] - set.f[i].c[0] + 1;
  // FINAL on-screen height of one frame, in game pixels.
  function frameH(key, state, i, withCalib) {
    const set = setOf(key, state);
    if (!set || !set.game) return 0;
    const base = srcSpan(set, i) / set.h * set.game.targetH;
    if (withCalib === false) return base;
    const c = calibOf(key, state);
    const fs = (c.fs && +c.fs[i] > 0) ? +c.fs[i] : 1;
    return base * c.s * fs;
  }
  // The animation's height — the median frame, so one wind-up pose does not
  // define the number. This is the only size this tool talks about.
  function animH(key, state, withCalib) {
    const set = setOf(key, state);
    if (!set || !set.game) return 0;
    return median(set.f.map((_, i) => frameH(key, state, i, withCalib)));
  }
  // Typing a height solves the animation's scale: drawn = natural x s.
  function setAnimH(key, state, px) {
    const nat = animH(key, state, false);
    if (!nat) return;
    calibOf(key, state).s = clamp(px / nat, CLAMP[0], CLAMP[1]);
  }
  // VERTICAL NUDGE. calib.dy is a fraction of the pre-calib box height and the
  // game translates by dy * targetH before scaling, so on screen it is exactly
  // that many game pixels, positive = DOWN, and it does not drift when the
  // animation is resized.
  function dyPx(key, state) {
    const set = setOf(key, state);
    if (!set || !set.game) return 0;
    return calibOf(key, state).dy * set.game.targetH;
  }
  function setDyPx(key, state, px) {
    const set = setOf(key, state);
    if (!set || !set.game) return;
    calibOf(key, state).dy = clamp(px / set.game.targetH, -1.5, 1.5);
  }
  // Horizontal is the same translate — and the game scales dx by targetH too
  // (the box HEIGHT, not its width), so a unit is the same distance on either
  // axis and this is plain game pixels, positive = right.
  function dxPx(key, state) {
    const set = setOf(key, state);
    if (!set || !set.game) return 0;
    return calibOf(key, state).dx * set.game.targetH;
  }
  function setDxPx(key, state, px) {
    const set = setOf(key, state);
    if (!set || !set.game) return;
    calibOf(key, state).dx = clamp(px / set.game.targetH, -1.5, 1.5);
  }
  // The FORM a calib key belongs to: gravitos2star -> gravitos2, gravitoslaser
  // -> gravitos, legosaurusdash -> legosaurus. Cast sets borrow their form's
  // body, so that form's idle is what they should measure against.
  function formKeyOf(key) {
    const boss = bossOf(key);
    if (key === boss) return boss;
    const rest = key.slice(boss.length);
    const form = rest.match(/^(\d+)/);
    return form ? boss + form[1] : boss;
  }
  // The yardstick for one animation: its own form's idle. Gravitos form 2 is
  // MEANT to stand taller than form 1, so measuring every form against form 1
  // would flag the phase escalation as a bug and "match all" would flatten it.
  function refH(key) {
    const fk = formKeyOf(key);
    if (setOf(fk, 'idle')) return animH(fk, 'idle', true);
    const boss = bossOf(key);
    if (setOf(boss, 'idle')) return animH(boss, 'idle', true);
    const a = (BOSSES[boss] || [])[0];
    return a ? animH(a.key, a.state, true) : 0;
  }
  const isRef = (key, state) => state === 'idle' && key === formKeyOf(key);
  function idleH(boss) {
    if (setOf(boss, 'idle')) return animH(boss, 'idle', true);
    const a = (BOSSES[boss] || [])[0];
    return a ? animH(a.key, a.state, true) : 0;
  }
  function spread(boss) {
    let w = 0;
    for (const a of BOSSES[boss]) {
      if (isRef(a.key, a.state)) continue;
      const r = refH(a.key);
      if (r) w = Math.max(w, Math.abs(animH(a.key, a.state, true) / r - 1) * 100);
    }
    return w;
  }

  const cur = { boss: null, cards: [], t0: 0 };
  window.__BR = { MAN, BAKED, HITBOX, BOSSES, STATE_MS, CLAMP, cur, edits,
    $, el, clamp, median, toast, bossOf, animLabel, calibOf, setOf, srcSpan,
    frameH, animH, setAnimH, dyPx, setDyPx, dxPx, setDxPx, idleH, spread, refH, isRef, formKeyOf };
})();

/* ---- the contact sheet: every animation of one boss, playing at once ------
 * All cards share one px-to-screen scale and one ground line, so the dashed
 * idle marker lands at the same height in every card and a mismatched
 * animation is visibly the odd one out — the whole reason to show them
 * together instead of one at a time.
 * ----------------------------------------------------------------------- */
(function () {
  const B = window.__BR, cur = B.cur, $ = B.$, el = B.el;
  // GROUND sits well above the bottom edge: a sprite nudged DOWN has to stay
  // visible, and at 26px of headroom it left the card almost immediately.
  const CW = 200, CH = 268, GROUND = CH - 62;
  const HANDLE_W = 54, HANDLE_H = 13;

  // Fixed for as long as one boss is selected — see the note in br4_scale.
  function fitScale() {
    let tall = 1;
    for (const a of B.BOSSES[cur.boss]) {
      const set = B.setOf(a.key, a.state);
      for (let i = 0; i < set.count; i++)
        tall = Math.max(tall, B.frameH(a.key, a.state, i, true), B.frameH(a.key, a.state, i, false));
    }
    cur.k = (GROUND - 14) / (tall * 1.15);   // headroom so a grow does not clip at once
  }
  const viewScale = () => cur.k || 0.3;
  // One flat silhouette per FORM, baked from that form's idle at the frame
  // closest to its median height — a stable shape to hold the animation
  // against. Tinted on a transparent canvas (source-atop on the opaque card
  // would paint a box, the Mirror Self lesson).
  const SIL = new Map();
  function silhouette(formKey) {
    if (SIL.has(formKey)) return SIL.get(formKey);
    const set = B.setOf(formKey, 'idle');
    if (!set) { SIL.set(formKey, null); return null; }
    const hs = set.f.map((_, i) => B.srcSpan(set, i));
    const med = B.median(hs);
    let idx = 0;
    for (let i = 1; i < hs.length; i++)
      if (Math.abs(hs[i] - med) < Math.abs(hs[idx] - med)) idx = i;
    const rec = { set, idx, img: new Image(), cv: null };
    rec.img.crossOrigin = 'anonymous';
    rec.img.onload = () => {
      const H = 460, W = Math.max(1, Math.round(H * set.w / set.h));
      const tint = (col) => {
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const c = cv.getContext('2d');
        c.drawImage(rec.img, 0, 0, W, H);
        c.globalCompositeOperation = 'source-atop';
        c.fillStyle = col; c.fillRect(0, 0, W, H);
        c.globalCompositeOperation = 'source-over';
        return cv;
      };
      rec.cv = tint('#57c9ff');                 // the soft fill, drawn behind
      // Compounding an image onto itself drives alpha toward 1 — the cheap way
      // to turn a soft-edged sprite into a hard stencil.
      const solidify = (src, times) => {
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const c = cv.getContext('2d');
        for (let n = 0; n < times; n++) c.drawImage(src, 0, 0);
        return cv;
      };
      const hard = solidify(rec.cv, 6);
      // the ring: smear the hard stencil 8 ways, then punch the stencil out
      const R = 14;   // bake-space; the ring scales down with the sprite
      const ring = document.createElement('canvas');
      ring.width = W; ring.height = H;
      const rc = ring.getContext('2d');
      for (let a = 0; a < 8; a++) {
        const th = a * Math.PI / 4;
        rc.drawImage(hard, Math.round(Math.cos(th) * R), Math.round(Math.sin(th) * R));
      }
      rc.globalCompositeOperation = 'destination-out';
      rc.drawImage(hard, 0, 0);
      rc.globalCompositeOperation = 'source-over';
      rec.ring = solidify(ring, 3);
    };
    rec.img.src = set.dir + '_' + idx + '.webp';
    SIL.set(formKey, rec);
    return rec;
  }

  function frameIndex(n, ms, t) {
    if (n < 2) return 0;
    const period = (n - 1) * 2, k = Math.floor(t / ms) % period;
    return k < n ? k : period - k;
  }
  // Draw so the frame's content is exactly `h` game px tall with its feet on
  // the ground line — the same foot anchoring _drawBossSprite uses.
  function blit(c2, img, set, i, h, k, alpha, yOff, xOff) {
    // canvases have no .complete / .naturalWidth - the old guard silently
    // dropped every overlay draw, which is why the idle never appeared
    if (!img) return;
    if (img.tagName === 'IMG' && (!img.complete || !img.naturalWidth)) return;
    const cH = B.srcSpan(set, i), bot = set.f[i].c[1];
    const canvasH = h * (set.h / cH), canvasW = canvasH * (set.w / set.h);
    const below = (set.h - 1 - bot) / set.h * canvasH;
    c2.save(); c2.globalAlpha = alpha;
    c2.drawImage(img, CW / 2 - canvasW * k / 2 + (xOff || 0) * k,
                 GROUND - (canvasH - below) * k + (yOff || 0) * k,
                 canvasW * k, canvasH * k);
    c2.restore();
  }

  function buildCards() {
    const host = $('cards');
    host.innerHTML = '';
    cur.cards = [];
    if (!cur.boss) { host.appendChild(el('div', 'empty', 'Pick a boss on the left to see all of its animations.')); return; }
    fitScale();
    const ih = B.idleH(cur.boss);
    for (const a of B.BOSSES[cur.boss]) {
      const set = B.setOf(a.key, a.state);
      const card = el('div', 'card');
      const cv = el('canvas'); cv.width = CW; cv.height = CH;
      cv.title = 'drag up or down to resize this animation';
      card.appendChild(cv);
      const nm = el('div', 'nm');
      nm.appendChild(el('span', null, B.animLabel(a.key, a.state)));
      nm.appendChild(el('em', null, set.count + ' frames'));
      card.appendChild(nm);
      const vs = el('div', 'vs');
      card.appendChild(vs);
      const ctl = el('div', 'ctl');
      const inp = el('input'); inp.type = 'number'; inp.step = '1'; inp.min = '10'; inp.max = '2000';
      inp.onchange = () => { B.setAnimH(a.key, a.state, +inp.value); refresh(); };
      ctl.appendChild(inp);
      const mi = el('button', 'ghost mini', 'idle');
      mi.title = 'match this form\u2019s idle height';
      mi.onclick = () => { B.setAnimH(a.key, a.state, B.refH(a.key)); refresh(); };
      ctl.appendChild(mi);
      card.appendChild(ctl);
      // vertical nudge — the same value the game reads as calib.dy
      const ctl2 = el('div', 'ctl');
      ctl2.appendChild(el('span', 'axis', '\u2194'));
      const xin = el('input'); xin.type = 'number'; xin.step = '1'; xin.min = '-400'; xin.max = '400';
      xin.title = 'horizontal offset in game pixels, + is right';
      xin.onchange = () => { B.setDxPx(a.key, a.state, +xin.value); refresh(); };
      ctl2.appendChild(xin);
      ctl2.appendChild(el('span', 'axis', '\u2195'));
      const yin = el('input'); yin.type = 'number'; yin.step = '1'; yin.min = '-400'; yin.max = '400';
      yin.title = 'vertical offset in game pixels, + is down';
      yin.onchange = () => { B.setDyPx(a.key, a.state, +yin.value); refresh(); };
      ctl2.appendChild(yin);
      const zero = el('button', 'ghost mini', '0');
      zero.title = 'clear both offsets';
      zero.onclick = () => { B.setDxPx(a.key, a.state, 0); B.setDyPx(a.key, a.state, 0); refresh(); };
      ctl2.appendChild(zero);
      card.appendChild(ctl2);
      const imgs = [];
      for (let i = 0; i < set.count; i++) {
        const im = new Image(); im.crossOrigin = 'anonymous';
        im.src = set.dir + '_' + i + '.webp'; imgs.push(im);
      }
      host.appendChild(card);
      const rec = { a, set, cv, c2: cv.getContext('2d'), imgs, inp, xin, yin, vs, card,
                    sil: silhouette(B.formKeyOf(a.key)) };
      cur.cards.push(rec);
      attachDrag(rec);
    }
    refresh();
  }

  // Drag anywhere on a card to scale that animation: the height follows the
  // pointer, relative to where the drag began, so grabbing the middle of a
  // sprite does not make it jump. The canvas is CSS-sized to its own pixel
  // height, so one pointer pixel is one canvas pixel vertically.
  // Where the pointer is in CANVAS coordinates. The canvas is CSS-stretched
  // horizontally but its height is pinned to its pixel height, so only x needs
  // the ratio.
  function local(c, e) {
    const r = c.cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.cv.width / r.width),
             y: (e.clientY - r.top) * (c.cv.height / r.height) };
  }
  const onHandle = (c, p) => !!c.handle && p.x >= c.handle.x0 - 4 && p.x <= c.handle.x1 + 4
                          && p.y >= c.handle.y0 - 4 && p.y <= c.handle.y1 + 4;
  // Direct manipulation: the body moves, the grip scales. Shift swaps them, and
  // the toolbar toggle still decides what a plain body drag does.
  function dragMode(c, e, p) {
    const base = onHandle(c, p) ? 'size' : B.mode;
    return e.shiftKey ? (base === 'size' ? 'move' : 'size') : base;
  }
  function attachDrag(c) {
    let from = null;
    c.cv.addEventListener('pointerdown', (e) => {
      const p = local(c, e);
      // deltas are measured in CANVAS space: the card is CSS-stretched wider
      // than its 200px backing store, so client px and canvas px differ on x
      from = { p, h: B.animH(c.a.key, c.a.state, true),
               dy: B.dyPx(c.a.key, c.a.state), dx: B.dxPx(c.a.key, c.a.state),
               mode: dragMode(c, e, p) };
      c.cv.setPointerCapture(e.pointerId);
      c.card.classList.add('dragging');
      c.cv.style.cursor = from.mode === 'size' ? 'ns-resize' : 'grabbing';   // free move on both axes
      e.preventDefault();
    });
    // hover feedback so the grip is discoverable without reading anything
    c.cv.addEventListener('pointermove', (e) => {
      if (from) return;
      const over = onHandle(c, local(c, e));
      c.hover = over ? 'handle' : null;
      c.cv.style.cursor = over ? 'ns-resize' : (B.mode === 'move' ? 'move' : 'ns-resize');
    });
    c.cv.addEventListener('pointerleave', () => { c.hover = null; });
    c.cv.addEventListener('pointermove', (e) => {
      if (!from) return;
      const k = viewScale();
      if (!k) return;
      const q = local(c, e);
      const d = (from.p.y - q.y) / k;
      if (from.mode === 'move') {
        B.setDyPx(c.a.key, c.a.state, from.dy - d);                      // up = negative dy
        B.setDxPx(c.a.key, c.a.state, from.dx + (q.x - from.p.x) / k);
      } else B.setAnimH(c.a.key, c.a.state, from.h + d);
      refresh(true);                       // light: numbers now, list on release
    });
    const end = () => { if (!from) return; from = null;
      c.card.classList.remove('dragging');
      c.cv.style.cursor = B.mode === 'move' ? 'move' : 'ns-resize';
      refresh(); };
    c.cv.addEventListener('pointerup', end);
    c.cv.addEventListener('pointercancel', end);
  }

  // Numbers only — the canvases repaint themselves on the animation loop.
  // `light` skips the boss list and the patch box, which are too heavy to
  // rebuild on every pointermove.
  function refresh(light) {
    const ih = B.idleH(cur.boss);
    for (const c of cur.cards) {
      const h = B.animH(c.a.key, c.a.state, true);
      c.inp.value = Math.round(h);
      if (c.yin) c.yin.value = Math.round(B.dyPx(c.a.key, c.a.state));
      if (c.xin) c.xin.value = Math.round(B.dxPx(c.a.key, c.a.state));
      const r = B.refH(c.a.key);
      const off = r ? (h / r - 1) * 100 : 0;
      const same = B.isRef(c.a.key, c.a.state);
      c.vs.textContent = same ? 'the idle yardstick'
        : (Math.abs(off) < 0.5 ? 'matches idle'
           : (off > 0 ? '+' : '') + off.toFixed(0) + '% vs idle');
      c.vs.style.color = same ? '#9d92bb'
        : Math.abs(off) < 4 ? '#7ddba0' : Math.abs(off) < 12 ? '#ffcc66' : '#ff7a7a';
      c.card.classList.toggle('off', Math.abs(off) < 4 && !same);
      c.ref = r;
    }
    const sp = B.spread(cur.boss);
    $('summary').textContent = cur.boss
      ? B.BOSSES[cur.boss].length + ' animations · idle ' + Math.round(ih) + ' px · worst '
        + sp.toFixed(0) + '% off'
      : '';
    if (light) return;
    $('patch').value = B.patchJSON();
    B.buildList($('q').value);
  }

  function paint() {
    if (!cur.boss || !cur.cards.length) return;
    const k = viewScale(), showWas = $('before').checked, playing = $('play').checked;
    const showIdle = $('idleover').checked;
    const t = performance.now() - cur.t0;
    const ih = B.idleH(cur.boss);
    // (each card's dashed marker is its OWN form's idle — see refresh())
    for (const c of cur.cards) {
      const { c2, set, a } = c;
      c2.clearRect(0, 0, CW, CH);
      // shared idle marker — same y in every card because k is shared
      const rr = c.ref || ih;
      if (rr) {
        const y = GROUND - rr * k;
        c2.strokeStyle = 'rgba(255,204,102,.55)'; c2.setLineDash([5, 4]); c2.lineWidth = 1;
        c2.beginPath(); c2.moveTo(0, y + .5); c2.lineTo(CW, y + .5); c2.stroke();
        c2.setLineDash([]);
      }
      c2.strokeStyle = '#4a3d6b'; c2.lineWidth = 2;
      c2.beginPath(); c2.moveTo(0, GROUND + 1); c2.lineTo(CW, GROUND + 1); c2.stroke();
      // the form's idle, pinned to the same foot line: the animation should
      // cover it. Anything sticking out is the size difference, to scale.
      // the reference is drawn with the IDLE'S own offset, so matching the
      // outline means matching footing as well as height
      const refDy = B.dyPx(B.formKeyOf(a.key), 'idle');
      const refDx = B.dxPx(B.formKeyOf(a.key), 'idle');
      if (showIdle && c.sil && c.sil.cv && rr)
        blit(c2, c.sil.cv, c.sil.set, c.sil.idx, rr, k, 0.30, refDy, refDx);
      const ms = B.STATE_MS[a.state] || 100;
      const i = playing ? frameIndex(set.count, ms, t) : 0;
      const yo = B.dyPx(a.key, a.state), xo = B.dxPx(a.key, a.state);
      if (showWas) blit(c2, c.imgs[i], set, i, B.frameH(a.key, a.state, i, false), k, 0.25, 0, 0);
      blit(c2, c.imgs[i], set, i, B.frameH(a.key, a.state, i, true), k, 1, yo, xo);
      // the idle's outline goes ON TOP: when the animation is the bigger of
      // the two it spills past this ring, which the fill behind cannot show
      if (showIdle && c.sil && c.sil.ring && rr)
        blit(c2, c.sil.ring, c.sil.set, c.sil.idx, rr, k, 1, refDy, refDx);
      // the resize grip, pinned to the top of the drawn figure: drag the BODY
      // to move, drag this to scale. Stored so the hit test agrees with it.
      const topY = GROUND + yo * k - B.frameH(a.key, a.state, i, true) * k;
      const cxo = xo * k;
      c.handle = { x0: CW / 2 + cxo - HANDLE_W / 2, x1: CW / 2 + cxo + HANDLE_W / 2,
                   y0: topY - HANDLE_H / 2, y1: topY + HANDLE_H / 2 };
      const hot = c.hover === 'handle';
      c2.fillStyle = hot ? 'rgba(192,140,255,.95)' : 'rgba(192,140,255,.42)';
      c2.beginPath();
      const rr2 = 4, hx = c.handle.x0, hy = c.handle.y0;   // rides the sprite on both axes
      c2.roundRect ? c2.roundRect(hx, hy, HANDLE_W, HANDLE_H, rr2)
                   : c2.rect(hx, hy, HANDLE_W, HANDLE_H);
      c2.fill();
      c2.strokeStyle = hot ? '#fff' : 'rgba(255,255,255,.55)'; c2.lineWidth = 1;
      for (const gy of [topY - 2, topY + 2]) {
        c2.beginPath(); c2.moveTo(CW / 2 + cxo - 9, gy + .5);
        c2.lineTo(CW / 2 + cxo + 9, gy + .5); c2.stroke();
      }
    }
  }
  (function loop() { paint(); requestAnimationFrame(loop); })();

  B.buildCards = buildCards;
  B.refresh = refresh;
  B.paint = paint;
})();

/* ---- boss list, export, wiring ------------------------------------------- */
(function () {
  const B = window.__BR, cur = B.cur, $ = B.$, el = B.el;

  function buildList(filter) {
    const host = $('ents'); host.innerHTML = '';
    const q = (filter || '').toLowerCase();
    const names = Object.keys(B.BOSSES).filter(t => !q || t.toLowerCase().includes(q))
      .sort((a, b) => B.spread(b) - B.spread(a));
    for (const boss of names) {
      const row = el('div', 'ent' + (boss === cur.boss ? ' sel' : ''));
      const left = el('div');
      left.appendChild(el('div', 'n', boss));
      left.appendChild(el('div', 'g', B.BOSSES[boss].length + ' animations · '
        + Math.round(B.idleH(boss)) + ' px'));
      const d = B.spread(boss);
      const pill = el('span', 'pill ' + (d < 4 ? 'p-ok' : d < 12 ? 'p-warn' : 'p-bad'), d.toFixed(0) + '%');
      pill.title = 'the animation furthest from its own form’s idle height';
      row.appendChild(left); row.appendChild(pill);
      row.onclick = () => select(boss);
      host.appendChild(row);
    }
    if (!names.length) host.appendChild(el('div', 'empty', 'no boss matches that'));
  }

  function select(boss) {
    cur.boss = boss;
    cur.t0 = performance.now();
    $('who').textContent = boss;
    $('foot').style.display = '';
    B.buildCards();
    buildList($('q').value);
  }

  // apply_anim_patch.mjs is declarative per ENTITY (= one calib key), and this
  // boss may own several of them (gravitos2star and friends), so the export is
  // one blob per key that changed. Each blob carries every state of its key
  // plus that key's existing hitbox, because the applier replaces the whole
  // entity block and would otherwise drop an authored hitbox.
  function patchBlobs() {
    if (!cur.boss) return [];
    const keys = [...new Set(B.BOSSES[cur.boss].map(a => a.key))];
    const out = [];
    for (const key of keys) {
      const calib = {};
      const states = new Set([...Object.keys(B.BAKED[key] || {}), ...Object.keys(B.edits[key] || {})]);
      for (const st of states) {
        const c = B.calibOf(key, st);
        const e = { s: +(+c.s).toFixed(4), dx: +(+c.dx).toFixed(4), dy: +(+c.dy).toFixed(4) };
        if (c.fs && c.fs.some(v => Math.abs(v - 1) > 1e-6)) e.fs = c.fs.map(v => +(+v).toFixed(4));
        if (e.s !== 1 || e.dx !== 0 || e.dy !== 0 || e.fs) calib[st] = e;
      }
      const baked = JSON.stringify(B.BAKED[key] || {});
      const nowJs = JSON.stringify(calib);
      if (!Object.keys(calib).length && !B.BAKED[key]) continue;   // nothing to say
      const blob = { LX_ANIM_PATCH: 1, type: key, calib };
      if (B.HITBOX[key]) blob.hitbox = B.HITBOX[key];
      out.push({ key, changed: baked !== nowJs, blob });
    }
    return out;
  }
  B.patchJSON = function () {
    const blobs = patchBlobs().filter(b => b.changed);
    if (!blobs.length) return '';
    return blobs.map(b => JSON.stringify(b.blob)).join('\n');
  };
  B.copyPatch = function () {
    const s = B.patchJSON();
    if (!s) { B.toast('nothing changed yet'); return; }
    (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject())
      .then(() => B.toast('copied ' + s.split('\n').length + ' patch line(s) - paste in chat'))
      .catch(() => B.toast('copy blocked - select the text in the box below'));
  };

  B.mode = 'move';   // positioning is the default gesture; the grip resizes
  $('mode').onclick = (e) => {
    const b = e.target.closest('button[data-m]');
    if (!b) return;
    B.mode = b.dataset.m;
    for (const x of $('mode').querySelectorAll('button')) x.classList.toggle('on', x === b);
    for (const c of cur.cards) c.cv.style.cursor = B.mode === 'move' ? 'grab' : 'ns-resize';
  };
  $('q').oninput = () => buildList($('q').value);
  $('play').onchange = () => { cur.t0 = performance.now(); };
  $('before').onchange = () => {};
  $('copy').onclick = () => B.copyPatch();
  $('revert').onclick = () => {
    if (!cur.boss) return;
    for (const a of B.BOSSES[cur.boss]) delete B.edits[a.key];
    B.toast('reverted ' + cur.boss);
    B.refresh();
  };
  $('matchall').onclick = () => {
    if (!cur.boss) return;
    let n = 0;
    for (const a of B.BOSSES[cur.boss]) {
      if (B.isRef(a.key, a.state)) continue;          // never move a yardstick
      const r = B.refH(a.key);
      if (!r || Math.abs(B.animH(a.key, a.state, true) / r - 1) < 0.005) continue;
      B.setAnimH(a.key, a.state, r); n++;
    }
    B.toast(n ? n + ' animations matched to their form idle' : 'already level');
    B.refresh();
  };
  $('footnote').textContent = 'Paste in chat to have it hardbaked (scripts/apply_anim_patch.mjs). '
    + 'One line per calib key that changed; each carries all of that key’s states and its existing '
    + 'attack hitbox. Per-frame scales are never authored here, only carried through.';

  B.buildList = buildList;
  B.select = select;
  buildList('');
})();
