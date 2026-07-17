// Embedded DIRECT-CONNECT relay — v0.29.101
// =============================================================================
// CommonJS port of mp/server.mjs (protocol-identical, minus the static file
// host). Started/stopped over IPC from main.js when the player clicks
// "Host direct" in the multiplayer panel: the HOST'S GAME PROCESS becomes the
// server, friends connect straight to ws://<host-lan-ip>:<port>. No external
// relay, no internet dependency — LAN works out of the box; over the internet
// the host forwards the TCP port (or the party uses Steam Remote Play).
// Hardening mirrors mp/server.mjs: null-frame guard, per-socket token bucket,
// payload cap + string sanitize, one-identity-per-socket, ping/pong reaping,
// backpressure-shedding on droppable frames.
const { WebSocketServer } = require('ws');
const http = require('http');
const os = require('os');

const PRESENCE_FIELDS = ['name', 'cls', 'job', 'master', 'level', 'map', 'x', 'y', 'vx', 'vy',
  'facing', 'hp', 'maxHp', 'mp', 'maxMp', 'anim', 'look', 'eq', 'v'];
const CTRL = /[\u0000-\u001f\u007f]/g;
const STR_CAP = 48;
const MAX_BUFFERED = 256 * 1024;
const RATE = 40, BURST = 60;
const HB_MS = 15000;

let httpServer = null, wss = null, hbTimer = null, activePort = 0;
let natClient = null, upnpState = { upnpOk: false, publicIp: null };

// v0.29.102 — zero-knowledge internet hosting: ask the router to open the
// port itself (UPnP / NAT-PMP — on by default on most home routers) and
// discover the public address, so the host just reads one address to a
// friend. Fail-open with a timeout: if the router refuses or doesn't speak
// UPnP, hosting still works on LAN and the UI shows the manual fallback.
function tryUpnp(port, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    const timer = setTimeout(() => finish({ upnpOk: false, publicIp: null }), timeoutMs);
    try {
      const NatAPI = require('nat-api');
      natClient = new NatAPI({ enablePMP: true });
      natClient.map({ publicPort: port, privatePort: port, protocol: 'TCP', ttl: 7200, description: 'Mojiworld Direct Co-op' }, (err) => {
        if (err) { clearTimeout(timer); finish({ upnpOk: false, publicIp: null }); return; }
        natClient.externalIp((e2, ip) => {
          clearTimeout(timer);
          finish({ upnpOk: true, publicIp: (!e2 && ip) ? String(ip) : null });
        });
      });
    } catch (e) { clearTimeout(timer); finish({ upnpOk: false, publicIp: null }); }
  });
}

// Public-IP fallback for routers that map fine but won't report the external
// address. Only consulted when the mapping SUCCEEDED (a public IP without an
// open port would be a misleading thing to show).
async function publicIpFallback() {
  try {
    const r = await fetch('https://api.ipify.org', { signal: AbortSignal.timeout(5000) });
    if (r.ok) { const t = (await r.text()).trim(); if (/^\d+\.\d+\.\d+\.\d+$/.test(t)) return t; }
  } catch (_) {}
  return null;
}

function lanIPs() {
  const out = [];
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const i of ifs[name] || []) {
      if (i.family === 'IPv4' && !i.internal) out.push(i.address);
    }
  }
  // Prefer private-range addresses (the ones a friend on the same LAN uses).
  out.sort((a, b) => (/^(192\.168|10\.|172\.)/.test(b) ? 1 : 0) - (/^(192\.168|10\.|172\.)/.test(a) ? 1 : 0));
  return out;
}

