// Main thread BLOCKED, or main thread WAITING?
// ============================================================================
// Everything cheap has been ruled out: canvas 2D calls account for 12ms of a
// 6.4s Firefox window, stripping every CSS effect buys 1.1fps, the blob decode
// path is faster on Firefox than the <img> path, and a blank page in the same
// browser does 240fps while reporting visible/focused. So the game really is
// at 1.3fps and the cost is not where I looked.
//
// This separates the only two remaining possibilities:
//
//   If a 4ms heartbeat timer ALSO runs ~260ms late, the main thread is BLOCKED
//   by JavaScript that is not the rAF callback — timers, promise handlers,
//   event listeners — and wrapping those will name it.
//
//   If the heartbeat keeps time while rAF crawls, the main thread is idle and
//   the wait is the COMPOSITOR: Firefox cannot present the frame fast enough,
//   which points at the canvas surface itself rather than at any game code.
//
// Both are instrumented, so one run answers it.
// Run: node scripts/firefox_where.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { firefox, chromium } = require('playwright-core');
const FF = (process.env.LOCALAPPDATA || '').split(String.fromCharCode(92)).join('/')
  + '/ms-playwright/firefox-1538/firefox/firefox.exe';
const PORT = Number(process.env.PORT || 10891);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));

const INSTALL = () => {
  const A = Object.create(null);
  window.__lxA = A;
  const bump = (k, dt) => { const a = A[k] || (A[k] = { n: 0, ms: 0 }); a.n++; a.ms += dt; };
  const wrapCb = (k, cb) => function (...a) {
    const t = performance.now();
    try { return cb.apply(this, a); } finally { bump(k, performance.now() - t); }
  };
  const st = window.setTimeout, si = window.setInterval, raf = window.requestAnimationFrame.bind(window);
  window.setTimeout = function (cb, d, ...r) { return st(typeof cb === 'function' ? wrapCb('setTimeout', cb) : cb, d, ...r); };
  window.setInterval = function (cb, d, ...r) { return si(typeof cb === 'function' ? wrapCb('setInterval', cb) : cb, d, ...r); };
  window.requestAnimationFrame = (cb) => raf(wrapCb('rAF', cb));
  const ael = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (t, fn, o) {
    if (typeof fn === 'function') { try { fn = wrapCb('event:' + t, fn); } catch (e) {} }
    return ael.call(this, t, fn, o);
  };
  const tp = Promise.prototype.then;
  Promise.prototype.then = function (a, b) { return tp.call(this, typeof a === 'function' ? wrapCb('promise.then', a) : a, b); };
};

const RUN = () => new Promise((done) => {
  for (const k in window.__lxA) delete window.__lxA[k];
  // Heartbeat: SHOULD fire every 4ms. Its lateness is main-thread block.
  let worstHb = 0, beats = 0, last = performance.now();
  const beat = () => { const n = performance.now(); const d = n - last - 4; if (d > worstHb) worstHb = d; beats++; last = n; hb = window.setTimeout(beat, 4); };
  let hb = window.setTimeout(beat, 4);
  // Frames in the same window.
  let frames = 0; const t0 = performance.now();
  const tick = () => { frames++; if (performance.now() - t0 < 5000) requestAnimationFrame(tick); else {
    clearTimeout(hb);
    const wall = performance.now() - t0;
    const rows = Object.entries(window.__lxA).map(([k, v]) => ({ k, n: v.n, ms: +v.ms.toFixed(0) }))
      .sort((a, b) => b.ms - a.ms).slice(0, 8);
    const jsMs = rows.reduce((a, r) => a + r.ms, 0);
    const cv = document.getElementById('game');
    done({ wall: +wall.toFixed(0), frames, beats, worstHb: +worstHb.toFixed(0), rows, jsMs,
           cvBack: cv ? cv.width + 'x' + cv.height : null,
           cvCss: cv ? Math.round(cv.getBoundingClientRect().width) + 'x' + Math.round(cv.getBoundingClientRect().height) : null,
           cvStyle: cv ? (getComputedStyle(cv).transform || '') + ' | imgRend:' + getComputedStyle(cv).imageRendering : null });
  } };
  requestAnimationFrame(tick);
});

const drive = async (name, browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(INSTALL);
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(12000);
  const R = await page.evaluate(RUN);
  await page.close();
  return { name, ...R };
};

const out = [];
for (const [nm, launch] of [['FIREFOX-' + (process.env.LX_HEADED ? 'HEADED' : 'headless'), () => firefox.launch({ executablePath: FF, headless: !process.env.LX_HEADED })],
                            ...(process.env.LX_FFONLY ? [] : [['CHROMIUM', () => chromium.launch({ channel: 'msedge', headless: true })]])]) {
  let b; try { b = await launch(); } catch (e) { console.log(`${nm}: launch failed`); continue; }
  try { out.push(await drive(nm, b)); } catch (e) { console.log(`${nm}: ${String(e.message).slice(0, 200)}`); }
  await b.close();
}
server.kill();

for (const r of out) {
  console.log(`\n### ${r.name}   ${r.frames} frames / ${r.wall}ms = ${(r.frames / (r.wall / 1000)).toFixed(1)} fps`);
  console.log(`  canvas: backing ${r.cvBack}  css ${r.cvCss}   ${r.cvStyle}`);
  console.log(`  4ms heartbeat: ${r.beats} beats, WORST lateness ${r.worstHb}ms`);
  console.log(`  all timed JS: ${r.jsMs}ms of ${r.wall}ms wall`);
  for (const x of r.rows) console.log(`      ${String(x.ms).padStart(6)}ms  ${String(x.n).padStart(6)} calls  ${x.k}`);
  const verdict = r.worstHb > 100 ? 'BLOCKED by JS' : 'main thread IDLE — waiting on the compositor';
  console.log(`  => ${verdict}`);
}
