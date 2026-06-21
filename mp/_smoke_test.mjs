// Headless proof of the MMO-lite primitives:
//  1) shared world: B sees A's broadcast position
//  2) persistence: A reconnects with same token -> server restores saved position
import { WebSocket } from 'ws';
const URL = 'ws://localhost:8787';
const wait = (ms) => new Promise(r => setTimeout(r, ms));
function client(token, name) {
  const ws = new WebSocket(URL);
  const snaps = []; let welcome = null;
  ws.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'welcome') welcome = m.you; else if (m.t === 'snap') snaps.push(m); });
  const ready = new Promise(res => ws.on('open', () => { ws.send(JSON.stringify({ t: 'hello', token, name })); res(); }));
  return { ws, snaps, getWelcome: () => welcome, ready,
    send: (s) => ws.send(JSON.stringify({ t: 'state', ...s })), close: () => ws.close() };
}
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log('  PASS', msg); } else { fail++; console.log('  FAIL', msg); } };

// ---- 1) shared world ----
const A = client('tokA', 'Alice'); const B = client('tokB', 'Bob');
await Promise.all([A.ready, B.ready]); await wait(150);
ok(A.getWelcome() && B.getWelcome(), 'both clients got welcome');
ok(A.getWelcome().id !== B.getWelcome().id, 'distinct ids assigned');
A.send({ x: 137, y: 242, anim: 'walk', facing: -1, hp: 80, level: 3 });
await wait(250);
const last = B.snaps[B.snaps.length - 1];
const aSeenByB = last.players.find(p => p.id === A.getWelcome().id);
ok(!!aSeenByB, 'B receives A in the world snapshot');
ok(aSeenByB && aSeenByB.x === 137 && aSeenByB.y === 242, 'A position propagated to B (137,242) -> ' + (aSeenByB ? aSeenByB.x + ',' + aSeenByB.y : 'none'));
ok(aSeenByB && aSeenByB.anim === 'walk' && aSeenByB.facing === -1, 'A anim/facing propagated');

// ---- 2) persistence across reconnect ----
A.close(); await wait(300);
const A2 = client('tokA', 'Alice');     // same token
await A2.ready; await wait(200);
const w = A2.getWelcome();
ok(w && w.x === 137 && w.y === 242, 'reconnect restored saved position (server-side save) -> ' + (w ? w.x + ',' + w.y : 'none'));
ok(w && w.hp === 80 && w.level === 3, 'reconnect restored hp/level');

B.close(); A2.close(); await wait(150);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
