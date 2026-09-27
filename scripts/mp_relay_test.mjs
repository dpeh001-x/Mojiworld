// mp_relay_test.mjs - confirming test for the mp-relay package (mp-cf/: the co-op relay + account API).
// Runs the relay in Miniflare (workerd, the Workers runtime `wrangler dev` uses) from a PATCHED copy of mp-cf, then:
//   * the extended wrangler-dev tests (mp-cf/_cf_test.mjs + _api_test.mjs), lines re-printed as cf: / api:
//   * the checks that need storage access or short timers (a test-only entry exposes the DO's storage):
//     PBKDF2 on register, legacy SHA-256 login + re-hash, legacy token migration, a hibernation rebuild,
//     sliding token expiry, the idle reaper, the throttled save, the rl:/fail:/tok: sweep, the lockout.
// Source: LX_MP_ROOT/mp-cf if set, else origin/main + scripts/apply_mp_relay.mjs. MP_TEST_BASELINE=1 swaps in the
// pre-fix src/index.js (the bug checks must FAIL there). Deps: npm ci of mp-cf's lockfile, cached in LX_MP_DEPS
// (default <tmp>/lx_mp_relay_deps). PORT (default 11410) and PORT+1 are used. Ends with `all N passed` / `K of N FAILED`.
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const fwd = (p) => p.replace(/\\/g, '/').replace(/\/+$/, '');
const HERE = fwd(fileURLToPath(new URL('.', import.meta.url)));
const REPO = fwd(process.env.LX_REPO || HERE.replace(/\/scripts$/, ''));
const ROOT = process.env.LX_MP_ROOT ? fwd(process.env.LX_MP_ROOT) : null;
const BASELINE = process.env.MP_TEST_BASELINE === '1';
const PRE_FIX_REV = 'b42a9175';   // the last origin commit of mp-cf before this package
const PORT = +(process.env.PORT || 11410);
const FILES = ['src/index.js', '_cf_test.mjs', '_api_test.mjs', 'README.md', 'wrangler.toml', 'package.json', 'package-lock.json'];
const T = fwd(tmpdir()) + '/lx_mp_relay_' + process.pid;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms) => { const t0 = Date.now(); for (;;) { const v = await f(); if (v || Date.now() - t0 > ms) return v; await wait(200); } };
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { maxBuffer: 64 << 20, env: { ...process.env, MSYS_NO_PATHCONV: '1' } });

let pass = 0, fail = 0;
const ok = (c, what, info) => {
  if (c) { pass++; console.log('PASS  ' + what); }
  else { fail++; console.log('FAIL  ' + what + '   ' + JSON.stringify(info === undefined ? null : info)); }
};
const cleanup = [];
async function finish(code) {
  for (const f of cleanup.reverse()) { try { await f(); } catch (_) {} }
  try { rmSync(T, { recursive: true, force: true }); } catch (_) {}
  const n = pass + fail;
  console.log(fail ? fail + ' of ' + n + ' FAILED' : 'all ' + n + ' passed');
  process.exit(code != null ? code : (fail ? 1 : 0));
}
const die = async (m) => { console.log('FAIL  setup: ' + m); fail++; await finish(1); };

// ---- 1. a patched copy of mp-cf --------------------------------------------------------------------------
mkdirSync(T + '/mp-cf/src', { recursive: true });
for (const f of FILES) {
  if (ROOT) copyFileSync(ROOT + '/mp-cf/' + f, T + '/mp-cf/' + f);
  else writeFileSync(T + '/mp-cf/' + f, git('show', 'origin/main:mp-cf/' + f));
}
if (!ROOT) {
  const r = spawnSync(process.execPath, [HERE + '/apply_mp_relay.mjs'], { env: { ...process.env, LX_MP_ROOT: T }, encoding: 'utf8' });
  if (r.status !== 0) await die('apply_mp_relay.mjs failed: ' + (r.stderr || r.stdout));
}
if (!readFileSync(T + '/mp-cf/src/index.js', 'utf8').includes('const FRAME_CAP = 64 * 1024;')) await die('the relay copy is not patched');
if (BASELINE) { writeFileSync(T + '/mp-cf/src/index.js', git('show', PRE_FIX_REV + ':mp-cf/src/index.js')); console.log('(baseline: pre-fix src/index.js from ' + PRE_FIX_REV + ')'); }
const toml = readFileSync(T + '/mp-cf/wrangler.toml', 'utf8');
const CD = (/^compatibility_date\s*=\s*"([^"]+)"/m.exec(toml) || [])[1] || '2024-09-23';
const FLAGS = JSON.parse((/^compatibility_flags\s*=\s*(\[[^\]]*\])/m.exec(toml) || [])[1] || '[]');

