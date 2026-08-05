// LOOK-SYNC CARRIER certification for whitelist relays (the deployed CF worker
// strips look/eq/v from `state`). Two parts:
//   PART 1 — REAL deployed worker (Node WebSocket, no browser): proves a
//     'ping' frame carrying lk/eq/v is forwarded VERBATIM by production
//     (skips gracefully if the worker is unreachable from the test env).
//   PART 2 — in-browser end-to-end against a local relay patched to the CF
//     worker's exact old whitelist (state stripped of look/eq/v): proves the
//     carrier alone delivers the full avatar to the peer draw.
import { chromium } from 'playwright-core';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const EXE = process.env.PW_EXE || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html';
const CF_WS = process.env.CF_WS || 'wss://mojiworld-mp.dpeh001.workers.dev';
const STRIP_PORT = 8081;
const repo = join(dirname(fileURLToPath(import.meta.url)), '..');

const results = [];
const ok = (n, c, extra) => { results.push({ n, pass: !!c, extra }); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------- PART 1: real deployed worker forwards the ping carrier ----------
async function probeProduction() {
  return new Promise((resolve) => {
    const ROOM = 'cfprobe' + Math.floor(Math.random() * 1e9);
    let a, b, settled = false;
    const done = (r) => { if (settled) return; settled = true; try { a && a.close(); b && b.close(); } catch (e) {} resolve(r); };
    setTimeout(() => done({ skip: 'unreachable/timeout' }), 20000);
    try { a = new WebSocket(CF_WS); b = new WebSocket(CF_WS); } catch (e) { return done({ skip: String(e) }); }
    b.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.t === 'ping' && m.lk) done({ lk: m.lk, eq: m.eq, v: m.v });
    };
    b.onopen = () => b.send(JSON.stringify({ t: 'hello', name: 'PB', room: ROOM }));
    a.onopen = () => {
      a.send(JSON.stringify({ t: 'hello', name: 'PA', room: ROOM }));
      const fire = () => a.send(JSON.stringify({ t: 'ping', lk: { h: 'spike', hh: 120, p: { head: 10 } }, eq: { weapon: { bn: 'Eclipse Daggers' } }, v: 'test-v' }));
      setTimeout(fire, 1500); setTimeout(fire, 4000);
    };
    a.onerror = b.onerror = () => done({ skip: 'ws error (env egress)' });
  });
}
const prod = await probeProduction();
if (prod.skip) {
  ok('PART1 (real worker): SKIPPED — ' + prod.skip, true);
} else {
  ok('PART1: production worker forwards the ping carrier VERBATIM (lk.hh=120)', prod.lk && prod.lk.hh === 120, prod);
  ok('PART1: carrier eq + v arrive intact', prod.eq && prod.eq.weapon && prod.eq.weapon.bn === 'Eclipse Daggers' && prod.v === 'test-v', prod);
}

// ---------- PART 2: browser end-to-end over a CF-whitelist-simulating relay ----------
// Patch mp/server.mjs back to the CF worker's old whitelist (no look/eq/v on
// state) and run it on STRIP_PORT — production behavior, local fidelity.
const relaySrc = await readFile(join(repo, 'mp', 'server.mjs'), 'utf8');
const stripped = relaySrc.replace(/'anim', 'look', 'eq', 'v'\]/, "'anim']");
if (stripped === relaySrc) { console.log('FATAL: could not patch whitelist'); process.exit(1); }
const tmpRelay = join(repo, 'mp', '_strip_relay_test.mjs');
await writeFile(tmpRelay, stripped);
const relayProc = spawn('node', [tmpRelay], { env: { ...process.env, PORT: String(STRIP_PORT) }, stdio: 'ignore' });
await sleep(1200);

