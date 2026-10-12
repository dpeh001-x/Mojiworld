// steam/release15b_test.mjs - the release15b wrapper fixes (ships beside the other steam tests; run it from anywhere):
//   [S] plain Node: window_state.settle() (fractional-DPI drift), static_server.listen() (retry, honest fallback, start() contract),
//       and how main.js / preload.js wire them + the permission handlers.
//   [E] the real app (Electron, dev run of steam/main.js, temp APPDATA + --user-data-dir, ports 15060-15062, Steam bridge off):
//       E1 "Quit to Desktop" saves a resize; E2 ...and fullscreen, both ways; E3 the saved state is stable over 5 launches (title-bar
//       close and in-game quit alternating); E4 page permissions (only clipboard write + fullscreen); E5 a busy port tells the
//       player, a port freed within the retry window is still used; E6 a resize survives a crash (killed process).
//   node steam/release15b_test.mjs [--static] [--steam=<steam dir>] [--only=E1,E3]     ELECTRON=<electron.exe> to pick the binary
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process'; import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const arg = (k) => { const a = process.argv.find((x) => x.startsWith('--' + k)); return a == null ? null : (a.split('=')[1] ?? true); };
const STEAM = path.resolve(arg('steam') || path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(path.join(STEAM, 'x.js'));
const ONLY = arg('only') ? String(arg('only')).split(',') : null;
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d !== undefined ? '  [' + JSON.stringify(d) + ']' : '')); ok ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hold = (port) => new Promise((res, rej) => { const s = net.createServer(); s.once('error', rej); s.listen(port, '127.0.0.1', () => res(s)); });

