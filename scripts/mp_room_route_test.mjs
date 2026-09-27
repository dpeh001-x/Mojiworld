// MP room route: each party / lobby channel gets its own relay Durable Object (v0.30.x mp-room-route).
//   node scripts/mp_room_route_test.mjs            (MOJI_GAME_FILE=<build.html> PORT=<port> to test a private build)
// Relay harness as scripts/mp_relay_test.mjs: the REAL relay code in Miniflare (workerd). NEW = origin mp-cf +
// scripts/apply_mp_room_route_relay.mjs on PORT+1; OLD = the live relay's code (b42a9175, before mp-relay: no ?room=) on
// PORT+2; NEW with ROOM_DO="0" (the kill switch) on PORT+3. A test-only entry shows which rooms / players / saved positions
// each Durable Object holds (/__lx_do?name=global | room:<room id>). Game pages (the build under test) join with mpConnect.
// MRR_RELAY_BASELINE=1 runs NEW without the relay half (positions then stay in the room DO: the persistence checks fail).
// Deps: mp-cf's lockfile npm-ci'd once into LX_MP_DEPS (default <tmp>/lx_mp_relay_deps, shared with mp_relay_test).
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.env.PORT || 11470);
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms) => { const t0 = Date.now(); for (;;) { const v = await f(); if (v || Date.now() - t0 > ms) return v; await wait(250); } };
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { maxBuffer: 64 << 20, env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
const T = tmpdir().replace(/\\/g, '/') + '/lx_mrr_' + process.pid;
const cleanup = [], logs = [];
const finish = async () => {
  for (const f of cleanup.reverse()) { try { await f(); } catch (e) {} }
  try { rmSync(T, { recursive: true, force: true }); } catch (e) {}
  console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
  process.exit(bad ? 1 : 0);
};

// ---- the relays (real code, Miniflare) --------------------------------------------------------------------------------
const MPF = ['src/index.js', 'README.md', 'wrangler.toml', 'package.json', 'package-lock.json'];
for (const v of ['new', 'old']) {
  mkdirSync(T + '/' + v + '/mp-cf/src', { recursive: true }); mkdirSync(T + '/' + v + '/scripts', { recursive: true });
  for (const f of MPF) writeFileSync(T + '/' + v + '/mp-cf/' + f, git('show', 'origin/main:mp-cf/' + f));
  for (const f of ['mp_relay_test.mjs', 'mp_idle_traffic_test.mjs']) writeFileSync(T + '/' + v + '/scripts/' + f, git('show', 'origin/main:scripts/' + f));
}
writeFileSync(T + '/old/mp-cf/src/index.js', git('show', 'b42a9175:mp-cf/src/index.js'));
if (process.env.MRR_RELAY_BASELINE === '1') console.log('(relay baseline: origin mp-cf without the relay half)');   // then the position checks must fail
else { const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/apply_mp_room_route_relay.mjs')], { env: { ...process.env, LX_MP_ROOT: T + '/new' }, encoding: 'utf8' });
  if (r.status !== 0) { check(false, 'setup: the relay half applies', r.stderr || r.stdout); await finish(); } }
const lockHash = createHash('sha1').update(readFileSync(T + '/new/mp-cf/package-lock.json')).digest('hex').slice(0, 12);
const D = (process.env.LX_MP_DEPS || tmpdir().replace(/\\/g, '/') + '/lx_mp_relay_deps') + '/' + lockHash;
if (!existsSync(D + '/node_modules/miniflare/package.json')) {
  mkdirSync(D, { recursive: true });
  copyFileSync(T + '/new/mp-cf/package.json', D + '/package.json'); copyFileSync(T + '/new/mp-cf/package-lock.json', D + '/package-lock.json');
  const r = spawnSync('npm ci --no-audit --no-fund --prefer-offline', { cwd: D, shell: true, encoding: 'utf8' });
  if (r.status !== 0) { check(false, 'setup: npm ci of mp-cf deps', (r.stderr || '').slice(-400)); await finish(); }
}
const req = createRequire(D + '/package.json');
const mfMod = await import(pathToFileURL(req.resolve('miniflare')).href);
const Miniflare = mfMod.Miniflare || (mfMod.default && mfMod.default.Miniflare);
const NodeWS = req('ws');
const toml = readFileSync(T + '/new/mp-cf/wrangler.toml', 'utf8');
const CD = (/^compatibility_date\s*=\s*"([^"]+)"/m.exec(toml) || [])[1] || '2024-09-23';
const FLAGS = JSON.parse((/^compatibility_flags\s*=\s*(\[[^\]]*\])/m.exec(toml) || [])[1] || '[]');
const ENTRY = [   // the real worker + MojiRoom, plus a window into any DO: its rooms (who, where) and its save: keys
  "import W, { MojiRoom as Base } from './index.js';",
  "const J = (o) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json' } });",
  'export class MojiRoom extends Base {',
  '  async fetch(request) {',
  '    const u = new URL(request.url);',
  "    if (u.pathname === '/api/__rooms') {",
  '      const rooms = {}; for (const [rid, m] of (this.rooms || new Map())) rooms[rid] = [...m.values()].map((c) => ({ name: c.st && c.st.name, x: c.st && c.st.x }));',
  "      const keys = {}; for (const [k, v] of await this.storage.list({ prefix: 'save:' })) keys[k] = v;",
  '      return J({ rooms, keys });',
  '    }',
  "    if (u.pathname === '/api/__put') { await this.storage.put(await request.json()); return J({ ok: true }); }",
  '    return super.fetch(request);',
  '  }',
  '}',
  'export default { async fetch(request, env, ctx) {',
  '  const u = new URL(request.url);',
  "  if (u.pathname === '/__lx_do') return env.ROOMS.get(env.ROOMS.idFromName(u.searchParams.get('name'))).fetch(new Request('https://x/api/__rooms'));",
  '  return W.fetch(request, env, ctx);',
  '} };', ''].join('\n');
