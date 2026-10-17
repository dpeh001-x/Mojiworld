// Boss fights: less main-thread work per frame, with every frame drawn exactly as before (boss lag CPU, 2026-10-17).
// ============================================================================
// Per user: "work on reducing the lags especially on boss fights while preserving the quality of the sprites and images".
// Five small costs the HUD and the combat loop paid in every boss fight, each removed without changing a pixel:
//   1. THE TOAST STACK'S LAYOUT CHECK ran from a 400 ms timer and after each new toast, BETWEEN frames. It reads panel rects
//      and computed styles, so the page laid itself out a second time - and the HUD's CSS transitions (combo timer, buff
//      timers, the toasts' own slide) had moved on since the frame, so every read re-styled them too. Measured in Gravitos /
//      Tower Sovereign fights (v0.30.1842): ~3.3 checks a second, ~100 layout-forcing reads a second between frames, up to
//      14 ms in a frame with a big change pending (PF profile). Now the timer and a new toast only ASK, and the check runs at the end of the game's own
//      frame, after the HUD pass has written: the layout it reads is the one that frame needs anyway. With no frames
//      running (title screen, hidden tab, a stopped loop) it runs straight away, as before.
//   2. A DROPPING HP / MP BAR SNAPS (v0.29.x: damage shows at once, gains ease) by switching its transition off, flushing
//      the page's layout with a read, and switching it back. That forced layout ran mid-frame on every cast (MP) and every
//      hit taken (HP). Now the transition stays off until the bar's next write (bars transition only their width, and only a
//      write changes it); that write turns it back on, and pays the old flush first only if no frame has run since the
//      drop. Every case ends exactly as before (including the old one-snap-per-frame rule: a second bar dropping in the
//      same frame still eases).
//   3. PLAYER-SHOT TRAILS built a particle object for every shot every second frame, then asked the per-frame particle
//      budget, which a heavy volley fills in a boss fight (_perfLowFx: 60 a frame). Now they ask first; a refused one is
//      never built (its four random draws still run, so the random sequence is unchanged).
//   4. THE PROJECTILE CAPS made a new array every frame a volley ran over a cap (boss arenas reach 80-150 enemy shots
//      against 90/40); they compact the list in place now. The kill-cause stamp that compared the list's identity is told,
//      so it re-scans from the start exactly as it did after a new array.
//   5. THE STATUS ICONS OVER THE HERO built an array, an object per icon and a cache-key string per icon every frame the
//      i-frame sparkle (or any status) showed - most frames of a boss fight. One reused list of fixed entries now; the
//      cache keys are the same strings, so the same baked icons are drawn.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxToastDodgeAsk(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { a = a.split('\n').join(EOL); const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// 1) the toast stack's layout check: asked of the next frame, run at the end of _lxFrame
{
  const A = "function _lxToastDodgeSoon() { if (!_lxToastDodgeQ) _lxToastDodgeQ = setTimeout(";
  once(A, J(
    "// v0.30.x BOSS-LAG-CPU - THE CHECK RUNS INSIDE THE FRAME. _lxToastDodge reads panel rects and computed styles; from a timer,",
    "// between frames, that made the page lay itself out a second time, and the HUD's running CSS transitions (combo timer, buff",
    "// timers, the toasts' slide) had moved on since the frame, so every read re-styled them as well - 3.5 times a second in a",
    "// boss fight, up to 14 ms in a frame with a big change pending. The 400 ms watch and a new toast now only ASK; the check runs",
    "// at the end of the game's own frame (_lxFrame), after the HUD pass has written, where the layout it reads is the one the",
    "// frame needs anyway. A toast raised mid-frame is placed before that frame is painted (it enters at opacity 0 either way).",
    "// With no frames running (title, hidden tab, a stopped loop) the caller runs it straight away, as before.",
    "let _lxToastDodgeDue = false, _lxToastDodgeFrameAt = -1e9;   // v0.30.x BOSS-LAG-CPU",
    "function _lxToastDodgeAsk() {   // v0.30.x BOSS-LAG-CPU - true: the next frame runs the check; false: no frames are running",
    "  if (performance.now() - _lxToastDodgeFrameAt > 1000) return false;   // v0.30.x BOSS-LAG-CPU - no frame for a second: none are running",
    "  _lxToastDodgeDue = true; return true;",
    "}",
    "function _lxToastDodgeFrame() {   // v0.30.x BOSS-LAG-CPU - called at the end of every _lxFrame",
    "  _lxToastDodgeFrameAt = performance.now();",
    "  if (!_lxToastDodgeDue) return;",
    "  _lxToastDodgeDue = false;",
    "  try { _lxToastDodge(); } catch (e) {}",
    "}",
    "function _lxToastDodgeSoon() { if (_lxToastDodgeAsk()) return;   /* v0.30.x BOSS-LAG-CPU - in the frame when frames run */ if (!_lxToastDodgeQ) _lxToastDodgeQ = setTimeout("), 'dodge soon');
  once("  _lxToastDodge(); } catch (e) {} }, 400);",
    "  if (!_lxToastDodgeAsk()) _lxToastDodge(); } catch (e) {} }, 400);   // v0.30.x BOSS-LAG-CPU - asked of the next frame (see _lxToastDodgeAsk)", 'dodge watch');
  const B = "    window._lxCtxDirty = true;   // bughunt engine-8\n  }\n  _lxNextFrame();\n}\n// bughunt engine-8 - a throw between";
  once(B, J("    window._lxCtxDirty = true;   // bughunt engine-8", "  }",
    "  _lxInFrame = false;   // v0.30.x BOSS-LAG-CPU - see _lxBarOwed",
    "  try { _lxToastDodgeFrame(); } catch (e) {}   // v0.30.x BOSS-LAG-CPU - the toast stack's layout check, after the frame's own writes",
    "  _lxNextFrame();", "}", "// bughunt engine-8 - a throw between"), 'frame end');
}

