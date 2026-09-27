#!/usr/bin/env node
// v0.30.1302: the sky gradient is not painted under an opaque backdrop that covers the screen - a whole screen of GPU fill a
// frame on every backdrop map, 1 of the 5.4-12.4 screens a live boss fight paints (fill probe, High, 1080p). This checks
// that it is skipped where nothing shows it, that the picture does not change by one pixel (drawBackground is rendered
// twice in one task, with and without window._lxNoFillSkip, and the two canvases are compared - at camera positions that
// put the mirror seam between device pixels), and that the maps whose picture IS the sky keep it.
//   node scripts/bg_fill_skip_test.mjs      MOJI_GAME_FILE / PORT
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10611);
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
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof drawBackground === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(5000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'archer'; player.job = 'sniper'; player._god = true; player.level = 70;
    const o = { ver: GAME_VERSION, maps: {} };
    // drawBackground on its own, as the frame calls it (base transform, cleared canvas), counting full-screen fillRects
    const render = (noSkip) => {
      window._lxNoFillSkip = noSkip;
      const P = CanvasRenderingContext2D.prototype, fr = P.fillRect; let full = 0;
      P.fillRect = function (x, y, w, h) { if (this === ctx && w >= W && h >= H) full++; return fr.apply(this, arguments); };
      try {
        ctx.setTransform(_LX_DPR, 0, 0, _LX_DPR, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(-30, -30, W + 60, H + 60);
        drawBackground();
      } finally { P.fillRect = fr; window._lxNoFillSkip = false; }
      const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(canvas, 0, 0);
      return { full, hidden: !!_LX_SKY.hidden, px: x.getImageData(0, 0, c.width, c.height).data };
    };
    const compare = (a, b) => { let diff = 0, max = 0; for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); if (d > max) max = d; if (d > 1) diff++; } return { diff, max }; };
    for (const id of ['forest', 'krookThrone', 'void']) {
      loadMap(id, 300); await sleep(1500);
      for (const ov of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(ov); if (e && e.classList.contains('on')) e.classList.remove('on'); }
      for (let i = 0; i < 100 && id !== 'void' && !_pickBGImage(); i++) await sleep(200);
      const m = { pick: !!_pickBGImage(), runs: [] };
      // camera positions chosen so the parallax shift puts the mirror seam at fractional device pixels
      for (const cx of [0, 1333, 2777, 4901]) {
        game.camera.x = cx;
        const a = render(false), b = render(true);
        const c = compare(a.px, b.px);
        m.runs.push({ cx, hidden: a.hidden, skipFull: a.full, fullFull: b.full, diff: c.diff, max: c.max, seam: (W - Math.floor((cx * 0.12) % W)) * _LX_DPR });
      }
      o.maps[id] = m;
    }
    // the plate test itself
    const mk = (hole) => { const c = document.createElement('canvas'); c.width = 400; c.height = 225; const x = c.getContext('2d'); x.fillStyle = '#3a6'; x.fillRect(0, 0, 400, 225); if (hole) x.clearRect(120, 60, 60, 40); return c; };
    o.opaquePlate = _lxBgOpaque(mk(false)); o.holePlate = _lxBgOpaque(mk(true));
    return o;
  });
  console.log(`build ${r.ver}`);
  for (const [id, m] of Object.entries(r.maps)) for (const x of m.runs) console.log(`  ${id} cam ${x.cx}: hidden ${x.hidden}, full-screen fills ${x.skipFull} (was ${x.fullFull}), ${x.diff} px differ (max ${x.max}), seam at device x ${x.seam.toFixed(2)}`);
  const F = r.maps.forest.runs, K = r.maps.krookThrone.runs, V = r.maps.void.runs;
  ok('a combat map skips the sky: its opaque backdrop covers it', r.maps.forest.pick && F.every((x) => x.hidden && x.skipFull === x.fullFull - 1), F.map((x) => x.skipFull + '/' + x.fullFull).join(' '));
  ok('...and the picture is identical, mirror seam included', F.every((x) => x.diff === 0), F.map((x) => x.diff + ' px, max ' + x.max).join(' | '));
  ok('a boss arena skips it too, identically', r.maps.krookThrone.pick && K.every((x) => x.hidden && x.skipFull === x.fullFull - 1 && x.diff === 0), K.map((x) => x.skipFull + '/' + x.fullFull + ' ' + x.diff + 'px').join(' | '));
  // (the void's pixels are not compared: its sky video can step to a new frame between the two renders)
  ok('the void keeps its sky (the sky IS its picture)', V.every((x) => !x.hidden && x.skipFull === 1 && x.fullFull === 1), V.map((x) => x.skipFull + '/' + x.fullFull).join(' '));
  ok('a plate with a see-through hole keeps the sky under it', r.opaquePlate === true && r.holePlate === false, `opaque ${r.opaquePlate}, holed ${r.holePlate}`);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
