// Headless proof that the server speaks the in-game `net` protocol:
//  welcome / joined / state relay / channel isolation / chat / left.
import { WebSocket } from 'ws';
const URL = 'ws://localhost:8080';
const wait = (ms) => new Promise(r => setTimeout(r, ms));
function client() {
  const ws = new WebSocket(URL); const msgs = [];
  ws.on('message', (d) => { try { msgs.push(JSON.parse(d)); } catch (_) {} });
  const ready = new Promise(res => ws.on('open', res));
  return { ws, msgs, ready, send: (o) => ws.send(JSON.stringify(o)),
    last: (t) => [...msgs].reverse().find(m => m.t === t), close: () => ws.close() };
}
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };

const A = client(); await A.ready;
A.send({ t: 'hello', name: 'Alice', room: 'lobby__ch1', cls: 'mage', level: 3, map: 'town', x: 100, y: 200, facing: 1, hp: 90, maxHp: 120 });
await wait(120);
const wA = A.last('welcome');
ok(wA && typeof wA.id === 'number', 'A got welcome with numeric id');
ok(wA && Array.isArray(wA.players) && wA.players.length === 0, 'A welcome: empty room');

const B = client(); await B.ready;
B.send({ t: 'hello', name: 'Bob', room: 'lobby__ch1', cls: 'warrior', level: 5, map: 'town', x: 300, y: 400, facing: -1, hp: 200, maxHp: 200 });
await wait(120);
const wB = B.last('welcome');
ok(wB && wB.players.length === 1 && wB.players[0].name === 'Alice', "B welcome lists Alice with full state");
ok(wB && wB.players[0].x === 100 && wB.players[0].level === 3, 'B sees Alice position+level');
const jA = A.last('joined');
ok(jA && jA.name === 'Bob' && jA.id === wB.id, 'A received joined for Bob');

B.send({ t: 'state', x: 355, y: 400, map: 'town', anim: 'run', facing: 1, hp: 180, maxHp: 200, level: 5 });
await wait(120);
const sA = A.last('state');
ok(sA && sA.id === wB.id && sA.x === 355 && sA.anim === 'run', 'A receives B state relay (id+pos+anim)');

// channel isolation: C on ch2 must be invisible to A/B on ch1
const C = client(); await C.ready;
C.send({ t: 'hello', name: 'Carol', room: 'lobby__ch2', map: 'town', x: 1, y: 1, hp: 50, maxHp: 50, level: 1 });
await wait(120);
ok(C.last('welcome').players.length === 0, 'C (ch2) sees nobody from ch1');
const aJoinsAfter = A.msgs.filter(m => m.t === 'joined').length;
ok(aJoinsAfter === 1, 'A (ch1) did NOT get a joined for Carol (ch2) — channels isolated');

// chat relay
A.send({ t: 'chat', text: 'hello team' });
await wait(120);
const cB = B.last('chat');
ok(cB && cB.id === wA.id && cB.name === 'Alice' && cB.text === 'hello team', 'B receives A chat with id+name');

// leave
A.close(); await wait(150);
const lB = B.last('left');
ok(lB && lB.id === wA.id, 'B receives left for A on disconnect');

B.close(); C.close(); await wait(100);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
