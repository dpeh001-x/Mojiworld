// Live test: TITLES TRAVEL TO CO-OP PARTNERS (per user: "make sure other
// players in the same room can see the title").
//
// Exercises the three real links in the chain without standing up a relay:
//   SEND    — _mpTick's frames, captured off a stubbed net.ws.send
//   RECEIVE — _mpHandle's 'ping' and 'state' paths merging 'ti' onto the peer
//   DRAW    — _mpDrawPeers painting it under the partner's name tag
// Also covers the two things that quietly break this kind of feature: a peer
// on ANOTHER map must not paint, and UNequipping must actually clear on the
// partner's screen rather than sticking forever.
//   node scripts/mp_title_sync_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _mpTick === 'function' && typeof _mpDrawPeers === 'function'
  && typeof _mpHandle === 'function', null, { timeout: 120000 });
await page.waitForTimeout(2500);

const r = await page.evaluate(() => {
  const out = {};
  game.paused = true;
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  player.cls = player.cls || 'warrior';
  player.look = player.look || {}; player.look.name = 'Testarossa';
  player.equippedTitle = 'Conqueror of Mojiworld';

  // ---- SEND: capture what _mpTick puts on the wire ----
  const sent = [];
  net.connected = true;
  net.myId = 'me';
  net.ws = { readyState: 1, send: (s) => { try { sent.push(JSON.parse(s)); } catch (e) {} } };
  net.peers = {};
  net._lastTickAt = 0; net._lastLookSyncAt = 0; net._tickN = 0; net._lastAvStr = null;
  try { _mpTick(); } catch (e) { out.tickThrew = String(e).slice(0, 140); }
  const ping = sent.find(m => m.t === 'ping');
  const state = sent.find(m => m.t === 'state');
  out.pingTi = ping ? ping.ti : '(no ping)';
  out.stateTi = state ? state.ti : '(no state)';

  // a title change must go out on the very next tick, not wait for the
  // ~700ms refresher — that is what folding it into _avStr buys
  player.equippedTitle = 'Echo Walker';
  sent.length = 0; net._lastTickAt = 0; net._lastLookSyncAt = performance.now();
  try { _mpTick(); } catch (e) {}
  const st2 = sent.find(m => m.t === 'state');
  out.changeTi = st2 ? st2.ti : '(none)';

  // unequipping must transmit '' rather than omitting the key
  player.equippedTitle = '';
  sent.length = 0; net._lastTickAt = 0;
  try { _mpTick(); } catch (e) {}
  const st3 = sent.find(m => m.t === 'state');
  out.clearTi = st3 ? JSON.stringify(st3.ti) : '(none)';
  player.equippedTitle = 'Conqueror of Mojiworld';

  // ---- RECEIVE: both inbound paths ----
  net.peers = {};
  _mpHandle({ t: 'ping', id: 'friend', lk: {}, ti: 'Conqueror of Mojiworld' });
  out.rxPing = net.peers.friend ? net.peers.friend.ti : '(no peer)';
  net.peers = {};
  _mpHandle({ t: 'state', id: 'friend2', x: 100, y: 100, map: game.currentMap,
              name: 'Partner', level: 60, ti: 'Conqueror of Mojiworld' });
  out.rxState = net.peers.friend2 ? net.peers.friend2.ti : '(no peer)';
  // a hostile title must be scrubbed like every other inbound string
  net.peers = {};
  _mpHandle({ t: 'ping', id: 'bad', lk: {}, ti: '<script>x</script>' + 'y'.repeat(90) });
  const badTi = net.peers.bad ? net.peers.bad.ti : '';
  out.scrubbed = badTi.indexOf('<') < 0 && badTi.indexOf('>') < 0 && badTi.length <= 64;

  // ---- DRAW: what does the partner's nameplate paint? ----
  const paint = (peer) => {
    net.peers = { pal: peer };
    const painted = [];
    const _ft = ctx.fillText;
    ctx.fillText = function (t) { painted.push(String(t)); return _ft.apply(this, arguments); };
    try { _mpDrawPeers(); } catch (e) { painted.push('THREW:' + e); }
    ctx.fillText = _ft;
    return painted;
  };
  const base = { id: 'pal', name: 'Partner', level: 60, map: game.currentMap,
                 x: player.x + 40, y: player.y, vx: 0, vy: 0, hp: 100, maxHp: 100, _last: performance.now() };
  out.drawWith = paint(Object.assign({}, base, { ti: 'Conqueror of Mojiworld' }));
  out.drawWithout = paint(Object.assign({}, base, { ti: '' }));
  out.drawOtherMap = paint(Object.assign({}, base, { ti: 'Conqueror of Mojiworld', map: '__elsewhere__' }));
  net.peers = {}; net.connected = false; net.ws = null;
  return out;
});

const D = '\u2756';
const line = `${D} CONQUEROR OF MOJIWORLD ${D}`;
const hasTitle = (a) => (a || []).some(t => /CONQUEROR/i.test(t));
ok('the tick runs clean', !r.tickThrew, r.tickThrew);
ok('SEND: the title rides the 2.5s ping carrier (the path the CF relay forwards verbatim)',
  r.pingTi === 'Conqueror of Mojiworld', { pingTi: r.pingTi });
ok('SEND: ...and the state frame too (the fast path)',
  r.stateTi === 'Conqueror of Mojiworld', { stateTi: r.stateTi });
ok('SEND: changing title goes out on the NEXT tick, not on the 700ms refresher',
  r.changeTi === 'Echo Walker', { changeTi: r.changeTi });
ok('SEND: unequipping transmits an empty string, so it can actually be cleared',
  r.clearTi === '""', { clearTi: r.clearTi });
ok('RECEIVE: the ping path merges the title onto the peer',
  r.rxPing === 'Conqueror of Mojiworld', { rxPing: r.rxPing });
ok('RECEIVE: the state path merges it too',
  r.rxState === 'Conqueror of Mojiworld', { rxState: r.rxState });
ok('RECEIVE: a hostile title is scrubbed and length-capped like any inbound string',
  r.scrubbed, { scrubbed: r.scrubbed });
ok('DRAW: a partner in the room shows name AND title',
  (r.drawWith || []).some(t => /Partner/.test(t)) && hasTitle(r.drawWith), r.drawWith);
ok('DRAW: the partner title is the same regalia as the local one',
  (r.drawWith || []).includes(line), { line: (r.drawWith || []).find(t => /CONQUEROR/i.test(t)) });
ok('DRAW: a partner with no title paints only their name', !hasTitle(r.drawWithout), r.drawWithout);
ok('DRAW: a partner on ANOTHER map paints nothing at all',
  (r.drawOtherMap || []).length === 0, r.drawOtherMap);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