// ---- 2. deps (the lockfile's own wrangler / miniflare / workerd / ws), cached per lockfile -----------------
const lockHash = createHash('sha1').update(readFileSync(T + '/mp-cf/package-lock.json')).digest('hex').slice(0, 12);
const D = fwd(process.env.LX_MP_DEPS || fwd(tmpdir()) + '/lx_mp_relay_deps') + '/' + lockHash;
if (!existsSync(D + '/node_modules/miniflare/package.json')) {
  mkdirSync(D, { recursive: true });
  copyFileSync(T + '/mp-cf/package.json', D + '/package.json');
  copyFileSync(T + '/mp-cf/package-lock.json', D + '/package-lock.json');
  const r = spawnSync('npm ci --no-audit --no-fund --prefer-offline', { cwd: D, shell: true, encoding: 'utf8' });
  if (r.status !== 0) await die('npm ci failed: ' + (r.stderr || '').slice(-400));
}
const mfMod = await import(pathToFileURL(createRequire(D + '/package.json').resolve('miniflare')).href);
const Miniflare = mfMod.Miniflare || (mfMod.default && mfMod.default.Miniflare);
const NodeWS = createRequire(D + '/package.json')('ws');

// ---- 3. a test-only entry: the real worker + MojiRoom, plus a window into the DO's storage -------------------
writeFileSync(T + '/mp-cf/src/_lx_test_entry.mjs', [
  "import W, { MojiRoom as Base } from './index.js';",
  "const J = (o) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json' } });",
  'export class MojiRoom extends Base {',
  '  async fetch(request) {',
  '    const u = new URL(request.url);',
  "    if (u.pathname === '/api/__peek') { const out = {}; for (const [k, v] of await this.storage.list({ prefix: u.searchParams.get('p') || '' })) out[k] = v; return J({ keys: out, alarm: await this.storage.getAlarm() }); }",
  "    if (u.pathname === '/api/__put') { await this.storage.put(await request.json()); return J({ ok: true }); }",
  "    if (u.pathname === '/api/__hibernate') {   // what a wake-up does: fresh memory, rooms rebuilt from the attachments",
  '      this.rooms = new Map(); this.conns = new Map(); this.nextId = 1;',
  '      for (const ws of this.state.getWebSockets()) this._connFromAtt(ws);',
  '      return J({ ok: true, sockets: this.state.getWebSockets().length });',
  '    }',
  '    return super.fetch(request);',
  '  }',
  '}',
  'export default W;', ''].join('\n'));

const logs = [];
async function relay(port, vars) {
  const mf = new Miniflare({
    modules: true, scriptPath: T + '/mp-cf/src/_lx_test_entry.mjs', modulesRoot: T + '/mp-cf/src',
    modulesRules: [{ type: 'ESModule', include: ['**/*.js', '**/*.mjs'] }],
    compatibilityDate: CD, compatibilityFlags: FLAGS,
    durableObjects: { ROOMS: { className: 'MojiRoom', useSQLite: true } },
    bindings: vars || {}, host: '127.0.0.1', port,
    handleRuntimeStdio(out, err) { out.on('data', (d) => logs.push(String(d))); err.on('data', (d) => logs.push(String(d))); },
  });
  cleanup.push(() => mf.dispose());
  await mf.ready;
  return 'http://127.0.0.1:' + port;
}

