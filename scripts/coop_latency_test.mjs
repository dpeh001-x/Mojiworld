// CO-OP LATENCY / FEEL certification.
//   1. Peer dead-reckoning: partner avatars extrapolate by broadcast velocity
//      between snapshots (render position moves AHEAD of the stale snapshot).
//   2. State-payload slimming: look/eq ride the tick only on change + ~700 ms
//      refresher (steady ticks stay small); an equip swap still appears
//      within one tick.
//   3. RTT probe: both clients measure the full two-leg round trip via the
//      carrier echo, and the party frames render the ping chip.
import { chromium } from 'playwright-core';

const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html';
const WS  = 'ws://localhost:8080';
const ROOM = 'lat' + Math.floor(Math.random() * 1e9);

const results = [];
const ok = (n, c, extra) => { results.push({ n, pass: !!c, extra }); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function boot(browser, name) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  page._errors = errs;
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof net === 'object' && typeof mpConnect === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(3200);
  await page.evaluate((nm) => { try { player.cls = player.cls || 'warrior'; if (player.look) player.look.name = nm; game.paused = false; window._prologueActive = false; } catch (e) {} }, name);
  return page;
}
const ev = (page, fn, arg) => page.evaluate(fn, arg);

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const A = await boot(browser, 'Dee');
  const B = await boot(browser, 'Viewer');
  await ev(A, ({ ws, room }) => mpConnect(ws, 'Dee', room), { ws: WS, room: ROOM });
  await A.waitForFunction(() => net.myId != null, null, { timeout: 10000 }).catch(() => {});
  await ev(B, ({ ws, room }) => mpConnect(ws, 'Viewer', room), { ws: WS, room: ROOM });
  await B.waitForFunction(() => net.connected && net.myId != null, null, { timeout: 10000 }).catch(() => {});
  await sleep(400);
  ok('A connected', await ev(A, () => net.connected));
  ok('B connected', await ev(B, () => net.connected));

  // 1) DEAD-RECKONING: converge the render pos onto a snapshot, then age the
  // snapshot with a running velocity — the render pos must move AHEAD of the
  // raw snapshot x (impossible under the old lerp-to-snapshot).
  const dr = await ev(B, () => {
    let peer = null;
    for (const id in net.peers) peer = net.peers[id];
    if (!peer) return { noPeer: true };
    peer.map = game.currentMap;
    peer.x = 500; peer.y = player.y; peer.vx = 3; peer.vy = 0; peer.anim = 'run';
    peer._rx = 500; peer._ry = player.y;              // converged on the snapshot
    peer._snapAt = performance.now() - 120;           // snapshot is ~7 frames old
    for (let i = 0; i < 12; i++) { try { _mpDrawPeers(); } catch (e) {} }
    return { rx: Math.round(peer._rx * 10) / 10, snapshotX: 500, ahead: peer._rx > 500.5 };
  });
  ok('partner avatar extrapolates AHEAD of the stale snapshot (dead-reckoning)', dr.ahead, dr);

  // 2) PAYLOAD SLIMMING: count look-bearing state frames across ~30 ticks,
  // then swap equipment and confirm the very next tick carries the new look.
  const slim = await ev(A, async () => {
    const sent = [];
    const origSend = net.ws.send.bind(net.ws);
    net.ws.send = (s) => { try { const o = JSON.parse(s); if (o.t === 'state') sent.push(!!o.look); } catch (e) {} return origSend(s); };
    const tick = () => { net._lastTickAt = 0; try { _mpTick(); } catch (e) {} };
    for (let i = 0; i < 30; i++) { tick(); await new Promise(r => setTimeout(r, 20)); }
    const steadyWith = sent.filter(Boolean).length, steadyTotal = sent.length;
    // equip swap -> next tick must carry look/eq
    sent.length = 0;
    player.equipped = player.equipped || {};
    player.equipped.weapon = { name: 'Frost Fang', baseName: 'Frost Fang' };
    tick();
    const swapImmediate = sent[0] === true;
    net.ws.send = origSend;
    return { steadyWith, steadyTotal, swapImmediate };
  });
  ok('steady-state ticks mostly OMIT look/eq (~10% refresher)', slim.steadyTotal >= 25 && slim.steadyWith <= Math.ceil(slim.steadyTotal * 0.25), slim);
  ok('an equip swap ships on the VERY NEXT tick', slim.swapImmediate, slim);

  // 3) RTT: wait for two carrier cycles; both sides should have a measured
  // round trip, and the party frames should show the ping chip.
  for (const P of [A, B]) await P.evaluate(() => { window.__pump = setInterval(() => { try { _mpTick(); } catch (e) {} }, 90); });
  await sleep(6500);
  const rttA = await ev(A, () => { for (const id in net.peers) return net.peers[id]._rttMs; return null; });
  const rttB = await ev(B, () => { for (const id in net.peers) return net.peers[id]._rttMs; return null; });
  ok('A measured round-trip latency to partner', typeof rttA === 'number' && rttA >= 0 && rttA < 5000, { rttA: Math.round(rttA || -1) });
  ok('B measured round-trip latency to partner', typeof rttB === 'number' && rttB >= 0 && rttB < 5000, { rttB: Math.round(rttB || -1) });
  const chip = await ev(B, () => {
    for (const id in net.peers) { const p = net.peers[id]; p.map = game.currentMap; }
    try { _mpPartyFrames(); } catch (e) {}
    const host = document.getElementById('party-frames');
    return host ? (host.innerHTML.indexOf('pf-ping') >= 0 && /\d+ms/.test(host.innerHTML)) : false;
  });
  ok('party frames render the live ping chip', chip);

  ok('no page errors on A', A._errors.length === 0, A._errors.slice(0, 3));
  ok('no page errors on B', B._errors.length === 0, B._errors.slice(0, 3));
} finally {
  await browser.close();
}
let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++); console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
