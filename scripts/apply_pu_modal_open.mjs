// The boss boon wheel (power-up choice) opens without a hitch, looking exactly as before (pu-modal-open, 2026-10-18).
// ============================================================================
// Per user: "reducing the lags especially on boss fights while preserving the quality of the sprites and images".
// Opening the wheel after a boss kill was the worst single frame left in a boss fight (~80 ms on a quiet desktop at
// DPR 2, ~150 ms in a real Tower Arbiter fight). A Chrome trace put ~60 ms of it in TEXT SHAPING, in 13 near-equal
// slices: the boss-name title's fit loop.
//   THE FIT LOOP shrinks the title 2 px at a time while it is wider than its box (48 px down to a 24 px floor). Since
//   the v0.30.1160 pop-punk restyle the title sits on a skewed banner (::before, skewX(-12deg)) that always reaches ~5 px
//   past the title's box, so "wider than its box" is true at EVERY size and the loop always walks all the way to the
//   floor: 13 forced layouts, each at a font size the page had not drawn yet, so each one built new font data and
//   re-shaped the title from scratch (~3.5-4.5 ms apiece the first time; later opens were cheap, ~5 ms in all).
//   NOW it tries the floor first. Still too wide at the floor means it was too wide at every larger size, so the old
//   loop would have ended on that very floor: the title gets the same size string it always got, after ONE layout.
//   A title that fits at the floor (none today - the banner always overhangs) runs the old loop unchanged, from the top.
//   THE FIRST OPEN'S FONT SETUP (each text size the wheel uses and the fallback fonts its symbols and the boss's emoji
//   need, ~15-20 ms built on the spot) is paid ahead of time instead: the real modal is laid out with stand-in text in
//   five small idle-time passes and cleared again inside each one, so it is never painted. A few seconds after the world
//   loads (waiting for real idle slices), and again at each boss kill in the 1.5 s before its wheel opens (cheap when
//   nothing was evicted). Measured: the kill -> wheel task 66.5 -> 7.0 ms CPU in an Arbiter fight with hits landing.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('PU-MODAL-OPEN - THE FLOOR FIRST')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { a = a.split('\n').join(EOL); const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// 1) the title fit: the floor first, the old loop only when the title fits there
once(J(
  "      let _fs = parseFloat(getComputedStyle(_tt).fontSize) || 48;",
  "      while (_tt.scrollWidth > _tt.clientWidth + 1 && _fs > 24) { _fs -= 2; _tt.style.fontSize = _fs + 'px'; }"), J(
  "      let _fs = parseFloat(getComputedStyle(_tt).fontSize) || 48;",
  "      // v0.30.1845 PU-MODAL-OPEN - THE FLOOR FIRST. The pop-punk banner (skewed ::before) overhangs the title by ~5 px at every size,",
  "      // so the loop below always walked 2 px at a time to its floor: 13 forced layouts, each at a size never drawn before (~60 ms",
  "      // of text shaping on the wheel's first open). Too wide at the floor = too wide at every larger size, so the loop would end",
  "      // on that floor: same size string, one layout. A title that fits at the floor runs the old loop, unchanged, from the top.",
  "      let _fl = _fs; while (_fl > 24) _fl -= 2;   // v0.30.1845 PU-MODAL-OPEN - the loop's own arithmetic, so the same px string",
  "      if (_fl !== _fs) { _tt.style.fontSize = _fl + 'px'; if (_tt.scrollWidth > _tt.clientWidth + 1) _fs = _fl; else _tt.style.fontSize = ''; }",
  "      while (_tt.scrollWidth > _tt.clientWidth + 1 && _fs > 24) { _fs -= 2; _tt.style.fontSize = _fs + 'px'; }"), 'title fit loop');

// 2) the rehearsal's switch: the real modal, laid out but never shown (only ever on inside one task, so never painted)
{
  const A = "  @font-face { font-family: 'Nunito'; font-style: italic; font-weight: 200 1000; font-display: swap; src: url('assets/fonts/nunito-italic-latin.woff2') format('woff2'); }";
  once(A, J(A,
    "  /* v0.30.1845 PU-MODAL-OPEN - the boon wheel's font rehearsal (_lxPuWarmPass): the class goes on and off inside one task, so it is never painted */",
    "  #powerup-modal.lx-pu-warm { display: flex !important; visibility: hidden !important; pointer-events: none !important; }"), 'warm css');
}

