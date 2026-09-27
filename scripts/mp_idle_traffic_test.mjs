// mp_idle_traffic_test.mjs - confirming test for mp-idle-traffic (the game stops re-sending an unchanged presence frame).
//   node scripts/mp_idle_traffic_test.mjs      (MOJI_GAME_FILE=<build.html in the repo root> to test a private build)
// Two game pages - A (the player who goes idle) and B (a partner watching A) - plus a bare socket W that counts A's
// 'state' frames on the wire, on the NEW relay (origin mp-cf + scripts/apply_mp_relay.mjs) and the OLD one (b42a9175),
// both run in Miniflare (the lockfile's workerd; same deps cache as mp_relay_test.mjs). Checks: idle <= 1 frame/s,
// paused / hidden <= 0.6/s, a moving player sends on every presence tick, B keeps A present (never near a timeout) and
// drawn in place through 30+ s of idling, B sees A's first step within 200 ms, on a Mushroom spot where receivers' 400 ms
// stall settle guesses the floor wrong the beat stays under 400 ms, the same on the old relay, no page errors.
// Without MOJI_GAME_FILE: a private copy of origin/main + scripts/apply_mp_idle_traffic.mjs (MP_TEST_BASELINE=1: unpatched).
import { spawnSync, spawn, execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const fwd = (p) => p.replace(/\\/g, '/').replace(/\/+$/, '');
const HERE = fwd(fileURLToPath(new URL('.', import.meta.url)));
const REPO = fwd(process.env.LX_REPO || HERE.replace(/\/scripts$/, ''));
const BASELINE = process.env.MP_TEST_BASELINE === '1';
const OLD_RELAY_REV = 'b42a9175';
const PORT = +(process.env.PORT || 11410);
const T = fwd(tmpdir()) + '/lx_mp_idle_' + process.pid;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms) => { const t0 = Date.now(); for (;;) { const v = await f(); if (v || Date.now() - t0 > ms) return v; await wait(150); } };
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { maxBuffer: 64 << 20, env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
let pass = 0, fail = 0;
const ok = (c, what, info) => { if (c) { pass++; console.log('PASS  ' + what); } else { fail++; console.log('FAIL  ' + what + '   ' + JSON.stringify(info === undefined ? null : info)); } };
const cleanup = [];
async function finish() {
  for (const f of cleanup.reverse()) { try { await f(); } catch (_) {} }
  try { rmSync(T, { recursive: true, force: true }); } catch (_) {}
  const n = pass + fail;
  console.log(fail ? fail + ' of ' + n + ' FAILED' : 'all ' + n + ' passed');
  process.exit(fail ? 1 : 0);
}

async function main() {
  // ---- relays: NEW (origin mp-cf + the mp-relay patch) and OLD (before it) --------------------------------------
  for (const v of ['new', 'old']) mkdirSync(T + '/' + v + '/mp-cf/src', { recursive: true });
  for (const f of ['src/index.js', '_cf_test.mjs', '_api_test.mjs', 'README.md', 'wrangler.toml', 'package.json', 'package-lock.json']) writeFileSync(T + '/new/mp-cf/' + f, git('show', 'origin/main:mp-cf/' + f));
  const ap = spawnSync(process.execPath, [HERE + '/apply_mp_relay.mjs'], { env: { ...process.env, LX_MP_ROOT: T + '/new' }, encoding: 'utf8' });
  if (ap.status !== 0) throw new Error('apply_mp_relay.mjs: ' + (ap.stderr || ap.stdout));
  writeFileSync(T + '/old/mp-cf/src/index.js', git('show', OLD_RELAY_REV + ':mp-cf/src/index.js'));
  const toml = readFileSync(T + '/new/mp-cf/wrangler.toml', 'utf8');
  const CD = (/^compatibility_date\s*=\s*"([^"]+)"/m.exec(toml) || [])[1] || '2024-09-23';
  const FLAGS = JSON.parse((/^compatibility_flags\s*=\s*(\[[^\]]*\])/m.exec(toml) || [])[1] || '[]');
  const lockHash = createHash('sha1').update(readFileSync(T + '/new/mp-cf/package-lock.json')).digest('hex').slice(0, 12);
  const D = fwd(process.env.LX_MP_DEPS || fwd(tmpdir()) + '/lx_mp_relay_deps') + '/' + lockHash;
  if (!existsSync(D + '/node_modules/miniflare/package.json')) {
    mkdirSync(D, { recursive: true });
    copyFileSync(T + '/new/mp-cf/package.json', D + '/package.json');
    copyFileSync(T + '/new/mp-cf/package-lock.json', D + '/package-lock.json');
    const r = spawnSync('npm ci --no-audit --no-fund --prefer-offline', { cwd: D, shell: true, encoding: 'utf8' });
    if (r.status !== 0) throw new Error('npm ci failed: ' + (r.stderr || '').slice(-400));
  }
  const req = createRequire(D + '/package.json');
  const mfMod = await import(pathToFileURL(req.resolve('miniflare')).href);
  const Miniflare = mfMod.Miniflare || (mfMod.default && mfMod.default.Miniflare);
  const NodeWS = req('ws');
  const relay = async (dir, port) => {
    const mf = new Miniflare({ modules: true, scriptPath: dir + '/mp-cf/src/index.js', modulesRoot: dir + '/mp-cf/src',
      modulesRules: [{ type: 'ESModule', include: ['**/*.js'] }], compatibilityDate: CD, compatibilityFlags: FLAGS,
      durableObjects: { ROOMS: { className: 'MojiRoom', useSQLite: true } }, host: '127.0.0.1', port });
    cleanup.push(() => mf.dispose());
    await mf.ready;
    return 'ws://127.0.0.1:' + port;
  };
  const NEW = await relay(T + '/new', PORT), OLD = await relay(T + '/old', PORT + 1);
  const sock = (url) => {
    const ws = new NodeWS(url), msgs = [];
    ws.on('message', (d) => { try { const m = JSON.parse(String(d)); m._at = Date.now(); msgs.push(m); } catch (_) {} });
    ws.on('error', () => {});
    const ready = new Promise((res) => { ws.on('open', res); ws.on('error', res); });
    const c = { ws, msgs, ready, send: (o) => { try { ws.send(typeof o === 'string' ? o : JSON.stringify(o)); } catch (_) {} } };
    cleanup.push(() => { try { ws.close(); } catch (_) {} });
    return c;
  };
  const statesFrom = (w, id, t0, t1) => w.msgs.filter((m) => m.t === 'state' && m.id === id && m._at >= t0 && m._at < t1);

  // ---- the game: two pages (boot recipe as scripts/keybinds_test.mjs) --------------------------------------------
  let FILE;
  if (process.env.MOJI_GAME_FILE) FILE = fwd(process.env.MOJI_GAME_FILE).split('/').pop();
  else {
    FILE = '_fx_mp_idle_traffic_t' + process.pid + '.html';
    writeFileSync(REPO + '/' + FILE, git('show', 'origin/main:mojiworld_game.html'));
    cleanup.push(() => rmSync(REPO + '/' + FILE, { force: true }));
    if (!BASELINE) {
      const r = spawnSync(process.execPath, [HERE + '/apply_mp_idle_traffic.mjs'], { env: { ...process.env, LX_GAME_FILE: REPO + '/' + FILE }, encoding: 'utf8' });
      if (r.status !== 0) throw new Error('apply_mp_idle_traffic.mjs: ' + (r.stderr || r.stdout));
    }
  }
  const GP = PORT + 2;
  const srv = spawn(process.execPath, [REPO + '/serve.js', String(GP)], { stdio: 'ignore', cwd: REPO });
  cleanup.push(() => srv.kill());
  await wait(1500);
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
  cleanup.push(() => browser.close());
  const errs = [];
  const boot = async (tag) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(tag + ': ' + String(e).slice(0, 160)));
    await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
      const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
      if (existsSync(REPO + '/' + rel)) return r.continue();
      try { r.fulfill({ status: 200, contentType: 'font/woff2', body: git('show', 'origin/main:' + rel) }); } catch (e) { r.continue(); }
    });
    await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
    await p.goto('http://localhost:' + GP + '/' + FILE + '?dev=1', { waitUntil: 'domcontentloaded', timeout: 180000 });
    await p.waitForFunction(() => typeof loadMap === 'function' && typeof mpConnect === 'function' && typeof net === 'object', null, { timeout: 150000 });
    await p.evaluate(async () => {
      for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
      window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'rogue'; player.level = 30;
      player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
      loadMap('town'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
      player.invulnerable = 999999; player.channel = 1; game.monsters.length = 0;
      player.hp = getMaxHp(); player.mp = getMaxMp();
    });
    return p;
  };
  const [A, B] = await Promise.all([boot('A'), boot('B')]);
  await PART2({ A, B, NEW, OLD, sock, statesFrom, errs });
}

