// The world map (W) wears its painted plate - early, on the web build, and never a see-through placeholder.
//
// Per user: "when i press W the world map background image does not seem to load and I just see nodes and a transluscent
// circle in the middle". Three pages, each booted as a player boots (the image hold on):
//   1. early: W opened straight after the title finds the plate already asked for (it was queued behind ~290 sprites);
//   2. web build: the deploy rewrites the backgrounds folder to jsDelivr, a cross-origin host that answers CORS. Here the
//      plate's path is rewritten to another origin (127.0.0.1) served with Access-Control-Allow-Origin, as jsDelivr does:
//      the map must draw the painting - before, the plate tainted the raster canvas and was dropped for the session;
//   3. placeholder: with the plate unreachable, the backdrop's middle is opaque (it was see-through: the game showed
//      through the vignette's clear centre - the "translucent circle").
// The build before fails all three.   node scripts/worldmap_plate_load_test.mjs   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync, readFileSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11747), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [], PLATE = 'backgrounds/worldmap_bg_v8.webp', CDN = `http://127.0.0.1:${PORT}/cdn/`;
const plateBytes = readFileSync(path.join(SERVE_ROOT, PLATE));
// boot a page; mode: 'plain' | 'cdn' (the plate path rewritten to a CORS-answering second origin) | 'blocked' (the plate unreachable)
const boot = async (mode) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  if (mode === 'cdn') {
    await page.route(`**/${FILE}*`, async (route) => { const r = await route.fetch(); const body = (await r.text()).split(`'${PLATE}'`).join(`'${CDN}${PLATE}'`); await route.fulfill({ response: r, body }); });
    await page.route(`${CDN}**`, (route) => route.fulfill({ status: 200, body: plateBytes, headers: { 'content-type': 'image/webp', 'access-control-allow-origin': '*' } }));
  }
  if (mode === 'blocked') await page.route(`**/${PLATE}*`, (route) => route.abort());
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof toggleWorldMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  return { ctx, page };
};
const enterAndOpen = (page) => page.evaluate(async () => {
  try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  if (!player.cls) { applyClass('warrior'); player.level = 30; }
  player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
  loadMap('town', 400); await new Promise((r) => setTimeout(r, 800));
  toggleWorldMap();
  return { heldAtOpen: _wmPlate._lxHeldSrc != null, readyAtOpen: !!_wmPlate._lxReady };
});
// the map's backdrop raster: is it drawn from the plate, and how opaque is its middle
const backdrop = (page) => page.evaluate(async () => {
  const bg = document.querySelector('[data-wm-diagram="1"] [data-wm-bg="1"]'), href = bg ? bg.getAttribute('href') || '' : '';
  const out = { ready: !!_wmPlate._lxReady, tainted: _wmPlateTainted, hrefLen: href.length, centreAlpha: -1 };
  if (href.startsWith('data:')) {
    const im = new Image(); await new Promise((r) => { im.onload = r; im.onerror = r; im.src = href; });
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    out.centreAlpha = g.getImageData(c.width >> 1, c.height >> 1, 1, 1).data[3];
  }
  return out;
});
try {
  // 1. early
  { const { ctx, page } = await boot('plain'); const o = await enterAndOpen(page); await ctx.close();
    ok('W opened straight after the title finds the plate already asked for, not queued behind the sprites', o.heldAtOpen === false, o); }
  // 2. web build: the plate from a second origin that answers CORS, as jsDelivr does
  { const { ctx, page } = await boot('cdn'); await enterAndOpen(page);
    await page.waitForFunction(() => _wmPlate._lxReady || _wmPlateTainted, null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(600); await page.evaluate(() => { toggleWorldMap(); toggleWorldMap(); });   // close and open: a fresh raster
    await page.waitForTimeout(600); const b = await backdrop(page); const src = await page.evaluate(() => _wmPlate.src); await ctx.close();
    ok('web build (plate on a CORS host): the map draws the painting, the canvas is not tainted', b.ready && b.tainted === false && src.indexOf('127.0.0.1') >= 0, { ...b, src: src.slice(0, 60) }); }
  // 3. placeholder: the plate unreachable
  { const { ctx, page } = await boot('blocked'); await enterAndOpen(page); await page.waitForTimeout(1500); const b = await backdrop(page); await ctx.close();
    ok("the placeholder backdrop's middle is opaque (the game no longer shows through it)", b.ready === false && b.centreAlpha === 255, b); }
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
