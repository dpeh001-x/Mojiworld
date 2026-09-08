// The minimap on TALL maps (v0.30.452). Per user, on the Clockwork Spire minimap: it "needs to be
// readjusted to look less stretched at the width", "you dont have to try fit everything in a tall
// map, it can be move as the players moves upwards", and "make sure all of the contents stay
// within the HUD".
//
// Everything here is measured off the REAL rendered canvas and the real DOM rects, never recomputed
// from the rule under test — an earlier draft re-derived the scales itself and therefore scored 7/8
// against the unfixed build, which is worth stating plainly: a test that restates the formula is an
// echo, not a check.
//   node scripts/minimap_tall_map_test.mjs      MOJI_GAME_FILE / MOJI_SERVE_ROOT / PORT override
// Negative control v0.30.451, which squashed the whole tower into the box: it paints the ground
// band at the canvas floor even with the player 4,400px above it (1,128 green px vs 0), inks ~18k
// pixels where this build inks ~460, and lets the canvas hang 12.9px out of the panel.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10281); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof drawMinimap === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const cv = document.getElementById('minimap-canvas');
    // Render the minimap with the player at a given height, then read the pixels back.
    const shoot = async (frac) => {
      const d = game.mapData;
      player.y = (d.worldHeight || 540) * frac; player.x = (d.worldWidth || 800) * 0.5;
      if (game.camera) game.camera.y = Math.max(0, player.y - 270);
      for (let i = 0; i < 3; i++) { try { drawMinimap(); } catch (e) {} await sleep(50); }
      const px = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let ink = 0, sig = ''; let bottomGreen = 0;
      for (let y = 0; y < cv.height; y++) {
        let n = 0;
        for (let x = 0; x < cv.width; x++) {
          const i = (y * cv.width + x) * 4;
          if (px[i + 3] > 16) { ink++; n++; }
        }
        if (y % 6 === 0) sig += (n > 2 ? '1' : '0');
      }
      // the ground band is the one green fill in this canvas
      for (let y = cv.height - 6; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
        const i = (y * cv.width + x) * 4;
        if (px[i + 3] > 16 && px[i + 1] > px[i] + 15 && px[i + 1] > px[i + 2] + 15) bottomGreen++;
      }
      return { ink, sig, bottomGreen };
    };
    const o = { ver: GAME_VERSION };
    loadMap('clockworkSpire', 300); await sleep(800);
    o.spireLow = await shoot(0.92);      // near the foot of the tower
    o.spireHigh = await shoot(0.06);     // near the summit, ~4,400px above the ground
    o.spireFoot = await shoot(0.995);    // standing ON the ground
    loadMap('frozenPeak', 300); await sleep(800);
    o.peakHigh = await shoot(0.05);
    // a wide map must be completely unaffected: it still draws its ground band at the floor
    loadMap('forest', 300); await sleep(800);
    o.forestLow = await shoot(0.90);
    o.forestHigh = await shoot(0.20);
    // containment, with the two-line title the Spire really produces
    loadMap('clockworkSpire', 300); await sleep(700);
    const nameEl = document.getElementById('minimap-name');
    if (nameEl) nameEl.textContent = 'Clockwork Spire — Ticket Pieces · F 12/40';
    await sleep(220);
    const pr = document.getElementById('minimap').getBoundingClientRect(), cr = cv.getBoundingClientRect();
    const tx = document.getElementById('taxi-btn'), tr = tx ? tx.getBoundingClientRect() : null;
    o.hud = { nameLines: Math.round(nameEl.getBoundingClientRect().height / 15.4),
      inside: cr.top >= pr.top - 1 && cr.bottom <= pr.bottom + 1 && cr.left >= pr.left - 1 && cr.right <= pr.right + 1,
      pastBottom: +(cr.bottom - pr.bottom).toFixed(1),
      inView: pr.top >= 0 && pr.bottom <= innerHeight + 1 && pr.right <= innerWidth + 1,
      taxiGap: tr ? +(pr.top - tr.bottom).toFixed(1) : null };
    return o;
  });
  console.log(`build ${r.ver}  spire ink low/high ${r.spireLow.ink}/${r.spireHigh.ink}  ground-at-summit ${r.spireHigh.bottomGreen}px`);
  ok('at the tower summit the minimap no longer paints the ground band at its floor', r.spireHigh.bottomGreen === 0 && r.peakHigh.bottomGreen === 0,
    `spire ${r.spireHigh.bottomGreen}px, peak ${r.peakHigh.bottomGreen}px green on the bottom rows`);
  ok('a tall map draws a WINDOW, not the whole tower crammed in', r.spireHigh.ink < 4000 && r.spireLow.ink < 8000,
    `ink low ${r.spireLow.ink}, high ${r.spireHigh.ink}`);
  ok('the window moves with the player up the tower', r.spireLow.sig !== r.spireHigh.sig && r.spireLow.ink > 0,
    `${r.spireLow.sig} -> ${r.spireHigh.sig}`);
  ok('standing on the ground, the ground band is still drawn', r.spireFoot.bottomGreen > 0, `${r.spireFoot.bottomGreen}px green`);
  ok('ordinary wide maps are untouched: ground band stays put at every height', r.forestLow.bottomGreen > 0 && r.forestHigh.bottomGreen > 0 && r.forestLow.sig === r.forestHigh.sig,
    `forest green ${r.forestLow.bottomGreen}/${r.forestHigh.bottomGreen}, sig stable ${r.forestLow.sig === r.forestHigh.sig}`);
  ok('with the real two-line map name the canvas stays INSIDE the panel', r.hud.nameLines >= 2 && r.hud.inside && r.hud.pastBottom <= 0,
    `lines ${r.hud.nameLines}, canvas vs panel bottom ${r.hud.pastBottom}px`);
  ok('the panel stays on screen and clear of the taxi button above it', r.hud.inView && r.hud.taxiGap !== null && r.hud.taxiGap > 0, `taxi gap ${r.hud.taxiGap}px`);
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
