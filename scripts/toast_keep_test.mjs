// A TOAST THAT MATTERS IS NEVER THROWN AWAY (per user "keep going to test and debug"; found by postgame_unlock_test).
// The F11 queue (v0.30.906) dropped any toast that waited over 8 s and trimmed itself to 6 by age. A flood of level
// milestones and quest rewards keeps the 4-slot stack busy longer than that, and Dawn's Favor - a one-time notice that
// marks itself seen before its toast goes up - waited behind them and was dropped: the player was never told. Now a
// danger / story / legendary toast never goes stale and is not trimmed for one of its own rank; lower ranks still are.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/toast_keep_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11219';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof showToast === 'function', null, { timeout: 120000 });
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 30; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('forest', 300); await sleep(2500); try { closeAllModals(); } catch (e) {}
    try { LX_PERF.lowFx = true; LX_PERF.lowFxUntil = performance.now() + 1e9; LX_PERF._announcedLowFx = true; LX_PERF._announcedVeryLowFx = true; } catch (e) {}
    const host = document.getElementById('toast-container');
    const texts = () => [...host.querySelectorAll('.toast')].map((t) => t.textContent);
    const clear = () => { host.querySelectorAll('.toast').forEach((t) => t.remove()); try { _lxToastWait.length = 0; } catch (e) {} };
    // only this test's toasts reach the stack (map titles and nudges would change the timing)
    const _real = window.showToast, OWN = /^(FLOOD \d+|ONE-TIME NOTICE|RARE LATE|LEG LATE|PAD \d+)/;
    window.showToast = function (t) { return OWN.test(String(t)) ? _real.apply(this, arguments) : undefined; };
    const LONG = ' ' + 'x'.repeat(150);   // 7 s on screen, the longest a toast lives
    // 1. a flood of 8 long legendary toasts, then a one-time notice: it waits ~14 s, past the old 8 s stale cut
    clear();
    for (let i = 1; i <= 8; i++) showToast('FLOOD ' + i + LONG, 'legendary');
    showToast('ONE-TIME NOTICE', 'legendary');
    out.queued = _lxToastWait.map((w) => w.txt.slice(0, 14));
    let seenAt = -1, shown = 0;
    const t0 = performance.now();
    for (let i = 0; i < 240 && seenAt < 0; i++) { await sleep(100); const n = texts().filter((t) => t === 'ONE-TIME NOTICE').length; if (n) { seenAt = Math.round(performance.now() - t0); shown = n; } }
    out.notice = { seenAt, shown, stillQueued: _lxToastWait.some((w) => w.txt === 'ONE-TIME NOTICE') };
    // 2. the rule, directly: with the stack full, a rare toast that waited 9 s is dropped, a legendary one is kept
    clear();
    for (let i = 1; i <= 4; i++) showToast('PAD ' + i + LONG, 'legendary');
    showToast('RARE LATE', 'rare'); showToast('LEG LATE', 'legendary');
    for (const w of _lxToastWait) w.at -= 9000;
    _lxToastDrain();
    out.stale = _lxToastWait.map((w) => w.txt);
    // 3. the queue is still bounded: 30 legendary toasts over a full stack leave at most 16 waiting, newest kept
    clear();
    for (let i = 1; i <= 34; i++) showToast('FLOOD ' + i + LONG, 'legendary');
    out.bound = { waiting: _lxToastWait.length, newest: _lxToastWait.some((w) => /^FLOOD 34 /.test(w.txt)) };
    clear(); window.showToast = _real;
    return out;
  });
  check(r.notice.seenAt > 8000 && r.notice.shown === 1, 'a legendary notice that waited out a long flood still shows, once', J(r.notice) + ' queued ' + J(r.queued));
  check(r.stale.includes('LEG LATE') && !r.stale.includes('RARE LATE'), 'past 8 s a waiting rare toast is dropped, a legendary one is kept', J(r.stale));
  check(r.bound.waiting > 6 && r.bound.waiting <= 16 && r.bound.newest, 'the queue holds up to 16 top-rank toasts and keeps the newest', J(r.bound));
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
