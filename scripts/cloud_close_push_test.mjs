// Cloud close push: the progress made just before closing the tab reaches the account cloud (v0.30.x cloud-close-push).
//   node scripts/cloud_close_push_test.mjs            (MOJI_GAME_FILE=<build.html> PORT=<port> to test a private build)
// The account cloud is the REAL relay code run in Miniflare (the Workers runtime), not a mock: the NEW relay = origin's
// mp-cf + scripts/apply_cloud_close_push_relay.mjs (takes gzip, answers "gz":1) on PORT+1, and the OLD relay = the live
// one's code (b42a9175, before mp-relay; its CORS refuses content-encoding and it cannot read gzip) on PORT+2. A test-only
// entry logs every POST /api/save it gets. The game is pointed at one relay per browser context (levelx_api_base) with a
// cloud session; its save is padded to ~90 KB (a late-game save is ~87 KB); window.fetch is spied (keepalive? gzip? size).
// Tab hide / pagehide are dispatched on the live page; "close" is a real page.close() (beforeunload, pagehide, unload).
// Deps: mp-cf's lockfile npm-ci'd once into LX_MP_DEPS (default <tmp>/lx_mp_relay_deps, shared with mp_relay_test).
import { chromium } from 'playwright-core';
import path from 'node:path';
import zlib from 'node:zlib';
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
const T = tmpdir().replace(/\\/g, '/') + '/lx_ccp_' + process.pid;
const cleanup = [];
const finish = async () => {
  for (const f of cleanup.reverse()) { try { await f(); } catch (e) {} }
  try { rmSync(T, { recursive: true, force: true }); } catch (e) {}
  console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
  process.exit(bad ? 1 : 0);
};

// ---- the two relays (real code, Miniflare) --------------------------------------------------------------------------
const MPF = ['src/index.js', 'README.md', 'wrangler.toml', 'package.json', 'package-lock.json'];
for (const v of ['new', 'old']) {
  mkdirSync(T + '/' + v + '/mp-cf/src', { recursive: true });
  for (const f of MPF) writeFileSync(T + '/' + v + '/mp-cf/' + f, git('show', 'origin/main:mp-cf/' + f));
}
writeFileSync(T + '/old/mp-cf/src/index.js', git('show', 'b42a9175:mp-cf/src/index.js'));
{ const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/apply_cloud_close_push_relay.mjs')], { env: { ...process.env, LX_MP_ROOT: T + '/new' }, encoding: 'utf8' });
  if (r.status !== 0) { check(false, 'setup: the relay half applies', r.stderr || r.stdout); await finish(); } }
const lockHash = createHash('sha1').update(readFileSync(T + '/new/mp-cf/package-lock.json')).digest('hex').slice(0, 12);
const D = (process.env.LX_MP_DEPS || tmpdir().replace(/\\/g, '/') + '/lx_mp_relay_deps') + '/' + lockHash;
if (!existsSync(D + '/node_modules/miniflare/package.json')) {
  mkdirSync(D, { recursive: true });
  copyFileSync(T + '/new/mp-cf/package.json', D + '/package.json'); copyFileSync(T + '/new/mp-cf/package-lock.json', D + '/package-lock.json');
  const r = spawnSync('npm ci --no-audit --no-fund --prefer-offline', { cwd: D, shell: true, encoding: 'utf8' });
  if (r.status !== 0) { check(false, 'setup: npm ci of mp-cf deps', (r.stderr || '').slice(-400)); await finish(); }
}
const mfMod = await import(pathToFileURL(createRequire(D + '/package.json').resolve('miniflare')).href);
const Miniflare = mfMod.Miniflare || (mfMod.default && mfMod.default.Miniflare);
const toml = readFileSync(T + '/new/mp-cf/wrangler.toml', 'utf8');
const CD = (/^compatibility_date\s*=\s*"([^"]+)"/m.exec(toml) || [])[1] || '2024-09-23';
const FLAGS = JSON.parse((/^compatibility_flags\s*=\s*(\[[^\]]*\])/m.exec(toml) || [])[1] || '[]');
const ENTRY = [   // the real worker + MojiRoom, plus a log of every save POST (encoding, bytes, status)
  "import W, { MojiRoom as Base } from './index.js';",
  'const LOG = [];',
  'export class MojiRoom extends Base {',
  '  async fetch(request) {',
  '    const u = new URL(request.url);',
  "    if (u.pathname === '/api/__posts') return new Response(JSON.stringify(LOG), { headers: { 'content-type': 'application/json' } });",
  "    if (u.pathname === '/api/save' && request.method === 'POST') {",
  '      const b = new Uint8Array(await request.clone().arrayBuffer());',
  '      const r = await super.fetch(request);',
  "      LOG.push({ enc: request.headers.get('content-encoding') || '', bytes: b.length, gz: b[0] === 0x1f && b[1] === 0x8b, status: r.status });",
  '      return r;',
  '    }',
  '    return super.fetch(request);',
  '  }',
  '}',
  'export default W;', ''].join('\n');
