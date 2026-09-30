// Co-op from BOTH players' seats (per user, after v0.30.1443: "test and see that this is working well for both players coop
// independently"). Two real clients on the relay (mp/server.mjs, started here). Every check reads BOTH screens, and the two
// players take turns as the one who lands the kill:
//   1. PQ: the higher id gets there first and runs it, the lower id walks in and follows; each kill leaves both screens and
//      stays gone, both players' EXP and PQ progress move on every kill, and damage either player deals shows on both.
//   2. PQ, both attacking at once for FIGHT_S s: no monster alive on one screen and dead on the other, none comes back, the
//      runner never changes, PQ progress ends equal.
//   3. Apart, independently: each on its own field map runs its own world (no mirrors, kills stay dead and pay EXP, its
//      spawner refills a cleared map) and receives no monster frames from the other.
//   4. Meeting: one walks into the other's fight and adopts it; both kill, both see it.
//   5. Expeditions at the same moment: both runs start on tower_b1, each its own world; each player clears its own floor.
//   6. One in an expedition, one in the open world on the same map: each clears its own, no crossover.
//   7. The whole run: no socket closed, no reconnect, no page errors.
// v0.30.1444: 25/25 locally (either seat order) and LIVE; the build before v0.30.1443 passes 16 - with two players both on
// the room host's map the old sync was already sound (1-2), but apart the second player's world streamed from the first,
// the partner's expedition floor never cleared, a kill in one run killed the same-numbered monster in the other, and an
// expedition clear wiped the open-world monsters of the partner standing on that map.
//   node scripts/coop_both_players_test.mjs      PORT / MOJI_GAME_FILE / FIGHT_S override; FIRST=Ann swaps the PQ seats (the
//   lower id gets there first and runs it); LIVE=1 plays the deployed site on the deployed relay (a private room; no local
//   server) - LIVE_URL / LIVE_WS override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11971), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const FIGHT_S = Number(process.env.FIGHT_S || 30), FIRST = process.env.FIRST === 'Ann' ? 'Ann' : 'Ben', LIVE = process.env.LIVE === '1';
const PAGE = LIVE ? (process.env.LIVE_URL || 'https://play.moji-studios.com/mojiworld_game.html') : `http://localhost:${PORT}/${FILE}`;
const WS = LIVE ? (process.env.LIVE_WS || 'wss://mojiworld-mp.dpeh001.workers.dev') : `ws://localhost:${PORT}`;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 360) + ']' : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 4000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v || Date.now() - t0 > ms) return v; await sleep(100); } };
const relay = LIVE ? null : spawn(process.execPath, [path.join(ROOT, 'mp', 'server.mjs')], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
if (relay) await sleep(1500);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const errs = [];
const boot = async (name) => {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(name + ': ' + String(e.message).slice(0, 160)));
  await page.goto(PAGE, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof net === 'object' && typeof mpConnect === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.evaluate((nm) => {
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior'); player.level = 45; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    if (player.look) player.look.name = nm; game.paused = false; window._god = true; player.invulnerable = 1e9; window.triggerDeath = function () {};
    window.__pump = setInterval(() => { player.invulnerable = 1e9; try { _mpTick(); } catch (e) {} try { _coopTickMonsters(); } catch (e) {} }, 40);
    // the run's watch, on this player's own screen: socket closes, runner flips, monster frames by sender, uids that come back
    window.__w = { closes: 0, flips: 0, monFrom: {}, back: [], dead: new Set(), was: new Set(), track: false };
    let host = null;
    window.__watch = setInterval(() => { const w = window.__w;
      if (net.ws && !net.ws.__w) { net.ws.__w = 1; net.ws.addEventListener('close', () => { w.closes++; }); }
      if (host !== null && !!net.isHost !== host) w.flips++; host = !!net.isHost;
      if (!w.track) return;
      const now = new Set(); for (const m of game.monsters || []) if (m && m.uid != null && m.currentHp > 0 && !m.ally && !m.isSummon) now.add(m.uid);
      for (const u of now) if (w.dead.has(u) && w.back.length < 20) w.back.push(u);
      for (const u of w.was) if (!now.has(u)) w.dead.add(u);
      w.was = now; }, 50);
    const oh = _mpHandle; window._mpHandle = function (msg) { if (msg && msg.t === 'mon') window.__w.monFrom[msg.id] = (window.__w.monFrom[msg.id] || 0) + 1; return oh.apply(this, arguments); };
  }, name);
  return page;
};
const view = (p) => p.evaluate(() => ({ map: game.currentMap, host: !!net.isHost, follow: _coopFollowingHost(), inst: (typeof _coopInst === 'function') ? _coopInst() : '',
  mons: (game.monsters || []).filter((m) => m && m.currentHp > 0 && !m.ally && !m.isSummon).map((m) => [m.uid, m._coopMirror ? 1 : 0, Math.round(m.currentHp)]) }));
const liveUids = (p) => p.evaluate(() => (game.monsters || []).filter((m) => m && m.uid != null && m.currentHp > 1 && !m.ally && !m.isSummon && !(m.invulnerable > 0)).map((m) => m.uid));
const common = async (P, Q) => { const q = new Set(await liveUids(Q)); return (await liveUids(P)).filter((u) => q.has(u)); };
// a sure hit: the swing cannot miss or be dodged on the hitter's own screen (the wire is what is tested, not the accuracy roll).
// frac >= 1 is a KILL: swing again (60 ms apart, up to 6) until it is down on this screen - defence and the level gap cut
// even 3x its HP to less than a Lv 50 tower wisp's 21,990 (measured: 20,564 dealt), as they would a player's hit
const hitUid = (p, u, frac) => p.evaluate(async ({ u, frac }) => {
  for (let i = 0; i < (frac >= 1 ? 6 : 1); i++) {
    const m = (game.monsters || []).find((x) => x && x.uid === u && x.currentHp > 0); if (!m) return i > 0;
    m.evasion = 0; m.traits = null; player._lxSureHit = true;
    try { hitMonster(m, Math.max(1, Math.floor(Math.max(m.maxHp || 0, m.currentHp) * frac)), false, 'both'); } finally { player._lxSureHit = false; }
    if (frac >= 1) await new Promise((r) => setTimeout(r, 60));
  }
  return true; }, { u, frac });
const gone = (p, u) => p.evaluate((u) => !(game.monsters || []).some((m) => m && m.uid === u && m.currentHp > 0), u);
const hpOf = (p, u) => p.evaluate((u) => { const m = (game.monsters || []).find((x) => x && x.uid === u); return m ? Math.round(m.currentHp) : null; }, u);
const stat = (p) => p.evaluate(() => { const q = player.quests && player.quests.active && player.quests.active.q_clockwork_underpass; return { lvl: player.level | 0, exp: player.exp || 0, prog: q ? (q.progress | 0) : null }; });
const gained = (a, b) => b.lvl > a.lvl || (b.lvl === a.lvl && b.exp > a.exp);
const killAll = (p) => p.evaluate(async () => { for (let r = 0; r < 60; r++) { const live = game.monsters.filter((m) => m && m.currentHp > 0 && !m.ally && !m.isSummon); if (!live.length) break;
  for (const m of live) { m.evasion = 0; m.traits = null; player._lxSureHit = true; try { hitMonster(m, (m.maxHp || m.currentHp) * 3, false, 'both'); } catch (e) {} player._lxSureHit = false; }
  await new Promise((r2) => setTimeout(r2, 60)); } });
// kill one monster both screens show; say where it went and whether it stayed gone
const turn = async (killer, P, Q) => {
  const u = (await common(P, Q))[0]; if (u == null) return { u: null };
  await hitUid(killer, u, 3);
  const g = await until(async () => (await gone(P, u)) && (await gone(Q, u)));
  let stayed = !!g; for (let i = 0; i < 10 && stayed; i++) { await sleep(200); stayed = (await gone(P, u)) && (await gone(Q, u)); }
  return { u, gone: !!g, stayed };
};
const aliveSet = (p) => p.evaluate(() => (game.monsters || []).filter((m) => m && m.uid != null && m.currentHp > 0 && !m.ally && !m.isSummon).map((m) => m.uid).sort((a, b) => a - b).join(','));
// three kills on this player's own screen: each gone, still gone 1 s later, EXP paid
const solo = async (p, pick) => { const res = []; for (let i = 0; i < 3; i++) { const s0 = await stat(p); const u = pick ? pick[i] : (await liveUids(p))[0]; if (u == null) break;
  await hitUid(p, u, 3); const g = await until(() => gone(p, u), 2000); let stayed = !!g; for (let k = 0; k < 5 && stayed; k++) { await sleep(200); stayed = await gone(p, u); }
  res.push({ u, g: !!g, stayed, paid: gained(s0, await stat(p)) }); } return res; };
try {
  const A = await boot('Ann'), B = await boot('Ben');
  const ROOM = 'both' + Math.floor(Math.random() * 1e9).toString(36);
  for (const [p, nm] of [[A, 'Ann'], [B, 'Ben']]) { await p.evaluate(({ ws, room, nm }) => mpConnect(ws, nm, room), { ws: WS, room: ROOM, nm }); await p.waitForFunction(() => net.myId != null, null, { timeout: 10000 }); }
  await sleep(1500);
  const ids = { Ann: await A.evaluate(() => net.myId), Ben: await B.evaluate(() => net.myId) };
  // ---- 1 ----
  for (const p of [A, B]) await p.evaluate(() => { try { acceptQuest('q_clockwork_underpass'); } catch (e) {} });
  const R = FIRST === 'Ann' ? A : B, Fo = FIRST === 'Ann' ? B : A, rn = FIRST, fn = FIRST === 'Ann' ? 'Ben' : 'Ann';   // the runner's seat and the follower's
  await R.evaluate(() => loadMap('clockworkUnderpassLobby')); await sleep(2500);
  await Fo.evaluate(() => loadMap('clockworkUnderpassLobby'));
  const met = await until(async () => (await R.evaluate(() => net.isHost)) && (await Fo.evaluate(() => !net.isHost && _coopFollowingHost() && game.monsters.some((m) => m._coopMirror))), 6000);
  ok(`1. PQ: ${rn} got there first and runs it; ${fn} walked in and follows that world (ids ${ids.Ann} Ann, ${ids.Ben} Ben)`, !!met, ids);
  const turns = [];
  for (let i = 0; i < 6; i++) {
    const killer = i % 2 ? Fo : R, who = i % 2 ? fn : rn;
    const s0 = { A: await stat(A), B: await stat(B) };
    const r = await turn(killer, A, B);
    if (r.u == null) { turns.push({ who, u: null }); break; }
    const paid = await until(async () => gained(s0.A, await stat(A)) && gained(s0.B, await stat(B)), 3000);   // the partner's share rides the kill frame
    const s1 = { A: await stat(A), B: await stat(B) };
    turns.push({ who, u: r.u, gone: r.gone, stayed: r.stayed, paid: !!paid, pA: s1.A.prog - s0.A.prog, pB: s1.B.prog - s0.B.prog });
  }
  const tj = turns.map((t) => `${t.who}:${t.u}${t.gone ? '' : ' STILL-UP'}${t.stayed ? '' : ' BACK'}${t.paid ? '' : ' UNPAID'} +${t.pA}/+${t.pB}`);
  ok('1. every kill, whoever lands it, leaves BOTH screens within 4 s', turns.length === 6 && turns.every((t) => t.u != null && t.gone), tj);
  ok('1. no killed monster comes back on either screen (2 s watch after each)', turns.every((t) => t.stayed), tj);
  ok('1. both players earn EXP from every kill, whoever lands it', turns.every((t) => t.paid), tj);
  ok('1. both players\' PQ progress moves together - the same step on every kill', turns.every((t) => t.pA === t.pB) && turns.some((t) => t.pA > 0), tj);
  const [dA, dB] = await common(A, B); let dmg = null;
  if (dA != null && dB != null) {
    const h0 = await hpOf(R, dA); await hitUid(Fo, dA, 0.25);   // the follower bloodies one...
    const onRunner = await until(async () => { const h = await hpOf(R, dA); return h != null && h < h0 ? h : null; });
    const back = onRunner != null && !!(await until(async () => Math.abs((await hpOf(Fo, dA)) - (await hpOf(R, dA))) <= 2));
    const g0 = await hpOf(Fo, dB); await hitUid(R, dB, 0.25);   // ...and the runner bloodies another
    const onFollower = await until(async () => { const h = await hpOf(Fo, dB); return h != null && h < g0 ? h : null; });
    dmg = { [fn + 'Hit']: [h0, onRunner, back], [rn + 'Hit']: [g0, onFollower] };
  }
  ok('1. damage either player deals shows on BOTH screens', !!dmg && dmg[fn + 'Hit'][1] != null && dmg[fn + 'Hit'][2] && dmg[rn + 'Hit'][1] != null, dmg);
  // ---- 2 ----
  for (const p of [A, B]) await p.evaluate(() => { const w = window.__w; w.back = []; w.dead = new Set(); w.was = new Set(); w.track = true; w.flips = 0;
    window.__fight = setInterval(() => { const live = (game.monsters || []).filter((m) => m && m.currentHp > 1 && !m.ally && !m.isSummon && !(m.invulnerable > 0));
      if (!live.length) return; const m = live[Math.floor(Math.random() * live.length)]; m.evasion = 0; m.traits = null; player._lxSureHit = true;
      try { hitMonster(m, Math.max(1, Math.floor((m.maxHp || m.currentHp) * 0.18)), Math.random() < 0.2, 'both'); } catch (e) {} player._lxSureHit = false; }, 120); });
  const p0 = await stat(A);
  await sleep(FIGHT_S * 1000);
  for (const p of [A, B]) await p.evaluate(() => clearInterval(window.__fight));
  const same = await until(async () => (await aliveSet(A)) === (await aliveSet(B)), 5000);
  const wat = async (p) => p.evaluate(() => { const w = window.__w; w.track = false; return { died: w.dead.size, back: w.back, flips: w.flips }; });
  const w2 = { Ann: await wat(A), Ben: await wat(B) };
  const progEq = await until(async () => { const a = await stat(A), b = await stat(B); return a.prog === b.prog ? [a.prog, b.prog] : null; }, 4000);
  ok(`2. PQ, both attacking for ${FIGHT_S} s (${w2.Ben.died} died on Ben's screen, ${w2.Ann.died} on Ann's): afterwards both screens hold exactly the same live monsters`, !!same && w2[rn].died > 10, { Ann: (await aliveSet(A)).slice(0, 100), Ben: (await aliveSet(B)).slice(0, 100) });
  ok('2. no monster that died came back on either screen', !w2.Ann.back.length && !w2.Ben.back.length, { Ann: w2.Ann.back, Ben: w2.Ben.back });
  ok('2. the runner never changed during the fight', !w2.Ann.flips && !w2.Ben.flips, { Ann: w2.Ann.flips, Ben: w2.Ben.flips });
  ok('2. PQ progress ends equal on both, and it moved', !!progEq && (progEq[0] == null || progEq[0] > (p0.prog | 0)), { before: p0.prog, after: progEq });
  // ---- 3 ----
  await A.evaluate(() => loadMap('glasswindSteppe')); await B.evaluate(() => loadMap('stormCrest')); await sleep(3000);
  for (const p of [A, B]) await p.evaluate(() => { window.__w.monFrom = {}; });
  const a3 = await view(A), b3 = await view(B);
  ok('3. apart: each player runs its own map - runner of its own world, no mirrors, monsters up', a3.host && b3.host && a3.mons.length > 0 && b3.mons.length > 0
    && a3.mons.every((m) => !m[1]) && b3.mons.every((m) => !m[1]), { Ann: [a3.map, a3.host, a3.mons.length], Ben: [b3.map, b3.host, b3.mons.length] });
  const [ra, rb] = await Promise.all([solo(A), solo(B)]);
  ok('3. apart, both at once: each player\'s own kills stay dead and pay EXP', ra.length === 3 && rb.length === 3 && [...ra, ...rb].every((r) => r.g && r.stayed && r.paid), { Ann: ra, Ben: rb });
  await Promise.all([killAll(A), killAll(B)]);
  const refill = await until(async () => { const a = (await view(A)).mons.length, b = (await view(B)).mons.length; return a > 0 && b > 0 ? { Ann: a, Ben: b } : null; }, 15000);
  ok('3. apart: each player\'s own spawner refills its map after a clear', !!refill, refill);
  const heard = { Ann: await A.evaluate(() => window.__w.monFrom), Ben: await B.evaluate(() => window.__w.monFrom) };
  ok('3. apart: neither receives a monster frame from the other (a runner alone streams nothing)', !Object.keys(heard.Ann).length && !Object.keys(heard.Ben).length, heard);
  // ---- 4 ----
  await B.evaluate(() => loadMap('glasswindSteppe'));
  const adopted = await until(async () => { const a = await view(A), b = await view(B);
    return a.host && !b.host && b.follow && b.mons.length > 0 && b.mons.every((m) => m[1] && a.mons.some((x) => x[0] === m[0])); }, 6000);
  ok('4. meeting: Ben walks into Ann\'s fight and adopts her world (her monsters, her uids, nothing of his own)', !!adopted);
  const k4 = [await turn(B, A, B), await turn(A, A, B)];
  ok('4. meeting: Ben kills one, then Ann kills one - each leaves both screens and stays gone', k4.every((t) => t.u != null && t.gone && t.stayed), k4);
  // ---- 5 ----
  for (const p of [A, B]) await p.evaluate(() => loadMap('town')); await sleep(1500);
  const M5 = await Promise.all([A, B].map((p) => p.evaluate(() => { _startExpedition(); return game.currentMap; })));
  await sleep(3000);
  const a5 = await view(A), b5 = await view(B);
  const peerXi = (p) => p.evaluate(() => { const q = Object.values(net.peers)[0]; return q ? (q.xi || '') : null; });
  ok('5. both start an expedition at the same moment: same floor map, two worlds, each player running its own', M5[0] === M5[1] && a5.map === b5.map && !!a5.inst && !!b5.inst
    && a5.inst !== b5.inst && a5.host && b5.host && a5.mons.length > 0 && b5.mons.length > 0 && a5.mons.every((m) => !m[1]) && b5.mons.every((m) => !m[1]),
    { maps: M5, inst: [a5.inst, b5.inst], host: [a5.host, b5.host], n: [a5.mons.length, b5.mons.length] });
  const xi5 = { Ann: await peerXi(A), Ben: await peerXi(B) };
  ok('5. each knows the other is in another world (so neither mirrors, hits into or draws the other)', xi5.Ann === b5.inst && xi5.Ben === a5.inst, xi5);
  // the same uid numbers exist in both worlds: Ann kills three of them in hers, Ben's must all live on
  const bOnly = new Set(await liveUids(B)), pick5 = (await liveUids(A)).filter((u) => bOnly.has(u)).slice(0, 3);
  const r5 = await solo(A, pick5); await sleep(1000); const bLive = new Set(await liveUids(B));
  ok('5. Ann\'s kills stay dead in her run, and Ben\'s monsters with the same numbers live on in his', r5.length === 3 && r5.every((r) => r.g && r.stayed) && pick5.every((u) => bLive.has(u)), { Ann: r5, BenStillHas: pick5.filter((u) => bLive.has(u)) });
  await Promise.all([killAll(A), killAll(B)]); await sleep(2500);
  const fl = (p) => p.evaluate(() => ({ alive: (game.monsters || []).filter((m) => m && m.currentHp > 0 && !m.ally && !m.isSummon).length, bravo: !!(game.expedition && game.expedition.bravoReady) }));
  const f5 = { Ann: await fl(A), Ben: await fl(B) };
  ok('5. each player clears its own floor (every foe dead, Bravo ready) - both of them', f5.Ann.bravo && f5.Ben.bravo && !f5.Ann.alive && !f5.Ben.alive, f5);
  // ---- 6 ----
  for (const p of [A, B]) await p.evaluate(() => { try { _endExpedition('abandon'); } catch (e) {} });
  await sleep(3000);
  for (const p of [A, B]) await p.evaluate(() => { try { if (typeof closeAllModals === 'function') closeAllModals(); } catch (e) {} game.paused = false; if (game.currentMap !== 'town') loadMap('town'); });
  await sleep(1500);
  const M6 = await A.evaluate(() => { _startExpedition(); return game.currentMap; }); await sleep(800);
  await B.evaluate((m) => loadMap(m), M6); await sleep(3000);
  const a6 = await view(A), b6 = await view(B);
  ok('6. Ann in an expedition, Ben in the open world on the same map: two worlds, each player running its own', a6.map === b6.map && !!a6.inst && !b6.inst && a6.host && b6.host
    && a6.mons.length > 0 && b6.mons.length > 0 && a6.mons.every((m) => !m[1]) && b6.mons.every((m) => !m[1]), { map: [a6.map, b6.map], inst: [a6.inst, b6.inst], host: [a6.host, b6.host], n: [a6.mons.length, b6.mons.length] });
  const aHas6 = new Set(await liveUids(A)), pick6 = (await liveUids(B)).filter((u) => aHas6.has(u)).slice(0, 3);
  const rb6 = await solo(B, pick6); await sleep(1000); const aLive = new Set(await liveUids(A));
  ok('6. Ben\'s open-world kills stay dead and pay him, and Ann\'s run keeps its monsters with the same numbers', rb6.length === 3 && rb6.every((r) => r.g && r.stayed && r.paid) && pick6.every((u) => aLive.has(u)), { Ben: rb6, AnnStillHas: pick6.filter((u) => aLive.has(u)) });
  await killAll(A); await sleep(2500);
  const f6 = await fl(A), b6b = await view(B);
  ok('6. Ann clears her floor (Bravo ready) while Ben\'s open world runs on', f6.bravo && !f6.alive && b6b.host && b6b.mons.length > 0, { Ann: f6, Ben: [b6b.host, b6b.mons.length] });
  // ---- 7 ----
  const end = (p) => p.evaluate(() => ({ closes: window.__w.closes, connected: !!net.connected, retries: net._reconnectTries | 0 }));
  const e7 = { Ann: await end(A), Ben: await end(B) };
  ok('7. the whole run: no socket closed and no reconnect, for either player', !e7.Ann.closes && !e7.Ben.closes && e7.Ann.connected && e7.Ben.connected && !e7.Ann.retries && !e7.Ben.retries, e7);
  ok('7. no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); if (relay) relay.kill();
console.log((fail ? 'FAIL(' + fail + ')' : 'PASS(0)') + ' - ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
