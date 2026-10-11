// RELEASE 11a (bug hunt) stays fixed:
//   1 a second tab left on the TITLE screen writes nothing (heartbeat / tab-hide / close / debounce), its Continue card shows the
//     other tab's newer save, and Continue plays that newer save
//   2 Boss Rush is timed on the play clock: a pause adds nothing, a PC clock set back cannot give a negative (grade S) time
//   3 the 30 s heartbeat rolls the daily day over mid-session
//   4 The First-Born and The Twelve Houses wait for Aetherion (_lxTwelveKnown); a save that already took them keeps them
//   5 the Lv 40 toast names the captain and the Hidden Pagoda, not the west awning
//   node scripts/release11a_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 14851), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const URL = `http://localhost:${PORT}/${FILE}?dev=1`;
const bootIn = async (page) => {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
};
// Waits through a reload: true once the world is up (no title overlay) on whatever document the page holds now.
const inWorld = async (page, ms = 180000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const up = await page.evaluate(() => { if (typeof player === 'undefined' || typeof loadMap !== 'function') return false; const o = document.getElementById('loading-overlay'); return (!o || o.classList.contains('fade') || getComputedStyle(o).display === 'none') && !!player.cls; });
      if (up) return true;
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
};
const setup = `try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  player._tutorialSeen = true; window._prologueAfterCreation = false; window._lxAwaitingCreation = false;
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  if (!player.cls) applyClass('warrior'); player._gravitosCineSeen = true; player.invulnerable = 1e12; player._god = true;
  player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;`;
