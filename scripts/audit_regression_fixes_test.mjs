// The five defects an adversarial review found in the v0.30.494-505 audit fixes themselves.
//   1. _lxCineHoldActive returned true on _gravitosCinePlaying with NO deadline, so a thrown
//      entrance chain suppressed the StuckPauseWatchdog forever (a 3 s glitch became a freeze).
//   2. The prologue hold release sat AFTER the guard that skips it.
//   3. The save-marker clear reached clearSave() only — import, backup restore and both cloud
//      adopt paths still installed a save over a stale marker.
//   4. The Conductor's sweep ate an add the player killed in the same frame.
//   5. _pendingSweeps was not drained on updateMonsters' co-op-follower early return.
//
//   node scripts/audit_regression_fixes_test.mjs      MOJI_SERVE_ROOT / PORT override
//
// Negative control: 1, 3 and 4 fail on v0.30.508.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10901); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxCineHoldActive === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);

  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(700);
    // AFTER loadMap, not before: a boot leaves #story-beat-overlay up with `mode-epilogue on`,
    // and loadMap can raise it again. An earlier draft cleared these first and then measured a
    // legitimate pause owner as "the watchdog did not recover".
    for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'game-complete-overlay', 'jukebox-modal-bg', 'settings-modal-bg', 'char-studio-overlay']) {
      const el = document.getElementById(id); if (el && el.classList) el.classList.remove('on', 'open');
    }
    game.paused = false;
    const o = {};

    // ---- 1. the flag alone must NOT hold the pause ---------------------------
    // This is the shape of the bug: the entrance chain threw, so _gravitosCinePlaying was
    // left true and _afterEntry never ran. The deadline must still govern.
    _lxCineHold(0);
    game._gravitosCinePlaying = true;
    o.flagAloneHolds = _lxCineHoldActive();
    game.paused = true;
    await sleep(4200);                         // past the watchdog's 3 s window
    o.recoveredWithFlagStuck = !game.paused;
    game._gravitosCinePlaying = false;

    // a REAL hold still works, and still expires
    _lxCineHold(6000);
    o.realHoldActive = _lxCineHoldActive();
    game.paused = true;
    closeAllModals();
    o.heldThroughCloseAll = !!game.paused;
    await sleep(4200);
    o.heldPastWatchdog = !!game.paused;
    _lxCineHold(0);
    await sleep(4200);
    o.recoveredAfterRelease = !game.paused;

    // ---- 3. every SAVE_KEY install path clears the marker --------------------
    const markSet = () => { try { localStorage.setItem(_LX_SAVE_MARK_KEY, JSON.stringify({ t: 1, setshards: 999, mojicoins: 888, bankBalance: 7 })); } catch (e) {} };
    const markGone = () => { try { return localStorage.getItem(_LX_SAVE_MARK_KEY) === null; } catch (e) { return false; } };
    o.marker = {};
    // clearSave (already fixed in v0.30.494)
    markSet(); clearSave(); o.marker.clearSave = markGone();
    // backup restore
    markSet();
    try {
      const blob = JSON.stringify({ t: 2, player: { level: 5, name: 'B', cls: 'warrior' }, game: {} });
      const arr = (typeof _lxGetBackups === 'function') ? _lxGetBackups() : [];
      arr.unshift({ id: 'probe', ts: Date.now(), label: 'probe', name: 'B', level: 5, cls: 'warrior', map: 'forest', data: blob });
      if (typeof _lxStoreBackups === 'function') _lxStoreBackups(arr);
      const _rl = window.location.reload; try { Object.defineProperty(window.location, 'reload', { value: () => {}, configurable: true }); } catch (e) {}
      if (typeof _lxRestoreBackup === 'function') _lxRestoreBackup('probe');
      else if (typeof restoreBackup === 'function') restoreBackup('probe');
      try { Object.defineProperty(window.location, 'reload', { value: _rl, configurable: true }); } catch (e) {}
    } catch (e) { o.marker.restoreErr = String(e.message).slice(0, 80); }
    o.marker.backupRestore = markGone();
    try { game._resetting = false; } catch (e) {}

    // static coverage: how many SAVE_KEY installs are paired with a marker clear
    o.srcCounts = null;
    return o;
  });

  // Static half — count the install sites and the clears in the served source.
  const src = await (await fetch(`http://localhost:${PORT}/mojiworld_game.html`)).text();
  const installs = (src.match(/localStorage\.setItem\(SAVE_KEY,/g) || []).length;
  const clears = (src.match(/removeItem\(_LX_SAVE_MARK_KEY\)/g) || []).length;
  const holdFlag = /if \(game\._gravitosCinePlaying\) return true;/.test(src);
  const drainFn = /function _lxDrainPendingSweeps\(\)/.test(src);
  const drainCalls = (src.match(/_lxDrainPendingSweeps\(\)/g) || []).length;
  const queuedGuard = /_pendingKills \|\| \[\]\)\.indexOf\(_add\)/.test(src);
  const releaseFirst = /_lxCineHold\(0\);\s*\r?\n\s*if \(!window\._prologueActive\) return;/.test(src);

  console.log(JSON.stringify(r, null, 1).slice(0, 1200));
  console.log(`\nstatic: ${installs} SAVE_KEY installs, ${clears} marker clears; holdFlagBranch=${holdFlag} drainFn=${drainFn} drainCalls=${drainCalls} queuedGuard=${queuedGuard} releaseFirst=${releaseFirst}\n`);

  ok('1. the stuck flag alone no longer holds the pause', r.flagAloneHolds === false, 'active=' + r.flagAloneHolds);
  ok('1. ...and the watchdog still recovers with the flag stuck true', r.recoveredWithFlagStuck === true);
  ok('1. the flag-only branch is gone from the source', holdFlag === false);
  ok('a real hold is still honoured', r.realHoldActive === true && r.heldThroughCloseAll === true && r.heldPastWatchdog === true,
    `active=${r.realHoldActive} closeAll=${r.heldThroughCloseAll} watchdog=${r.heldPastWatchdog}`);
  ok('...and still releases', r.recoveredAfterRelease === true);
  ok('2. the prologue hold is released BEFORE the active guard', releaseFirst === true);
  ok('3. clearSave clears the marker', r.marker.clearSave === true);
  ok('3. restoring a backup clears the marker', r.marker.backupRestore === true, JSON.stringify(r.marker));
  ok('3. every SAVE_KEY install site has a marker clear', clears >= installs, `${clears} clears for ${installs} installs`);
  ok('4. the Conductor sweep skips an add already queued for a real death', queuedGuard === true);
  ok('5. the sweep drain is a function called from more than one exit', drainFn === true && drainCalls >= 3, 'calls=' + drainCalls);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally {
  await browser.close(); server.kill();
}
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
