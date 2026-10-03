// bughunt servers - the Render / self-host relay (mp/server.mjs): relay-1 (look/eq amplification + byte bucket), relay-3 (GET /% kills the
// process) + V-net-1 (sibling-prefix escape, dotfiles), relay-6 (no pre-hello deadline).
//   [SERVE_ROOT=<tree whose mp/server.mjs is tested>] [PORT_MP=19200] [WS_DIR=<ws package dir>] node scripts/bughunt_servers/mp.mjs
// Node only. mp/server.mjs is copied into a fixture tree (its ROOT is the parent of its folder, so the sibling escape needs a fixture),
// run as a child process on PORT_MP with a 1.2 s hello deadline, and killed by pid at the end.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const SRC = path.resolve(process.env.SERVE_ROOT || REPO);
const PORT = +(process.env.PORT_MP || 19200);
const HELLO_MS = 1200;
let pass = 0, fail = 0;
const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d === undefined ? '' : '   ' + JSON.stringify(d).slice(0, 320))); ok ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 3000) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await sleep(25); return !!f(); };

const wsDir = (() => {   // the ws package this tree's relay would load
  const cands = [process.env.WS_DIR, path.join(SRC, 'mp', 'node_modules', 'ws'), path.join(REPO, 'mp', 'node_modules', 'ws'), path.join(REPO, 'server', 'node_modules', 'ws')];
  for (const c of cands) if (c && fs.existsSync(path.join(c, 'package.json'))) return path.resolve(c);
  try { return path.dirname(createRequire(path.join(SRC, 'mp', 'server.mjs')).resolve('ws/package.json')); } catch (e) { /* none */ }
  throw new Error('the ws package was not found (set WS_DIR)');
})();
const { WebSocket } = createRequire(import.meta.url)(wsDir);

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lxmp-'));
const ROOT = path.join(TMP, 'root'), SIB = path.join(TMP, 'root-sib');
const w = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
w(path.join(ROOT, 'mp', 'mp_demo.html'), '<html>DEMO</html>');
w(path.join(ROOT, '.git', 'HEAD'), 'ref: refs/heads/main');
w(path.join(SIB, 'secret.txt'), 'SIBLINGSECRET');
fs.copyFileSync(path.join(SRC, 'mp', 'server.mjs'), path.join(ROOT, 'mp', 'server.mjs'));
fs.cpSync(wsDir, path.join(ROOT, 'mp', 'node_modules', 'ws'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'mp', 'package.json'), '{"type":"module"}');

const kids = [];
const startRelay = async (tries = 4) => {
  const c = spawn(process.execPath, [path.join(ROOT, 'mp', 'server.mjs')], { cwd: path.join(ROOT, 'mp'), stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: String(PORT), HB_MS: '2000', HELLO_MS: String(HELLO_MS) } });
  c.logs = ''; c.stdout.on('data', (d) => { c.logs += d; }); c.stderr.on('data', (d) => { c.logs += d; });
  kids.push(c);
  for (let i = 0; i < 50 && c.exitCode === null && !/relay on/.test(c.logs); i++) await sleep(100);
  if (c.exitCode !== null && /EADDRINUSE/.test(c.logs) && tries > 1) { await sleep(500); return startRelay(tries - 1); }   // the previous relay's port is still closing
  return c;
};
const stopRelay = async (c) => { try { c.kill(); } catch (e) { /* gone */ } for (let i = 0; i < 30 && c.exitCode === null; i++) await sleep(50); await sleep(300); };
const req = (p) => new Promise((resolve) => {
  const r = http.request({ host: '127.0.0.1', port: PORT, path: p, agent: false, timeout: 4000 }, (res) => { const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString() })); });
  r.on('error', (e) => resolve({ status: 0, body: '', err: e.code })); r.on('timeout', () => { r.destroy(); resolve({ status: 0, body: '', err: 'timeout' }); }); r.end();
});
function client() {
  const ws = new WebSocket('ws://127.0.0.1:' + PORT); const msgs = []; const c = { ws, msgs, bytes: 0, code: null };
  ws.on('message', (d) => { c.bytes += d.length; try { msgs.push(JSON.parse(d)); } catch (e) { /* ignore */ } });
  ws.on('close', (code) => { c.code = code; c.closedAt = Date.now(); });
  ws.on('error', () => {});
  c.ready = new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  c.send = (o) => ws.send(JSON.stringify(o));
  c.all = (t) => msgs.filter((m) => m.t === t);
  c.last = (t) => [...msgs].reverse().find((m) => m.t === t);
  return c;
}
const hello = (name, room, extra) => ({ t: 'hello', name, room, cls: 'mage', level: 3, map: 'town', x: 100, y: 200, facing: 1, hp: 90, maxHp: 120, mp: 5, maxMp: 9, ...(extra || {}) });

