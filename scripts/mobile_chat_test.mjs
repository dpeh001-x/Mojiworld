// On a phone - iPhone or Android - CHAT is a button at the top right, and one tap opens the chat box with the keyboard.
// ============================================================================
// Per user: "ensure for the mobile devices, the chat function is available by a button at the top right and that users
// will then have an on screen keyboard to type for the chatbox", then "ensure it works well with IOS apple device as well
// as android". A phone raises its keyboard only for a field focused inside a tap, so "keyboard" is checked as: the tap
// leaves the chat field focused, visible and editable. Emulated touch phones with iPhone (Safari) and Android (Chrome)
// identities, portrait and landscape, each:
//   1. ON SCREEN: every button of the top menu row is inside the screen (MAP fell off the left edge at 360 before)
//   2. TOP RIGHT: CHAT ends the row, in the top band and the right part of the screen
//   3. NOT COVERED: CHAT is the element a finger hits at its centre (the settings gear sat on it in portrait)
//   4. KEYBOARD: a tap on CHAT focuses a visible, editable (user-select: text) chat field at the top
//   5. TYPING: text with spaces and game keys (wasd) lands in the field and does not move the hero
//   6. SEND: Enter (the keyboard's Send key) posts it to the chat log ONCE and closes the field
// and on one iPhone and one Android phone, with the keyboard simulated through the visual viewport:
//   8. KEYBOARD UP: the visible area shrinks and scrolls down 120 px (iOS) - the bar follows to the top of what is visible
//   9. KEYBOARD DISMISSED: the visible area grows back (Android's Back key keeps the field focused) - the bar closes
//  10. RE-TAP: a second tap on CHAT while it is open keeps it open and focused (re-raises a hidden keyboard)
//  11. SEND WITHOUT A KEY CODE: a Send whose key event is unusable (Android keyCode 229 while composing) still sends, once
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
const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const AND = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const PHONES = [['iPhone portrait 390', 390, 844, IOS, true], ['Android portrait 412', 412, 915, AND, true], ['Android portrait 360', 360, 780, AND, false],
  ['iPhone SE portrait 320', 320, 568, IOS, false], ['iPhone landscape 844', 844, 390, IOS, false], ['Android landscape 915', 915, 412, AND, false]];
