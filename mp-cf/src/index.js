// Mojiworld multiplayer on Cloudflare Durable Objects — stable, always-on,
// persistent MMO-lite. One global DO holds all rooms in memory (a port of the
// fidelity-tested relay in ../mp/server.mjs) AND persists per-player saves to DO
// storage, so a returning player respawns where they logged off.
//
// Protocol (identical to the in-game `net` client):
//   C->S: hello{name,room,token?,cls,job,master,level,map,x,y,facing,hp,maxHp,mp,maxMp}
//         state{...presence}  chat{text}  emote{kind}
//   S->C: welcome{id,room,players[],you?}  joined{id,...}  left{id}
//         state{id,...}  chat{id,name,text}  emote{id,kind}
// `you` (new) = the player's saved record for their token, or null. The client
// applies it on welcome to restore position/level. Back-compatible: clients that
// send no token and ignore `you` behave exactly like against the plain relay.

const PRESENCE_FIELDS = ['name', 'cls', 'job', 'master', 'level', 'map', 'x', 'y', 'vx', 'vy',
  'facing', 'hp', 'maxHp', 'mp', 'maxMp', 'anim'];
const SAVE_FIELDS = ['x', 'y', 'map', 'level', 'hp', 'maxHp', 'mp', 'maxMp', 'cls', 'job', 'master'];
const CTRL = /[\u0000-\u001f\u007f]/g;
const STR_CAP = 48, RATE = 40, BURST = 60;
const REAP_MS = 15000, IDLE_KILL_MS = 30000;   // app-level liveness (game ticks ~14/s, so any live client is never silent)

const pick = (msg, st) => {
  for (const k of PRESENCE_FIELDS) if (k in msg) {
    let v = msg[k];
    if (typeof v === 'string') v = v.replace(CTRL, '').slice(0, STR_CAP);
    st[k] = v;
  }
  return st;
};
const saveOf = (st) => { const o = {}; for (const k of SAVE_FIELDS) if (k in st) o[k] = st[k]; return o; };
// Save key is scoped to the ROOM (which includes the channel suffix) so the same
// browser token in two channels/tabs can't clobber one global save or restore a
// foreign channel's position. `aliveSt` skips persisting a dead snapshot so a
// returning player isn't respawned at the spot they died.
const saveKey = (conn) => 'save:' + conn.token + ':' + conn.roomId;
const aliveSt = (st) => !(Number.isFinite(+st.hp) && +st.hp <= 0);

// ---- HTTP account + cloud-save API (server-sided MMO-lite) --------------------
// Simple, self-contained auth on DO storage: register/login return a bearer token
// that GET/POST /api/save use to load/store the player's FULL character save
// (level, gear, boons, coins, ...) so it syncs across devices. Passwords are
// per-account salted SHA-256 (Web Crypto) — good for a game, not bank-grade.
const ACCT_KEY = (u) => 'acct:' + u;      // account record, keyed by lowercased username
const TOK_KEY = (t) => 'tok:' + t;        // session token -> lowercased username (multi-device)
const CSAVE_KEY = (u) => 'csave:' + u;    // full cloud save JSON, keyed by account
const CSAVE_CAP = 512 * 1024;             // max stored save size (bytes)
const U_RE = /^[a-zA-Z0-9_]{3,16}$/;
const okUser = (u) => typeof u === 'string' && U_RE.test(u);
const okPass = (p) => typeof p === 'string' && p.length >= 6 && p.length <= 64;
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-max-age': '86400',
};
const jsonResp = (obj, status) => new Response(JSON.stringify(obj), {
  status: status || 200, headers: { 'content-type': 'application/json', ...CORS },
});
const randHex = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join(''); };
const randToken = () => (crypto.randomUUID ? crypto.randomUUID() : randHex(16));
async function hashPw(password, salt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + password));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function eqHash(a, b) {   // length-safe constant-time-ish compare of two hex hashes
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // The WebSocket relay AND the HTTP account/cloud-save API are both served by
    // the one global Durable Object (shared storage). Route both to it.
    if (request.headers.get('Upgrade') === 'websocket' || url.pathname.startsWith('/api/')) {
      return env.ROOMS.get(env.ROOMS.idFromName('global')).fetch(request);
    }
    return new Response('Mojiworld MP (Durable Object). WebSocket relay + /api/{register,login,save}.\n', {
      status: 200, headers: { 'content-type': 'text/plain' },
    });
  },
};

