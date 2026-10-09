// THE SMITH WAITS FOR BARNABY IV (per user, 2026-10-09: "Smith waits for Barnaby IV", from the play-order audit). The Forge That Broke could be won before Barnaby's
// chapters, whose last two then said "make the Smith put the hammer down" about a man already gone. Now: The Forge That Broke needs the portal AND Barnaby IV; Barnaby II
// (The Roll Call) is a visit to the Sundered Forge instead of a second Smith kill (he falls once in the chain, in IV); the Journal lists Barnaby I-IV before the Smith; and a
// hand-off that cannot start the next quest names what it waits on. Reads the Past-the-Tear levels and lines from the game; it does not pin them.
//   [SERVE_ROOT=<dir with serve.js, data, art>] [PORT=n] node scripts/smith_gate_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '12091';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--')); const FILE = cand ? path.basename(cand) : 'mojiworld_game.html';
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + String(d).slice(0, 320) + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } }); await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof QUESTS === 'object' && typeof tickQuestUnlocks === 'function' && typeof tickQuestVisit === 'function' && typeof _lxAct1Next === 'function' && typeof _QUEST_STORY_CHAIN === 'object' && typeof _completeQuest === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const R = await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.job = 'knight'; player.master = null;
    const Q = QUESTS, C = _QUEST_STORY_CHAIN, out = {};
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const B = ['q_barnaby_five', 'q_barnaby_roll', 'q_barnaby_hands', 'q_barnaby_finish'];
    out.def = { smith: Q.q_boss_sundered_smith.prereq, smithCrit: !!Q.q_boss_sundered_smith.critical, roll: { kind: Q.q_barnaby_roll.kind, target: Q.q_barnaby_roll.target, count: Q.q_barnaby_roll.count, boss: !!Q.q_barnaby_roll.bossFight, mapReal: !!MAPS[Q.q_barnaby_roll.target], mapLv: (MAPS[Q.q_barnaby_roll.target] || {}).levelReq },
      finish: { kind: Q.q_barnaby_finish.kind, target: Q.q_barnaby_finish.target }, hands: { target: Q.q_barnaby_hands.target }, lv: B.concat(['q_boss_sundered_smith']).map((id) => Q[id].levelReq) };
    out.idx = {}; for (const id of ['q_distorted_portal'].concat(B, ['q_boss_sundered_smith', 'q_last_step'])) out.idx[id] = C.indexOf(id);
    const fresh = () => { player.quests = { active: {}, completed: {}, unlocked: {}, progress: {} }; _ensureQuests(); };
    const base = () => { fresh(); for (const k of C) { if (k === 'q_distorted_portal') break; player.quests.completed[k] = 1; } player.quests.completed.q_distorted_portal = 1; player.level = 45; };
    // the gate: portal done, Lv 45, Barnaby unfinished -> the Smith stays shut; finish IV -> he opens
    base(); player.quests.completed.q_visit_lavaCavern = 1; tickQuestUnlocks(); await sleep(150);
    out.gate = { noBarnaby: !!(player.quests.unlocked.q_boss_sundered_smith || player.quests.active.q_boss_sundered_smith) };
    for (const k of ['q_barnaby_five', 'q_barnaby_roll', 'q_barnaby_hands']) player.quests.completed[k] = 1; tickQuestUnlocks(); await sleep(150);
    out.gate.throughIII = !!(player.quests.unlocked.q_boss_sundered_smith || player.quests.active.q_boss_sundered_smith);
    player.quests.completed.q_barnaby_finish = 1; tickQuestUnlocks(); await sleep(250);
    out.gate.afterIV = !!(player.quests.unlocked.q_boss_sundered_smith || player.quests.active.q_boss_sundered_smith);
    // Barnaby II walks to the Forge: another map does not count, the Forge does
    base(); player.quests.completed.q_visit_lavaCavern = 1; player.quests.completed.q_barnaby_five = 1; tickQuestUnlocks();
    acceptQuest('q_barnaby_roll'); const a0 = player.quests.active.q_barnaby_roll;
    out.visit = { accepted: !!a0 };
    tickQuestVisit('lavaCavern'); out.visit.otherMap = !!(player.quests.active.q_barnaby_roll && player.quests.active.q_barnaby_roll.readyToHandIn) || !!player.quests.completed.q_barnaby_roll;
    tickQuestVisit('sundered_forge'); out.visit.forge = !!(player.quests.active.q_barnaby_roll && player.quests.active.q_barnaby_roll.readyToHandIn) || !!player.quests.completed.q_barnaby_roll;
    // the hand-off from the portal names what the Smith waits on
    base(); delete player.quests.completed.q_distorted_portal; const toastsKeep = []; out.hand = {};
    player.quests.completed.q_distorted_portal = 1; out.hand.none = _lxAct1Next('q_distorted_portal');
    player.quests.completed.q_visit_lavaCavern = 1; out.hand.errandDone = _lxAct1Next('q_distorted_portal');
    for (const k of B) player.quests.completed[k] = 1; out.hand.allDone = _lxAct1Next('q_distorted_portal');
    // handing in IV (not III) puts the Smith back in his arena at once
    const hand = (id) => { fresh(); const q = Q[id]; player.level = 45; player.exp = 0; player.expToNext = _lxLevelCost(45); player.quests.active[id] = { targetCount: q.count || 1, rewardScale: 1 }; player._pqStagePaid = {}; player._pqChainRuns = 0;
      game.bossDefeated = game.bossDefeated || {}; game._bossDefeatedAt = game._bossDefeatedAt || {}; game.bossDefeated.sundered_forge = true; game._bossDefeatedAt.sundered_forge = game._playMs || 0;
      const lvUp = window._maybeLevelUp; window._maybeLevelUp = function () {}; try { _completeQuest(id); } catch (e) {} finally { window._maybeLevelUp = lvUp; }
      return { standing: !game.bossDefeated.sundered_forge && game._bossDefeatedAt.sundered_forge === undefined, done: !!player.quests.completed[id] }; };
    out.respawn = { hands: hand('q_barnaby_hands'), finish: hand('q_barnaby_finish') };
    return out;
  });
  const D = R.def, X = R.idx;
  check(Array.isArray(D.smith) && D.smith.indexOf('q_distorted_portal') >= 0 && D.smith.indexOf('q_barnaby_finish') >= 0, 'The Forge That Broke needs the portal AND Barnaby IV', J(D.smith));
  check(D.roll.kind === 'visit' && D.roll.target === 'sundered_forge' && D.roll.count === 1 && !D.roll.boss && D.roll.mapReal && D.roll.mapLv <= D.lv[1], 'Barnaby II (The Roll Call) is a visit to the Sundered Forge, not a Smith kill', J(D.roll));
  check(D.finish.kind === 'boss' && D.finish.target === 'sundered_smith' && D.hands.target === 'young_confused_barnaby', 'Barnaby III still faces the boy and Barnaby IV still ends the Smith', J([D.finish, D.hands]));
  check(X.q_distorted_portal < X.q_barnaby_five && X.q_barnaby_five < X.q_barnaby_roll && X.q_barnaby_roll < X.q_barnaby_hands && X.q_barnaby_hands < X.q_barnaby_finish && X.q_barnaby_finish < X.q_boss_sundered_smith && X.q_boss_sundered_smith < X.q_last_step,
    'the Journal lists the portal, Barnaby I-IV, the Smith, then the Last Step', J(X));
  check(D.lv.every((v, i, a) => i === 0 || v >= a[i - 1]), "Barnaby's chapters and the Smith stay in non-decreasing level order", J(D.lv));
  check(R.gate.noBarnaby === false && R.gate.throughIII === false && R.gate.afterIV === true, 'at Lv 45 with the portal done the Smith stays shut until Barnaby IV is done, then opens', J(R.gate));
  check(R.visit.accepted && R.visit.otherMap === false && R.visit.forge === true, 'Barnaby II completes on entering the Sundered Forge, not on another map', J(R.visit));
  check(/waits on/.test(R.hand.none) && /Recover the Forge-Key/.test(R.hand.none) && /Brok/.test(R.hand.none), "the portal's hand-off names what the Smith waits on (the Forge-Key errand, see Brok)", R.hand.none);
  check(/waits on/.test(R.hand.errandDone) && /Five Stories About a Smith/.test(R.hand.errandDone) && /Brok/.test(R.hand.errandDone), 'with the errand done it names Barnaby I instead', R.hand.errandDone);
  check(!/waits on/.test(R.hand.allDone), 'with Barnaby finished the hand-off no longer says "waits on" (the Smith starts)', R.hand.allDone);
  check(R.respawn.hands.done && R.respawn.hands.standing === false && R.respawn.finish.done && R.respawn.finish.standing === true, 'handing in Barnaby IV (not III) puts the Smith back in his arena at once', J(R.respawn));
  check(errs.length === 0, 'no page errors', errs.join(' | '));
} finally { await browser.close(); try { server.kill(); } catch (e) {} }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