// 2) a dropping HP / MP / EXP bar snaps without a forced layout: the transition stays off until the bar's next write
{
  const A = "  const _barWrite = (el, oldPct, newPct) => {\n    if (!el) return;\n    if (newPct < oldPct - 0.05) {";
  once(A, J("  const _barWrite = (el, oldPct, newPct) => {", "    if (!el) return;",
    "    _lxBarOwed(el);   // v0.30.x BOSS-LAG-CPU - the last snap's transition goes back on first (with the old flush only if no frame has drawn it)",
    "    if (newPct < oldPct - 0.05) {"), 'bar write head');
  const B = "      if (game._lxBarFlushAt !== (game.time | 0)) { game._lxBarFlushAt = (game.time | 0); void el.offsetWidth; }\n      el.style.transition = '';\n    } else {";
  once(B, J("      if (game._lxBarFlushAt !== (game.time | 0)) { game._lxBarFlushAt = (game.time | 0); el._lxSnapOwed = _lxInFrame ? _lxFrameSeq : (_lxFrameSeq | 0) + 1; }   // v0.30.x BOSS-LAG-CPU - no forced layout: see _lxBarOwed",
    "      else el.style.transition = '';   // v0.30.x BOSS-LAG-CPU - a second drop in the same frame eases, as it did after the one flush",
    "    } else {"), 'bar write snap');
  const C = "function updateUI() {";
  once(C, J(
    "// v0.30.x BOSS-LAG-CPU - THE BAR SNAP WITHOUT A FORCED LAYOUT. A dropping bar switches its width transition off, takes the",
    "// new width and switches it back; the old code flushed the page's layout in between (void el.offsetWidth) so the style",
    "// system saw the switch - mid-frame, on every cast (MP) and every hit taken (HP). Now the transition stays off until the",
    "// bar's NEXT write (bars transition nothing but width, and only a write changes it): a frame drawn since the drop has",
    "// already styled it with no transition, which is the snap, so the transition just goes back on; if no frame has been drawn",
    "// since (a second HUD pass in the same frame, an event before the next frame) the old flush runs first. Every sequence ends",
    "// exactly where it did before. _lxSnapOwed holds the first frame (_lxFrameSeq) whose drawing styles the drop.",
    "var _lxFrameSeq = 0, _lxInFrame = false;   // v0.30.x BOSS-LAG-CPU - counted by _lxFrame; true while it runs (var: safe before this line runs)",
    "function _lxBarOwed(el) {   // v0.30.x BOSS-LAG-CPU",
    "  const s = el._lxSnapOwed; if (!s) return;",
    "  el._lxSnapOwed = 0;",
    "  if (!(_lxFrameSeq > s)) void el.offsetWidth;   // not drawn yet: the old flush",
    "  el.style.transition = '';",
    "}",
    C), 'bar helpers');
  const D = "function _lxFrame(time) {\n  _LX_RAF_PENDING = false;\n";
  once(D, J("function _lxFrame(time) {", "  _LX_RAF_PENDING = false;", "  _lxFrameSeq++; _lxInFrame = true;   // v0.30.x BOSS-LAG-CPU - see _lxBarOwed", ''), 'frame seq');
}

