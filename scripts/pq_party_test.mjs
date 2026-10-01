// THE TICKET RUSH AS A PARTY QUEST (per user, from a tester: "the monster level is not reflected correctly in co-op", and "make the PQ as
// party-like as possible - teamwork rather than individual killing"). Two real clients on the local relay:
//   LEVEL    a guest's mirror of a lobby mech carries the HOST's level, def and name (it used to be built from the guest's own level)
//   PARTY    a mech is built from the party on its map: solo = the lone player; a duo = the average level held to 5 above the weakest,
//            HP x1.6; when the partner leaves, back to solo
//   BOOKING  a booked mech takes 1 from every hit until hits from different players, in turn, punch it (A, B, A); then it stands open
//            x1.5; the host judges, the guest sees the ring and the punch; one player alone can wear it down; solo never sees one
//   SPIRE    a Ticket Piece one climber opens counts for everyone on the Spire
//   node scripts/pq_party_test.mjs     (relay + game on PORT, default 8080: PORT=8080 node mp/server.mjs; MOJI_GAME_FILE picks the build)
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.env.PORT || '8080';
const FILE = process.env.MOJI_GAME_FILE ? process.env.MOJI_GAME_FILE.split(/[\\/]/).pop() : 'mojiworld_game.html';
const EXE = [process.env.PW_EXE, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const URL = `http://localhost:${PORT}/${FILE}`, WS = `ws://localhost:${PORT}`;
const ROOM = 'pqp' + Math.floor(Math.random() * 1e6);
const results = []; const ok = (n, c, extra) => { results.push({ n, pass: !!c, extra }); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '   ' + JSON.stringify(extra))); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (page, fn, arg, ms = 6000) => { const t0 = Date.now(); for (;;) { const r = await page.evaluate(fn, arg); if (r.ok || Date.now() - t0 > ms) return r.v; await sleep(120); } };
async function boot(browser, name) {
  const page = await (await browser.newContext()).newPage(); page._errors = [];
  page.on('pageerror', (e) => page._errors.push(String(e).slice(0, 180)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => typeof net === 'object' && typeof game === 'object' && typeof mpConnect === 'function' && typeof _lxPqParty === 'function', null, { timeout: 60000 });
  await page.waitForTimeout(3500);
  await page.evaluate((nm) => { try { player.cls = 'warrior'; if (player.look) player.look.name = nm; game.paused = false; window._prologueActive = false; window._lxBootGateDone = true; player.invulnerable = 999999; player.baseAcc = 500; } catch (e) {} }, name);
  return page;
}
const ev = (p, fn, arg) => p.evaluate(fn, arg);
const pump = (p) => p.evaluate(() => { window.__pump = setInterval(() => { try { _mpTick(); } catch (e) {} try { _coopTickMonsters(); } catch (e) {} try { _lxPqPartyTick(); } catch (e) {} }, 90); });
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const A = await boot(browser, 'Ann'), B = await boot(browser, 'Bob');
  await ev(A, ({ ws, room }) => mpConnect(ws, 'Ann', room), { ws: WS, room: ROOM });
  await A.waitForFunction(() => net.myId != null, null, { timeout: 15000 }).catch(() => {});
  await ev(B, ({ ws, room }) => mpConnect(ws, 'Bob', room), { ws: WS, room: ROOM });
  await sleep(900); await pump(A); await pump(B); await sleep(500);
  await ev(A, () => { player.level = 60; }); await ev(B, () => { player.level = 30; });
  ok('Ann is the host, Bob the guest', (await ev(A, () => net.isHost)) === true && (await ev(B, () => net.isHost)) === false);
  // ---------------- LEVEL + PARTY: the lobby (expressScaling) ----------------
  const LOBBY = 'clockworkUnderpassLobby';
  await ev(A, (m) => { game.visitedMaps = game.visitedMaps || {}; game.visitedMaps[m] = true; loadMap(m); }, LOBBY);
  await sleep(2500);   // Ann alone in the lobby
  const solo = await ev(A, () => { const ms = game.monsters.filter((m) => m._pqMech); return { n: ms.length, lv: ms[0] && ms[0].level, par: ms[0] && ms[0]._pqN, booked: ms.filter((m) => m._pqBooked).length, hp: ms[0] && ms[0].maxHp }; });
  ok('alone, the lobby mechs are Ann\'s own level (60), party of 1, none booked', solo.n > 0 && solo.lv === 60 && solo.par === 1 && solo.booked === 0, solo);
  await ev(B, (m) => { game.visitedMaps = game.visitedMaps || {}; game.visitedMaps[m] = true; loadMap(m); }, LOBBY);
  // Bob arrives: Ann's tick re-builds every living mech for a party of two - level = min(avg 45, weakest 30 + 5) = 35
  const duo = await until(A, () => { const ms = game.monsters.filter((m) => m._pqMech); const v = { n: ms.length, lv: ms[0] && ms[0].level, par: ms[0] && ms[0]._pqN, hp: ms[0] && ms[0].maxHp }; return { ok: v.par === 2 && v.lv === 35, v }; }, null, 9000);
  ok('with Bob here the mechs re-build for a party of two at Lv 35 (the average held to 5 above the weakest)', duo.par === 2 && duo.lv === 35, duo);
  const expHp = await ev(A, () => { const b = _lxFieldBaseline(35); return Math.floor(Math.floor(b.hp * 2) * 1.6); });
  ok('and carry 1.6x HP', Math.abs(duo.hp - expHp) <= 2, { duo: duo.hp, expHp });
  const mir = await until(B, ({ lv }) => { const ms = game.monsters.filter((m) => m._coopMirror); return { ok: ms.length > 0 && ms.every((m) => m.level === lv), v: { n: ms.length, levels: [...new Set(ms.map((m) => m.level))] } }; }, { lv: 35 }, 9000);
  ok('Bob\'s mirrors read the HOST\'s level (35), not a level built from his own (30)', mir.n > 0 && mir.levels.length === 1 && mir.levels[0] === 35, mir);
  const cmp = await ev(A, () => Object.fromEntries(game.monsters.filter((m) => m._pqMech).map((m) => [m.uid, [m.level, Math.round(m.def), m.name, Math.round(m.maxHp)]])));
  const cmpB = await ev(B, () => Object.fromEntries(game.monsters.filter((m) => m._coopMirror).map((m) => [m.uid, [m.level, Math.round(m.def), m.name, Math.round(m.maxHp)]])));
  const bad = Object.keys(cmpB).filter((u) => cmp[u] && JSON.stringify(cmp[u]) !== JSON.stringify(cmpB[u]));
  ok('level, def, name and max HP agree on every mech', Object.keys(cmpB).length > 0 && bad.length === 0, { bad: bad.slice(0, 3).map((u) => [cmp[u], cmpB[u]]) });
  // Bob (the weaker) goes to town: back to Ann alone
  await ev(B, () => { loadMap('town'); });
  const back = await until(A, () => { const ms = game.monsters.filter((m) => m._pqMech); const v = { lv: ms[0] && ms[0].level, par: ms[0] && ms[0]._pqN }; return { ok: v.par === 1 && v.lv === 60, v }; }, null, 9000);
  ok('when Bob leaves, the mechs are Ann\'s again (Lv 60, party of 1)', back.par === 1 && back.lv === 60, back);
  // ---------------- BOOKING: the Carriage ----------------
  await ev(A, () => { game.visitedMaps.tower = true; loadMap('tower'); }); await sleep(1800);
  const soloBook = await ev(A, () => ({ mechs: game.monsters.filter((m) => m._pqMech).length, booked: game.monsters.filter((m) => m._pqBooked).length }));
  ok('alone in the Carriage, no mech is booked', soloBook.mechs >= 8 && soloBook.booked === 0, soloBook);
  await ev(B, () => { game.visitedMaps.tower = true; loadMap('tower'); });
  await until(B, () => ({ ok: game.monsters.filter((m) => m._coopMirror).length >= 8, v: 0 }), null, 9000);
  await until(A, () => ({ ok: (game._pqParty && game._pqParty.n === 2), v: 0 }), null, 6000);
  // pin the rolls: three booked mechs (a duo punch, a solo wear, a plain control) and one plain mech
  const ids = await ev(A, () => { const ms = game.monsters.filter((m) => m._pqMech); ms.forEach((m) => { m._pqBookRoll = 0.9; m._pqBookDone = false; m._pqBooked = 0; m.evasion = 0; m.invulnerable = 0; m.traits = null; m.hitStun = 0; });
    [ms[0], ms[1]].forEach((m) => { m._pqBookRoll = 0; }); game._pqPartyAt = 0; _lxPqPartyTick(); return ms.slice(0, 3).map((m) => m.uid); });
  const [uP, uW, uC] = ids;
  const bk = await until(B, ({ uP, uW, uC }) => { const g = (u) => { const m = game.monsters.find((x) => x.uid === u); return m ? (m._pqBooked | 0) : -1; }; const v = { P: g(uP), W: g(uW), C: g(uC) }; return { ok: v.P === 1 && v.W === 1 && v.C === 0, v }; }, { uP, uW, uC }, 8000);
  ok('with two players, rolled mechs are booked on BOTH screens (a plain one is not)', bk.P === 1 && bk.W === 1 && bk.C === 0, bk);
  const hpOf = (page, u) => ev(page, (x) => { const m = game.monsters.find((q) => q.uid === x); return m ? Math.round(m.currentHp) : null; }, u);
  // a booked mech takes 1 from a huge hit, whoever swings
  const h0 = await hpOf(A, uP);
  await ev(B, (u) => { const m = game.monsters.find((x) => x.uid === u); if (m) hitMonster(m, 30, false, 'certtest'); }, uP);
  const h1 = await until(A, ({ u, b }) => { const m = game.monsters.find((q) => q.uid === u); const v = m ? Math.round(m.currentHp) : null; return { ok: v != null && v < b, v }; }, { u: uP, b: h0 }, 6000);
  ok('Bob\'s huge hit on a booked mech lands for 1', h0 - h1 === 1, { h0, h1 });
  // the same player again does not punch it
  await ev(B, (u) => { const m = game.monsters.find((x) => x.uid === u); if (m) { hitMonster(m, 30, false, 'certtest'); hitMonster(m, 30, false, 'certtest'); } }, uP);
  await sleep(700);
  const stillBooked = await ev(A, (u) => { const m = game.monsters.find((x) => x.uid === u); return m ? { b: m._pqBooked | 0, n: m._pqPunch && m._pqPunch.n } : null; }, uP);
  ok('Bob alone, again and again, does not punch it through (punch chain stays at 1)', stillBooked && stillBooked.b === 1 && stillBooked.n === 1, stillBooked);
  // Ann answers, then Bob again: A, B, A -> punched
  await ev(A, (u) => { const m = game.monsters.find((x) => x.uid === u); if (m) hitMonster(m, 30, false, 'certtest'); }, uP);
  await sleep(400);
  const mid = await ev(A, (u) => { const m = game.monsters.find((x) => x.uid === u); return m ? { b: m._pqBooked | 0, n: m._pqPunch && m._pqPunch.n } : null; }, uP);
  ok('Ann\'s hit in turn is the second punch', mid && mid.b === 1 && mid.n === 2, mid);
  console.log('   before the 3rd punch:', JSON.stringify(await ev(A, (u) => { const m = game.monsters.find((x) => x.uid === u); return m ? { hp: Math.round(m.currentHp), max: Math.round(m.maxHp), b: m._pqBooked, P: m._pqPunch } : null; }, uP)));
  await ev(B, (u) => { const m = game.monsters.find((x) => x.uid === u); if (m) hitMonster(m, 30, false, 'certtest'); }, uP);
  const open = await until(A, (u) => { const m = game.monsters.find((x) => x.uid === u); const v = m ? (m._pqBooked | 0) : -1; return { ok: v === 2, v }; }, uP, 6000);
  ok('Bob\'s third punch breaks the ticket: the mech stands OPEN on the host', open === 2, open);
  // open = x1.5: compare hits on the open mech with the same hits on the SAME mech with the shield gone - open FIRST and at once (the open window is 5 s)
  // two hits each, summed, with the combo streak pinned to 1: hitMonster scales every hit by game.comboMult, which climbs with consecutive hits - the open mech (hit first) and the plain control (hit second) otherwise differ by the streak, not by the shield
  const dmgOf = async (u) => { const b = await hpOf(A, u); for (let i = 0; i < 2; i++) { await ev(A, (x) => { const m = game.monsters.find((q) => q.uid === x); if (m) { game.comboMult = 1; hitMonster(m, 30, false, 'certtest'); } }, u); await sleep(80); } const a = await hpOf(A, u); return b - a; };
  const dOpen = await dmgOf(uP);
  const openB = await until(B, (u) => { const m = game.monsters.find((x) => x.uid === u); const v = m ? (m._pqBooked | 0) : -1; return { ok: v === 2, v }; }, uP, 6000);
  ok('and Bob sees it open', openB === 2, openB);
  // the SAME mech once the shield is gone: a different mech is a different def / elite roll (a random Elite with an armour affix took 25 where its control took 21)
  await ev(A, (u) => { const m = game.monsters.find((x) => x.uid === u); if (m) { m._pqBooked = 0; m._pqBookDone = true; } }, uP);
  const dPlain = await dmgOf(uP);
  ok('an open mech takes about 1.5x', dPlain > 10 && dOpen / dPlain > 1.25 && dOpen / dPlain < 1.8, { dOpen, dPlain });
  // one player alone wears a shield away (the AFK-partner way out): 24 hits
  const wearHits = await ev(A, (u) => { const m = game.monsters.find((x) => x.uid === u); let n = 0; while (m && (m._pqBooked | 0) === 1 && n < 60) { hitMonster(m, 30, false, 'certtest'); n++; } return n; }, uW);
  ok('Ann alone can wear a booked mech down (about 24 hits) - a missing partner never wedges the stage', wearHits >= 20 && wearHits <= 30, { wearHits });
  // the partner leaves: shields come off the unbroken ones
  await ev(A, () => { const ms = game.monsters.filter((m) => m._pqMech && !m._pqBookDone); ms.slice(0, 2).forEach((m) => { m._pqBookRoll = 0; }); game._pqPartyAt = 0; _lxPqPartyTick(); });
  const bookedNow = await ev(A, () => game.monsters.filter((m) => m._pqBooked === 1).length);
  await ev(B, () => { loadMap('town'); });
  const cleared = await until(A, () => { const n = game.monsters.filter((m) => m._pqBooked === 1).length; return { ok: n === 0, v: n }; }, null, 9000);
  ok('when Bob leaves the map, no shield is left up (' + bookedNow + ' were)', cleared === 0, { bookedNow, cleared });
  // ---------------- SPIRE: shared pieces ----------------
  for (const p of [A, B]) await ev(p, () => { player.quests = player.quests || {}; player.quests.active = player.quests.active || {}; player.quests.completed = player.quests.completed || {}; player.quests.unlocked = player.quests.unlocked || {};
    player.quests.completed.q_clockwork_underpass = true; player.quests.unlocked.q_pq_spire = true; delete player.quests.completed.q_pq_spire; player._pqSpirePieces = {}; if (typeof acceptQuest === 'function') acceptQuest('q_pq_spire'); game.visitedMaps.clockworkSpire = true; loadMap('clockworkSpire'); });
  await sleep(3500);
  const chests = await until(A, () => { const c = game.chests.filter((x) => x._pqPuzzlePiece); return { ok: c.length >= 2, v: c.map((x) => x._pqPieceIndex) }; }, null, 9000);
  await until(B, () => { const c = game.chests.filter((x) => x._pqPuzzlePiece); return { ok: c.length >= 2, v: 0 }; }, null, 9000);
  const idx = chests[1];
  await ev(A, (i) => { const c = game.chests.find((x) => x._pqPuzzlePiece && x._pqPieceIndex === i); if (c) openChest(c); }, idx);
  const bGot = await until(B, (i) => { const v = !!(player._pqSpirePieces && player._pqSpirePieces[i]); return { ok: v, v }; }, idx, 6000);
  const bChestSpent = await ev(B, (i) => { const c = game.chests.find((x) => x._pqPuzzlePiece && x._pqPieceIndex === i); return !c || !!c.opened; }, idx);
  const bProg = await ev(B, () => { const a = player.quests.active.q_pq_spire; return a ? (a.progress | 0) : -1; });
  console.log('   spire debug:', JSON.stringify(await ev(B, () => ({ act: Object.keys(player.quests.active || {}), map: game.currentMap, peers: Object.values(net.peers).map((p) => p.map), pieces: Object.keys(player._pqSpirePieces || {}), chests: game.chests.filter((x) => x._pqPuzzlePiece).map((x) => [x._pqPieceIndex, x.opened]) }))), JSON.stringify(await ev(A, () => ({ act: Object.keys(player.quests.active || {}), pieces: Object.keys(player._pqSpirePieces || {}) }))));
  ok('a piece Ann opened on the Spire is Bob\'s too (piece, spent chest, quest progress)', bGot === true && bChestSpent && bProg >= 1, { bGot, bChestSpent, bProg });
  // ---------------- clean ----------------
  const errs = [...A._errors, ...B._errors];
  ok('no page errors on either client', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('test ran to the end', false, String(e).slice(0, 300)); }
await browser.close();
const bad = results.filter((r) => !r.pass);
console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
process.exit(bad.length ? 1 : 0);
