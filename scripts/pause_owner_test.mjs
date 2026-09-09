// The pause-system cluster from the v0.30.497 audit (fixed v0.30.498).
//   * _lxPauseOwners() and _anyOtherModalOpen() are twins that must agree, and had drifted:
//     four surfaces that pause the game were in neither, so the StuckPauseWatchdog
//     force-unpaused the world 3 s later under a veil that still read "PAUSED".
//   * Two cinematic entrances (the prologue's arena entrance, and the first true walk into
//     The Singularity) set game.paused = true so the boss cannot act, and closeAllModals()
//     cleared it 300 ms later with an unconditional reassignment.
//
//   node scripts/pause_owner_test.mjs        MOJI_SERVE_ROOT / PORT override
//
// The watchdog checks are wall-clock: the veil goes up and the test waits out the real
// 3 s window rather than reaching into the watchdog's own state.
// Negative control: 9 of these fail on v0.30.497.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10441); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxPauseOwners === 'function' && typeof _anyOtherModalOpen === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);

  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(800);
    // A boot in this harness leaves #story-beat-overlay up with `mode-epilogue on` — a
    // legitimate, long-standing pause owner that has nothing to do with what is under test.
    // Clear every class-driven overlay so the baseline is genuinely empty; an earlier draft
    // measured against it and reported four false failures plus a fifth on the watchdog.
    for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'game-complete-overlay',
                      'jukebox-modal-bg', 'settings-modal-bg', 'char-studio-overlay']) {
      const el = document.getElementById(id);
      if (el && el.classList) el.classList.remove('on', 'open');
    }
    game.paused = false;
    const o = { ver: GAME_VERSION, surfaces: {} };
    o.baselineOwners = _lxPauseOwners().map((e) => e.id || e.className);

    // ---- 1. every surface that pauses is seen by BOTH readers ---------------
    const check = (id, show, hide) => {
      show();
      const owners = _lxPauseOwners().map((e) => e.id || e.className);
      const res = { inOwners: owners.includes(id), inAnyOther: _anyOtherModalOpen() };
      hide();
      res.clearedAfterHide = !_lxPauseOwners().map((e) => e.id || e.className).includes(id) && !_anyOtherModalOpen();
      return res;
    };
    const mkDisplay = (id) => {
      let el = document.getElementById(id);
      if (!el) { el = document.createElement('div'); el.id = id; document.body.appendChild(el); }
      return el;
    };
    o.surfaces['lx-autopause'] = check('lx-autopause',
      () => { const v = _lxAutoPauseVeil(); v.style.display = 'flex'; },
      () => { const v = document.getElementById('lx-autopause'); if (v) v.style.display = 'none'; });
    o.surfaces['backup-modal-bg'] = check('backup-modal-bg',
      () => { mkDisplay('backup-modal-bg').classList.add('on'); },
      () => { const e = document.getElementById('backup-modal-bg'); if (e) e.classList.remove('on'); });
    o.surfaces['exp-seed-modal'] = check('exp-seed-modal',
      () => { mkDisplay('exp-seed-modal').style.display = 'flex'; },
      () => { const e = document.getElementById('exp-seed-modal'); if (e) e.remove(); });
    o.surfaces['everdawn-welcome-overlay'] = check('everdawn-welcome-overlay',
      () => { mkDisplay('everdawn-welcome-overlay').style.display = 'flex'; },
      () => { const e = document.getElementById('everdawn-welcome-overlay'); if (e) e.remove(); });

    // the twins must agree on an empty world too
    o.emptyOwners = _lxPauseOwners().length;
    o.emptyAnyOther = _anyOtherModalOpen();

    // ---- 2. the watchdog leaves the auto-pause veil alone -------------------
    // The controller case is the airtight one: reason 'controller' has no auto-resume,
    // so before this fix the sim ran indefinitely behind a veil reading "PAUSED".
    _lxAutoPause('controller');
    o.veilPausedAtOnce = !!game.paused;
    o.veilVisible = (document.getElementById('lx-autopause') || {}).style?.display === 'flex';
    await sleep(4200);                       // past the watchdog's 3 s window
    o.veilStillPaused = !!game.paused;
    o.veilStillVisible = (document.getElementById('lx-autopause') || {}).style?.display === 'flex';
    try { _lxAutoResume(true); } catch (e) {}
    await sleep(200);
    o.veilResumed = !game.paused;

    // ---- 3. the cinematic hold ---------------------------------------------
    o.holdFns = (typeof _lxCineHold === 'function') && (typeof _lxCineHoldActive === 'function');
    if (o.holdFns) {
      game.paused = true;
      _lxCineHold(6000);
      o.holdActive = _lxCineHoldActive();
      o.holdSeenByAnyOther = _anyOtherModalOpen();
      closeAllModals();                      // the exact call that used to drop the pause
      o.pausedAfterCloseAllModals = !!game.paused;
      await sleep(4200);                     // past the watchdog's 3 s window
      o.pausedAfterWatchdogWindow = !!game.paused;
      _lxCineHold(0);
      o.holdReleased = !_lxCineHoldActive();
      await sleep(4200);                     // watchdog must now recover the world
      o.recoveredAfterRelease = !game.paused;

      // and the deadline is a real backstop: a hold nobody releases expires on its own
      game.paused = true;
      _lxCineHold(1200);
      await sleep(2000);
      o.expired = !_lxCineHoldActive();
      await sleep(4200);
      o.recoveredAfterExpiry = !game.paused;
      _lxCineHold(0);
    }

    // a plain unattributed pause must STILL be recovered — the watchdog keeps working
    game.paused = true;
    await sleep(4200);
    o.strayPauseRecovered = !game.paused;
    return o;
  });

  console.log('build ' + r.ver);
  console.log(JSON.stringify(r, null, 1).slice(0, 1700) + '\n');

  for (const id of ['lx-autopause', 'backup-modal-bg', 'exp-seed-modal', 'everdawn-welcome-overlay']) {
    const x = r.surfaces[id];
    ok(`${id} is a pause owner`, x.inOwners, JSON.stringify(x));
    ok(`${id} is seen by _anyOtherModalOpen too`, x.inAnyOther, JSON.stringify(x));
    ok(`${id} stops counting once hidden`, x.clearedAfterHide, JSON.stringify(x));
  }
  ok('the twins agree when nothing is open', r.emptyOwners === 0 && r.emptyAnyOther === false, `${r.emptyOwners} / ${r.emptyAnyOther}`);

  ok('a lost controller pauses the game', r.veilPausedAtOnce && r.veilVisible);
  ok('the world stays paused under the "PAUSED" veil past 3 s', r.veilStillPaused, 'paused=' + r.veilStillPaused);
  ok('the veil is still up (it never auto-resumes for a controller)', r.veilStillVisible);
  ok('resuming still works', r.veilResumed);

  ok('the cinematic-hold helpers exist', r.holdFns);
  ok('closeAllModals no longer drops a held cinematic pause', r.pausedAfterCloseAllModals, 'paused=' + r.pausedAfterCloseAllModals);
  ok('the watchdog leaves a held cinematic pause alone', r.pausedAfterWatchdogWindow, 'paused=' + r.pausedAfterWatchdogWindow);
  ok('releasing the hold lets the world resume', r.holdReleased && r.recoveredAfterRelease, `released=${r.holdReleased} recovered=${r.recoveredAfterRelease}`);
  ok('an unreleased hold expires on its deadline', r.expired, 'expired=' + r.expired);
  ok('...and the world is recovered after it expires', r.recoveredAfterExpiry, 'recovered=' + r.recoveredAfterExpiry);
  ok('a stray unattributed pause is STILL force-recovered', r.strayPauseRecovered, 'recovered=' + r.strayPauseRecovered);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally {
  await browser.close(); server.kill();
}
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
