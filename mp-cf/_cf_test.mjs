// Exercises the Durable Object via `wrangler dev`: protocol compat + persistence.
import { WebSocket } from 'ws';
const URL = process.env.CF_URL || 'ws://127.0.0.1:8789';
// Unique per run: DO storage is durable across `wrangler dev` runs, so a fixed
// token would already have a save from a prior run and the "first login: no
// saved record" assertion would falsely fail. P1 and P2 share this same token
// within the run, so the reconnect-restore check still exercises persistence.
const TOK = 'tok_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
const wait = (ms) => new Promise(r => setTimeout(r, ms));
function client() {
  const ws = new WebSocket(URL); const msgs = [];
  ws.on('message', (d) => { try { msgs.push(JSON.parse(d)); } catch (_) {} });
  const ready = new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  return { ws, msgs, ready, send: (o) => ws.send(JSON.stringify(o)),
    last: (t) => [...msgs].reverse().find(m => m.t === t),
    all: (t) => msgs.filter(m => m.t === t), close: () => ws.close() };
}
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };

// ---- protocol: welcome / joined / state relay / channel isolation / chat / left ----
const A = client(); await A.ready;
A.send({ t: 'hello', name: 'Alice', room: 'lobby__ch1', cls: 'mage', level: 3, map: 'town', x: 100, y: 200, facing: 1, hp: 90, maxHp: 120 });
await wait(200);
ok(A.last('welcome') && typeof A.last('welcome').id === 'number', 'A welcome with numeric id');
ok(A.last('welcome').players.length === 0, 'A welcome: empty room');
ok(A.last('welcome').you === null, 'A welcome.you is null (no save yet)');

const B = client(); await B.ready;
B.send({ t: 'hello', name: 'Bob', room: 'lobby__ch1', map: 'town', x: 300, y: 400, hp: 200, maxHp: 200, level: 5 });
await wait(200);
ok(B.last('welcome').players.length === 1 && B.last('welcome').players[0].name === 'Alice', 'B sees Alice in welcome');
ok(A.last('joined') && A.last('joined').name === 'Bob', 'A got joined for Bob');
B.send({ t: 'state', x: 355, y: 400, map: 'town', anim: 'run', facing: 1, hp: 180, maxHp: 200, level: 5, cls: 'warrior' });
await wait(200);
const sA = A.last('state');
ok(sA && sA.id === B.last('welcome').id && sA.x === 355 && sA.anim === 'run', 'A receives B state relay');

const C = client(); await C.ready;
C.send({ t: 'hello', name: 'Carol', room: 'lobby__ch2', map: 'town', x: 1, y: 1, hp: 1, maxHp: 1, level: 1 });
await wait(200);
ok(C.last('welcome').players.length === 0, 'channel isolation: ch2 sees nobody from ch1');
ok(A.all('joined').length === 1, 'ch1 did NOT get joined for ch2 client');

A.send({ t: 'chat', text: 'hi team' });
await wait(150);
ok(B.last('chat') && B.last('chat').name === 'Alice' && B.last('chat').text === 'hi team', 'B receives A chat');
A.close(); await wait(200);
ok(B.last('left') && B.last('left').id === A.last('welcome').id, 'B receives left for A');
B.close(); C.close(); await wait(150);

// ---- persistence: respawn where you logged off (server-side save keyed on token) ----
const P1 = client(); await P1.ready;
P1.send({ t: 'hello', token: TOK, name: 'Persist', room: 'save__ch1', map: 'town', x: 100, y: 100, level: 2, hp: 50, maxHp: 80 });
await wait(200);
ok(P1.last('welcome').you === null, 'first login: no saved record');
P1.send({ t: 'state', x: 777, y: 888, map: 'cave', level: 4, hp: 33, maxHp: 80, cls: 'rogue' });
await wait(300);
P1.close(); await wait(400);              // save flushes on close

const P2 = client(); await P2.ready;
P2.send({ t: 'hello', token: TOK, name: 'Persist', room: 'save__ch1', map: 'somewhere', x: 0, y: 0, level: 1, hp: 1, maxHp: 1 });
await wait(300);
const you = P2.last('welcome').you;
ok(you && you.x === 777 && you.y === 888 && you.map === 'cave', 'reconnect restored saved position (777,888,cave) -> ' + JSON.stringify(you && {x:you.x,y:you.y,map:you.map}));
ok(you && you.level === 4 && you.cls === 'rogue', 'reconnect restored level + class');
P2.close(); await wait(150);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
