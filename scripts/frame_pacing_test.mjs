// Frame pacing (v0.30.385): the simulation keeps real time when frames arrive late
// (one catch-up step per frame, never more), a 60 Hz panel's jitter never drops a
// frame, a 30 fps machine runs the game at full speed, a 144 Hz panel is not
// over-stepped, and a hitch is repaid within a few frames. Drives the real frame
// entry with synthetic timestamps.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9961); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof _lxFrame === 'function' && typeof loadMap === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const o = { ver: GAME_VERSION, has: typeof _lxPaceStats === 'object' };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { loadMap('forest', 300); } catch (e) {} await new Promise((r) => setTimeout(r, 400));
    game.paused = false; player.hp = Math.max(1, player.hp || 1);
    const STEP = _LX_SIM_STEP_MS;
    const orig = _lxNextFrame; _lxNextFrame = () => {};   // stop the real loop rescheduling; we drive frames by hand
    await new Promise((r) => setTimeout(r, 250));
    const drive = (dts) => { let t = performance.now(); lastTime = t; _lxSimAccumMs = 0; if (o.has) { _lxPaceStats.frames = 0; _lxPaceStats.steps = 0; _lxPaceStats.catchUp = 0; _lxPaceStats.snapped = 0; _lxPaceStats.skipped = 0; } const steps = []; for (const d of dts) { t += d; const g0 = game.time; _lxFrame(t); steps.push(game.time - g0); } return { steps, accum: _lxSimAccumMs, stats: o.has ? Object.assign({}, _lxPaceStats) : null }; };
    const rep = (arr, n) => { const out = []; for (let i = 0; i < n; i++) out.push(arr[i % arr.length]); return out; };
    o.jitter = drive(rep([16.4, 16.9, 16.55, 16.75], 120));
    o.exact60 = drive(rep([STEP], 60));
    o.hz30 = drive(rep([33.3], 60));
    o.hz144 = drive(rep([1000 / 144], 144));
    o.hitch = drive([100].concat(rep([STEP], 10)));
    o.hz45 = drive(rep([22.2], 90));   // an in-between rate: neither snapped nor a clean multiple
    _lxNextFrame = orig; _lxNextFrame();
    return o;
  });
  const sum = (a) => a.reduce((x, y) => x + y, 0), max = (a) => Math.max(...a), min = (a) => Math.min(...a);
  console.log('build ' + r.ver + '  jitter steps ' + r.jitter.steps.slice(0, 12).join('') + '…  30Hz total ' + sum(r.hz30.steps) + '  144Hz total ' + sum(r.hz144.steps) + '  hitch ' + r.hitch.steps.join(''));
  ok('pacing stats exist', r.has === true);
  ok('60 Hz jitter (16.4-16.9ms): every frame steps exactly once - no dropped frame, no double', min(r.jitter.steps) === 1 && max(r.jitter.steps) === 1, 'min ' + min(r.jitter.steps) + ' max ' + max(r.jitter.steps) + ' zeros ' + r.jitter.steps.filter((x) => x === 0).length);
  ok('60 Hz jitter leaves no debt (accumulator under one step)', r.jitter.accum < 16.67, String(r.jitter.accum && r.jitter.accum.toFixed(2)));
  ok('exact 60 Hz: 60 frames, 60 steps', sum(r.exact60.steps) === 60 && max(r.exact60.steps) === 1);
  ok('30 fps machine: the game keeps full speed (two steps a frame, 120 over 60 frames; was 60 = half speed)', sum(r.hz30.steps) === 120 && max(r.hz30.steps) === 2 && min(r.hz30.steps) === 2, 'total ' + sum(r.hz30.steps));
  ok('30 fps: every catch-up pass is a sim-only pass (no extra draw)', !!r.hz30.stats && r.hz30.stats.catchUp === 60, r.hz30.stats && JSON.stringify(r.hz30.stats));
  ok('144 Hz panel: 144 frames make 60 +/- 1 steps, never two in one frame', Math.abs(sum(r.hz144.steps) - 60) <= 1 && max(r.hz144.steps) === 1, 'total ' + sum(r.hz144.steps));
  ok('a 100ms hitch: never more than two steps a frame, and the debt is repaid within three frames', max(r.hitch.steps) === 2 && sum(r.hitch.steps.slice(0, 4)) >= 6 && r.hitch.steps.slice(4).every((x) => x === 1) && r.hitch.accum < 16.67, r.hitch.steps.join('') + ' accum ' + r.hitch.accum.toFixed(1));
  ok('45 fps: the game stays within one step of real time over 90 frames (not snapped, not starved)', Math.abs(sum(r.hz45.steps) - Math.floor(90 * 22.2 / 16.667)) <= 2 && max(r.hz45.steps) <= 2, 'total ' + sum(r.hz45.steps) + ' of ' + Math.floor(90 * 22.2 / 16.667));
  ok('the simulation never runs ahead of real time in any sequence', [['jitter', 120 * 16.65], ['hz30', 60 * 33.3], ['hz144', 1000], ['hz45', 90 * 22.2]].every(([k, ms]) => sum(r[k].steps) <= Math.floor(ms / 16.667) + 1));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
