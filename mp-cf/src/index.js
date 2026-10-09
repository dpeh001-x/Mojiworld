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
//         error{code,message}   mp-relay (2026-09-27): room_full | room_mismatch | frame_too_large
// `you` (new) = the player's saved record for their token, or null. The client
// applies it on welcome to restore position/level. Back-compatible: clients that
// send no token and ignore `you` behave exactly like against the plain relay.

// v0.29.x — 'look' + 'eq' (full peer avatar, matching mp/server.mjs since
// v0.29.11) and 'v' (client build stamp for version-skew detection).
const PRESENCE_FIELDS = ['name', 'cls', 'job', 'master', 'level', 'map', 'x', 'y', 'vx', 'vy',
  'facing', 'hp', 'maxHp', 'mp', 'maxMp', 'anim', 'look', 'eq', 'v',
  // v0.29.x — 'ti' = the peer's worn title, shown under their nameplate.
  // Without it here the field is stripped off 'state' and a partner's title
  // only lands via the slower 2.5s 'ping' carrier.
  'ti'];
const SAVE_FIELDS = ['x', 'y', 'map', 'level', 'hp', 'maxHp', 'mp', 'maxMp', 'cls', 'job', 'master'];
const CTRL = /[\u0000-\u001f\u007f]/g;
const STR_CAP = 48, RATE = 40, BURST = 60;
// mp-relay (2026-09-27) - launch hardening (infra audit 2026-09-26, #5 + #6). Defaults; a wrangler [var] of the same name
// overrides ROOM_CAP / LOBBY_CAP / IDLE_KILL_MS / SAVE_MS / TOKEN_TTL_MS / GC_MS / THROTTLE_MS / FAIL_TTL_MS (bounded).
//   FRAME_CAP     inbound frames over 64 KB are dropped unread (onMessage's forward-list comment has promised this cap
//                 since v0.27.0; nothing enforced it). The game keeps every frame under 56 KB, as mp/ and server/ need.
//   ROOM_CAP      players per party-code room = the game's party of five (LX_PARTY_MAX_ALLIES 4 + you).
//   LOBBY_CAP     players per PUBLIC lobby channel (lobby__ch1..5, where the Multi window lands with no code): 50,
//                 under the 64 peers the game will draw. The game moves a player on from a full lobby channel.
//   SAVE_MS       a connected player's position is saved at most once a minute and only when it changed (it was every
//                 15 s for every player, changed or not - SQLite rows written are a daily quota on the Free plan).
//   TOKEN_TTL_MS  a cloud-save session expires after a year without use (sliding). The game has no sign-in screen any
//                 more, so an expired session would end that player's cloud sync for good: keep this long.
//   GC_MS         the alarm sweep of lapsed rl: / fail: / tok: keys (they used to live forever).
//   THROTTLE_MS   the per-IP register / login window;  FAIL_TTL_MS  a login-failure counter forgets after this.
const FRAME_CAP = 64 * 1024;
const ROOM_CAP = 5;
const LOBBY_CAP = 50;
const PUBLIC_ROOM = /^lobby(__ch\d+)?$/;   // mp-relay (2026-09-27) - the public lobby channels (no party code)
const SAVE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const TOKEN_TTL_MS = 365 * DAY_MS;
const GC_MS = 10 * 60 * 1000, THROTTLE_MS = 60 * 1000, FAIL_TTL_MS = 15 * 60 * 1000;
const GC_DUE = 'gc:due';                 // mp-relay (2026-09-27) - when the next sweep is owed (survives hibernation)
const PBKDF2_ITERS = 100000;             // mp-relay (2026-09-27) - the most Workers' WebCrypto accepts
const KDF = 'pbkdf2-sha256';
// mp-relay (2026-09-27) - the presence a socket's attachment keeps across hibernation (attachments cap at 2 KB; look / eq /
// anim simply arrive with the player's next frame)
const ATT_FIELDS = ['name', 'cls', 'job', 'master', 'level', 'map', 'x', 'y', 'facing', 'hp', 'maxHp', 'mp', 'maxMp', 'ti', 'v'];
const KA = '{"t":"ka"}';                 // mp-relay (2026-09-27) - the game's 20 s keepalive, answered without waking the DO
const _utf8 = new TextEncoder();
// mp-relay (2026-09-27) - over the byte cap? (UTF-8 bytes >= UTF-16 units, so only a mid-sized string needs encoding)
const tooBig = (raw) => {
  if (typeof raw !== 'string') return !!raw && (raw.byteLength || 0) > FRAME_CAP;
  if (raw.length > FRAME_CAP) return true;
  return raw.length * 3 > FRAME_CAP && _utf8.encode(raw).length > FRAME_CAP;
};
// mp-relay (2026-09-27) - the room a socket names in its URL (?room=<room id>, the hello's 64-char cut), or null
const roomParam = (url) => { const r = url.searchParams.get('room'); return r ? r.slice(0, 64) : null; };
// mp-relay (2026-09-27) - a short hash, so an unchanged position is not written again
const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
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
// per-account salted PBKDF2-SHA256, 100k rounds (Web Crypto). mp-relay (2026-09-27) - they were one round of salted
// SHA-256; such a record is re-hashed on its next good login. Sessions expire after a year unused (sliding).
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
  // cloud-close-push (2026-09-27) - content-encoding: the game's tab-close push may send the save gzipped (see readSaveBody)
  'access-control-allow-headers': 'content-type, authorization, content-encoding',
  'access-control-max-age': '86400',
};
// cloud-close-push (2026-09-27) - a save POST may come gzipped: the game's last push when a tab closes is a keepalive
// request, and browsers refuse a keepalive body over 64 KB (a late-game save is ~90 KB; ~20 KB gzipped). The game gzips
// only toward a relay whose /api/save answers carry "gz":1, so an older relay is never sent one.
// readCapped: the bytes of a stream, or null once past max (then the rest is not read)
async function readCapped(stream, max) {
  const rd = stream.getReader(), parts = [];
  let n = 0;
  for (;;) {
    const { value, done } = await rd.read();
    if (done) break;
    n += value.byteLength;
    if (n > max) { try { await rd.cancel(); } catch (_) {} return null; }
    parts.push(value);
  }
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.byteLength; }
  return out;
}
// cloud-close-push (2026-09-27) - the text of a save POST: '' when empty, null when surely over CSAVE_CAP characters (more
// than 3 UTF-8 bytes per character is impossible, so 3 x CSAVE_CAP bytes bounds it - plain or gunzipped: a gzip bomb
// stops there), undefined for a broken gzip body. A body that starts with the gzip magic bytes is gunzipped whatever its
// headers say (a JSON save starts with "{"), so one the edge already inflated still reads as plain.
async function readSaveBody(request) {
  if (!request.body) return '';
  let bytes = await readCapped(request.body, CSAVE_CAP * 3);
  if (bytes && bytes.length > 1 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    try { bytes = await readCapped(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')), CSAVE_CAP * 3); }
    catch (_) { return undefined; }
  }
  if (bytes === null) return null;
  return new TextDecoder().decode(bytes);
}
const jsonResp = (obj, status) => new Response(JSON.stringify(obj), {
  status: status || 200, headers: { 'content-type': 'application/json', ...CORS },
});
const randHex = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join(''); };
const randToken = () => (crypto.randomUUID ? crypto.randomUUID() : randHex(16));
async function hashPw(password, salt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + password));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
// mp-relay (2026-09-27) - PBKDF2-SHA256 (WebCrypto), 256-bit, hex. 100k iterations is the Workers ceiling.
async function pbkdf2Hex(password, salt, iters) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: iters }, key, 256);
  return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function eqHash(a, b) {   // length-safe constant-time-ish compare of two hex hashes
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // v0.30.1691 srv-time - the server's clock, for the game's daily rewards in the Steam app (its page is served by the app itself,
    // so the page's own server only knows the PC's clock). Answered here, without waking a Durable Object.
    if (url.pathname === '/api/time') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      return new Response(JSON.stringify({ ok: true, now: Date.now() }), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS } });
    }
    // The WebSocket relay AND the HTTP account/cloud-save API are both served by
    // the one global Durable Object (shared storage). Route both to it.
    if (request.headers.get('Upgrade') === 'websocket' || url.pathname.startsWith('/api/')) {
      // mp-relay (2026-09-27) - a socket that names its room in the URL (?room=<room id>) gets that room's OWN Durable
      // Object, so one busy party no longer queues behind every other. The shipped game still dials the bare URL and
      // names its room only in 'hello' - after the socket is bound to a DO, and a WebSocket cannot move between DOs -
      // so those sockets, and the whole /api (accounts, tokens, saves), stay on 'global' with every stored key in place.
      // mp-room-route (2026-09-27) - ROOM_DO = "0" (a wrangler var): every socket to 'global' again, ?room= or not
      const room = (url.pathname.startsWith('/api/') || /^(0|false|off)$/i.test(String((env && env.ROOM_DO) || ''))) ? null : roomParam(url);
      return env.ROOMS.get(env.ROOMS.idFromName(room ? 'room:' + room : 'global')).fetch(request);
    }
    return new Response('Mojiworld MP (Durable Object). WebSocket relay + /api/{register,login,save}.\n', {
      status: 200, headers: { 'content-type': 'text/plain' },
    });
  },
};