// ---------------- [S] plain Node ----------------
const ws = require('./window_state.js');
const asked = { width: 1000, height: 600, x: 100, y: 50 };
check(typeof ws.settle === 'function', '[S1] window_state exports settle()');
if (typeof ws.settle === 'function') {
  const a = ws.settle(asked, { x: 99, y: 49, width: 1005, height: 605, maximized: false, fullscreen: false });
  check(a.x === 100 && a.y === 50 && a.width === 1000 && a.height === 600 && a.fullscreen === false, '[S1] a 175% DPI read-back (1005x605 @99,49) settles to what the window opened with', a);
  const b = ws.settle(asked, { x: 160, y: 90, width: 1100, height: 660, maximized: false, fullscreen: true });
  check(b.x === 160 && b.width === 1100 && b.fullscreen === true, '[S1] a real resize + move is kept', b);
  const c = ws.settle(asked, { x: 400, y: 300, width: 1006, height: 604 });
  check(c.x === 400 && c.y === 300 && c.width === 1000 && c.height === 600, '[S1] size and position are judged apart (a move keeps the settled size)', c);
  const d = ws.settle({ width: 1280, height: 800 }, { x: 33, y: 44, width: 1285, height: 805 });
  check(d.x === 33 && d.width === 1280, '[S1] no restored position: the read-back position stands', d);
}
const srv = require('./static_server.js');
const ROOT = path.join(STEAM, '..');
check(typeof srv.listen === 'function', '[S2] static_server exports listen()');
if (typeof srv.listen === 'function') {
  const P = 15055;
  let h = await hold(P); setTimeout(() => h.close(), 900);
  let r = await srv.listen(ROOT, '/mojiworld_game.html', P, { retries: 6, retryMs: 300 });
  check(r.port === P && r.fallback === false, '[S2] a port freed within the retry window is still bound (same origin, same save)', { port: r.port, fallback: r.fallback });
  if (r.server) r.server.close();
  await sleep(100); h = await hold(P);
  const t0 = Date.now(); r = await srv.listen(ROOT, '/mojiworld_game.html', P, { retries: 2, retryMs: 150 });
  check(r.fallback === true && r.port !== P && r.code === 'EADDRINUSE' && Date.now() - t0 >= 280, '[S2] a port held throughout falls back after the retries and says so', { port: r.port, fallback: r.fallback, code: r.code, ms: Date.now() - t0 });
  if (r.server) r.server.close();
  const n = await srv.start(ROOT, '/mojiworld_game.html', P);
  check(typeof n === 'number' && n !== P, '[S2] start() keeps its contract (a port number, no retries)', n);
  h.close();
}
const main = fs.readFileSync(path.join(STEAM, 'main.js'), 'utf8'), pre = fs.readFileSync(path.join(STEAM, 'preload.js'), 'utf8');
check(/win\.on\('closed', _stWrite\)/.test(main) && /'enter-full-screen', 'leave-full-screen'\]\) win\.on\(ev, _stTouch\)/.test(main) && /winState\.settle\(_stAsked/.test(main), '[S3] main.js keeps a live state snapshot and saves it on closed (in-game quit) as well as close');
check(/staticServer\.listen\(ROOT, ENTRY, FIXED_PORT, \{ retries: \d+/.test(main) && /'--moji-port-note=' \+ \(_srv\.fallback \? FIXED_PORT : ''\)/.test(main) && /moji-port-note/.test(pre), '[S3] main.js retries the port and hands a fallback to the preload notice');
check(/setPermissionRequestHandler/.test(main) && /setPermissionCheckHandler/.test(main) && /new Set\(\['clipboard-sanitized-write', 'fullscreen'\]\)/.test(main), '[S3] main.js allows only clipboard write + fullscreen');
check(/MOJI_PORT/.test(main) && /!app\.isPackaged && Number\(process\.env\.MOJI_PORT\)/.test(main), '[S3] the MOJI_PORT override is dev-only');

// ---------------- [E] the real app ----------------
let ELECTRON = process.env.ELECTRON || null;
if (!ELECTRON) { try { ELECTRON = require('electron'); } catch (e) {} }
const run = (k) => !ONLY || ONLY.includes(k);
if (arg('static') || !ELECTRON || typeof ELECTRON !== 'string' || !fs.existsSync(ELECTRON)) {
  console.log('SKIP [E] - ' + (arg('static') ? '--static' : 'no Electron binary (npm ci in steam/, or ELECTRON=<path>)'));
} else {
  const PG = 15060, PI = 15061, PC = 15062;
  const cdp = async (url) => {
    const sock = new WebSocket(url); await new Promise((r, j) => { sock.onopen = r; sock.onerror = j; });
    let id = 0; const pend = new Map();
    sock.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
    const ev = (expression, userGesture) => new Promise((r) => { const i = ++id; pend.set(i, (m) => r(m.result && m.result.result ? m.result.result.value : undefined)); try { sock.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true, userGesture: !!userGesture, includeCommandLineAPI: true } })); } catch (e) { r(undefined); } });
    return { ev, close: () => { try { sock.close(); } catch (e) {} } };
  };
  const target = async (port, pick, ms = 60000) => {
    for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(300)) {
      try { const l = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json(); const t = l.find(pick); if (t) return t.webSocketDebuggerUrl; } catch (e) {}
    }
    throw new Error('no debug target on ' + port);
  };
  const W = "(() => { const w = require('electron').BrowserWindow.getAllWindows()[0]; if (!w) return null; ";
  const launch = async (app, env) => {
    const ch = spawn(ELECTRON, [STEAM, '--user-data-dir=' + app.ud, '--inspect=' + PI, '--remote-debugging-port=' + PC],
      { cwd: STEAM, stdio: 'ignore', env: (() => { const e = Object.assign({}, process.env, { APPDATA: app.appdata, MOJI_PORT: String(PG), MOJI_RELAY_URL: 'ws://127.0.0.1:15099' }, env || {}); delete e.ELECTRON_RUN_AS_NODE; delete e.NODE_PATH; return e; })() });
    const exited = new Promise((r) => ch.on('exit', r));
    const m = await cdp(await target(PI, (t) => t.type === 'node'));
    const r = await cdp(await target(PC, (t) => t.type === 'page' && /mojiworld_game\.html/.test(t.url)));
    for (const t0 = Date.now(); Date.now() - t0 < 120000; await sleep(500)) if (await r.ev("!!document.querySelector('#set-quit-row button') && typeof _flushSaveStateNow === 'function'")) break;
    await sleep(1500);
    const end = async (how) => {
      // the inspector session is dropped first: Node holds a process whose debugger is still attached ('Waiting for the debugger to disconnect')
      if (how === 'quit') { await r.ev("setTimeout(() => document.querySelector('#set-quit-row button').click(), 300), 1"); m.close(); }   // the in-game Quit to Desktop
      else if (how === 'kill') { m.close(); try { execFileSync('taskkill', ['/PID', String(ch.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {} }   // a crash
      else { await m.ev(W + 'setTimeout(() => w.close(), 300); return 1; })()'); m.close(); }                                              // the title-bar X
      const ok = await Promise.race([exited.then(() => true), sleep(30000).then(() => false)]);
      if (!ok) { try { execFileSync('taskkill', ['/PID', String(ch.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {} await exited; }
      m.close(); r.close(); await sleep(800);
      return ok;
    };
    return { m, r, end, bounds: () => m.ev(W + 'return JSON.stringify({ n: w.getNormalBounds(), fs: w.isFullScreen() }); })()').then((s) => JSON.parse(s || 'null')) };
  };
  const mkApp = (name) => { const base = fs.mkdtempSync(path.join(os.tmpdir(), 'r15b-' + name + '-')); const appdata = path.join(base, 'AppData'); const ud = path.join(base, 'ud'); fs.mkdirSync(appdata); fs.mkdirSync(ud); return { base, appdata, ud, file: path.join(ud, 'window-state.json') }; };
  const seed = (app, o) => fs.writeFileSync(app.file, JSON.stringify(Object.assign({ x: 100, y: 50, width: 1000, height: 600, maximized: false, fullscreen: false }, o || {})));
  const read = (app) => { try { return JSON.parse(fs.readFileSync(app.file, 'utf8')); } catch (e) { return null; } };
  const SEED = { x: 100, y: 50, width: 1000, height: 600 };
  const near = (a, b) => !!a && !!b && ['x', 'y', 'width', 'height'].every((k) => Math.abs(a[k] - b[k]) <= 8);
  const same = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

  if (run('E1') || run('E2')) {   // E1 + E2: the in-game quit saves a resize, fullscreen on, fullscreen off
    const app = mkApp('quit'); seed(app);
    let L = await launch(app);
    await L.m.ev(W + 'w.setBounds({ x: 180, y: 110, width: 1100, height: 660 }); return 1; })()'); await sleep(900);
    const b1 = await L.bounds(); let ok = await L.end('quit'); const f1 = read(app);
    check(ok && same(f1, b1.n) && f1.fullscreen === false, 'E1 Quit to Desktop saves the resized + moved window', { live: b1 && b1.n, file: f1 });
    if (run('E2')) {
      L = await launch(app); const b2 = await L.bounds();
      check(near(b2 && b2.n, f1), 'E2 the next launch reopens at the quit size and place (within the DPI rounding)', { live: b2 && b2.n, file: f1 });
      await L.m.ev(W + 'w.setFullScreen(true); return 1; })()'); await sleep(1500);
      ok = await L.end('quit'); const f2 = read(app);
      check(ok && f2 && f2.fullscreen === true && same(f2, f1), 'E2 Quit to Desktop in fullscreen saves fullscreen (and keeps the windowed size underneath)', f2);
      L = await launch(app); const b3 = await L.bounds();
      check(b3 && b3.fs === true, 'E2 ...the next launch opens fullscreen', b3);
      await L.m.ev(W + 'w.setFullScreen(false); return 1; })()'); await sleep(1500);
      ok = await L.end('quit'); const f3 = read(app);
      check(ok && f3 && f3.fullscreen === false && same(f3, f1), 'E2 leaving fullscreen then quitting saves windowed at the same size', f3);
    }
    fs.rmSync(app.base, { recursive: true, force: true });
  }

  if (run('E6')) {   // E6: a resize survives a crash (the debounced write)
    const app = mkApp('crash'); seed(app); const L = await launch(app);
    await L.m.ev(W + 'w.setBounds({ x: 150, y: 80, width: 1150, height: 640 }); return 1; })()'); await sleep(1200);
    const b = await L.bounds(); await L.end('kill'); const f = read(app);
    check(same(f, b && b.n), 'E6 a resize is on disk before a crash (written 400 ms after the change)', { live: b && b.n, file: f });
    fs.rmSync(app.base, { recursive: true, force: true });
  }

  if (run('E3')) {   // E3: five launches, alternating the title-bar X and the in-game quit, never touching the window
    const app = mkApp('drift'); seed(app); const seen = [];
    for (let i = 0; i < 5; i++) { const L = await launch(app); const live = await L.bounds(); const ok = await L.end(i % 2 ? 'quit' : 'x'); seen.push(Object.assign({ ok, live: live && live.n }, read(app))); }
    check(seen.every((s) => s.ok && same(s, SEED)), 'E3 the saved window state is identical after 5 launches (no fractional-DPI growth)', seen.map((s) => (s.ok ? '' : 'NO-EXIT ') + [s.x, s.y, s.width, s.height].join(',') + ' (live ' + (s.live ? [s.live.x, s.live.y, s.live.width, s.live.height].join(',') : '?') + ')'));
    fs.rmSync(app.base, { recursive: true, force: true });
  }

  if (run('E4')) {   // E4: page permissions
    const app = mkApp('perm'); const L = await launch(app);
    const r = await L.r.ev(`(async () => {
      const t = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r('timeout'), ms || 4000))]);
      const out = {};
      out.notify = await t(Notification.requestPermission());
      out.notifyQuery = await t(navigator.permissions.query({ name: 'notifications' }).then((s) => s.state, (e) => e.name));
      out.mic = await t(navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => { s.getTracks().forEach((k) => k.stop()); return 'granted'; }, (e) => e.name));
      out.geo = await t(new Promise((r) => navigator.geolocation.getCurrentPosition(() => r('granted'), (e) => r('error ' + e.code), { timeout: 3000 })));
      out.midi = navigator.requestMIDIAccess ? await t(navigator.requestMIDIAccess().then(() => 'granted', (e) => e.name)) : 'n/a';
      return out; })()`, true);
    const clip0 = await L.m.ev("require('electron').clipboard.readText()");
    await L.m.ev(W + 'w.focus(); return 1; })()'); await sleep(400);
    const clip = await L.r.ev("navigator.clipboard.writeText('r15b-probe').then(() => 'ok', (e) => e.name)", true);
    const clipGot = await L.m.ev("require('electron').clipboard.readText()");
    await L.m.ev("require('electron').clipboard.writeText(" + JSON.stringify(clip0 || '') + ')');   // give the clipboard back
    const full = await L.r.ev("document.documentElement.requestFullscreen().then(() => 'ok', (e) => e.name)", true); await sleep(800);
    await L.r.ev('document.exitFullscreen().then(() => 1, () => 0)', true); await sleep(600);
    await L.end('x');
    check(r && r.notify === 'denied' && r.notifyQuery === 'denied', 'E4 notifications are refused', r);
    check(r && r.mic === 'NotAllowedError' && r.geo === 'error 1' && (r.midi === 'NotAllowedError' || r.midi === 'SecurityError' || r.midi === 'n/a'), 'E4 microphone, geolocation and MIDI are refused', r);
    check(clip === 'ok' && clipGot === 'r15b-probe', 'E4 the game can still write the clipboard (copy save / party code)', { clip, clipGot });
    check(full === 'ok', 'E4 the game can still go fullscreen', full);
    fs.rmSync(app.base, { recursive: true, force: true });
  }

  if (run('E5')) {   // E5: busy port
    const app = mkApp('port'); let h = await hold(PG);
    let L = await launch(app); const a = await L.r.ev("JSON.stringify({ port: location.port, note: (document.getElementById('moji-port-note') || {}).textContent || '' })").then((x) => JSON.parse(x || '{}'));
    await L.end('x'); h.close(); await sleep(200);
    check(a.port !== String(PG) && a.note.includes('port ' + PG) && /could not be opened/.test(a.note), 'E5 a port held by another program: the player is told, naming the port', a);
    h = await hold(PG); setTimeout(() => h.close(), 1500);
    L = await launch(app); const b = await L.r.ev("JSON.stringify({ port: location.port, note: !!document.getElementById('moji-port-note') })").then((x) => JSON.parse(x || '{}'));
    await L.end('x');
    check(b.port === String(PG) && b.note === false, 'E5 a port freed within the retry window is used (same origin, the save is there), no notice', b);
    fs.rmSync(app.base, { recursive: true, force: true });
  }
}
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
