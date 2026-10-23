// Ready hand-in quests stop counting (fix-overkill-count), a legacy Tear VI is paid through The Last Step (fix-tear6-legacy), and The Tear IV no longer points at the retired order book.
//   node scripts/quest_overkill_legacy_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>)
// The first quest of the game (I - The Waking, 10 snails, hand it in to Nurse Joyce) kept counting after the tenth snail and the Journal read 16/10. A save from before the
// one-spine change that held The Tear VI ready to hand in lost the whole Last Step reward: the retired quest was purged first, then the Last Step was marked done unpaid.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10633';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const env = { ...process.env }; delete env.MOJI_GAME_FILE;
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errs = []; const URL = `http://localhost:${PORT}/${FILE}`;
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof tickQuestKill === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 }); await p.waitForTimeout(3000);
  const R = await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; window._prologueAfterCreation = false; window._lxAwaitingCreation = false; window._lxInWorld = true;
    player._tutorialSeen = true; applyClass('warrior'); player.level = 1; player.hp = getMaxHp();
    for (const k of Object.keys(STORY_BEATS)) (player._storyBeatsSeen = player._storyBeatsSeen || {})[k] = true;
    window._playStoryBeat = () => true; loadMap('forest'); await new Promise((s) => setTimeout(s, 2000));
    const out = {}, A = () => player.quests.active;
    // ---- P1: the first quest, ten snails and then six more
    player.quests = { active: {}, completed: {}, unlocked: {} }; tickQuestUnlocks(); acceptQuest('q_act1_waking', true);
    for (let i = 0; i < 10; i++) tickQuestKill('snail', false);
    out.ten = { p: A().q_act1_waking.progress, ready: !!A().q_act1_waking.readyToHandIn };
    for (let i = 0; i < 6; i++) tickQuestKill('snail', false);
    out.sixteen = { p: A().q_act1_waking.progress, ready: !!A().q_act1_waking.readyToHandIn };
    toggleQuestJournal && (document.getElementById('quest-modal').style.display !== 'flex') && toggleQuestJournal(); _questTab = 'active'; _questCat = 'all'; renderQuestJournal();
    const jt = (document.getElementById('quest-modal').innerText || '').replace(/\s+/g, ' ');
    out.journal = { has10: /\b10\s*\/\s*10\b/.test(jt), has16: /\b16\s*\/\s*10\b/.test(jt) };
    out.line = _lxQuestProgressLine('q_act1_waking', A().q_act1_waking);
    A().q_act1_waking.progress = 16;   // a save made while the count ran on
    renderQuestJournal(); const jt2 = (document.getElementById('quest-modal').innerText || '').replace(/\s+/g, ' ');
    out.saved16 = { has10: /\b10\s*\/\s*10\b/.test(jt2), has16: /\b16\s*\/\s*10\b/.test(jt2), line: _lxQuestProgressLine('q_act1_waking', A().q_act1_waking) };
    _lxBankQuestProgress('q_act1_waking', A().q_act1_waking); out.banked = player._qBank.q_act1_waking.progress;
    // a multi-objective hand-in quest: counts to its quotas, completes once, then holds
    const sum = (id) => QUESTS[id].objectives.reduce((t, o) => t + o.count, 0);
    const mid = Object.keys(QUESTS).filter((id) => { const q = QUESTS[id]; return q.objectives && q.objectives.length >= 2 && !q.cls; }).sort((x, y) => sum(x) - sum(y))[0];
    if (mid) {   // made a hand-in quest for the test, then put back
      const q = QUESTS[mid], had = [q.handIn, q.giver]; q.handIn = true; q.giver = q.giver || 'Nurse Joyce'; A()[mid] = { progress: 0 };
      for (const o of q.objectives) for (let i = 0; i < o.count; i++) tickQuestKill(o.target, false);
      const a1 = JSON.stringify(A()[mid]); for (const o of q.objectives) for (let i = 0; i < 3; i++) tickQuestKill(o.target, false);
      out.multi = { id: mid, ready: !!A()[mid].readyToHandIn, held: JSON.stringify(A()[mid]) === a1, sum: sum(mid), p: A()[mid].progress };
      q.handIn = had[0]; q.giver = had[1]; delete A()[mid];
    }
    // ---- P2: a save from before the one-spine change, The Tear VI ready to hand in
    const legacy = (setup) => {
      player.level = 55; player.job = 'berserker'; player.master = 'warlord';
      player.quests = { active: {}, completed: {}, unlocked: {} };
      for (const id of ['q_distorted_portal', 'q_visit_lavaCavern', 'q_boss_sundered_smith', 'q_lyra_aperture', 'q_lyra_loan', 'q_lyra_tear', 'q_lyra_cut']) player.quests.completed[id] = Date.now();
      game.bestiary = game.bestiary || {}; delete game.bestiary._lastStepEarly; game.bestiary.miraFallen = 0; game.bossDefeated = game.bossDefeated || {};
      setup(); const c0 = player.mojicoins, e0 = player.exp;
      tickQuestUnlocks(); const c1 = player.mojicoins, e1 = player.exp; tickQuestUnlocks(); tickQuestUnlocks();
      return { done: !!player.quests.completed.q_last_step, tear6: !!player.quests.active.q_lyra_last, dCoins: c1 - c0, dExp: e1 - e0, again: [player.mojicoins - c1, player.exp - e1] };
    };
    out.tear6Ready = legacy(() => { player.quests.active.q_lyra_last = { progress: 1, readyToHandIn: true }; game.bestiary.miraFallen = 1; });
    out.tear6Paid = legacy(() => { player.quests.active.q_lyra_last = { progress: 1 }; game.bestiary.miraFallen = 1; });
    out.tear6Unstarted = legacy(() => { player.quests.active.q_lyra_last = { progress: 0 }; });
    out.tear6Old = legacy(() => { player.quests.completed.q_lyra_last = Date.now(); game.bestiary.miraFallen = 1; });   // already paid by the old quest: nothing owed
    out.reward = QUESTS.q_last_step.rewards;
    // ---- P3
    out.kin = QUESTS.q_lyra_kin.desc;
    return out;
  });
  check(R.ten.p === 10 && R.ten.ready, 'I - The Waking is ready to hand in on the tenth snail', R.ten);
  check(R.sixteen.p === 10 && R.sixteen.ready, 'six more snails do not move the count past the target', R.sixteen);
  check(R.journal.has10 && !R.journal.has16, 'the Journal card reads 10/10', R.journal);
  check(/\b10 of 10\b/.test(R.line), 'the dialog line reads "10 of 10"', R.line);
  check(R.saved16.has10 && !R.saved16.has16 && /\b10 of 10\b/.test(R.saved16.line), 'an already saved 16 of 10 displays as 10/10', R.saved16);
  check(R.banked === 10, 'abandoning banks the target, not the overshoot', R.banked);
  check(R.multi && (R.multi.ready && R.multi.held && R.multi.p === R.multi.sum), 'a multi-objective hand-in quest still fills each quota, completes once and then holds', R.multi);
  const paid = (x) => x.done && !x.tear6 && x.dCoins > 0 && x.dExp > 0 && x.again[0] === 0 && x.again[1] === 0;
  check(paid(R.tear6Ready), 'a legacy Tear VI ready to hand in is paid through The Last Step, exactly once', R.tear6Ready);
  check(R.tear6Ready.dCoins >= (R.reward.mojicoins || 0), 'the Last Step pays its whole reward (it carries The Tear VI\'s share)', { got: R.tear6Ready.dCoins, reward: R.reward });
  check(paid(R.tear6Paid), 'a Tear VI with the copy felled but not yet ready is paid the same way', R.tear6Paid);
  check(!R.tear6Unstarted.tear6 && R.tear6Unstarted.dCoins === 0 && !R.tear6Unstarted.done, 'a Tear VI never started (the copy still stands) owes nothing and the Last Step stays open', R.tear6Unstarted);
  check(R.tear6Old.done && R.tear6Old.dCoins === 0, 'a save that already finished the old Tear VI keeps it quiet: no second payment', R.tear6Old);
  check(!/order book/i.test(R.kin) && !/Barnaby/.test(R.kin) && /runs past a forge\.$/.test(R.kin), 'The Tear IV no longer points at the retired order book', R.kin.slice(-140));
  console.log('errors:', errs.slice(0, 4));
} catch (e) { console.log('ERROR', String(e && e.stack || e).slice(0, 600)); bad++; total++; }
await browser.close().catch(() => {}); try { srv.kill(); } catch (e) {}
console.log(`${total - bad}/${total} checks passed`); process.exit(bad ? 1 : 0);
