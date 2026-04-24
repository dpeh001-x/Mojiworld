// =========================================================================
// LevelX multiplayer server (v0.25.0)
//
// HTTP + WebSocket. Adds:
//   * Account registration + login with password hashing (scrypt)
//   * Stateless HMAC-signed session tokens (30-day TTL by default)
//   * Per-account save persistence (SQLite blob)
//   * WebSocket auth via `{t:'auth', token}` (guest mode still supported)
//   * IP-scoped rate limiting on register/login
//   * OAuth endpoint stub (Google/Discord drop-in later)
//
// Protocol (JSON over a single WebSocket connection):
//
//   CLIENT → SERVER
//     { t:'auth',  token }                   // optional, promotes socket to
//                                            // an authed account
//     { t:'hello', name, cls, job, master,
//                  level, map, room }        // join a room (after auth if
//                                            // available; else guest)
//     { t:'state',  x, y, vx, vy, facing,
//                   map, hp, maxHp, mp, maxMp,
//                   level, cls, job, master, anim }
//     { t:'chat',   text }                   // 60-char max (client-capped),
//                                            // server trims to 200 too
//     { t:'map',    map }                    // broadcast on map change
//     { t:'emote',  kind }                   // player pressed 4-7
//     { t:'save',   data }                   // persist save blob (needs auth)
//
//   SERVER → CLIENT
//     { t:'auth_ok', user }                  // ACK after successful auth
//     { t:'welcome', id, players[] }         // you joined a room
//     { t:'joined',  id, name, cls, level }  // someone else joined
//     { t:'left',    id }                    // someone left
//     { t:'state',   id, ... }               // peer state update
//     { t:'chat',    id, name, text }        // chat echo (incl. your own)
//     { t:'emote',   id, kind }
//     { t:'error',   code, message }
//
// HTTP endpoints (see server/README.md for full tables):
//   GET  /              health JSON
//   GET  /health        same
//   POST /api/register  body { username, password, email? } → { token, user }
//   POST /api/login     body { username, password }        → { token, user }
//   POST /api/logout    (stateless — clients drop their token; advisory)
//   GET  /api/me        Authorization: Bearer <token>      → { user }
//   GET  /api/save      Authorization: Bearer <token>      → { data, updatedAt }
//   PUT  /api/save      body (JSON save) + Authorization   → { ok, updatedAt }
//   DELETE /api/account Authorization: Bearer <token>      → { ok }
//   ALL  /api/oauth/*   501 Not Implemented (stub)
// =========================================================================

// node:sqlite is marked experimental in Node 22/24 but the API is stable
// for the subset we use. We can't selectively suppress the warning with a
// single `process.on` (the default listener still prints), so we just let
// it print on stderr once at boot — harmless.

const { WebSocketServer } = require('ws');
const http = require('http');
const auth = require('./auth');

const PORT           = parseInt(process.env.PORT || '8080', 10);
const MAX_PER_ROOM   = parseInt(process.env.MAX_PER_ROOM   || '16', 10);
const MAX_CHAT_LEN   = parseInt(process.env.MAX_CHAT_LEN   || '200', 10);
const MAX_NAME_LEN   = parseInt(process.env.MAX_NAME_LEN   || '20', 10);
const TICK_STATE_MIN_MS = 40;
const IDLE_KICK_MS   = 60_000;
const VERSION        = '0.25.0';

// ----- Room registry (identical to v0.24.x, unchanged wire format) --------

const rooms = new Map();
let nextId = 1;
const makeSocketId = () => String(nextId++).padStart(6, '0');

// ----- Rate limiter (in-memory, per IP) ----------------------------------
// Not Redis-grade; fine for a single-process server. Sweep stale entries
// once a minute so the map doesn't grow unbounded.

const rateBuckets = new Map();
function rateLimit(ip, bucket, max, windowMs) {
  const key = `${ip}|${bucket}`;
  const now = Date.now();
  const rec = rateBuckets.get(key);
  if (!rec || rec.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  rec.count++;
  return rec.count <= max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBuckets) {
    if (v.resetAt < now) rateBuckets.delete(k);
  }
}, 60_000).unref?.();