export class MojiRoom {
  constructor(state) {
    this.storage = state.storage;
    this.rooms = new Map();   // roomId -> Map<id, { ws, st }>
    this.conns = new Map();   // ws -> { id, roomId, token, tokens, last }
    this.nextId = 1;
    this.hb = null;
  }

  room(r) { return this.rooms.get(r) || (this.rooms.set(r, new Map()), this.rooms.get(r)); }
  broadcast(roomId, obj, exceptId) {
    const m = this.rooms.get(roomId); if (!m) return;
    const s = JSON.stringify(obj);
    for (const [id, c] of m) { if (id !== exceptId) { try { c.ws.send(s); } catch (_) {} } }
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return this.handleApi(request);
    const pair = new WebSocketPair();
    const client = pair[0], ws = pair[1];
    ws.accept();
    const conn = { id: null, roomId: null, token: null, tokens: BURST, last: Date.now() };
    this.conns.set(ws, conn);
    ws.addEventListener('message', (e) => this.onMessage(ws, conn, e.data));
    ws.addEventListener('close', () => this.onClose(ws, conn));
    ws.addEventListener('error', () => { try { ws.close(); } catch (_) {} });
    this.ensureReaper();
    return new Response(null, { status: 101, webSocket: client });
  }

  allow(conn, now) {
    conn.tokens = Math.min(BURST, conn.tokens + (now - conn.last) / 1000 * RATE);
    if (conn.tokens < 1) return false;
    conn.tokens -= 1; return true;
  }

  async onMessage(ws, conn, raw) {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    const now = Date.now();
    if (!this.allow(conn, now)) { conn.last = now; return; }
    conn.last = now;
    try {
      if (msg.t === 'hello') {
        if (conn.id !== null) return;                 // one identity per socket
        conn.roomId = String(msg.room || 'lobby').slice(0, 64);
        conn.id = this.nextId++;
        conn.token = msg.token ? String(msg.token).slice(0, 64) : null;
        const st = pick(msg, { id: conn.id });
        this.room(conn.roomId).set(conn.id, { ws, st });
        const you = conn.token ? (await this.storage.get(saveKey(conn))) || null : null;
        const others = [];
        for (const [oid, c] of this.rooms.get(conn.roomId)) if (oid !== conn.id) others.push(c.st);
        ws.send(JSON.stringify({ t: 'welcome', id: conn.id, room: conn.roomId, players: others, you }));
        this.broadcast(conn.roomId, { t: 'joined', ...st }, conn.id);
        return;
      }
      if (conn.id === null || !this.rooms.get(conn.roomId)?.has(conn.id)) return;
      const me = this.rooms.get(conn.roomId).get(conn.id);
      if (msg.t === 'state') {
        pick(msg, me.st);
        this.broadcast(conn.roomId, { t: 'state', ...me.st }, conn.id);
      } else if (msg.t === 'chat') {
        const text = String(msg.text || '').replace(CTRL, '').trim().slice(0, 200);
        if (text) this.broadcast(conn.roomId, { t: 'chat', id: conn.id, name: me.st.name || '?', text }, conn.id);
      } else if (msg.t === 'emote') {
        this.broadcast(conn.roomId, { t: 'emote', id: conn.id, kind: String(msg.kind || '').replace(CTRL, '').slice(0, 24) }, conn.id);
      }
    } catch (_) { /* never let one bad message break the room */ }
  }

  async onClose(ws, conn) {
    this.conns.delete(ws);
    if (conn.roomId && conn.id && this.rooms.get(conn.roomId)) {
      const m = this.rooms.get(conn.roomId);
      const me = m.get(conn.id);
      if (me && conn.token && aliveSt(me.st)) { try { await this.storage.put(saveKey(conn), saveOf(me.st)); } catch (_) {} }
      m.delete(conn.id);
      this.broadcast(conn.roomId, { t: 'left', id: conn.id }, conn.id);
      if (m.size === 0) this.rooms.delete(conn.roomId);
    }
    if (this.conns.size === 0 && this.hb) { clearInterval(this.hb); this.hb = null; }
  }

