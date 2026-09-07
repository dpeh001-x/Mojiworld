// Economy cuts (v0.30.404): Ticket Rush stage caps and coins halved, repeats pay 25%
// coins and 50% EXP, the expedition bonus and EXP share halved, and a boss refight
// pays 30% of its bag. MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10157); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof _lxExpeditionCoinReward === 'function' && typeof _lxPqStageCapFrac === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const o = { ver: GAME_VERSION }; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { loadMap('forest', 300); } catch (e) {} await sleep(300); game.paused = true;
    o.consts = { stageCap: LX_PQ_STAGE_CAP, stageCapLate: LX_PQ_STAGE_CAP_LATE, runAt40: LX_PQ_RUN_AT_40, runAt70: LX_PQ_RUN_AT_70, repeat: LX_PQ_REPEAT_MUL, repeatExp: typeof LX_PQ_REPEAT_EXP_MUL === 'number' ? LX_PQ_REPEAT_EXP_MUL : null, expCap: LX_EXPEDITION_COIN_CAP, expAt40: LX_EXP_RUN_AT_40, expAt70: LX_EXP_RUN_AT_70, refight: typeof LX_REFIGHT_COIN_MUL === 'number' ? LX_REFIGHT_COIN_MUL : null };
    o.capFrac = { l29: _lxPqStageCapFrac(29), l55: +_lxPqStageCapFrac(55).toFixed(4), l80: _lxPqStageCapFrac(80) };
    o.expBonus = { l29: _lxExpeditionCoinReward(29), l45: _lxExpeditionCoinReward(45), l80: _lxExpeditionCoinReward(80), l200: _lxExpeditionCoinReward(200) };
    o.quests = {}; for (const id of ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage', 'q_pq_finale', 'q_clockwork_express']) { const q = QUESTS[id]; o.quests[id] = q && q.rewards ? { coins: q.rewards.mojicoins, exp: q.rewards.exp } : null; }
    player._pqChainRuns = 0; o.repeatMulFirst = _lxPqRepeatMul('q_pq_spire'); player._pqChainRuns = 1; o.repeatMulAgain = _lxPqRepeatMul('q_pq_spire'); player._pqChainRuns = 0;
    // a boss refight: the same boss's coin value at 30% once it has been beaten before
    spawnMonster(player.x + 260, player.y, 'kingKrook', true); const b = game.monsters.filter((x) => x && x.type === 'kingKrook').pop();
    if (b) { const k = _lxBossKey(b); game._bossKills = game._bossKills || {}; game._bossKills[k] = 0; const first = _lxMobCoin(b); game._bossKills[k] = 1; const again = _lxMobCoin(b); game._bossKills[k] = 0; o.refight = { key: k, first, again, ratio: first ? +(again / first).toFixed(3) : null }; game.monsters.splice(game.monsters.indexOf(b), 1); }
    const src = await (await fetch(location.pathname)).text();
    o.src = { repeatExp: src.indexOf("if (LX_PQ_CHAIN_IDS[id] && (player._pqChainRuns | 0) > 0) _questExp = Math.floor(_questExp * LX_PQ_REPEAT_EXP_MUL);") >= 0, express: src.indexOf('mojicoins: 800 + N * 16,') >= 0,
      stage600: src.split('rewards: { mojicoins: 600, exp: 2800, gearChance: 0.15, gearTier: ').length - 1 === 2 && src.indexOf('rewards: { mojicoins: 600, exp: 2000, gearChance: 0.15, gearTier: 3') >= 0, finale4000: src.indexOf('rewards: { mojicoins: 4000, exp: 6500, gearChance: 0.90, gearTier: 5') >= 0, cache1500: src.indexOf('rewards: { mojicoins: 1500, exp: 5000, gearChance: 0.40, gearTier: 4') >= 0 };
    return o;
  });
  console.log('build ' + r.ver + '  consts ' + JSON.stringify(r.consts) + '  refight ' + JSON.stringify(r.refight));
  const c = r.consts;
  ok('PQ EXP caps halved: 2% a stage to Lv 40, 0.5% past 70; the run shares 25% / 8%', c.stageCap === 0.02 && c.stageCapLate === 0.005 && c.runAt40 === 0.25 && c.runAt70 === 0.08 && r.capFrac.l29 === 0.02 && r.capFrac.l80 === 0.005 && r.capFrac.l55 > 0.005 && r.capFrac.l55 < 0.02, JSON.stringify([c, r.capFrac]));
  ok('PQ repeats pay 25% coins and 50% EXP (the EXP hook is in the shipped source)', c.repeat === 0.25 && c.repeatExp === 0.5 && r.repeatMulFirst === 1 && r.repeatMulAgain === 0.25 && r.src.repeatExp, JSON.stringify([r.repeatMulFirst, r.repeatMulAgain, r.src.repeatExp]));
  // the game rescales quest coin rewards at boot (a stage's 600 lands as 296 in the table), so the runtime check is "half of v0.30.403's table" (591 / 3,942 / 1,826) and the authored numbers are checked in the source
  const half = (now, was) => Math.abs(now - was / 2) <= 1;
  ok('PQ coins halved: stages 600, finale 4,000, the express supply cache 1,500 and its run 800 + 16N (runtime table at half of v0.30.403)', half(r.quests.q_clockwork_underpass.coins, 591) && half(r.quests.q_pq_spire.coins, 591) && half(r.quests.q_pq_carriage.coins, 591) && half(r.quests.q_pq_finale.coins, 3942) && half(r.quests.q_clockwork_express.coins, 1826) && r.src.express && r.src.stage600 && r.src.finale4000 && r.src.cache1500, JSON.stringify([r.quests, r.src]));
  ok('expedition bonus halved: 1,000 x Lv/15 capped at 6,000 (Lv 29 1,933; Lv 45 3,000; Lv 80 5,333; Lv 200 6,000)', c.expCap === 6000 && r.expBonus.l29 === 1933 && r.expBonus.l45 === 3000 && r.expBonus.l80 === 5333 && r.expBonus.l200 === 6000, JSON.stringify(r.expBonus));
  ok('expedition EXP share halved: 12% of a level for a full clear to Lv 40, 5% past 70', c.expAt40 === 0.12 && c.expAt70 === 0.05, JSON.stringify([c.expAt40, c.expAt70]));
  ok('a boss refight pays 30% of its bag', c.refight === 0.3 && r.refight && r.refight.first > 0 && r.refight.ratio != null && Math.abs(r.refight.ratio - 0.3) < 0.01, JSON.stringify(r.refight));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