async function PART2({ A, B, NEW, OLD, sock, statesFrom, errs }) {
  const RUN = Date.now().toString(36), room = 'idle' + RUN;
  const W = sock(NEW + '/?room=' + encodeURIComponent(room + '__ch1')); await W.ready;   // mp-room-route (2026-09-27) - in the game's room DO
  W.send({ t: 'hello', token: 'w' + RUN, name: 'Counter', room: room + '__ch1', map: 'town', x: 0, y: 0 });
  await until(() => W.msgs.some((m) => m.t === 'welcome'), 5000);
  const kaT = setInterval(() => W.send('{"t":"ka"}'), 10000); cleanup.push(() => clearInterval(kaT));   // the relay reaps a silent socket
  const join = async (p, url, name, r) => {
    await p.evaluate(([u, n, rr]) => mpConnect(u, n, rr), [url, name, r]);
    await until(() => p.evaluate(() => net.myId != null && net.connected), 15000);
    return p.evaluate(() => net.myId);
  };
  await join(B, NEW, 'Watcher', room);
  const aId = await join(A, NEW, 'Idler', room);
  await until(() => B.evaluate((id) => !!net.peers[id], aId), 10000);
  await A.evaluate(() => {   // count A's outgoing state frames and its presence ticks (each tick passes the 70 ms gate once)
    window.__sent = 0; window.__gate = 0;
    const s0 = net.ws.send; net.ws.send = function (x) { if (typeof x === 'string' && x.startsWith('{"t":"state"')) window.__sent++; return s0.apply(this, arguments); };
    let lt = net._lastTickAt; Object.defineProperty(net, '_lastTickAt', { configurable: true, get() { return lt; }, set(v) { lt = v; window.__gate++; } });
  });
  await B.evaluate((id) => { window.__pres = []; window.__presT = setInterval(() => { const p = net.peers[id];
    window.__pres.push(p ? { age: Math.round(performance.now() - (p._last || 0)), dx: Math.abs((p._rx == null ? p.x : p._rx) - p.x), dy: Math.abs((p._ry == null ? p.y : p._ry) - p.y) } : null); }, 500); }, aId);
  await A.evaluate(() => { player.hp = getMaxHp(); player.mp = getMaxMp(); });
  await wait(3000);
  const rate = async (w, id, ms) => { const t0 = Date.now(); await wait(ms); return statesFrom(w, id, t0, Date.now()).length / (ms / 1000); };
  const idle = await rate(W, aId, 10000), ground = await A.evaluate(() => !!player.onGround);
  ok(idle <= 1.0, 'new relay: an idle player sends <= 1 state frame/s (' + idle + '/s)', { perSec: idle, onGround: ground });
  // paused the way a player pauses: a menu open (the game re-derives game.paused from its open windows every frame)
  await A.evaluate(() => { toggleKeybindModal(); }); await wait(2500);
  const pausedT0 = Date.now(), wasPaused = await A.evaluate(() => !!game.paused);
  const paused = await rate(W, aId, 10000);
  const stillPaused = await A.evaluate(() => !!game.paused);
  await A.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); }); await wait(2500);
  const hidden = await rate(W, aId, 10000);
  await A.evaluate(() => { delete document.hidden; });
  ok(wasPaused && stillPaused && paused <= 0.6 && hidden <= 0.6, 'new relay: a paused player (a menu open) / a hidden tab sends <= 0.6 state frames/s (' + paused + ' / ' + hidden + ')', { paused, hidden, gamePaused: [wasPaused, stillPaused] });
  const pres = await B.evaluate(() => { clearInterval(window.__presT); return window.__pres; });
  const ages = pres.map((s) => (s ? s.age : 1e9)), between = pres.filter((s) => s && s.age >= 400);   // between beats: where a skipped frame could drift or drop the avatar
  const drift = Math.max(0, ...between.map((s) => Math.max(s.dx, s.dy)));
  ok(pres.length >= 60 && Math.max(...ages) < 5000 && drift < 2, 'the partner keeps the idle player present 30+ s (last heard < 5 s ago, the earliest timeout: max ' + Math.max(...ages) + ' ms) and drawn in place between beats (' + drift.toFixed(1) + ' px)',
    { samples: pres.length, between: between.length, maxAgeMs: Math.max(...ages), maxDrawDriftPx: drift });
  await wait(2500);   // idle again, then the first step
  const x0 = await A.evaluate(() => player.x);
  await B.evaluate(([id, x]) => { window.__seenAt = 0; window.__seenT = setInterval(() => { const p = net.peers[id]; if (p && Math.abs((+p.x || 0) - x) > 1) { window.__seenAt = Date.now(); clearInterval(window.__seenT); } }, 4); }, [aId, x0]);
  const movedAt = await A.evaluate(() => {
    window.__mvDir = 1; window.__mv = setInterval(() => { player.x += 3 * window.__mvDir; player.vx = 3 * window.__mvDir; player.facing = window.__mvDir; }, 16);
    window.__mvFlip = setInterval(() => { window.__mvDir *= -1; }, 1000);
    return Date.now();
  });
  const seenAt = await until(() => B.evaluate(() => window.__seenAt), 3000);
  ok(seenAt && seenAt - movedAt <= 200, 'the partner sees the first step after idling within 200 ms (' + (seenAt ? seenAt - movedAt : '-') + ' ms)', { ms: seenAt ? seenAt - movedAt : null });
  await wait(500);
  const m0 = await A.evaluate(() => { window.__fps = 0; window.__fpsOn = true; const f = () => { if (!window.__fpsOn) return; window.__fps++; requestAnimationFrame(f); }; requestAnimationFrame(f); return { g: window.__gate, s: window.__sent }; });
  const tm0 = Date.now(); await wait(4000); const tm1 = Date.now();
  const m1 = await A.evaluate(() => { window.__fpsOn = false; return { g: window.__gate, s: window.__sent, fps: window.__fps / 4 }; });
  const ticks = m1.g - m0.g, sent = m1.s - m0.s, wire = statesFrom(W, aId, tm0, tm1).length / ((tm1 - tm0) / 1000);
  ok(ticks >= 8 && sent >= ticks - 1, 'a moving player still sends on every presence tick (' + sent + '/' + ticks + ' in 4 s, ' + wire.toFixed(1) + '/s at ' + m1.fps + ' fps)', { ticks, sent, perSecOnWire: wire, fps: m1.fps });
  await A.evaluate(() => { clearInterval(window.__mv); clearInterval(window.__mvFlip); player.vx = 0; });
  // a spot where the receivers' 400 ms stall settle guesses the floor wrong (older builds too): the beat must stay under 400 ms
  const spot = await A.evaluate(async () => {
    loadMap('mushroom'); await new Promise((r) => setTimeout(r, 2500)); game.monsters.length = 0;
    const W = (game.mapData && game.mapData.width) || 3000;
    for (let x = 40; x < W - 40; x += 40) {
      player.x = x; player.y = 0; player.vx = 0; player.vy = 0;
      const t0 = performance.now(); while (!player.onGround && performance.now() - t0 < 2500) await new Promise((r) => setTimeout(r, 60));
      await new Promise((r) => setTimeout(r, 150));
      const ry = player.onGround ? _mpPeerRestY(player.x, player.y) : null;
      if (ry != null && ry > player.y - 4 && Math.abs(ry - player.y) > 0.5) return { x: player.x, y: player.y, guessOffPx: Math.round(ry - player.y) };
    }
    return null;
  });
  await wait(1500);
  const s0 = Date.now(); await wait(5000);
  const at = statesFrom(W, aId, s0, Date.now()).map((m) => m._at);
  const gapMax = Math.max(0, ...at.slice(1).map((t, i) => t - at[i]));
  ok(!!spot && at.length >= 10 && gapMax < 400, 'idle on a spot where receivers guess the floor wrong (' + (spot ? spot.guessOffPx + ' px' : '-') + '), the beat stays under their 400 ms settle, older builds included (max gap ' + gapMax + ' ms)',
    { spot, frames: at.length, maxGapMs: gapMax });
  await A.evaluate(() => { try { loadMap('town'); } catch (e) {} mpDisconnect(); });

  // ---- the same sender on the OLD relay (b42a9175) --------------------------------------------------------------
  const room2 = 'old' + RUN, W2 = sock(OLD); await W2.ready;
  W2.send({ t: 'hello', token: 'w2' + RUN, name: 'Counter', room: room2 + '__ch1', map: 'town', x: 0, y: 0 });
  await until(() => W2.msgs.some((m) => m.t === 'welcome'), 5000);
  const aId2 = await join(A, OLD, 'Idler', room2);
  await A.evaluate(() => { player.hp = getMaxHp(); player.mp = getMaxMp(); });
  await wait(3000);
  const idle2 = await rate(W2, aId2, 8000);
  ok(idle2 <= 1.0, 'old relay: an idle player sends <= 1 state frame/s (' + idle2 + '/s)', { perSec: idle2 });
  const x2 = await A.evaluate(() => player.x);
  const moved2 = await A.evaluate(() => { window.__mv = setInterval(() => { player.x += 3; player.vx = 3; }, 16); return Date.now(); });
  await until(() => W2.msgs.some((m) => m.t === 'state' && m.id === aId2 && m._at >= moved2 && Math.abs((+m.x || 0) - x2) > 1), 3000);
  const f2 = W2.msgs.find((m) => m.t === 'state' && m.id === aId2 && m._at >= moved2 && Math.abs((+m.x || 0) - x2) > 1);
  ok(f2 && f2._at - moved2 <= 200, 'old relay: the first step reaches a peer within 200 ms (' + (f2 ? f2._at - moved2 : '-') + ' ms)', { ms: f2 ? f2._at - moved2 : null });
  await A.evaluate(() => { clearInterval(window.__mv); player.vx = 0; mpDisconnect(); });
  await B.evaluate(() => { try { mpDisconnect(); } catch (e) {} });
  ok(!errs.length, 'no page errors', errs.slice(0, 5));
}

try { await main(); } catch (e) { ok(false, 'the test ran to the end', String((e && e.stack) || e).slice(0, 400)); }
await finish();
