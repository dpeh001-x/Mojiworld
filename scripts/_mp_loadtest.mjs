// Multi-player load/soak harness against the LIVE Cloudflare DO. Spawns many
// concurrent bot players and runs scenarios that a single-client test can't:
// presence mesh, channel isolation, chat/emote fan-out, rate-limit flood,
// reconnect churn (ghost check), concurrent persistence, token-clobber probe,
// and room cleanup. Logs anomalies; prints PASS/FAIL per scenario.
import WebSocket from '../mp/node_modules/ws/index.js';

const HOST = process.env.MP_HOST || 'wss://mojiworld-mp.dpeh001.workers.dev';
const RUN = 'lt' + Date.now().toString(36);           // unique room base so we never collide with real players/prior runs
const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const notes = [];
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };
const note = m => { notes.push(m); console.log('   ·', m); };

function bot(name, room, token, extra = {}) {
  const ws = new WebSocket(HOST);
  const o = { name, room, ws, seenIds: new Set(), seenNames: new Set(), chats: [], emotes: [], states: 0, welcome: null, errors: [], closed: false };
  ws.on('message', d => { let m; try { m = JSON.parse(d); } catch { return; }
    if (m.t === 'welcome') { o.welcome = m; (m.players || []).forEach(p => { o.seenIds.add(p.id); if (p.name) o.seenNames.add(p.name); }); }
    else if (m.t === 'joined') { o.seenIds.add(m.id); if (m.name) o.seenNames.add(m.name); }
    else if (m.t === 'left') o.seenIds.delete(m.id);
    else if (m.t === 'chat') o.chats.push(m);
    else if (m.t === 'emote') o.emotes.push(m);
    else if (m.t === 'state') o.states++;
  });
  ws.on('error', e => o.errors.push(e.message));
  ws.on('close', () => { o.closed = true; });
  o.send = x => { try { ws.send(JSON.stringify(x)); } catch (e) { o.errors.push('send:' + e.message); } };
  o.ready = new Promise(res => ws.on('open', () => { ws.send(JSON.stringify({ t: 'hello', name, room, token, cls: 'mage', level: 5, map: 'forest', x: 100, y: 300, hp: 100, maxHp: 100, ...extra })); res(); }));
  o.close = () => ws.close();
  return o;
}

console.log('LOAD TEST ->', HOST, '\n');

// ---------- Scenario 1: presence mesh + channel isolation ----------
console.log('Scenario 1: 8 bots ch1 + 4 bots ch2 — mesh + isolation');
const ch1 = Array.from({ length: 8 }, (_, i) => bot('A' + i, RUN + '__ch1'));
const ch2 = Array.from({ length: 4 }, (_, i) => bot('B' + i, RUN + '__ch2'));
await Promise.all([...ch1, ...ch2].map(b => b.ready));
await wait(2500);   // let all joined frames propagate
const ch1names = new Set(ch1.map(b => b.name));
const ch2names = new Set(ch2.map(b => b.name));
let meshOK = true, isoOK = true;
for (const b of ch1) {
  if (b.seenIds.size !== 7) { meshOK = false; note(`${b.name} sees ${b.seenIds.size} peers (expected 7)`); }
  for (const n of b.seenNames) if (ch2names.has(n)) { isoOK = false; note(`${b.name} saw ch2 peer ${n}`); }
}
ok(meshOK, 'every ch1 bot sees the other 7 ch1 bots');
ok(isoOK, 'no ch1 bot sees any ch2 bot (channel isolation)');
ok(ch2.every(b => b.seenIds.size === 3), 'every ch2 bot sees the other 3 ch2 bots');
ok([...ch1, ...ch2].every(b => b.errors.length === 0), 'no socket errors during join');

