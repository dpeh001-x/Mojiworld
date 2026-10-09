// CRITICAL QUESTS (v0.30.1561, per user: "put this as a critical storyline quest, there should be a few critical quests to complete
// such as certain key storyline quests and class advancement quests"; picked: mark + prioritise, nothing new blocked).
//   1. exactly nine are critical: The Four Captains, the two class advancements, the five Dawn Fragment quests, and The Last Step
//      (the line past the second advancement: Smith -> the copy on the Last Step -> the Sanctum, per user)
//   2. Lv 20 starts The Four Captains by itself (a ★ CRITICAL toast); the two class advancements are NOT auto-started - your
//      captain offers them under the gold marker - and a Dawn Fragment quest with no giver starts itself once it unlocks (Aetherion at Lv 60; the Forge waits for Brok's errands)
//   3. The Four Captains is met by talking to YOUR captain (another captain does not count)
//   4. a critical quest cannot be abandoned (abandonQuest refuses; its card has no ✕)
//   5. the journal: ★ CRITICAL pill, critical cards first, the Critical chip shows only them, the ★ n/9 meter counts them
//   6. the tracker leads with the earliest active critical quest, marked ★, and shows only that one critical row
//   7. a save that already passed the trial has The Four Captains done (quietly, no reward); no page errors
//   node scripts/critical_quests_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11881), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const CRIT = ['q_four_captains', 'q_inner_dim_trial', 'q_distorted_portal', 'q_boss_sundered_smith', 'q_last_step', 'q_boss_aetherion', 'q_hourglass_5', 'q_boss_aries', 'q_long_dawn_2'];
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof tickQuestUnlocks === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async (CRIT) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('archer'); player.job = null; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = { captains_teaser: true }; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; delete player._storyBeatsSeen.epilogue_gravitos;
    await sleep(2500); const vi = document.getElementById('void-intro-overlay'); if (vi) vi.classList.remove('show');
    loadMap('town', 300); await sleep(900); game.paused = false;
    const toasts = []; const _ts = window.showToast; window.showToast = function (m) { toasts.push(String(m).slice(0, 80)); return _ts.apply(this, arguments); };
    out.flagged = Object.keys(QUESTS).filter((k) => QUESTS[k].critical).sort();
    // 2. Lv 19 -> 20
    player.quests = { active: {}, completed: {}, unlocked: {} }; _ensureQuests();
    for (const k of ['q_act1_waking', 'q_act1_sleepers', 'q_act1_quiet', 'q_act1_recipe', 'q_act1_name', 'q_act1_firstword']) player.quests.completed[k] = 1;
    player.level = 9; tickQuestUnlocks(); out.at9 = !!player.quests.active.q_four_captains; toasts.length = 0;   // v0.30.1630 (per user) The Four Captains opens at Lv 10
    player.level = 10; tickQuestUnlocks(); await sleep(300);
    out.at20 = { active: CRIT.filter((k) => player.quests.active[k]), trialOffered: false, crit: toasts.filter((t) => /CRITICAL/.test(t)), story: toasts.filter((t) => /STORY/.test(t) && /Four Captains/.test(t)) };
    player.level = 20; tickQuestUnlocks(); await sleep(200); out.at20.trialOffered = !!player.quests.unlocked.q_inner_dim_trial; out.at20.activeAt20 = CRIT.filter((k) => player.quests.active[k]);
    // 3. talk: another captain does not count, yours does
    _questTalkTo('Will'); const afterWill = !!player.quests.completed.q_four_captains;
    out.talkTo = QUESTS.q_four_captains.talkTo;
    _questTalkTo('Lady Hong'); await sleep(200);
    out.talk = { afterWill, afterHong: !!player.quests.completed.q_four_captains };
    // 4. abandon refuses
    acceptQuest('q_inner_dim_trial');   // taken from the captain, as the dialog does
    out.abandon = { ret: abandonQuest('q_inner_dim_trial', true), still: !!player.quests.active.q_inner_dim_trial };
    // the portal waits for the job
    player.job = 'sharpshooter'; player.level = 40; tickQuestUnlocks(); out.portal = { active: !!player.quests.active.q_distorted_portal, unlocked: !!player.quests.unlocked.q_distorted_portal };
    player.quests.completed.q_boss_sundered_smith = 1; player.quests.completed.q_last_step = 1;   // the Sanctum opens after the Last Step
    player.level = 60; player.quests.active.q_kill_gummy = { progress: 0 }; tickQuestUnlocks(); out.smith = !!player.quests.active.q_boss_aetherion;
    // 5. the journal
    toggleQuestJournal(); await sleep(400);
    const cards = () => [...document.querySelectorAll('#quest-list .qj-card')];
    const cid = (c) => { const b = c.querySelector('[data-qlocate],[data-qaccept],[data-qabandon]'); return b ? (b.dataset.qlocate || b.dataset.qaccept || b.dataset.qabandon) : null; };
    const list = cards().map((c) => ({ id: cid(c), crit: !!c.querySelector('.tag-crit'), x: !!c.querySelector('[data-qabandon]') }));
    out.journal = { first: list.slice(0, 3).map((x) => x.id), critCards: list.filter((x) => x.crit).map((x) => x.id), critWithX: list.filter((x) => x.crit && x.x).length, nonCritX: list.filter((x) => !x.crit && x.x).length,
      meter: (document.querySelector('.qj-saga-crit') || {}).textContent || '' };
    const chip = document.querySelector('[data-qcat="critical"]'); if (chip) { chip.click(); await sleep(300); }
    const filtered = cards().map((c) => ({ id: cid(c), crit: !!c.querySelector('.tag-crit') }));
    out.chip = { exists: !!chip, n: filtered.length, allCrit: filtered.length > 0 && filtered.every((x) => x.crit) };
    try { _questCat = 'all'; closeAllModals(); } catch (e) {}
    // 6. the tracker
    game.qnavPins = ['q_kill_gummy']; renderQuestTracker(); await sleep(100);
    const rows = [...document.querySelectorAll('#quest-tracker .qt-row.qt-multi .qt-name')].map((n) => n.textContent.trim());
    out.tracker = rows;
    // 7. migration: a save past the trial
    player.quests = { active: {}, completed: { q_inner_dim_trial: 123 }, unlocked: {} }; player.level = 30; const coins0 = player.mojicoins;
    tickQuestUnlocks(); out.migrate = { done: player.quests.completed.q_four_captains === 123, active: !!player.quests.active.q_four_captains, coins: player.mojicoins === coins0 };
    window.showToast = _ts; return out;
  }, CRIT);
  ok('1. exactly the nine are critical', JSON.stringify(R.flagged) === JSON.stringify([...CRIT].sort()), R.flagged);
  ok('2. Lv 10 starts The Four Captains by itself (not at Lv 9); the Mirror Self Trial is offered at Lv 20 and waits to be taken from your captain', !R.at9 && R.at20.active.includes('q_four_captains') && !R.at20.active.includes('q_inner_dim_trial') && R.at20.trialOffered && R.at20.activeAt20.includes('q_four_captains') && !R.at20.activeAt20.includes('q_inner_dim_trial'), R.at20);
  ok('2. ...with a ★ CRITICAL toast and no duplicate STORY toast for it', R.at20.crit.some((t) => /Four Captains/.test(t)) && R.at20.story.length === 0, R.at20);
  ok('3. The Four Captains names your captain (archer: Lady Hong); Will does not count, Lady Hong completes it', JSON.stringify(R.talkTo) === '["Lady Hong"]' && !R.talk.afterWill && R.talk.afterHong, { talkTo: R.talkTo, ...R.talk });
  ok('4. a critical quest cannot be abandoned, even forced', R.abandon.ret === false && R.abandon.still, R.abandon);
  ok('2. the Distorted Portal is offered by the captain (unlocked, not auto-started); the Aetherion quest (no giver; after the Last Step) starts itself at Lv 60', !R.portal.active && R.portal.unlocked && R.smith, { portal: R.portal, smith: R.smith });
  const J = R.journal;
  ok('5. critical cards lead the journal and carry the ★ CRITICAL pill', J.critCards.length >= 2 && J.first.every((id, i) => i >= J.critCards.length || J.critCards.includes(id)), J);
  ok('4. ...no critical card has the abandon ✕ (other cards keep theirs)', J.critWithX === 0 && J.nonCritX >= 1, J);
  ok('5. the ★ meter counts the critical path out of nine', /★\s*\d+\/9/.test(J.meter), J.meter);
  ok('5. the Critical chip shows only critical quests', R.chip.exists && R.chip.allCrit, R.chip);
  ok('6. the tracker leads with the earliest critical quest, marked ★, ahead of a pinned bounty - and only one ★ row', R.tracker.length >= 2 && /^★ /.test(R.tracker[0]) && R.tracker.filter((t) => /^★ /.test(t)).length === 1, R.tracker);
  ok('7. a save already past the trial has The Four Captains done, quietly', R.migrate.done && !R.migrate.active && R.migrate.coins, R.migrate);
  ok('7. no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
