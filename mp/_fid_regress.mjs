// Regression test for the fidelity-audit fixes.
import { WebSocket } from 'ws';
const URL = 'ws://localhost:8108';
const wait = (ms) => new Promise(r => setTimeout(r, ms));
function client() {
  const ws = new WebSocket(URL); const msgs = [];
  ws.on('message', (d) => { try { msgs.push(JSON.parse(d)); } catch (_) {} });
  const ready = new Promise(res => ws.on('open', res));
  return { ws, msgs, ready, raw: (s) => ws.send(s), send: (o) => ws.send(JSON.stringify(o)),
    all: (t) => msgs.filter(m => m.t === t), last: (t) => [...msgs].reverse().find(m => m.t === t),
    alive: () => ws.readyState === 1, close: () => ws.close() };
}
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };

// --- CRITICAL: null frame must NOT crash the server ---
const killer = client(); await killer.ready;
killer.raw('null'); killer.raw('42'); killer.raw('[1,2,3]'); killer.raw('not json');
await wait(150);
const probe = client(); await probe.ready;
probe.send({ t: 'hello', name: 'Probe', room: 'r__ch1', map: 'town', x: 1, y: 1, hp: 1, maxHp: 1, level: 1 });
await wait(120);
ok(probe.last('welcome'), 'server SURVIVES null/primitive/array/garbage frames (got welcome after)');
killer.close();

// --- MAJOR: double-hello on one socket is rejected (no orphan ghost) ---
const dbl = client(); await dbl.ready;
dbl.send({ t: 'hello', name: 'Dbl', room: 'dup__ch1', map: 'town', x: 5, y: 5, hp: 1, maxHp: 1, level: 1 });
await wait(80);
dbl.send({ t: 'hello', name: 'Dbl2', room: 'dup__ch1', map: 'town', x: 9, y: 9, hp: 1, maxHp: 1, level: 1 });
await wait(120);
ok(dbl.all('welcome').length === 1, 'second hello on same socket ignored (exactly 1 welcome)');
const obs = client(); await obs.ready;
obs.send({ t: 'hello', name: 'Obs', room: 'dup__ch1', map: 'town', x: 0, y: 0, hp: 1, maxHp: 1, level: 1 });
await wait(120);
ok(obs.last('welcome').players.length === 1, 'no orphan ghost: room dup has exactly 1 prior member');
dbl.close(); obs.close();

// --- MAJOR: oversized + control-char name is capped/sanitized ---
const big = client(); await big.ready;
big.send({ t: 'hello', name: 'A'.repeat(1000), room: 'cap__ch1', map: 'town', x: 1, y: 1, hp: 1, maxHp: 1, level: 1 });
await wait(60);
const watcher = client(); await watcher.ready;
watcher.send({ t: 'hello', name: 'abcd', room: 'cap__ch1', map: 'town', x: 1, y: 1, hp: 1, maxHp: 1, level: 1 });
await wait(120);
const seenBig = watcher.last('welcome').players[0];
ok(seenBig && seenBig.name.length <= 48, 'oversized name capped to <=48 (was ' + (seenBig ? seenBig.name.length : '?') + ')');
const jW = big.last('joined');
ok(jW && jW.name === 'abcd', 'control chars stripped from name -> "' + (jW ? jW.name : '?') + '"');
big.close(); watcher.close();

// --- MAJOR: rate limit sheds a flood; server stays usable ---
const flood = client(); await flood.ready;
flood.send({ t: 'hello', name: 'Flood', room: 'rl__ch1', map: 'town', x: 0, y: 0, hp: 1, maxHp: 1, level: 1 });
const victim = client(); await victim.ready;
victim.send({ t: 'hello', name: 'Victim', room: 'rl__ch1', map: 'town', x: 0, y: 0, hp: 1, maxHp: 1, level: 1 });
await wait(80);
for (let i = 0; i < 300; i++) flood.send({ t: 'state', x: i, y: 0, map: 'town', hp: 1, maxHp: 1, level: 1 });
await wait(300);
const got = victim.all('state').length;
ok(got < 120, 'flood of 300 states shed by rate limit (victim got ' + got + ', < 120)');
victim.send({ t: 'chat', text: 'still here?' });   // server still usable?
await wait(120);
ok(flood.alive() && victim.alive(), 'both sockets still alive after flood');
flood.close(); victim.close();

// --- no-regression: clean relay still works (mini) ---
const A = client(); await A.ready;
A.send({ t: 'hello', name: 'Alice', room: 'ok__ch1', cls: 'mage', level: 3, map: 'town', x: 100, y: 200, facing: 1, hp: 90, maxHp: 120 });
const B = client(); await B.ready;
B.send({ t: 'hello', name: 'Bob', room: 'ok__ch1', map: 'town', x: 0, y: 0, hp: 1, maxHp: 1, level: 1 });
await wait(100);
A.send({ t: 'state', x: 137, y: 200, map: 'town', anim: 'run', facing: -1, hp: 90, maxHp: 120, level: 3, cls: 'mage' });
await wait(120);
const sB = B.last('state');
ok(sB && sB.x === 137 && sB.anim === 'run' && sB.cls === 'mage' && sB.name === 'Alice', 'normal state relay still full-fidelity');
A.close(); B.close(); await wait(80);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
