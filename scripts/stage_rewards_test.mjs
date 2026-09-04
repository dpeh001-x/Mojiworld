// A stage is not a quest (v0.30.384): Ticket Rush stages 1-3 pay a fraction of the
// finale in coins, EXP cap, gear chance and potions; the Endless Express run is
// halved and rides the chain's repeat rate; expedition floors pay half their EXP.
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
  ok('stages 1-3 pay a fraction of the finale in coins (~15% each; finale unchanged ~3,942)', ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage'].every((id) => stage(id) && f[id].coins >= 500 && f[id].coins <= 700) && f.q_pq_finale.coins >= 3900 && f.q_pq_finale.coins <= 4000, [f.q_clockwork_underpass.coins, f.q_pq_spire.coins, f.q_pq_carriage.coins, f.q_pq_finale.coins].join('/'));
  ok('stages 1-3 EXP is half the per-stage cap (2% of a level); the finale keeps 4%', ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage'].every((id) => stage(id) && Math.abs(f[id].exp - 0.02) < 0.002) && Math.abs(f.q_pq_finale.exp - 0.04) < 0.002, [f.q_clockwork_underpass.exp, f.q_pq_spire.exp, f.q_pq_carriage.exp, f.q_pq_finale.exp].join('/'));
  ok('stages 1-3 roll gear at 0.15 (0.09 after the normaliser); the finale keeps 0.54', ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage'].every((id) => Math.abs(r.table[id].gear - 0.09) < 0.005) && Math.abs(r.table.q_pq_finale.gear - 0.54) < 0.005, JSON.stringify([r.table.q_clockwork_underpass.gear, r.table.q_pq_finale.gear]));
  ok('stages 1-3 carry stageCapMul 0.5; the finale none', r.table.q_clockwork_underpass.capMul === 0.5 && r.table.q_pq_spire.capMul === 0.5 && r.table.q_pq_carriage.capMul === 0.5 && !r.table.q_pq_finale.capMul);
  ok('stage potions: 2 / 1 / 1 medium HP (was 4 / 3 / 3)', r.table.q_clockwork_underpass.pots.hp_m === 2 && r.table.q_pq_spire.pots.hp_m === 1 && r.table.q_pq_carriage.pots.hp_m === 1, JSON.stringify([r.table.q_clockwork_underpass.pots, r.table.q_pq_spire.pots, r.table.q_pq_carriage.pots]));
  ok('the Endless Express run is halved: 1600 + 32/kill coins, gear 0.40 (was 3200 + 65, 0.80)', !!r.dyn && r.dyn.mojicoins === 1600 + 24 * 32 && r.dyn.gearChance === 0.40, JSON.stringify(r.dyn));
  ok('the Endless Express run paid at Lv 29 matches (2,368) and rides the 40% repeat rate', stage('q_clockwork_express') && f.q_clockwork_express.coins === 2368 && r.expressRepeat === 0.4, JSON.stringify([f.q_clockwork_express.coins, r.expressRepeat]));
  ok('expedition floors pay half their EXP: 2.5% of a level at Lv 29, 1% at Lv 80', Math.abs(r.exp.floor29 - 0.025) < 0.0005 && Math.abs(r.exp.floor80 - 0.01) < 0.0005 && r.exp.floor55 < 0.025 && r.exp.floor55 > 0.01, JSON.stringify(r.exp));
  ok('the expedition victory bonus is unchanged (3,866 at Lv 29, 10,666 at Lv 80)', r.exp.bonus29 === 3866 && r.exp.bonus80 === 10666);
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
