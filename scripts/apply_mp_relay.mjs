// Co-op relay launch hardening (infra audit 2026-09-26, #5 + #6) - mp-cf/, the Cloudflare Worker + Durable Object
// that is the game's shipped co-op relay AND its account / cloud-save API.
// ============================================================================
// What was wrong:
//   1) no inbound frame cap. A comment in onMessage promised "the inbound frame cap", but nothing enforced it (mp/ and
//      server/ cap at 64 KB): any client could push ~1 MB frames that were parsed and fanned out to the whole room.
//   2) no per-room cap: one room could grow without bound, and every frame costs (players - 1) sends.
//   3) every socket and the whole API share ONE Durable Object, idFromName('global').
//   4) auth: one round of salted SHA-256; session tokens never expired; login said 404 "no account" vs 401 "wrong
//      password" (a free username oracle); the rl: / fail: throttle keys were never deleted.
// What happens now:
//   1) a frame over 64 KB is dropped before JSON.parse (the sender is told once, the socket stays up). The game keeps
//      every frame under 56 KB by design, so nothing it sends is affected.
//   2) 5 players per room = the game's party of five (LX_PARTY_MAX_ALLIES 4 + you), counted per player token so a
//      re-join past one's own half-dead socket (or a 2nd tab) is never locked out; 10 sockets hard bound. Refusal is
//      { t:'error', code:'room_full', message } + close - the frame server/server.js already sends.
//   3) a socket that names its room in the URL (?room=<room id>) is routed to idFromName('room:' + id). The shipped
//      game dials the bare URL and names its room only inside 'hello', after the socket is bound to a DO, and a
//      WebSocket cannot move between DOs - so today's clients (and all of /api, i.e. every stored account) stay on
//      'global' untouched. Switching the client to ?room= is a separate, coordinated step (old and new builds of one
//      party would otherwise sit in different DOs and not see each other).
//   4) PBKDF2-SHA256 x100k for new passwords; a legacy SHA-256 account is verified the old way on login and re-hashed
//      on the spot; tokens are { u, exp } with a 365-day sliding expiry (pre-existing string tokens keep working and
//      start their clock); one 401 "Invalid username or password." for both failures, and every attempt pays one
//      PBKDF2 so timing does not tell them apart either; an alarm sweeps lapsed rl: / fail: / tok: keys.
// Also extends mp-cf/_cf_test.mjs + _api_test.mjs (the wrangler-dev tests) and adds a README section.
// Only ever touches files under ${ROOT}/mp-cf - never mojiworld_game.html. Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync, existsSync } from 'node:fs';
const ROOT = (process.env.LX_MP_ROOT || 'C:/Users/dpeh0/Mojiworld').replace(/[\\/]+$/, '');
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const files = [];   // { path, before, after }
function edit(rel, marker, lo, hi, fn) {
  const path = ROOT + '/mp-cf/' + rel;
  if (/mojiworld_game\.html$/i.test(path)) die('refusing to touch the game file');
  if (!existsSync(path)) die(rel + ' missing under ' + ROOT);
  const before = readFileSync(path, 'utf8');
  if (before.includes(marker)) { console.log('  ' + rel + ': already applied'); return; }
  const crlf = (before.match(/\r\n/g) || []).length, lf = (before.match(/\n/g) || []).length;
  const EOL = crlf > lf / 2 ? '\r\n' : '\n';
  let s = before;
  const J = (...L) => L.join(EOL);
  const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(rel + ': ' + what + ' matched ' + n); s = s.replace(a, () => b); };
  const region = (start, end, must, repl, what) => {   // replace [start, end) - both unique, close together, and holding `must`
    const a = s.indexOf(start), b = s.indexOf(end, a);
    if (a < 0 || s.indexOf(start, a + 1) >= 0 || b < 0 || s.indexOf(end, b + 1) >= 0 || b - a > 2500) die(rel + ': ' + what + ' region not found cleanly');
    for (const m of must) if (!s.slice(a, b).includes(m)) die(rel + ': ' + what + ' region lacks ' + JSON.stringify(m));
    s = s.slice(0, a) + repl + s.slice(b);
  };
  fn({ J, once, region, EOL });
  const grew = s.length - before.length;
  if (grew < lo || grew > hi) die(rel + ': size moved ' + grew);
  if (!s.includes(marker)) die(rel + ': marker missing after edit');
  files.push({ path, rel, before, after: s, grew });
}
const RAW = (t) => t.replace(/^\n/, '');   // String.raw blocks: LF in the script, EOL of the target file on the way in

