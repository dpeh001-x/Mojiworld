// A stage is not a quest (v0.30.384): Ticket Rush stages 1-3 pay a fraction of the
// finale in coins, EXP cap, gear chance and potions; the Endless Express run is
// halved and rides the chain's repeat rate; expedition floors pay half their EXP.
// RE-PINNED on v0.30.854 - every number below is the v0.30.384 rule as later releases left it, and each check names the release:
//   v0.30.404  PQ coins and EXP caps halved again, repeats 40% -> 25%, the expedition coin bonus halved
//   v0.30.453  expedition EXP put back to 0.30 / 0.20 of a level per run (per user: the figure originally asked for)
//   v0.30.756  quest coins -25% (TARGET_MEDIAN 35,000 -> 26,250) and quest gear chance x0.60 -> x0.45
//   v0.30.833  a FIRST run is paid in full (the stage-paid stamp was written before the repeat multiplier was read)
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9957); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof QUESTS === 'object' && typeof _completeQuest === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const o = { ver: GAME_VERSION };
    try { _lxBootGateDone = true; _prologueActive = false; _prologuePending = false; } catch (e) {}
    try { loadMap('forest', 300); } catch (e) {} await new Promise((r) => setTimeout(r, 300)); game.paused = true;
    if (!player.cls) player.cls = 'warrior';
    const lc = (lv) => _lxLevelCost(lv);
    const _g0 = _grantMojicoins; window._gLog = []; _grantMojicoins = function (n, opt) { window._gLog.push([n, !!(opt && opt.full)]); return _g0.apply(this, arguments); };
    player.quests = player.quests || {}; player.quests.completed = player.quests.completed || {}; player.quests.active = player.quests.active || {}; player.quests.progress = player.quests.progress || {};
    const turnIn = (id, lv) => { player.level = lv; player.exp = 0; player.mojicoins = 0; delete player.quests.completed[id]; player.quests.active[id] = { started: game.time, targetCount: 24 }; window._gLog = []; try { _completeQuest(id); } catch (e) { return { err: String(e && e.message) }; } const f = window._gLog.filter((x) => x[1]); return { coins: f.length ? f[0][0] : 0, exp: +((player.exp || 0) / lc(lv)).toFixed(4) }; };
    // The first quest a save EVER turns in also pays a one-off achievement (+3,000 coins and a whole level), which made Stage 1 - always
    // first in this loop - read 0.0007 of a level while stages 2 and 3 read 0.01. A throwaway turn-in absorbs it; then the per-stage
    // 'has paid' record (v0.30.x) is cleared so the five runs below really are FIRST runs.
    turnIn('q_pq_carriage', 29); player._pqStagePaid = {};
    player._pqChainRuns = 0; o.first = {}; for (const id of ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage', 'q_pq_finale', 'q_clockwork_express']) o.first[id] = turnIn(id, 29);
    _grantMojicoins = _g0;
    o.table = {}; for (const id of ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage', 'q_pq_finale', 'q_clockwork_express']) { const q = QUESTS[id]; o.table[id] = { gear: q.rewards.gearChance, pots: q.rewards.potions, capMul: q.stageCapMul }; }
    o.dyn = QUESTS.q_clockwork_express.dynamicRewardFn ? QUESTS.q_clockwork_express.dynamicRewardFn({ targetCount: 24 }) : null;
    player._pqChainRuns = 1; o.expressRepeat = (typeof _lxPqRepeatMul === 'function') ? _lxPqRepeatMul('q_clockwork_express') : null; player._pqChainRuns = 0;
    o.exp = { floor29: +(_lxExpeditionRunTarget(29) / 10).toFixed(4), floor55: +(_lxExpeditionRunTarget(55) / 10).toFixed(4), floor80: +(_lxExpeditionRunTarget(80) / 10).toFixed(4), bonus29: _lxExpeditionCoinReward(29), bonus80: _lxExpeditionCoinReward(80) };
    return o;
  });
  const f = r.first;
  console.log('build ' + r.ver + '  first run @29: ' + JSON.stringify(f));
  const stage = (id) => f[id] && !f[id].err;
  // v0.30.404 halved the authored coins (stages 1,200 -> 600, finale 8,000 -> 4,000); v0.30.756 then cut every quest's coins 25% through the
  // boot calibration, which pins the MEDIAN quest - so the table moves a few percent whenever the quest list does (214 / 1,424 on v0.30.854
  // against an exact 222 / 1,478). The 15% shape is exact (one uniform factor cannot move it); the level gets 8% of slack.
  const near = (now, want, tol) => Math.abs(now / want - 1) <= tol;
  ok('stages 1-3 pay 15% of the finale in coins; the finale is 4,000 authored -> ~1,478 in the table (v0.30.404 halved, v0.30.756 -25%)', ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage'].every((id) => stage(id) && near(f[id].coins / f.q_pq_finale.coins, 0.15, 0.01)) && near(f.q_pq_finale.coins, 4000 * (3942 / 8000) * 0.75, 0.08), [f.q_clockwork_underpass.coins, f.q_pq_spire.coins, f.q_pq_carriage.coins, f.q_pq_finale.coins].join('/'));
  // v0.30.404 halved the per-stage cap (LX_PQ_STAGE_CAP 0.04 -> 0.02 of a level); stages 1-3 still take half of it (stageCapMul 0.5)
  ok('stages 1-3 EXP is half the per-stage cap (1% of a level); the finale keeps the full 2% (v0.30.404)', ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage'].every((id) => stage(id) && Math.abs(f[id].exp - 0.01) < 0.001) && Math.abs(f.q_pq_finale.exp - 0.02) < 0.001, [f.q_clockwork_underpass.exp, f.q_pq_spire.exp, f.q_pq_carriage.exp, f.q_pq_finale.exp].join('/'));
  // v0.30.756 (per user: gear gets rarer from quests) moved the boot normaliser GEAR_MUL 0.60 -> 0.45: 0.15 lands as 0.0675, the finale's 0.90 as 0.405
  ok('stages 1-3 roll gear at 0.15 (0.0675 after the v0.30.756 normaliser); the finale keeps 0.90 (0.405)', ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage'].every((id) => Math.abs(r.table[id].gear - 0.0675) < 0.003) && Math.abs(r.table.q_pq_finale.gear - 0.405) < 0.003, JSON.stringify([r.table.q_clockwork_underpass.gear, r.table.q_pq_finale.gear]));
  ok('stages 1-3 carry stageCapMul 0.5; the finale none', r.table.q_clockwork_underpass.capMul === 0.5 && r.table.q_pq_spire.capMul === 0.5 && r.table.q_pq_carriage.capMul === 0.5 && !r.table.q_pq_finale.capMul);
  ok('stage potions: 2 / 1 / 1 medium HP (was 4 / 3 / 3)', r.table.q_clockwork_underpass.pots.hp_m === 2 && r.table.q_pq_spire.pots.hp_m === 1 && r.table.q_pq_carriage.pots.hp_m === 1, JSON.stringify([r.table.q_clockwork_underpass.pots, r.table.q_pq_spire.pots, r.table.q_pq_carriage.pots]));
  // v0.30.404 halved it again: 1600 + 32N -> 800 + 16N (gear stays at the v0.30.384 0.40; the run is priced at turn-in, so no boot normaliser)
  ok('the Endless Express run: 800 + 16/kill coins, gear 0.40 (v0.30.404; was 1600 + 32, and 3200 + 65 / 0.80 before v0.30.384)', !!r.dyn && r.dyn.mojicoins === 800 + 24 * 16 && r.dyn.gearChance === 0.40, JSON.stringify(r.dyn));
  // v0.30.404: the repeat rate went 40% -> 25% (LX_PQ_REPEAT_MUL). 1,184 = 800 + 16 x 24 paid in full, because this IS a first run (v0.30.833)
  ok('the Endless Express run paid at Lv 29 matches (1,184) and rides the 25% repeat rate', stage('q_clockwork_express') && f.q_clockwork_express.coins === 1184 && r.expressRepeat === 0.25, JSON.stringify([f.q_clockwork_express.coins, r.expressRepeat]));
  // v0.30.453 (per user: the figure originally asked for was 'after 70 cap at about 0.2 per run', and two halvings had left a quarter of it):
  // a full 10-floor run is 0.30 of a level to Lv 40 and 0.20 from Lv 70, so a floor is 3% / 2%
  ok('expedition floors: 3% of a level at Lv 29, 2% at Lv 80, tapering between (v0.30.453)', Math.abs(r.exp.floor29 - 0.03) < 0.0005 && Math.abs(r.exp.floor80 - 0.02) < 0.0005 && r.exp.floor55 < 0.03 && r.exp.floor55 > 0.02, JSON.stringify(r.exp));
  // v0.30.404 halved the coin bonus: 1,000 x Lv / 15, capped at 6,000 (was 2,000 x Lv / 15, capped at 12,000)
  ok('the expedition victory bonus: 1,933 at Lv 29, 5,333 at Lv 80 (v0.30.404 halved it)', r.exp.bonus29 === 1933 && r.exp.bonus80 === 5333, JSON.stringify([r.exp.bonus29, r.exp.bonus80]));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
