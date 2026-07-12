// Mojiworld multiplayer server — speaks the protocol the in-game `net` client
// already implements (see mojiworld_game.html: mpConnect / _mpHandle / _mpTick).
// Room-based presence relay: clients are authoritative for their own avatar;
// the server groups by room string (baseRoom__ch<channel>) and forwards.
//
//   cd mp && npm install && npm start
//   -> open http://localhost:8080/mojiworld_game.html in two browsers
//   -> click "Multi", enter URL  ws://localhost:8080 , a name, a room, Connect
//
// Protocol
//   C->S: hello{name,room,cls,job,master,level,map,x,y,facing,hp,maxHp,mp,maxMp}
//         state{...presence}  chat{text}  emote{kind}
//   S->C: welcome{id,room,players[]}  joined{id,...}  left{id}
//         state{id,...}  chat{id,name,text}  emote{id,kind}  error{message}
//
// Hardened after a parallel fidelity audit: null-frame crash guard, per-socket
// rate limit, payload cap + string sanitize, one-identity-per-socket, ping/pong
// heartbeat to reap silent half-open drops, and backpressure-shedding on state.
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');   // repo root (serves the game too)
const PORT = process.env.PORT || 8080;
const PRESENCE_FIELDS = ['name', 'cls', 'job', 'master', 'level', 'map', 'x', 'y', 'vx', 'vy',
  'facing', 'hp', 'maxHp', 'mp', 'maxMp', 'anim'];
const CTRL = /[\u0000-\u001f\u007f]/g;     // strip control chars (matches the in-game sanitizer)
const STR_CAP = 48;                        // cap every relayed string presence field
const MAX_BUFFERED = 256 * 1024;           // shed droppable (state) frames to a backed-up socket past this
const RATE = 40, BURST = 60;               // per-socket msgs/sec sustained / burst (client ticks ~14/s)
const HB_MS = +process.env.HB_MS || 15000; // heartbeat interval; dead sockets reaped within ~2x this

// rooms: roomId -> Map<id, { ws, st }>   (st = latest presence object incl. id)
const rooms = new Map();
let nextId = 1;
const room = (r) => rooms.get(r) || (rooms.set(r, new Map()), rooms.get(r));
const pick = (msg, st) => {                 // copy known fields; sanitize + cap any string value
  for (const k of PRESENCE_FIELDS) if (k in msg) {
    let v = msg[k];
    if (typeof v === 'string') v = v.replace(CTRL, '').slice(0, STR_CAP);
    st[k] = v;
  }
  return st;
};
function sendTo(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function broadcast(roomId, obj, exceptId, droppable) {
  const m = rooms.get(roomId); if (!m) return;
  const s = JSON.stringify(obj);
  for (const [id, c] of m) {
    if (id === exceptId || c.ws.readyState !== 1) continue;
    if (droppable && c.ws.bufferedAmount > MAX_BUFFERED) continue;   // newest-wins: a stale presence frame is fine to drop
    c.ws.send(s);
  }
}

// ---- static file host (so game + server share one origin) --------------------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp' };
const http = createServer(async (req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/mp/mp_demo.html';
  const abs = normalize(join(ROOT, p));
  if (!abs.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }   // path-traversal guard
  try {
    const buf = await readFile(abs);                                  // read BEFORE sending headers
    res.writeHead(200, { 'content-type': MIME[extname(abs)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404).end('not found'); }
});

// ---- websocket relay ---------------------------------------------------------
const wss = new WebSocketServer({ server: http, maxPayload: 64 * 1024 });   // reject oversized frames
wss.on('connection', (ws) => {
  let id = null, roomId = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  let tokens = BURST, lastRefill = Date.now();
  const allow = () => {                       // token-bucket flood guard
    const now = Date.now();
    tokens = Math.min(BURST, tokens + (now - lastRefill) / 1000 * RATE);
    lastRefill = now;
    if (tokens < 1) return false;
    tokens -= 1; return true;
  };

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg !== 'object') return;   // null / array / primitive -> ignore (null used to crash the process)
    if (!allow()) return;                            // drop floods
    try {
      if (msg.t === 'hello') {
        if (id !== null) return;                     // one identity per socket -> no orphaned-ghost re-hello
        roomId = String(msg.room || 'lobby').slice(0, 64);
        id = nextId++;
        const st = pick(msg, { id });
        room(roomId).set(id, { ws, st });
        const others = [];
        for (const [oid, c] of rooms.get(roomId)) if (oid !== id) others.push(c.st);
        sendTo(ws, { t: 'welcome', id, room: roomId, players: others });
        broadcast(roomId, { t: 'joined', ...st }, id);
        return;
      }
      if (id === null || roomId === null || !rooms.get(roomId)?.has(id)) return;   // must hello first
      const me = rooms.get(roomId).get(id);
      if (msg.t === 'state') {
        pick(msg, me.st);
        broadcast(roomId, { t: 'state', ...me.st }, id, true);       // droppable under backpressure
      } else if (msg.t === 'chat') {
        const text = String(msg.text || '').replace(CTRL, '').trim().slice(0, 200);
        if (text) broadcast(roomId, { t: 'chat', id, name: me.st.name || '?', text }, id);
      } else if (msg.t === 'emote') {
        broadcast(roomId, { t: 'emote', id, kind: String(msg.kind || '').replace(CTRL, '').slice(0, 24) }, id);
      } else if (msg.t === 'mon' || msg.t === 'dmg' || msg.t === 'kill' || msg.t === 'proj' || msg.t === 'haz' || msg.t === 'hazhit' || msg.t === 'bosshit' || msg.t === 'drop' || msg.t === 'down' || msg.t === 'up' || msg.t === 'revive' || msg.t === 'ping') {
        // v0.27.0 — casual co-op host-authoritative monster sync. Forward verbatim
        // to the room (payload already bounded by maxPayload + the token bucket).
        // 'mon' (host→all, full monster state) is droppable under backpressure —
        // the newest frame supersedes it. 'dmg' (peer→host) and 'kill' (host→all)
        // must be delivered. The relay stays dumb: it never inspects game state.
        broadcast(roomId, { ...msg, id }, id, msg.t === 'mon' || msg.t === 'proj' || msg.t === 'haz');
      }
    } catch (_) { /* never let one bad message take down the server */ }
  });

  ws.on('close', () => {
    if (roomId && id && rooms.get(roomId)) {
      rooms.get(roomId).delete(id);
      broadcast(roomId, { t: 'left', id }, id);
      if (rooms.get(roomId).size === 0) rooms.delete(roomId);
    }
  });
  ws.on('error', () => { try { ws.close(); } catch (_) {} });
});

// Heartbeat: a socket that doesn't pong (frozen tab, pulled cable, NAT rebind)
// never fires 'close', so its room entry would linger forever. Ping each round;
// terminate any that missed the previous ping -> 'close' fires -> cleanup runs.
const hb = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { try { ws.terminate(); } catch (_) {} continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch (_) {}
  }
}, HB_MS);
wss.on('close', () => clearInterval(hb));

http.listen(PORT, () => console.log(`Mojiworld MP relay on http://localhost:${PORT}/  (game: /mojiworld_game.html · ws: ws://localhost:${PORT})`));
