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
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');   // repo root (serves the game too)
const PORT = process.env.PORT || 8080;
// v0.29.11 — 'look' + 'eq' added for the full-peer-avatar feature (client
// v0.29.9+): look = sprite-layer face {h,e,m,s}, eq = per-slot equipment
// visuals {sid,bn,tn}. Both are small nested objects; the client whitelist-
// sanitizes every string at ingestion before any registry lookup, and the
// relay's maxPayload + token bucket bound the frame size — consistent with
// the verbatim-forwarded 'mon'/'proj' frames ("the relay stays dumb").
// v0.29.x — 'v' (client build stamp) rides along so peers can detect a
// version-skewed partner and explain look mismatches instead of hiding them.
const PRESENCE_FIELDS = ['name', 'cls', 'job', 'master', 'level', 'map', 'x', 'y', 'vx', 'vy',
  'facing', 'hp', 'maxHp', 'mp', 'maxMp', 'anim', 'look', 'eq', 'v',
  // v0.29.x — 'ti' = the peer's worn title, shown under their nameplate.
  // Without it here the field is stripped off 'state' and a partner's title
  // only lands via the slower 2.5s 'ping' carrier.
  'ti'];
const CTRL = /[\u0000-\u001f\u007f]/g;     // strip control chars (matches the in-game sanitizer)
const STR_CAP = 48;                        // cap every relayed string presence field
const MAX_BUFFERED = 256 * 1024;           // shed droppable (state) frames to a backed-up socket past this
const RATE = 40, BURST = 60;               // per-socket msgs/sec sustained / burst (client ticks ~14/s)
const HB_MS = +process.env.HB_MS || 15000; // heartbeat interval; dead sockets reaped within ~2x this
// bughunt 2026-10-02 relay-1 / relay-6:
//   BULK        the only object-valued presence fields and their JSON size caps (the real look is ~0.3 KB, eq ~1.5 KB). NUM fields take a
//               finite number, every other field a string (cut to STR_CAP) or null; anything else is skipped. A 60 KB 'look' used to be
//               stored once and then re-sent to the whole room on every 50-byte state frame (x31 amplification measured).
//   BYTE_*      a per-socket BYTE bucket next to the message bucket: the verbatim-forwarded frame types (ping, mon, ...) can each be 64 KB
//               at 40/s. 256 KB/s sustained covers the worst honest sender (a 56 KB paint piece every 300 ms), 640 KB burst the join.
//   HELLO_MS    a socket that has not said hello by then is closed (an idle pre-hello socket was never reaped: fd / memory exhaustion).
const BULK = { look: 1024, eq: 8192 };
const NUM = { x: 1, y: 1, vx: 1, vy: 1, level: 1, hp: 1, maxHp: 1, mp: 1, maxMp: 1, facing: 1 };
const BYTE_RATE = 256 * 1024, BYTE_BURST = 640 * 1024;
const HELLO_MS = +process.env.HELLO_MS || 10000;

