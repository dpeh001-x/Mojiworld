// Progress fixes from the bug hunt (v0.30.x progress-fixes).
//   node scripts/progress_fixes_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// 1) a re-accepted Spire quest counts on from the progress it says it restored; 2) the Jump lane stops where ranks
// stop adding (a Dragoon's +2 counts), and Reset Stats keeps the Dragoon's +2.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10977';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof tickQuestVisit === 'function' && typeof resetStats === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 40;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true });
    loadMap('town'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    window.uiConfirm = () => Promise.resolve(true);
  });

  // 1) the Spire: two chests, abandon, re-accept, then chests count on from 2
  const S = await p.evaluate(() => {
    _ensureQuests();
    player.quests.completed.q_clockwork_underpass = Date.now(); player.quests.unlocked.q_pq_spire = 1;
    delete player.quests.completed.q_pq_spire; delete player.quests.active.q_pq_spire;
    if (typeof _LX_PQ_STAGE_MAP !== 'undefined' && _LX_PQ_STAGE_MAP.q_pq_spire) game.currentMap = _LX_PQ_STAGE_MAP.q_pq_spire;
    const prog = () => (player.quests.active.q_pq_spire ? player.quests.active.q_pq_spire.progress | 0 : null);
    acceptQuest('q_pq_spire', true); tickQuestVisit('pq_piece'); tickQuestVisit('pq_piece');
    const before = prog();
    abandonQuest('q_pq_spire', true); acceptQuest('q_pq_spire', true);
    const restored = prog();
    tickQuestVisit('pq_piece');
    const next = prog();
    tickQuestVisit('pq_piece');
    return { before, restored, next, done: !!player.quests.completed.q_pq_spire || !!(player.quests.active.q_pq_spire && player.quests.active.q_pq_spire.readyToHandIn) };
  });
  console.log('spire', JSON.stringify(S));
  check(S.before === 2 && S.restored === 2 && S.next === 3, 'a re-accepted Spire quest restored at 2/4 goes to 3/4 on the next chest (was reset to 1/4)', S);
  check(S.done, 'and the fourth chest finishes it', S);

  // 2) the Jump lane with a Dragoon, then Reset Stats
  const D = await p.evaluate(async () => {
    const cs = CLASSES.warrior.stats;
    player.cls = 'warrior'; player.job = 'knight'; player.master = null;
    player.baseAtk = cs.atk; player.baseDef = cs.def; player.baseSpeed = cs.speed; player.baseJump = cs.jump; player.maxHp = cs.hp; player.maxMp = cs.mp; player.baseAcc = 0;
    player._levelUpSpent = {}; player._trainerSpent = { atk: 0, def: 0, hp: 0 };
    const lane = LEVELUP_OPTIONS.find((o) => o.id === 'jump');
    const capWarrior = lane.cap;
    _lxApplyMasterInner('dragoon');
    const jMaster = player.baseJump, capDragoon = lane.cap;
    player.skillPoints = 100; const sp0 = player.skillPoints;
    _lpInvest('jump', 99);
    const spent = sp0 - player.skillPoints, jInvest = player.baseJump, ranks = (player._levelUpSpent.jump | 0);
    player.mojicoins = 1000000; player.bankBalance = 0; player.setshards = 5000;
    resetStats(); await new Promise((s) => setTimeout(s, 400));
    try { closeAllModals(); } catch (e) {}
    return { classJump: cs.jump, capWarrior, jMaster, capDragoon, ranks, spent, jInvest, jReset: player.baseJump };
  });
  console.log('jump', JSON.stringify(D));
  check(D.capWarrior === (20 - D.classJump) * 2, 'a plain Warrior\'s Jump lane cap is unchanged (' + ((20 - D.classJump) * 2) + ' ranks)', D);
  check(D.jMaster === D.classJump + 2 && D.capDragoon === (20 - D.jMaster) * 2 && D.ranks === D.capDragoon && D.spent === D.ranks * 2 && D.jInvest === 20, 'a Dragoon can only buy the ranks that still add jump - no SP spent for nothing', D);
  check(D.jReset === D.jMaster, "Reset Stats hands back the ranks and keeps the Dragoon's +2 jump", D);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