// 3) player-shot trails ask the particle budget before they build a particle
{
  // the push's own cap lines first (the helper below repeats them, so it goes in after)
  once("  let cap = _IS_MOBILE_AT_LOAD || _perfLowFx()\n    ? _FRAME_PARTICLE_BUDGET_MOBILE : _FRAME_PARTICLE_BUDGET_DESKTOP;\n",
    J("  const cap = _lxParticleCap();   // v0.30.x BOSS-LAG-CPU - the cap (the rule below), see _lxParticleCap", ''), 'push cap');
  once("  if ((typeof _perfBossCount === 'function' && _perfBossCount() >= 2)\n      || (typeof _perfVeryLowFx === 'function' && _perfVeryLowFx())) cap = Math.min(cap, 40);\n  if (_frameParticleCount >= cap) return false;",
    J("  if (_frameParticleCount >= cap) return false;"), 'push cap 2');
  const A = "function _budgetedParticlePush(p) {";
  once(A, J(
    "// v0.30.x BOSS-LAG-CPU - the frame's particle cap on its own (it was inline in _budgetedParticlePush, which still uses it),",
    "// so a hot caller can ask before it builds a particle the budget would throw away - the player-shot trail in",
    "// updateProjectiles built one per shot every second frame, and a heavy volley in a boss fight fills the budget.",
    "function _lxParticleCap() {   // v0.30.x BOSS-LAG-CPU - same calls in the same order as before (they fill the per-frame caches)",
    "  let cap = _IS_MOBILE_AT_LOAD || _perfLowFx() ? _FRAME_PARTICLE_BUDGET_MOBILE : _FRAME_PARTICLE_BUDGET_DESKTOP;",
    "  if ((typeof _perfBossCount === 'function' && _perfBossCount() >= 2)",
    "      || (typeof _perfVeryLowFx === 'function' && _perfVeryLowFx())) cap = Math.min(cap, 40);",
    "  return cap;",
    "}",
    "function _lxParticleRoom() { return !_lxRenderOnly && _frameParticleCount < _lxParticleCap(); }   // v0.30.x BOSS-LAG-CPU - true: a push would be taken",
    A), 'particle cap helpers');
  const T = "    if ((p.owner === 'player' || p.owner === 'peer') && ((p._trailFrame = (p._trailFrame|0) + 1) & 1)) {\n      const _tp = {";
  once(T, J("    if ((p.owner === 'player' || p.owner === 'peer') && ((p._trailFrame = (p._trailFrame|0) + 1) & 1)) {",
    "      // v0.30.x BOSS-LAG-CPU - budget full: the particle would be thrown away, so it is not built; its four random draws",
    "      // still run so the random sequence (and every particle after it) is exactly what it was.",
    "      if (typeof _lxParticleRoom === 'function' && !_lxParticleRoom()) { Math.random(); Math.random(); Math.random(); Math.random(); } else {   // v0.30.x BOSS-LAG-CPU",
    "      const _tp = {"), 'trail ask');
  once("      if (typeof _budgetedParticlePush === 'function') _budgetedParticlePush(_tp);\n      else game.particles.push(_tp);\n    }",
    J("      if (typeof _budgetedParticlePush === 'function') _budgetedParticlePush(_tp);", "      else game.particles.push(_tp);",
      "      }   // v0.30.x BOSS-LAG-CPU - end of the budget test", "    }"), 'trail end');
}