const relay = async (v, port, bindings) => {
  writeFileSync(T + '/' + v + '/mp-cf/src/_lx_test_entry.mjs', ENTRY);
  const mf = new Miniflare({ modules: true, scriptPath: T + '/' + v + '/mp-cf/src/_lx_test_entry.mjs', modulesRoot: T + '/' + v + '/mp-cf/src',
    modulesRules: [{ type: 'ESModule', include: ['**/*.js', '**/*.mjs'] }], compatibilityDate: CD, compatibilityFlags: FLAGS,
    durableObjects: { ROOMS: { className: 'MojiRoom', useSQLite: true } }, bindings: bindings || {}, host: '127.0.0.1', port,
    handleRuntimeStdio(out, err) { out.on('data', (d) => logs.push(String(d))); err.on('data', (d) => logs.push(String(d))); } });
  cleanup.push(() => mf.dispose()); await mf.ready;
  return 'http://127.0.0.1:' + port;
};
const NEW = await relay('new', PORT + 1), OLD = await relay('old', PORT + 2), KILL = await relay('new', PORT + 3, { ROOM_DO: '0' });
const ws = (b) => b.replace(/^http/, 'ws');
const where = async (base, name) => { try { return await (await fetch(base + '/__lx_do?name=' + encodeURIComponent(name))).json(); } catch (e) { return { rooms: {}, keys: {}, err: String(e) }; } };
const names = (d, rid) => ((d.rooms || {})[rid] || []).map((p) => p.name).sort();
function sock(url) {
  const w = new NodeWS(url), msgs = [];
  w.on('message', (d) => { try { msgs.push(JSON.parse(String(d))); } catch (e) {} }); w.on('error', () => {});
  const ready = new Promise((res) => { w.on('open', res); w.on('error', res); });
  const c = { w, msgs, ready, send: (o) => { try { w.send(typeof o === 'string' ? o : JSON.stringify(o)); } catch (e) {} }, last: (t) => [...msgs].reverse().find((m) => m.t === t), close: () => { try { w.close(); } catch (e) {} } };
  cleanup.push(() => c.close()); return c;
}

