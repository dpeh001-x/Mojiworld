// Performance hot-path certification (deterministic, not FPS-timing based).
//   1. Gamepad poll early-returns WITHOUT calling navigator.getGamepads() when
//      no controller is present (the per-frame allocation that was ~7% of CPU).
//   2. A gamepadconnected event flips the gate on so controllers still work.
//   3. The HUD (updateUI) is throttled to ~30 Hz in the render loop, not run
//      every frame — while still updating (DOM setters are skip-if-unchanged).
import { chromium } from 'playwright-core';
const EXE = process.env.PW_EXE || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html';
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const p = await b.newContext({ serviceWorkers: 'block', viewport: { width: 960, height: 600 } }).then(c => c.newPage());
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => typeof _lxPadPoll === 'function' && typeof updateUI === 'function' && typeof applyClass === 'function', null, { timeout: 30000 });
  await p.waitForTimeout(6000);

  // 1) gamepad poll skips getGamepads when no pad present
  const pad = await p.evaluate(() => {
    let calls = 0; const orig = navigator.getGamepads.bind(navigator);
    navigator.getGamepads = function(){ calls++; return orig(); };
    _lxPadPresent = false;
    for (let i = 0; i < 30; i++) _lxPadPoll();
    const noPadCalls = calls;
    // 2) simulate a controller connecting → gate opens → polling resumes
    calls = 0; _lxPadPresent = true;
    for (let i = 0; i < 5; i++) _lxPadPoll();
    const withPadCalls = calls;
    navigator.getGamepads = orig;
    return { noPadCalls, withPadCalls, flagExists: typeof _lxPadPresent !== 'undefined' };
  });
  ok('gamepad poll makes ZERO getGamepads calls with no controller', pad.noPadCalls === 0, pad);
  ok('gamepad poll resumes getGamepads once a controller is present', pad.withPadCalls === 5, pad);

  // 3) HUD throttled to ~30Hz during unpaused gameplay
  await p.evaluate(() => {
    const ov = document.getElementById('loading-overlay'); if (ov) ov.remove();
    try { applyClass('warrior'); } catch(e){}
    for (const el of document.querySelectorAll('.modal-overlay, #story-beat-overlay, #class-select-modal')) el.style.display = 'none';
    window._prologueActive = false; window._anyOtherModalOpen = () => false;
    loadMap('forest'); player.x = 800; game.paused = false;
  });
  const hud = await p.evaluate(() => new Promise((resolve) => {
    let uiCalls = 0, frames = 0; const orig = window.updateUI;
    window.updateUI = function(){ uiCalls++; return orig.apply(this, arguments); };
    const start = performance.now();
    (function tick(now){ frames++; game.paused = false;
      if (now - start < 1000) requestAnimationFrame(tick);
      else { window.updateUI = orig; resolve({ frames, uiCalls, ratio: uiCalls / Math.max(1, frames) }); }
    })(performance.now());
  }));
  ok('HUD updateUI runs at ~30Hz, not every frame (ratio < 0.75)', hud.frames > 15 && hud.ratio < 0.75, hud);
  ok('HUD still updates (updateUI not disabled — ratio > 0.2)', hud.ratio > 0.2, hud);

  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await b.close(); }
let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++); console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.x !== undefined ? '  ' + JSON.stringify(r.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