// 3) the rehearsal: the wheel's own markup, laid out in three idle-time passes, then cleared
{
  const A = "// v0.30.x boon-drop-v2 — 1 / 2 / 3 claim the matching card (see the keycaps on each).";
  once(A, J(
    "// v0.30.1845 PU-MODAL-OPEN - THE WHEEL'S FONTS, SET UP AHEAD OF TIME. The first open of the wheel paid ~10-20 ms (far more on a",
    "// busy phone) building font data: each text size it uses and the fallback fonts its symbols and the boss's emoji need, built",
    "// the first time the page lays them out. A rehearsal pays that in idle time instead: the real modal (so every rule and media",
    "// query that styles the wheel applies) is laid out with stand-in text under .lx-pu-warm and cleared again inside the same task -",
    "// never painted, never seen by input, style.display untouched (every 'is it open' check reads that). Five passes, each its own",
    "// idle callback, so no frame carries all of it. Runs a few seconds after the world loads and again at each boss kill (the wheel",
    "// opens 1.5 s later), so evicted font data is rebuilt in time. A wheel already up is never touched; old content is put back.",
    "const _LX_PU_WARM = [   // v0.30.1845 PU-MODAL-OPEN - header, footer, title (fitted like the real one), boss icon, the three cards",
    "  '<button class=\"close-btn\">\\u2715</button><div class=\"pr-header\"><div class=\"pr-eyebrow\">Boon Manifested</div>'",
    "    + '<div class=\"pr-subtitle\">Three boons shimmer from the fallen \\u2014 claim one. Pick one boon to empower your adventure</div></div>',",
    "  '<div class=\"pr-footer\"><span class=\"pr-foot-orn\">\\u2756</span>Boon bag: <b>12/40</b><span class=\"pr-foot-orn\">\\u00b7</span>Equipped: <b>3/5</b>'",
    "    + '<span class=\"pr-first-slot\">(first slot at Lv 30)</span><span class=\"pr-foot-orn pr-foot-keys\">\\u00b7</span>'",
    "    + '<span class=\"pr-foot-keys\">Press <b>1</b><b>2</b><b>3</b> to claim</span><span class=\"pr-foot-orn\">\\u2756</span></div>',",
    "  '<div class=\"pr-header\"><div class=\"pr-title\"><span class=\"pr-fleuron\">\\u2766</span>From The Arbiter<span class=\"pr-fleuron\">\\u2766</span></div></div>',",
    "  '<div class=\"pr-header\"><div class=\"pr-title\"><span class=\"pr-boss-icon\">\\ud83d\\udc51</span></div></div>',",
    "  '<div class=\"powerup-options\">' + [[1, 'lucky', '\\u2726 Lucky Roll \\u2726'], [2, 'typical', 'Typical Roll'], [3, 'faint', 'Faint Roll']].map(([k, t, l]) =>",
    "    '<div class=\"powerup-card tier-' + t + (t === 'lucky' ? ' is-lucky' : '') + '\"><span class=\"pc-key\">' + k + '</span>'",
    "    + '<div class=\"pc-icon-pedestal\"><div class=\"pc-icon\"></div></div><div class=\"pc-name\">Iron Skin of Doppel</div>'",
    "    + '<div class=\"pc-desc\">+12% ATK \\u2014 heal 1.4% of damage dealt, x2 (floatier jumps & fall)</div>'",
    "    + '<div class=\"pc-roll\"><div class=\"pc-roll-bar\"><div class=\"pc-roll-fill\" style=\"width:50%\"><i class=\"pc-roll-marker\"></i></div></div>'",
    "    + '<div class=\"pc-roll-meta\"><span>-10%</span><span class=\"pc-roll-val\">+12.5%</span><span>+15%</span></div></div>'",
    "    + '<div class=\"pc-tier ' + t + '\">' + l + '</div></div>').join('') + '</div>',",
    "];",
    "function _lxPuWarmPass(k) {   // v0.30.1845 PU-MODAL-OPEN - one rehearsal pass, start to finish inside this call",
    "  try {",
    "    const modal = document.getElementById('powerup-modal');",
    "    const body = modal && modal.querySelector('.modal.powerup-reveal');",
    "    if (!body || modal.style.display === 'flex' || modal.classList.contains('lx-pu-warm') || !_LX_PU_WARM[k]) return;",
    "    const keep = document.createDocumentFragment();",
    "    while (body.firstChild) keep.appendChild(body.firstChild);",
    "    modal.classList.add('lx-pu-warm');",
    "    try {",
    "      body.innerHTML = _LX_PU_WARM[k];",
    "      const tt = body.querySelector('.pr-title');   // the size the real fit lands on (its floor), and the boss icon at 0.8 of it",
    "      if (tt) { let f = parseFloat(getComputedStyle(tt).fontSize) || 48; while (f > 24) f -= 2; tt.style.fontSize = f + 'px'; }",
    "      void body.offsetWidth;   // the layout that builds the font data",
    "    } finally {",
    "      modal.classList.remove('lx-pu-warm');",
    "      body.textContent = '';",
    "      body.appendChild(keep);",
    "    }",
    "  } catch (e) {}",
    "}",
    "let _lxPuWarmBusy = false, _lxPuWarmWait = 200;",
    "function _lxPuWarmSoon(wait) {   // v0.30.1845 PU-MODAL-OPEN - queue the passes on idle time; each waits at most `wait` ms (200 by default: 5 passes < 1.5 s)",
    "  _lxPuWarmWait = _lxPuWarmBusy ? Math.min(_lxPuWarmWait, wait || 200) : (wait || 200);   // a kill mid-way hurries a slow boot warm",
    "  if (_lxPuWarmBusy) return;",
    "  _lxPuWarmBusy = true;",
    "  let k = 0, t0 = 0;",
    "  const ask = () => { if (typeof requestIdleCallback === 'function') requestIdleCallback(step, { timeout: _lxPuWarmWait }); else setTimeout(step, 60); };",
    "  const next = () => { t0 = performance.now(); ask(); };",
    "  const step = (dl) => {",
    "    if (k >= _LX_PU_WARM.length) { _lxPuWarmBusy = false; return; }",
    "    if (dl && !dl.didTimeout && dl.timeRemaining() < 6 && performance.now() - t0 < _lxPuWarmWait) { ask(); return; }   // too thin an idle slice: wait for a better one",
    "    _lxPuWarmPass(k++); next();",
    "  };",
    "  try { if (document.fonts && document.fonts.status !== 'loaded') { document.fonts.ready.then(next, next); return; } } catch (e) {}",
    "  next();",
    "}",
    "(function _lxPuWarmBoot(n) {   // v0.30.1845 PU-MODAL-OPEN - once the hero is in the world (checked every 4 s, up to ~3 min)",
    "  setTimeout(() => { try { if (n < 45 && typeof _lxHeroInWorld === 'function' && !_lxHeroInWorld()) { _lxPuWarmBoot(n + 1); return; } _lxPuWarmSoon(3000); } catch (e) {} }, 4000);",
    "})(0);",
    A), 'warm block');
}

// 4) every boss kill re-warms (cheap when nothing was evicted) in the 1.5 s before its wheel opens
once(J(
  "    setTimeout(() => {",
  "      if (_bossInfo._oid && game._lxBoonOwed"), J(
  "    try { if (typeof _lxPuWarmSoon === 'function') _lxPuWarmSoon(); } catch (e) {}   // v0.30.1845 PU-MODAL-OPEN - fonts ready before the wheel",
  "    setTimeout(() => {",
  "      if (_bossInfo._oid && game._lxBoonOwed"), 'boss kill warm');

const grew = s.length - n0;
if (grew < 5500 || grew > 8000) die('size moved ' + grew);
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
console.log('applied: pu-modal-open (+' + grew + ' chars)');
