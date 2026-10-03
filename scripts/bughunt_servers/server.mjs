// bughunt servers - the self-host relay + account server (server/): relay-1 (look/eq amplification, byte bucket), relay-3 (GET // kills the process),
// relay-4 (spoofable rate-limit key, sync scrypt on the event loop, username-enumeration timing), relay-6 (no pre-hello deadline, no ping/pong, no per-IP cap).
//   [SERVE_ROOT=<tree whose server/ is tested>] [PORT_SERVER=19230] [WS_DIR=<ws package dir>] node scripts/bughunt_servers/server.mjs
// Node only (node:sqlite, Node >= 22). server.js + auth.js are copied into a fixture folder with a throwaway database and run as child processes on
// PORT_SERVER / PORT_SERVER+1 (the second with TRUST_PROXY=1), killed by pid at the end.
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const SRC = path.resolve(process.env.SERVE_ROOT || REPO);
const PA = +(process.env.PORT_SERVER || 19230), PB = PA + 1;
let pass = 0, fail = 0;
const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d === undefined ? '' : '   ' + JSON.stringify(d).slice(0, 320))); ok ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 3000) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await sleep(25); return !!f(); };

const wsDir = (() => {
  const cands = [process.env.WS_DIR, path.join(SRC, 'server', 'node_modules', 'ws'), path.join(SRC, 'mp', 'node_modules', 'ws'), path.join(REPO, 'server', 'node_modules', 'ws'), path.join(REPO, 'mp', 'node_modules', 'ws')];
  for (const c of cands) if (c && fs.existsSync(path.join(c, 'package.json'))) return path.resolve(c);
  throw new Error('the ws package was not found (set WS_DIR)');
})();
const { WebSocket } = createRequire(import.meta.url)(wsDir);

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lxsv-'));
const DIR = path.join(TMP, 'server');
fs.mkdirSync(DIR, { recursive: true });
for (const f of ['server.js', 'auth.js']) fs.copyFileSync(path.join(SRC, 'server', f), path.join(DIR, f));
fs.cpSync(wsDir, path.join(DIR, 'node_modules', 'ws'), { recursive: true });

const kids = [];
const startServer = async (port, env, tries = 3) => {
  const c = spawn(process.execPath, ['--no-warnings', path.join(DIR, 'server.js')], { cwd: DIR, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), DB_PATH: path.join(TMP, 'db' + port + '.sqlite'), SECRET: 'bughunt-test-secret-0123456789', NODE_ENV: 'development', ...env } });
  c.logs = ''; c.stdout.on('data', (d) => { c.logs += d; }); c.stderr.on('data', (d) => { c.logs += d; });
  kids.push(c);
  for (let i = 0; i < 60 && c.exitCode === null && !/listening/.test(c.logs); i++) await sleep(100);
  if (c.exitCode !== null && /EADDRINUSE/.test(c.logs) && tries > 1) { await sleep(500); return startServer(port, env, tries - 1); }
  return c;
};
const json = (port, method, p, body, headers) => new Promise((resolve) => {
  const data = body === undefined ? null : JSON.stringify(body), t0 = Date.now();
  const r = http.request({ host: '127.0.0.1', port, path: p, method, agent: false, timeout: 15000, headers: { ...(data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {}), ...(headers || {}) } }, (res) => {
    const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => { let j = null; try { j = JSON.parse(Buffer.concat(c).toString()); } catch (e) { /* not json */ } resolve({ status: res.statusCode, json: j, ms: Date.now() - t0 }); });
  });
  r.on('error', (e) => resolve({ status: 0, json: null, err: e.code, ms: Date.now() - t0 })); r.on('timeout', () => { r.destroy(); resolve({ status: 0, json: null, err: 'timeout', ms: Date.now() - t0 }); });
  if (data) r.write(data); r.end();
});
const raw = (port, text) => new Promise((resolve) => {   // a request line Node's own client will not send
  const s = net.connect(port, '127.0.0.1'); let out = '';
  s.on('connect', () => s.write(text)); s.on('data', (d) => { out += d; }); s.on('error', (e) => resolve({ status: 0, err: e.code }));
  s.on('close', () => resolve({ status: +(/^HTTP\/1\.1 (\d+)/.exec(out) || [])[1] || 0, out }));
  setTimeout(() => { s.destroy(); }, 2500);
});
function client(port, opts) {
  const ws = new WebSocket('ws://127.0.0.1:' + port, opts); const msgs = []; const c = { ws, msgs, bytes: 0, code: null };
  ws.on('message', (d) => { c.bytes += d.length; try { msgs.push(JSON.parse(d)); } catch (e) { /* ignore */ } });
  ws.on('close', (code) => { c.code = code; c.closedAt = Date.now(); });
  ws.on('error', () => {});
  c.ready = new Promise((res) => { ws.on('open', res); ws.on('error', res); });
  c.send = (o) => { try { ws.send(JSON.stringify(o)); } catch (e) { /* closed */ } };
  c.all = (t) => msgs.filter((m) => m.t === t);
  c.last = (t) => [...msgs].reverse().find((m) => m.t === t);
  return c;
}
const hello = (name, room, extra) => ({ t: 'hello', name, room, cls: 'mage', level: 3, map: 'town', x: 100, y: 200, facing: 1, hp: 90, maxHp: 120, ...(extra || {}) });
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