// ---------------------------------------------------------------- mp-cf/src/index.js
edit('src/index.js', 'const FRAME_CAP = 64 * 1024;', 14000, 24000, ({ J, once, region, EOL }) => {
  const B = (t) => RAW(t).replace(/\n/g, EOL);
  once('const REAP_MS = 15000, IDLE_KILL_MS = 30000;', B(String.raw`
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
const REAP_MS = 15000, IDLE_KILL_MS = 30000;`), 'the REAP_MS constants');

  once('//         state{id,...}  chat{id,name,text}  emote{id,kind}', J(
    '//         state{id,...}  chat{id,name,text}  emote{id,kind}',
    '//         error{code,message}   mp-relay (2026-09-27): room_full | room_mismatch | frame_too_large'), 'the protocol doc');

  once('// per-account salted SHA-256 (Web Crypto) \u2014 good for a game, not bank-grade.', J(
    '// per-account salted PBKDF2-SHA256, 100k rounds (Web Crypto). mp-relay (2026-09-27) - they were one round of salted',
    '// SHA-256; such a record is re-hashed on its next good login. Sessions expire after a year unused (sliding).'), 'the auth doc line');

  once('function eqHash(a, b) {', B(String.raw`
// mp-relay (2026-09-27) - PBKDF2-SHA256 (WebCrypto), 256-bit, hex. 100k iterations is the Workers ceiling.
async function pbkdf2Hex(password, salt, iters) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: iters }, key, 256);
  return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function eqHash(a, b) {`), 'eqHash');

  once(J("    if (request.headers.get('Upgrade') === 'websocket' || url.pathname.startsWith('/api/')) {",
         "      return env.ROOMS.get(env.ROOMS.idFromName('global')).fetch(request);"), B(String.raw`
    if (request.headers.get('Upgrade') === 'websocket' || url.pathname.startsWith('/api/')) {
      // mp-relay (2026-09-27) - a socket that names its room in the URL (?room=<room id>) gets that room's OWN Durable
      // Object, so one busy party no longer queues behind every other. The shipped game still dials the bare URL and
      // names its room only in 'hello' - after the socket is bound to a DO, and a WebSocket cannot move between DOs -
      // so those sockets, and the whole /api (accounts, tokens, saves), stay on 'global' with every stored key in place.
      const room = url.pathname.startsWith('/api/') ? null : roomParam(url);
      return env.ROOMS.get(env.ROOMS.idFromName(room ? 'room:' + room : 'global')).fetch(request);`), 'the worker route');

  region('  constructor(state) {', '  room(r) {', ['this.storage = state.storage;', 'this.hb = null;'], B(String.raw`
  constructor(state, env) {
    this.state = state;
    this.storage = state.storage;
    this.rooms = new Map();   // roomId -> Map<id, { ws, st, tok }>
    this.conns = new Map();   // ws -> { id, roomId, token, pin, big, tokens, last, attAt, svh, svAt }
    this.nextId = 1;
    // mp-relay (2026-09-27) - tunables: the defaults at the top, or a wrangler [var] of the same name within bounds
    const e = env || {};
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

`), 'the constructor');

  region('    const pair = new WebSocketPair();', '  allow(conn, now) {', ['ws.accept();', 'this.ensureReaper();', "ws.addEventListener('message'"], B(String.raw`
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

`), 'the socket accept');
  INDEX_PART2({ J, once, region, B });
});