export class MojiRoom {
  constructor(state, env) {
    this.state = state;
    this.storage = state.storage;
    this.rooms = new Map();   // roomId -> Map<id, { ws, st, tok }>
    this.conns = new Map();   // ws -> { id, roomId, token, pin, big, tokens, last, attAt, svh, svAt }
    this.nextId = 1;
    // mp-relay (2026-09-27) - tunables: the defaults at the top, or a wrangler [var] of the same name within bounds
    const e = env || {};
    // mp-room-route (2026-09-27) - who this DO is: the saved positions live on 'global' (see _posGet)
    this.env = e;
    try { this._isGlobal = !(e.ROOMS && state.id && state.id.equals) || state.id.equals(e.ROOMS.idFromName('global')); } catch (_) { this._isGlobal = true; }
    const num = (k, d, lo, hi) => { const n = Number(e[k]); return (e[k] != null && e[k] !== '' && n >= lo && n <= hi) ? n : d; };
    this.cap = Math.floor(num('ROOM_CAP', ROOM_CAP, 2, 64));
    this.lobbyCap = Math.floor(num('LOBBY_CAP', LOBBY_CAP, 2, 500));
    this.idleMs = num('IDLE_KILL_MS', IDLE_KILL_MS, 5000, 10 * 60 * 1000);
    this.saveMs = num('SAVE_MS', SAVE_MS, 1000, DAY_MS);
    this.tokTtl = num('TOKEN_TTL_MS', TOKEN_TTL_MS, 1000, 5 * 365 * DAY_MS);
    this.tokSlide = Math.min(DAY_MS, this.tokTtl / 30);   // a used token is re-stamped at most about once a day
    this.gcMs = num('GC_MS', GC_MS, 1000, DAY_MS);
    this.throttleMs = num('THROTTLE_MS', THROTTLE_MS, 1000, DAY_MS);
    this.failTtl = num('FAIL_TTL_MS', FAIL_TTL_MS, 1000, DAY_MS);
    this._gcDue = undefined;   // the owed sweep's time as last seen (undefined: not read yet)
    this._gcAfter = {};
    // mp-relay (2026-09-27) - WebSocket Hibernation API. Sockets used to be ws.accept()ed next to a setInterval reaper, which
    // pinned the DO in memory (billed duration) for as long as ANY socket was open, idle or not. Now an idle DO - a party
    // parked in menus, a quiet lobby - is evicted while its sockets stay open; each socket carries who it is in an
    // attachment and the rooms are rebuilt from those right here when it wakes. The keepalive is answered by the runtime.
    try { state.setWebSocketAutoResponse(new WebSocketRequestResponsePair(KA, KA)); } catch (_) {}
    for (const ws of state.getWebSockets()) this._connFromAtt(ws);
  }