// ---------- Scenario 2: chat + emote fan-out (scoped to channel) ----------
console.log('Scenario 2: chat + emote fan-out');
ch1.forEach(b => b.chats.length = 0);
ch2.forEach(b => b.chats.length = 0);
ch1[0].send({ t: 'chat', text: 'hello-ch1' });
ch1[1].send({ t: 'emote', kind: 'wave' });
await wait(1200);
ok(ch1.slice(1).every(b => b.chats.some(c => c.text === 'hello-ch1')), 'all other ch1 bots received the chat');
ok(ch2.every(b => b.chats.length === 0), 'no ch2 bot received the ch1 chat (scoped)');
ok(ch1.filter(b => b !== ch1[1]).some(b => b.emotes.length > 0), 'ch1 bots received the emote');

// ---------- Scenario 3: rate-limit flood doesn't break the room ----------
console.log('Scenario 3: one bot floods 250 msgs — others unaffected');
const before = ch1[2].errors.length;
for (let i = 0; i < 250; i++) ch1[0].send({ t: 'state', x: 100 + i, y: 300, map: 'forest' });
await wait(1500);
ok(!ch1[0].closed, 'flooding bot stays connected (throttled, not kicked)');
ch1.forEach(b => b.chats.length = 0);
ch1[3].send({ t: 'chat', text: 'still-alive' });
await wait(1000);
ok(ch1.filter(b => b !== ch1[3]).some(b => b.chats.some(c => c.text === 'still-alive')), 'room still relays chat after the flood');
ok(ch1[2].errors.length === before, 'bystander bot saw no new errors during flood');

// ---------- Scenario 4: reconnect churn — no ghosts ----------
console.log('Scenario 4: 3 bots disconnect+reconnect — ghost check');
ch1[5].close(); ch1[6].close(); ch1[7].close();
await wait(1500);
const obs = bot('OBS', RUN + '__ch1');
await obs.ready; await wait(1500);
ok(obs.welcome && obs.welcome.players.length === 5, `fresh observer sees ${obs.welcome ? obs.welcome.players.length : '?'} live peers (expected 5, no ghosts)`);
obs.close();

// ---------- Scenario 5: concurrent persistence + same-token-two-channels probe ----------
console.log('Scenario 5: concurrent persistence + token-clobber probe');
const tokP = 'lt_persist_' + Date.now();
const p1 = bot('P', RUN + '__ch1', tokP);
await p1.ready; await wait(300);
p1.send({ t: 'state', x: 555, y: 666, map: 'forest', level: 9, cls: 'rogue' });
await wait(400); p1.close(); await wait(700);
const p2 = bot('P', RUN + '__ch1', tokP);
await p2.ready; await wait(600);
ok(p2.welcome && p2.welcome.you && p2.welcome.you.x === 555 && p2.welcome.you.map === 'forest', 'same-channel reconnect restored saved position');
p2.close(); await wait(300);
// probe: same token on a DIFFERENT channel — does its save clobber/leak across channels?
const tokX = 'lt_xchan_' + Date.now();
const x1 = bot('X', RUN + '__ch1', tokX); await x1.ready; await wait(300);
x1.send({ t: 'state', x: 111, y: 222, map: 'forest' }); await wait(400); x1.close(); await wait(700);
const x2 = bot('X', RUN + '__ch2', tokX); await x2.ready; await wait(600);
const leaked = x2.welcome && x2.welcome.you && x2.welcome.you.x === 111;
note('same-token cross-channel: ch2 reconnect ' + (leaked ? 'GOT ch1 save (token is NOT channel-scoped)' : 'got null/own (scoped or fresh)'));
x2.close();

// ---------- Scenario 6: room cleanup after everyone leaves ----------
console.log('Scenario 6: room cleanup');
[...ch1, ...ch2].forEach(b => b.close());
await wait(2500);
const fresh = bot('FRESH', RUN + '__ch1');
await fresh.ready; await wait(1200);
ok(fresh.welcome && fresh.welcome.players.length === 0, `room empty after all leave (saw ${fresh.welcome ? fresh.welcome.players.length : '?'})`);
fresh.close();

await wait(400);
console.log(`\n${pass} passed, ${fail} failed` + (notes.length ? `\nNotes:\n - ` + notes.join('\n - ') : ''));
process.exit(fail ? 1 : 0);
