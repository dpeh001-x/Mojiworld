// Style recalc in a crowded fight (perf audit #5, 2026-09-27): about a third fewer style recalculations per frame.
// ============================================================================
// A trace of a 60-mob fight with hits landing showed that most style recalcs were FORCED in the middle of the frame's
// script. The whole-document :has() cost behind them was taken out by v0.30.1217 / 1221 / 1229 (another session, same
// audit); what is left here is the biggest forcer of our own, fixed with no visual change:
//   1) The combo counter's pop restarted with `remove('pop'); void el.offsetWidth; add('pop')`: a full style + layout
//      flush in the middle of every frame that landed a hit - about one recalc in three in a crowded fight. The first
//      replay of a session still does that once and copies the keyframes + timing of the CSS animation it starts (the
//      pop-punk comboPop, or whatever the stylesheet says next); later pops replay that copy through one reusable Web
//      Animation (cancel + play restarts it on the next frame with no flush). The .pop class still does the first pop and
//      the pop the break flash hands back to; under the break flash no pop plays, exactly as the .break rule used to win.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxComboPopReplay(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// 1) the combo pop, without the forced reflow
once('function bumpCombo(n = 1) {', J(
  '// v0.30.1232 recalc-perf - THE COMBO POP REPLAYS WITHOUT A FORCED REFLOW. It restarted with remove(\'pop\') + offsetWidth +',
  "// add('pop'): a whole-page style and layout flush in the middle of every frame that landed a hit. The first replay of a",
  '// session still does that, once, and copies the keyframes and timing of the CSS animation it starts (so whatever the',
  '// stylesheet says the pop looks like is what replays); every later pop replays that copy through one reusable Web',
  '// Animation - cancel + play restarts it on the next frame, like a fresh CSS animation, with no flush.',
  'let _lxComboPopFx;   // v0.30.1232 recalc-perf - undefined: not copied yet; null: no CSS pop to copy (the old restart is kept)',
  'function _lxComboPopReplay(el) {',
  "  const restart = () => { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); };",
  '  if (_lxComboPopFx === undefined) {',
  '    _lxComboPopFx = null; restart();',
  '    const nm = getComputedStyle(el).animationName, a = el.getAnimations().find((x) => x.animationName === nm);',
  '    if (nm && nm !== \'none\' && a && a.effect) {',
  '      const kf = a.effect.getKeyframes().map((k) => { const o = Object.assign({}, k); delete o.computedOffset; return o; });',
  '      _lxComboPopFx = { kf, t: a.effect.getTiming() };',
  '    }',
  '    return;',
  '  }',
  '  if (!_lxComboPopFx) { restart(); return; }',
  '  const pa = el._lxPopAnim;',
  '  if (pa) { pa.cancel(); pa.play(); } else el._lxPopAnim = el.animate(_lxComboPopFx.kf, _lxComboPopFx.t);',
  '}',
  'function bumpCombo(n = 1) {'), 'bumpCombo signature');
once(J('      el.style.opacity = 1;', "      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');"), J(
  "      if (el.style.opacity !== '1') el.style.opacity = 1;   // v0.30.1232 recalc-perf - written only when it changes",
  '      // v0.30.1232 recalc-perf - see _lxComboPopReplay. The class does the first pop (and the one the break flash hands back',
  '      // to); under the break flash nothing replays - the .break rule used to win the animation there.',
  "      if (!el.classList.contains('pop')) el.classList.add('pop');",
  "      else if (!el.classList.contains('break')) {",
  "        try { _lxComboPopReplay(el); } catch (e) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }",
  '      }'), 'bumpCombo pop restart');
once("        el.classList.add('break');", J(
  "        el.classList.add('break');",
  '        if (el._lxPopAnim) { try { el._lxPopAnim.cancel(); } catch (e) {} }   // v0.30.1232 recalc-perf - the break flash wins over a pop, as .break did'), 'resetCombo break');

const grew = s.length - n0;
if (grew < 1200 || grew > 3500) die('size moved ' + grew);
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
console.log('applied: recalc-perf (+' + grew + ' chars)');
