// wide-view (per user: "look into removing the side bars", then "always on touch devices"). A touch device's logical view is as
// wide as its screen's landscape shape (W = 560 x aspect, 960..1280), so a wide phone fills its screen; GAMEPLAY reads a 960
// play window that moves like a desktop camera, so phones see more but never reach further. Emulated Android phone (screen
// 915 x 412, i.e. fullscreen) and a desktop window:
//   1. the phone's view is 1244 wide and the game box fills the screen (no side bars); the desktop stays 960, untouched
//   2. the top-left HUD starts clear of the phone's corner buttons
//   3. a mirrored backdrop is baked at its own aspect (covers the view, never stretched); a narrow map (Azure Abode, 1100) is
//      centred
//   4. gameplay parity: the play window follows the player exactly as a 960 camera (centred, clamped, inside the view); the
//      gameplay readers use W_PLAY; no decor cull keeps a 960 right edge; on the desktop the play window IS the camera
//   5. no page errors
// The build before fails 1-4.   node scripts/wide_view_test.mjs      PORT / MOJI_GAME_FILE override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11893), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const env = { ...process.env }; if (FILE !== 'mojiworld_game.html') env.MOJI_GAME_FILE = FILE; else delete env.MOJI_GAME_FILE;   // served AT /mojiworld_game.html
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 320) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
const errs = [];
const open = async (phone) => {
  const ctx = await browser.newContext(phone ? { serviceWorkers: 'block', viewport: { width: 915, height: 412 }, screen: { width: 915, height: 412 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA } : { serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 }); await page.waitForTimeout(2500);
  await page.evaluate(async () => { try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { for (const k of Object.keys(STORY_BEATS || {})) player._storyBeatsSeen[k] = true; } catch (e) {} player._tutorialSeen = true; applyClass('warrior'); player.level = 30; try { closeAllModals(); } catch (e) {}
    game.visitedMaps = game.visitedMaps || {}; game.visitedMaps.forest = true; loadMap('forest', 900); await new Promise((r) => setTimeout(r, 3000)); window.dispatchEvent(new Event('resize')); await new Promise((r) => setTimeout(r, 900)); });
  return { ctx, page };
};
// how the play window sits once a still player has let it settle (vx 0: no look-ahead), at three spots along the map
const parity = (page) => page.evaluate(async () => {
  const out = [], ww = game.mapData.worldWidth;
  for (const px of [700, 1600, ww - 300]) {
    player.x = px; player.vx = 0; game.playCamX = null; game.camera.x = Math.max(0, Math.min(ww - W, px - W / 2));
    for (let i = 0; i < 200; i++) updateCamera();
    const pc = _lxPlayCamX(), want = Math.max(0, Math.min(ww - W_PLAY, player.x + player.w / 2 - W_PLAY / 2));
    out.push({ px, pc: Math.round(pc), want: Math.round(want), cam: Math.round(game.camera.x), inView: pc >= game.camera.x - 0.5 && pc + W_PLAY <= game.camera.x + W + 0.5 });
  }
  return out;
});
try {
  { const { ctx, page } = await open(true);
    const P = await page.evaluate(async () => {
      const wr = document.querySelector('.game-wrapper').getBoundingClientRect(), hud = document.getElementById('top-ui').getBoundingClientRect();
      const hit = (a, b) => !!(a && b && b.width && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom);
      const corner = ['mobile-mode-btn', 'mobile-ctrl-toggle'].map((id) => { const e = document.getElementById(id); return e && e.getClientRects().length ? e.getBoundingClientRect() : null; }).filter(Boolean);
      const img = BG_IMAGES[game.mapData.bg], bake = img && img._lxBgS, key = bake && bake._lxKey, kd = key ? key.split('x').map(Number) : null;
      const src = { gameplay: ['_lxSkyLanceApex', '_lxMemoryView', '_lxEclipseTick'].map((f) => typeof window[f] === 'function' && window[f].toString().includes('W_PLAY')),
        culls: [...document.scripts].some((s) => /sxw > 1[01]\d\d\)/.test(s.textContent)) };
      return { W, wide: document.documentElement.classList.contains('lx-wide'), wrap: [Math.round(wr.left), Math.round(wr.width), Math.round(wr.height)], vw: innerWidth,
        hudClear: corner.length > 0 && corner.every((c) => !hit(hud, c)), hudLeft: Math.round(hud.left), bake: kd, natAsp: img && +(img.naturalWidth / img.naturalHeight).toFixed(3), src };
    });
    ok('1. a 915 x 412 touch phone gets a 1244-wide view and the game box fills its screen - no side bars', P.W === 1244 && P.wide && Math.abs(P.wrap[0]) <= 2 && Math.abs(P.wrap[1] - P.vw) <= 3, P);
    ok('2. the top-left HUD starts clear of the touch-mode and hide-controls corner buttons', P.hudClear, { hudLeft: P.hudLeft });
    ok('3. the forest backdrop is baked at its own aspect (it covers the wide view, never stretched)', !!P.bake && Math.abs(P.bake[0] / P.bake[1] - P.natAsp) < 0.02, { bake: P.bake, natAsp: P.natAsp });
    const N = await page.evaluate(async () => { game.visitedMaps.azureAbode = true; loadMap('azureAbode', 500); await new Promise((r) => setTimeout(r, 1500)); for (let i = 0; i < 30; i++) updateCamera(); return { ww: game.mapData.worldWidth, cam: game.camera.x }; });
    ok('3. a map narrower than the view (Azure Abode) is centred in it', N.ww < 1244 && Math.abs(N.cam - (N.ww - 1244) / 2) < 1, N);
    await page.evaluate(async () => { loadMap('forest', 900); await new Promise((r) => setTimeout(r, 1500)); });
    const Q = await parity(page);
    ok('4. the play window follows the player exactly as a 960 camera would (centred, clamped) and sits inside the view', Q.every((q) => Math.abs(q.pc - q.want) <= 2 && q.inView), Q);
    ok('4. the gameplay readers use the 960 play width and no decor cull keeps a 960 right edge', P.src.gameplay.every(Boolean) && !P.src.culls, P.src);
    await ctx.close(); }
  { const { ctx, page } = await open(false);
    const D = await page.evaluate(() => ({ W, wide: document.documentElement.classList.contains('lx-wide'), box: document.querySelector('.game-wrapper').offsetWidth, cover: typeof _lxWideCover === 'function' ? _lxWideCover(1.78, 960, 560) : 'missing' }));
    ok('1. the desktop keeps its 960 view and box, and no cover sizing applies', D.W === 960 && !D.wide && D.box === 960 && D.cover === null, D);
    const Q = await parity(page);
    ok('4. on the desktop the play window IS the camera', Q.every((q) => q.pc === q.cam), Q);
    await ctx.close(); }
  ok('5. no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
