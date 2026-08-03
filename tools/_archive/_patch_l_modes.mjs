// v0.26.949 L: desktop touch-mode button (clones coarse-pointer CSS at
// runtime — zero duplication), top-center sprite progress bar, SW register.
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

// L1 — button DOM, directly below the fullscreen toggle.
rep(`<button id="settings-btn" onclick="openSettingsModal()"`,
`<!-- v0.26.949 — Touch-controls toggle for desktop/fullscreen (per user):
     shows the mobile d-pad + button deck on any device. Sits below ⛶. -->
<button id="mobile-mode-btn" onclick="_lxToggleMobileMode()" title="Touch controls — on-screen D-pad + buttons" aria-label="Toggle touch controls">📱</button>
<button id="settings-btn" onclick="openSettingsModal()"`, 'L1 button DOM');

// L2 — button CSS (matches the ⛶/⚙ pill column; fullscreen 38px, mine 72px).
rep(`  body.force-desktop #fullscreen-btn { color: #88ffcc; border-color: #66dd88; }`,
`  body.force-desktop #fullscreen-btn { color: #88ffcc; border-color: #66dd88; }
  #mobile-mode-btn {
    position: fixed; top: 72px; right: 10px;
    width: 30px; height: 30px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(80,40,120,0.88), rgba(40,20,80,0.88));
    border: 1px solid #b090ff; color: #e8d8ff;
    font-size: 15px; line-height: 1;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; z-index: 120;
    box-shadow: 0 2px 6px rgba(0,0,0,0.55), 0 0 8px rgba(176,144,255,0.25);
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  body.force-mobile-ctrl #mobile-mode-btn { color: #88ffcc; border-color: #66dd88; }`, 'L2 button CSS');

// L3 — toggle + runtime CSS cloner (no duplicated layout rules to maintain).
rep(`function toggleFullscreenDesktop() {`,
`// v0.26.949 — Desktop touch-controls mode. The deck's layout CSS lives
// inside '(pointer: coarse), (max-width: 900px)' media blocks that a
// big mouse-driven monitor never matches — so instead of duplicating
// ~300 rules, clone every non-portrait coarse-pointer media block's
// contents into an unconditional <style> at toggle time. Future deck
// CSS changes are picked up automatically.
function _lxInjectMobileCssForDesktop() {
  if (document.getElementById('force-mobile-css')) return;
  let css = '';
  try {
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch (e) { continue; }
      if (!rules) continue;
      for (const r of rules) {
        if (r.type !== CSSRule.MEDIA_RULE) continue;
        const cond = (r.conditionText || (r.media && r.media.mediaText) || '');
        if (!/pointer:\\s*coarse/.test(cond) || /portrait/.test(cond)) continue;
        for (const inner of r.cssRules) css += inner.cssText + '\\n';
      }
    }
  } catch (e) {}
  const st = document.createElement('style');
  st.id = 'force-mobile-css';
  st.textContent = css;
  document.head.appendChild(st);
}
function _lxToggleMobileMode() {
  const on = !document.body.classList.contains('force-mobile-ctrl');
  document.body.classList.toggle('force-mobile-ctrl', on);
  if (on) {
    _lxInjectMobileCssForDesktop();
    document.body.classList.remove('hide-mobile-ctrl');
    document.body.classList.remove('force-desktop');   // force-desktop CSS hides the deck
    document.body.classList.add('mc-landscape');
    try {
      localStorage.setItem('mojiworld_hide_mobile_ctrl', '0');
      localStorage.removeItem('_lx_forceDesktop');
    } catch (e) {}
    try { if (typeof _initMobileControls === 'function') _initMobileControls(); } catch (e) {}
  } else {
    const st = document.getElementById('force-mobile-css');
    if (st) st.remove();
    document.body.classList.add('hide-mobile-ctrl');
    try { localStorage.setItem('mojiworld_hide_mobile_ctrl', '1'); } catch (e) {}
  }
  try { _fitGameToViewport(); setTimeout(_fitGameToViewport, 120); } catch (e) {}
  try { if (typeof showToast === 'function') showToast(on ? 'Touch controls ON' : 'Touch controls OFF', 'common'); } catch (e) {}
}
function toggleFullscreenDesktop() {`, 'L3 toggle + cloner');