  room(r) { return this.rooms.get(r) || (this.rooms.set(r, new Map()), this.rooms.get(r)); }
  broadcast(roomId, obj, exceptId) {
    const m = this.rooms.get(roomId); if (!m) return;
    const s = JSON.stringify(obj);
    for (const [id, c] of m) { if (id !== exceptId) { try { c.ws.send(s); } catch (_) {} } }
  }

  async fetch(request) {
    // mp-room-route (2026-09-27) - the saved-position store, DO to DO only: the Worker never forwards /__pos (only upgrades and /api/*)
    if (request.headers.get('Upgrade') !== 'websocket' && new URL(request.url).pathname === '/__pos') return this._posApi(request);
    if (request.headers.get('Upgrade') !== 'websocket') return this.handleApi(request);
    const pair = new WebSocketPair();
    const client = pair[0], ws = pair[1];
    this.state.acceptWebSocket(ws);   // mp-relay (2026-09-27) - hibernatable (was ws.accept() + listeners)
    const now = Date.now();
    // mp-relay (2026-09-27) - pin: the room a per-room DO was dialled for (null on 'global'); big: oversized frames seen
    const conn = { id: null, roomId: null, token: null, pin: roomParam(new URL(request.url)), big: 0,
      tokens: BURST, last: now, attAt: 0, svh: null, svAt: 0 };
    this.conns.set(ws, conn);
    this._att(ws, conn, now);
    await this._schedule(now + this.idleMs + 1000);   // a socket that never says hello is reaped too
    return new Response(null, { status: 101, webSocket: client });
  }

