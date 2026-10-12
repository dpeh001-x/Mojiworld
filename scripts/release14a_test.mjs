// RELEASE 14a (bug hunt round 14, part A - the story's order) stays fixed:
//   [1] the Singularity's door (the Weight-Bearer's Stair) refuses a hero who cannot make the petition (q_boss_gravitos: prereqs
//       met, taken or done) and opens to one who can, or to a save that already finished; the gravitos1 daily is not rolled for
//       the first; a Gravitos kill without the petition grants no title, plays no ending and opens no credits
//   [2] the Sanctum's twelve doors stay shut until Aetherion falls; one House fallen no longer makes the Twelve known - except on
//       a legacy save (a House beaten before this build), decided once at load and kept
//   [3] closing the game during the ending: the kill's save owes the ending, the next load plays the epilogue once, then never again
//   [4] Act 4 waits for every House dark and the Stilled Hour; the Unrefused Hour alone is Act 3
//   [5] the Long Dawn and the Twelve quest texts read right in either order
//   node scripts/release14a_test.mjs        PORT / MOJI_GAME_FILE / SERVE_ROOT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15140), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const PREREQ = ['q_boss_aetherion', 'q_boss_aries', 'q_zodiac_twelve', 'q_boss_sundered_smith', 'q_hourglass_5', 'q_long_dawn_2', 'q_long_dawn_3'];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1600, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  const R = await page.evaluate(async (PREREQ) => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior');
    player._storyBeatsSeen = {}; for (const k in STORY_BEATS) if (k !== 'epilogue_gravitos') player._storyBeatsSeen[k] = true;   // the story is NOT finished
    player._tutorialSeen = true; player._gravitosCineSeen = true; player.level = 95; player.hp = player.maxHp = 9e6;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const steps = (n) => new Promise((r) => { const g0 = game.time; const f = () => (game.time - g0 >= n ? r() : requestAnimationFrame(f)); f(); });
    const clear = () => { try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} const g = document.getElementById('game-complete-overlay'); if (g) g.remove(); game.paused = false; };
    const settle = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (game.paused && !document.querySelector('#story-beat-overlay.on')) { try { closeAllModals(); } catch (e) {} game.paused = false; } await wait(100); } };
    const toasts = []; const _st = window.showToast; window.showToast = function (t) { toasts.push(String(t)); return _st.apply(this, arguments); };
    let dlg = null; const _cd = window._openConfirmDialog; window._openConfirmDialog = function (t) { dlg = String(t); };
    const fresh = () => { _ensureQuests(); player.quests.completed = {}; player.quests.active = {}; player.titles = {}; delete player.equippedTitle; player.dawnFragments = [];
      game.bestiary = {}; if (game.achievements) delete game.achievements.aetherionDown; player._lxTwelveLegacy = 0; delete player._lxEndingDue; delete player._lxBeatOpen; };
    const door = async (map, dest) => { clear(); loadMap(map); game.paused = false; await steps(4); clear();
      const po = game.portals.find((p) => p.dest === dest); if (!po) return { err: 'no door ' + dest };
      const py = (typeof po.y === 'number') ? po.y : _defaultPortalY(po.x); player.x = po.x - player.w / 2; player.y = py - player.h; player.vy = 0;
      dlg = null; toasts.length = 0; const r = tryPortal(); return { r, dlg, map: game.currentMap, toast: toasts.join(' | ') }; };
    const out = {};
    // [1] the Singularity
    fresh(); out.sNo = await door('weightbearerStair', 'gravitosArena'); out.earnNo = (typeof _lxGravitosEarned === 'function') ? _lxGravitosEarned() : null;
    for (const id of PREREQ) player.quests.completed[id] = 1; out.sYes = await door('weightbearerStair', 'gravitosArena');
    fresh(); player.titles = { [LX_TITLE_CONQUEROR]: true }; out.sDone = await door('weightbearerStair', 'gravitosArena');
    const days = () => { const ids = new Set(); player.level = 99; for (let d = 0; d < 400; d++) ids.add(_pickDailyChallenge(d).id); player.level = 95; return ids.has('gravitos1'); };
    fresh(); out.dailyNo = days(); for (const id of PREREQ) player.quests.completed[id] = 1; out.dailyYes = days();
    // the kill: stub the films (the grant must not depend on them) and count what the chain reaches
    const calls = { cine: 0, gc: 0 }; const _gdc = window._gravitosDefeatCutscene; window._gravitosDefeatCutscene = () => { calls.cine++; };
    const grav = () => ({ type: 'gravitos', name: 'Gravitos', x: 500, y: 400, w: 120, h: 160, currentHp: 0, maxHp: 1000, isBoss: true, boss: true, superBoss: true, level: 90, exp: 0, mojicoins: 0 });
    clear(); loadMap('forest'); game.paused = false; await steps(4); game.monsters.length = 0;
    fresh(); try { triggerSuperBossDeath(grav()); } catch (e) { out.killErr = String(e).slice(0, 120); } await wait(2400);
    out.kNo = { title: !!player.titles[LX_TITLE_CONQUEROR], cine: calls.cine, done: _lxStoryComplete(), due: !!player._lxEndingDue };
    _showGameComplete(); out.kNo.credits = !!document.querySelector('#game-complete-overlay.on'); clear();
    fresh(); player.quests.active.q_boss_gravitos = { progress: 0 }; calls.cine = 0;
    try { triggerSuperBossDeath(grav()); } catch (e) { out.killErr2 = String(e).slice(0, 120); } await wait(2400);
    out.kYes = { title: !!player.titles[LX_TITLE_CONQUEROR], cine: calls.cine, due: player._lxEndingDue };
    // [3] ...and the game closes while the defeat film is up (the stub never calls back): the next load plays the epilogue once
    _flushSaveStateNow(); loadState(); game.paused = false; window._gravitosDefeatCutscene = _gdc;
    let opened = false; for (let i = 0; i < 150 && !opened; i++) { await settle(100); opened = player._lxBeatOpen === 'epilogue_gravitos'; }
    for (let i = 0; i < 200 && player._lxBeatOpen; i++) { for (const k of ['Escape', 'Enter']) document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); await wait(150); }
    await wait(500); out.replay = { opened, seen: !!player._storyBeatsSeen.epilogue_gravitos, open: player._lxBeatOpen || null, due: !!player._lxEndingDue, credits: !!document.getElementById('game-complete-overlay') };
    clear(); _flushSaveStateNow(); loadState(); game.paused = false; let again = false;
    for (let i = 0; i < 40 && !again; i++) { await settle(100); again = !!player._lxBeatOpen || !!document.querySelector('#story-beat-overlay.on'); }
    out.replay.again = again; clear();
    // [2] the Twelve
    fresh(); player._storyBeatsSeen.epilogue_gravitos = true; player.titles = {};
    out.zNo = await door('zodiacHall', 'zod_taurus'); out.knownNone = _lxTwelveKnown();
    game.bestiary._boss_zodiac_aries = 1; out.knownOneHouse = _lxTwelveKnown(); out.zOneHouse = await door('zodiacHall', 'zod_taurus');
    player._lxTwelveLegacy = 1; out.knownLegacy = _lxTwelveKnown(); out.zLegacy = await door('zodiacHall', 'zod_taurus');
    player._lxTwelveLegacy = 0; game.bestiary.aetherion = 1; out.knownAe = _lxTwelveKnown(); out.zAe = await door('zodiacHall', 'zod_taurus');
    // the legacy decision at load: a save with a House down and Aetherion standing, written before this build (no field)
    const reload = async () => { _flushSaveStateNow(); loadState(); game.paused = false; await settle(600); clear(); };
    fresh(); player._storyBeatsSeen.epilogue_gravitos = true; game.bestiary._boss_zodiac_aries = 1; delete player._lxTwelveLegacy; await reload();
    out.loadOld = { legacy: player._lxTwelveLegacy, known: _lxTwelveKnown() }; await reload(); out.loadOld2 = { legacy: player._lxTwelveLegacy, known: _lxTwelveKnown() };
    fresh(); player._storyBeatsSeen.epilogue_gravitos = true; game.bestiary._boss_zodiac_aries = 1; player._lxTwelveLegacy = 0; await reload();
    out.loadNew = { legacy: player._lxTwelveLegacy, known: _lxTwelveKnown() };
    // [4] the acts
    const twelve = (on) => { for (const z of ZODIAC_SIGNS) game.bestiary['_boss_zodiac_' + z.id] = on ? 1 : 0; };
    fresh(); player.dawnFragments = ['frag_smith', 'frag_aries', 'frag_aetherion', 'frag_vigil']; twelve(false); out.actVigil = _sagaState().act;
    player.dawnFragments.push('frag_hourglass'); out.actVigilHg = _sagaState().act; twelve(true); out.actAll = _sagaState().act;
    twelve(false); player.dawnFragments = ['frag_dawn']; out.actDawn = _sagaState().act; fresh();
    // [5] the texts
    out.txt = { ld1: QUESTS.q_long_dawn_1.desc, ld2: QUESTS.q_long_dawn_2.desc, tw: QUESTS.q_zodiac_twelve.desc };
    window.showToast = _st; window._openConfirmDialog = _cd;
    return out;
  }, PREREQ);
  const J = (x) => JSON.stringify(x).slice(0, 300);
  ok('[1] the Stair refuses the Singularity to a Lv 95 hero who cannot make the petition, in the world\'s voice', R.sNo.r === false && R.sNo.dlg === null && R.sNo.map === 'weightbearerStair' && /Singularity will not open/.test(R.sNo.toast) && R.earnNo === false, J(R.sNo));
  ok('[1] ...and opens (the boss-arena confirm) once the petition\'s six prereqs are done', R.sYes.r === true && /Boss Arena/.test(R.sYes.dlg || ''), J(R.sYes));
  ok('[1] ...and to a save that already finished the story (old saves keep their key)', R.sDone.r === true && /Boss Arena/.test(R.sDone.dlg || ''), J(R.sDone));
  ok('[1] the gravitos1 daily is never rolled for a hero the Singularity refuses; it is for one it admits', R.dailyNo === false && R.dailyYes === true, J({ no: R.dailyNo, yes: R.dailyYes }));
  ok('[1] a Gravitos kill without the petition is just a kill: no title, no ending chain, no story complete, no credits, nothing owed', !R.killErr && R.kNo.title === false && R.kNo.cine === 0 && R.kNo.done === false && R.kNo.credits === false && R.kNo.due === false, J(R.kNo));
  ok('[1] ...with the petition taken: the title, the ending chain, and the ending owed', !R.killErr2 && R.kYes.title === true && R.kYes.cine === 1 && R.kYes.due === 1, J(R.kYes));
  ok('[3] closing the game during the defeat film: the next load plays the epilogue, its close settles the debt and opens the credits', R.replay.opened && R.replay.seen && !R.replay.open && R.replay.due === false && R.replay.credits, J(R.replay));
  ok('[3] ...once: the load after that replays nothing', R.replay.again === false, J(R.replay));
  ok('[2] the Sanctum\'s doors refuse a hero who has not felled Aetherion ("opens when the one who broke the sky falls")', R.zNo.r === false && R.zNo.dlg === null && /one who broke the sky falls/.test(R.zNo.toast) && R.knownNone === false, J(R.zNo));
  ok('[2] one House fallen no longer makes the Twelve known, and the doors stay shut', R.knownOneHouse === false && R.zOneHouse.r === false, J({ k: R.knownOneHouse, z: R.zOneHouse }));
  ok('[2] a legacy save keeps them known and the doors open; Aetherion\'s fall opens them for everyone', R.knownLegacy === true && R.zLegacy.r === true && /Boss Arena/.test(R.zLegacy.dlg || '') && R.knownAe === true && R.zAe.r === true, J({ R: R.zLegacy, A: R.zAe }));
  ok('[2] a save from before this build with a House down and Aetherion standing loads as legacy (kept on the next load); a new save does not', R.loadOld.legacy === 1 && R.loadOld.known === true && R.loadOld2.legacy === 1 && R.loadNew.legacy === 0 && R.loadNew.known === false, J({ o: R.loadOld, o2: R.loadOld2, n: R.loadNew }));
  ok('[4] the Unrefused Hour without every House dark (or the Stilled Hour) is Act 3; with both it is Act 4; the dawn itself is Act 4', R.actVigil === 3 && R.actVigilHg === 3 && R.actAll === 4 && R.actDawn === 4, J([R.actVigil, R.actVigilHg, R.actAll, R.actDawn]));
  ok('[5] the Long Dawn and the Twelve texts no longer assume the other came first', !/The sky opened|finishes opening/.test(R.txt.ld1) && /The Ram fell, and three tyrants/.test(R.txt.ld1) && !/finishes opening/.test(R.txt.ld2) && !/heavens start to open/.test(R.txt.tw) && /sky can finish opening/.test(R.txt.tw), '');
  ok('[last] no page errors', errs.length === 0, errs.slice(0, 4));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e && e.stack || e).slice(0, 500)); }
finally { await browser.close(); try { server.kill(); } catch (e) {} }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
