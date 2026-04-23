// =========================================================================
// LevelX multiplayer server (v0.24.0)
//
// Thin WebSocket relay + presence hub. Authoritative-lite — the server
// owns "who is in the room, where they are, what they're saying", but
// combat and monsters stay client-side for now (each client instances its
// own mobs).  Combat will become server-owned in a later phase.
//
// Protocol (all JSON over a single WebSocket connection):
//
//   CLIENT → SERVER
//     { t:'hello',  name, cls, job, master, level, map, room }
//     { t:'state',  x, y, vx, vy, facing, map, hp, maxHp, mp, maxMp,
//                   level, cls, job, master, anim }
//     { t:'chat',   text }
//     { t:'map',    map }               // broadcast on map change
//     { t:'emote',  kind }              // player pressed 4-8
//
//   SERVER → CLIENT
//     { t:'welcome', id, players:[{id,name,...}] }
//     { t:'joined',  id, name, cls, level }
//     { t:'left',    id }
//     { t:'state',   id, x, y, vx, vy, facing, map, hp, maxHp, mp, maxMp,
//                    level, cls, job, master, anim }
//     { t:'chat',    id, name, text }
//     { t:'emote',   id, kind }
//
// Rooms are ad-hoc — any unique room id works, default 'lobby'. There is
// no persistence across server restarts.
// =========================================================================

const { WebSocketServer } = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;
const MAX_PER_ROOM = 16;
const MAX_CHAT_LEN = 200;
const MAX_NAME_LEN = 20;
const TICK_STATE_MIN_MS = 40;      // max server broadcast rate per player
const IDLE_KICK_MS      = 60_000;  // drop idle sockets after 60s without any msg

// In-memory room registry. Lifecycle: created on first join, destroyed when
// the last player leaves. Each entry is { clients: Set<WebSocket>, meta:{} }.
const rooms = new Map();

// Monotonic id generator for player ids within a server process
let nextId = 1;
const makeId = () => String(nextId++).padStart(6, '0');

// ---- HTTP wrapper so Fly.io / Railway can health-check us --------------
const httpServer = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const info = {
      ok: true,
      name: 'levelx-server',
      version: '0.24.0',
      rooms: rooms.size,
      totalPlayers: [...rooms.values()].reduce((a, r) => a + r.clients.size, 0),
    };
    res.end(JSON.stringify(info));
    return;
  }
  res.writeHead(404); res.end('Not Found');
});
const wss = new WebSocketServer({ server: httpServer });

// ---- Helpers ----------------------------------------------------------
function send(ws, obj) {
  if (ws.readyState !== 1) return;
  try { ws.send(JSON.stringify(obj)); } catch (e) { /* dead socket */ }
}

function broadcast(roomId, payload, except) {
  const room = rooms.get(roomId);
  if (!room) return;
  const data = JSON.stringify(payload);
  for (const client of room.clients) {
    if (client === except) continue;
    if (client.readyState !== 1) continue;
    try { client.send(data); } catch (e) { /* dead */ }
  }
}

function sanitizeString(s, max) {
  if (typeof s !== 'string') return '';
  return s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

function playerSnap(ws) {
  const p = ws._player;
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    cls: p.cls, job: p.job, master: p.master,
    level: p.level,
    x: p.x, y: p.y, vx: p.vx, vy: p.vy,
    facing: p.facing,
    map: p.map,
    hp: p.hp, maxHp: p.maxHp, mp: p.mp, maxMp: p.maxMp,
    anim: p.anim,
  };
}

function joinRoom(ws, roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { clients: new Set(), createdAt: Date.now() });
  }
  const room = rooms.get(roomId);
  if (room.clients.size >= MAX_PER_ROOM) {
    send(ws, { t: 'error', code: 'room_full', message: `Room ${roomId} is full (${MAX_PER_ROOM})` });
    return false;
  }
  room.clients.add(ws);
  ws._roomId = roomId;
  return true;
}

function leaveRoom(ws) {
  const roomId = ws._roomId;
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;
  room.clients.delete(ws);
  if (ws._player) {
    broadcast(roomId, { t: 'left', id: ws._player.id });
  }
  if (room.clients.size === 0) rooms.delete(roomId);
  ws._roomId = null;
}

