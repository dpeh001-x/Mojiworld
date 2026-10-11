// RELEASE 11b - co-op fixes from the 3-4 client bug hunt, on the REAL local relay (mp/server.mjs, spawned here) with three game pages:
//   REVIVE   a finished channel revives the body it was on, not every downed partner within ~225 px of the reviver
//   PAUSE    a guest paused in a menu says so at once (pz), and the host's boss stops targeting it while someone else can be fought
//   EXP      the party bonus gates on the receiver's own distance to the kill, host and guest alike (the runner counts only when near)
//   CAP      mp/server.mjs caps a party room at ROOM_CAP (default 5, as the worker) with the worker's error{code:'room_full'} frame
//   node scripts/release11b_test.mjs     (PORT default 14911; MOJI_SERVE_ROOT = the checkout to serve; MOJI_GAME_FILE picks the build)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 14911), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const URL = `http://localhost:${PORT}/${FILE}`, WS = `ws://localhost:${PORT}`, MAP = 'glasswindSteppe';
const ROOM = 'r11b' + Math.floor(Math.random() * 1e6);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (page, fn, arg, ms = 6000) => { const t0 = Date.now(); for (;;) { const r = await page.evaluate(fn, arg); if (r.ok || Date.now() - t0 > ms) return r.v; await sleep(120); } };
const relays = [];
async function startRelay(port, extraEnv) {
  const env = { ...process.env, PORT: String(port), ...(extraEnv || {}) }; if (!extraEnv || !('ROOM_CAP' in extraEnv)) delete env.ROOM_CAP;
  const p = spawn(process.execPath, [path.join(ROOT, 'mp', 'server.mjs')], { cwd: path.join(ROOT, 'mp'), env, stdio: ['ignore', 'pipe', 'pipe'] });
  relays.push(p);
  await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('relay did not start')), 15000); p.stdout.on('data', (d) => { if (String(d).includes('MP relay')) { clearTimeout(t); res(); } }); p.on('exit', (c) => { clearTimeout(t); rej(new Error('relay exited ' + c)); }); });
  return p;
}
// a raw relay socket (Node's own WebSocket): resolves with the first welcome / error frame and the close code
function rawJoin(ws, room, name) {
  return new Promise((res) => {
    const s = new WebSocket(ws); const out = { s, first: null, close: null };
    const t = setTimeout(() => res(out), 4000);
    s.onopen = () => s.send(JSON.stringify({ t: 'hello', name, room, map: 'town', x: 0, y: 0 }));
    s.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } if (!out.first && (m.t === 'welcome' || m.t === 'error')) { out.first = m; if (m.t === 'welcome') { clearTimeout(t); res(out); } } };
    s.onclose = (e) => { out.close = e.code; clearTimeout(t); setTimeout(() => res(out), 50); };
  });
}
async function boot(browser, name) {
  const ctx = await browser.newContext(); await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page._errors = [];
  page.on('pageerror', (e) => page._errors.push(String(e).slice(0, 180)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => typeof net === 'object' && typeof game === 'object' && typeof mpConnect === 'function' && typeof _coopReviveTick === 'function', null, { timeout: 90000 });
  await page.waitForTimeout(3500);
  await page.evaluate((nm) => { try { player.cls = 'warrior'; if (player.look) player.look.name = nm; player.channel = 1; game.paused = false; window._prologueActive = false; window._prologuePending = false; window._lxBootGateDone = true;
    player._tutorialSeen = true; document.body.classList.remove('sb-active'); const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none'; } catch (e) {} }, name);
  return page;
}
const ev = (p, fn, arg) => p.evaluate(fn, arg);
const pump = (p) => p.evaluate(() => { window.__pump = setInterval(() => { try { _mpTick(); } catch (e) {} try { _coopTickMonsters(); } catch (e) {} try { _coopReviveTick(80); } catch (e) {} try { if (player._downed) _coopDownedTick(80); } catch (e) {} try { if (net.isHost) for (let i = game.monsters.length - 1; i >= 0; i--) { const m = game.monsters[i]; if (m && !m._r11bBoss && !m._r11b) game.monsters.splice(i, 1); } } catch (e) {} }, 80); });   // the host keeps the map clear of its own mobs: only the test's monsters
const place = (p, x) => ev(p, (x) => { const g = game.mapData.platforms.find((q) => q.type === 'ground' && q.x <= x && q.x + q.w >= x + 40);
  player.x = x; player.y = (g ? g.y : 480) - player.h; player.vx = 0; player.vy = 0; player.onGround = true; return !!g; }, x);

await startRelay(PORT);
const EXE = [process.env.PW_EXE, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const [A, B, C] = await Promise.all([boot(browser, 'Ann'), boot(browser, 'Bob'), boot(browser, 'Cid')]);
  await ev(A, ({ ws, room }) => mpConnect(ws, 'Ann', room), { ws: WS, room: ROOM });
  await A.waitForFunction(() => net.myId != null, null, { timeout: 15000 }).catch(() => {});
  for (const [P, n] of [[B, 'Bob'], [C, 'Cid']]) { await ev(P, ({ ws, room, n }) => mpConnect(ws, n, room), { ws: WS, room: ROOM, n }); await P.waitForFunction(() => net.myId != null, null, { timeout: 15000 }).catch(() => {}); }
  await sleep(900); for (const P of [A, B, C]) await pump(P);
  for (const P of [A, B, C]) await ev(P, (m) => { game.visitedMaps = game.visitedMaps || {}; game.visitedMaps[m] = true; loadMap(m); }, MAP);
  await sleep(2000);
  const ids = { A: await ev(A, () => net.myId), B: await ev(B, () => net.myId), C: await ev(C, () => net.myId) };
  ok('three clients in one room, Ann runs the map', (await ev(A, () => net.isHost)) === true && (await ev(B, () => net.isHost)) === false && (await ev(C, () => net.isHost)) === false, ids);
  for (const P of [A, B, C]) await ev(P, () => { player.hp = player.maxHp = 3000; player._god = false; player.invulnerable = net.isHost ? 1e9 : 0; player._coopReviveMapAt = {}; game.paused = false; });

  // ---------------- REVIVE: Ann channels on Bob; Cid lies 160 px away (outside the 90 px channel, inside the old 225 px accept) ----------------
  const X0 = await ev(A, () => { const g = game.mapData.platforms.find((q) => q.type === 'ground' && q.w >= 400 && q.x >= 0); return g ? Math.round(g.x + 60) : 600; });
  await place(A, X0); await place(B, X0); await place(C, X0 + 160);
  await ev(A, () => { window.__rv = []; const o = net.ws.send; net.ws.send = function (d) { try { if (typeof d === 'string' && d.indexOf('"t":"revive"') >= 0) window.__rv.push(JSON.parse(d)); } catch (e) {} return o.apply(this, arguments); }; });
  await sleep(900);
  const dn = [];
  for (const P of [B, C]) dn.push(await ev(P, () => { player.hp = 0; const saved = _tryCheatDeathRevive(); return { saved, downed: !!player._downed }; }));
  ok('Bob and Cid both go DOWN with Ann alive on the map', dn.every((d) => d.saved && d.downed), dn);
  const seen = await until(A, () => { const v = Object.values(net.peers).filter((p) => p && p._downed).length; return { ok: v === 2, v }; }, null, 6000);
  const geo = await ev(A, (cid) => { const p = net.peers[cid]; return { d: Math.round(Math.hypot((p.x || 0) - player.x, (p.y || 0) - player.y)), R: COOP_REVIVE_RANGE }; }, ids.C);
  ok('Ann sees both bodies; Cid lies outside the channel but inside the old 2.5x accept range', seen === 2 && geo.d > geo.R && geo.d <= geo.R * 2.5, { seen, geo });
  const bUp = await until(B, () => ({ ok: !player._downed, v: !player._downed }), null, 9000);
  ok('Ann\'s channel revives Bob', bUp === true);
  await sleep(1200);
  const cDown = await ev(C, () => !!player._downed);
  ok('...and ONLY Bob: Cid, 160 px away, is still down (was: revived by the same frame)', cDown === true, { cDown });
  const rv = await ev(A, () => window.__rv);
  ok('every revive frame Ann sent names its body (to = Bob)', rv.length >= 1 && rv.every((f) => +f.to === +ids.B), rv);
  const elsewhere = await ev(C, ({ a, b }) => { _coopApplyRevive({ t: 'revive', id: a, map: game.currentMap, to: b }); return !!player._downed; }, { a: ids.A, b: ids.B });
  ok('a revive frame addressed to another body leaves Cid down', elsewhere === true);
  const legacy = await ev(C, (a) => { if (player._downed) _coopApplyRevive({ t: 'revive', id: a, map: game.currentMap }); return { downed: !!player._downed, hp: player.hp }; }, ids.A);
  ok('a frame with no "to" (an older build) still revives the body in range', legacy.downed === false && legacy.hp > 1, legacy);
  for (const P of [A, B, C]) await ev(P, () => { player.hp = player.maxHp = 100000; player.invulnerable = 1e9; game.paused = false; });
  // ---------------- PAUSE: Ann far left, Bob beside the boss, Cid further right; Bob opens a menu ----------------
  const W = await ev(A, () => (game.mapData && game.mapData.worldWidth) || 1800);
  const BX = Math.round(W * 0.6), BC = BX + 80;   // the boss's left edge and (Mooma is 161 wide) its centre
  ok('the map is wide enough for the layout', BC + 450 + 80 < W && BC - 1000 > 100, { W, BX });
  await place(A, 150); await place(B, BC - 150 - 14); await place(C, BC + 450 - 14);
  await sleep(900);
  const aggro = (n) => ev(A, (n) => { const b = game.monsters.find((m) => m && m._r11bBoss); if (!b) return 'gone'; const was = game.paused; game.paused = false;
    for (let i = 0; i < n; i++) { try { b.x = window.__bx; updateMonsters(1000 / 60); } catch (e) {} } game.paused = was; return b._coopAggroId == null ? null : b._coopAggroId; }, n);
  const spawned = await ev(A, (bx) => { window.__bx = bx; game.monsters.length = 0; const b = spawnMonster(bx, player.y, 'mooma', true); if (!b) return false; b._r11bBoss = true; b.currentHp = b.maxHp = 9999999; return true; }, BX);
  ok('a boss stands beside Bob on the host', spawned === true);
  const a0 = await aggro(20);
  ok('Bob, nearest and playing, holds the boss', a0 === ids.B, { a0, ids });
  await ev(B, () => { game.paused = true; });
  const t0 = Date.now();
  const pz = await until(A, (b) => ({ ok: !!(net.peers[b] && net.peers[b]._pz), v: !!(net.peers[b] && net.peers[b]._pz) }), ids.B, 3000);
  ok('Bob pauses: the host learns it at once (pz), mid-boss (was: only "aw" after 20 s, never with a boss up)', pz === true, { pz, ms: Date.now() - t0 });
  const a1 = await aggro(20);
  ok('...and the boss leaves the paused Bob for Cid, who is playing (was: Bob soaked it)', a1 === ids.C, { a1, ids });
  await ev(C, () => { game.paused = true; });
  await until(A, (c) => ({ ok: !!(net.peers[c] && net.peers[c]._pz), v: 0 }), ids.C, 3000);
  const a2 = await ev(A, () => { player._downed = true; return 0; }).then(() => aggro(10)).finally(() => ev(A, () => { player._downed = false; }));
  ok('with Ann down and both partners paused, nobody else can be fought: the paused partners stay targets (the old rule)', a2 === ids.B || a2 === ids.C, { a2 });
  for (const P of [B, C]) await ev(P, () => { game.paused = false; });
  const unp = await until(A, ({ b, c }) => { const v = !net.peers[b]._pz && !net.peers[c]._pz; return { ok: v, v }; }, { b: ids.B, c: ids.C }, 3000);
  const a3 = await aggro(30);
  ok('back from the menus (pz:0), Bob is a target again', unp === true && a3 === ids.B, { unp, a3 });
  await ev(A, () => { game.monsters.length = 0; });

  // ---------------- EXP: a kill beside Bob; Ann far, then Ann beside it (Cid stays far) ----------------
  const KX = BC - 150 - 14;   // the kill spot: beside Bob
  await place(A, 150); await place(C, 150); await place(B, KX);
  await sleep(900);
  const killNear = async (label) => {
    const u = await ev(A, (kx) => { game.monsters.length = 0; const m = spawnMonster(kx + 20, player.y, 'slime', false, false); m.exp = 1000; m.mojicoins = 0; m.level = 40; m._r11b = 1; return m.uid; }, KX);
    await ev(A, (u) => { const m = game.monsters.find((q) => q.uid === u); const bp = Object.values(net.peers).find((p) => p && p.name === 'Bob'); if (m && bp) m.y = bp.y; }, u);
    await until(B, (u) => ({ ok: game.monsters.some((q) => q.uid === u), v: 0 }), u, 6000);
    await ev(B, (u) => { player.level = 40; player.expToNext = 1e12; game.mapKillStreak = 0; player._ksTier = 0; _lxCoopRewardNote({ uid: u, type: 'slime', exp: 1000, mojicoins: 0, level: 40 }); window.__e0 = player.exp || 0; }, u);
    const hostMul = await ev(A, (u) => { const m = game.monsters.find((q) => q.uid === u); const k = _coopXpMul(m); game.combo = 0; m.currentHp = 0; killMonster(m); return k; }, u);
    const got = await until(B, () => { const v = (player.exp || 0) - window.__e0; return { ok: v > 0, v }; }, null, 6000);
    return { hostMul, got };
  };
  const far = await killNear('far');
  await place(A, KX - 20); await sleep(900);
  const near = await killNear('near');
  ok('Ann far from the kill: the host pays itself no party bonus (was x2 for Bob standing there)', far.hostMul === 1, far);
  ok('Ann beside the kill with Bob: the host bonus is x2', near.hostMul === 2, near);
  ok('Bob\'s share with the runner far is the base share, with the runner beside him x2 (was x2 both times)', far.got > 0 && Math.abs(near.got / far.got - 2) < 0.02, { far: far.got, near: near.got });

  // ---------------- CAP: the relay's party-room cap (default 5) and the game's room_full path ----------------
  const ROOM2 = ('cap' + Math.floor(Math.random() * 1e6)) + '__ch1';
  const five = []; for (let i = 0; i < 5; i++) five.push(await rawJoin(WS, ROOM2, 'raw' + i));
  ok('five players fill a party room', five.every((j) => j.first && j.first.t === 'welcome'), five.map((j) => j.first && j.first.t));
  const sixth = await rawJoin(WS, ROOM2, 'raw5');
  ok('a sixth gets the worker\'s error{code:"room_full"} and is closed (4001), never welcomed', sixth.first && sixth.first.t === 'error' && sixth.first.code === 'room_full' && /is full \(5 players\)/.test(sixth.first.message || '') && sixth.close === 4001, { first: sixth.first, close: sixth.close });
  const lob = []; for (let i = 0; i < 6; i++) lob.push(await rawJoin(WS, 'lobby__ch5', 'lob' + i));
  ok('a public lobby channel takes six (its cap is 50)', lob.every((j) => j.first && j.first.t === 'welcome'));
  for (const j of lob) try { j.s.close(); } catch (e) {}
  await ev(C, () => { try { mpDisconnect(); } catch (e) {} });
  await sleep(400);
  await ev(C, (r) => { net._userClosed = false; mpConnect(r.ws, 'Cid', r.room); }, { ws: WS, room: ROOM2.replace(/__ch1$/, '') });
  const full = await until(C, () => { const st = ((document.getElementById('mp-banner') || {}).textContent || '') + ' | ' + ((document.getElementById('mp-status') || {}).textContent || ''); const v = { closed: !!net._userClosed, connected: !!net.connected, timer: !!net._reconnectTimer, st: st.slice(0, 90) }; return { ok: v.closed && /is full/.test(v.st), v }; }, null, 6000);
  ok('the game joining a full party room says it is full and does not re-dial', full.closed && !full.connected && !full.timer && /is full/.test(full.st), full);
  try { five[0].s.close(); } catch (e) {}
  await sleep(400);
  await ev(C, (r) => { net._userClosed = false; mpConnect(r.ws, 'Cid', r.room); }, { ws: WS, room: ROOM2.replace(/__ch1$/, '') });
  const joined = await until(C, () => ({ ok: !!net.connected && net.myId != null, v: !!net.connected }), null, 6000);
  ok('once a seat frees, the same join goes through', joined === true);
  for (const j of five) try { j.s.close(); } catch (e) {}
  const PORT2 = PORT + 1; await startRelay(PORT2, { ROOM_CAP: '2' });
  const two = [await rawJoin(`ws://localhost:${PORT2}`, 'small__ch1', 'a'), await rawJoin(`ws://localhost:${PORT2}`, 'small__ch1', 'b'), await rawJoin(`ws://localhost:${PORT2}`, 'small__ch1', 'c')];
  ok('ROOM_CAP=2 in the environment: the third is refused', two[0].first && two[0].first.t === 'welcome' && two[1].first && two[1].first.t === 'welcome' && two[2].first && two[2].first.code === 'room_full', two.map((j) => j.first && (j.first.code || j.first.t)));
  for (const j of two) try { j.s.close(); } catch (e) {}
  const errs = [A, B, C].flatMap((p) => p._errors);
  ok('no page errors', errs.length === 0, errs.slice(0, 4));
} finally {
  await browser.close().catch(() => {});
  for (const r of relays) { try { r.kill(); } catch (e) {} }
}
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
