// Deterministic combat-lag metric: MAIN-THREAD MILLISECONDS spent inside
// getImageData during a fixed fight, plus the pixel volume behind it.
//
// Frame-time medians on a loaded workstation swing +/-50% run to run — two
// interleaved A/B rounds disagreed on the sign of the change. Time spent inside
// a specific synchronous API does not: it is the work itself, not the machine's
// mood. This is the number to move.
//
//   node scripts/perf_readback_test.mjs [build.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { spawn } from 'node:child_process';
const ROOT = 'C:/Users/dpeh0/Mojiworld';
const PORT = process.env.PERF_PORT || '9499';
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const URL = 'http://localhost:' + PORT + '/' + (process.argv[2] || 'mojiworld_game.html');
const browser = await chromium.launch({ channel: 'chrome', args: [
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function', { timeout: 90000 });

// Instrument BEFORE the map loads so map-entry work is counted too — that is
// exactly the window where a player feels the hitch.
await page.evaluate(() => {
  window.__rb = { n: 0, ms: 0, px: 0, worst: 0, by: {} };
  const proto = CanvasRenderingContext2D.prototype;
  const orig = proto.getImageData;
  proto.getImageData = function (x, y, w, h) {
    const t = performance.now();
    const r = orig.apply(this, arguments);
    const dt = performance.now() - t;
    const s = window.__rb;
    s.n++; s.ms += dt; s.px += w * h;
    if (dt > s.worst) s.worst = dt;
    const st = (new Error()).stack || '';
    const who = ((st.split(String.fromCharCode(10))[2] || '?').trim().split(' ')[1] || '?');
    const e = s.by[who] || (s.by[who] = { n: 0, ms: 0, px: 0 });
    e.n++; e.ms += dt; e.px += w * h;
    return r;
  };
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
await page.evaluate(() => {
  const types = Object.keys(monsterTypes).slice(0, 8);
  for (let i = 0; i < 28; i++) {
    try { spawnMonster(player.x + (i % 7 - 3) * 90, player.y - 40, types[i % types.length]); } catch (e) {}
  }
});
await page.waitForTimeout(1000);

const res = await page.evaluate(async () => {
  const t0 = performance.now();
  const key = (t, k) => window.dispatchEvent(new KeyboardEvent(t, { key: k, bubbles: true }));
  let n = 0, frames = 0;
  const fr = [];
  let last = performance.now();
  while (performance.now() - t0 < 10000) {
    game.paused = false;
    if ((n++ & 15) === 0) { key('keydown', 'z'); setTimeout(() => key('keyup', 'z'), 60); }
    await new Promise((r) => requestAnimationFrame(r));
    const now = performance.now(); fr.push(now - last); last = now; frames++;
  }
  fr.sort((a, b) => a - b);
  const q = (p) => fr[Math.min(fr.length - 1, Math.floor(fr.length * p))] || 0;
  const s = window.__rb;
  const by = Object.entries(s.by).map(([k, v]) => [k, +v.ms.toFixed(0), v.n, +(v.px / 1e6).toFixed(1)])
    .sort((a, b) => b[1] - a[1]).slice(0, 8);
  return { frames, ms: +s.ms.toFixed(1), calls: s.n, mpix: +(s.px / 1e6).toFixed(1),
    worst: +s.worst.toFixed(1), p50: +q(0.5).toFixed(1), p99: +q(0.99).toFixed(1), by };
});
console.log(`readback: ${res.ms} ms across ${res.calls} calls (${res.mpix} MPix), worst single ${res.worst} ms`);
console.log(`frames ${res.frames} | p50 ${res.p50} ms | p99 ${res.p99} ms`);
console.log('ms by caller:');
for (const [k, ms, n, mp] of res.by) console.log(`  ${String(ms).padStart(5)} ms  ${String(n).padStart(4)} calls  ${String(mp).padStart(6)} MPix  ${k}`);
await browser.close(); srv.kill();