// ----- Helpers ------------------------------------------------------------

function sanitizeString(s, max) {
  if (typeof s !== 'string') return '';
  return s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

function wsSend(ws, obj) {
  if (!ws || ws.readyState !== 1) return;
  try { ws.send(JSON.stringify(obj)); } catch (e) {}
}

function broadcast(roomId, payload, except) {
  const room = rooms.get(roomId);
  if (!room) return;
  const data = JSON.stringify(payload);
  for (const client of room.clients) {
    if (client === except) continue;
    if (client.readyState !== 1) continue;
    try { client.send(data); } catch (e) {}
  }
}

function playerSnap(ws) {
  const p = ws._player;
  if (!p) return null;
  return {
    id: p.id,
    accountId: p.accountId || null,
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
    wsSend(ws, { t: 'error', code: 'room_full', message: `Room ${roomId} is full (${MAX_PER_ROOM})` });
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
  if (ws._player) broadcast(roomId, { t: 'left', id: ws._player.id });
  if (room.clients.size === 0) rooms.delete(roomId);
  ws._roomId = null;
}

// ----- HTTP server -------------------------------------------------------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age':       '86400',
};

function jsonResponse(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...CORS_HEADERS,
  });
  res.end(JSON.stringify(obj));
}

async function readJsonBody(req, maxBytes = 100_000) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', chunk => {
      total += chunk.length;
      if (total > maxBytes) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve(null);
      try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function bearerToken(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

function requireAuth(req, res) {
  const token = bearerToken(req);
  const payload = token && auth.verifyToken(token);
  if (!payload) { jsonResponse(res, 401, { error: 'Invalid or expired token' }); return null; }
  const user = auth.getAccount(payload.uid);
  if (!user) { jsonResponse(res, 404, { error: 'Account not found' }); return null; }
  return { payload, user };
}

const httpServer = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS); res.end(); return;
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0')
    .toString().split(',')[0].trim();
  const url = new URL(req.url, 'http://localhost');

  // ---- Health / root ----
  if (url.pathname === '/' || url.pathname === '/health') {
    const s = (typeof auth.stats === 'function') ? auth.stats() : { accounts: 0, saves: 0 };
    return jsonResponse(res, 200, {
      ok: true, name: 'levelx-server', version: VERSION,
      rooms: rooms.size,
      totalPlayers: [...rooms.values()].reduce((a, r) => a + r.clients.size, 0),
      accounts: s.accounts, saves: s.saves,
    });
  }

  // ---- POST /api/register ----
  if (url.pathname === '/api/register' && req.method === 'POST') {
    if (!rateLimit(ip, 'register', 5, 60_000)) {
      return jsonResponse(res, 429, { error: 'Too many registration attempts — try again in a minute' });
    }
    let body;
    try { body = await readJsonBody(req); } catch (e) { return jsonResponse(res, 400, { error: e.message || 'Invalid JSON' }); }
    if (!body) return jsonResponse(res, 400, { error: 'Missing body' });
    try {
      const user = auth.createAccount({ username: body.username, password: body.password, email: body.email });
      const token = auth.createToken(user.id);
      return jsonResponse(res, 201, { token, user });
    } catch (e) {
      const status = e.code === 'DUPLICATE' ? 409 : 400;
      return jsonResponse(res, status, { error: e.message });
    }
  }

  // ---- POST /api/login ----
  if (url.pathname === '/api/login' && req.method === 'POST') {
    if (!rateLimit(ip, 'login', 10, 60_000)) {
      return jsonResponse(res, 429, { error: 'Too many login attempts — try again in a minute' });
    }
    let body;
    try { body = await readJsonBody(req); } catch (e) { return jsonResponse(res, 400, { error: 'Invalid JSON' }); }
    if (!body) return jsonResponse(res, 400, { error: 'Missing body' });
    try {
      const userId = auth.authenticate({ username: body.username, password: body.password });
      const token = auth.createToken(userId);
      const user  = auth.getAccount(userId);
      return jsonResponse(res, 200, { token, user });
    } catch (e) {
      // Uniform 401 for any credential failure — no username probe surface
      return jsonResponse(res, 401, { error: 'Invalid credentials' });
    }
  }

  // ---- POST /api/logout (advisory — tokens are stateless) ----
  if (url.pathname === '/api/logout' && req.method === 'POST') {
    // We could maintain a revocation list keyed on token nonce if this ever
    // needs to be enforceable server-side. For now it's client-driven.
    return jsonResponse(res, 200, { ok: true });
  }

  // ---- GET /api/me ----
  if (url.pathname === '/api/me' && req.method === 'GET') {
    const a = requireAuth(req, res); if (!a) return;
    return jsonResponse(res, 200, { user: a.user });
  }

  // ---- GET/PUT /api/save ----
  if (url.pathname === '/api/save') {
    const a = requireAuth(req, res); if (!a) return;
    if (req.method === 'GET') {
      const save = auth.getSave(a.user.id);
      return jsonResponse(res, 200, save || { data: null, updatedAt: null });
    }
    if (req.method === 'PUT') {
      let body;
      try { body = await readJsonBody(req, 2_000_000); }
      catch (e) { return jsonResponse(res, 400, { error: e.message || 'Invalid JSON' }); }
      if (!body || typeof body !== 'object') return jsonResponse(res, 400, { error: 'Save body must be an object' });
      try {
        const updatedAt = auth.putSave(a.user.id, body);
        return jsonResponse(res, 200, { ok: true, updatedAt });
      } catch (e) {
        return jsonResponse(res, 400, { error: e.message });
      }
    }
    return jsonResponse(res, 405, { error: 'Method Not Allowed' });
  }

  // ---- DELETE /api/account (self) ----
  if (url.pathname === '/api/account' && req.method === 'DELETE') {
    const a = requireAuth(req, res); if (!a) return;
    const ok = auth.deleteAccount(a.user.id);
    return jsonResponse(res, ok ? 200 : 404, { ok });
  }

  // ---- OAuth stub ----
  if (url.pathname.startsWith('/api/oauth/')) {
    const provider = url.pathname.slice('/api/oauth/'.length) || 'unknown';
    return jsonResponse(res, 501, {
      error: 'OAuth not yet implemented',
      provider,
      note: 'This route is a stub — the accounts table has oauth_provider / oauth_subject columns ready to link.',
    });
  }

  return jsonResponse(res, 404, { error: 'Not Found' });
});

