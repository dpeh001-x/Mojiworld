// WHAT DOES A FRESHLY MINTED CANVAS ACTUALLY COST? Measured inside drawImage, on the game's own visible canvas,
// in the real page (same GPU settings, same context attributes). Five cases per size:
//   mint  - a new canvas per iteration, content drawn once, then one drawImage   (what the damage numbers do today)
//   rebake- ONE canvas, its content redrawn each iteration, then one drawImage   (a pool that is rewritten)
//   warm  - ONE canvas, content drawn once, drawn many times                     (the steady state)
//   pool  - ONE big canvas, a fresh sub-rect written each iteration, sub-blit    (a packed atlas, still writing)
//   poolw - the same big canvas, no writes, sub-blits from earlier rects         (a packed atlas, warm)
//   poolmix - one shelf written, then ten blits in the SAME frame               (what a fight really does)
// WHAT THIS PROBE DOES NOT ANSWER: whether a shared pooled atlas is a good idea. Every pool case here measures
// cheap (about 1 ms), yet a v0.30.940 candidate that put the two glyph atlases on one 2048x2048 sheet was WORSE in
// the game, on paired throttled runs: drawDamageNumbers 11.24 ms a frame against 3.64, and 85 draws over 8 ms
// totalling 1863 ms against 11 totalling 203. The reason is not established - a fight blits a hundred-plus
// sub-rects a frame from a sheet it also writes, which this does not reproduce. Use it for mint-vs-reuse, and
// measure a pooling change in a real fight with scripts/grav_live_profile.mjs.
//   [SERVE_ROOT=<root>] [CPU=6] PORT=11340 node scripts/canvas_cost_probe.mjs [build.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const HERE = path.dirname(fileURLToPath(import.meta.url));
// the directory served (serve.js, data/, art): the repo root when this file lives in scripts/, else ./root beside it
const SERVE_ROOT = process.env.SERVE_ROOT || (path.basename(HERE) === 'scripts' ? path.resolve(HERE, '..') : path.join(HERE, 'root'));
const PORT = process.env.PORT || '11340';
const require = createRequire(path.join(SERVE_ROOT, 'x.js'));
const { chromium } = require('playwright-core');
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
const env = { ...process.env, MOJI_GAME_FILE: PAGE };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const ctx0 = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1920, height: 1080 } });
  await ctx0.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx0.newPage();
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof ctx !== 'undefined', null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 60; loadMap('forest', 300); await new Promise((r) => setTimeout(r, 1200));
  });
  if (process.env.CPU) { const c = await page.context().newCDPSession(page); await c.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU) }); console.log('cpu throttle x' + process.env.CPU); }
  const out = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const med = (a) => { const b = a.slice().sort((x, y) => x - y); return +b[b.length >> 1].toFixed(2); };
    const mx = (a) => +Math.max(...a).toFixed(2);
    const paint = (c, w, h, seed) => {                       // roughly what a glyph sheet costs to bake
      c.clearRect(0, 0, w, h);
      c.font = '900 ' + Math.max(12, Math.round(h / 5)) + 'px Impact, sans-serif';
      c.fillStyle = '#ffd84a'; c.strokeStyle = '#000'; c.lineWidth = 5;
      for (let i = 0; i < 12; i++) { const x = (i / 12) * w, y = h * 0.6; c.strokeText(String((seed + i) % 10), x, y); c.fillText(String((seed + i) % 10), x, y); }
    };
    const SIZES = [[256, 128], [512, 256], [1024, 512], [1300, 650]];
    const N = 12;
    const res = {};
    const POOL = document.createElement('canvas'); POOL.width = 2048; POOL.height = 2048;
    const PC = POOL.getContext('2d'); let poolY = 0;
    for (const [w, h] of SIZES) {
      const key = w + 'x' + h; res[key] = {};
      // mint: a new canvas every time
      { const t = [];
        for (let i = 0; i < N; i++) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; paint(cv.getContext('2d'), w, h, i);
          const t0 = performance.now(); ctx.drawImage(cv, 0, 0); t.push(performance.now() - t0); await sleep(16); }
        res[key].mint = { med: med(t), max: mx(t) }; }
      // rebake: one canvas, rewritten each time
      { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); const t = [];
        for (let i = 0; i < N; i++) { paint(c, w, h, i);
          const t0 = performance.now(); ctx.drawImage(cv, 0, 0); t.push(performance.now() - t0); await sleep(16); }
        res[key].rebake = { med: med(t), max: mx(t) }; }
      // warm: one canvas, written once, drawn many times
      { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; paint(cv.getContext('2d'), w, h, 3); const t = [];
        ctx.drawImage(cv, 0, 0); await sleep(16);
        for (let i = 0; i < N; i++) { const t0 = performance.now(); ctx.drawImage(cv, 0, 0); t.push(performance.now() - t0); await sleep(16); }
        res[key].warm = { med: med(t), max: mx(t) }; }
      // pool: one big canvas, a fresh shelf written each time, blit that shelf
      { const t = []; const rects = [];
        for (let i = 0; i < N; i++) {
          if (poolY + h > POOL.height) poolY = 0;
          const y = poolY; poolY += h;
          PC.save(); PC.translate(0, y); PC.beginPath(); PC.rect(0, 0, w, h); PC.clip(); paint(PC, w, h, i); PC.restore();
          rects.push([y, w, h]);
          const t0 = performance.now(); ctx.drawImage(POOL, 0, y, w, h, 0, 0, w, h); t.push(performance.now() - t0); await sleep(16);
        }
        res[key].pool = { med: med(t), max: mx(t) };
        // poolw: the same rects again, nothing written in between
        const t2 = []; await sleep(32);
        for (const [y, ww, hh] of rects) { const t0 = performance.now(); ctx.drawImage(POOL, 0, y, ww, hh, 0, 0, ww, hh); t2.push(performance.now() - t0); await sleep(16); }
        res[key].poolw = { med: med(t2), max: mx(t2) };
        // poolmix: ONE shelf written, then ten blits with no frame in between - what a fight does, and the case
        // that comes closest to a pooled atlas. Note it still measures cheap here while the same idea measured
        // dear in the game (see the header) - so this is a floor, not a verdict.
        const t3 = [];
        for (let i = 0; i < N; i++) {
          if (poolY + h > POOL.height) poolY = 0;
          const y2 = poolY; poolY += h;
          PC.save(); PC.translate(0, y2); PC.beginPath(); PC.rect(0, 0, w, h); PC.clip(); paint(PC, w, h, i + 7); PC.restore();
          for (const [ry, rw, rh] of rects.slice(0, 10)) { const t0 = performance.now(); ctx.drawImage(POOL, 0, ry, rw, rh, 0, 0, rw, rh); t3.push(performance.now() - t0); }
          await sleep(16);
        }
        res[key].poolmix = { med: med(t3), max: mx(t3) };
      }
    }
    return res;
  });
  console.log('drawImage cost, ms [median / max] — game page, its own visible canvas');
  console.log('size'.padEnd(11) + ['mint', 'rebake', 'warm', 'pool', 'poolw', 'poolmix'].map((s) => s.padStart(16)).join(''));
  for (const [k, v] of Object.entries(out)) {
    console.log(k.padEnd(11) + ['mint', 'rebake', 'warm', 'pool', 'poolw', 'poolmix'].map((c) => (v[c].med + '/' + v[c].max).padStart(16)).join(''));
  }
} catch (e) { console.log('FATAL', String(e.stack || e).split('\n').slice(0, 3).join(' | ')); }
await browser.close().catch(() => {}); server.kill();
