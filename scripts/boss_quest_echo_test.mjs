// QUESTS vs ECHOES (v0.30.1698, per user: "Some quests such as King Gloopaloo the Brimming Tyrant ... does not fulfill even when the boss is killed").
// A boss that died is gone for 10 minutes of play; until then the arena offers only the Echo Keeper's echo, and echoes advanced no quest, so a boss
// quest taken after the first kill sat at 0/1 however many echoes fell. Now an ECHO of a quest's boss ticks that quest, whatever kind it is.
//   1. a live kill still completes the quest (unchanged)
//   2. with the arena already cleared, an echo of that boss completes the active boss quest
//   3. an echo also ticks a kill quest, finishes a critical boss quest (Sundered Smith) and the Road's q_road_6 (per user)
//   4. but it is still not a first kill: no daily tick; an echo of another boss, or with the quest not taken, changes nothing; no page errors
//   node scripts/boss_quest_echo_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11897), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof tickQuestUnlocks === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.job = null; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    await sleep(2500); const vi = document.getElementById('void-intro-overlay'); if (vi) vi.classList.remove('show');
    const fresh = () => { player.level = 12; player.quests = { active: {}, completed: {}, unlocked: {} }; _ensureQuests(); player._god = true; };
    const kill = async (type, echo) => {
      const m = spawnMonster(player.x + 300, player.y - 100, type, true); if (!m) return null;
      if (echo) m._echoBoss = true;
      for (let i = 0; i < 3; i++) { m.currentHp = 0; killMonster(m); await sleep(600); if (!game.monsters.includes(m)) break; }   // the Smith revives once: the second fall is the real one
      return m;
    };
    const dailies = []; const _td = window.tickDaily; window.tickDaily = function (k, t) { dailies.push(k + ':' + t); return _td.apply(this, arguments); };
    // 1. a live kill
    fresh(); tickQuestUnlocks(); acceptQuest('q_boss_king', true);
    loadMap('slimeCave'); await sleep(1500); game.paused = false;
    await kill('king', false);
    out.live = !!player.quests.completed.q_boss_king;
    // 2. arena already cleared: only the echo is there
    fresh(); tickQuestUnlocks(); acceptQuest('q_boss_king', true);
    game.bossDefeated = game.bossDefeated || {}; game.bossDefeated.slimeCave = true; game._bossDefeatedAt = { slimeCave: game._playMs || 0 };
    loadMap('slimeCave'); await sleep(1500); game.paused = false;
    out.arena = { kings: game.monsters.filter((m) => m.type === 'king').length, keeper: game.npcs.some((n) => n.name === 'Echo Keeper') };
    dailies.length = 0; await kill('king', true);
    out.echo = { completed: !!player.quests.completed.q_boss_king, active: !!player.quests.active.q_boss_king };
    out.dailies = dailies.filter((d) => /^boss:/.test(d));
    // 3. a kill quest, a critical boss quest, the Road's last quest
    fresh(); const killQ = Object.keys(QUESTS).find((k) => QUESTS[k].kind === 'kill' && QUESTS[k].target === 'slime' && !QUESTS[k].objectives && !QUESTS[k].cls);
    out.killQ = killQ || null; if (killQ) player.quests.active[killQ] = { progress: 0 };
    await kill('slime', true);
    out.kill = killQ ? (player.quests.active[killQ] || player.quests.completed[killQ] ? ((player.quests.active[killQ] || {}).progress | 0) || (player.quests.completed[killQ] ? 'done' : 0) : 0) : null;
    fresh(); player.quests.active.q_boss_sundered_smith = { progress: 0 }; out.critical = !!QUESTS.q_boss_sundered_smith.critical;
    await kill('sundered_smith', true); out.smith = { active: !!player.quests.active.q_boss_sundered_smith, done: !!player.quests.completed.q_boss_sundered_smith };
    fresh(); player.quests.active.q_road_6 = { progress: 0 }; loadMap('slimeCave'); await sleep(1200); game.paused = false;
    await kill('king', true); const a6 = player.quests.active.q_road_6 || {};
    out.road = { ready: !!a6.readyToHandIn, progress: a6.progress | 0, done: !!player.quests.completed.q_road_6 };
    // 4. another boss' echo, and an echo with no quest taken
    fresh(); tickQuestUnlocks(); acceptQuest('q_boss_king', true);
    await kill('mooma', true);
    out.otherBoss = { active: !!player.quests.active.q_boss_king, progress: (player.quests.active.q_boss_king || {}).progress };
    fresh(); await kill('king', true); out.notTaken = Object.keys(player.quests.completed).length;
    return out;
  });
  ok('1. a live kill of King Gloopaloo still completes The Brimming Tyrant', R.live === true, R.live);
  ok('2a. the cleared arena offers only the Echo Keeper (no live king) - the situation that stranded the quest', R.arena.kings === 0 && R.arena.keeper, R.arena);
  ok('2b. an echo of King Gloopaloo completes the active boss quest', R.echo.completed && !R.echo.active, R.echo);
  ok('3a. an echo ticks a kill quest (a slime echo, quest ' + R.killQ + ')', R.killQ && R.kill, R.kill);
  ok('3b. an echo finishes a critical boss quest (Sundered Smith, per user)', R.critical && R.smith.done && !R.smith.active, R.smith);
  ok('3c. an echo of King Gloopaloo carries the Road to the Four\'s last quest (q_road_6) to its hand-in (per user)', R.road.ready || R.road.done || R.road.progress >= 1, R.road);
  ok('4a. it is still not a first kill: an echo ticks no boss daily', R.dailies.length === 0, R.dailies);
  ok('4b. an echo of another boss does not move the quest', R.otherBoss.active && R.otherBoss.progress === 0, R.otherBoss);
  ok('4c. an echo with the quest not taken completes nothing', R.notTaken === 0, R.notTaken);
  ok('no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
