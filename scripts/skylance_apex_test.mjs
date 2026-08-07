// v0.29.477 — Sky Lance must rise to the top platform CURRENTLY VISIBLE.
//
// The old lift was `Math.max(20, player.y - 200)`: a blind 200px hop whose
// clamp was y=20, the top of the WORLD. On a vertical tower that could fling
// the Dragoon thousands of pixels above the camera.
//
//   node serve.js 8845 && node scripts/skylance_apex_test.mjs 8845 [page]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8845';
const PAGE = process.argv[3] || 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('_lxSkyLanceApexY') === 'function'; } catch { return false; } }, null, { timeout: 180000 });

const r = await page.evaluate(() => {
  const g = eval('game'), P = eval('player'), apex = eval('_lxSkyLanceApexY');
  const VW = eval('W'), VH = eval('H');          // not W/H — TDZ shadowing
  const saved = { mapData: g.mapData, camX: g.camera.x, camY: g.camera.y, x: P.x, y: P.y, h: P.h };
  P.h = 44; P.w = 28;
  const setup = (platforms, camY, playerY, playerX) => {
    g.mapData = { platforms, worldWidth: 4000, worldHeight: camY + VH + 4000 };
    g.camera.x = 0; g.camera.y = camY;
    P.x = playerX == null ? 400 : playerX; P.y = playerY;
    return apex();
  };
  const out = {};

  // 1. Flat map, three stacked platforms, all on screen — take the topmost.
  out.stacked = setup([
    { type: 'ground', x: 0, y: 500, w: 4000, h: 40 },
    { type: 'platform', x: 300, y: 380, w: 300, h: 12 },
    { type: 'platform', x: 300, y: 200, w: 300, h: 12 },   // topmost visible
    { type: 'platform', x: 300, y: 120, w: 300, h: 12 },   // ALSO visible, higher
  ], 0, 460);

  // 2. A platform ABOVE the viewport must be ignored (camera scrolled down).
  out.offscreenIgnored = setup([
    { type: 'ground', x: 0, y: 2500, w: 4000, h: 40 },
    { type: 'platform', x: 300, y: 2300, w: 300, h: 12 },  // visible
    { type: 'platform', x: 300, y: 100, w: 300, h: 12 },   // WAY above the camera
  ], 2000, 2460);

  // 3. Nothing above on screen -> the old 200px hop, but clamped to the
  //    VISIBLE top, never the world top.
  out.noPlatform = setup([{ type: 'ground', x: 0, y: 2500, w: 4000, h: 40 }], 2000, 2460);

  // 4. A tower: the clamp must be the camera edge, not y=20.
  out.towerClamp = setup([{ type: 'ground', x: 0, y: 14070, w: 4000, h: 40 }], 13600, 14020);

  // 5. Prefer a platform actually over the player's centre.
  out.overheadPreferred = setup([
    { type: 'ground', x: 0, y: 500, w: 4000, h: 40 },
    { type: 'platform', x: 0,    y: 150, w: 100, h: 12 },  // higher, far left, NOT over us
    { type: 'platform', x: 350,  y: 260, w: 200, h: 12 },  // over the player at x=400
  ], 0, 460, 400);

  g.mapData = saved.mapData; g.camera.x = saved.camX; g.camera.y = saved.camY;
  P.x = saved.x; P.y = saved.y; P.h = saved.h;
  return { ...out, VH };
});

ok('rises to the TOPMOST visible platform when several are stacked',
   r.stacked === 120 - 44, { apex: r.stacked, expected: 120 - 44 });
ok('ignores a platform above the viewport (camera scrolled down)',
   r.offscreenIgnored === 2300 - 44, { apex: r.offscreenIgnored, expected: 2300 - 44 });
ok('with nothing above on screen, falls back to the 200px hop',
   r.noPlatform === 2460 - 200, { apex: r.noPlatform, expected: 2460 - 200 });
ok('NEVER rises above the visible top edge (the old y=20 world clamp is gone)',
   r.towerClamp >= 13600, { apex: r.towerClamp, cameraTop: 13600 });
ok('on a tower it stays on camera rather than flying to y=20',
   r.towerClamp > 13000, { apex: r.towerClamp });
ok('prefers a platform over the player rather than a higher one off to the side',
   r.overheadPreferred === 260 - 44, { apex: r.overheadPreferred, expected: 260 - 44 });

const src = await page.evaluate(() => {
  const s = [...document.querySelectorAll('script')].map(x => x.textContent).join('\n');
  return {
    lifts: (s.match(/player\.y = _lxSkyLanceApexY\(\);/g) || []).length,
    oldGone: !/player\.y = Math\.max\(20, player\.y - 200\);/.test(s),
    mapClear: /player\.dragoonSlam = 0;\s+\/\/ v0\.29\.477/.test(s),
  };
});
ok('all three dive sites use the apex helper', src.lifts === 3, src);
ok('the old world-clamped hop is gone', src.oldGone, src);
ok('dragoonSlam is cleared on map load (no falling through the next map)', src.mapClear, src);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
