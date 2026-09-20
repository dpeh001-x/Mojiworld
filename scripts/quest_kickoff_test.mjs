// THE TOUR ENDS AND THE PLAYER IS POINTED SOMEWHERE (v0.30.952).
//
// The worst moment a new player can have is the one right after the tutorial closes: fourteen steps
// of guidance stop, and if nothing takes over they are standing in a town with no idea what the game
// wants. _closeTutorial -> _lxQuestKickoff(true) is what covers that second: it ticks the quest
// unlocks, renders the tracker, and 1.4 s later names the destination.
//
// Timing matters here - the kickoff is scheduled 900 ms after the close and its toast another
// 1400 ms after that, so a check that samples immediately finds an empty tracker and reports that
// the game abandons the player.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/quest_kickoff_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11347';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _closeTutorial === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 5; loadMap('town', 300); await new Promise((r) => setTimeout(r, 2000)); game.paused = false;
  });
  for (let i = 0; i < 14; i++) { const c = await page.evaluate(() => (document.body.className.match(/cinematic|sb-active/g) || []).join('+')); if (!c) break; await page.keyboard.press('Space'); await page.waitForTimeout(400); }
  const r = await page.evaluate(async () => {
    try { closeAllModals(); } catch (e) {} game.paused = false;
    window.__toasts = []; const f = window.showToast;
    if (f && !f.__w) { window.showToast = function (m) { try { window.__toasts.push(String(m).slice(0, 120)); } catch (e) {} return f.apply(this, arguments); }; window.showToast.__w = true; }
    const tracker = () => { const t = document.getElementById('quest-tracker') || document.getElementById('quest-hud');
      return { text: t ? (t.textContent || '').replace(/\s+/g, ' ').trim() : null,
        shown: !!(t && t.getClientRects().length && getComputedStyle(t).display !== 'none') }; };
    const before = tracker();
    player._tutorialSeen = false;
    _closeTutorial(true);                       // finishing the tour, the way "Got it" does
    await new Promise((r) => setTimeout(r, 4200));   // 900 ms kickoff + 1400 ms toast, with room
    return { before, after: tracker(), toasts: window.__toasts.slice(0, 6), seen: !!player._tutorialSeen,
      dockGone: (() => { const m = document.getElementById('tutorial-modal'); const c = m && m.querySelector('.modal');
        return !(c && c.getClientRects().length && m.style.display !== 'none'); })(),
      paused: !!game.paused };
  });
  check(r.seen === true && r.dockGone, 'finishing the tour closes the dock and marks it seen', J({ seen: r.seen, dockGone: r.dockGone }));
  check(r.paused === false, 'and leaves the game running', 'paused ' + r.paused);
  check(r.before.text === '' || r.before.text === null, 'the tracker is empty while the tour is up', J(r.before));
  check(r.after.shown === true && !!r.after.text, 'the quest tracker takes over the moment it closes', J(r.after).slice(0, 160));
  check(/waking|act\s*i|joyce/i.test(r.after.text || ''), 'and it names Act I / where to go', (r.after.text || '').slice(0, 90));
  check(r.toasts.some((t) => /joyce|megamall|act i/i.test(t)), 'a toast names the destination too', J(r.toasts).slice(0, 180));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