// rooms: roomId -> Map<id, { ws, st }>   (st = latest presence object incl. id)
const rooms = new Map();
let nextId = 1;
const room = (r) => rooms.get(r) || (rooms.set(r, new Map()), rooms.get(r));
const pick = (msg, st, took) => {           // copy known fields; sanitize + cap every value (took: which BULK fields this frame carried)
  for (const k of PRESENCE_FIELDS) if (k in msg) {
    let v = msg[k];
    if (BULK[k] !== undefined) {              // look / eq: null, or a plain object inside its cap - anything else is skipped
      if (v !== null && (typeof v !== 'object' || Array.isArray(v) || JSON.stringify(v).length > BULK[k])) continue;
      if (took) took[k] = 1;
    }
    else if (NUM[k] === 1) { if (typeof v !== 'number' || !Number.isFinite(v)) continue; }   // (a NaN the client sent arrives as null: kept out, the last value stays)
    else if (typeof v === 'string') v = v.replace(CTRL, '').slice(0, STR_CAP);
    else if (v !== null) continue;            // a text field takes a string, or null (no job / no master yet)
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
// bughunt 2026-10-02 relay-3 / V-net-1: this handler is async, so a throw in it was an unhandled rejection that ENDS THE PROCESS (every room):
// GET /% (a malformed escape) did exactly that. The decode is guarded (400), a NUL is a 400, the containment check is separator-safe (ROOT has no
// trailing separator, so a sibling folder that shares its prefix - ../Mojiworld-live - passed the old bare startsWith), dotfile folders (.git, .claude,
// .mcp.json) and _steamcmd/ are not served (ROOT is the whole repo), and nothing a request carries can throw out of the handler.
const ROOT_PFX = ROOT.endsWith(sep) ? ROOT : ROOT + sep;
const HIDDEN = /(^|[/\\])\.[^/\\.]|^[/\\]+_steamcmd([/\\]|$)/i;
const http = createServer(async (req, res) => {
  try {
    let p;
    try { p = decodeURIComponent((req.url || '/').split('?')[0]); } catch { res.writeHead(400).end('bad request'); return; }
    if (p.includes(String.fromCharCode(0))) { res.writeHead(400).end('bad request'); return; }
    if (p === '/') p = '/mp/mp_demo.html';
    if (HIDDEN.test(p)) { res.writeHead(404).end('not found'); return; }
    const abs = normalize(join(ROOT, p));
    if (abs !== ROOT && !abs.startsWith(ROOT_PFX)) { res.writeHead(403).end('forbidden'); return; }   // path-traversal guard
    try {
      const buf = await readFile(abs);                                  // read BEFORE sending headers
      res.writeHead(200, { 'content-type': MIME[extname(abs)] || 'application/octet-stream' });
      res.end(buf);
    } catch { res.writeHead(404).end('not found'); }
  } catch (e) { try { if (!res.headersSent) res.writeHead(500).end('error'); else res.destroy(); } catch (e2) { /* the socket is gone */ } }
});
process.on('unhandledRejection', (e) => { console.error('[mp] unhandled rejection (kept running):', e && e.message); });

// ---- websocket relay ---------------------------------------------------------
const wss = new WebSocketServer({ server: http, maxPayload: 64 * 1024 });   // reject oversized frames
wss.on('connection', (ws) => {
  let id = null, roomId = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  let btokens = BYTE_BURST, blast = Date.now();
  const allowBytes = (n) => {                 // relay-1: the byte-rate flood guard (before JSON.parse, so a flood costs no parse)
    const now = Date.now();
    btokens = Math.min(BYTE_BURST, btokens + (now - blast) / 1000 * BYTE_RATE);
    blast = now;
    if (btokens < n) return false;
    btokens -= n; return true;
  };
  const helloTimer = setTimeout(() => { if (id === null) { try { ws.terminate(); } catch (_) {} } }, HELLO_MS);   // relay-6: no hello, no socket
  if (helloTimer.unref) helloTimer.unref();
  ws.on('close', () => clearTimeout(helloTimer));
  let tokens = BURST, lastRefill = Date.now();
  const allow = () => {                       // token-bucket flood guard
    const now = Date.now();
    tokens = Math.min(BURST, tokens + (now - lastRefill) / 1000 * RATE);
    lastRefill = now;
    if (tokens < 1) return false;
    tokens -= 1; return true;
  };

  ws.on('message', (raw) => {
    if (!allowBytes(raw.length != null ? raw.length : raw.byteLength)) return;   // relay-1: over the byte budget -> dropped unread
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
        const took = {};
        pick(msg, me.st, took);
        const out = { t: 'state', ...me.st };
        if (!took.look) delete out.look;   // relay-1: look / eq ride only the frame that carried them (late joiners get the stored copy in welcome / joined)
        if (!took.eq) delete out.eq;
        broadcast(roomId, out, id, true);       // droppable under backpressure
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
