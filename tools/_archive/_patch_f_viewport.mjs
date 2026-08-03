// v0.26.945 F: viewport — portrait scale floor, visualViewport dims,
// forced-modal generalization, portrait dpad raise, refit hooks,
// orientation key release, no-touch desktop deck auto-hide.
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

// F1 — orientation-aware floor: 0.5 clipped ~25% of width on portrait phones.
rep(`  const scale = isTouchOrNarrow ? Math.max(0.5, Math.min(base * 1.04, sx, sy))
                                : Math.max(0.5, Math.min(_userScale, sx, sy));`,
`  // v0.26.945 — portrait floor 0.34 (< 360/960) so real phones fit instead
  // of clipping 45-60px per side; landscape keeps the 0.5 split-view guard.
  // The * 1.04 was dead code (min() clamped it back to base) — removed.
  const scale = isTouchOrNarrow ? Math.max(isLandscape ? 0.5 : 0.34, Math.min(base, sx, sy))
                                : Math.max(0.5, Math.min(_userScale, sx, sy));`, 'F1 scale floor');

// F2 — measure the visual viewport (iOS URL-bar / keyboard transitions).
rep(`  const wrap = document.querySelector('.game-wrapper');
  if (!wrap) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;`,
`  const wrap = document.querySelector('.game-wrapper');
  if (!wrap) return;
  // v0.26.945 — prefer visualViewport dims (innerHeight lags it during iOS
  // URL-bar transitions / fullscreen exit, pushing the canvas under the
  // toolbar). scale===1 guard skips pinch-zoom states.
  const _vv = window.visualViewport;
  const vw = (_vv && _vv.scale === 1) ? Math.round(_vv.width)  : window.innerWidth;
  const vh = (_vv && _vv.scale === 1) ? Math.round(_vv.height) : window.innerHeight;`, 'F2 visualViewport');

// F3 — every trapped .modal-overlay hides the deck, not just 3 ids.
rep(`  const _syncForcedModal = () => {
    const anyOpen = _forcedModals.some(m => {
      const el = document.getElementById(m.id);
      return el && el.style.display === m.open;
    });
    document.body.classList.toggle('forced-modal', anyOpen);
  };`,
`  const _syncForcedModal = () => {
    let anyOpen = _forcedModals.some(m => {
      const el = document.getElementById(m.id);
      return el && el.style.display === m.open;
    });
    // v0.26.945 — generalized: EVERY .modal-overlay inside .game-wrapper is
    // trapped under the deck by the wrapper's transform stacking context
    // (shop/inventory/codex/quest/skills/help/...), not just the 3 listed
    // ids. Any open overlay hides the deck; the game pauses for all of them.
    if (!anyOpen) {
      try {
        anyOpen = Array.prototype.some.call(
          document.querySelectorAll('.modal-overlay'),
          (el) => el.style.display === 'flex'
        );
      } catch (e) {}
    }
    document.body.classList.toggle('forced-modal', anyOpen);
  };`, 'F3 forced-modal generalize');
rep(`  for (const m of _forcedModals) {
    const el = document.getElementById(m.id);
    if (el) {
      const obs = new MutationObserver(_syncForcedModal);
      obs.observe(el, { attributes: true, attributeFilter: ['style'] });
      window._forcedModalObservers.push(obs);
    }
  }`,
`  for (const m of _forcedModals) {
    const el = document.getElementById(m.id);
    if (el) {
      const obs = new MutationObserver(_syncForcedModal);
      obs.observe(el, { attributes: true, attributeFilter: ['style'] });
      window._forcedModalObservers.push(obs);
    }
  }
  // v0.26.945 — observe every modal overlay for the generalized check.
  try {
    document.querySelectorAll('.modal-overlay').forEach((el) => {
      const obs = new MutationObserver(_syncForcedModal);
      obs.observe(el, { attributes: true, attributeFilter: ['style'] });
      window._forcedModalObservers.push(obs);
    });
  } catch (e) {}`, 'F3b observers');

// F4 — portrait dpad raised clear of the jump arc (overlap at <=390px).
rep(`    .mobile-deck .mc-dpad {
      left: calc(10px + env(safe-area-inset-left));
      bottom: calc(40px + env(safe-area-inset-bottom));
      top: auto !important;
    }`,
`    .mobile-deck .mc-dpad {
      left: calc(10px + env(safe-area-inset-left));
      bottom: calc(80px + env(safe-area-inset-bottom));   /* v0.26.945 — clear of the jump arc */
      top: auto !important;
    }`, 'F4 dpad raise');

// F5 — refit on fullscreen transitions + release held keys on rotation.
rep(`window.addEventListener('orientationchange', _reFitSchedule);`,
`window.addEventListener('orientationchange', () => {
  // v0.26.945 — rotation repositions the deck mid-press; release everything
  // (pointercancel on rotate is browser-dependent).
  try { if (window._lxReleaseAllVKeys) window._lxReleaseAllVKeys(); } catch (e) {}
  _reFitSchedule();
});
// v0.26.945 — Safari occasionally drops the resize event when exiting
// fullscreen via swipe; listen to fullscreenchange directly.
document.addEventListener('fullscreenchange', _reFitSchedule);
document.addEventListener('webkitfullscreenchange', _reFitSchedule);`, 'F5 refit hooks');
rep(`    window.addEventListener('visibilitychange', () => {
      if (document.hidden) _releaseAllVirtualKeys();
    });`,
`    window.addEventListener('visibilitychange', () => {
      if (document.hidden) _releaseAllVirtualKeys();
    });
    window._lxReleaseAllVKeys = _releaseAllVirtualKeys;   // v0.26.945 — for the rotation hook`, 'F5b expose release');

// F6 — mouse-only desktop in a narrow window: deck auto-hides (pref wins).
rep(`  const toggle = document.getElementById('mobile-ctrl-toggle');
  // Apply persisted preference on boot (URL param wins).
  let _hidePref = false;
  try { _hidePref = localStorage.getItem(TOGGLE_KEY) === '1'; } catch (e) {}
  if (_urlForceHide || _hidePref) {`,
`  const toggle = document.getElementById('mobile-ctrl-toggle');
  // Apply persisted preference on boot (URL param wins).
  let _hidePref = false;
  try { _hidePref = localStorage.getItem(TOGGLE_KEY) === '1'; } catch (e) {}
  // v0.26.945 — a mouse-only desktop that merely shrank the window under
  // 900px shouldn't get touch buttons eating clicks. Only when the player
  // has never expressed a preference (no saved toggle), and the device
  // reports zero touch capability, default the deck to hidden.
  let _noTouch = false;
  try {
    _noTouch = localStorage.getItem(TOGGLE_KEY) === null
      && window.matchMedia && window.matchMedia('(pointer: fine)').matches
      && !('ontouchstart' in window)
      && (navigator.maxTouchPoints || 0) === 0;
  } catch (e) {}
  if (_urlForceHide || _hidePref || _noTouch) {`, 'F6 no-touch hide');

const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const big = scripts.sort((a, b) => b.length - a.length)[0];
await writeFile('C:/Users/Xenon/Desktop/Mojiworld/tools/_v945_check.js', big, 'utf8');
execSync('node --check "C:/Users/Xenon/Desktop/Mojiworld/tools/_v945_check.js"', { stdio: 'inherit' });
await writeFile(FILE + '.tmpf', s, 'utf8');
await rename(FILE + '.tmpf', FILE);
console.log('F DONE');
