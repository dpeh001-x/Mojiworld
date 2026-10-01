// Co-op chat (per user: "Press enter to open chatbox to type in to communicate with other real players real time, small
// chatbubble with the text should appear on top of character, the chat bubble that displays should last 6 seconds").
// Two real clients on the relay (mp/server.mjs, started here), both in town. Real key presses throughout:
//   1. out of co-op, Enter opens nothing (v0.30.1330, per user: chat is for co-op)
//   2. in a room, Enter opens the chat bar with the caret in it
//   3. keys typed into the bar stay in it: M does not mute, the arrow keys do not walk
//   4. Enter sends: the bar closes, and the bubble floats over the sender's own head
//   5. the partner gets it in real time: the bubble over the sender's avatar, and the line in the chat log
//   6. the bubble lasts 6 s on both screens - still up at 5.5 s, gone by 6.7 s (it was 4 s)
//   7. it is SMALL: a full 60-character message wraps into a bubble at most 150 px wide (one line ran ~360 px)
//   8. Escape cancels: nothing is sent
//   9. the partner answers and the sender sees that bubble too
// node scripts/chat_bubble_test.mjs    PORT / MOJI_GAME_FILE override   (scripts/coop_chat_test.mjs covers sanitising)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11951), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 300) + ']' : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const relay = spawn(process.execPath, [path.join(ROOT, 'mp', 'server.mjs')], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await sleep(1500);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const errs = [];
const boot = async (name) => {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(name + ': ' + String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof net === 'object' && typeof mpConnect === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.evaluate((nm) => {
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior'); player.level = 30; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    player._storyBeatsSeen.everdawn_welcome = true;   // the town's welcome clip pauses the game and takes the first Enter
    if (player.look) player.look.name = nm; game.paused = false; player.invulnerable = 1e9; window.triggerDeath = function () {};
    window.__pump = setInterval(() => { player.invulnerable = 1e9; try { _mpTick(); } catch (e) {} }, 40);
    // every bubble drawn: what, when (wall clock - the pages' performance clocks differ), and the bake it drew
    window.__bub = []; const real = window._drawBubble;
    window._drawBubble = function (cx, topY, text, opts) {
      let bw = 0, bh = 0; try { const cv = _lxBubbleBake(text, opts); if (cv) { bw = cv._lxBw; bh = cv._lxBh; } } catch (e) {}
      window.__bub.push({ at: Date.now(), text: String(text), bw: Math.round(bw), bh: Math.round(bh) }); if (window.__bub.length > 400) window.__bub.splice(0, 100);
      return real.apply(this, arguments);
    };
    document.body.focus();
  }, name);
  return page;
};
const drawn = (p, text, sinceMs) => p.evaluate(({ text, sinceMs }) => window.__bub.filter((b) => b.text === text && b.at >= Date.now() - sinceMs).length, { text, sinceMs });
const waitFor = async (p, fn, arg, ms) => { try { await p.waitForFunction(fn, arg, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } };
try {
  const ROOM = 'chat' + Math.floor(Math.random() * 1e6), WS = `ws://localhost:${PORT}`;
  const A = await boot('Ann'), B = await boot('Ben');
  // ---- 1 ----
  await A.keyboard.press('Enter'); await sleep(300);
  ok('1. out of co-op, Enter opens nothing', !(await A.evaluate(() => net.chatOpen)));
  for (const [p, nm] of [[A, 'Ann'], [B, 'Ben']]) { await p.evaluate(({ ws, room, nm }) => mpConnect(ws, nm, room), { ws: WS, room: ROOM, nm }); await p.waitForFunction(() => net.myId != null && _coopActive(), null, { timeout: 30000 }); }
  await A.evaluate(() => loadMap('town', 600)); await B.evaluate(() => loadMap('town', 700)); await sleep(2500);
  const aId = await A.evaluate(() => net.myId), bId = await B.evaluate(() => net.myId);
  await waitFor(B, (id) => net.peers[id] && net.peers[id].x != null, aId, 8000);
  // ---- 2 ----
  await A.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); document.body.focus(); });
  await A.keyboard.press('Enter'); await sleep(250);
  const o2 = await A.evaluate(() => { const inp = document.getElementById('mp-chat-input'); return { open: net.chatOpen, shown: !!inp && getComputedStyle(inp).display !== 'none', focus: document.activeElement === inp }; });
  ok('2. in a room, Enter opens the chat bar with the caret in it', o2.open && o2.shown && o2.focus, o2);
  // ---- 3 ----
  const pre = await A.evaluate(() => ({ x: Math.round(player.x), muted: !!(audio && (audio.muted || audio._muted || audio.isMuted)) }));
  const MSG = 'hmm hello from Ann';
  await A.keyboard.type(MSG, { delay: 25 }); await A.keyboard.press('ArrowRight'); await A.keyboard.press('ArrowRight'); await sleep(300);
  const o3 = await A.evaluate(() => ({ x: Math.round(player.x), muted: !!(audio && (audio.muted || audio._muted || audio.isMuted)), val: document.getElementById('mp-chat-input').value, open: net.chatOpen }));
  ok('3. keys typed into the bar stay in it (M does not mute, arrows do not walk)', o3.val === MSG && o3.open && o3.muted === pre.muted && Math.abs(o3.x - pre.x) <= 2, { pre, o3 });
  // ---- 4 ----
  await A.keyboard.press('Enter'); const tSend = Date.now(); await sleep(400);
  const o4 = await A.evaluate((m) => { const inp = document.getElementById('mp-chat-input'); return { open: net.chatOpen, hidden: getComputedStyle(inp).display === 'none', chat: player._chat && player._chat.text }; }, MSG);
  const o4d = await waitFor(A, (m) => window.__bub.some((b) => b.text === m), MSG, 4000);
  ok('4. Enter sends: the bar closes and the bubble floats over the sender', !o4.open && o4.hidden && o4.chat === MSG && o4d, { ...o4, drawn: o4d });
  // ---- 5 ----
  const got = await waitFor(B, ({ id, m }) => net.peers[id] && net.peers[id].chat && net.peers[id].chat.text === m, { id: aId, m: MSG }, 4000);
  const gotLag = Date.now() - tSend;
  const o5d = await waitFor(B, (m) => window.__bub.some((b) => b.text === m), MSG, 4000);
  const log = await B.evaluate((m) => { const l = document.getElementById('mp-chat-log'); return !!l && l.textContent.includes(m) && l.textContent.includes('Ann'); }, MSG);
  ok('5. the partner gets it in real time: a bubble over Ann\'s avatar, and the line in the log', got && o5d && log && gotLag < 3000, { got, lagMs: gotLag, drawn: o5d, log });
  // ---- 6 ----
  await sleep(Math.max(0, 5500 - (Date.now() - tSend)));
  const up = { A: await A.evaluate(() => !!player._chat), B: await B.evaluate((id) => !!(net.peers[id] && net.peers[id].chat), aId), dA: await drawn(A, MSG, 600), dB: await drawn(B, MSG, 600) };
  await sleep(Math.max(0, 6700 - (Date.now() - tSend)));
  const gone = { A: await A.evaluate(() => !player._chat), B: await B.evaluate((id) => !(net.peers[id] && net.peers[id].chat), aId), dA: await drawn(A, MSG, 300), dB: await drawn(B, MSG, 300) };
  ok('6. the bubble lasts 6 s on both screens (up at 5.5 s, gone by 6.7 s)', up.A && up.B && up.dA > 0 && up.dB > 0 && gone.A && gone.B && gone.dA === 0 && gone.dB === 0, { at5500: up, at6700: gone });
  // ---- 7 ----
  const LONG = 'The quick brown fox jumps over the lazy dog by the old tower';   // 60
  await A.evaluate(() => document.body.focus()); await A.keyboard.press('Enter'); await sleep(200); await A.keyboard.type(LONG, { delay: 5 }); await A.keyboard.press('Enter');
  await waitFor(A, (m) => window.__bub.some((b) => b.text === m), LONG, 4000);
  const big = await A.evaluate((m) => { const b = window.__bub.filter((x) => x.text === m).pop(); return b ? { bw: b.bw, bh: b.bh } : null; }, LONG);
  ok('7. a full 60-character message wraps into a small bubble (<= 150 px wide)', LONG.length === 60 && !!big && big.bw > 0 && big.bw <= 150 && big.bh > 20, { len: LONG.length, ...big });
  // ---- 8 ----
  await A.evaluate(() => document.body.focus()); await A.keyboard.press('Enter'); await sleep(200); await A.keyboard.type('not sent', { delay: 10 }); await A.keyboard.press('Escape'); await sleep(1500);
  const o8 = { open: await A.evaluate(() => net.chatOpen), aChat: await A.evaluate(() => player._chat && player._chat.text), bGot: await B.evaluate(() => document.getElementById('mp-chat-log').textContent.includes('not sent')) };
  ok('8. Escape cancels: the bar closes and nothing is sent', !o8.open && o8.aChat !== 'not sent' && !o8.bGot, o8);
  // ---- 9 ----
  const REPLY = 'hi Ann!';
  await B.evaluate(() => document.body.focus()); await B.keyboard.press('Enter'); await sleep(200); await B.keyboard.type(REPLY, { delay: 10 }); await B.keyboard.press('Enter');
  const back = await waitFor(A, ({ id, m }) => net.peers[id] && net.peers[id].chat && net.peers[id].chat.text === m && window.__bub.some((b) => b.text === m), { id: bId, m: REPLY }, 4000);
  ok('9. the partner answers and Ann sees that bubble over Ben', back);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); relay.kill(); }
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
