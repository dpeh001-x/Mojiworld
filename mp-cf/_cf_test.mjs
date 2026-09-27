// Exercises the Durable Object via `wrangler dev`: protocol compat + persistence.
import { WebSocket } from 'ws';
const URL = process.env.CF_URL || 'ws://127.0.0.1:8789';
// Unique per run: DO storage is durable across `wrangler dev` runs, so a fixed
// token would already have a save from a prior run and the "first login: no
// saved record" assertion would falsely fail. P1 and P2 share this same token
// within the run, so the reconnect-restore check still exercises persistence.
const TOK = 'tok_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
const wait = (ms) => new Promise(r => setTimeout(r, ms));
function client(u) {   // mp-relay (2026-09-27) - u: a ?room= URL (default: the bare relay URL, like the game)
  const ws = new WebSocket(u || URL); const msgs = [];
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

// ---- mp-relay (2026-09-27): 64 KB frame cap, party-of-five room cap, per-room Durable Objects, keepalive ----
const until = async (f, ms = 3000) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await wait(50); return f(); };
const RUN = Date.now().toString(36);
const F1 = client(); await F1.ready; F1.send({ t: 'hello', name: 'Big', room: 'frame' + RUN + '__ch1' });
const F2 = client(); await F2.ready; F2.send({ t: 'hello', name: 'Watch', room: 'frame' + RUN + '__ch1' });
await until(() => F1.last('welcome') && F2.last('welcome'));
F1.send({ t: 'ping', pad: 'x'.repeat(70 * 1024) });
F1.send({ t: 'ping', pad: 'y'.repeat(50 * 1024) });
await until(() => F2.all('ping').length >= 2, 1500);
const pads = F2.all('ping').map((m) => String(m.pad || '').length);
ok(pads.length === 1 && pads[0] === 50 * 1024, 'frame cap: a 70 KB frame is dropped, a 50 KB one still relays ' + JSON.stringify(pads));
ok(F1.all('error').filter((m) => m.code === 'frame_too_large').length === 1 && F1.ws.readyState === 1, 'frame cap: the sender is told once and stays connected');
F1.close(); F2.close();

const CAPR = 'cap' + RUN + '__ch1', PT = [];
for (let i = 0; i < 5; i++) { const c = client(); await c.ready; c.send({ t: 'hello', token: TOK + '_c' + i, name: 'P' + i, room: CAPR }); PT.push(c); await until(() => c.last('welcome')); }
const X6 = client(); await X6.ready; X6.send({ t: 'hello', token: TOK + '_c6', name: 'Sixth', room: CAPR });
await until(() => X6.ws.readyState === 3 || X6.last('welcome'));
ok(X6.last('error') && X6.last('error').code === 'room_full' && !X6.last('welcome') && X6.ws.readyState === 3, 'room cap: a 6th player gets room_full and is disconnected');
ok(!PT[0].all('joined').some((j) => j.name === 'Sixth'), 'room cap: the party never saw the refused player');
const G0 = client(); await G0.ready; G0.send({ t: 'hello', token: TOK + '_c0', name: 'P0again', room: CAPR });
await until(() => G0.last('welcome') || G0.last('error'));
ok(!!G0.last('welcome'), 'room cap: the same player re-joining a full room (old socket still open) gets in');
PT[4].close(); await until(() => PT[0].last('left'));
const Y6 = client(); await Y6.ready; Y6.send({ t: 'hello', token: TOK + '_c7', name: 'Next', room: CAPR });
await until(() => Y6.last('welcome') || Y6.last('error'));
ok(!!Y6.last('welcome'), 'room cap: a freed slot admits the next player');
for (const c of [...PT, G0, Y6]) c.close();
const LB = [];
for (let i = 0; i < 7; i++) { const c = client(); await c.ready; c.send({ t: 'hello', token: TOK + '_l' + i, name: 'L' + i, room: 'lobby__ch4' }); LB.push(c); await until(() => c.last('welcome') || c.last('error')); }
ok(LB.every((c) => c.last('welcome')), 'room cap: the public lobby is no party - 7 players share lobby channel 4');
for (const c of LB) c.close();

const RA = 'solo' + RUN + '__ch1', RB = 'solo' + RUN + '__ch2';
const at = (r) => URL + '/?room=' + encodeURIComponent(r);
const R1 = client(at(RA)); await R1.ready; R1.send({ t: 'hello', name: 'R1', room: RA });
const R2 = client(at(RB)); await R2.ready; R2.send({ t: 'hello', name: 'R2', room: RB });
await until(() => R1.last('welcome') && R2.last('welcome'));
ok(R1.last('welcome') && R1.last('welcome').id === 1 && R2.last('welcome') && R2.last('welcome').id === 1, 'per-room DO: each ?room= socket is player #1 of its own Durable Object');
const R3 = client(at(RA)); await R3.ready; R3.send({ t: 'hello', name: 'R3', room: RA });
await until(() => R3.last('welcome'));
ok(R3.last('welcome') && R3.last('welcome').players.some((p) => p.name === 'R1'), 'per-room DO: players dialling the same room meet');
const R4 = client(at(RA)); await R4.ready; R4.send({ t: 'hello', name: 'R4', room: RB });
await until(() => R4.last('welcome') || R4.ws.readyState === 3);
ok(R4.last('error') && R4.last('error').code === 'room_mismatch' && !R4.last('welcome'), 'per-room DO: a hello naming another room is refused');
R1.ws.send('{"t":"ka"}');
await until(() => R1.all('ka').length > 0, 1500);
ok(R1.all('ka').length === 1, 'keepalive: the relay answers {"t":"ka"} (the runtime replies; the DO can stay asleep)');
for (const c of [R1, R2, R3, R4]) c.close();
await wait(150);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