const relay = async (v, port) => {
  writeFileSync(T + '/' + v + '/mp-cf/src/_lx_test_entry.mjs', ENTRY);
  const mf = new Miniflare({ modules: true, scriptPath: T + '/' + v + '/mp-cf/src/_lx_test_entry.mjs', modulesRoot: T + '/' + v + '/mp-cf/src',
    modulesRules: [{ type: 'ESModule', include: ['**/*.js', '**/*.mjs'] }], compatibilityDate: CD, compatibilityFlags: FLAGS,
    durableObjects: { ROOMS: { className: 'MojiRoom', useSQLite: true } }, host: '127.0.0.1', port, handleRuntimeStdio() {} });
  cleanup.push(() => mf.dispose()); await mf.ready;
  return 'http://127.0.0.1:' + port;
};
const NEW = await relay('new', PORT + 1), OLD = await relay('old', PORT + 2);
const api = async (base, p, { body, token, method, headers } = {}) => {
  const r = await fetch(base + p, { method: method || (body !== undefined ? 'POST' : 'GET'), body,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}), ...(headers || {}) } });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, j, allow: r.headers.get('access-control-allow-headers') || '' };
};
const account = async (base) => (await api(base, '/api/register', { body: JSON.stringify({ username: 'ccp' + Math.random().toString(36).slice(2, 10), password: 'hunter2secret' }) })).j.token;
const cloudCoins = async (base, token) => { const r = await api(base, '/api/save', { token }); return r.j && r.j.save && r.j.save.player ? r.j.save.player.mojicoins : null; };
const posts = async (base) => (await (await fetch(base + '/api/__posts')).json());

// ---- the game --------------------------------------------------------------------------------------------------------
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
cleanup.push(() => srv.kill());
await wait(1500);
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
cleanup.push(() => browser.close());
const errs = [];
const game = async (base, token) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript((base) => {
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('levelx_api_base', base); } catch (e) {}
    window.__cf = []; const f0 = window.fetch;   // every save POST the game makes: keepalive? gzip? size?
    window.fetch = function (u, o) {
      try { if (/[/]api[/]save/.test(String(u)) && o && o.method === 'POST') { const b = o.body; window.__cf.push({ ka: !!o.keepalive, gz: !!(o.headers && o.headers['content-encoding']), len: typeof b === 'string' ? b.length : ((b && b.byteLength) || 0) }); } } catch (e) {}
      return f0.apply(this, arguments);
    };
  }, base);
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof _flushSaveStateNow === 'function' && typeof LXAuth === 'object', null, { timeout: 180000 });
  await p.evaluate(async (token) => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; window._prologuePending = false; window._lxAwaitingCreation = false;
    player.cls = 'rogue'; player.level = 70;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999; game.monsters.length = 0;
    try { if (typeof _earlyState === 'function') _earlyState(); } catch (e) {}   // the milestone tracker appears once, a few s in: now
    window.__full = () => { player.hp = getMaxHp(); player.mp = getMaxMp(); };   // idle at full HP/MP: nothing changes by itself
    localStorage.setItem(SESSION_KEY, JSON.stringify({ kind: 'cloud', token, name: 'tester', ts: Date.now() }));
    window.__flush = () => { game._saveDirty = true; _flushSaveStateNow(); return (localStorage.getItem(SAVE_KEY) || '').length; };
    window.__pad = (on) => { for (let i = 0; i < 5000; i++) { const k = 'lxt_' + ((i * 2654435761) >>> 0).toString(36); if (on) player._storyBeatsSeen[k] = true; else delete player._storyBeatsSeen[k]; } };
    window.__justPushed = () => { __full(); _lxCloudPushAt = Date.now(); };   // a regular push a moment ago: the 15 s throttle is on
    window.__hide = (h) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
    };
    window.__pagehide = () => { window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })); };
    window.__pageshow = () => { window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); };
  }, token);
  return { ctx, p };
};