try {
  console.log(`mp/server.mjs under test: ${path.join(SRC, 'mp', 'server.mjs')}  ws ${wsDir}  port ${PORT}`);

  // ---- relay-3 / V-net-1: the static host half -------------------------------------------------------------------------
  let srv = await startRelay(), crashes = 0;
  const up = async () => { if (srv.exitCode !== null) { crashes++; srv = await startRelay(); } };
  let r = await req('/');
  check(r.status === 200 && r.body === '<html>DEMO</html>', '/ serves the demo page', { s: r.status, err: r.err });
  for (const p of ['/%', '/%E0%A4%A', '/a%00b', '/%00']) {
    await up(); r = await req(p); await sleep(80); const alive = await req('/');
    check(r.status === 400 && alive.status === 200, `GET ${p} answers 400 and the relay stays up`, { s: r.status, err: r.err, aliveStatus: alive.status, exit: srv.exitCode });
  }
  for (const p of ['/../root-sib/secret.txt', '//../root-sib/secret.txt', '/%2e%2e/root-sib/secret.txt']) {
    await up(); r = await req(p);
    check((r.status === 403 || r.status === 404) && !/SIBLINGSECRET/.test(r.body), `sibling-prefix escape ${p} is refused`, { s: r.status, leaked: /SIBLINGSECRET/.test(r.body) });
  }
  for (const p of ['/.git/HEAD', '/%2egit/HEAD']) { await up(); r = await req(p); check(r.status === 404 && !/refs/.test(r.body), `${p} is not served`, { s: r.status }); }
  await up();
  check(crashes === 0, 'the relay process never exited during the HTTP probes', { crashes, logs: srv.logs.slice(-200) });
  await stopRelay(srv);

  // ---- WebSocket half: a fresh relay ------------------------------------------------------------------------------------
  srv = await startRelay();
  const room = 'bh__ch1';
  const A = client(); await A.ready; A.send(hello('Alice', room)); await until(() => A.last('welcome'));
  const B = client(); await B.ready; B.send(hello('Bob', room)); await until(() => B.last('welcome'));
  check(A.last('welcome') && B.last('welcome') && B.last('welcome').players.length === 1, 'baseline: two players meet', { a: !!A.last('welcome'), b: !!B.last('welcome') });
  A.send({ t: 'state', x: 137, y: 200, map: 'town', anim: 'run', facing: -1, hp: 80, maxHp: 120, level: 3, cls: 'mage' });
  await until(() => B.last('state'));
  const s0 = B.last('state');
  check(s0 && s0.x === 137 && s0.anim === 'run' && s0.cls === 'mage' && s0.name === 'Alice' && s0.id === A.last('welcome').id, 'baseline: a state frame relays full presence (name, cls, anim, x)', s0);

  // relay-1: one oversized look, then thirty tiny states
  const b0 = B.bytes;
  A.send({ t: 'state', look: { h: 1, pad: 'x'.repeat(60000) } });
  for (let i = 0; i < 30; i++) A.send({ t: 'state', x: 200 + i });
  await until(() => B.all('state').filter((m) => m.x === 229).length >= 1, 2500); await sleep(300);
  const recv = B.bytes - b0;
  check(recv < 12000, 'a 60 KB look is not re-sent on every state frame: B received ' + recv + ' bytes for ~61 KB sent (it was ~1.8 MB)', { bytes: recv });
  check(B.all('state').every((m) => !m.look || JSON.stringify(m.look).length <= 1024), 'no oversized look ever reaches a peer');
  const C = client(); await C.ready; C.send(hello('Cara', room)); await until(() => C.last('welcome'));
  const alice = (C.last('welcome') || { players: [] }).players.find((p) => p.name === 'Alice');
  check(alice && !alice.look && alice.x === 229, 'the oversized look was not stored (a late joiner gets none), the small updates were', alice && { look: alice.look && 'present', x: alice.x });

  // look / eq of normal size: carried by the frame that has them, stored for late joiners, not repeated on the next state
  const LOOK = { h: 'hair_3', e: 'eyes_2', m: 'mouth_1', s: 2, hh: 40 }, EQ = { weapon: { sid: 'blade_a', bn: 'Iron Blade', tn: '#ff0000' } };
  A.send({ t: 'state', look: LOOK, eq: EQ, ti: 'Champion' });
  await until(() => B.msgs.some((m) => m.t === 'state' && m.look));
  const withLook = B.msgs.find((m) => m.t === 'state' && m.look);
  check(withLook && JSON.stringify(withLook.look) === JSON.stringify(LOOK) && JSON.stringify(withLook.eq) === JSON.stringify(EQ) && withLook.ti === 'Champion', 'a normal-size look + eq are relayed in the frame that carries them', withLook);
  const n0 = B.msgs.length;
  A.send({ t: 'state', x: 300 }); await until(() => B.msgs.length > n0);
  const nxt = B.msgs[B.msgs.length - 1];
  check(nxt.t === 'state' && nxt.x === 300 && nxt.look === undefined && nxt.eq === undefined && nxt.name === 'Alice' && nxt.ti === 'Champion', 'the next plain state frame carries no look / eq (but name and title stay)', nxt);
  const D = client(); await D.ready; D.send(hello('Dan', room)); await until(() => D.last('welcome'));
  const al2 = D.last('welcome').players.find((p) => p.name === 'Alice');
  check(al2 && JSON.stringify(al2.look) === JSON.stringify(LOOK) && JSON.stringify(al2.eq) === JSON.stringify(EQ), 'a late joiner gets the stored look + eq in welcome');
  const hjoin = client(); await hjoin.ready; hjoin.send(hello('Eve', room, { look: LOOK, eq: EQ })); await until(() => hjoin.last('welcome'));
  check((D.all('joined').find((m) => m.name === 'Eve') || {}).look !== undefined, 'a look sent in hello still rides the joined frame');

  // relay-1: field types
  A.send({ t: 'state', x: { a: 1 }, y: 'abc', hp: [1], name: { pad: 1 }, cls: 7, look: 5, eq: [1, 2], anim: 'idle' });
  await until(() => B.last('state') && B.last('state').anim === 'idle'); await sleep(100);
  const ty = B.last('state');
  check(ty.x === 300 && ty.y === 200 && ty.hp === 80 && ty.name === 'Alice' && ty.cls === 'mage' && ty.look === undefined && ty.eq === undefined && ty.anim === 'idle',
    'wrong-typed fields (object x, string y, array hp, object name, numeric cls, scalar look) are skipped; the last good value stays', ty);

  // relay-1: the byte bucket
  const p0 = B.all('ping').length;
  const BIGPING = 'p'.repeat(50 * 1024);
  for (let i = 0; i < 50; i++) A.send({ t: 'ping', pad: BIGPING });
  await sleep(1200);
  const got = B.all('ping').length - p0;
  check(got >= 8 && got <= 24, 'a flood of fifty 50 KB pings is cut to the byte budget (~640 KB burst + refill): B got ' + got + ' of 50', { got });
  await sleep(1500);
  const p1 = B.all('ping').length; A.send({ t: 'ping', pad: 'small' });
  check(await until(() => B.all('ping').length > p1, 2000), 'and the relay relays again once the bucket refills');
  // honest worst case: a 56 KB paint piece every 300 ms must never be throttled
  await sleep(1500);
  const q0 = B.all('ping').length, PIECE = 'q'.repeat(56 * 1024);
  for (let i = 0; i < 12; i++) { A.send({ t: 'ping', cpp: 'paint', cpd: PIECE }); await sleep(300); }
  await sleep(500);
  check(B.all('ping').length - q0 === 12, 'honest traffic (a 56 KB paint piece every 300 ms, 12 pieces) is relayed in full', { got: B.all('ping').length - q0 });

  for (const c of [A, B, C, D, hjoin]) c.ws.close();
  await sleep(200);

  // relay-6: a socket that never says hello is closed; one that did stays
  const Z = client(); await Z.ready;
  const Y = client(); await Y.ready; Y.send(hello('Yan', 'bh__ch9')); await until(() => Y.last('welcome'));
  const tz = Date.now();
  await until(() => Z.code !== null, HELLO_MS + 2500);
  check(Z.code !== null && Z.closedAt - tz < HELLO_MS + 2000, 'a socket that never says hello is closed by the hello deadline (' + (Z.code !== null ? Math.round(Z.closedAt - tz) + ' ms left of ' + HELLO_MS : 'still open') + ')', { code: Z.code });
  check(Y.code === null && Y.ws.readyState === 1, 'a socket that said hello is left alone', { code: Y.code, state: Y.ws.readyState, welcome: !!Y.last('welcome'), msgs: Y.msgs.length });
  Y.ws.close();
  check(srv.exitCode === null, 'the relay is still running at the end', { logs: srv.logs.slice(-300) });
} finally {
  for (const k of kids) { try { k.kill(); } catch (e) { /* gone */ } }
  await sleep(300);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* a lingering handle */ }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