async function start(port = 17894, tries = 5) {
  if (httpServer && activePort) return { port: activePort, ips: lanIPs(), ...upnpState };
  const listened = await new Promise((resolveListen, rejectListen) => {
    const resolve = resolveListen, reject = rejectListen;
    startInner(port, tries, resolve, reject);
  });
  // Router auto-open (UPnP/NAT-PMP) + public address, fail-open in <=8s.
  upnpState = await tryUpnp(listened.port);
  if (upnpState.upnpOk && !upnpState.publicIp) upnpState.publicIp = await publicIpFallback();
  return { ...listened, ...upnpState };
}
function startInner(port, tries, resolve, reject) {
  {
    const rooms = new Map();
    let nextId = 1;
    const room = (r) => rooms.get(r) || (rooms.set(r, new Map()), rooms.get(r));
    const pick = (msg, st) => {
      for (const k of PRESENCE_FIELDS) if (k in msg) {
        let v = msg[k];
        if (typeof v === 'string') v = v.replace(CTRL, '').slice(0, STR_CAP);
        st[k] = v;
      }
      return st;
    };
    const sendTo = (ws, obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };
    const broadcast = (roomId, obj, exceptId, droppable) => {
      const m = rooms.get(roomId); if (!m) return;
      const s = JSON.stringify(obj);
      for (const [id, c] of m) {
        if (id === exceptId || c.ws.readyState !== 1) continue;
        if (droppable && c.ws.bufferedAmount > MAX_BUFFERED) continue;
        c.ws.send(s);
      }
    };

    httpServer = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('Mojiworld direct relay'); });
    wss = new WebSocketServer({ server: httpServer, maxPayload: 64 * 1024 });
    wss.on('connection', (ws) => {
      let id = null, roomId = null;
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
      let tokens = BURST, lastRefill = Date.now();
      const allow = () => {
        const now = Date.now();
        tokens = Math.min(BURST, tokens + (now - lastRefill) / 1000 * RATE);
        lastRefill = now;
        if (tokens < 1) return false;
        tokens -= 1; return true;
      };
      ws.on('message', (raw) => {
        let msg; try { msg = JSON.parse(raw); } catch { return; }
        if (!msg || typeof msg !== 'object') return;
        if (!allow()) return;
        try {
          if (msg.t === 'hello') {
            if (id !== null) return;
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
          if (id === null || roomId === null || !rooms.get(roomId)?.has(id)) return;
          const me = rooms.get(roomId).get(id);
          if (msg.t === 'state') {
            pick(msg, me.st);
            broadcast(roomId, { t: 'state', ...me.st }, id, true);
          } else if (msg.t === 'chat') {
            const text = String(msg.text || '').replace(CTRL, '').trim().slice(0, 200);
            if (text) broadcast(roomId, { t: 'chat', id, name: me.st.name || '?', text }, id);
          } else if (msg.t === 'emote') {
            broadcast(roomId, { t: 'emote', id, kind: String(msg.kind || '').replace(CTRL, '').slice(0, 24) }, id);
          } else if (msg.t === 'mon' || msg.t === 'dmg' || msg.t === 'kill' || msg.t === 'proj' || msg.t === 'haz' || msg.t === 'hazhit' || msg.t === 'bosshit' || msg.t === 'drop' || msg.t === 'down' || msg.t === 'up' || msg.t === 'revive' || msg.t === 'ping') {
            broadcast(roomId, { ...msg, id }, id, msg.t === 'mon' || msg.t === 'proj' || msg.t === 'haz');
          }
        } catch (_) { /* one bad message never takes down the relay */ }
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
    hbTimer = setInterval(() => {
      if (!wss) return;
      for (const ws of wss.clients) {
        if (ws.isAlive === false) { try { ws.terminate(); } catch (_) {} continue; }
        ws.isAlive = false;
        try { ws.ping(); } catch (_) {}
      }
    }, HB_MS);

    const tryListen = (p, left) => {
      httpServer.once('error', (e) => {
        if (e.code === 'EADDRINUSE' && left > 0) tryListen(p + 1, left - 1);
        else { stop(); reject(e); }
      });
      // 0.0.0.0 — must be reachable from the friend's machine, not just loopback.
      httpServer.listen(p, '0.0.0.0', () => { activePort = p; resolve({ port: p, ips: lanIPs() }); });
    };
    tryListen(port, tries);
  }
}

function stop() {
  if (hbTimer) { clearInterval(hbTimer); hbTimer = null; }
  if (natClient) { try { natClient.unmap({ publicPort: activePort || 17894 }, () => { try { natClient.destroy(() => {}); } catch (_) {} }); } catch (_) {} natClient = null; }
  upnpState = { upnpOk: false, publicIp: null };
  if (wss) { try { for (const c of wss.clients) c.terminate(); wss.close(); } catch (_) {} wss = null; }
  if (httpServer) { try { httpServer.close(); } catch (_) {} httpServer = null; }
  activePort = 0;
}

function status() { return { hosting: !!activePort, port: activePort, ips: activePort ? lanIPs() : [], ...upnpState }; }

module.exports = { start, stop, status, lanIPs };