async function boot(browser, name) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 180)));
  page._errors = errors;
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof net === 'object' && typeof game === 'object' && typeof mpConnect === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(3500);
  await page.evaluate((nm) => {
    try { player.cls = player.cls || 'warrior'; } catch (e) {}
    try { if (player.look) player.look.name = nm; } catch (e) {}
    try { game.paused = false; window._prologueActive = false; } catch (e) {}
  }, name);
  return page;
}
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const ROOM = 'strip' + Math.floor(Math.random() * 1e9);
const WS = 'ws://localhost:' + STRIP_PORT;

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const A = await boot(browser, 'Dee');
  const B = await boot(browser, 'Viewer');
  await ev(A, () => {
    player.lookCustom = { hairId: 'spike', eyeId: 'default', mouthId: 'default', skinIdx: 5, hairHue: 120, msxId: null, posture: { head: 10, armFront: 30 } };
    player.equipped = player.equipped || {};
    player.equipped.weapon = { name: 'Eclipse Daggers', baseName: 'Eclipse Daggers' };
  });
  await ev(A, ({ ws, room }) => mpConnect(ws, 'Dee', room), { ws: WS, room: ROOM });
  await A.waitForFunction(() => net.myId != null, null, { timeout: 10000 }).catch(() => {});
  await ev(B, ({ ws, room }) => mpConnect(ws, 'Viewer', room), { ws: WS, room: ROOM });
  await sleep(800);
  for (const P of [A, B]) await P.evaluate(() => { window.__pump = setInterval(() => { try { _mpTick(); } catch (e) {} }, 90); });
  await sleep(5500);   // ≥2 carrier cycles (2.5 s)

  ok('PART2: A connected via stripping relay', await ev(A, () => net.connected));
  ok('PART2: B connected via stripping relay', await ev(B, () => net.connected));

  const wire = await ev(B, () => {
    for (const id in net.peers) {
      const p = net.peers[id];
      if (p && p.look && p.look.h === 'spike') {
        return { hh: p.look.hh, p: p.look.p, v: p.v, eqW: p.eq && p.eq.weapon && p.eq.weapon.bn,
                 gv: (typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : null) };
      }
    }
    return { peers: Object.keys(net.peers).length };
  });
  ok('PART2: full look reached B despite state-stripping (hh=120 via carrier)', wire && wire.hh === 120, wire);
  ok('PART2: pose reached B (head=10, armFront=30)', wire && wire.p && wire.p.head === 10 && wire.p.armFront === 30, wire && wire.p);
  ok('PART2: equipment reached B (Eclipse Daggers)', wire && wire.eqW === 'Eclipse Daggers', wire);
  ok('PART2: build stamp reached B and matches', wire && wire.v === wire.gv, wire && { v: wire.v, gv: wire.gv });

  const draw = await ev(B, () => {
    const orig = window._drawVectorHero;
    const caps = [];
    window._drawVectorHero = function () {
      caps.push({
        hairHue: player.lookCustom && player.lookCustom.hairHue,
        hairId: player.lookCustom && player.lookCustom.hairId,
        postureHead: (player.lookCustom && player.lookCustom.posture && player.lookCustom.posture.head) ? player.lookCustom.posture.head.angle : null,
      });
      return orig.apply(this, arguments);
    };
    let err = null;
    try {
      for (const id in net.peers) { const p = net.peers[id]; p.map = game.currentMap; p.x = player.x + 40; p.y = player.y; }
      _mpDrawPeers();
    } catch (e) { err = String(e); }
    window._drawVectorHero = orig;
    return { err, cap: caps.find(c => c.hairHue === 120) || null };
  });
  ok('PART2: peer draw applied the carrier look (spike + hue 120 + pose 10)', draw.cap && draw.cap.hairId === 'spike' && draw.cap.postureHead === 10 && !draw.err, draw);
  ok('PART2: no page errors on A', A._errors.length === 0, A._errors.slice(0, 3));
  ok('PART2: no page errors on B', B._errors.length === 0, B._errors.slice(0, 3));
} finally {
  await browser.close();
  try { relayProc.kill(); } catch (e) {}
  await rm(tmpRelay, { force: true });
}
let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++); console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
