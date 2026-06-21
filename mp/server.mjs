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
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');   // repo root (serves the game too)
const PORT = process.env.PORT || 8080;
const PRESENCE_FIELDS = ['name', 'cls', 'job', 'master', 'level', 'map', 'x', 'y', 'vx', 'vy',
  'facing', 'hp', 'maxHp', 'mp', 'maxMp', 'anim'];
const CTRL = /[\u0000-\u001f\u007f]/g;     // strip control chars from chat (matches the in-game sanitizer)

// rooms: roomId -> Map<id, { ws, st }>   (st = latest presence object incl. id)
const rooms = new Map();
let nextId = 1;
const room = (r) => rooms.get(r) || (rooms.set(r, new Map()), rooms.get(r));
const pick = (msg, st) => { for (const k of PRESENCE_FIELDS) if (k in msg) st[k] = msg[k]; return st; };
function sendTo(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function broadcast(roomId, obj, exceptId) {
  const m = rooms.get(roomId); if (!m) return;
  const s = JSON.stringify(obj);
  for (const [id, c] of m) if (id !== exceptId && c.ws.readyState === 1) c.ws.send(s);
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
const wss = new WebSocketServer({ server: http });
wss.on('connection', (ws) => {
  let id = null, roomId = null;
  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }

    if (msg.t === 'hello') {
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
    if (!id || !roomId || !rooms.get(roomId)?.has(id)) return;   // must hello first
    const me = rooms.get(roomId).get(id);

    if (msg.t === 'state') {
      pick(msg, me.st);
      broadcast(roomId, { t: 'state', ...me.st }, id);
    } else if (msg.t === 'chat') {
      const text = String(msg.text || '').replace(CTRL, '').trim().slice(0, 200);
      if (text) broadcast(roomId, { t: 'chat', id, name: me.st.name || '?', text }, id);
    } else if (msg.t === 'emote') {
      broadcast(roomId, { t: 'emote', id, kind: String(msg.kind || '').slice(0, 24) }, id);
    }
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

http.listen(PORT, () => console.log(`Mojiworld MP relay on http://localhost:${PORT}/  (game: /mojiworld_game.html · ws: ws://localhost:${PORT})`));