// L4 — fit math treats forced touch mode as touch (keeps mc-landscape set).
rep(`  const isTouchOrNarrow = forceDesktop ? false :
    ((window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || vw < 900);`,
`  const isTouchOrNarrow = forceDesktop ? false :
    (document.body.classList.contains('force-mobile-ctrl') ||
     (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || vw < 900);`, 'L4 fit awareness');

// L5 — progress pill becomes a top-center bar with a fill gradient.
rep(`  #sprite-load-pill {
    position: fixed;
    top: calc(24px + env(safe-area-inset-top));
    left: calc(6px + env(safe-area-inset-left));
    z-index: 60; display: none;
    font: 700 10px/1.5 'Segoe UI', system-ui, sans-serif;
    color: #d8f5e2;
    background: rgba(10, 30, 22, 0.74);
    border: 1px solid rgba(110, 231, 168, 0.55);
    border-radius: 12px; padding: 3px 10px;
    pointer-events: none;
  }`,
`  #sprite-load-pill {
    position: fixed;
    top: calc(6px + env(safe-area-inset-top));
    left: 50%; transform: translateX(-50%);   /* v0.26.949 — top centre */
    min-width: 210px; text-align: center;
    z-index: 60; display: none;
    font: 700 10px/1.6 'Segoe UI', system-ui, sans-serif;
    color: #d8f5e2;
    /* progress fill driven by --lx-pct */
    background: linear-gradient(90deg,
      rgba(46, 160, 87, 0.62) var(--lx-pct, 0%),
      rgba(10, 30, 22, 0.74)  var(--lx-pct, 0%));
    border: 1px solid rgba(110, 231, 168, 0.55);
    border-radius: 12px; padding: 3px 12px;
    pointer-events: none;
  }`, 'L5 bar CSS');
rep(`  if (t > 0 && d < t) {
    p.textContent = '⏳ Loading sprites ' + d + '/' + t;
    p.style.display = 'block';`,
`  if (t > 0 && d < t) {
    const pct = Math.max(1, Math.round((d / t) * 100));
    p.textContent = '⏳ Loading sprites ' + d + '/' + t + ' · ' + pct + '%';
    p.style.setProperty('--lx-pct', pct + '%');
    p.style.display = 'block';`, 'L6 bar fill');
rep(`    p.textContent = '✓ All sprites loaded';
    p.style.display = 'block';`,
`    p.textContent = '✓ All sprites loaded';
    p.style.setProperty('--lx-pct', '100%');
    p.style.display = 'block';`, 'L7 bar full');

// L8 — service worker registration (asset cache for fast repeat loads).
rep(`requestAnimationFrame(loop);
</script>`,
`requestAnimationFrame(loop);
// v0.26.949 — Asset cache. sw.js serves sprites/audio stale-while-
// revalidate: repeat loads come from disk cache instantly, while a
// background refetch keeps redrawn sprites fresh for the NEXT visit.
// The HTML itself is never cached, so code updates always apply.
try {
  if ('serviceWorker' in navigator &&
      (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
} catch (e) {}
</script>`, 'L8 SW register');

const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const big = scripts.sort((a, b) => b.length - a.length)[0];
await writeFile('C:/Users/Xenon/Desktop/Mojiworld/tools/_v949_check.js', big, 'utf8');
execSync('node --check "C:/Users/Xenon/Desktop/Mojiworld/tools/_v949_check.js"', { stdio: 'inherit' });
await writeFile(FILE + '.tmpl', s, 'utf8');
await rename(FILE + '.tmpl', FILE);
console.log('L DONE');
