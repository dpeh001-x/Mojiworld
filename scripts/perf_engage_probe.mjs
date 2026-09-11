// Empirical combat-lag profile: frame times + CDP CPU sample on a dense fight.
// Shipped alongside the v0.29.729 combat-lag pass so before/after comparisons
// use one fixed harness. Interleave runs (A,B,A,B) - absolute medians swing
// with machine load; the self-time SHARES and the p99 tail are the stable
// signals. Usage: node scripts/perf_combat_profile.mjs [build.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// v0.30.x — SERVE OVER HTTP, because that is the only way anyone plays: Steam's
// Electron shell does loadURL('http://127.0.0.1:...'), the desktop launcher runs
// serve.js, and Pages is https. The old file:/// URL measured a path no client
// takes, and it measured it WRONGLY: _lxBitmapOffThread only routes through the
// fast blob path for /^https?:/ sources, so under file:// every bake fell back to
// the on-thread createImageBitmap(<img>) decode. That fallback dominated the
// profile at 29.6% self-time and p50 39ms — against 19.5ms and no
// createImageBitmap at all over http. Same build, same fight, half the frame time.
import { spawn as _spawn } from 'node:child_process';
const _PORT = process.env.PERF_PORT || '9495';
const _srv = _spawn(process.execPath, [path.join(ROOT, 'serve.js'), _PORT], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const URL = 'http://localhost:' + _PORT + '/' + (process.argv[2] || 'mojiworld_game.html');
const browser = await chromium.launch({ channel: 'chrome', args: [
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster !== 'undefined', { timeout: 60000 }).catch(() => {});
await page.waitForFunction(() => typeof loadMap === 'function', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 60; player.cls = 'warrior'; player.invulnerable = 9e9; player.hp = 99999; player.maxHp = 99999;
  try { loadMap('blockland_apex'); } catch (e) { try { loadMap('boneGraveyard'); } catch (e2) {} }
  game.paused = false;
});
await page.waitForTimeout(6000);
// --- ENGAGE probe: a pack spawns out of sight, prewarm gets WAIT ms while the pack is never drawn,
// then the player teleports in and a per-second series records frames and canvas creation. ---
const series = await page.evaluate(async ({ WAIT, SECS }) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const oce = document.createElement, made = {}, WATCH = ['_lxPlainOf', '_lxPinned', '_lxBitmapToCanvas', '_dnBake', '_lxTintBake', '_lxDrawSoft', '_fxStamp'];
  document.createElement = function (t, ...r) {
    if (String(t).toLowerCase() === 'canvas') { const s = (new Error().stack || '').split('\n')[2] || '', f = (s.match(/at ([^ (]+)/) || [])[1] || '?', k = WATCH.find((w) => f.endsWith(w)) || 'other'; made[k] = (made[k] || 0) + 1; }
    return oce.call(document, t, ...r);
  };
  const ww = (game.mapData && game.mapData.worldWidth) || 2400, types = Object.keys(monsterTypes).slice(0, 8);
  const px = Math.max(120, Math.min(player.x, ww * 0.25)), gx = Math.min(ww - 260, px + 1300);
  player.x = px; game.paused = false;
  const odm = window.drawMonster; window.drawMonster = function () {};   // out of sight: nothing warms the pack by drawing it
  for (let i = 0; i < 28; i++) try { spawnMonster(gx + (i % 7 - 3) * 60, player.y - 40, types[i % types.length]); } catch (e) {}
  await sleep(WAIT);
  window.drawMonster = odm;
  const pins0 = _lxPinCount, queue0 = typeof _LX_PREWARM_Q !== 'undefined' ? _LX_PREWARM_Q.length : -1;
  player.x = gx - 30; player.vx = 0;
  const key = (t, k) => window.dispatchEvent(new KeyboardEvent(t, { key: k, bubbles: true })), out = { ww, px, gx, pins0, queue0, rows: [] };
  let last = performance.now(), n = 0;
  for (let sec = 0; sec < SECS; sec++) {
    const dts = [], t0 = performance.now(), snap = Object.assign({}, made), p0 = _lxPinCount;
    while (performance.now() - t0 < 1000) { game.paused = false; if ((n++ & 15) === 0) { key('keydown', 'z'); setTimeout(() => key('keyup', 'z'), 60); } await new Promise((r) => requestAnimationFrame(r)); const now = performance.now(); dts.push(now - last); last = now; }
    dts.sort((a, b) => a - b); const d = {}; for (const k of Object.keys(made)) { const v = made[k] - (snap[k] || 0); if (v) d[k] = v; }
    out.rows.push({ sec, f: dts.length, p50: +dts[dts.length >> 1].toFixed(1), p95: +dts[Math.floor(dts.length * 0.95)].toFixed(1), max: +dts[dts.length - 1].toFixed(1), slow: dts.filter((x) => x > 33).length, alive: game.monsters.filter((m) => m && m.currentHp > 0).length, pins: _lxPinCount - p0, made: d });
  }
  document.createElement = oce; return out;
}, { WAIT: Number(process.env.WAIT || 5000), SECS: Number(process.env.SECS || 10) });
const R = series.rows, first = R.slice(0, 5), rest = R.slice(5);
const sum = (a, k) => a.reduce((s, r) => s + r[k], 0), mx = (a) => Math.max(...a.map((r) => r.max));
console.log(`map ww ${series.ww}, player ${Math.round(series.px)} -> pack ${Math.round(series.gx)}; pins before engage ${series.pins0}, prewarm queue left ${series.queue0}`);
console.log('sec frames p50 p95 max >33ms alive newPins | canvases that second');
for (const r of R) console.log(String(r.sec).padStart(3), String(r.f).padStart(5), String(r.p50).padStart(5), String(r.p95).padStart(6), String(r.max).padStart(6), String(r.slow).padStart(4), String(r.alive).padStart(4), String(r.pins).padStart(4), ' |', Object.entries(r.made).sort((a, b) => b[1] - a[1]).map(([k, v]) => k.replace('_lx', '') + ':' + v).join(' '));
console.log(`ENGAGE first 5 s: frames ${sum(first, 'f')}, >33ms ${sum(first, 'slow')}, worst ${mx(first)} ms, new pins ${sum(first, 'pins')}; after: frames ${sum(rest, 'f')}, >33ms ${sum(rest, 'slow')}, worst ${rest.length ? mx(rest) : '-'} ms`);
await browser.close(); try { _srv.kill(); } catch (e) {}
