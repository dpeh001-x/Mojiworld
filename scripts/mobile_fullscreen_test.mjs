// mobile-fullscreen (per user: "ensure the fullscreen mode really is full screen for the mobile devices"). The corner
// fullscreen button on a touch phone used to run the DESKTOP toggle: fullscreen plus the saved desktop layout, which hides
// the touch deck (and boot restores it). Emulated Android phone, real taps:
//   1. a tap goes fullscreen, asks for the navigation bar to hide, and keeps the touch layout (deck shown, no desktop flag)
//   2. a second tap leaves fullscreen
//   3. a phone an old tap left in the desktop layout gets its touch deck back on the next tap
//   4. a desktop (mouse) window keeps the desktop toggle: fullscreen + the desktop layout, as before
//   5. no page errors
// The build before fails 1 and 3.   node scripts/mobile_fullscreen_test.mjs      PORT / MOJI_GAME_FILE override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11889), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const env = { ...process.env }; if (FILE !== 'mojiworld_game.html') env.MOJI_GAME_FILE = FILE; else delete env.MOJI_GAME_FILE;   // served AT /mojiworld_game.html
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 300) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
const errs = [];
const open = async (phone, stale) => {
  const ctx = await browser.newContext(phone ? { serviceWorkers: 'block', viewport: { width: 842, height: 325 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA } : { serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript((stale) => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); if (stale) localStorage.setItem('_lx_forceDesktop', '1'); } catch (e) {}
    // record what the page asks of the Fullscreen API (headless may or may not grant it)
    const o = Element.prototype.requestFullscreen; window.__fsCalls = [];
    Element.prototype.requestFullscreen = function (opts) { window.__fsCalls.push(opts || null); return o ? o.call(this, opts) : Promise.resolve(); }; }, stale);
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 }); await page.waitForTimeout(2500);
  await page.evaluate(async () => { try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = { tutorial_intro: true, everdawn_welcome: true }; player._tutorialSeen = true; applyClass('warrior'); try { closeAllModals(); } catch (e) {}
    loadMap('town', 600); await new Promise((r) => setTimeout(r, 2000)); window.dispatchEvent(new Event('resize')); await new Promise((r) => setTimeout(r, 900)); });
  return { ctx, page };
};
const state = (page) => page.evaluate(() => { const d = document.querySelector('#mobile-deck .mc-dpad'); return { fs: !!document.fullscreenElement, desktop: document.body.classList.contains('force-desktop'),
  saved: (() => { try { return localStorage.getItem('_lx_forceDesktop'); } catch (e) { return 'x'; } })(), deck: !!(d && d.getClientRects().length && getComputedStyle(d).visibility !== 'hidden'), calls: window.__fsCalls.slice() }; });
const tap = async (page, phone) => { const b = await page.$('#fullscreen-btn'); const r = await b.boundingBox(); if (phone) await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); else await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2); await page.waitForTimeout(900); };
try {
  { const { ctx, page } = await open(true, false);
    const s0 = await state(page); await tap(page, true); const s1 = await state(page);
    ok('1. phone: a tap asks for fullscreen with the navigation bar hidden and keeps the touch layout', s1.calls.length === 1 && s1.calls[0] && s1.calls[0].navigationUI === 'hide' && !s1.desktop && s1.saved !== '1' && s1.deck, { before: s0, after: s1 });
    if (s1.fs) { await tap(page, true); const s2 = await state(page); ok('2. phone: a second tap leaves fullscreen (and the deck stays)', !s2.fs && s2.deck && !s2.desktop, s2); }
    else ok('2. phone: (headless did not grant fullscreen - the exit path is not exercised here)', true, s1);
    await ctx.close(); }
  { const { ctx, page } = await open(true, false);
    // what the old tap left behind: the desktop class, the saved flag and the settings mirror (boot restores them)
    await page.evaluate(() => { document.body.classList.add('force-desktop'); try { localStorage.setItem('_lx_forceDesktop', '1'); const st = _lxGetSettings(); st.fdesk = true; _lxSaveSettings(st); } catch (e) {} _fitGameToViewport(); });
    await page.waitForTimeout(600);
    const s0 = await state(page); await tap(page, true); const s1 = await state(page);
    ok('3. phone left in the desktop layout by an old tap: the next tap brings the touch deck back', s0.desktop && !s1.desktop && s1.saved !== '1' && s1.deck && s1.calls.length === 1, { before: s0, after: s1 });
    await ctx.close(); }
  { const { ctx, page } = await open(false, false);
    await tap(page, false); const s1 = await state(page);
    ok('4. desktop: the corner button keeps the desktop toggle (fullscreen + the desktop layout)', s1.calls.length === 1 && s1.desktop && s1.saved === '1', s1);
    await ctx.close(); }
  ok('5. no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
