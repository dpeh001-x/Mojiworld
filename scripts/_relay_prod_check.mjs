// Round-trip check: does the PRODUCTION relay forward look/eq yet?
// Client A sends state{look,eq}; client B reports what it receives.
import WebSocket from '../mp/node_modules/ws/index.js';
const URL = process.env.RELAY || 'wss://mojiworld-mp.onrender.com';
const ROOM = 'relaycheck__ch9';
let done = false;
const t0 = Date.now();
const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', ...a);

const b = new WebSocket(URL);
b.on('open', () => { log('B open'); b.send(JSON.stringify({ t: 'hello', name: 'B', room: ROOM, map: 'forest', x: 0, y: 0 })); });
b.on('message', (d) => {
  const m = JSON.parse(d.toString());
  if (m.t === 'state') {
    log('B got state: look=' + JSON.stringify(m.look) + ' eq=' + JSON.stringify(m.eq));
    done = true; try { a.close(); b.close(); } catch {}
    process.exit(m.look ? 0 : 2);
  }
});
b.on('error', (e) => log('B err', e.message));

let a;
setTimeout(() => {
  a = new WebSocket(URL);
  a.on('open', () => {
    log('A open');
    a.send(JSON.stringify({ t: 'hello', name: 'A', room: ROOM, map: 'forest', x: 1, y: 1 }));
    setTimeout(() => {
      const iv = setInterval(() => {
        if (done) return clearInterval(iv);
        a.send(JSON.stringify({ t: 'state', x: 2, y: 2, look: { h: 'flow', e: 'cat', m: 'smile', s: 2 }, eq: { weapon: { bn: 'Eclipse Daggers' } } }));
      }, 300);
    }, 500);
  });
  a.on('error', (e) => log('A err', e.message));
}, 800);

setTimeout(() => { log('TIMEOUT — no state received (relay cold-start or down?)'); process.exit(3); }, 60000);
