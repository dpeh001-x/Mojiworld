// Co-op: who runs which world (per user: "monsters dont seem to die properly in pq for players in coop mode, same goes with
// expedition" / "also it caused disconnection issues"). Three real clients on the relay (mp/server.mjs, started here):
//   1. the room's lowest id stays in town; the other two fight in the Ticket Rush lobby - they share ONE world (one runs it,
//      the other mirrors it) and a mech one of them kills dies on both screens. (Before: each ran a private copy.)
//   2. the runner walks out: the partner inherits the SAME monsters (every uid it saw is still there, now its own) - nothing
//      resets. (A superset is fine: the lobby refills the mech killed in step 1 some 1.1-2.4 s later, and when that lands just
//      before the runner leaves the partner inherits it too - an exact-set compare failed 1 run in ~15, most likely that way.)
//   3. the lowest id walks back in: it adopts the world that is running there instead of replacing it with its own.
//   4. an expedition run on a floor whose map a partner is standing on in the open world is a world of its own: no mirrors
//      of the open world, the partner knows it is elsewhere (xi), and the runner clears the floor (Bravo ready).
// The build before fails every check but "no page errors".   node scripts/coop_worlds_test.mjs    PORT / MOJI_GAME_FILE override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11931), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 300) + ']' : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const relay = spawn(process.execPath, [path.join(ROOT, 'mp', 'server.mjs')], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await sleep(1500);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const errs = [];
const boot = async (name) => {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(name + ': ' + String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof net === 'object' && typeof mpConnect === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.evaluate((nm) => {
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior'); player.level = 45; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    if (player.look) player.look.name = nm; game.paused = false; window._god = true; player.invulnerable = 1e9; window.triggerDeath = function () {};
    // headless throttles rAF: pump the game's own outbound ticks (inbound handling runs on the socket as in play)
    window.__pump = setInterval(() => { player.invulnerable = 1e9; try { _mpTick(); } catch (e) {} try { _coopTickMonsters(); } catch (e) {} }, 40);
  }, name);
  return page;
};
const view = (p) => p.evaluate(() => ({ map: game.currentMap, host: net.isHost, follow: _coopFollowingHost(),
  mons: (game.monsters || []).filter((m) => m && m.currentHp > 0 && !m.ally && !m.isSummon).map((m) => [m.uid, m._coopMirror ? 1 : 0, Math.round(m.currentHp)]) }));
const uids = (v) => v.mons.map((m) => m[0]).sort((a, b) => a - b).join(',');
const has = (v, list) => { const a = new Set(v.mons.map((m) => m[0])); return list.split(',').filter(Boolean).every((u) => a.has(+u)); };   // every uid of list still in view v
const killAll = (p) => p.evaluate(async () => { for (let r = 0; r < 60; r++) { const live = game.monsters.filter((m) => m && m.currentHp > 0 && !m.ally && !m.isSummon); if (!live.length) break;
  for (const m of live) try { hitMonster(m, (m.maxHp || m.currentHp) * 3, false, 'probe'); } catch (e) {} await new Promise((r2) => setTimeout(r2, 60)); } });
try {
  const ROOM = 'worlds' + Math.floor(Math.random() * 1e6), WS = `ws://localhost:${PORT}`;
  const P = [];
  for (const nm of ['Ann', 'Ben', 'Cat']) { const p = await boot(nm); await p.evaluate(({ ws, room, nm }) => mpConnect(ws, nm, room), { ws: WS, room: ROOM, nm }); await p.waitForFunction(() => net.myId != null, null, { timeout: 10000 }); P.push(p); }
  const [A, B, C] = P;   // ids ascend in join order: Ann is the room's lowest id (the old room-wide host)
  await sleep(1500);
  // ---- 1 ----
  await A.evaluate(() => loadMap('town'));
  await B.evaluate(() => loadMap('clockworkUnderpassLobby')); await sleep(2200);
  await C.evaluate(() => loadMap('clockworkUnderpassLobby')); await sleep(2500);
  let b = await view(B), c = await view(C);
  ok('1. two players in the PQ lobby while the room host is in town share ONE world', b.mons.length > 0 && uids(b) === uids(c) && b.host !== c.host
    && (b.host ? c : b).mons.every((m) => m[1]), { B: { host: b.host, n: b.mons.length }, C: { host: c.host, n: c.mons.length }, same: uids(b) === uids(c) });
  const tgt = c.mons.find((m) => m[2] > 1);
  // a booked mech (a ticket shield, with two players on the map) is punched through as a pair, in turn, before the kill
  if (tgt) {
    const bh = b.host ? B : C;   // the host books mechs on its next party tick (<= 700 ms) AFTER it first sees the partner: wait for that
    for (const t0 = Date.now();;) { const n = await bh.evaluate(() => (typeof _lxPqParty === 'function' ? _lxPqParty().n : 2)); if (n >= 2 || Date.now() - t0 > 6000) break; await sleep(150); }
    await sleep(900);
    const bk = await bh.evaluate((u) => { const m = game.monsters.find((x) => x && x.uid === u); return m ? (m._pqBooked | 0) : 0; }, tgt[0]);
    if (bk === 1) for (const p of [C, B, C]) { await p.evaluate((u) => { const m = game.monsters.find((x) => x && x.uid === u); if (m) { m.evasion = 0; player._lxSureHit = true; try { hitMonster(m, 1, false, 'probe'); } finally { player._lxSureHit = false; } } }, tgt[0]); await sleep(250); }
  }
  if (tgt) await C.evaluate((u) => { const m = game.monsters.find((x) => x && x.uid === u); for (let i = 0; i < 20 && m && m.currentHp > 0; i++) hitMonster(m, (m.maxHp || m.currentHp) * 3, false, 'probe'); }, tgt[0]);
  await sleep(1200);
  b = await view(B); c = await view(C);
  ok('1. a mech one of them kills dies on BOTH screens', !!tgt && !b.mons.some((m) => m[0] === tgt[0]) && !c.mons.some((m) => m[0] === tgt[0]), { uid: tgt && tgt[0] });
  // ---- 2 ----
  const runner = b.host ? B : C, stayer = b.host ? C : B;
  const before = uids(await view(stayer));
  await runner.evaluate(() => loadMap('town')); await sleep(2500);
  const st = await view(stayer);
  ok('2. the runner walks out: the partner inherits the SAME monsters and runs them', st.host && st.mons.length > 0 && !!before && has(st, before) && st.mons.every((m) => !m[1]), { host: st.host, kept: has(st, before), before, after: uids(st) });
  // ---- 3 ----
  const run0 = uids(st);
  await A.evaluate(() => loadMap('clockworkUnderpassLobby')); await sleep(2500);
  const a3 = await view(A), s3 = await view(stayer);
  ok('3. the lowest id walks in: it adopts the running world instead of replacing it', !a3.host && s3.host && has(s3, run0) && has(a3, run0) && a3.mons.every((m) => m[1]), { annHost: a3.host, kept: has(s3, run0), mirrored: has(a3, run0) });
  // ---- 4 ----
  for (const p of [A, B, C]) await p.evaluate(() => loadMap('town')); await sleep(800);
  const M = await B.evaluate(() => { player.level = 70; _startExpedition(); return game.currentMap; }); await sleep(800);
  await A.evaluate((m) => loadMap(m), M); await sleep(2500);
  const b4 = await view(B);
  ok('4. an expedition floor beside the open world on the same map is a world of its own', b4.mons.length > 0 && b4.mons.every((m) => !m[1]) && !b4.follow, { map: M, n: b4.mons.length, mirrors: b4.mons.filter((m) => m[1]).length, follow: b4.follow });
  const seen = await A.evaluate(() => { const p = Object.values(net.peers).find((q) => q && q.name === 'Ben'); return p ? { xi: p.xi || '', map: p.map } : null; });
  ok('4. the partner in the open world knows the runner is elsewhere', !!seen && !!seen.xi, seen);
  await killAll(B); await sleep(2500);
  const fl = await B.evaluate(() => ({ alive: (game.monsters || []).filter((m) => m && m.currentHp > 0 && !m.ally).length, bravo: !!(game.expedition && game.expedition.bravoReady) }));
  ok('4. the runner clears the floor (every foe dead, Bravo ready)', fl.bravo === true && fl.alive === 0, fl);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); relay.kill();
console.log((fail ? 'FAIL(' + fail + ')' : 'PASS(0)') + ' - ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
