// Chat is a co-op feature: the Chat key (Enter by default) opens the chat bar in a co-op room only.
//
// Per user: "make enter not open chat outside co-op". Before, Enter opened the bar anywhere. Out of a room it only floated
// a bubble over the player's own head, and while it was open it swallowed every key - an Enter pressed through the
// prologue left W typing into the chat (worldmap_preload_test read "0 emblem nodes" that way). One page, a warrior in town:
//   1. out of co-op: Enter opens nothing and leaves the keyboard with the game - the next W opens the world map; the HUD
//      strip does not offer Chat; the K panel names it Co-op Chat; the co-op panel's help line says so;
//   2. in a co-op room (the socket faked open and welcomed, as the co-op suites do): the strip offers Chat, Enter opens
//      the bar with the typing focus in it, a line typed and sent goes to the room and floats over the hero, Esc cancels;
//   3. out of the room again: the strip drops Chat and Enter opens nothing.
// The build before fails 7 of the 10: Enter opened the bar offline, W went into it, and the next Enter sent "w".
//   node scripts/chat_coop_only_test.mjs     MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11761), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) { applyClass('warrior'); player.level = 30; }
    player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._gravitosCineSeen = true;
    loadMap('town', 400); await new Promise((r) => setTimeout(r, 1500));
  });
  // the world live and nothing on top of it, before each key
  const live = () => page.evaluate(() => { const t = document.getElementById('tutorial-modal'); if (t) t.style.display = 'none'; try { if (document.activeElement && document.activeElement !== document.body && document.activeElement.id !== 'mp-chat-input') document.activeElement.blur(); } catch (e) {} game.paused = false; });
  const st = () => page.evaluate(() => { const inp = document.getElementById('mp-chat-input'), cs = document.getElementById('controls'), wm = document.getElementById('worldmap-modal');
    return { chatOpen: !!net.chatOpen, focus: document.activeElement === inp, strip: cs ? cs.textContent.replace(/\s+/g, ' ').trim() : '(no strip)', map: wm ? wm.style.display : '' }; });

  // 1. out of co-op
  await live(); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  const o1 = await st();
  ok('out of co-op, Enter opens no chat bar and takes no typing focus', !o1.chatOpen && !o1.focus, o1);
  await live(); await page.keyboard.press('w'); await page.waitForTimeout(700);
  const o2 = await st();
  ok('... so the next key reaches the game: W opens the world map', o2.map === 'flex', o2);
  await page.evaluate(() => { if (document.getElementById('worldmap-modal').style.display === 'flex') toggleWorldMap(); game.paused = false; });
  ok('the HUD strip does not offer Chat out of co-op', !/Chat/.test(o1.strip), o1.strip);
  const lab = await page.evaluate(() => ({ k: (LX_BIND_BY_ID.chat || {}).label, help: document.body.innerHTML.indexOf('<b>In-world chat:</b> in a co-op room') >= 0 }));
  ok('the K panel names it Co-op Chat, and the co-op panel says chat works in a room', lab.k === 'Co-op Chat' && lab.help, lab);

  // 2. in a co-op room (the socket faked open and welcomed, as the co-op suites do)
  await page.evaluate(() => { window._sent = []; window._netWas = { c: net.connected, w: net.ws, m: net.myId };
    net.ws = { readyState: 1, send: (x) => { try { window._sent.push(JSON.parse(x)); } catch (e) {} } }; net.connected = true; net.myId = 1; });
  await page.waitForTimeout(1600);   // the strip's watcher ticks once a second
  await live();
  const c0 = await st();
  ok('in a co-op room the HUD strip offers Chat', /Chat/.test(c0.strip), c0.strip);
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  const c1 = await st();
  ok('in a co-op room Enter opens the chat bar with the typing focus in it', c1.chatOpen && c1.focus, c1);
  await page.keyboard.type('hi team'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  const c2 = await page.evaluate(() => ({ open: !!net.chatOpen, bubble: player._chat && player._chat.text, sent: window._sent.filter((m) => m && m.t === 'chat').map((m) => m.text) }));
  ok('a line typed and sent goes to the room and floats over the hero; the bar closes', !c2.open && c2.bubble === 'hi team' && c2.sent.includes('hi team'), c2);
  await live(); await page.keyboard.press('Enter'); await page.waitForTimeout(250); await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  const c3 = await st();
  ok('Esc cancels the bar and gives the keyboard back', !c3.chatOpen && !c3.focus, c3);

  // 3. out of the room again
  await page.evaluate(() => { const w = window._netWas; net.connected = w.c; net.ws = w.w; net.myId = w.m; });
  await page.waitForTimeout(1600);
  await live(); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  const d1 = await st();
  ok('out of the room again, the strip drops Chat and Enter opens nothing', !/Chat/.test(d1.strip) && !d1.chatOpen && !d1.focus, d1);
  await ctx.close();
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