  ensureReaper() {
    if (this.hb) return;
    this.hb = setInterval(() => {
      const now = Date.now();
      for (const [ws, conn] of this.conns) {
        if (now - conn.last > IDLE_KILL_MS) { try { ws.close(1001, 'idle'); } catch (_) {} continue; }
        // periodic save for active players (survives crashes between clean closes)
        if (conn.token && conn.roomId) {
          const me = this.rooms.get(conn.roomId)?.get(conn.id);
          if (me && aliveSt(me.st)) this.storage.put(saveKey(conn), saveOf(me.st)).catch(() => {});
        }
      }
    }, REAP_MS);
  }

  // ---- HTTP API: accounts + cloud saves --------------------------------------
  async handleApi(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const path = new URL(request.url).pathname;
    try {
      if (path === '/api/register' && request.method === 'POST') return await this.apiRegister(request);
      if (path === '/api/login' && request.method === 'POST') return await this.apiLogin(request);
      if (path === '/api/save' && request.method === 'GET') return await this.apiGetSave(request);
      if (path === '/api/save' && request.method === 'POST') return await this.apiPutSave(request);
      return jsonResp({ ok: false, error: 'not found' }, 404);
    } catch (_) {
      return jsonResp({ ok: false, error: 'server error' }, 500);
    }
  }

  async apiRegister(request) {
    let body; try { body = await request.json(); } catch { return jsonResp({ ok: false, error: 'bad request' }, 400); }
    const name = String((body && body.username) || '');
    const pass = String((body && body.password) || '');
    if (!okUser(name)) return jsonResp({ ok: false, error: 'Username must be 3-16 chars (letters, digits, underscore).' }, 400);
    if (!okPass(pass)) return jsonResp({ ok: false, error: 'Password must be 6-64 characters.' }, 400);
    const key = name.toLowerCase();
    if (await this.storage.get(ACCT_KEY(key))) return jsonResp({ ok: false, error: 'That name is already taken.' }, 409);
    const salt = randHex(16);
    const hash = await hashPw(pass, salt);
    const token = randToken();
    await this.storage.put(ACCT_KEY(key), { name, salt, hash, created: Date.now() });
    await this.storage.put(TOK_KEY(token), key);
    return jsonResp({ ok: true, name, token, kind: 'cloud' });
  }

  async apiLogin(request) {
    let body; try { body = await request.json(); } catch { return jsonResp({ ok: false, error: 'bad request' }, 400); }
    const name = String((body && body.username) || '');
    const pass = String((body && body.password) || '');
    if (!okUser(name) || !okPass(pass)) return jsonResp({ ok: false, error: 'Invalid username or password.' }, 400);
    const key = name.toLowerCase();
    const fk = 'fail:' + key, now = Date.now();
    const fr = (await this.storage.get(fk)) || { n: 0, until: 0 };
    if (fr.until && now < fr.until) return jsonResp({ ok: false, error: 'Too many attempts — try again shortly.' }, 429);
    const acct = await this.storage.get(ACCT_KEY(key));
    if (!acct) return jsonResp({ ok: false, error: 'No account with that name. Register one, or play as guest.' }, 404);
    const hash = await hashPw(pass, acct.salt);
    if (!eqHash(hash, acct.hash)) {
      const n = (fr.n || 0) + 1;
      await this.storage.put(fk, { n, until: n >= 8 ? now + 5 * 60 * 1000 : 0 });
      return jsonResp({ ok: false, error: 'Wrong password.' }, 401);
    }
    if (fr.n) this.storage.delete(fk).catch(() => {});
    const token = randToken();
    await this.storage.put(TOK_KEY(token), key);
    return jsonResp({ ok: true, name: acct.name, token, kind: 'cloud' });
  }

  async _userForToken(request) {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return null;
    return (await this.storage.get(TOK_KEY(token))) || null;
  }

  async apiGetSave(request) {
    const key = await this._userForToken(request);
    if (!key) return jsonResp({ ok: false, error: 'unauthorized' }, 401);
    const save = (await this.storage.get(CSAVE_KEY(key))) || null;
    return jsonResp({ ok: true, save });
  }

  async apiPutSave(request) {
    const key = await this._userForToken(request);
    if (!key) return jsonResp({ ok: false, error: 'unauthorized' }, 401);
    const text = await request.text();
    if (!text || text.length > CSAVE_CAP) return jsonResp({ ok: false, error: 'save missing or too large' }, 413);
    let save; try { save = JSON.parse(text); } catch { return jsonResp({ ok: false, error: 'bad save json' }, 400); }
    await this.storage.put(CSAVE_KEY(key), save);
    return jsonResp({ ok: true });
  }
}