// ----- WebSocket handling -------------------------------------------------

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  ws._lastMsgAt   = Date.now();
  ws._lastStateAt = 0;
  ws._accountId   = null;  // populated by successful `auth` message

  ws.on('message', (data) => {
    ws._lastMsgAt = Date.now();
    let msg;
    try { msg = JSON.parse(data); } catch (e) { return; }
    if (!msg || typeof msg.t !== 'string') return;

    // ---- Auth (optional — upgrades a guest socket to an account) ----
    if (msg.t === 'auth') {
      const payload = auth.verifyToken(msg.token);
      if (!payload) { wsSend(ws, { t: 'error', code: 'bad_token', message: 'Invalid or expired token' }); return; }
      const user = auth.getAccount(payload.uid);
      if (!user) { wsSend(ws, { t: 'error', code: 'no_account', message: 'Account not found' }); return; }
      ws._accountId = user.id;
      wsSend(ws, { t: 'auth_ok', user: { id: user.id, username: user.username, email: user.email } });
      return;
    }

    // ---- Hello / join room ----
    if (msg.t === 'hello') {
      const name = sanitizeString(msg.name, MAX_NAME_LEN) || (ws._accountId ? `User${ws._accountId}` : 'Hero');
      const roomId = sanitizeString(msg.room, 24).toLowerCase() || 'lobby';
      if (!joinRoom(ws, roomId)) { ws.close(); return; }
      const id = makeSocketId();
      ws._player = {
        id, name, accountId: ws._accountId,
        cls:    sanitizeString(msg.cls, 16) || 'warrior',
        job:    sanitizeString(msg.job, 16) || null,
        master: sanitizeString(msg.master, 20) || null,
        level:  Number.isFinite(msg.level) ? msg.level : 1,
        x: Number.isFinite(msg.x) ? msg.x : 300,
        y: Number.isFinite(msg.y) ? msg.y : 400,
        vx: 0, vy: 0,
        facing: msg.facing === -1 ? -1 : 1,
        map:    sanitizeString(msg.map, 24) || 'town',
        hp:    Number.isFinite(msg.hp)    ? msg.hp    : 100,
        maxHp: Number.isFinite(msg.maxHp) ? msg.maxHp : 100,
        mp:    Number.isFinite(msg.mp)    ? msg.mp    : 50,
        maxMp: Number.isFinite(msg.maxMp) ? msg.maxMp : 50,
        anim: 'idle',
      };
      const room = rooms.get(roomId);
      const players = [];
      for (const client of room.clients) {
        if (client === ws) continue;
        if (client._player) players.push(playerSnap(client));
      }
      wsSend(ws, { t: 'welcome', id, room: roomId, players, authed: !!ws._accountId });
      broadcast(roomId, { t: 'joined', ...playerSnap(ws) }, ws);
      return;
    }

    if (!ws._player || !ws._roomId) return;

    // ---- State tick ----
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
      if (typeof msg.cls    === 'string') p.cls    = sanitizeString(msg.cls, 16);
      if (typeof msg.job    === 'string') p.job    = sanitizeString(msg.job, 16);
      if (typeof msg.master === 'string') p.master = sanitizeString(msg.master, 20);
      if (typeof msg.anim   === 'string') p.anim   = sanitizeString(msg.anim, 16);
      broadcast(ws._roomId, { t: 'state', ...playerSnap(ws) }, ws);
      return;
    }

    // ---- Chat ----
    if (msg.t === 'chat') {
      const text = sanitizeString(msg.text, MAX_CHAT_LEN);
      if (!text) return;
      broadcast(ws._roomId, { t: 'chat', id: ws._player.id, name: ws._player.name, text });
      return;
    }

    // ---- Emote ----
    if (msg.t === 'emote') {
      const kind = sanitizeString(msg.kind, 4);
      if (!kind) return;
      broadcast(ws._roomId, { t: 'emote', id: ws._player.id, kind }, ws);
      return;
    }

    // ---- Explicit map change ----
    if (msg.t === 'map') {
      const map = sanitizeString(msg.map, 24);
      if (!map) return;
      ws._player.map = map;
      broadcast(ws._roomId, { t: 'state', ...playerSnap(ws) }, ws);
      return;
    }

    // ---- Server-side save (authed only) ----
    if (msg.t === 'save') {
      if (!ws._accountId) {
        wsSend(ws, { t: 'error', code: 'unauthed', message: 'Log in to save server-side' });
        return;
      }
      if (!msg.data || typeof msg.data !== 'object') return;
      try {
        const updatedAt = auth.putSave(ws._accountId, msg.data);
        wsSend(ws, { t: 'save_ok', updatedAt });
      } catch (e) {
        wsSend(ws, { t: 'error', code: 'save_failed', message: e.message });
      }
      return;
    }
  });

  ws.on('close', () => leaveRoom(ws));
  ws.on('error', () => leaveRoom(ws));
});

// ----- Idle sweep ---------------------------------------------------------

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

// ----- Boot --------------------------------------------------------------

httpServer.listen(PORT, () => {
  console.log(`[levelx-server v${VERSION}] listening on :${PORT}`);
  console.log(`[levelx-server] rooms default 'lobby', cap ${MAX_PER_ROOM}/room`);
  if (!process.env.SECRET) console.log(`[levelx-server] SECRET env var missing — using ephemeral secret`);
});

// Graceful shutdown — close DB on SIGTERM/SIGINT
['SIGTERM', 'SIGINT'].forEach(sig => {
  process.on(sig, () => {
    console.log(`[levelx-server] ${sig} received, shutting down…`);
    try { auth.db.close(); } catch (e) {}
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 3000).unref();
  });
});
