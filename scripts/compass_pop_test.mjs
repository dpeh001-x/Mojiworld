// The quest compass's off-screen pointer is the pop badge (per user: "this can be better stylised", then "yes ship this"). Through
// the real _qnavDrawCompass in town, with a tracked destination stubbed at Bravo's x:
//   - target off screen to the right: the badge is drawn, pointing right, with the distance from the hero
//   - its pixels are the pop look: gold fill and the ink outline at the right edge, where the flat triangle was a single yellow
//   - target off screen to the left: it points left
//   - target on screen: no badge (the map pin takes over)
// node scripts/compass_pop_test.mjs   (MOJI_GAME_FILE / PORT override)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11996), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 300) + ']' : '')); };
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 960, height: 560 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await p.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof _qnavDrawCompass === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await p.waitForTimeout(4000);
  const R = await p.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    if (!player.cls) applyClass('warrior'); player._god = true; player._tutorialSeen = true;
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    game.paused = false; loadMap('town'); await sleep(2500); game.hitStop = 1e9; await sleep(200);
    const calls = []; const has = typeof _lxQcBadge === 'function';
    if (has) { const o = _lxQcBadge; window._lxQcBadge = function (c, ex, ey, dir, nudge, far, t) { calls.push({ ex: Math.round(ex), dir, far }); return o.apply(this, arguments); }; }
    const origDest = window._qnavLiveDest; game.qnav = 'probe';
    const cv = document.getElementById('game'), c = cv.getContext('2d');
    const run = (heroX, targetX) => {
      player.x = heroX; game.camera.x = Math.max(0, heroX - 480);
      window._qnavLiveDest = () => ({ map: 'town', kind: 'npc', who: 'Bravo', x: targetX });
      calls.length = 0; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#3a6a9a'; c.fillRect(0, 0, cv.width, cv.height); c.restore();
      _qnavDrawCompass();
      // sample the edge strip the pointer occupies: count ink (near-black) and gold pixels
      const right = targetX > heroX, x0 = right ? cv.width - 60 : 0, d = c.getImageData(x0, 0, 60, cv.height).data; let ink = 0, gold = 0;
      for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], b = d[i + 2]; if (r < 30 && g < 30 && b < 40) ink++; else if (r > 230 && g > 170 && b < 120) gold++; }
      return { calls: calls.slice(), ink, gold, camX: game.camera.x };
    };
    const offR = run(200, 2470), offL = run(2400, 300), on = run(1000, 1100);
    window._qnavLiveDest = origDest; game.qnav = null;
    return { has, offR, offL, on };
  });
  ok('the pop badge painter exists', R.has);
  ok('target off screen right: the badge is drawn pointing right, with the distance from the hero', R.offR.calls.length === 1 && R.offR.calls[0].dir === 1 && R.offR.calls[0].far === 2270, R.offR.calls);
  ok('its pixels are the pop look: gold fill and an ink outline at the edge', R.offR.gold > 150 && R.offR.ink > 80, { gold: R.offR.gold, ink: R.offR.ink });
  ok('target off screen left: it points left', R.offL.calls.length === 1 && R.offL.calls[0].dir === -1 && R.offL.calls[0].far === 2100, R.offL.calls);
  ok('target on screen: no badge (the map pin takes over)', R.on.calls.length === 0, R.on.calls);
  ok('no page errors', errs.length === 0, [...new Set(errs)].slice(0, 3));
} finally { await browser.close().catch(() => {}); server.kill(); }
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
