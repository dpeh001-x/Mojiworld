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
const WS_MAX_PAYLOAD = 64 * 1024;   // reject oversized frames (default ws limit is 100 MB -> OOM vector)
const WS_RATE        = 40;          // sustained msgs/sec per socket (client ticks ~14/s)
const WS_BURST       = 60;          // burst bucket
const VERSION        = '0.25.0';
// bughunt 2026-10-02 (relay-1 / relay-3 / relay-4 / relay-6):
//   TRUST_PROXY    how many reverse-proxy hops to trust for the client IP. 0 (default) = the socket's own address: X-Forwarded-For is
//                  client-controlled, and keying the rate limiter on its LEFT-most entry let one client mint a fresh bucket per request.
//                  Behind ONE proxy (Fly, Railway, nginx, Cloudflare) set TRUST_PROXY=1: the IP is then the entry that proxy appended.
//   MAX_CONN_PER_IP  concurrent WebSockets per IP; HELLO_MS  a socket without a hello is closed after this long.
const TRUST_PROXY    = Math.max(0, parseInt(process.env.TRUST_PROXY || '0', 10) || 0);
const MAX_CONN_PER_IP = parseInt(process.env.MAX_CONN_PER_IP || '64', 10);
const HELLO_MS       = parseInt(process.env.HELLO_MS || '10000', 10);
const HB_MS          = parseInt(process.env.HB_MS || '15000', 10);
const WS_BYTE_RATE   = 256 * 1024;  // per-socket bytes/sec sustained (an honest 56 KB paint piece every 300 ms is 187 KB/s)
const WS_BYTE_BURST  = 640 * 1024;
const BULK_LOOK      = 1024, BULK_EQ = 8192;   // look / eq: plain objects, JSON size caps (the real ones are about 0.3 KB / 1.5 KB)

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
    if (rateBuckets.size >= 50_000) { let n = 0; for (const k of rateBuckets.keys()) { rateBuckets.delete(k); if (++n >= 1000) break; } }   // bounded: oldest first
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

// The client's address for rate limits and connection caps (see TRUST_PROXY above).
function clientIp(req) {
  if (TRUST_PROXY > 0) {
    const xs = String(req.headers['x-forwarded-for'] || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (xs.length >= TRUST_PROXY) return xs[xs.length - TRUST_PROXY].slice(0, 64);
  }
  return req.socket.remoteAddress || '0.0.0.0';
}
// look / eq: a plain object inside its JSON cap, or nothing
const okBulk = (v, cap) => !!v && typeof v === 'object' && !Array.isArray(v) && JSON.stringify(v).length <= cap;

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
    // v0.29.x — full peer avatar (look/eq, matching mp/server.mjs since
    // v0.29.11) + client build stamp (version-skew detection).
    look: p.look, eq: p.eq, v: p.v,
    // v0.29.x — worn title, drawn under the peer's nameplate.
    ti: p.ti,
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

async function handleHttp(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS); res.end(); return;
  }

  const ip = clientIp(req);
  // relay-3: 'GET //' or 'GET http://[::1' made new URL throw, outside any try, before every route: one request line ended the process (every room)
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch (e) { return jsonResponse(res, 400, { error: 'bad url' }); }

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
      const user = await auth.createAccount({ username: body.username, password: body.password, email: body.email });
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
      const userId = await auth.authenticate({ username: body.username, password: body.password });
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
}
const httpServer = http.createServer((req, res) => {
  // nothing a request carries may end the process: an async handler that throws is an unhandled rejection
  handleHttp(req, res).catch(() => { try { if (!res.headersSent) jsonResponse(res, 500, { error: 'server error' }); else res.destroy(); } catch (e) { /* the socket is gone */ } });
});
process.on('unhandledRejection', (e) => { console.error('[levelx-server] unhandled rejection (kept running):', e && e.message); });

// ----- WebSocket handling -------------------------------------------------

const wss = new WebSocketServer({ server: httpServer, maxPayload: WS_MAX_PAYLOAD });

