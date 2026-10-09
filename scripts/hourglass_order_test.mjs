// HOURGLASS I AND II IN STORY ORDER (per user: "Apply the Hourglass fixes", from the play-order audit). Hourglass I (Lv 40) and II (Lv 40) ran a whole act early:
// their leak is the Magma Foundry / Lava Cavern, ahead of the Smith (45), and III sat 29 levels after them. Now I is Lv 50 and II is Lv 56, the Journal lists them after the Smith
// (and the Last Step) and before the Sanctum, and each keeps the share of its level it always paid (about 15.5%), so the move is not a pay cut.
// Reads the Smith / Last Step / Sanctum levels from the game itself: those belong to the Past-the-Tear line and are not pinned here.
//   [SERVE_ROOT=<dir with serve.js, data, art>] [PORT=n] node scripts/hourglass_order_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '12071';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--')); const FILE = cand ? path.basename(cand) : 'mojiworld_game.html';
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + String(d).slice(0, 300) + ']' : '')); ok ? pass++ : fail++; };
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
  await page.waitForFunction(() => typeof QUESTS === 'object' && typeof _completeQuest === 'function' && typeof _lxLevelCost === 'function' && typeof tickQuestUnlocks === 'function' && typeof _QUEST_STORY_CHAIN === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const R = await page.evaluate(() => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior';
    const Q = QUESTS, C = _QUEST_STORY_CHAIN, out = {};
    const ids = ['q_distorted_portal', 'q_boss_sundered_smith', 'q_hourglass_1', 'q_hourglass_2', 'q_boss_aetherion', 'q_hourglass_3'];
    out.lv = {}; for (const id of ids) out.lv[id] = Q[id] && Q[id].levelReq;
    out.idx = {}; for (const id of ids.concat(['q_last_step'])) out.idx[id] = C.indexOf(id);
    // every quest of the line, in the Journal's order, against its own level
    const line = C.slice(C.indexOf('q_distorted_portal'), C.indexOf('q_hourglass_3') + 1).filter((id) => Q[id]);
    out.line = line.map((id) => [id, Q[id].levelReq]);
    out.exp = {}; for (const id of ['q_hourglass_1', 'q_hourglass_2', 'q_hourglass_3']) out.exp[id] = [Q[id].rewards.exp, +(Q[id].rewards.exp / _lxLevelCost(Q[id].levelReq)).toFixed(4)];
    // unlocking: a hero one level short does not see it, a hero at the level does
    const fresh = () => { player.quests = { active: {}, completed: {}, unlocked: {}, progress: {} }; _ensureQuests(); };
    const open = (id, lv, done) => { fresh(); for (const d of done || []) player.quests.completed[d] = true; player.level = lv; tickQuestUnlocks(); return !!(player.quests.unlocked[id] || player.quests.active[id]); };
    out.unlock = { h1_49: open('q_hourglass_1', 49), h1_50: open('q_hourglass_1', 50), h2_55: open('q_hourglass_2', 55, ['q_hourglass_1']), h2_56: open('q_hourglass_2', 56, ['q_hourglass_1']) };
    // what a hand-in really pays, at the quest's own level
    const hand = (id) => { const q = Q[id]; fresh(); player.level = q.levelReq; player.exp = 0; player.expToNext = _lxLevelCost(q.levelReq); player.quests.active[id] = { targetCount: q.count || 1, rewardScale: 1 };
      player._pqStagePaid = {}; player._pqChainRuns = 0; const lvUp = window._maybeLevelUp; window._maybeLevelUp = function () {}; try { _completeQuest(id); } catch (e) {} finally { window._maybeLevelUp = lvUp; } return player.exp; };
    out.paid = { h1: hand('q_hourglass_1'), h2: hand('q_hourglass_2') };
    return out;
  });
  const L = R.lv, X = R.idx;
  check(L.q_hourglass_1 === 50 && L.q_hourglass_2 === 56 && L.q_hourglass_3 === 69, 'Hourglass I is Lv 50, II is Lv 56, III stays Lv 69', J(L));
  check(L.q_boss_sundered_smith < L.q_hourglass_1 && L.q_hourglass_2 < L.q_boss_aetherion, 'the Smith comes before Hourglass I and the Sanctum after Hourglass II (by level)', J(L));
  check(X.q_distorted_portal < X.q_boss_sundered_smith && X.q_boss_sundered_smith < X.q_hourglass_1 && X.q_hourglass_1 < X.q_hourglass_2 && X.q_hourglass_2 < X.q_boss_aetherion && X.q_boss_aetherion < X.q_hourglass_3,
    "the Journal lists them in order: portal, Smith, Hourglass I, II, the Sanctum, III", J(X));
  check(X.q_last_step < 0 || (X.q_boss_sundered_smith < X.q_last_step && X.q_last_step < X.q_hourglass_1), 'the Last Step (when the build has it) sits between the Smith and Hourglass I', J(X));
  const asc = R.line.every((e, i) => i === 0 || e[1] >= R.line[i - 1][1]);
  check(asc, 'every quest of the line, portal to Hourglass III, is in non-decreasing level order', J(R.line));
  const E = R.exp;
  check(E.q_hourglass_1[1] >= 0.15 && E.q_hourglass_1[1] <= 0.16 && E.q_hourglass_2[1] >= 0.15 && E.q_hourglass_2[1] <= 0.16, 'Hourglass I and II still pay about 15.5% of their own level (not a pay cut)', J(E));
  check(E.q_hourglass_1[0] < E.q_hourglass_2[0] && E.q_hourglass_2[0] < E.q_hourglass_3[0], 'the arc still pays more as it climbs (I < II < III)', J(E));
  check(R.unlock.h1_49 === false && R.unlock.h1_50 === true, 'Hourglass I opens at Lv 50, not at 49', J(R.unlock));
  check(R.unlock.h2_55 === false && R.unlock.h2_56 === true, 'Hourglass II opens at Lv 56, not at 55 (with I done)', J(R.unlock));
  check(R.paid.h1 === 966198 && R.paid.h2 === 1696446, 'a hand-in pays the written EXP (966198 and 1696446)', J(R.paid));
  check(errs.length === 0, 'no page errors', errs.join(' | '));
} finally { await browser.close(); try { server.kill(); } catch (e) {} }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
