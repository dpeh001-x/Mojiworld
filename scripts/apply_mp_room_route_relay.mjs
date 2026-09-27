// MP room route, relay half (2026-09-27) - mp-cf/ (the Cloudflare Worker + Durable Object co-op relay) plus the two relay
// tests whose bare sockets share a room with the game. Run as LX_APPLY2 next to scripts/apply_mp_room_route.mjs (game half).
// ============================================================================
// The game now dials its co-op socket as wss://<relay>/?room=<room id>, so the relay (since mp-relay) gives every party code
// and lobby channel its own Durable Object instead of queueing every room - and every PBKDF2 login - on one 'global'.
// What that would have broken, and what this does about it:
//   1) "respawn where you logged off": the relay keeps save:<token>:<room id> (position, map, level...) in the storage of the
//      DO that served the socket. On a per-room DO those records would start empty (every record 'global' holds for a party
//      or lobby channel lost once), and a player on an older build (bare URL -> 'global') and a newer one would each keep
//      their own copy (split). Now a per-room DO reads and writes them on 'global' (DO-to-DO POST /__pos, which the Worker
//      never forwards from outside: it hands a DO only WebSocket upgrades and /api/*). Same key, same record, whichever DO
//      serves the socket. The hello's read waits at most 3 s (then no restore, as for a new player).
//   2) a kill switch: wrangler var ROOM_DO = "0" routes every socket to 'global' again (?room= ignored), e.g. while an older
//      client build (bare URL) is still in use: two builds of one party only meet when they are on the same DO.
//   3) scripts/mp_relay_test.mjs (game part) and scripts/mp_idle_traffic_test.mjs park bare test sockets in the game's room;
//      they now dial ?room= like the game, or they would sit in another DO and never meet it.
// NEEDS A DEPLOY (cd mp-cf && npx wrangler deploy). Until then the live relay ignores ?room= and nothing changes.
// Only touches files under ${ROOT}/mp-cf and those two tests - never mojiworld_game.html. Guarded + atomic + idempotent.
// EOL-aware. Markers are version-free: "mp-room-route (2026-09-27)".
import { readFileSync, writeFileSync, renameSync, statSync, existsSync } from 'node:fs';
const ROOT = (process.env.LX_MP_ROOT || 'C:/Users/dpeh0/Mojiworld').replace(/[\\/]+$/, '');
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const files = [];   // { path, rel, before, after, grew }
function edit(rel, marker, lo, hi, fn) {
  const path = ROOT + '/' + rel;
  if (/mojiworld_game\.html$/i.test(path)) die('refusing to touch the game file');
  if (!existsSync(path)) die(rel + ' missing under ' + ROOT);
  const before = readFileSync(path, 'utf8');
  if (before.includes(marker)) { console.log('  ' + rel + ': already applied'); return; }
  const crlf = (before.match(/\r\n/g) || []).length, lf = (before.match(/\n/g) || []).length;
  const EOL = crlf > lf / 2 ? '\r\n' : '\n';
  let s = before;
  const J = (...L) => L.join(EOL);
  const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(rel + ': ' + what + ' matched ' + n); s = s.replace(a, () => b); };
  fn({ J, once });
  const grew = s.length - before.length;
  if (grew < lo || grew > hi) die(rel + ': size moved ' + grew);
  if (!s.includes(marker)) die(rel + ': marker missing after edit');
  files.push({ path, rel, before, after: s, grew });
}
const M = 'mp-room-route (2026-09-27)';