function INDEX_PART2({ J, once, region, B }) {
  once(J('  async onMessage(ws, conn, raw) {', '    let msg; try { msg = JSON.parse(raw); } catch { return; }'), B(String.raw`
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
    let msg; try { msg = JSON.parse(raw); } catch { return; }`), 'the onMessage head');

  once(J('    if (!this.allow(conn, now)) { conn.last = now; return; }', '    conn.last = now;'), J(
    '    if (!this.allow(conn, now)) { conn.last = now; return; }',
    '    conn.last = now;',
    '    if (now - conn.attAt > 5000) this._att(ws, conn, now);   // mp-relay (2026-09-27) - "last heard" survives hibernation'), 'the liveness stamp');

  once(J("        conn.roomId = String(msg.room || 'lobby').slice(0, 64);",
         '        conn.id = this.nextId++;',
         '        conn.token = msg.token ? String(msg.token).slice(0, 64) : null;',
         '        const st = pick(msg, { id: conn.id });',
         '        this.room(conn.roomId).set(conn.id, { ws, st });'), B(String.raw`
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
        this._att(ws, conn, now);   // mp-relay (2026-09-27) - who this socket is, for after a hibernation`), 'the hello join');

  once(J('        pick(msg, me.st);', "        this.broadcast(conn.roomId, { t: 'state', ...me.st }, conn.id);"), J(
    '        pick(msg, me.st);',
    '        this._att(ws, conn, now);   // mp-relay (2026-09-27) - keep the hibernation snapshot current',
    "        this.broadcast(conn.roomId, { t: 'state', ...me.st }, conn.id);"), 'the state relay');

  region('  async onClose(ws, conn) {', '  // ---- HTTP API: accounts + cloud saves', ['clearInterval(this.hb)', 'ensureReaper() {', 'setInterval(', 'saveOf(me.st)'], B(String.raw`
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
        if (conn.token && aliveSt(me.st) && fnv(JSON.stringify(rec)) !== conn.svh) { try { await this.storage.put(saveKey(conn), rec); } catch (_) {} }
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
        if (h !== conn.svh) { conn.svh = h; this.storage.put(saveKey(conn), rec).catch(() => {}); }
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

`), 'onClose + the setInterval reaper');
  INDEX_PART3({ J, once, region, B });
}

function INDEX_PART3({ J, once, region, B }) {
  once("this._ipThrottle(request, 'reg', 5, 60 * 1000)", "this._ipThrottle(request, 'reg', 5, this.throttleMs)", 'the register throttle');
  once("this._ipThrottle(request, 'login', 15, 60 * 1000)", "this._ipThrottle(request, 'login', 15, this.throttleMs)", 'the login throttle');
  once(J('    await this.storage.put(rk, r);', '    return r.n <= limit;'), J(
    '    await this.storage.put(rk, r);',
    '    await this._gcArm();   // mp-relay (2026-09-27) - an rl: key is swept once its window lapses',
    '    return r.n <= limit;'), 'the throttle write');

  once(J('    const hash = await hashPw(pass, salt);',
         '    const token = randToken();',
         '    await this.storage.put(ACCT_KEY(key), { name, salt, hash, created: Date.now() });',
         '    await this.storage.put(TOK_KEY(token), key);'), J(
    '    const hash = await pbkdf2Hex(pass, salt, PBKDF2_ITERS);   // mp-relay (2026-09-27) - PBKDF2-SHA256 x100k (was one SHA-256)',
    '    const token = randToken();',
    '    await this.storage.put(ACCT_KEY(key), { name, salt, hash, kdf: KDF, it: PBKDF2_ITERS, created: Date.now() });',
    '    await this._putToken(token, key);'), 'the register hash');

  region('    const fr = (await this.storage.get(fk)) || { n: 0, until: 0 };', "    return jsonResp({ ok: true, name: acct.name, token, kind: 'cloud' });",
    ["'No account with that name", "'Wrong password.'", 'const hash = await hashPw(pass, acct.salt);'], B(String.raw`
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
`), 'the login check');

  once(J('    if (!token) return null;', '    return (await this.storage.get(TOK_KEY(token))) || null;', '  }'), B(String.raw`
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
  }`), 'the token lookup');
}