// ---- Connection handler ------------------------------------------------
wss.on('connection', (ws, req) => {
  ws._lastMsgAt = Date.now();
  ws._lastStateAt = 0;

  ws.on('message', (data) => {
    ws._lastMsgAt = Date.now();
    let msg;
    try { msg = JSON.parse(data); } catch (e) { return; }
    if (!msg || typeof msg.t !== 'string') return;

    // ---- Hello / join ----
    if (msg.t === 'hello') {
      const name = sanitizeString(msg.name, MAX_NAME_LEN) || 'Hero';
      const roomId = sanitizeString(msg.room, 24).toLowerCase() || 'lobby';
      if (!joinRoom(ws, roomId)) { ws.close(); return; }
      const id = makeId();
      ws._player = {
        id, name,
        cls: sanitizeString(msg.cls, 16) || 'warrior',
        job: sanitizeString(msg.job, 16) || null,
        master: sanitizeString(msg.master, 20) || null,
        level: Number.isFinite(msg.level) ? msg.level : 1,
        x: Number.isFinite(msg.x) ? msg.x : 300,
        y: Number.isFinite(msg.y) ? msg.y : 400,
        vx: 0, vy: 0,
        facing: msg.facing === -1 ? -1 : 1,
        map: sanitizeString(msg.map, 24) || 'town',
        hp: Number.isFinite(msg.hp) ? msg.hp : 100,
        maxHp: Number.isFinite(msg.maxHp) ? msg.maxHp : 100,
        mp: Number.isFinite(msg.mp) ? msg.mp : 50,
        maxMp: Number.isFinite(msg.maxMp) ? msg.maxMp : 50,
        anim: 'idle',
      };
      // Send the new player the list of everyone already in the room
      const room = rooms.get(roomId);
      const players = [];
      for (const client of room.clients) {
        if (client === ws) continue;
        if (client._player) players.push(playerSnap(client));
      }
      send(ws, { t: 'welcome', id, room: roomId, players });
      // Tell the rest a new player joined
      broadcast(roomId, { t: 'joined', ...playerSnap(ws) }, ws);
      return;
    }

    if (!ws._player || !ws._roomId) return;  // rest of messages need an auth

    // ---- State tick (rate-limited) ----
    if (msg.t === 'state') {
      const now = Date.now();
      if (now - ws._lastStateAt < TICK_STATE_MIN_MS) return;
      ws._lastStateAt = now;
      const p = ws._player;
      if (Number.isFinite(msg.x))    p.x = msg.x;
      if (Number.isFinite(msg.y))    p.y = msg.y;
      if (Number.isFinite(msg.vx))   p.vx = msg.vx;
      if (Number.isFinite(msg.vy))   p.vy = msg.vy;
      if (msg.facing === 1 || msg.facing === -1) p.facing = msg.facing;
      if (typeof msg.map === 'string') p.map = sanitizeString(msg.map, 24);
      if (Number.isFinite(msg.hp))    p.hp = msg.hp;
      if (Number.isFinite(msg.maxHp)) p.maxHp = msg.maxHp;
      if (Number.isFinite(msg.mp))    p.mp = msg.mp;
      if (Number.isFinite(msg.maxMp)) p.maxMp = msg.maxMp;
      if (Number.isFinite(msg.level)) p.level = msg.level;
      if (typeof msg.cls === 'string')    p.cls = sanitizeString(msg.cls, 16);
      if (typeof msg.job === 'string')    p.job = sanitizeString(msg.job, 16);
      if (typeof msg.master === 'string') p.master = sanitizeString(msg.master, 20);
      if (typeof msg.anim === 'string')   p.anim = sanitizeString(msg.anim, 16);
      broadcast(ws._roomId, { t: 'state', ...playerSnap(ws) }, ws);
      return;
    }

    // ---- Chat ----
    if (msg.t === 'chat') {
      const text = sanitizeString(msg.text, MAX_CHAT_LEN);
      if (!text) return;
      const payload = { t: 'chat', id: ws._player.id, name: ws._player.name, text };
      broadcast(ws._roomId, payload);            // echo to sender too
      return;
    }

    // ---- Emote ----
    if (msg.t === 'emote') {
      const kind = sanitizeString(msg.kind, 4);  // single emoji char
      if (!kind) return;
      broadcast(ws._roomId, { t: 'emote', id: ws._player.id, kind }, ws);
      return;
    }

    // ---- Explicit map change (broadcast so peers know to hide ghost) ----
    if (msg.t === 'map') {
      const map = sanitizeString(msg.map, 24);
      if (!map) return;
      ws._player.map = map;
      broadcast(ws._roomId, { t: 'state', ...playerSnap(ws) }, ws);
      return;
    }
  });

  ws.on('close', () => leaveRoom(ws));
  ws.on('error', () => leaveRoom(ws));
});

// ---- Idle sweep — drop sockets that haven't sent anything in IDLE_KICK_MS
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    for (const ws of room.clients) {
      if (now - ws._lastMsgAt > IDLE_KICK_MS) {
        try { ws.close(1001, 'idle'); } catch (e) {}
      }
    }
  }
}, 15_000).unref?.();

httpServer.listen(PORT, () => {
  console.log(`[levelx-server] listening on port ${PORT}`);
  console.log(`[levelx-server] rooms: <roomId>, default 'lobby', cap ${MAX_PER_ROOM}/room`);
});
