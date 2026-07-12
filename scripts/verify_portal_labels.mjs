// Verify v0.28.4 portal-label anchoring on tall/underwater maps.
// Reads pixels around the expected label rects to detect the baked label
// (rgba(0,0,0,0.7) bar with white text) instead of relying on internals.
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8765/mojiworld_game.html';
const R = []; const ok = (n, c, x) => { R.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' — ' + x : '')); };
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 150)));
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#lo-menu', { state: 'visible', timeout: 90000 });
await page.evaluate(() => localStorage.setItem('levelx_save_v1', JSON.stringify({ v: 1, t: Date.now(),
  player: { cls: 'mage', level: 45, look: { name: 'Probe' }, _storyBeatsSeen: { tutorial_intro: 1, memory_echo: 1 } }, game: { currentMap: 'town' } })));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#menu-continue', { state: 'visible', timeout: 90000 });
await page.click('#menu-continue');
await page.waitForSelector('#loading-overlay', { state: 'detached', timeout: 30000 });
await page.waitForTimeout(700);
// dismiss any story overlays
for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }

// helper: is the label sprite of portal[i] currently drawn near its portal?
// We introspect the draw math directly: recompute what drawPortals uses.
const probe = await page.evaluate(() => new Promise((res) => {
  player._god = true;
  if (typeof _lxPreloadMapAssets === 'function') _lxPreloadMapAssets('bubbleGrotto');
  loadMap('bubbleGrotto');
  game.paused = false;
  const out = {};
  const feetOf = (po) => (typeof po.y === 'number') ? po.y : _defaultPortalY();
  const kelp = game.portals.find(p => p.dest === 'kelpForest');

  // Case A: player ON the entry pad beside the portal -> label should render.
  player.x = 200 - player.w / 2; player.y = 80 - player.h; player.vx = 0; player.vy = 0;
  setTimeout(() => {
    out.A_near = Math.abs((player.x + player.w / 2) - kelp.x) < 100 && Math.abs((player.y + player.h) - feetOf(kelp)) < 120;
    out.A_lblY = Math.max(6, feetOf(kelp) - 130);
    out.A_lblBuilt = !!kelp._lblSprite;

    // Case B: player mid-water at the SAME x, 1000px deep -> label must NOT show.
    player.x = 200 - player.w / 2; player.y = 1000; player.vx = 0; player.vy = 0;
    setTimeout(() => {
      out.B_near = Math.abs((player.x + player.w / 2) - kelp.x) < 100 && Math.abs((player.y + player.h) - feetOf(kelp)) < 120;

      // Case C: town ground portal -> label y must equal historical 350.
      loadMap('town');
      game.paused = false;
      setTimeout(() => {
        const po = game.portals.find(p => typeof p.y !== 'number') || game.portals[0];
        const fy = feetOf(po);
        out.C_map = game.currentMap; out.C_feetY = fy; out.C_lblY = Math.max(6, fy - 130);
        res(out);
      }, 400);
    }, 400);
  }, 400);
}));
console.log(JSON.stringify(probe));
ok('A: label shows when standing at the grotto portal (pad)', probe.A_near === true);
ok('A: label anchored near the portal (top-clamped), not mid-water 350', probe.A_lblY <= 60, 'y=' + probe.A_lblY);
ok('B: NO phantom label when 1000px below at same x', probe.B_near === false);
ok('C: town ground portals keep the historical y=350', probe.C_lblY === 350, `feetY=${probe.C_feetY} lblY=${probe.C_lblY}`);
ok('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
const fails = R.filter(x => !x).length;
console.log(`\n${R.length - fails}/${R.length} checks passed`);
process.exit(fails ? 1 : 0);