// ---------------------------------------------------------------- mp-cf/_cf_test.mjs (wrangler dev protocol test)
edit('_cf_test.mjs', "code === 'room_full'", 2500, 6500, ({ J, once, EOL }) => {
  const B = (t) => RAW(t).replace(/\n/g, EOL);
  once(J('function client() {', '  const ws = new WebSocket(URL); const msgs = [];'), J(
    'function client(u) {   // mp-relay (2026-09-27) - u: a ?room= URL (default: the bare relay URL, like the game)',
    '  const ws = new WebSocket(u || URL); const msgs = [];'), 'client()');
  once(J('console.log(`\\n${pass} passed, ${fail} failed`);', 'process.exit(fail ? 1 : 0);'), B(String.raw`
// ---- mp-relay (2026-09-27): 64 KB frame cap, party-of-five room cap, per-room Durable Objects, keepalive ----
const until = async (f, ms = 3000) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await wait(50); return f(); };
const RUN = Date.now().toString(36);
const F1 = client(); await F1.ready; F1.send({ t: 'hello', name: 'Big', room: 'frame' + RUN + '__ch1' });
const F2 = client(); await F2.ready; F2.send({ t: 'hello', name: 'Watch', room: 'frame' + RUN + '__ch1' });
await until(() => F1.last('welcome') && F2.last('welcome'));
F1.send({ t: 'ping', pad: 'x'.repeat(70 * 1024) });
F1.send({ t: 'ping', pad: 'y'.repeat(50 * 1024) });
await until(() => F2.all('ping').length >= 2, 1500);
const pads = F2.all('ping').map((m) => String(m.pad || '').length);
ok(pads.length === 1 && pads[0] === 50 * 1024, 'frame cap: a 70 KB frame is dropped, a 50 KB one still relays ' + JSON.stringify(pads));
ok(F1.all('error').filter((m) => m.code === 'frame_too_large').length === 1 && F1.ws.readyState === 1, 'frame cap: the sender is told once and stays connected');
F1.close(); F2.close();

const CAPR = 'cap' + RUN + '__ch1', PT = [];
for (let i = 0; i < 5; i++) { const c = client(); await c.ready; c.send({ t: 'hello', token: TOK + '_c' + i, name: 'P' + i, room: CAPR }); PT.push(c); await until(() => c.last('welcome')); }
const X6 = client(); await X6.ready; X6.send({ t: 'hello', token: TOK + '_c6', name: 'Sixth', room: CAPR });
await until(() => X6.ws.readyState === 3 || X6.last('welcome'));
ok(X6.last('error') && X6.last('error').code === 'room_full' && !X6.last('welcome') && X6.ws.readyState === 3, 'room cap: a 6th player gets room_full and is disconnected');
ok(!PT[0].all('joined').some((j) => j.name === 'Sixth'), 'room cap: the party never saw the refused player');
const G0 = client(); await G0.ready; G0.send({ t: 'hello', token: TOK + '_c0', name: 'P0again', room: CAPR });
await until(() => G0.last('welcome') || G0.last('error'));
ok(!!G0.last('welcome'), 'room cap: the same player re-joining a full room (old socket still open) gets in');
PT[4].close(); await until(() => PT[0].last('left'));
const Y6 = client(); await Y6.ready; Y6.send({ t: 'hello', token: TOK + '_c7', name: 'Next', room: CAPR });
await until(() => Y6.last('welcome') || Y6.last('error'));
ok(!!Y6.last('welcome'), 'room cap: a freed slot admits the next player');
for (const c of [...PT, G0, Y6]) c.close();
const LB = [];
for (let i = 0; i < 7; i++) { const c = client(); await c.ready; c.send({ t: 'hello', token: TOK + '_l' + i, name: 'L' + i, room: 'lobby__ch4' }); LB.push(c); await until(() => c.last('welcome') || c.last('error')); }
ok(LB.every((c) => c.last('welcome')), 'room cap: the public lobby is no party - 7 players share lobby channel 4');
for (const c of LB) c.close();

const RA = 'solo' + RUN + '__ch1', RB = 'solo' + RUN + '__ch2';
const at = (r) => URL + '/?room=' + encodeURIComponent(r);
const R1 = client(at(RA)); await R1.ready; R1.send({ t: 'hello', name: 'R1', room: RA });
const R2 = client(at(RB)); await R2.ready; R2.send({ t: 'hello', name: 'R2', room: RB });
await until(() => R1.last('welcome') && R2.last('welcome'));
ok(R1.last('welcome') && R1.last('welcome').id === 1 && R2.last('welcome') && R2.last('welcome').id === 1, 'per-room DO: each ?room= socket is player #1 of its own Durable Object');
const R3 = client(at(RA)); await R3.ready; R3.send({ t: 'hello', name: 'R3', room: RA });
await until(() => R3.last('welcome'));
ok(R3.last('welcome') && R3.last('welcome').players.some((p) => p.name === 'R1'), 'per-room DO: players dialling the same room meet');
const R4 = client(at(RA)); await R4.ready; R4.send({ t: 'hello', name: 'R4', room: RB });
await until(() => R4.last('welcome') || R4.ws.readyState === 3);
ok(R4.last('error') && R4.last('error').code === 'room_mismatch' && !R4.last('welcome'), 'per-room DO: a hello naming another room is refused');
R1.ws.send('{"t":"ka"}');
await until(() => R1.all('ka').length > 0, 1500);
ok(R1.all('ka').length === 1, 'keepalive: the relay answers {"t":"ka"} (the runtime replies; the DO can stay asleep)');
for (const c of [R1, R2, R3, R4]) c.close();
await wait(150);

`) + J('console.log(`\\n${pass} passed, ${fail} failed`);', 'process.exit(fail ? 1 : 0);'), 'the summary lines');
});

