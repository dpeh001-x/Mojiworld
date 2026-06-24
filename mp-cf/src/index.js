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

export default {
  async fetch(request, env) {
    if (request.headers.get('Upgrade') === 'websocket') {
      return env.ROOMS.get(env.ROOMS.idFromName('global')).fetch(request);
    }
    return new Response('Mojiworld MP (Durable Object). Connect via WebSocket.\n', {
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
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
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
        const you = conn.token ? (await this.storage.get('save:' + conn.token)) || null : null;
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
      if (me && conn.token) { try { await this.storage.put('save:' + conn.token, saveOf(me.st)); } catch (_) {} }
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
          if (me) this.storage.put('save:' + conn.token, saveOf(me.st)).catch(() => {});
        }
      }
    }, REAP_MS);
  }
}
