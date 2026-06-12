// v0.26.945 E: controls + viewport — dpad listener leak, mouse/pen capture,
// 380px CSS, forced-modal generalization, orientation key release,
// portrait scale floor, visualViewport dims, dpad/jump overlap, refit hooks.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { execSync } from 'node:child_process';
const FILE = 'C:/Users/Xenon/Desktop/Mojiworld/mojiworld_game.html';
let s = await readFile(FILE, 'utf8');
function rep(old, neu, label) {
  let o = old, n = neu, c = s.split(o).length - 1;
  if (c !== 1) { o = old.replace(/\n/g, '\r\n'); n = neu.replace(/\n/g, '\r\n'); c = s.split(o).length - 1; }
  if (c !== 1) { console.error(`FAIL ${label}: ${c}`); process.exit(2); }
  s = s.split(o).join(n); console.log('ok: ' + label);
}

// E1a — stamp recovery time inside onMove (own pointer only)…
rep(`  const onMove = (ev) => {
    if (ev.pointerId !== activePointerId) return;
    ev.preventDefault();
    setDir(resolve(ev));
  };`,
`  const onMove = (ev) => {
    if (ev.pointerId !== activePointerId) return;
    // v0.26.945 — recovery stamp moved here from the leaked _onMoveStamp
    // wrapper; now only the pad's own pointer refreshes it.
    window._mDpadLastMoveT = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    ev.preventDefault();
    setDir(resolve(ev));
  };`, 'E1a stamp in onMove');

// E1b — …and register onMove directly so removeEventListener matches.
rep(`    const _onMoveStamp = (e) => {
      window._mDpadLastMoveT = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      onMove(e);
    };
    window.addEventListener('pointermove', _onMoveStamp, { passive: false });`,
`    // v0.26.945 — register onMove itself (the old _onMoveStamp wrapper
    // leaked one window listener per press: onEnd removed onMove, a
    // different reference, and the global stamp defeated the 1.5s
    // stuck-pointer recovery while ANY finger was on screen).
    window.addEventListener('pointermove', onMove, { passive: false });`, 'E1b direct onMove');

// E2 — d-pad hard reset for blur/rotation; wired into the release path.
rep(`  pad.addEventListener('contextmenu', (e) => e.preventDefault());
}`,
`  pad.addEventListener('contextmenu', (e) => e.preventDefault());
  // v0.26.945 — closure-state reset for blur / backgrounding / rotation.
  // _releaseAllVirtualKeys clears game.keys but couldn't reach
  // activePointerId/activeDir in here; a blur mid-drag left the pad deaf.
  window._mDpadForceReset = () => {
    try {
      setDir(null);
      activePointerId = null;
      window.removeEventListener('pointermove', onMove, { passive: false });
      window.removeEventListener('pointerup', onEnd, { passive: false });
      window.removeEventListener('pointercancel', onEnd, { passive: false });
    } catch (e) {}
  };
}`, 'E2 dpad force reset');
rep(`        if (typeof window._mDpadActivePointer !== 'undefined') {
          window._mDpadActivePointer = null;
        }`,
`        if (typeof window._mDpadActivePointer !== 'undefined') {
          window._mDpadActivePointer = null;
        }
        if (window._mDpadForceReset) window._mDpadForceReset();   // v0.26.945`, 'E2b release hook');

// E3 — mouse/pen capture so slide-off + lift can't stick a key.
rep(`  const press = (ev) => {
    if (ev) ev.preventDefault();
    if (pendingReleaseId) { clearTimeout(pendingReleaseId); pendingReleaseId = 0; }
    if (!active) {`,
`  const press = (ev) => {
    if (ev) ev.preventDefault();
    // v0.26.945 — capture mouse/pen so pointerup retargets to this button
    // even after sliding off (touch has implicit capture; skipping touch
    // avoids the iOS capture-silences-other-elements bug noted in the
    // d-pad wiring).
    if (ev && ev.pointerType !== 'touch' && ev.pointerId !== undefined && btn.setPointerCapture) {
      try { btn.setPointerCapture(ev.pointerId); } catch (e) {}
    }
    if (pendingReleaseId) { clearTimeout(pendingReleaseId); pendingReleaseId = 0; }
    if (!active) {`, 'E3 pointer capture');

// E4 — stale 380px grid-era CSS → whole-cluster scale (arc-compatible).
rep(`    .mc-actions {
      grid-template-columns: 50px 50px 50px !important;
      grid-template-rows: 50px 50px 50px !important;
      width: 172px !important; height: 172px !important; gap: 11px !important;
    }
    .mc-jump, .mc-defense-row .mc-basic, .mc-skill-grid .mc-btn {
      width: 50px !important; height: 50px !important; font-size: 14px !important;
    }
    .mc-jump { font-size: 22px !important; }
    .mc-defense-row .mc-basic { width: 52px !important; height: 52px !important; font-size: 17px !important; }`,
`    /* v0.26.945 — grid-era sizing replaced: it broke the arc cluster on
       320px phones (F/jump landed on the d-pad). Shrink as one unit. */
    .mc-actions {
      transform: scale(0.62) !important;
      transform-origin: bottom right !important;
    }`, 'E4 380px CSS');
rep(`    .mobile-deck .mc-dpad { width: 150px !important; height: 150px !important; }`,
`    .mobile-deck .mc-dpad { width: 140px !important; height: 140px !important; }`, 'E4b dpad 140');

const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const big = scripts.sort((a, b) => b.length - a.length)[0];
await writeFile('C:/Users/Xenon/Desktop/Mojiworld/tools/_v945_check.js', big, 'utf8');
execSync('node --check "C:/Users/Xenon/Desktop/Mojiworld/tools/_v945_check.js"', { stdio: 'inherit' });
await writeFile(FILE + '.tmpe', s, 'utf8');
await rename(FILE + '.tmpe', FILE);
console.log('E DONE');
