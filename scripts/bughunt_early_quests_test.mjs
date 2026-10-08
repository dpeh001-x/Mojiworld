// The early quests (Lv 1-10), audited the way the stone puzzle was (bughunt_stones_test): can every one actually be done (a real giver, a target that spawns, a
// route), and does each set-piece tell you what to do and let you carry on - the tracker follows every step, a failed fight / a late race / a wrong star resets
// without leaving the map, nothing live is ever removed without its fade, and the pill of every trial and the King's offer say what to do.
//   [SERVE_ROOT=<dir with serve.js, data, art>] [PORT=n] node scripts/bughunt_early_quests_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11271';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--')); const FILE = cand ? path.basename(cand) : 'mojiworld_game.html';
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof QUESTS === 'object' && typeof _lxQMarkUse === 'function' && typeof _qnavDest === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3500);
  await page.evaluate(() => { try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} try { _lxBootHold && _lxBootHold.release && _lxBootHold.release('menu'); } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 6; player._god = true; player.invulnerable = 9e9; player._tutorialSeen = true; player._gravitosCineSeen = true; player._storyBeatsSeen = {};
    window.__toasts = []; const st = showToast; showToast = function (m) { __toasts.push(String(m)); return st.apply(this, arguments); }; window._playStoryBeat = function () { return true; }; });
  await page.waitForTimeout(4000);
  const R = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms)), out = { pops: [] };
    const hook = () => { const arr = game.monsters; if (arr._h) return; arr._h = 1; const sp = arr.splice; arr.splice = function (i, n) { try { for (const m of Array.prototype.slice.call(arr, i, i + (n === undefined ? arr.length - i : n))) if (m && !(game._fadingMonsters || []).includes(m) && !m._killed) out.pops.push(m.type + ':' + Math.round(m.currentHp)); } catch (e) {} return sp.apply(arr, arguments); }; };
    const setup = async (id) => { player.quests = { active: {}, completed: {}, unlocked: {}, fresh: {} }; _ensureQuests(); __toasts.length = 0; if (game._lxFight) _lxFightEnd(game._lxFight, false); game.monsters.length = 0; game._fadingMonsters = [];
      const q = QUESTS[id]; player.level = q.levelReq; for (const k of Object.keys(QUESTS)) if (/^q_road_/.test(k) && k < id) player.quests.completed[k] = true; player.quests.unlocked[id] = true;
      loadMap(q.stages[0].map, 300); await wait(1800); game.paused = false; game.monsters.length = 0; hook(); player._god = true; player.invulnerable = 9e9; player.hp = getMaxHp(); acceptQuest(id, true); return player.quests.active[id]; };
    const stand = (mk) => { const m = _lxQMarks().find((x) => x.mk.id === mk); player.x = m.x - 14; player.y = m.y - player.h; player.vx = 0; player.vy = 0; return m; };
    const touch = async (mk) => { stand(mk); await wait(120); game._lxQMarkT = 0; const t = _lxQMarkTarget(); if (t && t.mk.id === mk) _lxQMarkUse(t); await wait(60); return !!t; };
    const trk = (name) => { const r = [...document.querySelectorAll('#quest-tracker .qt-row')].find((x) => x.textContent.indexOf(name) >= 0); const p = r && r.querySelector('.qt-prog'); return p ? p.textContent.trim() : null; };
    const pill = () => { _lxFightHud(); const e = document.getElementById('lx-sp-hud'); return e && e.style.display !== 'none' ? e.textContent : ''; };
    const lose = () => { player._god = false; player.hp = 0; _lxFightTick(20); player.hp = getMaxHp(); player._god = true; };
    // ---- 1. can every early quest be done?
    const npcs = new Set(); for (const m of Object.values(MAPS)) for (const n of (m.npcs || [])) npcs.add(n.name);
    const spawns = (t) => Object.keys(MAPS).some((k) => JSON.stringify(MAPS[k].spawns || []).indexOf('"' + t + '"') >= 0);
    out.early = []; for (const [id, q] of Object.entries(QUESTS)) { if (!q || (q.levelReq || 1) > 10) continue; const bad = [];
      if (q.giver && !npcs.has(q.giver)) bad.push('giver ' + q.giver); for (const t of [].concat(q.talkTo || [])) if (!npcs.has(t)) bad.push('talk ' + t);
      if (q.kind === 'kill' || q.kind === 'boss') for (const t of [q.target].concat((q.objectives || []).map((o) => o.target))) if (!monsterTypes[t] || !spawns(t)) bad.push('target ' + t);
      if (q.kind === 'visit' && q.target && !MAPS[q.target]) bad.push('map ' + q.target); let d = null; try { d = _qnavDest(id); } catch (e) {} if (!d) bad.push('not navigable'); if (bad.length) out.early.push(id + ': ' + bad.join(', ')); out.earlyN = (out.earlyN | 0) + 1; }
    // ---- 2. the lamps (path + ambush waves)
    let a = await setup('q_road_2'), f; const N2 = QUESTS.q_road_2.name; out.l = {};
    __toasts.length = 0; await touch('l2'); out.l.early = { toast: __toasts.join('|'), fight: !!game._lxFight };
    await touch('l1'); f = game._lxFight;
    __toasts.length = 0; await touch('l2'); out.l.block = __toasts.join('|'); f = game._lxFight; lose();
    out.l.lost = { fight: !!game._lxFight, used: Object.keys(a.used || {}).length, trk: trk(N2) }; await touch('l1'); f = game._lxFight; out.l.retry = !!f;
    for (let r = 0; r < 12 && game._lxFight; r++) { for (const m of game._lxFight.mobs.slice()) { m.currentHp = 0; m._killed = 1; try { killMonster(m); } catch (e) {} } _lxFightTick(20000); await wait(100); } out.l.l1 = { used: Object.keys(a.used || {}).join(), trk: trk(N2) };
    await touch('l2'); f = game._lxFight; for (const m of f.mobs.slice()) { m.currentHp = 0; m._killed = 1; try { killMonster(m); } catch (e) {} } await wait(100); out.l.mid = pill();   // the second lamp: four now, two more after 7 s
    loadMap('town', 300); await wait(600); out.l.left = { fight: !!game._lxFight, used: Object.keys(a.used || {}).join() };
    // ---- 3. the lantern race
    a = await setup('q_road_5'); const N5 = QUESTS.q_road_5.name; out.r = {}; await touch('a'); out.r.pill = pill(); out.r.trk1 = trk(N5);
    _lxQTimers(46000); out.r.late = { used: Object.keys(a.used || {}).length, trk: trk(N5), toast: __toasts.slice(-1)[0], clock: a.timerMs | 0 };
    await touch('a'); await touch('b'); loadMap('town', 300); await wait(500); _lxQTimers(100); out.r.left = { used: Object.keys(a.used || {}).length, clock: a.timerMs | 0 };
    // ---- 4. the King's morning
    player.quests = { active: {}, completed: {}, unlocked: {}, fresh: {} }; _ensureQuests(); for (const k of ['q_road_1', 'q_road_2', 'q_road_3', 'q_road_4', 'q_road_5']) player.quests.completed[k] = true; player.quests.unlocked.q_road_6 = true; player.level = 9; __toasts.length = 0;
    loadMap('slimeCave', 300); await wait(2500); game.paused = false; hook(); player._god = true; player.hp = getMaxHp(); acceptQuest('q_road_6', true); a = player.quests.active.q_road_6; out.k = {};
    const king = game.monsters.find((m) => m.type === 'king'); out.k.king = !!king;
    if (king) { king.currentHp = Math.floor(king.maxHp * 0.2); await wait(1200); out.k.pill = pill(); const Z = game._lxMercy; if (Z) { player.x = Z.x - 14; player.y = Z.y - player.h; await wait(300); const t = _lxQMarkTarget(); if (t && t.mk.mercy) { game._lxQMarkT = 0; _lxQMarkUse(t); } await wait(2800); } out.k.spared = { ready: !!a.readyToHandIn, spared: a.spared | 0, pill: pill() }; }
    // ---- 5. the doors: Hera (recall), Hong (aim), Taiga (cuts), Will (hold)
    a = await setup('q_road_7'); const N7 = QUESTS.q_road_7.name; out.d = {};
    await touch('will'); f = game._lxFight; _lxFightTick(20); out.d.will = pill(); f.t += 21000; f.tr.hold = f.def.trial.ms; _lxTrialTick(f, 100); await wait(100);
    a.stage = 1; a.used = {}; a.seq = 0; _lxQSync(_lxQStageOf('q_road_7')); loadMap('azureAbode', 300); await wait(1800); game.paused = false; game.monsters.length = 0; hook();
    await touch('s1'); await wait(5200); const seq = a.rseq.slice(); await touch(['s1', 's2', 's3', 's4'].find((x) => x !== seq[0])); out.d.hera = { used: Object.keys(a.used || {}).length, rpos: a.rpos | 0, relit: !!game._lxRecall, toast: __toasts.slice(-1)[0] };
    a.stage = 2; a.used = {}; a.seq = 0; _lxQSync(_lxQStageOf('q_road_7')); loadMap('emeraldVillage', 300); await wait(1800); game.paused = false; game.monsters.length = 0; hook();
    await touch('hong'); f = game._lxFight; await wait(700); out.d.hong = pill(); f.t = Math.max(f.t, 600);   // a press before 0.5 s is ignored: a loaded machine may not have got there yet
    for (let i = 0; i < 3 && game._lxFight; i++) { f.tr.aim.ang = f.tr.aim.zone + 2.5; _lxAimPress(f); await wait(100); } out.d.hongLost = !game._lxFight; await touch('hong'); out.d.hongRetry = !!game._lxFight; if (game._lxFight) _lxFightEnd(game._lxFight, false);
    a.stage = 3; a.used = {}; a.seq = 0; _lxQSync(_lxQStageOf('q_road_7')); loadMap('shadowWovenHood', 300); await wait(1800); game.paused = false; game.monsters.length = 0; hook();
    await touch('taiga'); f = game._lxFight; _lxTrialTick(f, 100); out.d.taiga = pill(); _lxFightEnd(f, false);
    return out;
  });
  check(R.earlyN >= 15 && !R.early.length, 'every quest up to Lv 10 can be done: its giver and talk targets are real people, its monsters exist and spawn on a map, a route to it resolves (' + R.earlyN + ' quests)', J(R.early));
  check(/Not that one yet/.test(R.l.early.toast) && !R.l.early.fight, 'lamps: an early touch just waits ("Not that one yet")', J(R.l.early));
  check(/Clear the ambush/.test(R.l.mid) && /still coming/.test(R.l.mid), 'lamps: with the first wave down the pill says more are still coming (it said "2 left" with nothing on screen)', R.l.mid);
  check(/finish the fight first \(\d+ left\)/.test(R.l.block), 'lamps: touching the next lamp mid-ambush says how many are left', R.l.block);
  check(!R.l.lost.fight && R.l.lost.used === 0 && R.l.retry, 'lamps: a lost ambush leaves the lamp to try again (no map change needed)', J(R.l.lost));
  check(R.l.l1.used === 'l1' && R.l.l1.trk === '1/4' && R.l.left.used === 'l1' && !R.l.left.fight, 'lamps: the tracker reads 1/4 and a lit lamp stays lit when you leave the map', J({ l1: R.l.l1, left: R.l.left }));
  check(/lantern|hum/i.test(R.r.pill) && /\d+s/.test(R.r.pill) && /1\/4/.test(R.r.pill) && R.r.trk1 === '1/4', 'race: the pill names the stage and the lanterns done, not just the seconds, and the tracker follows', J({ pill: R.r.pill, trk: R.r.trk1 }));
  check(R.r.late.used === 0 && R.r.late.trk === '0/4' && /slipped away/.test(R.r.late.toast) && R.r.late.clock === 0, 'race: when the clock runs out the lanterns go dark and the tracker is back at 0/4 by itself', J(R.r.late));
  check(R.r.left.used === 0 && R.r.left.clock === 0, 'race: leaving the map ends the run cleanly', J(R.r.left));
  check(R.k.king && /Touch the lantern at your feet/.test(R.k.pill) && /strike/.test(R.k.pill), "the King's offer: the pill says to touch the lantern to show him morning or strike to finish him", R.k.pill);
  check(R.k.spared && R.k.spared.ready && R.k.spared.spared === 1 && R.k.spared.pill === '', 'the King: showing morning ends the quest and the pill goes away', J(R.k.spared));
  check(/Hold the ring and dodge inside it/.test(R.d.will), "Will's door: the pill says to stay in the ring and dodge", R.d.will);
  check(R.d.hera.used === 0 && R.d.hera.rpos === 0 && R.d.hera.relit && /Not that star/.test(R.d.hera.toast), "Hera's door: a wrong star resets the order and shows it again at once", J(R.d.hera));
  check(/Press .* when the needle is in the gold: 0\/3/.test(R.d.hong) && R.d.hongLost && R.d.hongRetry, "Lady Hong's door: the pill names the key and what counts, three misses end it, and it can be started again at once", R.d.hong + ' | lost=' + R.d.hongLost + ' retry=' + R.d.hongRetry);
  check(/Find the gap between the lines of light/.test(R.d.taiga), "Taiga's door: the pill says what the lines are", R.d.taiga);
  check(R.pops.length === 0, 'across all of it nothing live was removed without its fade (no popping)', J(R.pops));
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
