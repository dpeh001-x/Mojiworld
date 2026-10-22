// EVERY BOSS QUEST vs THE REAL ECHO (per user: "This boss echo bug seems to be a problem again" / "ensure to fix all bosses quest").
// A tester killed King Gloopaloo, took his quest, and the cleared arena then offered only the Echo Keeper - whose echo did not count.
// v0.30.1698 made echoes tick quests; boss_quest_echo_test.mjs pins that by tagging a spawn as an echo. This sweep drives the REAL path:
// the Echo Keeper's own "Summon the echo" button in the cleared arena, the echo killed through hitMonster, the quest read back.
//   1. the tester's flow: King killed live with no quest, the quest taken after, the echo completes it
//   2. the Nightmare echo counts too
//   3. every quest that names a boss (read from the runtime, so a new boss quest joins by itself) is advanced by its boss's echo;
//      a boss quest whose boss has no echo arena fails here unless NO_ECHO names how it is re-fought instead
//   node scripts/boss_quest_echo_sweep_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11898), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
// bosses whose quests are re-fought another way, not through an Echo Keeper arena
const NO_ECHO = { pqConductor: 'Milo offers the Master Conductor again while a Conductor quest is open' };
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 5000));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof tickQuestUnlocks === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async (NO_ECHO) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    window._lxAutoPause = () => {};   // parallel headless browsers steal focus; a blurred window pauses the game
    await sleep(2500);
    const settle = () => { game.paused = false; try { closeAllModals(); } catch (e) {} const vi = document.getElementById('void-intro-overlay'); if (vi) vi.classList.remove('show'); };
    const fresh = (lv) => { player.level = lv; player.quests = { active: {}, completed: {}, unlocked: {} }; _ensureQuests(); player._god = true; };
    // the arenas, by the boss type their Echo Keeper summons (the same read loadMap makes)
    const arenaOf = {};
    for (const id of Object.keys(MAPS)) { const md = MAPS[id]; if (!md || !md.isBossArena) continue; const be = (md.spawns || []).find((s) => s && s.boss); const bt = (be && be.type) || md.bossType; if (bt && !arenaOf[bt]) arenaOf[bt] = id; }
    // kill whatever is alive of a kind through real hits; a phase that shrugs a hit off three times is finished by killMonster
    const slay = async (pick) => {
      for (let k = 0; k < 10; k++) {
        const e = game.monsters.find((m) => m && m.currentHp > 0 && pick(m)); if (!e) return true;
        e.invulnerable = 0; try { hitMonster(e, e.currentHp + 1e7, false); } catch (x) {}
        await sleep(900);
        if (k >= 2 && game.monsters.includes(e) && e.currentHp > 0) { e.currentHp = 0; killMonster(e); await sleep(900); }
      }
      return !game.monsters.some((m) => m && m.currentHp > 0 && pick(m));
    };
    // the cleared arena: no live boss, the Echo Keeper, his button
    const echo = async (map, label, preCleared) => {
      if (!preCleared) { game.bossDefeated = game.bossDefeated || {}; game.bossDefeated[map] = true; game._bossDefeatedAt = Object.assign(game._bossDefeatedAt || {}, { [map]: game._playMs || 0 }); }
      loadMap(map); await sleep(1400); settle();
      const bt = Object.keys(arenaOf).find((t) => arenaOf[t] === map);
      const live = game.monsters.filter((m) => m && m.type === bt && !m._echoBoss && m.currentHp > 0).length;
      for (const m of [...game.monsters]) if (m && !m.ally && !m.isSummon) { m.currentHp = 0; const i = game.monsters.indexOf(m); if (i >= 0) game.monsters.splice(i, 1); }   // the room's own mobs out of the way
      const keeper = game.npcs.find((n) => n.role === 'echoKeeper'); if (!keeper) return { err: 'no Echo Keeper', live };
      openNPC(keeper); await sleep(250);
      const btn = [...document.querySelectorAll('#dialog-options > *')].find((b) => label.test(b.textContent || ''));
      if (!btn) return { err: 'no button ' + label, live };
      btn.click(); await sleep(400);
      const e = game.monsters.find((m) => m && m._echoBoss && m.currentHp > 0); if (!e) return { err: 'no echo spawned', live };
      const type = e.type, slain = await slay((m) => m._echoBoss);
      return { live, type, slain };
    };
    // 1. the tester's flow
    fresh(12); loadMap('slimeCave'); await sleep(1400); settle();
    out.liveKing = game.monsters.some((m) => m && m.type === 'king' && m.currentHp > 0);
    out.liveSlain = await slay((m) => m.type === 'king');
    out.cleared = !!(game.bossDefeated && game.bossDefeated.slimeCave);
    loadMap('town'); await sleep(900); settle();
    out.accepted = acceptQuest('q_boss_king', true);
    const t1 = await echo('slimeCave', /Summon the echo/, true);
    // release28a re-pin: since v0.30.1759 accepting the quest re-arms the arena (_lxQuestArenaRearm) - the King stands again, no Echo Keeper
    let rearm = null; if (t1.err === 'no Echo Keeper') { loadMap('slimeCave'); await sleep(1400); settle(); rearm = { king: game.monsters.some((m) => m && m.type === 'king' && !m._echoBoss && m.currentHp > 0) }; rearm.slain = await slay((m) => m.type === 'king' && !m._echoBoss); }
    out.tester = { ...t1, rearm, done: !!player.quests.completed.q_boss_king, active: !!player.quests.active.q_boss_king };
    // 2. the Nightmare echo
    fresh(12); player.quests.active.q_boss_king = { progress: 0 };
    const t2 = await echo('slimeCave', /NIGHTMARE echo/, false);
    out.nightmare = { ...t2, done: !!player.quests.completed.q_boss_king };
    // 3. every boss quest
    const isBossT = (t) => { const mt = monsterTypes[t]; return !!(arenaOf[t] || (mt && (mt.boss || mt.isBoss || mt.zodiacBoss))); };
    out.rows = [];
    for (const id of Object.keys(QUESTS)) {
      const q = QUESTS[id]; if (!q || !(q.kind === 'boss' || q.kind === 'kill')) continue;
      const tg = Array.isArray(q.objectives) && q.objectives.length ? q.objectives.map((o) => o.target) : [q.target];
      for (const t of tg) {
        if (!t || !isBossT(t)) continue;
        const row = { id, t };
        if (!arenaOf[t]) { row.skip = NO_ECHO[t] || null; out.rows.push(row); continue; }
        fresh(Math.max(60, q.levelReq || 1)); if (q.cls) player.cls = q.cls;
        player.quests.active[id] = { progress: 0 }; if (q.objectives) player.quests.active[id].objProgress = {};
        Object.assign(row, await echo(arenaOf[t], /Summon the echo/, false));
        const a = player.quests.active[id];
        row.ticked = !!(player.quests.completed[id] || (a && (a.readyToHandIn || (a.objProgress ? (a.objProgress[t] | 0) >= 1 : (a.progress | 0) >= 1))));
        if (q.cls) applyClass('warrior');
        out.rows.push(row);
      }
    }
    return out;
  }, NO_ECHO);
  ok('1a. King Gloopaloo stands in his arena and falls to a live kill, no quest taken', R.liveKing && R.liveSlain, { live: R.liveKing, slain: R.liveSlain });
  ok('1b. the game marks the arena cleared, and the quest can be taken after', R.cleared && R.accepted, { cleared: R.cleared, accepted: R.accepted });
  ok('1c. back in the arena after taking the quest the King stands again (v0.30.1759: accepting re-arms his arena), so there is no Echo Keeper to find', R.tester.err === 'no Echo Keeper' && R.tester.live >= 1 && !!R.tester.rearm && R.tester.rearm.king, R.tester);
  ok('1d. the re-armed King\'s live kill completes The Brimming Tyrant (the tester\'s report: a quest taken after the kill can still be finished)', !!R.tester.rearm && R.tester.rearm.slain && R.tester.done && !R.tester.active, R.tester);
  ok('2. a NIGHTMARE echo completes it too', !R.nightmare.err && R.nightmare.slain && R.nightmare.done, R.nightmare);
  const rows = R.rows.filter((r) => r.skip === undefined), skipped = R.rows.filter((r) => r.skip !== undefined);
  ok('3a. the sweep found the boss quests (at least 16 quest/boss pairs with an echo arena; v0.30.1855: one fight per boss)', rows.length >= 16, rows.length);
  for (const r of rows) ok(`3b. ${r.id}: an echo of ${r.t} (${r.err || 'arena ok'}) advances it`, !r.err && r.slain && r.type === r.t && r.ticked, r);
  for (const r of skipped) ok(`3c. ${r.id}: ${r.t} has no echo arena, and NO_ECHO names its re-fight`, !!r.skip, r.skip || 'add an Echo Keeper arena or a NO_ECHO entry');
  ok('no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