  // mp-relay (2026-09-27) - the Hibernation API's entry points (they replace the per-socket listeners)
  async webSocketMessage(ws, raw) { await this.onMessage(ws, this.conns.get(ws) || this._connFromAtt(ws), raw); }
  async webSocketClose(ws) {
    await this.onClose(ws, this.conns.get(ws) || this._connFromAtt(ws));
    try { ws.close(1000, 'bye'); } catch (_) {}
  }
  async webSocketError(ws) { await this.webSocketClose(ws); }

  allow(conn, now) {
    conn.tokens = Math.min(BURST, conn.tokens + (now - conn.last) / 1000 * RATE);
    if (conn.tokens < 1) return false;
    conn.tokens -= 1; return true;
  }

  async onMessage(ws, conn, raw) {
    if (conn.closed) return;   // mp-relay (2026-09-27) - a refused / reaped socket says nothing more
    // mp-relay (2026-09-27) - the 64 KB inbound cap: an oversized frame is dropped before JSON.parse, so it is never parsed or
    // fanned out to the room. The sender hears about it once; the socket stays up.
    if (tooBig(raw)) {
      if (!conn.big++) {
        try { ws.send(JSON.stringify({ t: 'error', code: 'frame_too_large', message: 'A message over 64 KB was dropped.' })); } catch (_) {}
        this._att(ws, conn, Date.now());
      }
      return;
    }
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    const now = Date.now();
    if (!this.allow(conn, now)) { conn.last = now; return; }
    conn.last = now;
    if (now - conn.attAt > 5000) this._att(ws, conn, now);   // mp-relay (2026-09-27) - "last heard" survives hibernation
    try {
      if (msg.t === 'hello') {
        if (conn.id !== null) return;                 // one identity per socket
        const roomId = String(msg.room || 'lobby').slice(0, 64);
        const token = msg.token ? String(msg.token).slice(0, 64) : null;
        // mp-relay (2026-09-27) - a per-room DO serves only the room it was dialled for, and a room holds one party
        const why = (conn.pin != null && roomId !== conn.pin) ? 'room_mismatch' : this.roomFull(roomId, token) ? 'room_full' : null;
        if (why) { conn.closed = true; this.refuse(ws, why, roomId); return; }
        conn.roomId = roomId;
        conn.id = this.nextId++;
        conn.token = token;
        const st = pick(msg, { id: conn.id });
        this.room(conn.roomId).set(conn.id, { ws, st, tok: token });
        this._att(ws, conn, now);   // mp-relay (2026-09-27) - who this socket is, for after a hibernation
        const you = conn.token ? await this._posGet(conn) : null;   // mp-room-route (2026-09-27) - from 'global', whichever DO this is
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
        this._att(ws, conn, now);   // mp-relay (2026-09-27) - keep the hibernation snapshot current
        this.broadcast(conn.roomId, { t: 'state', ...me.st }, conn.id);
      } else if (msg.t === 'chat') {
        const text = String(msg.text || '').replace(CTRL, '').trim().slice(0, 200);
        if (text) this.broadcast(conn.roomId, { t: 'chat', id: conn.id, name: me.st.name || '?', text }, conn.id);
      } else if (msg.t === 'emote') {
        this.broadcast(conn.roomId, { t: 'emote', id: conn.id, kind: String(msg.kind || '').replace(CTRL, '').slice(0, 24) }, conn.id);
      } else if (msg.t === 'mon' || msg.t === 'dmg' || msg.t === 'kill' || msg.t === 'proj' || msg.t === 'haz' || msg.t === 'hazhit' || msg.t === 'bosshit' || msg.t === 'drop' || msg.t === 'down' || msg.t === 'up' || msg.t === 'revive' || msg.t === 'ping') {
        // v0.27.0 — casual co-op host-authoritative monster sync. Forward verbatim
        // to the room; the relay never inspects game state. Bounded by the inbound
        // frame cap + per-connection rate limit already enforced above.
        this.broadcast(conn.roomId, { ...msg, id: conn.id }, conn.id);
      }
    } catch (_) { /* never let one bad message break the room */ }
  }

  async onClose(ws, conn) {
    this.conns.delete(ws);
    if (!conn || conn.closed) return;   // mp-relay (2026-09-27) - the reaper and the runtime may both report one close
    conn.closed = true;
    try { ws.serializeAttachment({ closed: 1 }); } catch (_) {}   // mp-relay (2026-09-27) - so a later wake-up never revives it
    if (conn.roomId && conn.id && this.rooms.get(conn.roomId)) {
      const m = this.rooms.get(conn.roomId);
      const me = m.get(conn.id);
      if (me && me.ws === ws) {
        // mp-relay (2026-09-27) - the save on leave, skipped when the periodic save already holds this exact record
        const rec = saveOf(me.st);
        if (conn.token && aliveSt(me.st) && fnv(JSON.stringify(rec)) !== conn.svh) { try { await this._posPut(conn, rec); } catch (_) {} }   // mp-room-route (2026-09-27)
        m.delete(conn.id);
        this.broadcast(conn.roomId, { t: 'left', id: conn.id }, conn.id);
        if (m.size === 0) this.rooms.delete(conn.roomId);
      }
    }
  }