const res = [];
const ok = (n, c, extra) => { res.push({ n, pass: !!c }); console.log((c ? 'PASS ' : 'FAIL ') + n + (extra === undefined ? '' : '  [' + String(extra).slice(0, 260) + ']')); };
const J = JSON.stringify;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--mute-audio'] });
const tapChat = async (page) => { const r = await page.evaluate(() => { const q = document.getElementById('mc-chat-btn').getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }); await page.touchscreen.tap(r[0], r[1]); await page.waitForTimeout(400); };
const logCount = (page, text) => page.evaluate((t) => { const l = document.getElementById('mp-chat-log'); return l ? l.textContent.split(t).length - 1 : 0; }, text);
try {
  for (const [tag, W, H, ua, kb] of PHONES) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, serviceWorkers: 'block', userAgent: ua });
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
      return { vw: innerWidth, vh: innerHeight, btn: [r.left, r.top, r.right, r.bottom].map(Math.round), btns, last: [...row.querySelectorAll('.mc-menu')].pop() === b,
        hit: hit ? (hit.id || hit.className) : null, covered: !(hit && (hit === b || b.contains(hit))) };
    });
    ok(`${tag} 1. ON SCREEN: all ${L.btns.length} menu buttons inside the screen`, L.btns.length === 8 && L.btns.every(([l, rr, w]) => l >= 0 && rr <= L.vw && w >= 32), J(L.btns));
    ok(`${tag} 2. TOP RIGHT: CHAT ends the row, top band, right part`, L.last && L.btn[1] < 40 && L.btn[2] > L.vw * 0.8, J(L.btn) + ' of ' + L.vw);
    ok(`${tag} 3. NOT COVERED: a finger at its centre hits CHAT`, !L.covered, L.hit);
    await tapChat(page);
    const F = await page.evaluate(() => { const i = document.getElementById('mp-chat-input'), r = i.getBoundingClientRect(), cs = getComputedStyle(i);
      return { focused: document.activeElement === i, shown: cs.display !== 'none', rect: [r.left, r.top, r.right, r.bottom].map(Math.round), editable: !i.readOnly && !i.disabled, sel: cs.userSelect || cs.webkitUserSelect, open: !!net.chatOpen, font: cs.fontSize }; });
    ok(`${tag} 4. KEYBOARD: one tap focuses a visible, editable chat field at the top (16 px, so iOS does not zoom)`, F.focused && F.shown && F.editable && F.sel === 'text' && F.font === '16px' && F.open && F.rect[1] >= 0 && F.rect[3] < L.vh * 0.25 && F.rect[0] >= 0 && F.rect[2] <= L.vw, J(F));
    const x0 = await page.evaluate(() => player.x);
    await page.keyboard.type('hi there wasd 12');
    await page.waitForTimeout(300);
    const Ty = await page.evaluate((x0) => ({ value: document.getElementById('mp-chat-input').value, dx: Math.round(player.x - x0), keys: Object.keys(game.keys).filter((k) => game.keys[k]) }), x0);
    ok(`${tag} 5. TYPING: spaces and game keys land in the field, the hero stays put`, Ty.value === 'hi there wasd 12' && Math.abs(Ty.dx) < 4 && Ty.keys.length === 0, J(Ty));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const S = { open: await page.evaluate(() => !!net.chatOpen), n: await logCount(page, 'hi there wasd 12') };
    ok(`${tag} 6. SEND: Enter posts it to the chat log once and closes the field`, !S.open && S.n === 1, J(S));
    if (kb) {
      // the keyboard, simulated: the visual viewport shrinks (and on iOS scrolls down), then grows back
      const vv = (h, top) => page.evaluate(([h, top]) => { const v = window.visualViewport; Object.defineProperty(v, 'height', { configurable: true, get: () => h }); Object.defineProperty(v, 'offsetTop', { configurable: true, get: () => top }); v.dispatchEvent(new Event('resize')); }, [h, top]);
      await tapChat(page);
      await vv(Math.round(H * 0.45), 120); await page.waitForTimeout(150);
      const up = await page.evaluate(() => { const r = document.getElementById('mp-chat-input').getBoundingClientRect(); return { top: Math.round(r.top), open: !!net.chatOpen }; });
      ok(`${tag} 8. KEYBOARD UP: the bar follows to the top of the visible area (scrolled 120 px)`, up.open && up.top >= 120 && up.top <= 170, J(up));
      await vv(H, 0); await page.waitForTimeout(250);
      const down = await page.evaluate(() => ({ open: !!net.chatOpen, shown: getComputedStyle(document.getElementById('mp-chat-input')).display, scrollY: window.scrollY }));
      ok(`${tag} 9. KEYBOARD DISMISSED: the bar closes and the page is home`, !down.open && down.shown === 'none' && down.scrollY === 0, J(down));
      await tapChat(page); await tapChat(page);
      const re = await page.evaluate(() => ({ open: !!net.chatOpen, focused: document.activeElement === document.getElementById('mp-chat-input') }));
      ok(`${tag} 10. RE-TAP: a second tap keeps the bar open and focused`, re.open && re.focused, J(re));
      await page.keyboard.type('compose');
      await page.evaluate(() => { const i = document.getElementById('mp-chat-input'); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Unidentified', keyCode: 229, bubbles: true, cancelable: true })); document.getElementById('mp-chat-form').requestSubmit(); });
      await page.waitForTimeout(400);
      const sub = { open: await page.evaluate(() => !!net.chatOpen), n: await logCount(page, 'compose') };
      ok(`${tag} 11. SEND WITHOUT A KEY CODE: the keyboard's Send submits the form - sent once, bar closed`, !sub.open && sub.n === 1, J(sub));
    }
    ok(`${tag} 7. no page errors`, errs.length === 0, J(errs));
    await ctx.close();
  }
} finally { await browser.close(); server.kill(); }
const fail = res.filter((r) => !r.pass).length;
console.log(`\n${res.length - fail}/${res.length} passed`);
process.exit(fail ? 1 : 0);
