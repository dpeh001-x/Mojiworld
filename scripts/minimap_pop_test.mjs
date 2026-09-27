// The minimap, pop punk funk (final polish, minimap-pop). Per user: "redesigning the minimap to look slightly more pop punk funk
// style, ensure AAA grade". Held: an inked plum panel with a hard drop; the map's name on a berry sticker tag; a round yellow
// sticker minimise button; an inked striped plum screen; and on the canvas itself cream platforms with an ink keyline, a mint
// floor with an ink edge, and a butter camera box - while the symbol shapes stay (minimap_symbols_test owns those).
//   node scripts/minimap_pop_test.mjs [page.html] [port]    (MOJI_GAME_FILE / this repo's game by default)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || 9948);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ ...(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : { channel: 'msedge' }), headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof drawMinimap === 'function' && typeof loadMap === 'function', null, { timeout: 180000 });
await page.waitForTimeout(3000);
const r = await page.evaluate(async () => {
  for (const x of ['loading-overlay', 'class-select-modal']) { const o = document.getElementById(x); if (o) o.style.display = 'none'; }
  window._prologueActive = false; loadMap('town'); await new Promise((res) => setTimeout(res, 1500));
  game.paused = false; drawMinimap();
  const q = (s) => getComputedStyle(document.querySelector(s));
  const mm = q('#minimap'), nm = q('#minimap-name'), mb = q('#minimap-min'), cv = q('#minimap-canvas');
  const c = document.getElementById('minimap-canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let cream = 0, ink = 0, mint = 0, butter = 0;
  for (let i = 0; i < d.length; i += 4) {
    const R = d[i], G = d[i + 1], B = d[i + 2], A = d[i + 3]; if (A < 150) continue;   // the floor is drawn 78% opaque
    if (R > 235 && G > 225 && B > 245) cream++;
    else if (R < 30 && G < 30 && B < 40) ink++;
    else if (G > 150 && G > R + 50 && G > B + 10) mint++;
    else if (R > 230 && G > 200 && B < 150) butter++;
  }
  return { panelBg: mm.backgroundImage.slice(0, 40), panelBorder: mm.borderTopWidth + ' ' + mm.borderTopColor, panelDrop: mm.boxShadow,
    tagBg: nm.backgroundImage.slice(0, 40), tagBorder: nm.borderTopColor, tagRot: nm.transform, tagFill: nm.color,
    btnBg: mb.backgroundColor, btnRadius: mb.borderTopLeftRadius, btnBorder: mb.borderTopColor,
    screenBorder: cv.borderTopWidth + ' ' + cv.borderTopColor, stripes: /repeating-linear-gradient/.test(cv.backgroundImage),
    px: { cream, ink, mint, butter } };
});
await browser.close(); server.kill();
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}  ${c ? '' : JSON.stringify(x).slice(0, 260)}`); };
ok('the panel is an inked plum plate with a hard drop', /linear-gradient/.test(r.panelBg) && /rgb\(13, 10, 20\)/.test(r.panelBorder) && parseFloat(r.panelBorder) >= 2 && /rgb\(13, 10, 20\) 4px 4px 0px/.test(r.panelDrop), r);
ok("the map's name is a berry sticker tag with an ink edge, tilted", /linear-gradient/.test(r.tagBg) && r.tagBorder === 'rgb(13, 10, 20)' && r.tagRot !== 'none' && r.tagFill === 'rgb(255, 224, 122)', r);
ok('the minimise button is a round yellow sticker', r.btnBg === 'rgb(255, 224, 122)' && r.btnRadius === '50%' && r.btnBorder === 'rgb(13, 10, 20)', r);
ok('the map sits on an inked, striped screen (stripes, not dots)', /rgb\(13, 10, 20\)/.test(r.screenBorder) && r.stripes, r);
ok('on the canvas: cream platforms with an ink keyline', r.px.cream > 150 && r.px.ink > 300, r.px);
ok('on the canvas: a mint floor', r.px.mint > 2000, r.px);
ok('on the canvas: a butter camera box', r.px.butter > 150, r.px);
ok('no page errors', errs.length === 0, errs.slice(0, 3));
console.log(fails ? `FAIL(${fails})` : 'ALL PASS');
process.exit(fails ? 1 : 0);
