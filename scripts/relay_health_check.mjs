// Is the hosted co-op relay actually usable? Connects two clients to one room
// and asserts they see each other — the thing the party code has to deliver.
// Also times the connect, since a cold Render free-tier dyno takes ~90s.
//
//   node scripts/relay_health_check.mjs [wss://host]
const URL = process.argv[2] || 'wss://mojiworld-mp.onrender.com';
const room = 'healthcheck__ch1';
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

function client(name) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(URL);
    const seen = [];
    const to = setTimeout(() => rej(new Error(name + ': no welcome within 120s')), 120000);
    ws.onopen = () => {
      log(name, 'socket open');
      ws.send(JSON.stringify({ t: 'hello', name, room, cls: 'warrior', level: 1,
        map: 'town', x: 100, y: 100, facing: 1, hp: 100, maxHp: 100, mp: 50, maxMp: 50 }));
    };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      seen.push(m.t);
      if (m.t === 'welcome') { clearTimeout(to); res({ ws, seen, welcome: m }); }
    };
    ws.onerror = () => { clearTimeout(to); rej(new Error(name + ': socket error')); };
    ws.onclose = (e) => { if (!seen.includes('welcome')) { clearTimeout(to); rej(new Error(name + ': closed ' + e.code)); } };
  });
}

const results = []; const ok = (n, c, x) => { results.push({ n, pass: !!c, x }); };
try {
  const a = await client('HealthA');
  const tA = ((Date.now() - t0) / 1000);
  log('A welcomed in', tA.toFixed(1) + 's');
  ok('relay accepts a WebSocket + answers hello with welcome', true);
  ok('cold/warm connect under 120s', tA < 120, { seconds: +tA.toFixed(1) });

  // Second client into the same room must be announced to A. The relay's
  // server->client verbs are welcome/joined/left/state/chat/emote (mp/server.mjs
  // line 13) — an earlier cut of this test waited for 'join' and reported a
  // false failure against a healthy relay.
  const joinSeen = new Promise((res) => {
    const to = setTimeout(() => res(false), 20000);
    a.ws.addEventListener('message', (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'joined') { clearTimeout(to); res(m); }
    });
  });
  const b = await client('HealthB');
  log('B welcomed');
  const ev = await joinSeen;
  ok('host is told when a second player joins the room', ev !== false, ev && { t: ev.t, name: ev.name });
  ok("joiner's welcome lists the player already in the room",
     !!(b.welcome && Array.isArray(b.welcome.players) && b.welcome.players.length >= 1),
     b.welcome && (b.welcome.players || []).map(p => p.name));
  ok('welcome carries the room id', (a.welcome && a.welcome.room) === room, a.welcome && a.welcome.room);

  // A different party code must NOT be able to see this room.
  const other = await new Promise((res, rej) => {
    const ws = new WebSocket(URL); const seen = [];
    const to = setTimeout(() => rej(new Error('isolation client timeout')), 30000);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', name: 'Outsider', room: 'someoneelse__ch1', cls: 'mage', level: 1, map: 'town', x: 0, y: 0, facing: 1, hp: 1, maxHp: 1, mp: 1, maxMp: 1 }));
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } seen.push(m); if (m.t === 'welcome') { clearTimeout(to); res({ ws, welcome: m }); } };
    ws.onerror = () => { clearTimeout(to); rej(new Error('isolation socket error')); };
  });
  ok('a different party code is an isolated room',
     Array.isArray(other.welcome.players) && other.welcome.players.length === 0,
     { players: (other.welcome.players || []).length });
  a.ws.close(); b.ws.close(); other.ws.close();
} catch (e) {
  ok('relay reachable', false, String(e.message));
}
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} relay checks passed`);
process.exit(fail ? 1 : 0);