// ---------------------------------------------------------------- mp-cf/_api_test.mjs (wrangler dev API test)
edit('_api_test.mjs', 'the same 401 as a wrong password', 300, 1200, ({ J, once }) => {
  once(J('// 6. unknown user',
    "ok((await post('/api/login', { username: 'nobody_' + Math.floor(Math.random() * 1e6), password: P })).status === 404, 'unknown user -> 404');"), J(
    '// 6. unknown user - mp-relay (2026-09-27): the very same 401 + message as a wrong password (it was 404: a username oracle)',
    "r = await post('/api/login', { username: 'nobody_' + Math.floor(Math.random() * 1e6), password: P });",
    'const jUnknown = { status: r.status, ...(await r.json()) };',
    "r = await post('/api/login', { username: U, password: 'wrongwrong' });",
    'const jWrong = { status: r.status, ...(await r.json()) };',
    "ok(jUnknown.status === 401 && jWrong.status === 401 && jUnknown.error === jWrong.error, 'unknown user -> the same 401 as a wrong password ' + JSON.stringify([jUnknown.error, jWrong.error]));"),
    'the unknown-user check');
});

// ---------------------------------------------------------------- mp-cf/README.md
edit('README.md', '## Launch hardening', 1000, 3200, ({ J, once }) => {
  once('## Files', J(
    '## Launch hardening (mp-relay, 2026-09-27)',
    '',
    '- **Frame cap:** inbound frames over 64 KB are dropped unread; the sender gets one `error{code:\'frame_too_large\'}`.',
    '- **Room cap:** 5 players per party-code room (the game\'s party of five); 50 per public lobby channel',
    '  (`lobby__ch1..5`, under the game\'s 64-peer view; the game moves a player on from a full one). Counted per player',
    '  token, so a re-join past your own half-dead socket or a second tab is never locked out; 2x cap sockets is the',
    '  hard bound. `error{code:\'room_full\'}` + close.',
    '- **Hibernation API:** sockets are `state.acceptWebSocket()`ed; an idle DO is evicted (no duration billed) and',
    '  rebuilt from per-socket attachments on wake. The game\'s `{"t":"ka"}` keepalive is answered by the runtime.',
    '  The reaper is an alarm (was a `setInterval` that kept the DO awake); positions save on leave and at most once a',
    '  minute while connected, only when changed (was every 15 s).',
    '- **Per-room Durable Objects (opt-in):** a socket dialled as `wss://<host>/?room=<room id>` goes to',
    '  `idFromName(\'room:\' + id)`. The shipped client dials the bare URL and names its room only in `hello`, so it',
    '  stays on the `global` DO together with the whole `/api`. Moving the client to `?room=` is a separate, coordinated',
    '  change: members of one party on old and new builds would otherwise sit in different DOs.',
    '- **Auth:** PBKDF2-SHA256 (100k) for new passwords; a legacy SHA-256 account is verified and re-hashed on its next',
    '  good login; sessions expire after a year unused (sliding; older tokens start their clock on first use); one',
    '  `401 Invalid username or password.` for unknown user and wrong password; an alarm sweeps lapsed `rl:` / `fail:` /',
    '  `tok:` keys.',
    '- **Tunables** (wrangler `[vars]`, bounded): `ROOM_CAP`, `LOBBY_CAP`, `IDLE_KILL_MS`, `SAVE_MS`, `TOKEN_TTL_MS`, `GC_MS`,',
    '  `THROTTLE_MS`, `FAIL_TTL_MS`.',
    '- **Rollback caution:** an account that logged in on this build is stored as PBKDF2; an older build cannot verify it.',
    '',
    '## Files'), 'the Files heading');
});

// ---------------------------------------------------------------- write everything (all edits computed first)
if (!files.length) { console.log('already applied'); process.exit(0); }
for (const f of files) {
  writeFileSync(f.path + '.tmp', f.after, 'utf8');
  if (statSync(f.path + '.tmp').size < f.before.length) die(f.rel + ': tmp smaller than the original');
}
for (const f of files) {
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(f.path + '.tmp', f.path); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die(f.rel + ': rename kept failing: ' + lastErr.code);
  console.log('applied: mp-relay ' + f.rel + ' (+' + f.grew + ' chars)');
}
