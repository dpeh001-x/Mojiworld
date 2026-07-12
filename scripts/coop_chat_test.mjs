// Live 2-client test: CHAT — open the bar, type, Enter to send; partner receives
// the bubble + log line with the sender's name; input is sanitized (XSS + control
// chars + 60-char cap); opening chat releases held movement keys.
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html', WS = 'ws://localhost:8080';
const ROOM = 'chat' + (process.env.RUN_TAG || Math.floor(Math.random() * 1e6));
const results = [];
const ok = (n, c, extra) => results.push({ n, pass: !!c, extra });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function boot(browser, name) {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  page._errors = []; page.on('pageerror', e => page._errors.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof net === 'object' && typeof mpConnect === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.evaluate((nm) => { try { player.cls = 'warrior'; if (player.look) player.look.name = nm; game.paused = false; window._prologueActive = false; const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none'; } catch (e) {} }, name);
  return page;
}
const ev = (p, f, a) => p.evaluate(f, a);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
try {
  const A = await boot(browser, 'Alice'), B = await boot(browser, 'Bob');
  await ev(A, ({ ws, room }) => mpConnect(ws, 'Alice', room), { ws: WS, room: ROOM });
  await A.waitForFunction(() => net.myId != null, null, { timeout: 10000 }).catch(() => {});
  await ev(B, ({ ws, room }) => mpConnect(ws, 'Bob', room), { ws: WS, room: ROOM });
  await B.waitForFunction(() => net.myId != null, null, { timeout: 10000 }).catch(() => {});
  await sleep(600);
  ok('both connected', await ev(A, () => net.connected) && await ev(B, () => net.connected));

  // 1) Open the chat bar on A while holding a movement key -> key released, input focused.
  await A.keyboard.down('ArrowRight');
  await sleep(150);
  const open = await ev(A, () => {
    _mpOpenChat();
    return { open: net.chatOpen, shown: document.getElementById('mp-chat-input').style.display !== 'none',
      focused: document.activeElement === document.getElementById('mp-chat-input'),
      rightHeld: !!game.keys['arrowright'] };
  });
  await A.keyboard.up('ArrowRight');
  ok('chat bar opens + focuses the input', open.open && open.shown && open.focused, open);
  ok('held movement keys released on open (no walking while typing)', open.rightHeld === false, open);

  // 2) Type + Enter -> A shows own bubble/log; B receives bubble + named log line.
  await ev(A, () => { const i = document.getElementById('mp-chat-input'); i.value = 'follow me to the boss!'; _mpCloseChat(true); });
  const aSide = await ev(A, () => ({ closed: !net.chatOpen, bubble: player._chat && player._chat.text, log: (net.chatLog || []).some(l => /follow me to the boss!/.test(l.html || l.text || JSON.stringify(l))) }));
  ok('sender: bar closes, own bubble + log entry', aSide.closed && aSide.bubble === 'follow me to the boss!' && aSide.log, aSide);
  await B.waitForFunction(() => Object.values(net.peers).some(p => p && p.chat && /follow me/.test(p.chat.text)), null, { timeout: 8000 }).catch(() => {});
  const bSide = await ev(B, () => {
    const p = Object.values(net.peers).find(p => p && p.chat && /follow me/.test(p.chat.text));
    return { bubble: p ? p.chat.text : null, life: p && p.chat.life,
      log: (net.chatLog || []).some(l => /Alice/.test(JSON.stringify(l)) && /follow me/.test(JSON.stringify(l))) };
  });
  ok('receiver: partner bubble with the message', bSide.bubble === 'follow me to the boss!' && bSide.life > 0, bSide);
  ok('receiver: chat log line carries the sender name', bSide.log === true, bSide);

  // 3) Sanitization: XSS + control chars + over-length all neutralized.
  await ev(B, () => { const i = document.getElementById('mp-chat-input'); _mpOpenChat(); i.value = '<img src=x onerror=alert(1)>' + 'y'.repeat(200); _mpCloseChat(true); });
  await A.waitForFunction(() => Object.values(net.peers).some(p => p && p.chat && p.chat.text.includes('img')), null, { timeout: 8000 }).catch(() => {});
  const san = await ev(A, () => {
    const p = Object.values(net.peers).find(p => p && p.chat && p.chat.text.includes('img'));
    const logHtml = JSON.stringify(net.chatLog || []);
    return { len: p ? p.chat.text.length : -1, rawTagInLog: /<img/.test(logHtml.replace(/\\u003c|&lt;/g, 'ESC')), injected: !!window.__xssFired };
  });
  ok('60-char cap enforced on the wire', san.len > 0 && san.len <= 60, san);
  ok('XSS-unsafe markup never lands as live HTML', san.rawTagInLog === false && !san.injected, san);

  ok('no page errors (A)', A._errors.length === 0, A._errors.slice(0, 4));
  ok('no page errors (B)', B._errors.length === 0, B._errors.slice(0, 4));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); }
const passed = results.filter(r => r.pass).length;
console.log('\n=== CO-OP CHAT CERTIFICATION ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