const savedLevel = () => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)).player.level; } catch (e) { return null; } };
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  // ---- a Lv 10 save, made by the game's own flush
  const p0 = await ctx.newPage(); p0.on('pageerror', (e) => errs.push('p0: ' + String(e.message).slice(0, 140)));
  await bootIn(p0);
  await p0.evaluate((setup) => { eval(setup); player.level = 10; player.mojicoins = 1000; game._resetting = false; _flushSaveStateNow(); }, setup);
  const lv0 = await p0.evaluate(savedLevel);
  await p0.close();
  // ---- tab A sits on the title; tab B continues and plays on
  const A = await ctx.newPage(); A.on('pageerror', (e) => errs.push('A: ' + String(e.message).slice(0, 140)));
  await bootIn(A);
  const B = await ctx.newPage(); B.on('pageerror', (e) => errs.push('B: ' + String(e.message).slice(0, 140)));
  await bootIn(B);
  await B.click('#menu-continue');
  const bIn = await inWorld(B);
  await B.evaluate(() => { player.level = 23; player.mojicoins = 777777; _flushSaveStateNow(); });
  await A.waitForTimeout(800);
  const T1 = await A.evaluate(async (savedLevelSrc) => {
    const savedLevel = eval(savedLevelSrc), sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    out.card = (document.getElementById('menu-continue-sub') || {}).textContent || '';
    out.before = savedLevel();
    game._autosaveHeartbeat(); out.heartbeat = savedLevel();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true })); out.hide = savedLevel();
    delete document.hidden;
    window.dispatchEvent(new Event('beforeunload')); out.close = savedLevel();
    saveState(); await sleep(2200); out.debounce = savedLevel();
    return out;
  }, savedLevel.toString());
  // Continue on the stale tab
  await A.click('#menu-continue');
  await A.waitForTimeout(3000);
  const aIn = await inWorld(A);
  const T2 = await A.evaluate(() => ({ level: player.level, coins: player.mojicoins })).catch((e) => ({ err: String(e.message).slice(0, 100) }));
  ok('setup: a Lv 10 save, tab B in the world and saved at Lv 23', lv0 === 10 && bIn && T1.before === 23, { lv0, bIn, before: T1.before });
  ok('1. the title tab writes nothing: heartbeat, tab-hide, close and debounced saves all leave the Lv 23 save', T1.heartbeat === 23 && T1.hide === 23 && T1.close === 23 && T1.debounce === 23, T1);
  ok("1. ...its Continue card shows the other tab's newer save", /Lv\.23\b/.test(T1.card), T1.card);
  ok('1. ...and Continue plays the newer save (Lv 23, its coins)', aIn && T2.level === 23 && T2.coins === 777777, { aIn, ...T2 });
  // ---- 2..5 in tab B (in front, so its loop and play clock run)
  await B.bringToFront();
  const R = await B.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    // 2 boss rush
    const seen0 = game.mojidexSeen, map0 = game.currentMap, best0 = game.bossRushBest;
    game.mojidexSeen = { king: 1 }; game.bossRushBest = null; game.currentMap = 'boss_rush';
    _bossRushAutoStart(); game.currentMap = map0; game.mojidexSeen = seen0;
    const br = game.bossRush;
    const pm0 = game._playMs || 0; await sleep(600); out.clockRuns = (game._playMs || 0) - pm0;   // the play clock runs while unpaused
    const t0 = game.bossRush.tp != null ? game.bossRush.tp : null; if (t0 != null) game.bossRush.tp = game._playMs || 0;   // restart the run's clock at this instant
    if (t0 == null) game.bossRush.t0 = Date.now();
    game.paused = true; await sleep(1600); game.paused = false;
    out.hudPaused = ((document.getElementById('boss-rush-hud') || {}).textContent || '').replace(/^.*·\s*/, '');
    const _dn = Date.now; Date.now = () => _dn() - 3600000;   // the PC clock set back an hour mid-run
    game._playMs = (game._playMs || 0) + 100000;               // 100 s of play
    try { _bossRushOnBossDown({ type: 'king' }); } catch (e) { out.err = e.message; }
    Date.now = _dn;
    out.best = game.bossRushBest ? { timeMs: game.bossRushBest.timeMs, grade: game.bossRushBest.grade } : null;
    try { const r = document.getElementById('boss-rush-results'); if (r) r.remove(); } catch (e) {}
    try { const h = document.getElementById('boss-rush-hud'); if (h) h.remove(); } catch (e) {}
    if (best0) game.bossRushBest = best0; void br;
    // 3 daily roll-over from the heartbeat
    checkDaily(); const today = dailyIndex(); game.dailyState.day = today - 1;
    game._autosaveHeartbeat();
    for (let i = 0; i < 20 && game.dailyState.day !== today; i++) await sleep(250);
    out.daily = { today, day: game.dailyState.day };
    // 4 the Twelve wait for Aetherion
    _ensureQuests(); player.level = 70;
    game.bestiary = game.bestiary || {}; game.bestiary.aetherion = 0; if (game.achievements) game.achievements.aetherionDown = false;
    player.dawnFragments = (player.dawnFragments || []).filter((f) => f !== 'frag_aetherion');
    for (const id of ['q_boss_aries', 'q_zodiac_twelve']) { delete player.quests.unlocked[id]; delete player.quests.active[id]; delete player.quests.completed[id]; }
    player.quests.unlocked.q_zodiac_twelve = true;   // a bare unlock from before the fix
    out.known0 = _lxTwelveKnown();
    tickQuestUnlocks();
    out.before = { ariesU: !!player.quests.unlocked.q_boss_aries, ariesA: !!player.quests.active.q_boss_aries, twelveU: !!player.quests.unlocked.q_zodiac_twelve, accept: acceptQuest('q_zodiac_twelve', true) };
    player.quests.active.q_boss_aries = { progress: 0 }; player.quests.unlocked.q_boss_aries = true; tickQuestUnlocks();
    out.keep = !!player.quests.active.q_boss_aries;
    delete player.quests.active.q_boss_aries; delete player.quests.unlocked.q_boss_aries; delete player.quests.active.q_zodiac_twelve;
    game.bestiary.aetherion = 1; out.known1 = _lxTwelveKnown();
    tickQuestUnlocks();
    out.after = { aries: !!(player.quests.unlocked.q_boss_aries || player.quests.active.q_boss_aries), twelve: !!(player.quests.unlocked.q_zodiac_twelve || player.quests.active.q_zodiac_twelve) };
    // 5 the Lv 40 toast
    const msgs = [], _st = window.showToast; window.showToast = (m, k) => { msgs.push(String(m)); try { return _st(m, k); } catch (e) {} };
    window._lxTeaserPending = 0; player.cls = 'warrior'; _promptClassAdvancement(2); await sleep(3800); window.showToast = _st;
    out.toast = msgs.find((m) => /Distorted Portal/.test(m)) || msgs.join(' | ');
    return out;
  });
  ok('2. a pause adds nothing to the Boss Rush clock (the play clock itself runs)', R.hudPaused === '0:00' && R.clockRuns > 100, { hud: R.hudPaused, clockRuns: R.clockRuns });
  ok('2. a clock set back an hour mid-run still times the run on play time (100 s, grade B, never negative)', !R.err && R.best && R.best.timeMs >= 99000 && R.best.timeMs < 115000 && R.best.grade === 'B', { err: R.err, best: R.best });
  ok('3. the heartbeat opens the new day mid-session', R.daily.day === R.daily.today, R.daily);
  ok('4. before Aetherion falls, Lv 70 neither starts The First-Born nor unlocks The Twelve Houses (a bare old unlock re-locks)', R.known0 === false && !R.before.ariesU && !R.before.ariesA && !R.before.twelveU && R.before.accept === false, { known0: R.known0, ...R.before });
  ok('4. ...a save that already took The First-Born keeps it', R.keep === true);
  ok('4. ...and once she falls both open', R.known1 === true && R.after.aries && R.after.twelve, R.after);
  ok('5. the Lv 40 toast names the captain and the Hidden Pagoda, not the west awning', /Will/.test(R.toast) && /Hidden Pagoda/.test(R.toast) && !/west awning/.test(R.toast), R.toast);
  ok('no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail ? 'FAIL' : 'PASS'}(${fail}) - ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