try {
  console.log(`server/ under test: ${path.join(SRC, 'server')}  ws ${wsDir}  ports ${PA}, ${PB}`);
  let A = await startServer(PA, { MAX_CONN_PER_IP: '6', HELLO_MS: '1000', HB_MS: '500' }), crashes = 0;
  const up = async () => { if (A.exitCode !== null) { crashes++; A = await startServer(PA, { MAX_CONN_PER_IP: '6', HELLO_MS: '1000', HB_MS: '500' }); } };

  // ---- relay-3 ---------------------------------------------------------------------------------------------------------------------
  let r = await json(PA, 'GET', '/health');
  check(r.status === 200 && r.json && r.json.ok === true, 'baseline: /health answers', { s: r.status, err: r.err });
  for (const [label, fn] of [['GET //', () => raw(PA, 'GET // HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n')], ['GET ///', () => raw(PA, 'GET /// HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n')], ['GET http://[::1', () => raw(PA, 'GET http://[::1 HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n')]]) {
    await up(); const x = await fn(); await sleep(150); const alive = await json(PA, 'GET', '/health');
    check(x.status === 400 && alive.status === 200, `${label} answers 400 and the server stays up`, { s: x.status, err: x.err, aliveStatus: alive.status });
  }
  await up();

  // ---- accounts still work (async scrypt) --------------------------------------------------------------------------------------------
  const U = 'bhuser_' + Math.floor(Math.random() * 1e6), PW = 'correct-horse-9';
  r = await json(PA, 'POST', '/api/register', { username: U, password: PW });
  check(r.status === 201 && r.json && r.json.token && r.json.user && r.json.user.username === U, 'register: 201 + token + user', { s: r.status, j: r.json });
  const dup = await json(PA, 'POST', '/api/register', { username: U, password: PW });
  const weak = await json(PA, 'POST', '/api/register', { username: 'bhweak' + Math.floor(Math.random() * 1e5), password: 'short' });
  check(dup.status === 409 && weak.status === 400, 'register: a duplicate is 409, a short password 400', { dup: dup.status, weak: weak.status });
  const tok = r.json && r.json.token;
  r = await json(PA, 'GET', '/api/me', undefined, { authorization: 'Bearer ' + tok });
  check(r.status === 200 && r.json.user.username === U, 'a token from register opens /api/me');

  // ---- relay-4 (a): the rate-limit key ------------------------------------------------------------------------------------------------
  const codes = [];
  for (let i = 0; i < 14; i++) { const x = await json(PA, 'POST', '/api/login', { username: U, password: 'wrong-password-' + i }, { 'x-forwarded-for': '10.99.' + i + '.' + (i + 1) }); codes.push(x.status); }
  const n429 = codes.filter((c) => c === 429).length;
  check(n429 >= 3 && codes.slice(0, 10).every((c) => c === 401), '14 wrong logins with 14 spoofed X-Forwarded-For values hit the per-IP limit (10 a minute): ' + n429 + ' were 429', codes);
  r = await json(PA, 'POST', '/api/login', { username: U, password: PW }, { 'x-forwarded-for': '10.1.1.1' });
  check(r.status === 429, 'a spoofed address does not buy a fresh bucket', { s: r.status });

  // ---- relay-1 on A: amplification, types, byte bucket -----------------------------------------------------------------------------
  await up();
  const room = 'bh_ch1';
  const WA = client(PA), WB = client(PA); await WA.ready; await WB.ready;
  WA.send(hello('Alice', room)); WB.send(hello('Bob', room));
  await until(() => WA.last('welcome') && WB.last('welcome'));
  check(WA.last('welcome') && WB.last('welcome') && WB.last('welcome').players.length === 1, 'baseline: two players meet', { a: !!WA.last('welcome'), b: !!WB.last('welcome') });
  WA.send({ t: 'state', x: 137, y: 200, anim: 'run', facing: -1, hp: 80, level: 3, cls: 'mage' }); await until(() => WB.last('state'));
  const s0 = WB.last('state');
  check(s0 && s0.x === 137 && s0.anim === 'run' && s0.name === 'Alice' && s0.cls === 'mage', 'baseline: a state frame relays presence (x, anim, name, cls)', s0);
  await sleep(60);   // (server/ drops a state frame that follows the last by under 40 ms)
  const b0 = WB.bytes;
  WA.send({ t: 'state', look: { h: 1, pad: 'x'.repeat(60000) } });
  for (let i = 0; i < 10; i++) { await sleep(55); WA.send({ t: 'state', x: 200 + i }); }
  await sleep(300);
  const recv = WB.bytes - b0;
  check(recv < 12000, 'a 60 KB look is not re-sent on every state frame: B received ' + recv + ' bytes (it was ~600 KB for 10 states)', { bytes: recv });
  const WC = client(PA); await WC.ready; WC.send(hello('Cara', room)); await until(() => WC.last('welcome'));
  const al = (WC.last('welcome') || { players: [] }).players.find((p) => p.name === 'Alice');
  check(al && !al.look && al.x === 209, 'the oversized look was never stored; the small updates were', al && { look: !!al.look, x: al.x });
  const LOOK = { h: 'hair_3', e: 'eyes_2', s: 2 }, EQ = { weapon: { sid: 'blade_a', bn: 'Iron Blade' } };
  await sleep(55); WA.send({ t: 'state', look: LOOK, eq: EQ, ti: 'Champion' }); await until(() => WB.msgs.some((m) => m.t === 'state' && m.look));
  const wl = WB.msgs.find((m) => m.t === 'state' && m.look);
  check(wl && JSON.stringify(wl.look) === JSON.stringify(LOOK) && JSON.stringify(wl.eq) === JSON.stringify(EQ) && wl.ti === 'Champion', 'a normal look + eq ride the frame that carries them', wl);
  const n0 = WB.msgs.length; await sleep(55); WA.send({ t: 'state', x: 300 }); await until(() => WB.msgs.length > n0);
  const nx = WB.msgs[WB.msgs.length - 1];
  check(nx.t === 'state' && nx.x === 300 && nx.look === undefined && nx.eq === undefined && nx.name === 'Alice' && nx.ti === 'Champion', 'the next plain state frame carries no look / eq (name and title stay)', nx);
  const WD = client(PA); await WD.ready; WD.send(hello('Dan', room)); await until(() => WD.last('welcome'));
  const ad = WD.last('welcome').players.find((p) => p.name === 'Alice');
  check(ad && JSON.stringify(ad.look) === JSON.stringify(LOOK) && JSON.stringify(ad.eq) === JSON.stringify(EQ), 'a late joiner gets the stored look + eq in welcome');
  const p0 = WB.all('ping').length;
  for (let i = 0; i < 50; i++) WA.send({ t: 'ping', pad: 'p'.repeat(50 * 1024) });
  await sleep(1500);
  const got = WB.all('ping').length - p0;
  check(got >= 8 && got <= 24, 'a flood of fifty 50 KB pings is cut to the byte budget: B got ' + got + ' of 50', { got });
  await sleep(1500); const p1 = WB.all('ping').length; WA.send({ t: 'ping', pad: 'small' });
  check(await until(() => WB.all('ping').length > p1, 2000), 'and the relay relays again once the bucket refills');
  const h0 = WB.all('ping').length;
  for (let i = 0; i < 10; i++) { WA.send({ t: 'ping', cpp: 'paint', cpd: 'q'.repeat(56 * 1024) }); await sleep(300); }
  await sleep(400);
  check(WB.all('ping').length - h0 === 10, 'honest traffic (a 56 KB paint piece every 300 ms) is relayed in full', { got: WB.all('ping').length - h0 });
  for (const c of [WA, WB, WC, WD]) c.ws.close();
  await sleep(300);

  // ---- relay-6: hello deadline, per-IP cap, ping/pong ------------------------------------------------------------------------------------
  const Z = client(PA); await Z.ready; const tz = Date.now();
  const Y = client(PA); await Y.ready; Y.send(hello('Yan', 'bh_ch9')); await until(() => Y.last('welcome'));
  await until(() => Z.code !== null, 4000);
  check(Z.code !== null && Z.closedAt - tz < 3500, 'a socket that never says hello is closed by the deadline (1 s here): ' + (Z.code !== null ? Math.round(Z.closedAt - tz) + ' ms' : 'still open after 4 s'), { code: Z.code });
  check(Y.code === null && Y.ws.readyState === 1, 'a socket that said hello is left alone');
  Y.ws.close(); await sleep(300);
  const many = []; for (let i = 0; i < 9; i++) { const c = client(PA); many.push(c); await c.ready; c.send(hello('M' + i, 'bh_cap')); await sleep(40); }
  await sleep(500);
  const refused = many.filter((c) => c.code === 1013).length, live = many.filter((c) => c.code === null).length;
  check(refused === 3 && live === 6, 'concurrent sockets per IP are capped (6 here): ' + live + ' live, ' + refused + ' refused with 1013', { refused, live, codes: many.map((c) => c.code) });
  for (const c of many) c.ws.close();
  await sleep(400);
  const again = client(PA); await again.ready; again.send(hello('Again', 'bh_cap2')); await until(() => again.last('welcome'));
  check(!!again.last('welcome'), 'closed sockets free their slot (a new one is welcomed)');
  again.ws.close();
  const P = client(PA, { autoPong: false }); await P.ready; P.send(hello('Mute', 'bh_pong')); await until(() => P.last('welcome'));
  const tp = Date.now(); await until(() => P.code !== null, 6000);
  check(P.code !== null && P.closedAt - tp < 5000, 'a peer that never answers the ping is terminated (ping/pong, 0.5 s here): ' + (P.code !== null ? Math.round(P.closedAt - tp) + ' ms' : 'still open after 6 s'), { code: P.code });
  check(A.exitCode === null && crashes === 0, 'server A never exited during the run', { crashes, logs: A.logs.slice(-200) });

  // ---- relay-4 (b)(c) + the proxy mode, on a TRUST_PROXY=1 server (each request names its own right-most address) -------------------------
  const B = await startServer(PB, { TRUST_PROXY: '1' });
  const ipHdr = (client) => ({ 'x-forwarded-for': 'spoof-' + Math.random().toString(36).slice(2) + ', ' + client });
  await json(PB, 'POST', '/api/register', { username: U, password: PW }, ipHdr('172.16.0.1'));
  const same = []; for (let i = 0; i < 12; i++) same.push((await json(PB, 'POST', '/api/login', { username: U, password: 'nope-' + i }, ipHdr('172.16.9.9'))).status);
  const other = await json(PB, 'POST', '/api/login', { username: U, password: 'nope' }, ipHdr('172.16.9.10'));
  check(same.slice(0, 10).every((c) => c === 401) && same.slice(10).every((c) => c === 429) && other.status === 401, 'TRUST_PROXY=1: the right-most X-Forwarded-For entry is the key (left-most spoofs do not matter; another client has its own bucket)', { same, other: other.status });
  const timeLogin = async (user, i) => (await json(PB, 'POST', '/api/login', { username: user, password: 'wrong-pass-' + i }, ipHdr('172.20.' + i + '.' + i))).ms;
  const ex = [], mi = [];
  for (let i = 0; i < 3; i++) { ex.push(await timeLogin(U, i + 1)); mi.push(await timeLogin('nobody_' + Math.floor(Math.random() * 1e6), i + 11)); }
  const mE = med(ex), mM = med(mi);
  check(mM >= 0.5 * mE, 'a login for an unknown name costs as much as for a real account (no enumeration oracle): unknown ' + mM + ' ms vs existing ' + mE + ' ms', { ex, mi });
  // the event loop keeps relaying while logins hash
  const pend = []; for (let i = 0; i < 4; i++) pend.push(timeLogin(U, i + 21));
  await sleep(30);
  const lat = []; for (let i = 0; i < 5; i++) { lat.push((await json(PB, 'GET', '/health')).ms); await sleep(40); }
  await Promise.all(pend);
  check(Math.max(...lat) < 120, 'GET /health stays prompt while four logins hash (worst ' + Math.max(...lat) + ' ms; scryptSync froze the loop for ~1 s)', { lat });
  check(B.exitCode === null, 'server B never exited during the run', { logs: B.logs.slice(-200) });
} finally {
  for (const k of kids) { try { k.kill(); } catch (e) { /* gone */ } }
  await sleep(400);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* a lingering sqlite handle: the OS temp sweep gets it */ }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