try {
  // ---- NEW relay ----------------------------------------------------------------------------------------------------
  const tN = await account(NEW);
  const A = await game(NEW, tN); const p = A.p;
  const big0 = await p.evaluate(() => { __full(); __pad(true); player.mojicoins = 500100; return __flush(); });
  const first = await until(async () => (await cloudCoins(NEW, tN)) === 500100, 20000);
  check(big0 >= 88000 && big0 < 200000 && first, 'setup: the padded save is ~90 KB and the first push lands on the new relay', { big0, first });
  // 1) progress, a flush inside the throttle (no push), then the tab is hidden: that save reaches the cloud
  let n0 = await p.evaluate(() => __cf.length);
  await p.evaluate(() => { __justPushed(); player.mojicoins = 500101; __flush(); });
  await wait(1500);
  const throttled = (await p.evaluate(() => __cf.length)) === n0;
  await p.evaluate(() => __hide(true));
  const hid = await until(async () => (await cloudCoins(NEW, tN)) === 500101, 12000);
  const hidReq = await p.evaluate((n) => __cf.slice(n), n0);
  await p.evaluate(() => __hide(false));
  check(throttled && hid && hidReq.length === 1 && !hidReq[0].ka && hidReq[0].len > 65536,
    'a 90 KB save + the tab hidden: pushed at once by an ordinary fetch (past the 15 s throttle) and it lands', { throttled, hid, hidReq });
  // 2) no double push: hidden again and a pagehide, nothing new -> nothing sent; a flush inside the throttle -> nothing
  n0 = await p.evaluate(() => __cf.length); let r0 = (await posts(NEW)).length;
  await p.evaluate(() => { __hide(true); __hide(false); }); await wait(1500);
  await p.evaluate(() => { __pagehide(); __pageshow(); __flush(); }); await wait(2000);
  const again = await p.evaluate((n) => __cf.slice(n), n0), rAgain = (await posts(NEW)).length - r0;
  check(again.length === 0 && rAgain === 0, 'no second push of a save the cloud has (hidden again, a pagehide, a flush inside the 15 s window)', { again, rAgain });
  // 3) a small save still goes by keepalive on pagehide
  n0 = await p.evaluate(() => __cf.length);
  const small = await p.evaluate(() => { __pad(false); player.mojicoins = 500102; __justPushed(); return __flush(); });
  await p.evaluate(() => { __pagehide(); __pageshow(); });
  const smallLanded = await until(async () => (await cloudCoins(NEW, tN)) === 500102, 12000);
  const smallReq = await p.evaluate((n) => __cf.slice(n), n0);
  check(small < 60000 && smallLanded && smallReq.length === 1 && smallReq[0].ka && !smallReq[0].gz,
    'a small save (under 64 KB) is still pushed by keepalive on pagehide, and lands', { small, smallLanded, smallReq });
  // 4) a REAL tab close with a 90 KB save and the throttle on: the close push lands (gzipped keepalive), once
  await p.evaluate(() => { __pad(true); player.mojicoins = 500103; __justPushed(); __flush(); });
  r0 = (await posts(NEW)).length;
  await p.close({ runBeforeUnload: true });
  const closed = await until(async () => (await cloudCoins(NEW, tN)) === 500103, 15000);
  await wait(1500);
  const rClose = (await posts(NEW)).slice(r0);
  check(closed && rClose.length === 1 && rClose[0].gz && rClose[0].bytes < 60000 && rClose[0].status === 200,
    'closing the tab with a 90 KB save: the close push lands - gzipped under the keepalive limit, one request', { closed, rClose });
  await A.ctx.close();

  // ---- OLD relay (the live one until the relay half is deployed) ---------------------------------------------------------
  const tO = await account(OLD);
  const gzBody = zlib.gzipSync(Buffer.from(JSON.stringify({ v: 1, t: 1, player: { mojicoins: 7 }, game: {} })));
  const oldGz = await api(OLD, '/api/save', { token: tO, body: gzBody, headers: { 'content-encoding': 'gzip' } });
  const oldPre = await api(OLD, '/api/save', { method: 'OPTIONS' });
  check(oldGz.status === 400 && !/content-encoding/.test(oldPre.allow), 'setup: the old relay refuses a gzipped save (400) and its CORS does not allow content-encoding', { status: oldGz.status, allow: oldPre.allow });
  const B = await game(OLD, tO); const q = B.p;
  await q.evaluate(() => { __pad(true); player.mojicoins = 600100; __flush(); });
  await until(async () => (await cloudCoins(OLD, tO)) === 600100, 20000);
  n0 = await q.evaluate(() => __cf.length);
  await q.evaluate(() => { __justPushed(); player.mojicoins = 600101; __flush(); __hide(true); });
  const oHid = await until(async () => (await cloudCoins(OLD, tO)) === 600101, 12000);
  await q.evaluate(() => __hide(false));
  check(oHid, 'old relay: a 90 KB save + the tab hidden still lands (plain body)', { oHid, reqs: await q.evaluate((n) => __cf.slice(n), n0) });
  n0 = await q.evaluate(() => __cf.length);
  const threw = await q.evaluate(() => { try { player.mojicoins = 600102; __justPushed(); __flush(); __pagehide(); __pageshow(); return null; } catch (e) { return String(e); } });
  await wait(1500);
  const oPh = await q.evaluate((n) => __cf.slice(n), n0);
  check(!threw && oPh.every((x) => !x.gz && !(x.ka && x.len > 65536)), 'old relay: pagehide with a >64 KB save sends no gzip and no oversized keepalive (skipped), and does not throw', { threw, oPh });
  r0 = (await posts(OLD)).length;
  await q.close({ runBeforeUnload: true });
  await wait(4000);
  const oClose = (await posts(OLD)).slice(r0), oCoins = await cloudCoins(OLD, tO);
  check((oCoins === 600101 || oCoins === 600102) && oClose.every((x) => !x.gz && x.status === 200),
    'old relay: a real close never sends it gzip; the cloud keeps a whole save (the hide push, or the close\'s)', { oCoins, oClose });
  await B.ctx.close();

  // ---- the relay half, directly ------------------------------------------------------------------------------------------
  const sv = { v: 9, t: 5, player: { mojicoins: 424242, name: 'Zoë ✨' }, game: { currentMap: 'mushroom' }, pad: 'x'.repeat(90000) };
  const tR = await account(NEW);
  const gz = await api(NEW, '/api/save', { token: tR, body: zlib.gzipSync(Buffer.from(JSON.stringify(sv))), headers: { 'content-encoding': 'gzip' } });
  const back = await api(NEW, '/api/save', { token: tR });
  check(gz.status === 200 && gz.j.gz === 1 && back.j.gz === 1 && JSON.stringify(back.j.save) === JSON.stringify(sv), 'new relay: a gzipped save POST is stored exactly; its answers say gz:1', { gz, got: back.j && back.j.save && back.j.save.player });
  const plain = await api(NEW, '/api/save', { token: tR, body: JSON.stringify({ ...sv, pad: 'y' }) });
  const back2 = await api(NEW, '/api/save', { token: tR });
  const bomb = await api(NEW, '/api/save', { token: tR, body: zlib.gzipSync(Buffer.from('{"p":"' + ' '.repeat(3 * 1024 * 1024) + '"}')), headers: { 'content-encoding': 'gzip' } });
  const broken = await api(NEW, '/api/save', { token: tR, body: Buffer.from([0x1f, 0x8b, 8, 0, 1, 2, 3, 4, 5, 6, 7]), headers: { 'content-encoding': 'gzip' } });
  const over = await api(NEW, '/api/save', { token: tR, body: JSON.stringify({ p: 'z'.repeat(600 * 1024) }) });
  const pre = await api(NEW, '/api/save', { method: 'OPTIONS' });
  const back3 = await api(NEW, '/api/save', { token: tR });
  check(plain.status === 200 && back2.j.save.pad === 'y' && bomb.status === 413 && broken.status === 400 && over.status === 413 && /content-encoding/.test(pre.allow) && back3.j.save.pad === 'y',
    'new relay: plain saves as before; a gzip bomb (3 MB inflated) 413, a broken gzip 400, a 600 KB save 413; CORS allows content-encoding', { plain: plain.status, bomb: bomb.status, broken: broken.status, over: over.status, allow: pre.allow });
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} catch (e) { check(false, 'ran to completion', String(e && e.stack || e).slice(0, 600)); }
await finish();
