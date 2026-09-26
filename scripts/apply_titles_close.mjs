// The Titles panel closes with every other panel (bug hunt, 2026-09-26).
// ============================================================================
// openTitlesPanel builds #titles-modal and takes it down with its own close() (which also drops its capture-phase
// Escape listener and re-derives game.paused). closeAllModals() - what every hotkey and panel opener calls first -
// did not know about it: it hides a fixed list of ids with display:none, and removes the edicts panel by name, but
// never Titles. So with Titles open, pressing U or J opened the Level Up panel / the Journal UNDERNEATH it (Titles
// sits at z-index 1200): nothing visibly happened until Esc took Titles down. And had closeAllModals simply removed
// the element, the orphaned Escape listener would have gone on swallowing Esc for every panel after it.
// Fix: the panel hands closeAllModals its own close() (ov._lxClose), and closeAllModals calls it - listener and
// all - right beside the edicts teardown. Reopening Titles (which calls closeAllModals first) now also retires the
// old listener instead of stacking a second one.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) titles-close/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// 1) the Titles panel exposes its own close()
const CLOSE = J(
  "  const close = () => {",
  "    document.removeEventListener('keydown', onKey, true);",
  "    try { ov.remove(); } catch (e) {}",
  "    if (typeof game !== 'undefined' && game) game.paused = (typeof _anyOtherModalOpen === 'function') ? !!_anyOtherModalOpen() : false;",
  "    try { if (typeof saveState === 'function') saveState(); } catch (e) {}",
  "  };",
  "  const row = (val, name, how, on, locked) =>");
once(CLOSE, CLOSE.replace("  };" + EOL + "  const row =", "  };" + EOL +
  "  ov._lxClose = close;   // v0.30.1130 titles-close - closeAllModals() takes Titles down through this (listener and all)" + EOL +
  "  const row ="), 'the Titles close()');

// 2) closeAllModals() calls it, beside the edicts teardown
const ED = "  { const _ed = document.getElementById('edicts-modal'); if (_ed) { try { _ed.remove(); } catch (e) {} } }";
once(ED, ED + EOL +
  "  { const _ti = document.getElementById('titles-modal'); if (_ti) { try { if (typeof _ti._lxClose === 'function') _ti._lxClose(); else _ti.remove(); } catch (e) {} } }   // v0.30.1130 titles-close - Titles is removed, not hidden, so it needs the same explicit teardown (else U / J opened under it)",
  'the closeAllModals edicts line');

const grew = s.length - n0;
if (grew < 300 || grew > 1200) die('size moved ' + grew);
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
console.log('applied: titles-close (+' + grew + ' chars)');
