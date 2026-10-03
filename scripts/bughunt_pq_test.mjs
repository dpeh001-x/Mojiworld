// BUG HUNT 2026-10-02, the Ticket Rush cluster: L2d (mech EXP x1.5 flat), diff-c-1, diff-c-6, coop-8, coop-10, coop-12, coop-13.
//   L2d       every PQ mech pays EXACTLY 1.5 x its own baseline EXP, normal and elite, lobby (expressScaling) and Carriage alike, and a
//             re-stat of a living mech never compounds it (the old map factor read an out-of-scope `expMult`, so the mech paid x1)
//   diff-c-1  a co-op guest reads a Carriage mech at the HOST's level (31), never Lv 1 (pinned: already right on the tip)
//   diff-c-6  the Stage 3 pin shows "fight at Lv N" only where the level is party-built (the lobby), "have x1.6 HP" on the Carriage
//   coop-8    allies / same-map count / PQ party match peers by map AND instance (a partner in a private expedition copy is another world)
//   coop-10   a peer's reported ATK / max HP counts for at most 4x mine in the PQ party average
//   coop-12   an open ("OPEN x1.5") mech closes when its 5 s window ends, with no hit and no partner to build frames
//   coop-13   a `pqp` piece message is rate limited (2 a second per sender) and needs a peer in MY world
//   [PORT=n] [SERVE_ROOT=<dir>] node scripts/bughunt_pq_test.mjs [page.html]      (the relay in mp/ serves the repo root and the game)
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '13980';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const FILE = cand ? cand.split(/[\\/]/).pop() : 'mojiworld_game.html';
const EXE = [process.env.PW_EXE, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const URL = `http://localhost:${PORT}/${FILE}`, WS = `ws://localhost:${PORT}`;
const ROOM = 'bhpq' + Math.floor(Math.random() * 1e6);
const results = []; const ok = (n, c, extra) => { results.push({ n, pass: !!c, extra }); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '   ' + JSON.stringify(extra))); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = (p, fn, arg) => p.evaluate(fn, arg);
const until = async (page, fn, arg, ms = 6000) => { const t0 = Date.now(); for (;;) { const r = await page.evaluate(fn, arg); if (r.ok || Date.now() - t0 > ms) return r.v; await sleep(120); } };
const relay = spawn(process.execPath, [path.join(SERVE_ROOT, 'mp', 'server.mjs')], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, PORT } });
for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://localhost:${PORT}/serve.js`); if (r.ok) break; } catch (e) {} await sleep(250); }
async function boot(browser, name) {
  const page = await (await browser.newContext({ serviceWorkers: 'block' })).newPage(); page._errors = [];
  page.on('pageerror', (e) => page._errors.push(String(e).slice(0, 180)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => typeof net === 'object' && typeof game === 'object' && typeof mpConnect === 'function' && typeof _lxPqParty === 'function', null, { timeout: 90000 });
  await page.waitForTimeout(3500);
  await page.evaluate((nm) => { try { player.cls = 'warrior'; if (player.look) player.look.name = nm; game.paused = false; window._prologueActive = false; window._lxBootGateDone = true; player.invulnerable = 999999; player.baseAcc = 500; player.level = 60; player.hp = player.maxHp = 99999; player._tutorialSeen = true; } catch (e) {} }, name);
  return page;
}
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  // =================== PART 1: one page, fake peers, direct calls ===================
  const S = await boot(browser, 'Solo');
  const goTo = (id) => ev(S, async (m) => { game.visitedMaps = game.visitedMaps || {}; game.visitedMaps[m] = true; loadMap(m); await new Promise((r) => setTimeout(r, 1800)); game.paused = false; return game.currentMap; }, id);

  // ---- L2d: the lobby (expressScaling) ----
  await goTo('clockworkUnderpassLobby');
  const lob = await ev(S, () => {
    const out = {}, R = Math.random, net0 = { c: net.connected, p: net.peers };
    const mk = (elite) => { Math.random = () => 0.5; if (elite) net._coopForceElite = true; try { return spawnMonster(300, 200, 'ticketMech'); } finally { Math.random = R; delete net._coopForceElite; } };
    const want = (lv) => { const b = _lxFieldBaseline(lv); return Math.floor(Math.max(1, Math.floor(b.exp)) * 1.5); };
    const baseExp = (lv) => Math.max(1, Math.floor(_lxFieldBaseline(lv).exp));
    const lv = _lxScaledMobLevel(player.level);
    const m = mk(false), e = mk(true);
    out.normal = { exp: m.exp, want: want(lv), base: baseExp(lv), lv: m.level, mech: m._pqMech, elite: !!m.isElite };
    out.elite = { exp: e.exp, want: want(lv), base: baseExp(lv), lv: e.level, mech: e._pqMech, elite: !!e.isElite };
    // re-stat the living mech three times, solo: nothing grows
    const solo = []; for (let i = 0; i < 3; i++) { _lxPqRestatMob(m, _lxPqParty(), false); solo.push(m.exp); }
    out.restatSolo = solo;
    // a partner arrives (level 30): the mech re-builds at Lv 35, its EXP follows the NEW baseline x1.5, twice over the same
    const meAtk = getAtk(), meHp = getMaxHp();
    net.connected = true; net.peers = { 9: { id: 9, map: game.currentMap, xi: '', x: player.x, y: player.y, _last: performance.now(), level: 30, at: meAtk, maxHp: meHp } };
    const duo = []; try { for (let i = 0; i < 3; i++) { _lxPqRestatMob(m, _lxPqParty(), false); duo.push([m.level, m.exp]); } } finally { net.connected = net0.c; net.peers = net0.p; }
    out.restatDuo = { runs: duo, want: want(35) };
    // and when the partner leaves: back to the Lv-60 figure, derived from the baseline (not 1.5 x 1.5 of anything)
    _lxPqRestatMob(m, _lxPqParty(), false);
    out.back = { lv: m.level, exp: m.exp, want: want(lv) };
    return out;
  });
  const n0 = lob.normal, e0 = lob.elite;
  ok('lobby: a normal mech pays exactly 1.5x the same-level baseline EXP', n0.mech === 'x' && !n0.elite && n0.exp === n0.want && n0.want > n0.base, lob.normal);
  ok('lobby: an ELITE mech pays the same flat x1.5 (not the map factor, not less)', e0.mech === 'x' && e0.elite && e0.exp === e0.want, lob.elite);
  ok('lobby: re-stat of a living mech does not compound the x1.5 (three solo re-stats)', lob.restatSolo.every((x) => x === n0.want), lob.restatSolo);
  ok('lobby: a re-stat for a duo (Lv 35) re-derives EXP from the new baseline, stable across repeats', lob.restatDuo.runs.every((r) => r[0] === 35 && r[1] === lob.restatDuo.want), lob.restatDuo);
  ok('lobby: when the partner leaves the mech is back at the Lv-60 figure exactly', lob.back.lv === 60 && lob.back.exp === lob.back.want, lob.back);

  // ---- L2d: the Carriage ----
  await goTo('tower');
  const car = await ev(S, () => {
    const out = {}, R = Math.random;
    const T = LX_MONSTER_STATS.ticketMech, V = LX_MONSTER_VARIANTS.elite;
    const mk = (elite) => { Math.random = () => 0.5; if (elite) net._coopForceElite = true; try { return spawnMonster(300, 200, 'ticketMech'); } finally { Math.random = R; delete net._coopForceElite; } };
    const m = mk(false), e = mk(true);
    const baseN = Math.floor(T.exp), baseE = Math.floor(T.exp * V.exp);
    out.normal = { exp: m.exp, base: baseN, want: Math.floor(baseN * 1.5), pq: m._pqExpBase, mech: m._pqMech, elite: !!m.isElite };
    out.elite = { exp: e.exp, base: baseE, want: Math.floor(baseE * 1.5), pq: e._pqExpBase, mech: e._pqMech, elite: !!e.isElite };
    const runs = []; for (let i = 0; i < 3; i++) { _lxPqRestatMob(m, _lxPqParty(), false); _lxPqRestatMob(e, _lxPqParty(), false); runs.push([m.exp, e.exp]); }
    out.runs = runs;
    const net0 = { c: net.connected, p: net.peers };
    net.connected = true; net.peers = { 9: { id: 9, map: game.currentMap, xi: '', x: player.x, y: player.y, _last: performance.now(), level: 30, at: getAtk(), maxHp: getMaxHp() } };
    try { _lxPqRestatMob(m, _lxPqParty(), false); _lxPqRestatMob(e, _lxPqParty(), false); out.duo = [m.exp, e.exp, m._pqN]; } finally { net.connected = net0.c; net.peers = net0.p; }
    return out;
  });
  ok('Carriage: a normal mech pays exactly 1.5x its own baseline EXP', car.normal.mech === 'c' && !car.normal.elite && car.normal.exp === car.normal.want && car.normal.pq === car.normal.base, car.normal);
  ok('Carriage: an ELITE mech pays 1.5x its (elite-tier) baseline', car.elite.mech === 'c' && car.elite.elite && car.elite.exp === car.elite.want && car.elite.pq === car.elite.base, car.elite);
  ok('Carriage: three re-stats (and a duo re-stat) never grow the EXP', car.runs.every((r) => r[0] === car.normal.want && r[1] === car.elite.want) && car.duo[0] === car.normal.want && car.duo[1] === car.elite.want && car.duo[2] === 2, { runs: car.runs, duo: car.duo });

  // ---- coop-8 / coop-10 on the Carriage (a PQ map) ----
  const key = await ev(S, () => {
    const out = {}, net0 = { c: net.connected, p: net.peers, x: game.expedition, id: net.myId };
    const peer = (o) => Object.assign({ id: 9, map: game.currentMap, x: player.x, y: player.y, _last: performance.now(), level: 40, at: getAtk(), maxHp: getMaxHp() }, o || {});
    const probe = () => ({ same: _lxCoopSameMapCount(), allies: _lxCoopAlliesNear(player.x + player.w / 2, player.y + player.h / 2, null), party: _lxPqParty().n });
    net.connected = true;
    try {
      net.peers = { 9: peer({ xi: '' }) }; out.sameWorld = probe();
      net.peers = { 9: peer({ xi: 'xq1w2.3' }) }; out.theirInstance = probe();      // my partner is in a private expedition copy of this map
      net.peers = { 9: peer({}) }; out.oldBuild = probe();                            // no xi at all (an older build): still the shared world
      game.expedition = { active: true, floor: 1, _coopRun: 'mine' };
      net.peers = { 9: peer({ xi: '' }) }; out.myInstance = probe();                  // I am in an instance, my partner in the open world
      net.peers = { 9: peer({ xi: 'xmine.1' }) }; out.sameInstance = probe();         // we are in the SAME run
      game.expedition = net0.x;
      // coop-10: a spoofed peer cannot size the mechs
      const meAtk = getAtk(), meHp = getMaxHp();
      net.peers = { 9: peer({ xi: '', at: 1e8, maxHp: 1e12 }) }; const bad = _lxPqParty();
      net.peers = { 9: peer({ xi: '', at: meAtk * 2, maxHp: meHp * 2 }) }; const fair = _lxPqParty();
      out.clamp = { badAtk: bad.atk, badHp: bad.hp, meAtk, meHp, fairAtk: fair.atk, fairHp: fair.hp };
      net.peers = { 9: peer({ xi: '', at: 1e8, maxHp: 1e12 }) };
      const R = Math.random; Math.random = () => 0.5; let mm; try { mm = spawnMonster(300, 200, 'ticketMech'); } finally { Math.random = R; }
      out.mechHp = mm.maxHp; out.mechAtk = mm.atk;
    } finally { net.connected = net0.c; net.peers = net0.p; game.expedition = net0.x; }
    return out;
  });
  ok('coop-8: a partner in the shared world counts everywhere (same-map 2, ally 1, party 2) - an older build too', JSON.stringify(key.sameWorld) === '{"same":2,"allies":1,"party":2}' && JSON.stringify(key.oldBuild) === '{"same":2,"allies":1,"party":2}', { sameWorld: key.sameWorld, oldBuild: key.oldBuild });
  ok('coop-8: a partner in a private expedition copy of my map counts for nothing (no EXP bonus, no spawn pressure, no PQ average)', JSON.stringify(key.theirInstance) === '{"same":1,"allies":0,"party":1}', key.theirInstance);
  ok('coop-8: the same holds from my side (I am in an instance, they are in the open world) - and a partner in MY run counts', JSON.stringify(key.myInstance) === '{"same":1,"allies":0,"party":1}' && JSON.stringify(key.sameInstance) === '{"same":2,"allies":1,"party":2}', { myInstance: key.myInstance, sameInstance: key.sameInstance });
  const cl = key.clamp;
  ok('coop-10: a spoofed ATK 1e8 / max HP 1e12 counts as 4x mine (the average is 2.5x), not as itself', Math.abs(cl.badAtk - cl.meAtk * 2.5) < 1 && Math.abs(cl.badHp - cl.meHp * 2.5) < 1, cl);
  ok('coop-10: an honest partner at 2x mine is untouched (the average is 1.5x)', Math.abs(cl.fairAtk - cl.meAtk * 1.5) < 1 && Math.abs(cl.fairHp - cl.meHp * 1.5) < 1, cl);
  ok('coop-10: the mech built beside the spoofer is a normal mech, not a 1e8-ATK wall', key.mechHp < 5e6 && key.mechAtk < 5e6, { hp: key.mechHp, atk: key.mechAtk });

  // ---- coop-12: the open window ----
  const open = await ev(S, () => {
    const out = {}, R = Math.random; Math.random = () => 0.5; let m; try { m = spawnMonster(300, 200, 'ticketMech'); } finally { Math.random = R; }
    const n = performance.now();
    m._pqBooked = 2; m._pqBookDone = true; m._pqOpenUntil = n + 4000; m._netHit = false; game._pqPartyAt = 0; _lxPqPartyTick();
    out.stillOpen = m._pqBooked;
    m._pqOpenUntil = n - 20; game._pqPartyAt = 0; _lxPqPartyTick();
    out.closed = m._pqBooked; out.netHit = !!m._netHit; out.stayedDone = !!m._pqBookDone;
    return out;
  });
  ok('coop-12: an open mech inside its window stays open', open.stillOpen === 2, open);
  ok('coop-12: once the window has run out the party tick closes it (solo, no hit, no partner) and flags it for the wire', open.closed === 0 && open.netHit === true && open.stayedDone === true, open);

  // ---- diff-c-6: the pin text ----
  const pin = await ev(S, async () => {
    const out = {}, net0 = { c: net.connected, p: net.peers }, q0 = player.quests;
    const peer = { 9: { id: 9, map: game.currentMap, xi: '', x: player.x, y: player.y, _last: performance.now(), level: 30, at: getAtk(), maxHp: getMaxHp() } };
    const text = () => { const el = document.getElementById('pq-objective-pin'); return el ? el.textContent : null; };
    player.quests = { active: { q_pq_carriage: { progress: 0 } }, completed: {}, unlocked: {} };
    net.connected = true; net.peers = JSON.parse(JSON.stringify(peer)); net.peers[9]._last = performance.now();
    try { _renderPqObjectivePin(); out.carriage = text(); out.carriageMap = game.currentMap; } finally { net.connected = net0.c; net.peers = net0.p; player.quests = q0; }
    return out;
  });
  ok('diff-c-6: on the Carriage the pin quotes the HP multiplier and no level ("Mechs have x1.6 HP")', typeof pin.carriage === 'string' && /Mechs have x1\.6 HP/.test(pin.carriage) && !/fight at Lv/.test(pin.carriage), pin);
  await goTo('clockworkUnderpassLobby');
  const pin2 = await ev(S, () => {
    const net0 = { c: net.connected, p: net.peers }, q0 = player.quests;
    player.quests = { active: { q_clockwork_underpass: { progress: 0 } }, completed: {}, unlocked: {} };
    net.connected = true; net.peers = { 9: { id: 9, map: game.currentMap, xi: '', x: player.x, y: player.y, _last: performance.now(), level: 30, at: getAtk(), maxHp: getMaxHp() } };
    let t = null; try { _renderPqObjectivePin(); const el = document.getElementById('pq-objective-pin'); t = el ? el.textContent : null; } finally { net.connected = net0.c; net.peers = net0.p; player.quests = q0; }
    return t;
  });
  ok('diff-c-6: in the lobby (party-built level) the pin still says "Mechs fight at Lv 35, x1.6 HP"', typeof pin2 === 'string' && /Mechs fight at Lv 35, x1\.6 HP/.test(pin2), pin2);

  // ---- coop-13: pqp ----
  await ev(S, () => { player.quests = player.quests || {}; player.quests.active = player.quests.active || {}; player.quests.active.q_pq_spire = { progress: 0 }; });
  await goTo('clockworkSpire');
  const sp = await ev(S, () => {
    const out = {}; net.myId = net.myId == null ? 1 : net.myId;
    const reset = () => { player._pqSpirePieces = {}; game.chests = (game.chests || []).filter((c) => !c._pqPuzzlePiece); for (const i of [8, 18, 28, 38]) game.chests.push({ x: 100 + i * 10, y: 300, w: 35, h: 30, opened: false, tier: 'gold', _pqPuzzlePiece: true, _pqPieceIndex: i }); delete _MP_BUCKETS['9|pqp']; delete _MP_BUCKETS['8|pqp']; };
    const peers0 = net.peers; net.peers = { 9: { id: 9, name: 'Eve', map: 'clockworkSpire', xi: '', x: 0, y: 0, _last: performance.now() }, 8: { id: 8, name: 'Ivy', map: 'clockworkSpire', xi: 'xaaa.1', x: 0, y: 0, _last: performance.now() } };
    const have = () => Object.keys(player._pqSpirePieces || {}).length, spent = () => game.chests.filter((c) => c._pqPuzzlePiece && c.opened).length;
    try {
      // an honest partner: one piece, my chest is spent with it, and no loot is owed (a piece chest pays the piece only)
      reset(); const coins0 = player.mojicoins; _mpHandle({ t: 'ping', id: 9, pqp: 18 });
      out.honest = { have: have(), spent: spent(), coins: player.mojicoins - coins0 };
      // a hostile partner: four pieces in one burst
      reset(); for (const i of [8, 18, 28, 38]) _mpHandle({ t: 'ping', id: 9, pqp: i });
      out.burst = { have: have(), spent: spent() };
      // the same peer a moment later is allowed another (the window is a second)
      delete _MP_BUCKETS['9|pqp']; _mpHandle({ t: 'ping', id: 9, pqp: 28 });
      out.later = have();
      // a peer in a private copy of the map: nothing
      reset(); _mpHandle({ t: 'ping', id: 8, xi: 'xaaa.1', pqp: 8 });
      out.otherWorld = { have: have(), spent: spent(), xi: net.peers[8].xi };
    } finally { net.peers = peers0; }
    return out;
  });
  ok('coop-13: an honest partner\'s piece counts for me, spends my chest, and owes me no loot', sp.honest.have === 1 && sp.honest.spent === 1 && sp.honest.coins === 0, sp.honest);
  ok('coop-13: a burst of four piece messages from one peer lands at most two in a second (there was no limit)', sp.burst.have === 2 && sp.burst.spent === 2, sp.burst);
  ok('coop-13: ...and the same peer a second later can still deliver the next piece', sp.later === sp.burst.have + 1, { later: sp.later, burst: sp.burst });
  ok('coop-13: a piece from a peer in a private copy of the Spire is ignored', sp.otherWorld.have === 0 && sp.otherWorld.spent === 0, sp.otherWorld);
  const errs1 = S._errors.slice();

  // =================== PART 2: two real clients - the guest's Carriage level (diff-c-1) ===================
  const A = await boot(browser, 'Ann'), B = await boot(browser, 'Bob');
  await ev(A, ({ ws, room }) => mpConnect(ws, 'Ann', room), { ws: WS, room: ROOM });
  await A.waitForFunction(() => net.myId != null, null, { timeout: 15000 }).catch(() => {});
  await ev(B, ({ ws, room }) => mpConnect(ws, 'Bob', room), { ws: WS, room: ROOM });
  await sleep(900);
  for (const p of [A, B]) await ev(p, () => { window.__pump = setInterval(() => { try { _mpTick(); } catch (e) {} try { _coopTickMonsters(); } catch (e) {} try { _lxPqPartyTick(); } catch (e) {} }, 90); });
  await sleep(500);
  await ev(A, () => { player.level = 60; }); await ev(B, () => { player.level = 25; });
  ok('Ann is the host, Bob the guest', (await ev(A, () => net.isHost)) === true && (await ev(B, () => net.isHost)) === false);
  await ev(A, () => { game.visitedMaps = game.visitedMaps || {}; game.visitedMaps.tower = true; loadMap('tower'); }); await sleep(1800);
  await ev(B, () => { game.visitedMaps = game.visitedMaps || {}; game.visitedMaps.tower = true; loadMap('tower'); });
  const mir = await until(B, () => { const ms = game.monsters.filter((m) => m._coopMirror && m._pqMech); return { ok: ms.length >= 8, v: { n: ms.length, lv: [...new Set(ms.map((m) => _mobLevel(m)))] } }; }, null, 12000);
  const hostLv = await ev(A, () => [...new Set(game.monsters.filter((m) => m._pqMech).map((m) => _mobLevel(m)))]);
  ok('diff-c-1: a guest reads the Carriage mechs at the HOST\'s level (31), never Lv 1', mir && mir.n >= 8 && mir.lv.length === 1 && mir.lv[0] === 31 && hostLv.length === 1 && hostLv[0] === 31, { guest: mir, host: hostLv });
  const errs = [...errs1, ...A._errors, ...B._errors];
  ok('no page errors on any client', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('test ran to the end', false, String(e).slice(0, 400)); }
await browser.close();
try { relay.kill(); } catch (e) {}
const bad = results.filter((r) => !r.pass);
console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
process.exit(bad.length ? 1 : 0);