  // mp-relay (2026-09-27) - room cap: a party code holds ROOM_CAP, a public lobby channel LOBBY_CAP. Counted per player
  // token (a socket without one counts alone), so the same player re-joining past a half-dead socket of theirs, or
  // opening a second tab, is never locked out of their own room; cap * 2 sockets is the hard bound either way.
  capFor(roomId) { return PUBLIC_ROOM.test(roomId) ? this.lobbyCap : this.cap; }
  roomFull(roomId, token) {
    const m = this.rooms.get(roomId);
    if (!m) return false;
    const cap = this.capFor(roomId);
    if (m.size >= cap * 2) return true;
    const who = new Set();
    for (const [id, c] of m) {
      const k = c.tok ? 't:' + c.tok : '#' + id;
      if (token && k === 't:' + token) return false;
      who.add(k);
    }
    return who.size >= cap;
  }
  // mp-relay (2026-09-27) - refuse a hello. The game prints t:'error' frames as "[server] <message>" (server/server.js sends
  // this same room_full frame); then the socket closes.
  refuse(ws, code, roomId) {
    const ch = /^(.*)__ch(\d+)$/.exec(roomId);
    const label = (ch ? ch[1].toUpperCase() + ' (Ch ' + ch[2] + ')' : roomId.toUpperCase()).replace(CTRL, '');
    const message = code === 'room_full'
      ? (PUBLIC_ROOM.test(roomId) ? 'Lobby' + (ch ? ' channel ' + ch[2] : '') : 'Party ' + label) + ' is full (' + this.capFor(roomId) + ' players).'
      : 'This connection was opened for another room.';
    try { ws.send(JSON.stringify({ t: 'error', code, message })); } catch (_) {}
    try { ws.serializeAttachment({ closed: 1 }); } catch (_) {}
    try { ws.close(4001, code); } catch (_) {}
  }

