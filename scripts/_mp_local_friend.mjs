// LOCAL test peer for the v0.29.9-11 co-op avatar + sync work. Connects to
// ws://localhost:8080, joins lobby__ch1 on the 'forest' map, patrols, swings
// every few seconds, and broadcasts the NEW look + eq fields so the real
// client can be verified rendering a full character (rogue, shortBraided
// hair, cat eyes, smile, tan skin, a named weapon) instead of the pill.
//   run: node scripts/_mp_local_friend.mjs
import WebSocket from '../mp/node_modules/ws/index.js';

const URL  = 'ws://localhost:8080';
const ROOM = 'lobby__ch1';
const MAP  = 'forest';
const NAME = 'TestBuddy';
let x = 520, dir = 1;
const y = 460;                       // forest ground band (~y:480 top) minus body height
let swing = 0;
let ws = null;

function log(...a) { console.log(new Date().toISOString().slice(11, 19), ...a); }

function statePayload() {
  swing = (swing + 1) % 40;          // swing for ~3 ticks every ~2.8s
  const attacking = swing < 3;
  return {
    t: 'state',
    x, y, vx: dir * 1.2, vy: 0,
    facing: dir,
    map: MAP,
    hp: 610, maxHp: 640, mp: 90, maxMp: 120,
    level: 23,
    cls: 'rogue', job: 'ninja', master: null,
    anim: attacking ? 'attack' : 'run',
    look: { h: 'shortBraided', e: 'cat', m: 'smile', s: 4 },
    eq: {
      weapon: { bn: 'Eclipse Daggers' },
      armor:  { bn: 'Shadowweave Vest' },
    },
  };
}

function connect() {
  log('connecting to', URL, 'as', NAME);
  ws = new WebSocket(URL);
  ws.on('open', () => {
    log('open -> hello', ROOM, MAP);
    ws.send(JSON.stringify({
      t: 'hello', name: NAME, room: ROOM,
      cls: 'rogue', job: 'ninja', master: null, level: 23,
      map: MAP, x, y, facing: dir,
      hp: 610, maxHp: 640, mp: 90, maxMp: 120,
    }));
  });
  ws.on('message', (d) => {
    let m; try { m = JSON.parse(d.toString()); } catch { return; }
    if (m.t === 'welcome')     log('WELCOME id=' + m.id + ' players=' + (m.players ? m.players.length : 0));
    else if (m.t === 'joined') log('>> JOINED: ' + (m.name || m.id) + ' map=' + (m.map || '?'));
    else if (m.t === 'left')   log('<< LEFT: ' + m.id);
    else if (m.t === 'chat')   log('   chat: ' + m.text);
  });
  ws.on('error', (e) => log('ERROR', e.message));
  ws.on('close', () => { log('closed — retry in 2s'); setTimeout(connect, 2000); });
}
connect();

setInterval(() => {
  if (!ws || ws.readyState !== 1) return;
  x += dir * 5;
  if (x > 900) dir = -1;
  if (x < 500) dir = 1;
  try { ws.send(JSON.stringify(statePayload())); } catch {}
}, 70);