// ---------------------------------------------------------------- mp-cf/src/index.js
edit('mp-cf/src/index.js', 'async _posGet(conn)', 2200, 4500, ({ J, once }) => {
  once("      const room = url.pathname.startsWith('/api/') ? null : roomParam(url);", J(
    "      // " + M + " - ROOM_DO = \"0\" (a wrangler var): every socket to 'global' again, ?room= or not",
    "      const room = (url.pathname.startsWith('/api/') || /^(0|false|off)$/i.test(String((env && env.ROOM_DO) || ''))) ? null : roomParam(url);"),
    'the Worker routing');
  once('    const e = env || {};', J(
    '    const e = env || {};',
    "    // " + M + " - who this DO is: the saved positions live on 'global' (see _posGet)",
    '    this.env = e;',
    "    try { this._isGlobal = !(e.ROOMS && state.id && state.id.equals) || state.id.equals(e.ROOMS.idFromName('global')); } catch (_) { this._isGlobal = true; }"),
    'the constructor');
  once("    if (request.headers.get('Upgrade') !== 'websocket') return this.handleApi(request);", J(
    "    // " + M + " - the saved-position store, DO to DO only: the Worker never forwards /__pos (only upgrades and /api/*)",
    "    if (request.headers.get('Upgrade') !== 'websocket' && new URL(request.url).pathname === '/__pos') return this._posApi(request);",
    "    if (request.headers.get('Upgrade') !== 'websocket') return this.handleApi(request);"),
    'the DO fetch');
  once('        const you = conn.token ? (await this.storage.get(saveKey(conn))) || null : null;',
    '        const you = conn.token ? await this._posGet(conn) : null;   // ' + M + " - from 'global', whichever DO this is",
    "the hello's saved record");
  once('{ try { await this.storage.put(saveKey(conn), rec); } catch (_) {} }',
    '{ try { await this._posPut(conn, rec); } catch (_) {} }   // ' + M,
    'the save on leave');
  once('        if (h !== conn.svh) { conn.svh = h; this.storage.put(saveKey(conn), rec).catch(() => {}); }',
    '        if (h !== conn.svh) { conn.svh = h; gone.push(this._posPut(conn, rec).catch(() => {})); }   // ' + M + ' - awaited below',
    "the reaper's periodic save");
  once("  // mp-relay (2026-09-27) - rebuild one socket's player from its attachment (a DO woken from hibernation)", J(
    '  // ' + M + " - \"respawn where you logged off\" records (save:<token>:<room id>) live on 'global' for every DO. A per-room",
    "  // DO (?room=) used to keep them in its own storage: moving a room off 'global' lost every record it held there once, and",
    '  // a party on older (bare URL) and newer builds kept two diverging copies. Now a per-room DO reads / writes them on',
    "  // 'global' (DO to DO); 'global' itself uses its storage as before.",
    '  async _posGet(conn) {',
    '    const k = saveKey(conn);',
    '    if (this._isGlobal) return (await this.storage.get(k)) || null;',
    '    try {',
    '      const j = await Promise.race([this._posCall({ k }), new Promise((res) => setTimeout(() => res(null), 3000))]);',
    '      return (j && j.rec) || null;   // no answer in 3 s: no restore this time (as for a new player)',
    '    } catch (_) { return null; }',
    '  }',
    '  async _posPut(conn, rec) {',
    '    const k = saveKey(conn);',
    '    if (this._isGlobal) return this.storage.put(k, rec);',
    '    const j = await this._posCall({ k, rec, put: 1 });',
    "    if (!j || !j.ok) throw new Error('position not saved');",
    '  }',
    '  async _posCall(body) {',
    "    const g = this.env.ROOMS.get(this.env.ROOMS.idFromName('global'));",
    "    const r = await g.fetch('https://global.do/__pos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });",
    '    return r.json();',
    '  }',
    '  async _posApi(request) {   // ' + M + " - on 'global': { k } -> { rec }, { k, rec, put } -> stored",
    "    if (!this._isGlobal) return jsonResp({ ok: false, error: 'not global' }, 404);",
    '    let b; try { b = await request.json(); } catch (_) { b = null; }',
    "    const k = String((b && b.k) || '');",
    "    if (!/^save:/.test(k) || k.length > 200) return jsonResp({ ok: false, error: 'bad key' }, 400);",
    '    if (b.put) { await this.storage.put(k, b.rec); return jsonResp({ ok: true }); }',
    '    return jsonResp({ ok: true, rec: (await this.storage.get(k)) || null });',
    '  }',
    '',
    "  // mp-relay (2026-09-27) - rebuild one socket's player from its attachment (a DO woken from hibernation)"),
    'the attachment rebuild comment');
});

// ---------------------------------------------------------------- mp-cf/README.md
edit('mp-cf/README.md', 'mp-room-route, 2026-09-27', 400, 1400, ({ J, once }) => {
  once(J('', '## Files'), J(
    '',
    '## The game dials `?room=` (mp-room-route, 2026-09-27)',
    '',
    '- The game now dials `wss://<host>/?room=<room id>` (the exact room it names in `hello`), so each party code and lobby',
    '  channel gets its own Durable Object; every room / channel switch is a fresh connect. `/api` stays on `global`.',
    '- "Respawn where you logged off" records (`save:<token>:<room id>`) stay on `global`: a per-room DO reads and writes them',
    '  there (DO-to-DO `POST /__pos`, never forwarded from outside), so no record is lost or split when a room moves DOs.',
    '- `ROOM_DO = "0"` (wrangler var) routes every socket to `global` again. Two builds of one party only meet on the same DO:',
    '  an older client (bare URL) lands on `global`, a newer one on the room\'s DO. **Needs a `wrangler deploy`.**',
    '',
    '## Files'), 'the Files heading');
});

// ---------------------------------------------------------------- the two tests that park bare sockets in the game's room
edit('scripts/mp_relay_test.mjs', M, 150, 700, ({ J, once }) => {
  once("  for (let i = 0; i < 5; i++) { const c = sock(relayBase.replace(/^http/, 'ws')); await c.ready;", J(
    '  // ' + M + ' - the game dials ?room=<room id> (its own DO on the new relay): the test sockets that share its room do too',
    "  const inRoom = (r) => relayBase.replace(/^http/, 'ws') + '/?room=' + encodeURIComponent(r);",
    '  for (let i = 0; i < 5; i++) { const c = sock(inRoom(rid)); await c.ready;'), 'the party sockets');
  once("  const fill = async (rid2, n, tag) => { for (let i = 0; i < n; i++) { const c = sock(relayBase.replace(/^http/, 'ws')); await c.ready;",
    '  const fill = async (rid2, n, tag) => { for (let i = 0; i < n; i++) { const c = sock(inRoom(rid2)); await c.ready;   // ' + M,
    'the lobby fillers');
});
edit('scripts/mp_idle_traffic_test.mjs', M, 100, 500, ({ once }) => {
  once('  const W = sock(NEW); await W.ready;',
    "  const W = sock(NEW + '/?room=' + encodeURIComponent(room + '__ch1')); await W.ready;   // " + M + ' - in the game\'s room DO',
    'the counter socket');
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
  console.log('applied: mp-room-route ' + f.rel + ' (+' + f.grew + ' chars)');
}
