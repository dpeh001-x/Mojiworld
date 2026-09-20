// WHAT A LONG SESSION USED TO KEEP OR REDRAW (v0.30.928 audit). The damage-number atlases were never released
// (a boss fight's ~110 MB of canvas stayed for the session); the minimap redrew every symbol 15x a second while
// display:none on touch, under 900px, or minimised, and never culled off-window mobs; the HP/MP/EXP bars forced
// one full reflow each per tick on a sustained drain; a tainted drain-pillar read re-minted a canvas every frame;
// and the forced-modal observers stacked on every mobile-mode toggle.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/perf_guard_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11321';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
const env = { ...process.env, MOJI_GAME_FILE: PAGE };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
// two fixes are one line inside a hot path each; read them from the source rather than timing a reflow here
const src = readFileSync(PAGE, 'utf8');
check(/if \(game\._lxBarFlushAt !== \(game\.time \| 0\)\) \{ game\._lxBarFlushAt = \(game\.time \| 0\); void el\.offsetWidth; \}/.test(src), 'the bar snap forces one layout per frame, not one per bar');
check(/if \(x1 < 0\) \{ img\._lxInk = FALLBACK;/.test(src) && /catch \(e\) \{ try \{ img\._lxInk = FALLBACK; \}/.test(src), 'a failed drain-pillar ink read is remembered');
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof drawMinimap === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => { try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 40; loadMap('forest', 300); await new Promise((r) => setTimeout(r, 900)); });
  // 1. the atlases can be released, and a map change releases them
  const atlas = await page.evaluate(async () => {
    if (typeof _lxDnAtlasTrim !== 'function') return { err: 'no _lxDnAtlasTrim' };
    const seed = () => { for (let i = 0; i < 6; i++) { const cv = document.createElement('canvas'); cv.width = cv.height = 8; _LX_DN_ATLAS.set('probe' + i, { px: 5e6, cv }); } _lxDnAtlasPx = 30e6; };
    seed(); const before = _lxDnAtlasPx; const freed = _lxDnAtlasTrim(); const after = _lxDnAtlasPx;
    seed(); const beforeMap = _lxDnAtlasPx; loadMap('town', 300); await new Promise((r) => setTimeout(r, 900));
    return { before, freed, after, beforeMap, afterMap: _lxDnAtlasPx };
  });
  check(!atlas.err && atlas.after <= 6e6 && atlas.freed > 0, 'the damage-number atlases can be released down to a low-water mark', J(atlas));
  check(atlas.afterMap <= 6e6 && atlas.beforeMap > 6e6, 'a map change releases the last fight\'s atlases', J({ beforeMap: atlas.beforeMap, afterMap: atlas.afterMap }));
  // 2. a hidden minimap is not drawn
  const mm = await page.evaluate(async () => {
    loadMap('forest', 300); await new Promise((r) => setTimeout(r, 900));
    const cv = document.getElementById('minimap-canvas'); if (!cv) return { err: 'no minimap canvas' };
    const host = document.getElementById('minimap') || cv.parentElement;
    const paint = () => { const g = cv.getContext('2d'); g.fillStyle = '#ff00ff'; g.fillRect(0, 0, cv.width, cv.height); };
    const pink = () => { const g = cv.getContext('2d'); const d = g.getImageData(1, 1, 1, 1).data; return d[0] > 200 && d[2] > 200 && d[1] < 60; };
    const _d = host.style.display; host.style.display = 'none'; paint(); drawMinimap(); const hidden = pink();
    host.style.display = _d || ''; await new Promise((r) => setTimeout(r, 60)); paint(); drawMinimap(); const shown = pink();
    return { hiddenKeptPaint: hidden, shownRedrew: !shown };
  });
  check(mm.hiddenKeptPaint === true && mm.shownRedrew === true, 'a hidden minimap draws nothing; a visible one still draws', J(mm));
  // 3. the forced-modal observers are replaced, not stacked
  const obs = await page.evaluate(async () => {
    if (typeof _initMobileControls !== 'function') return { err: 'no _initMobileControls' };
    _initMobileControls(); const a = (window._forcedModalObservers || []).length;
    _initMobileControls(); _initMobileControls(); const b = (window._forcedModalObservers || []).length;
    return { a, b };
  });
  check(!obs.err && obs.b <= obs.a, 'three touch-control inits leave one set of modal observers', J(obs));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