// ---- the game ------------------------------------------------------------------------------------------------------------
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
cleanup.push(() => srv.kill());
await wait(1500);
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
cleanup.push(() => browser.close());
const errs = [];
const page = async (ctx) => {
  ctx = ctx || await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => {
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {}
    const W0 = window.WebSocket; window.__dials = [];   // every URL the game dials
    window.WebSocket = function (u, ...a) { window.__dials.push(String(u)); return new W0(u, ...a); };
    window.WebSocket.prototype = W0.prototype; Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof mpConnect === 'function' && typeof net === 'object', null, { timeout: 180000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; window._prologuePending = false; window._lxAwaitingCreation = false;
    player.cls = 'rogue'; player.level = 30;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('town'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999; player.channel = 1;
  });
  return { ctx, p };
};
const join = async (p, url, nm, room) => {
  await p.evaluate(([u, n, r]) => { try { mpDisconnect(); } catch (e) {} net.myId = null; player.channel = 1; mpConnect(u, n, r); }, [url, nm, room]);
  return until(() => p.evaluate(() => net.myId != null && !!net.connected), 20000);
};
const peers = (p) => p.evaluate(() => Object.values(net.peers || {}).map((x) => x.name).sort());

try {
  const RUN = Date.now().toString(36), P = 'rr' + RUN, rid = P + '__ch1';
  const [A, B, C] = await Promise.all([page(), page(), page()]);
  // 1) two players of one party: the party's own DO, and they meet
  await join(A.p, ws(NEW), 'Ann', P); await join(B.p, ws(NEW), 'Bob', P);
  const met = await until(async () => (await peers(A.p)).includes('Bob') && (await peers(B.p)).includes('Ann'), 15000);
  const dRoom = await where(NEW, 'room:' + rid), dGlob = await where(NEW, 'global');
  const dial = await A.p.evaluate(() => window.__dials.slice(-1)[0]);
  check(met && names(dRoom, rid).join() === 'Ann,Bob' && !names(dGlob, rid).length,
    'two players of a party land on that party\'s own relay DO (?room=), not the global one, and see each other', { met, room: dRoom.rooms, global: dGlob.rooms, dial });
  // 2) a lobby player sits on the lobby channel's DO and never meets the party
  await join(C.p, ws(NEW), 'Cid', 'lobby');
  await wait(2500);
  const dLob = await where(NEW, 'room:lobby__ch1'), pa = await peers(A.p), pc = await peers(C.p);
  check(names(dLob, 'lobby__ch1').join() === 'Cid' && !pa.includes('Cid') && !pc.includes('Ann') && !pc.includes('Bob'),
    'a lobby player and a party player are isolated (the lobby channel has its own DO; neither sees the other)', { lobby: dLob.rooms, pa, pc });
  // 3) a channel switch re-dials into that channel's DO; a reconnect never doubles the query
  await A.p.evaluate(() => { player.channel = 2; net.myId = null; mpConnect(net._lastUrl, net._lastName, net._lastRoom); });
  await until(() => A.p.evaluate(() => net.myId != null && net.connected && net.roomId === net.baseRoom + '__ch2'), 15000);
  const dCh2 = (await until(async () => { const d = await where(NEW, 'room:' + P + '__ch2'); return names(d, P + '__ch2').length ? d : null; }, 10000)) || {}, dials = await A.p.evaluate(() => window.__dials.slice(-2));
  const bLost = await until(async () => !(await peers(B.p)).includes('Ann'), 8000);
  check(names(dCh2, P + '__ch2').join() === 'Ann' && bLost && dials.every((u) => (u.match(/room=/g) || []).length === 1) && /room=rr[0-9a-z]+__ch2$/.test(dials[1] || ''),
    'switching channel re-dials into that channel\'s own DO (one ?room= per dial)', { ch2: dCh2.rooms, bLost, dials });
  // 4) respawn where you logged off, across a reconnect: the record lives on 'global', the room DO reads it back
  await B.p.evaluate(() => { player.x = 900; player.vx = 0; });
  await until(async () => ((await where(NEW, 'room:' + rid)).rooms[rid] || []).some((x) => x.name === 'Bob' && Math.round(x.x) === 900), 10000);
  const tokB = await B.p.evaluate(() => localStorage.getItem('levelx_mp_token'));
  await B.p.evaluate(() => mpDisconnect());
  const key = 'save:' + tokB + ':' + rid;
  const onGlob = await until(async () => { const g = await where(NEW, 'global'); return g.keys[key] && Math.round(g.keys[key].x) === 900 ? g : null; }, 10000);
  const roomKeys = Object.keys((await where(NEW, 'room:' + rid)).keys || {});
  await B.p.close();
  const B2 = await page(B.ctx);
  await join(B2.p, ws(NEW), 'Bob', P);
  const back = await until(() => B2.p.evaluate(() => (net._restoredSave ? Math.round(player.x) : null)), 8000);
  check(!!onGlob && !roomKeys.length && back === 900, 'position persistence survives a reconnect: saved on the global DO (not the room\'s), restored on rejoining the party', { onGlob: !!onGlob, roomKeys, back });
  // 5) no loss, no split: a record written through 'global' (an older build, bare URL) is read through the room DO, and back
  const rid5 = 'mig' + RUN + '__ch1', tok5 = 'mig' + RUN;
  await fetch(NEW + '/api/__put', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ['save:' + tok5 + ':' + rid5]: { x: 321, y: 40, map: 'town', level: 5 } }) });
  const s1 = sock(ws(NEW) + '/?room=' + encodeURIComponent(rid5)); await s1.ready;
  s1.send({ t: 'hello', token: tok5, name: 'Mig', room: rid5, map: 'town', x: 0, y: 0, hp: 10, maxHp: 10 });
  await until(() => s1.last('welcome'), 8000);
  const y1 = (s1.last('welcome') || {}).you;
  s1.send({ t: 'state', x: 654, y: 40, map: 'town', hp: 10, maxHp: 10 }); await wait(400); s1.close();
  await until(async () => { const g = await where(NEW, 'global'); const r = g.keys['save:' + tok5 + ':' + rid5]; return r && r.x === 654; }, 8000);
  const s2 = sock(ws(NEW)); await s2.ready;
  s2.send({ t: 'hello', token: tok5, name: 'Mig', room: rid5, map: 'town', x: 0, y: 0, hp: 10, maxHp: 10 });
  await until(() => s2.last('welcome'), 8000);
  const y2 = (s2.last('welcome') || {}).you; s2.close();
  check(y1 && y1.x === 321 && y2 && y2.x === 654, 'no loss, no split: a position saved via the global DO is restored via the room DO, and the other way round', { y1, y2 });
  // 6) the OLD relay (live until the redeploy) ignores ?room=: the party still meets, on 'global', and positions still restore
  const P2 = 'ro' + RUN, rid2 = P2 + '__ch1';
  await join(A.p, ws(OLD), 'Ann', P2); await join(B2.p, ws(OLD), 'Bob', P2);
  const metOld = await until(async () => (await peers(A.p)).includes('Bob') && (await peers(B2.p)).includes('Ann'), 15000);
  const oGlob = await where(OLD, 'global'), oDial = await B2.p.evaluate(() => window.__dials.slice(-1)[0]);
  await B2.p.evaluate(() => { player.x = 700; player.vx = 0; });
  await until(async () => ((await where(OLD, 'global')).rooms[rid2] || []).some((x) => x.name === 'Bob' && Math.round(x.x) === 700), 10000);
  await B2.p.evaluate(() => mpDisconnect()); await wait(800);
  const s3 = sock(ws(OLD) + '/?room=' + encodeURIComponent(rid2)); await s3.ready;
  s3.send({ t: 'hello', token: tokB, name: 'Bob', room: rid2 }); await until(() => s3.last('welcome'), 8000);
  const y3 = (s3.last('welcome') || {}).you; s3.close();
  check(metOld && names(oGlob, rid2).join() === 'Ann,Bob' && /[?&]room=/.test(oDial) && y3 && Math.round(y3.x) === 700,
    'old relay: it ignores ?room= - the party meets on its one DO and the saved position still comes back', { metOld, glob: oGlob.rooms, oDial, y3 });
  // 7) the kill switch, and /__pos is not reachable from outside
  const k1 = sock(ws(KILL) + '/?room=' + encodeURIComponent('kill' + RUN + '__ch1')); await k1.ready;
  k1.send({ t: 'hello', name: 'Kay', room: 'kill' + RUN + '__ch1' }); await until(() => k1.last('welcome'), 8000);
  const kGlob = await where(KILL, 'global'); k1.close();
  const ext = await fetch(NEW + '/__pos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ k: 'save:evil:x', rec: { x: 1 }, put: 1 }) });
  const extTxt = await ext.text(), evil = (await where(NEW, 'global')).keys['save:evil:x'];
  check(names(kGlob, 'kill' + RUN + '__ch1').join() === 'Kay' && !evil && !/"ok"/.test(extTxt),
    'ROOM_DO="0" routes a ?room= socket to the global DO again; POST /__pos from outside stores nothing', { kGlob: kGlob.rooms, evil, extTxt: extTxt.slice(0, 80) });
  const werr = logs.join('').split(/\r?\n/).filter((l) => /TypeError|ReferenceError|RangeError|SyntaxError|Uncaught (?!exception: kj)/.test(l));
  check(!werr.length, 'no relay (worker) errors', werr.slice(0, 4));
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} catch (e) { check(false, 'ran to completion', String(e && e.stack || e).slice(0, 600)); }
await finish();
