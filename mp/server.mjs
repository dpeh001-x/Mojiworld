// Mojiworld — persistent MMO-lite prototype server.
// Authoritative shared world over WebSocket + server-side saves (players.json).
// Run:  cd mp && npm install && npm start    -> http://localhost:8787/mp_demo.html
//
// This is a PROTOTYPE: it trusts client-reported positions (semi-authoritative)
// to keep the first cut small. The upgrade path to fully authoritative is to
// accept INPUT (held keys) instead of positions and integrate movement here in
// the tick loop — see README.md "Hardening".
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(DIR, '..');                       // repo root, so the real game is reachable too
const PORT = process.env.PORT || 8787;
const TICK_HZ = 20;
const SAVE_PATH = join(DIR, 'players.json');
const STALE_MS = 30_000;                            // drop a record from the live snapshot if silent this long

// ---- persistence: token -> saved player record -------------------------------
let saved = {};
try { if (existsSync(SAVE_PATH)) saved = JSON.parse(readFileSync(SAVE_PATH, 'utf8')) || {}; } catch (_) {}
let saveTimer = null;
function scheduleSave() {                            // debounced — never block the tick on disk I/O
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try { await writeFile(SAVE_PATH, JSON.stringify(saved), 'utf8'); }
    catch (e) { console.error('save failed', e.message); }
  }, 2000);
}

// ---- live world: token -> { rec, ws } ----------------------------------------
const online = new Map();
let nextId = 1;
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

// ---- static file server (serves the repo so demo + game share an origin) -----
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const http = createServer(async (req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/mp/mp_demo.html';
  const abs = normalize(join(ROOT, p));
  if (!abs.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }   // path-traversal guard
  try {
    const buf = await readFile(abs);
    res.writeHead(200, { 'content-type': MIME[extname(abs)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404).end('not found'); }
});

// ---- websocket: hello (load/restore) + state (update) ------------------------
const wss = new WebSocketServer({ server: http });
wss.on('connection', (ws) => {
  let token = null;
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'hello') {
      token = String(m.token || '').slice(0, 64) || ('anon_' + nextId);
      const rec = saved[token] || { x: 480, y: 280, anim: 'idle', facing: 1, hp: 100, level: 1 };
      rec.id = rec.id || nextId++;
      rec.name = String(m.name || rec.name || ('Player' + rec.id)).slice(0, 24);
      rec.token = token; rec.last = Date.now();
      saved[token] = rec; online.set(token, { rec, ws });
      ws.send(JSON.stringify({ t: 'welcome', you: rec, tickHz: TICK_HZ }));
      scheduleSave();
    } else if (m.t === 'state' && token && online.has(token)) {
      const rec = online.get(token).rec;
      rec.x = clamp(+m.x || 0, -2000, 4000); rec.y = clamp(+m.y || 0, -2000, 4000);
      rec.anim = String(m.anim || 'idle').slice(0, 16);
      rec.facing = m.facing < 0 ? -1 : 1;
      if (Number.isFinite(+m.hp)) rec.hp = +m.hp;
      if (Number.isFinite(+m.level)) rec.level = +m.level;
      rec.last = Date.now();
    }
  });
  ws.on('close', () => {
    if (token && online.has(token)) { online.get(token).rec.last = Date.now(); online.delete(token); scheduleSave(); }
  });
});

// ---- authoritative broadcast tick --------------------------------------------
setInterval(() => {
  const now = Date.now();
  const players = [];
  for (const { rec } of online.values()) {
    if (now - rec.last > STALE_MS) continue;
    players.push({ id: rec.id, name: rec.name, x: Math.round(rec.x), y: Math.round(rec.y),
      anim: rec.anim, facing: rec.facing, hp: rec.hp, level: rec.level });
  }
  const snap = JSON.stringify({ t: 'snap', players, now });
  for (const { ws } of online.values()) { if (ws.readyState === 1) ws.send(snap); }
}, 1000 / TICK_HZ);

http.listen(PORT, () => console.log(`Mojiworld MMO-lite prototype on http://localhost:${PORT}/  (saves -> players.json)`));
