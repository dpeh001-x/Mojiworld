// The W map, the Taxi's routes and the dev teleport map share one renderer and one set of gradient/marker ids
// (wm-lane-*, wm-shadow, wm-dome...). A url(#id) resolves to the FIRST element with that id in the page, so a hidden copy
// that still holds them steals them: after the Taxi map had been opened, the W map's lanes painted with gradients inside
// a display:none subtree - not at all (found in the v0.30.1664 polish pass; the footstep lanes have no haze to hide it).
// Holds, in a booted game: [1] after Taxi -> W map, every lane gradient id is in the page exactly once and inside the W
// map's own svg; [2] the same after W map -> Taxi for the Taxi's svg; [3] no page errors.
//   node scripts/worldmap_one_diagram_test.mjs        PORT / MOJI_GAME_FILE override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11861), FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, channel: EXE ? undefined : 'msedge', headless: true, args: ['--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof toggleWorldMap === 'function' && typeof openTaxi === 'function' && typeof applyClass === 'function' && game.mapData, null, { timeout: 180000 });
  await page.evaluate(() => {
    try { _lxBootGateDone = true; } catch (e) {} window._prologueActive = false;
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior'); player._tutorialSeen = true;
    game.visitedMaps = Object.fromEntries(Object.keys(MAPS).map((k) => [k, true])); game.currentMap = 'town'; game.paused = false;
  });
  const owner = (hostId) => page.evaluate((hostId) => {
    const ids = [...new Set([...document.querySelectorAll('path.wm-lane')].map((p) => (/url\(#([^)]+)\)/.exec(p.getAttribute('stroke') || '') || [])[1]).filter(Boolean))];
    const host = document.getElementById(hostId);
    return { ids: ids.length, dup: ids.filter((id) => document.querySelectorAll('#' + id).length !== 1), foreign: ids.filter((id) => !(host && host.querySelector('#' + id))) };
  }, hostId);
  await page.evaluate(() => { try { closeAllModals(); } catch (e) {} openTaxi(); }); await page.waitForTimeout(2500);
  await page.evaluate(() => { try { closeAllModals(); } catch (e) {} toggleWorldMap(); }); await page.waitForTimeout(2500);
  const a = await owner('worldmap-grid');
  ok('[1] Taxi then W map: each lane gradient is in the page once, inside the W map', a.ids > 0 && !a.dup.length && !a.foreign.length, a);
  await page.evaluate(() => { try { closeAllModals(); } catch (e) {} openTaxi(); }); await page.waitForTimeout(2500);
  const b = await owner('taxi-grid');
  ok('[2] W map then Taxi: each lane gradient is in the page once, inside the Taxi map', b.ids > 0 && !b.dup.length && !b.foreign.length, b);
  ok('[3] no page errors', !errs.length, errs.slice(0, 3));
} catch (e) { ok('the run completes', false, String(e && e.message || e).slice(0, 200)); }
finally { await browser.close().catch(() => {}); server.kill(); }
console.log(`${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