  // mp-room-route (2026-09-27) - "respawn where you logged off" records (save:<token>:<room id>) live on 'global' for every DO. A per-room
  // DO (?room=) used to keep them in its own storage: moving a room off 'global' lost every record it held there once, and
  // a party on older (bare URL) and newer builds kept two diverging copies. Now a per-room DO reads / writes them on
  // 'global' (DO to DO); 'global' itself uses its storage as before.
  async _posGet(conn) {
    const k = saveKey(conn);
    if (this._isGlobal) return (await this.storage.get(k)) || null;
    try {
      const j = await Promise.race([this._posCall({ k }), new Promise((res) => setTimeout(() => res(null), 3000))]);
      return (j && j.rec) || null;   // no answer in 3 s: no restore this time (as for a new player)
    } catch (_) { return null; }
  }
  async _posPut(conn, rec) {
    const k = saveKey(conn);
    if (this._isGlobal) return this.storage.put(k, rec);
    const j = await this._posCall({ k, rec, put: 1 });
    if (!j || !j.ok) throw new Error('position not saved');
  }
  async _posCall(body) {
    const g = this.env.ROOMS.get(this.env.ROOMS.idFromName('global'));
    const r = await g.fetch('https://global.do/__pos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  }
  async _posApi(request) {   // mp-room-route (2026-09-27) - on 'global': { k } -> { rec }, { k, rec, put } -> stored
    if (!this._isGlobal) return jsonResp({ ok: false, error: 'not global' }, 404);
    let b; try { b = await request.json(); } catch (_) { b = null; }
    const k = String((b && b.k) || '');
    if (!/^save:/.test(k) || k.length > 200) return jsonResp({ ok: false, error: 'bad key' }, 400);
    if (b.put) { await this.storage.put(k, b.rec); return jsonResp({ ok: true }); }
    return jsonResp({ ok: true, rec: (await this.storage.get(k)) || null });
  }

  // mp-relay (2026-09-27) - rebuild one socket's player from its attachment (a DO woken from hibernation)
  _connFromAtt(ws) {
    let a = null;
    try { a = ws.deserializeAttachment(); } catch (_) {}
    a = a || {};
    const conn = { id: a.id == null ? null : a.id, roomId: a.roomId || null, token: a.token || null, pin: a.pin == null ? null : a.pin,
      big: a.big | 0, tokens: BURST, last: a.last || Date.now(), attAt: 0, svh: a.svh || null, svAt: a.svAt || 0, closed: !!a.closed };
    this.conns.set(ws, conn);
    if (conn.id != null && conn.roomId && !conn.closed) {
      this.room(conn.roomId).set(conn.id, { ws, st: { ...(a.st || {}), id: conn.id }, tok: conn.token });
      if (conn.id >= this.nextId) this.nextId = conn.id + 1;
    }
    return conn;
  }
  // mp-relay (2026-09-27) - what survives hibernation: who the socket is, when it was last heard, its last save, and a
  // compact presence
  _att(ws, conn, now) {
    conn.attAt = now;
    const a = { id: conn.id, roomId: conn.roomId, token: conn.token, pin: conn.pin, big: conn.big, last: conn.last, svh: conn.svh, svAt: conn.svAt };
    const me = conn.id != null ? this.rooms.get(conn.roomId)?.get(conn.id) : null;
    if (me) { const st = {}; for (const k of ATT_FIELDS) if (k in me.st) st[k] = me.st[k]; a.st = st; }
    try { ws.serializeAttachment(a); } catch (_) { try { delete a.st; ws.serializeAttachment(a); } catch (_) {} }
  }
  // mp-relay (2026-09-27) - one alarm per DO serves the reaper and the GC: keep whichever is due first
  async _schedule(t) {
    const cur = await this.storage.getAlarm();
    if (cur == null || t < cur) await this.storage.setAlarm(t);
  }
  // mp-relay (2026-09-27) - the reaper (was a 15 s setInterval, which kept the DO awake): close sockets silent past the idle
  // limit (a keepalive the runtime answered counts as heard), and save each connected player at most once per SAVE_MS,
  // only when the record changed. Returns when it must look again.
  async _reap(now) {
    let next = Infinity;
    const gone = [];
    for (const ws of this.state.getWebSockets()) {
      const conn = this.conns.get(ws) || this._connFromAtt(ws);
      if (conn.closed) continue;   // already refused / reaped; the runtime is finishing the close
      let seen = conn.last || 0;
      try { const t = this.state.getWebSocketAutoResponseTimestamp(ws); if (t && +t > seen) seen = +t; } catch (_) {}
      if (now - seen > this.idleMs) { try { ws.close(1001, 'idle'); } catch (_) {} gone.push(this.onClose(ws, conn)); continue; }
      next = Math.min(next, seen + this.idleMs + 1000);
      const me = conn.token && conn.id != null ? this.rooms.get(conn.roomId)?.get(conn.id) : null;
      if (me && aliveSt(me.st) && now - conn.svAt >= this.saveMs) {
        const rec = saveOf(me.st), h = fnv(JSON.stringify(rec));
        conn.svAt = now;
        if (h !== conn.svh) { conn.svh = h; gone.push(this._posPut(conn, rec).catch(() => {})); }   // mp-room-route (2026-09-27) - awaited below
        this._att(ws, conn, now);
      }
    }
    await Promise.all(gone);
    return next;
  }
  async alarm() {   // mp-relay (2026-09-27) - reaper + GC, then re-arm for whichever is due first
    const now = Date.now();
    const next = Math.min(await this._reap(now), await this._gcTick(now));
    if (next < Infinity) await this.storage.setAlarm(Math.max(next, now + 1000));
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

  // Per-IP sliding-window throttle. Register/login share the one global DO with
  // the WebSocket relay, so an unauthenticated request flood serializes ahead of
  // live gameplay and stalls every room. Keyed on the requester's IP so a flood
  // only slows its own source, never other players. Returns true if allowed.
  async _ipThrottle(request, bucket, limit, windowMs) {
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const rk = 'rl:' + bucket + ':' + ip, now = Date.now();
    const r = (await this.storage.get(rk)) || { n: 0, reset: now + windowMs };
    if (now > r.reset) { r.n = 0; r.reset = now + windowMs; }
    r.n += 1;
    await this.storage.put(rk, r);
    await this._gcArm();   // mp-relay (2026-09-27) - an rl: key is swept once its window lapses
    return r.n <= limit;
  }

  async apiRegister(request) {
    let body; try { body = await request.json(); } catch { return jsonResp({ ok: false, error: 'bad request' }, 400); }
    const name = String((body && body.username) || '');
    const pass = String((body && body.password) || '');
    if (!okUser(name)) return jsonResp({ ok: false, error: 'Username must be 3-16 chars (letters, digits, underscore).' }, 400);
    if (!okPass(pass)) return jsonResp({ ok: false, error: 'Password must be 6-64 characters.' }, 400);
    if (!(await this._ipThrottle(request, 'reg', 5, this.throttleMs)))
      return jsonResp({ ok: false, error: 'Too many registrations — try again shortly.' }, 429);
    const key = name.toLowerCase();
    if (await this.storage.get(ACCT_KEY(key))) return jsonResp({ ok: false, error: 'That name is already taken.' }, 409);
    const salt = randHex(16);
    const hash = await pbkdf2Hex(pass, salt, PBKDF2_ITERS);   // mp-relay (2026-09-27) - PBKDF2-SHA256 x100k (was one SHA-256)
    const token = randToken();
    await this.storage.put(ACCT_KEY(key), { name, salt, hash, kdf: KDF, it: PBKDF2_ITERS, created: Date.now() });
    await this._putToken(token, key);
    return jsonResp({ ok: true, name, token, kind: 'cloud' });
  }

  async apiLogin(request) {
    let body; try { body = await request.json(); } catch { return jsonResp({ ok: false, error: 'bad request' }, 400); }
    const name = String((body && body.username) || '');
    const pass = String((body && body.password) || '');
    if (!okUser(name) || !okPass(pass)) return jsonResp({ ok: false, error: 'Invalid username or password.' }, 400);
    if (!(await this._ipThrottle(request, 'login', 15, this.throttleMs)))
      return jsonResp({ ok: false, error: 'Too many attempts — try again shortly.' }, 429);
    const key = name.toLowerCase();
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    // Brute-force lockout scoped to (ip + username), NOT the target account alone.
    // The old 'fail:'+key let anyone lock a victim out of their own CORRECT password
    // by spamming wrong ones (the gate runs before the password check). Keying on the
    // requester's IP means the counter only ever throttles the attacking source; the
    // victim logging in from their own IP is never gated by someone else's failures.
    const fk = 'fail:' + ip + ':' + key, now = Date.now();
    const fr0 = await this.storage.get(fk);
    if (fr0 && fr0.until && now < fr0.until) return jsonResp({ ok: false, error: 'Too many attempts \u2014 try again shortly.' }, 429);
    // mp-relay (2026-09-27) - a failure counter forgets FAIL_TTL after its last failure (a legacy record has no 'at': old)
    const fr = (fr0 && now - (fr0.at || 0) <= this.failTtl) ? fr0 : { n: 0, until: 0 };
    const acct = await this.storage.get(ACCT_KEY(key));
    // mp-relay (2026-09-27) - verify. Every attempt pays exactly one PBKDF2 whatever the account (none, legacy, current), so
    // neither the answer nor its timing tells whether the name exists. A legacy salted-SHA-256 record that just proved
    // its password is re-hashed with PBKDF2 on the spot (transparent migration; the account's saves never move).
    let good = false;
    if (acct && acct.kdf === KDF) {
      good = eqHash(await pbkdf2Hex(pass, acct.salt, acct.it || PBKDF2_ITERS), acct.hash);
    } else {
      const legacyOk = !!acct && eqHash(await hashPw(pass, acct.salt), acct.hash);
      const salt = randHex(16), hash = await pbkdf2Hex(pass, salt, PBKDF2_ITERS);
      if (legacyOk) {
        await this.storage.put(ACCT_KEY(key), { ...acct, salt, hash, kdf: KDF, it: PBKDF2_ITERS, rehashed: now });
        good = true;
      }
    }
    if (!good) {
      const n = (fr.n || 0) + 1;
      await this.storage.put(fk, { n, until: n >= 8 ? now + 5 * 60 * 1000 : 0, at: now });
      await this._gcArm();
      // mp-relay (2026-09-27) - ONE answer for "no such account" and "wrong password" (they were 404 vs 401)
      return jsonResp({ ok: false, error: 'Invalid username or password.' }, 401);
    }
    if (fr0) this.storage.delete(fk).catch(() => {});
    const token = randToken();
    await this._putToken(token, key);
    return jsonResp({ ok: true, name: acct.name, token, kind: 'cloud' });
  }

  async _userForToken(request) {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token || token.length > 128) return null;   // mp-relay (2026-09-27) - (a 2 KB+ key made storage.get throw: a 500)
    // mp-relay (2026-09-27) - sessions expire: tok:<t> = { u, exp }, and exp slides forward on use (re-stamped at most about
    // once a day). A token minted before expiry existed (a bare username string) keeps working; its clock starts now.
    const rec = await this.storage.get(TOK_KEY(token));
    if (!rec) return null;
    if (typeof rec === 'string') { await this._putToken(token, rec); return rec; }
    const now = Date.now();
    if (!rec.u || !(now < rec.exp)) { await this.storage.delete(TOK_KEY(token)); return null; }
    if (rec.exp - now < this.tokTtl - this.tokSlide) await this.storage.put(TOK_KEY(token), { u: rec.u, exp: now + this.tokTtl });
    return rec.u;
  }

  async _putToken(token, key) {   // mp-relay (2026-09-27) - every session carries its expiry
    await this.storage.put(TOK_KEY(token), { u: key, exp: Date.now() + this.tokTtl });
    await this._gcArm();
  }

  // mp-relay (2026-09-27) - GC. The alarm sweeps what has lapsed: rl: windows, fail: counters, expired tok: sessions (and
  // starts the clock of a pre-expiry token nobody has used since). It is owed GC_MS after an API write, then again when
  // the soonest key left lapses (never sooner than GC_MS; right away-ish when a page came back full), until none is left.
  async _gcArm() {
    const t = Date.now() + this.gcMs;
    try {
      if (this._gcDue === undefined) { const d = await this.storage.get(GC_DUE); this._gcDue = d == null ? null : d; }
      if (this._gcDue != null && this._gcDue <= t) return;   // a sweep is owed by then already
      this._gcDue = t;
      await this.storage.put(GC_DUE, t);
      await this._schedule(t);
    } catch (_) { this._gcDue = undefined; }
  }
  async _gcTick(now) {   // mp-relay (2026-09-27) - when the next sweep is due (Infinity: none owed)
    const due = await this.storage.get(GC_DUE);
    if (due == null) return Infinity;
    if (now < due) return due;
    const soonest = await this._sweep(now);
    if (soonest < Infinity) { const t = Math.max(soonest + 1000, now + this.gcMs); this._gcDue = t; await this.storage.put(GC_DUE, t); return t; }
    this._gcDue = null;
    await this.storage.delete(GC_DUE);
    return Infinity;
  }
  async _sweep(now) {   // mp-relay (2026-09-27) - one page per prefix; returns when the soonest key left lapses (Infinity: none)
    let soonest = Infinity;
    const keep = (t) => { if (t < soonest) soonest = t; };
    for (const prefix of ['rl:', 'fail:', 'tok:']) {
      const opt = { prefix, limit: 500 };
      if (this._gcAfter[prefix]) opt.startAfter = this._gcAfter[prefix];
      const page = await this.storage.list(opt);
      const dead = [], restamp = {};
      let last = null;
      for (const [k, v] of page) {
        last = k;
        if (prefix === 'rl:') { if (v && now <= v.reset) keep(v.reset); else dead.push(k); }
        else if (prefix === 'fail:') { if (v && (v.until > now || now - (v.at || 0) <= this.failTtl)) keep(Math.max(v.until || 0, (v.at || 0) + this.failTtl)); else dead.push(k); }
        else if (typeof v === 'string') { restamp[k] = { u: v, exp: now + this.tokTtl }; keep(now + this.tokTtl); }
        else if (v && v.u && now < v.exp) keep(v.exp);
        else dead.push(k);
      }
      this._gcAfter[prefix] = page.size >= 500 ? last : undefined;
      if (page.size >= 500) keep(now);   // more to read: next sweep after GC_MS
      for (let i = 0; i < dead.length; i += 128) await this.storage.delete(dead.slice(i, i + 128));
      const rk = Object.keys(restamp);
      for (let i = 0; i < rk.length; i += 128) { const o = {}; for (const k of rk.slice(i, i + 128)) o[k] = restamp[k]; await this.storage.put(o); }
    }
    return soonest;
  }

  async apiGetSave(request) {
    const key = await this._userForToken(request);
    if (!key) return jsonResp({ ok: false, error: 'unauthorized' }, 401);
    const save = (await this.storage.get(CSAVE_KEY(key))) || null;
    return jsonResp({ ok: true, save, gz: 1 });   // cloud-close-push (2026-09-27) - gz: this relay takes a gzipped save POST
  }

  async apiPutSave(request) {
    const key = await this._userForToken(request);
    if (!key) return jsonResp({ ok: false, error: 'unauthorized' }, 401);
    const text = await readSaveBody(request);   // cloud-close-push (2026-09-27) - plain or gzipped, read under the cap
    if (text === undefined) return jsonResp({ ok: false, error: 'bad save json' }, 400);
    if (!text || text.length > CSAVE_CAP) return jsonResp({ ok: false, error: 'save missing or too large' }, 413);
    let save; try { save = JSON.parse(text); } catch { return jsonResp({ ok: false, error: 'bad save json' }, 400); }
    await this.storage.put(CSAVE_KEY(key), save);
    return jsonResp({ ok: true, gz: 1 });   // cloud-close-push (2026-09-27) - gz: see apiGetSave
  }
}