// 4) the projectile caps compact the list in place (the kill-cause stamp re-scans from 0, as after a new array)
for (const who of ['player', 'enemy', 'peer']) {
  const A = "      const keep = [];\n      for (const p of game.projectiles) {\n        if (p.owner === '" + who + "' && toDrop > 0) { toDrop--; continue; }\n        keep.push(p);\n      }\n      game.projectiles = keep;";
  once(A, J("      // v0.30.x BOSS-LAG-CPU - compacted in place: a volley over the cap made a new array every frame. Same survivors, same",
    "      // order. _lxKillStampSince compared the list's identity to know where the new shots start; a new array sent it back",
    "      // to the start, and clearing its mark does the same.",
    "      const _a = game.projectiles; let _w = 0;   // v0.30.x BOSS-LAG-CPU",
    "      for (let _r = 0; _r < _a.length; _r++) { const p = _a[_r]; if (p.owner === '" + who + "' && toDrop > 0) { toDrop--; continue; } _a[_w++] = p; }",
    "      _a.length = _w; _lxKillArrP = null;   // v0.30.x BOSS-LAG-CPU"), 'cap ' + who);
}

// 5) the status icons over the hero: one reused list of fixed entries, cache keys kept on the entries
{
  const PSI = [['burn', '#ff8844'], ['frozen', '#88ddff'], ['chill', '#aaeeff'], ['poison', '#aa66ee'], ['slow', '#88aacc'], ['ice', '#aaddff'],
    ['shock', '#ffdd44'], ['shield', '#ffe9a0'], ['stun', '#ffd166'], ['bubble', '#66ccff'], ['silence', '#ff99cc']];
  const ST = [['stagger', '#ffdd44', 'staggerPit'], ['stagger', '#ffd166', 'staggerHeavy']];
  once("  const icons = [];\n  if ((player.burnTimer    | 0) > 0)", J("  const icons = _LX_PSI_BUF; icons.length = 0;   // v0.30.x BOSS-LAG-CPU - reused, entries fixed (see _LX_PSI)",
    "  if ((player.burnTimer    | 0) > 0)"), 'icons list');
  for (const [k, t] of PSI) once("icons.push({ kind:'" + k + "', tint:'" + t + "' })", "icons.push(_LX_PSI." + k + ")", 'icon ' + k);
  for (const [k, t, n] of ST) once("icons.push({ kind:'" + k + "', tint:'" + t + "' })", "icons.push(_LX_PSI." + n + ")", 'icon ' + n);
  once("    const _ibKey = _kind + '|' + icons[i].tint + '|' + _ibDpr;",
    "    const _ibKey = _lxPsiKey(icons[i], _kind, _ibDpr);   // v0.30.x BOSS-LAG-CPU - the same string, made once per entry", 'icon key');
  const ent = (k, t, n) => "  " + (n || k) + ": { kind: '" + k + "', tint: '" + t + "' },";
  once("function _drawPlayerStatusIcons(sx, sy) {", J(
    "// v0.30.x BOSS-LAG-CPU - the status row's entries, fixed: the row built an array, an object per icon and a key string per",
    "// icon every frame one showed (the i-frame sparkle shows most frames of a boss fight). Same kinds, same tints, same order.",
    "const _LX_PSI = {   // v0.30.x BOSS-LAG-CPU",
    ...PSI.map(([k, t]) => ent(k, t)), ...ST.map(([k, t, n]) => ent(k, t, n)),
    "};",
    "const _LX_PSI_BUF = [];   // v0.30.x BOSS-LAG-CPU - refilled each call; nothing keeps it past the call",
    "function _lxPsiKey(e, kind, dpr) {   // v0.30.x BOSS-LAG-CPU - kind|tint|dpr, the bake cache's key, kept on the entry",
    "  if (e._kd !== dpr || e._kk !== kind) { e._kd = dpr; e._kk = kind; e._k = kind + '|' + e.tint + '|' + dpr; }",
    "  return e._k;",
    "}",
    "function _drawPlayerStatusIcons(sx, sy) {"), 'icon table');
}

const grew = s.length - n0;
if (grew < 6500 || grew > 8200) die('size moved ' + grew);
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
console.log('applied: boss-lag-cpu (+' + grew + ' chars)');
