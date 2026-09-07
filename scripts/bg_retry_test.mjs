// Backdrops retry (v0.30.386): a backdrop whose request fails is retried with a
// backoff (cache-busted), marked failed after the schedule, retried on demand when
// its map is in view, and named on screen once so a tester can report the file.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9971); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof _loadBG === 'function' && typeof drawBackground === 'function' && typeof BG_IMAGES === 'object', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const o = { ver: GAME_VERSION, has: typeof _lxBgRetry === 'function' };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    window._LX_BG_RETRY_MS = [60, 60, 60, 60];   // the test's schedule
    // the shipped Underpass backdrop is wired and loads
    const up = BG_IMAGES.clockworkUnderpass; const t0 = performance.now();
    while (up && !up._loaded && performance.now() - t0 < 15000) await new Promise((r) => setTimeout(r, 50));
    o.underpassLoaded = !!(up && up._loaded); o.underpassPath = up && (up._lxPath || up.src);
    // a backdrop that 404s: retried on the schedule, then marked failed
    const bad = _loadBG('backgrounds/does_not_exist_' + Date.now() + '.webp');
    const t1 = performance.now();
    while (!(bad._lxFailed) && performance.now() - t1 < 6000) await new Promise((r) => setTimeout(r, 40));
    o.badErrN = bad._lxErrN; o.badFailed = !!bad._lxFailed; o.badTries = bad._lxTries | 0; o.badSrcBusted = /[?&]r=\d+/.test(bad.src);
    o.failedListHas = (typeof _LX_BG_FAILED !== 'undefined') && _LX_BG_FAILED.some((p) => p === bad._lxPath);
    // standing in a map whose backdrop failed: one toast naming the file, and an on-demand retry
    const toasts = []; const _st = window.showToast; window.showToast = function (t, k) { toasts.push(String(t)); };
    BG_IMAGES.__lxTestBad = bad; const md = game.mapData; const savedBg = md.bg, savedFlag = md._bgFailToast; md.bg = '__lxTestBad'; md._bgFailToast = false; bad._lxFailedAt = 0;
    try { drawBackground(); drawBackground(); drawBackground(); } catch (e) { o.drawErr = String(e && e.message); }
    o.toastCount = toasts.length; o.toastNamesFile = toasts.length > 0 && toasts[0].indexOf(bad._lxPath) >= 0;
    o.demandRetry = (bad._lxTries | 0) > o.badTries;
    // recovery: point the failed image at a real file and retry - it loads and clears the failure
    bad._lxPath = 'backgrounds/bg_v3_forest.webp'; bad._lxRetryPending = false; if (typeof _lxBgRetry === 'function') _lxBgRetry(bad, 'test');
    const t2 = performance.now(); while (!bad._loaded && performance.now() - t2 < 15000) await new Promise((r) => setTimeout(r, 50));
    o.recovered = !!bad._loaded && bad._lxFailed === false;
    md.bg = savedBg; md._bgFailToast = savedFlag; delete BG_IMAGES.__lxTestBad; window.showToast = _st; delete window._LX_BG_RETRY_MS;
    return o;
  });
  console.log('build ' + r.ver + (r.drawErr ? '  drawErr ' + r.drawErr : ''));
  ok('the Clockwork Underpass backdrop is wired and loads from the served tree', r.underpassLoaded === true, String(r.underpassPath));
  ok('retry machinery exists', r.has === true);
  ok('a backdrop that 404s is retried on the schedule (4 retries, cache-busted) and then marked failed', r.badFailed === true && r.badErrN === 5 && r.badTries === 4 && r.badSrcBusted === true, JSON.stringify([r.badFailed, r.badErrN, r.badTries, r.badSrcBusted]));
  ok('the failure is recorded for reporting', r.failedListHas === true);
  ok('standing in its map names the file on screen once, not every frame', r.toastCount === 1 && r.toastNamesFile === true, JSON.stringify([r.toastCount, r.toastNamesFile]));
  ok('standing in its map retries the backdrop on demand', r.demandRetry === true, JSON.stringify([r.badTries]));
  ok('a retry that succeeds clears the failure and the plate draws again', r.recovered === true);
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