// ---- helpers -------------------------------------------------------------------------------------------------
const api = async (base, path, body, token, method) => {
  const r = await fetch(base + path, {
    method: method || (body !== undefined ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let j = null; try { j = await r.json(); } catch (_) {}
  return { status: r.status, ...(j || {}) };
};
const peek = async (base, prefix) => { try { return await api(base, '/api/__peek?p=' + encodeURIComponent(prefix || '')); } catch (e) { return { keys: {}, err: String(e) }; } };
function sock(url) {
  const ws = new NodeWS(url); const msgs = [];
  ws.on('message', (d) => { try { msgs.push(JSON.parse(String(d))); } catch (_) {} });
  ws.on('error', () => {});
  const ready = new Promise((res) => { ws.on('open', res); ws.on('error', res); });
  const c = { ws, msgs, ready, send: (o) => { try { ws.send(typeof o === 'string' ? o : JSON.stringify(o)); } catch (_) {} },
    last: (t) => [...msgs].reverse().find((m) => m.t === t), all: (t) => msgs.filter((m) => m.t === t), close: () => { try { ws.close(); } catch (_) {} } };
  cleanup.push(() => c.close());
  return c;
}
const sha256hex = (s) => createHash('sha256').update(s).digest('hex');
function child(file, env, tag) {   // run one of mp-cf's own tests (from the deps dir, so `ws` resolves) and fold its lines in
  const cp = D + '/_lx_' + process.pid + '_' + file;
  copyFileSync(T + '/mp-cf/' + file, cp);
  const r = spawnSync(process.execPath, [cp], { cwd: D, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 180000 });
  try { rmSync(cp); } catch (_) {}
  let n = 0;
  for (const line of String(r.stdout || '').split(/\r?\n/)) {
    const m = /^\s+(PASS|FAIL) (.*)$/.exec(line);
    if (m) { n++; ok(m[1] === 'PASS', tag + ': ' + m[2]); }
  }
  if (r.status !== 0 && !/FAIL/.test(r.stdout || '')) ok(false, tag + ': ran to completion', { status: r.status, signal: r.signal, err: String(r.stderr || r.error || '').slice(-300) });
  if (!n) ok(false, tag + ': printed no checks', String(r.stderr || '').slice(-300));
}

async function main() {
// ---- 4. phase A: default tunables ------------------------------------------------------------------------------
const A = await relay(PORT);
const WSA = A.replace(/^http/, 'ws');
child('_cf_test.mjs', { CF_URL: WSA }, 'cf');
child('_api_test.mjs', { API_BASE: A }, 'api');

const RUN = Date.now().toString(36), PW = 'hunter2secret';
{ // a new account is stored as PBKDF2, and its session carries a 365-day expiry
  const u = 'reg_' + RUN, r = await api(A, '/api/register', { username: u, password: PW });
  const acct = (await peek(A, 'acct:' + u)).keys['acct:' + u] || {};
  const tok = (await peek(A, 'tok:' + r.token)).keys['tok:' + r.token];
  ok(r.status === 200 && acct.kdf === 'pbkdf2-sha256' && acct.it === 100000 && /^[0-9a-f]{64}$/.test(acct.hash || ''), 'register stores PBKDF2-SHA256 x100k', { status: r.status, acct });
  const d = tok && typeof tok === 'object' ? (tok.exp - Date.now()) / 86400000 : null;
  ok(d != null && d > 364.9 && d <= 365.01 && tok.u === u, 'a new session expires in 365 days', tok);
}
{ // a legacy salted-SHA-256 account (the exact record the old build wrote) logs in, is re-hashed, keeps its save
  const u = 'leg_' + RUN, key = u.toLowerCase(), salt = 'ab'.repeat(16), legTok = 'legacy-' + RUN;
  const legacy = { name: u, salt, hash: sha256hex(salt + ':' + PW), created: 1700000000000 };
  await api(A, '/api/__put', { ['acct:' + key]: legacy, ['csave:' + key]: { v: 1, level: 7, marker: RUN }, ['tok:' + legTok]: key });
  const bad = await api(A, '/api/login', { username: u, password: 'wrongwrong' });
  const still = (await peek(A, 'acct:' + key)).keys['acct:' + key] || {};
  ok(bad.status === 401 && bad.error === 'Invalid username or password.' && still.hash === legacy.hash && !still.kdf, 'legacy account + wrong password: 401, record untouched', { bad, still });
  const good = await api(A, '/api/login', { username: u, password: PW });
  ok(good.status === 200 && good.ok && !!good.token && good.name === u, 'legacy account + right password: logs in', good);
  const now = (await peek(A, 'acct:' + key)).keys['acct:' + key] || {};
  ok(now.kdf === 'pbkdf2-sha256' && now.it === 100000 && now.hash !== legacy.hash && now.salt !== legacy.salt && now.name === u && now.created === legacy.created,
    'legacy account is re-hashed to PBKDF2 on that login (name + created kept)', now);
  const again = await api(A, '/api/login', { username: u, password: PW });
  ok(again.status === 200 && again.ok, 'the re-hashed account logs in again', again);
  const sv = await api(A, '/api/save', undefined, good.token);
  ok(sv.status === 200 && sv.save && sv.save.marker === RUN, 'the account keeps its cloud save', sv);
  const lt = await api(A, '/api/save', undefined, legTok);
  const rec = (await peek(A, 'tok:' + legTok)).keys['tok:' + legTok];
  const d = rec && typeof rec === 'object' ? (rec.exp - Date.now()) / 86400000 : null;
  ok(lt.status === 200 && lt.save && lt.save.marker === RUN && d != null && d > 364.9 && rec.u === key, 'a pre-expiry token still works and starts a 365-day clock', { status: lt.status, rec });
}
{ // hibernation: the DO forgets everything in memory, rebuilds its rooms from the socket attachments, and carries on
  const room = 'hib' + RUN + '__ch1';
  const H1 = sock(WSA), H2 = sock(WSA); await H1.ready; await H2.ready;
  H1.send({ t: 'hello', token: 'hibtok1' + RUN, name: 'Hana', room, map: 'town', x: 10, y: 20, level: 9, hp: 50, maxHp: 50 });
  await until(() => H1.last('welcome'), 5000);
  H2.send({ t: 'hello', name: 'Hugo', room, map: 'town', x: 30, y: 40, hp: 5, maxHp: 5 });
  await until(() => H2.last('welcome'), 5000);
  H1.send({ t: 'state', x: 321, y: 20, map: 'cave', hp: 50, maxHp: 50, level: 9 });
  await until(() => H2.all('state').some((m) => m.x === 321), 5000);
  const hb = await api(A, '/api/__hibernate');
  const H3 = sock(WSA); await H3.ready;
  H3.send({ t: 'hello', name: 'Hiro', room, map: 'cave', x: 0, y: 0, hp: 1, maxHp: 1 });
  await until(() => H3.last('welcome'), 5000);
  const w = H3.last('welcome') || { players: [] }, id1 = (H1.last('welcome') || {}).id, id2 = (H2.last('welcome') || {}).id;
  const p1 = w.players.find((p) => p.id === id1) || {};
  ok(hb.status === 200 && p1.name === 'Hana' && p1.x === 321 && p1.map === 'cave' && w.players.some((p) => p.id === id2) && w.id > Math.max(id1, id2),
    'after a hibernation wake-up the room is rebuilt: a new joiner sees both players (last position kept) and gets a fresh id', { hb, w });
  H1.send({ t: 'state', x: 555, y: 20, map: 'cave' });
  await until(() => H3.all('state').some((m) => m.x === 555) && H2.all('state').some((m) => m.x === 555), 5000);
  ok(H3.all('state').some((m) => m.x === 555 && m.id === id1) && H2.all('state').some((m) => m.x === 555), '... and relays between the old and new sockets', H3.all('state').slice(-2));
  H1.close();
  await until(() => H2.last('left') && H3.last('left'), 5000);
  ok((H2.last('left') || {}).id === id1 && (H3.last('left') || {}).id === id1, '... and a woken socket that closes is announced as left', [H2.last('left'), H3.last('left')]);
  H2.close(); H3.close();
}

// ---- 5. phase B: short timers (tokens 5 s, idle 6 s, saves 1.5 s, GC 1.5 s, login-failure memory 5 s), lobby cap 3 --------------------------------------
const B = await relay(PORT + 1, { TOKEN_TTL_MS: '5000', IDLE_KILL_MS: '6000', SAVE_MS: '1500', GC_MS: '1500', THROTTLE_MS: '1500', FAIL_TTL_MS: '5000', LOBBY_CAP: '3' });
const WSB = B.replace(/^http/, 'ws');
const tokenExpiry = (async () => {   // sliding: each use pushes the expiry out; an unused token dies after the TTL
  const TTL = 5000, u = 'ttl_' + RUN;
  const r = await api(B, '/api/register', { username: u, password: PW });
  const t0r = Date.now();
  await wait(2500);
  const s1 = (await api(B, '/api/save', undefined, r.token)).status;
  await wait(Math.max(0, t0r + TTL + 600 - Date.now()));   // past the ORIGINAL expiry
  const u2 = Date.now(), s2 = (await api(B, '/api/save', undefined, r.token)).status, u2r = Date.now();
  await wait(TTL + 900);
  const s3 = (await api(B, '/api/save', undefined, r.token)).status;
  ok(r.status === 200 && s1 === 200 && s2 === 200 && u2 > t0r + TTL, 'a used session slides past its first expiry', { reg: r.status, s1, s2, late: u2 - t0r, lat: u2r - u2 });
  ok(s3 === 401, 'an unused session expires after the TTL (401)', { s3 });
})();
const idleKill = (async () => {   // the alarm reaper closes a silent socket; one answering keepalives stays
  const room = 'idle' + RUN + '__ch1', W = sock(WSB), Z = sock(WSB);
  await W.ready; await Z.ready;
  W.send({ t: 'hello', name: 'Watcher', room }); await until(() => W.last('welcome'), 5000);
  Z.send({ t: 'hello', name: 'Zzz', room }); await until(() => Z.last('welcome'), 5000);
  const kz = (Z.last('welcome') || {}).id, t0 = Date.now();
  const ka = setInterval(() => W.send('{"t":"ka"}'), 2000);
  await until(() => Z.ws.readyState === 3 && W.all('left').some((m) => m.id === kz), 16000);
  const took = Date.now() - t0;
  ok(Z.ws.readyState === 3 && W.all('left').some((m) => m.id === kz), 'the idle reaper (an alarm now) closes a silent socket and tells the room', { took, rs: Z.ws.readyState });
  await wait(Math.max(0, 9000 - took));
  clearInterval(ka);
  ok(W.ws.readyState === 1 && W.all('ka').length >= 2, 'a socket sending only keepalives (answered by the runtime) is kept', { rs: W.ws.readyState, ka: W.all('ka').length });
  const lefts = W.all('left').filter((m) => m.id === kz).length;
  ok(lefts === 1, 'the reaped player is announced as left exactly once (the runtime close that follows does not revive it)', { lefts });
  W.close();
})();
const throttledSave = (async () => {   // a connected player's position still reaches storage without leaving
  const room = 'save' + RUN + '__ch1', tok = 'savetok' + RUN, P = sock(WSB); await P.ready;
  P.send({ t: 'hello', token: tok, name: 'Saver', room, map: 'town', x: 1, y: 1, hp: 9, maxHp: 9, level: 3 });
  await until(() => P.last('welcome'), 5000);
  P.send({ t: 'state', x: 4242, y: 7, map: 'cave', hp: 9, maxHp: 9, level: 3 });
  const ka = setInterval(() => P.send('{"t":"ka"}'), 2000);
  const k = 'save:' + tok + ':' + room;
  const got = await until(async () => { const v = (await peek(B, k)).keys[k]; return v && v.x === 4242 ? v : null; }, 20000);
  clearInterval(ka);
  ok(!!got && got.map === 'cave' && P.ws.readyState === 1, 'a connected player is saved periodically (no leave needed)', got);
  P.close();
})();
await Promise.all([tokenExpiry, idleKill, throttledSave]);
{ // the login lockout still holds (8 failures from one IP lock that name there, even for the right password)
  const u = 'lock_' + RUN; await api(B, '/api/register', { username: u, password: PW });
  const codes = [];
  for (let i = 0; i < 8; i++) codes.push((await api(B, '/api/login', { username: u, password: 'nopenope' + i })).status);
  const locked = await api(B, '/api/login', { username: u, password: PW });
  ok(codes.every((c) => c === 401) && locked.status === 429, '8 wrong passwords lock the name for that IP (429 even for the right one)', { codes, locked: locked.status });
}
{ // GC: lapsed rl: / fail: / tok: keys are swept by the alarm; a pre-expiry token is restamped, then expires like any
  const junk = { 'rl:reg:9.9.9.9': { n: 1, reset: Date.now() - 1000 }, 'fail:9.9.9.9:ghost': { n: 3, until: 0 }, ['tok:legacy-unused-' + RUN]: 'ttl_' + RUN };
  await api(B, '/api/__put', junk);
  const unused = await api(B, '/api/login', { username: 'ttl_' + RUN, password: PW });   // a session nobody uses again
  await api(B, '/api/login', { username: 'ghost_' + RUN, password: PW });               // an API write: owes a sweep
  const restamped = await until(async () => { const v = (await peek(B, 'tok:legacy-unused-')).keys['tok:legacy-unused-' + RUN]; return v === undefined || (v && typeof v === 'object') ? { v: v || 'swept' } : null; }, 8000);
  ok(!!restamped, 'the sweep starts the clock of a pre-expiry token nobody used', restamped);
  let last = null;
  const clean = await until(async () => {
    const now = Date.now(), all = (await peek(B, '')).keys;
    const bad = Object.entries(all).filter(([k, v]) =>
      (k.startsWith('rl:') && !(v && now <= v.reset)) ||
      (k.startsWith('fail:') && !(v && (v.until > now || now - (v.at || 0) <= 5000))) ||
      (k.startsWith('tok:') && !(v && typeof v === 'object' && now < v.exp)));
    last = { bad: bad.map(([k]) => k), junkLeft: Object.keys(junk).filter((k) => k in all), unused: ('tok:' + unused.token) in all };
    return !bad.length && !last.junkLeft.length && !last.unused;
  }, 30000);
  ok(clean, 'the alarm sweeps every lapsed rl: / fail: / tok: key (seeded legacy junk, an expired unused session)', last);
}
// (workerd's own Windows socket noise when a client drops - "Uncaught exception: kj/async-io..." - is not a worker error)
const errs = logs.join('').split(/\r?\n/).filter((l) => /TypeError|ReferenceError|RangeError|SyntaxError|Uncaught (?!exception: kj)/.test(l));
ok(!errs.length, 'no worker errors', errs.slice(0, 5));
if (process.env.MP_TEST_NO_GAME !== '1') await gamePart(B, RUN);   // B: a lobby channel holds 3, so the hop is cheap to set up
}

// ---- 6. the game: a refused join (party full) says so and stops re-dialling -------------------------------------
// MOJI_GAME_FILE (a build in the repo root) if set, else a private copy of origin/main + scripts/apply_mp_relay_game.mjs
// (baseline: the pre-fix game). Boot recipe as scripts/keybinds_test.mjs.
const PRE_FIX_GAME_REV = '76542b3d';
async function gamePart(relayBase, RUN) {
  const { chromium } = await import('playwright-core');
  const { spawn } = await import('node:child_process');
  let FILE;
  if (process.env.MOJI_GAME_FILE) FILE = process.env.MOJI_GAME_FILE.replace(/\\/g, '/').split('/').pop();
  else {
    FILE = '_fx_mp_relay_t' + process.pid + '.html';
    writeFileSync(REPO + '/' + FILE, git('show', (BASELINE ? PRE_FIX_GAME_REV : 'origin/main') + ':mojiworld_game.html'));
    cleanup.push(() => rmSync(REPO + '/' + FILE, { force: true }));
    if (!BASELINE) {
      const r = spawnSync(process.execPath, [HERE + '/apply_mp_relay_game.mjs'], { env: { ...process.env, LX_GAME_FILE: REPO + '/' + FILE }, encoding: 'utf8' });
      if (r.status !== 0) { ok(false, 'game: apply_mp_relay_game.mjs', r.stderr || r.stdout); return; }
    }
  }
  const GP = PORT + 2, room = 'full' + RUN, rid = room + '__ch1';
  const srv = spawn(process.execPath, [REPO + '/serve.js', String(GP)], { stdio: 'ignore', cwd: REPO });
  cleanup.push(() => srv.kill());
  const party = [];   // five players already in the party
  // mp-room-route (2026-09-27) - the game dials ?room=<room id> (its own DO on the new relay): the test sockets that share its room do too
  const inRoom = (r) => relayBase.replace(/^http/, 'ws') + '/?room=' + encodeURIComponent(r);
  for (let i = 0; i < 5; i++) { const c = sock(inRoom(rid)); await c.ready; c.send({ t: 'hello', token: 'full' + i + RUN, name: 'F' + i, room: rid }); party.push(c); await until(() => c.last('welcome'), 5000); }
  const fillers = [...party];   // every socket that sits in a room for the game to bump into
  const kaT = setInterval(() => { for (const c of fillers) c.send('{"t":"ka"}'); }, 2000);   // B reaps a socket silent for 6 s
  const fill = async (rid2, n, tag) => { for (let i = 0; i < n; i++) { const c = sock(inRoom(rid2)); await c.ready;   // mp-room-route (2026-09-27)
    c.send({ t: 'hello', token: tag + i + RUN, name: tag + i, room: rid2 }); fillers.push(c); await until(() => c.last('welcome') || c.last('error'), 5000); } };
  cleanup.push(() => clearInterval(kaT));
  await wait(1200);
  const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
  cleanup.push(() => browser.close());
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const perrs = []; p.on('pageerror', (e) => perrs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(REPO + '/' + rel)) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: git('show', 'origin/main:' + rel) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => {
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {}
    const W = window.WebSocket; window.__wsDials = 0;   // count every dial the game makes
    window.WebSocket = function (...a) { window.__wsDials++; return new W(...a); };
    window.WebSocket.prototype = W.prototype; Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  });
  await p.goto('http://localhost:' + GP + '/' + FILE + '?dev=1', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof mpConnect === 'function' && typeof net === 'object', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'rogue'; player.level = 30;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('town'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999; player.channel = 1;
  });
  await p.evaluate(([url, room]) => { window.__wsDials = 0; mpConnect(url, 'Sixth', room); }, [relayBase.replace(/^http/, 'ws'), room]);
  const t0 = Date.now();
  const st = () => p.evaluate(() => ({ dials: window.__wsDials, userClosed: !!net._userClosed, timer: !!net._reconnectTimer, connected: !!net.connected,
    banner: (document.getElementById('mp-banner') || {}).textContent || '', retry: !![...document.querySelectorAll('#mp-banner button')].find((b) => b.textContent === 'Retry') }));
  await until(async () => /is full/.test((await st()).banner), 15000);
  await wait(Math.max(0, t0 + 9000 - Date.now()));   // the old build re-dials after 1, 2 and 4 s
  const s1 = await st();
  ok(/is full/.test(s1.banner) && s1.retry, 'game: a refused join says the party is full, with a Retry button', s1);
  ok(s1.dials === 1 && s1.userClosed && !s1.timer && !s1.connected, 'game: ... and stops re-dialling the full party', s1);
  ok(!party.some((c) => c.all('joined').some((j) => j.name === 'Sixth')), 'game: the party never saw the refused player');
  party[4].close(); await until(() => party[0].last('left'), 5000);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#mp-banner button')].find((x) => x.textContent === 'Retry'); if (b) b.click(); });
  const joined = await until(async () => p.evaluate(() => net.myId != null && !!net.connected), 15000);
  ok(joined && party[0].all('joined').some((j) => j.name === 'Sixth'), 'game: Retry joins once a slot frees up',
    { ...(await st()), myId: await p.evaluate(() => net.myId), seen: party.map((c) => c.all('joined').map((j) => j.name)), open: party.map((c) => c.ws.readyState) });
  await p.evaluate(() => { try { mpDisconnect(); } catch (e) {} });
  // the public lobby (B holds 3 per channel): a full channel moves the player on; with all five full it says so and stops
  await fill('lobby__ch1', 3, 'LA');
  await p.evaluate((url) => { window.__wsDials = 0; net._fullHop = null; player.channel = 1; mpConnect(url, 'Hopper', 'lobby'); }, relayBase.replace(/^http/, 'ws'));
  const hop = await until(async () => p.evaluate(() => net.myId != null && net.connected && net.roomId === 'lobby__ch2'), 15000);
  const h1 = { ...(await st()), room: await p.evaluate(() => net.roomId), ch: await p.evaluate(() => player.channel) };
  ok(hop && h1.ch === 2 && h1.dials === 2, 'game: a full lobby channel moves the player on to the next one by itself', h1);
  await p.evaluate(() => { try { mpDisconnect(); } catch (e) {} });
  for (let c = 2; c <= 5; c++) await fill('lobby__ch' + c, 3, 'LB' + c + '_');
  await p.evaluate((url) => { window.__wsDials = 0; net._fullHop = null; player.channel = 3; mpConnect(url, 'Hopper', 'lobby'); }, relayBase.replace(/^http/, 'ws'));
  await until(async () => /Every lobby channel is full/.test((await st()).banner), 20000);
  await wait(4000);
  const h2 = await st();
  ok(/Every lobby channel is full/.test(h2.banner) && h2.retry && h2.dials === 5 && h2.userClosed && !h2.timer, 'game: with every lobby channel full it tries each once, then says so and stops', h2);
  ok(!perrs.length, 'game: no page errors', perrs.slice(0, 5));
}
try { await main(); } catch (e) { ok(false, 'the harness ran to the end', String((e && e.stack) || e).slice(0, 400)); }
await finish();
