// pop-mobile (per user: "could you beautiful all these in POP PUNK style" - the rotate-your-phone screen and the phone's
// corner buttons - then "look for instances with generic designs like such to beautify" - the touch controls). On an
// emulated touch phone:
//   1. PORTRAIT: the rotate nag shows, sits ABOVE the loose corner buttons (they used to cover its copy: a tap at their
//      spot now lands on the nag), its title is the comic logo (Nunito 1000, an ink stroke) and the phone is drawn in CSS
//      (the emoji glyph hidden)
//   2. LANDSCAPE: the loose corner buttons are ink stickers with a paper ring (the desktop tray keeps its own look)
//   3. no page errors
// The build before fails 1-2. (The touch controls' own pass carries its own test.)   node scripts/pop_mobile_test.mjs      PORT / MOJI_GAME_FILE override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11883), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const env = { ...process.env }; if (FILE !== 'mojiworld_game.html') env.MOJI_GAME_FILE = FILE; else delete env.MOJI_GAME_FILE;   // served AT /mojiworld_game.html
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 300) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
const errs = [];
const boot = async (vw, vh) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: vw, height: vh }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 }); await page.waitForTimeout(2500);
  await page.evaluate(async () => { try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = { tutorial_intro: true, everdawn_welcome: true }; player._tutorialSeen = true; applyClass('warrior'); try { closeAllModals(); } catch (e) {}
    loadMap('town', 600); await new Promise((r) => setTimeout(r, 2000)); window.dispatchEvent(new Event('resize')); await new Promise((r) => setTimeout(r, 1000)); });
  return { ctx, page };
};
try {
  { const { ctx, page } = await boot(390, 844);
    const P = await page.evaluate(() => { const nag = document.getElementById('rotate-nag'), cs = getComputedStyle(nag), h2 = getComputedStyle(nag.querySelector('h2')), ic = nag.querySelector('.icon');
      const covered = ['settings-btn', 'fullscreen-btn', 'mobile-mode-btn'].map((id) => { const b = document.getElementById(id), r = b && b.getBoundingClientRect(); if (!r || !r.width) return null; const st = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2), n = st.findIndex((e) => e.closest('#rotate-nag')), k = st.indexOf(b); return n >= 0 && (k < 0 || n < k); });   // stacking order (the dev-only lock can sit on top on localhost)
      return { shown: document.body.classList.contains('nag-portrait') && cs.display !== 'none', z: +cs.zIndex, covered, font: h2.fontFamily.split(',')[0].replace(/"/g, ''), weight: h2.fontWeight, stroke: h2.webkitTextStrokeWidth,
        glyph: ic && [...ic.children].every((c) => getComputedStyle(c).display === 'none'), phone: ic && getComputedStyle(ic, '::before').content !== 'none' }; });
    ok('1. portrait: the rotate nag shows over the game', P.shown, P);
    ok('1. it sits above the loose corner buttons - a tap at their spot lands on the nag, not under it', P.z > 120 && P.covered.filter((v) => v !== null).length >= 1 && P.covered.every((v) => v === null || v === true), P);
    ok('1. its title is the comic logo (Nunito 1000 with an ink stroke) and the phone is drawn in CSS, the emoji hidden', P.font === 'Nunito' && +P.weight >= 900 && parseFloat(P.stroke) >= 4 && P.glyph && P.phone, P);
    await ctx.close(); }
  { const { ctx, page } = await boot(932, 430);
    const L = await page.evaluate(() => { const c = getComputedStyle(document.getElementById('settings-btn')); return { bg: c.backgroundColor, bd: c.borderTopColor, sh: c.boxShadow }; });
    ok('2. landscape: the loose corner buttons are ink stickers with a paper ring and a pink slab', /^rgb\(11, 10, 14\)$/.test(L.bg) && /^rgb\(244, 241, 234\)$/.test(L.bd) && /rgb\(255, 45, 149\)/.test(L.sh), L);
    await ctx.close(); }
  ok('3. no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
