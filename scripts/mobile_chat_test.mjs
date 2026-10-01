// On a phone, CHAT is a button at the top right, and one tap opens the chat box with the on-screen keyboard.
// ============================================================================
// Per user: "ensure for the mobile devices, the chat function is available by a button at the top right and that users
// will then have an on screen keyboard to type for the chatbox". A phone raises its keyboard only for an input that is
// focused inside a tap, so "keyboard" is checked as: the tap leaves the chat input focused, visible and editable.
// Emulated touch phones, portrait 390 / 360 / 320 and landscape 844 x 390, each:
//   1. ON SCREEN: every button of the top menu row is inside the screen (MAP fell off the left edge at 360 before)
//   2. TOP RIGHT: CHAT ends the row, in the top band and the right part of the screen
//   3. NOT COVERED: CHAT is the element a finger hits at its centre (the settings gear sat on it in portrait)
//   4. KEYBOARD: a tap on CHAT focuses a visible, editable chat input at the top of the screen
//   5. TYPING: text with spaces and game keys (wasd) lands in the box and does not move the hero
//   6. SEND: Enter (the keyboard's Send key) posts it to the chat log and closes the box
// Run: node scripts/mobile_chat_test.mjs   (PORT=..., MOJI_GAME_FILE=... for another build)
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = (process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')).replace(/\\/g, '/');
const require = createRequire(import.meta.url);
const { chromium } = require(ROOT + '/node_modules/playwright-core');
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 12917);
const res = [];
const ok = (n, c, extra) => { res.push({ n, pass: !!c }); console.log((c ? 'PASS ' : 'FAIL ') + n + (extra === undefined ? '' : '  [' + String(extra).slice(0, 260) + ']')); };
const J = JSON.stringify;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--mute-audio'] });
try {
  for (const [tag, W, H] of [['portrait 390', 390, 844], ['portrait 360', 360, 780], ['portrait 320', 320, 680], ['landscape 844', 844, 390]]) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, serviceWorkers: 'block',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
    await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
    await page.goto(`http://localhost:${PORT}/${FILE}?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof loadMap === 'function' && typeof game === 'object' && game.mapData, null, { timeout: 180000 });
    await page.waitForTimeout(4000);
    // straight into play: a warrior in the forest, every story beat and the opening clips already seen
    await page.evaluate(() => { try { _lxBootGateDone = true; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
      applyClass('warrior'); player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
      player._storyBeatsSeen.everdawn_welcome = true; try { window._playVoidIntro = function () {}; } catch (e) {} window._prologueActive = false; loadMap('forest'); game.paused = false; });
    for (let k = 0; k < 20; k++) {   // a clip that already started is skipped by its own button, so its key listener goes with it
      await page.evaluate(() => { for (const id of ['plg-dagger-skip', 'plg-skip']) { const sk = document.getElementById(id); if (sk) sk.click(); }
        for (const [id, c] of [['void-intro-overlay', 'show'], ['story-beat-overlay', 'on'], ['boss-intro-overlay', 'on']]) { const e = document.getElementById(id); if (e) e.classList.remove(c); }
        const w = document.getElementById('everdawn-welcome-overlay'); if (w) w.remove(); window._prologueActive = false; game.paused = false; });
      await page.waitForTimeout(250);
    }
    if (W < H) { const b = await page.$('text=Play in portrait anyway'); if (b) { await b.tap(); await page.waitForTimeout(800); } }
    const L = await page.evaluate(() => {
      const b = document.getElementById('mc-chat-btn'), row = b.parentElement, r = b.getBoundingClientRect();
      const btns = [...row.querySelectorAll('.mc-menu')].map((x) => { const q = x.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.right), Math.round(q.width)]; });
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { vw: innerWidth, vh: innerHeight, btn: [r.left, r.top, r.right, r.bottom].map(Math.round), btns, last: row.lastElementChild === b || [...row.querySelectorAll('.mc-menu')].pop() === b,
        hit: hit ? (hit.id || hit.className) : null, covered: !(hit && (hit === b || b.contains(hit))) };
    });
    ok(`${tag} 1. ON SCREEN: all ${L.btns.length} menu buttons inside the screen`, L.btns.length === 8 && L.btns.every(([l, rr, w]) => l >= 0 && rr <= L.vw && w >= 32), J(L.btns));
    ok(`${tag} 2. TOP RIGHT: CHAT ends the row, top band, right part`, L.last && L.btn[1] < 40 && L.btn[2] > L.vw * 0.8, J(L.btn) + ' of ' + L.vw);
    ok(`${tag} 3. NOT COVERED: a finger at its centre hits CHAT`, !L.covered, L.hit);
    await page.touchscreen.tap((L.btn[0] + L.btn[2]) / 2, (L.btn[1] + L.btn[3]) / 2);
    await page.waitForTimeout(500);
    const F = await page.evaluate(() => { const i = document.getElementById('mp-chat-input'), r = i.getBoundingClientRect();
      return { focused: document.activeElement === i, shown: getComputedStyle(i).display !== 'none', rect: [r.left, r.top, r.right, r.bottom].map(Math.round), editable: !i.readOnly && !i.disabled, open: !!net.chatOpen }; });
    ok(`${tag} 4. KEYBOARD: one tap focuses a visible, editable chat box at the top`, F.focused && F.shown && F.editable && F.open && F.rect[1] >= 0 && F.rect[3] < L.vh * 0.25 && F.rect[0] >= 0 && F.rect[2] <= L.vw, J(F));
    const x0 = await page.evaluate(() => player.x);
    await page.keyboard.type('hi there wasd 12');
    await page.waitForTimeout(300);
    const Ty = await page.evaluate((x0) => ({ value: document.getElementById('mp-chat-input').value, dx: Math.round(player.x - x0), keys: Object.keys(game.keys).filter((k) => game.keys[k]) }), x0);
    ok(`${tag} 5. TYPING: spaces and game keys land in the box, the hero stays put`, Ty.value === 'hi there wasd 12' && Math.abs(Ty.dx) < 4 && Ty.keys.length === 0, J(Ty));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const S = await page.evaluate(() => { const l = document.getElementById('mp-chat-log'); return { open: !!net.chatOpen, log: l ? l.textContent.slice(-60) : '' }; });
    ok(`${tag} 6. SEND: Enter posts it to the chat log and closes the box`, !S.open && /hi there wasd 12/.test(S.log), J(S));
    ok(`${tag} 7. no page errors`, errs.length === 0, J(errs));
    await ctx.close();
  }
} finally { await browser.close(); server.kill(); }
const fail = res.filter((r) => !r.pass).length;
console.log(`\n${res.length - fail}/${res.length} passed`);
process.exit(fail ? 1 : 0);
