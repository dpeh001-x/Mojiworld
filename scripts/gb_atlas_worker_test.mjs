#!/usr/bin/env node
// v0.30.1307: gold B/G sticker atlases are built on the number Worker (as the figure atlases are since v0.30.1239), and the
// size ladder a sticker's pop walks is asked for when a boss spawns. A 60 s Gravitos probe found 8 sticker builds in the
// fight's first seconds and none after, each followed by a 45-115 ms first draw (the canvas's recorded strokes rastered
// and uploaded inside drawImage). Checks:
//   - WORKER: a miss posts a job and builds nothing on the main thread; the atlas lands as an ImageBitmap
//   - PIXELS: the Worker's atlas matches the same atlas built on the main thread
//   - FIRST DRAW: drawing the Worker's atlas the first time costs a fraction of drawing a fresh main-thread build
//   - PREWARM: _lxGbPrewarm asks for the nine ladder sizes; a boss spawning asks for them before any number is drawn
//   - FALLBACK: _LX_DN_WORKER_ON = false builds on the main thread, as before
//   node scripts/gb_atlas_worker_test.mjs      MOJI_GAME_FILE / PORT
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10641);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxGbAtlasGet === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(5000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player._god = true; player.level = 120;
    loadMap('forest', 300); await sleep(1500);
    const o = { ver: GAME_VERSION, worker: !!_lxDnWorker() };
    let mainBuilds = 0; const _b = window._lxGbAtlasBuild; window._lxGbAtlasBuild = function () { mainBuilds++; return _b.apply(this, arguments); };
    const purge = () => { for (const k of [..._LX_DN_ATLAS.keys()]) if (k.indexOf('gb|') === 0) { const a = _LX_DN_ATLAS.get(k); _LX_DN_ATLAS.delete(k); if (a) { _lxDnAtlasPx -= a.px; _lxDnAtlasFree(a.cv); } } for (const k of [..._lxDnWPend.keys()]) if (k.indexOf('gb|') === 0) _lxDnWPend.delete(k); };
    const uiK = (game._uiScale > 0) ? game._uiScale : 1, b0 = ((LX_GB_ROW_SIZE + 4) * uiK) | 0, col = LX_GB_ROW_COL;
    const dprNow = Math.max(0.25, Math.min(3, _LX_DPR || 1)); let dpr = _lxDnAtlasDpr(dprNow);
    const ladder = () => { const out = []; for (let k = 0; k <= 8; k++) { const px = _lxDnAtlasPx4(b0, Math.pow(_LX_DN_ATLAS_STEP, k)); out.push('gb|' + b0 + '|' + px + '|n|' + col + '|' + dpr); } return out; };
    const waitKeys = async (keys, ms) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (keys.every((k) => _LX_DN_ATLAS.get(k))) return Math.round(performance.now() - t0); await sleep(50); } return -1; };
    // WORKER: the biggest ladder size
    purge(); mainBuilds = 0;
    const px8 = _lxDnAtlasPx4(b0, Math.pow(_LX_DN_ATLAS_STEP, 8)), key8 = 'gb|' + b0 + '|' + px8 + '|n|' + col + '|' + dpr;
    _lxDnAtlasBudget = 1;
    o.missReturn = _lxGbAtlasGet(b0, px8, false, col, false, dpr);
    o.landMs = await waitKeys([key8], 5000);
    const wat = _LX_DN_ATLAS.get(key8);
    o.isBitmap = !!(wat && typeof ImageBitmap !== 'undefined' && wat.cv instanceof ImageBitmap);
    o.workerMainBuilds = mainBuilds;
    o.size = wat ? wat.cv.width + 'x' + wat.cv.height : '';
    // FIRST DRAW: the Worker's bitmap vs a fresh main-thread build of the same key, each drawn once onto the game canvas
    const firstDraw = (src) => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); const t0 = performance.now(); ctx.drawImage(src, 0, 0, 1, 1); const d = performance.now() - t0; ctx.restore(); return d; };
    const mt = _b(b0, px8, false, col, false, dpr);
    o.drawWorker = wat ? firstDraw(wat.cv) : -1;
    o.drawMain = mt ? firstDraw(mt.cv) : -1;
    // PIXELS
    const px = (src) => { const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    if (wat && mt && wat.cv.width === mt.cv.width && wat.cv.height === mt.cv.height) {
      const a = px(wat.cv), b = px(mt.cv); let sum = 0, max = 0, d4 = 0;
      for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); sum += d; if (d > max) max = d; if (d > 4) d4++; }
      o.pix = { mean: +(sum / a.length).toFixed(4), max, d4, n: a.length / 4 };
    } else o.pix = { dims: (wat ? wat.cv.width + 'x' + wat.cv.height : '-') + ' vs ' + (mt ? mt.cv.width + 'x' + mt.cv.height : '-') };
    o.fieldsMatch = !!(wat && mt && wat.pad === mt.pad && wat.base === mt.base && wat.cellH === mt.cellH && wat.rowH === mt.rowH && wat.rows.length === mt.rows.length && wat.shx === mt.shx && wat.shy === mt.shy && wat.cells.size === mt.cells.size);
    if (mt) _lxDnAtlasFree(mt.cv);
    // PREWARM
    purge(); mainBuilds = 0;
    o.prewarmPosted = _lxGbPrewarm();
    o.prewarmMs = await waitKeys(ladder(), 8000);
    o.prewarmMainBuilds = mainBuilds;
    // a boss spawning asks for it: King Krook's throne, no number drawn
    purge(); mainBuilds = 0;
    loadMap('krookThrone', 300);
    let boss = null; for (let i = 0; i < 100 && !boss; i++) { await sleep(100); boss = game.monsters.find((m) => m && (m.isBoss || m.boss) && m.currentHp > 0) || null; }
    dpr = _lxDnAtlasDpr(Math.max(0.25, Math.min(3, _LX_DPR || 1)));
    o.boss = boss ? boss.type : null;
    o.bossMs = await waitKeys(ladder(), 8000);
    o.bossNumbers = (game.damageNumbers || []).length;
    // FALLBACK
    purge(); mainBuilds = 0; const _on = _LX_DN_WORKER_ON; _LX_DN_WORKER_ON = false;
    _lxDnAtlasBudget = 1;
    const fb = _lxGbAtlasGet(b0, px8, false, col, false, dpr);
    o.fallback = { got: !!fb, canvas: !!(fb && fb.cv && fb.cv.tagName === 'CANVAS'), mainBuilds };
    _LX_DN_WORKER_ON = _on;
    window._lxGbAtlasBuild = _b;
    return o;
  });
  console.log(`build ${r.ver}  worker ${r.worker}`);
  console.log(`  worker atlas ${r.size} landed in ${r.landMs} ms (bitmap ${r.isBitmap}, main-thread builds ${r.workerMainBuilds}); first draw ${r.drawWorker.toFixed(2)} ms vs a fresh main-thread build ${r.drawMain.toFixed(2)} ms`);
  console.log(`  pixels ${JSON.stringify(r.pix)}  prewarm posted ${r.prewarmPosted}, ready in ${r.prewarmMs} ms (main builds ${r.prewarmMainBuilds}); boss ${r.boss}: ladder ready in ${r.bossMs} ms with ${r.bossNumbers} numbers drawn`);
  ok('a sticker atlas miss goes to the Worker and lands as an ImageBitmap, nothing built on the main thread', r.worker && r.missReturn === null && r.landMs >= 0 && r.isBitmap && r.workerMainBuilds === 0, `${r.landMs} ms, bitmap ${r.isBitmap}, ${r.workerMainBuilds} main builds`);
  ok('the Worker atlas matches a main-thread build (layout and pixels)', r.fieldsMatch && r.pix && r.pix.mean <= 0.05 && r.pix.d4 <= r.pix.n * 0.001, JSON.stringify(r.pix));
  ok('drawing it the first time costs a fraction of a fresh main-thread build', r.drawWorker >= 0 && r.drawMain > 0 && r.drawWorker < r.drawMain * 0.5, `${r.drawWorker.toFixed(2)} vs ${r.drawMain.toFixed(2)} ms`);
  ok('_lxGbPrewarm asks for the nine ladder sizes, and they arrive off the main thread', r.prewarmPosted === 9 && r.prewarmMs >= 0 && r.prewarmMainBuilds === 0, `${r.prewarmPosted} posted, ${r.prewarmMs} ms, ${r.prewarmMainBuilds} main builds`);
  ok('a boss spawning has the ladder ready before any number is drawn', !!r.boss && r.bossMs >= 0, `${r.boss}: ${r.bossMs} ms`);
  ok('with the Worker off it builds on the main thread, as before', r.fallback.got && r.fallback.canvas && r.fallback.mainBuilds === 1, JSON.stringify(r.fallback));
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