const ipConns = new Map();   // relay-6: concurrent sockets per IP
wss.on('connection', (ws, req) => {
  ws._ip = clientIp(req);
  const held = ipConns.get(ws._ip) || 0;
  if (held >= MAX_CONN_PER_IP) { try { ws.close(1013, 'too many connections'); } catch (e) {} return; }
  ipConns.set(ws._ip, held + 1);
  ws.once('close', () => { const n = (ipConns.get(ws._ip) || 1) - 1; if (n > 0) ipConns.set(ws._ip, n); else ipConns.delete(ws._ip); });
  ws._openedAt    = Date.now();
  ws.isAlive      = true;
  ws.on('pong', () => { ws.isAlive = true; });
  // relay-6: a socket that has not said hello by HELLO_MS is closed (it was in no room, so the idle sweep never saw it)
  const helloTimer = setTimeout(() => { if (!ws._player) { try { ws.terminate(); } catch (e) {} } }, HELLO_MS);
  if (helloTimer.unref) helloTimer.unref();
  ws.once('close', () => clearTimeout(helloTimer));
  ws._lastMsgAt   = Date.now();
  ws._lastStateAt = 0;
  ws._accountId   = null;  // populated by successful `auth` message
  // Per-socket token bucket: one client can no longer flood hello/chat/emote/map/save
  // (only `state` was throttled) and stall the shared event loop for every room.
  ws._tokens = WS_BURST;
  ws._lastRefill = Date.now();
  ws._btokens = WS_BYTE_BURST;   // relay-1: the byte bucket
  ws._blast = Date.now();

  ws.on('message', (data) => {
    ws._lastMsgAt = Date.now();
    const _bn = data.length != null ? data.length : data.byteLength, _bnow = Date.now();
    ws._btokens = Math.min(WS_BYTE_BURST, ws._btokens + (_bnow - ws._blast) / 1000 * WS_BYTE_RATE);
    ws._blast = _bnow;
    if (ws._btokens < _bn) return;   // over the byte budget: dropped unread
    ws._btokens -= _bn;
    // Flood guard — refill then spend one token; drop the frame past the burst.
    const _now = Date.now();
    ws._tokens = Math.min(WS_BURST, ws._tokens + (_now - ws._lastRefill) / 1000 * WS_RATE);
    ws._lastRefill = _now;
    if (ws._tokens < 1) return;
    ws._tokens -= 1;
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
      // One identity per socket. Without this, a second hello leaves ws in the
      // previous room's client Set (broadcast leak + never-'left' ghost peer) and
      // mints a new id every time -> unbounded room growth + a permanent socket
      // leak on close (leaveRoom only cleans ws._roomId). Matches mp/server.mjs:95.
      if (ws._player) { wsSend(ws, { t: 'error', code: 'already_joined', message: 'Already in a room' }); return; }
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
      // v0.29.x — full peer avatar (look/eq) + build stamp. Small nested
      // objects forwarded opaquely (the client whitelist-sanitizes every
      // field at ingestion before any registry lookup); the relay's frame
      // cap bounds their size, consistent with the verbatim 'mon' frames.
      // relay-1: capped (look <= 1 KB, eq <= 8 KB, plain objects) and re-sent only in the frame that carried them
      const gotLook = okBulk(msg.look, BULK_LOOK), gotEq = okBulk(msg.eq, BULK_EQ);
      if (gotLook) p.look = msg.look;
      if (gotEq)   p.eq   = msg.eq;
      if (typeof msg.v === 'string') p.v = sanitizeString(msg.v, 16);
      // v0.29.x — worn title. Sent as '' when unequipped (never omitted), so
      // clearing one actually propagates instead of sticking on every peer.
      if (typeof msg.ti === 'string') p.ti = sanitizeString(msg.ti, 64);
      const snap = playerSnap(ws);
      if (!gotLook) delete snap.look;
      if (!gotEq) delete snap.eq;
      broadcast(ws._roomId, { t: 'state', ...snap }, ws);
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

    // ---- Casual co-op host-authoritative monster sync (v0.27.0) ----
    // Forward monster state / damage / kill events verbatim to the room. The
    // relay stays dumb (never inspects game state); payloads are bounded by the
    // WS maxPayload + the per-socket token bucket added earlier.
    if (msg.t === 'mon' || msg.t === 'dmg' || msg.t === 'kill' || msg.t === 'proj' || msg.t === 'haz' || msg.t === 'hazhit' || msg.t === 'bosshit' || msg.t === 'drop' || msg.t === 'down' || msg.t === 'up' || msg.t === 'revive' || msg.t === 'ping') {
      broadcast(ws._roomId, { ...msg, id: ws._player.id }, ws);
      return;
    }

    // ---- Explicit map change ----
    if (msg.t === 'map') {
      const map = sanitizeString(msg.map, 24);
      if (!map) return;
      ws._player.map = map;
      const snap = playerSnap(ws);
      delete snap.look; delete snap.eq;
      broadcast(ws._roomId, { t: 'state', ...snap }, ws);
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

// relay-6: walks wss.clients, not the rooms - a socket that never said hello is in no room and used to be exempt. Also a ping/pong liveness
// check (as mp/server.mjs): a half-open peer that never answers is terminated, so its room entry and IP slot are released.
setInterval(() => {
  const now = Date.now();
  for (const ws of wss.clients) {
    if (!ws._player && now - (ws._openedAt || now) > HELLO_MS) { try { ws.terminate(); } catch (e) {} continue; }
    if (now - ws._lastMsgAt > IDLE_KICK_MS) { try { ws.close(1001, 'idle'); } catch (e) {} continue; }
    if (ws.isAlive === false) { try { ws.terminate(); } catch (e) {} continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch (e) {}
  }
}, HB_MS).unref?.();

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
