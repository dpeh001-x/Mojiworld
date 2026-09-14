// What the economy actually pays, measured in the running game.
//
// Per user: "Reduce the chance of getting equipment from quests, monsters, and also reduce overall
// gold gain by 25%".
//
// The quest coin table is worth MEASURING rather than reading off a constant: _lxTrimQuestPay runs a
// banded cut, then a calibration that pins the median, then a per-level ceiling clamps the payout.
// Three passes interact, so the only honest way to know what a quest pays is to ask the built table.
//   node scripts/economy_audit.mjs [port]     (MOJI_GAME_FILE overrides the build)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || 29400);
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);

const r = await page.evaluate(() => {
  const out = {};
  // the quest table, as built (the trim pass runs at boot)
  try {
    if (typeof _lxTrimQuestPay === 'function') _lxTrimQuestPay();   // idempotent
    const coins = [], chances = [];
    let guaranteed = 0, noGear = 0;
    for (const id in QUESTS) {
      const q = QUESTS[id]; if (!q || !q.rewards) continue;
      if (q.rewards.mojicoins) coins.push(q.rewards.mojicoins);
      const g = q.rewards.gearChance;
      if (!g) noGear++;
      else if (g >= 1) guaranteed++;
      else chances.push(g);
    }
    coins.sort((a, b) => a - b);
    const sum = (a) => a.reduce((x, y) => x + y, 0);
    out.questCoins = {
      n: coins.length,
      median: coins[Math.floor(coins.length / 2)],
      mean: Math.round(sum(coins) / coins.length),
      p90: coins[Math.floor(coins.length * 0.9)],
      max: coins[coins.length - 1],
    };
    out.questGear = {
      rolls: chances.length, guaranteed, noGear,
      meanChancePct: +(100 * sum(chances) / chances.length).toFixed(2),
      maxChancePct: +(100 * Math.max(...chances)).toFixed(2),
    };
    out.coinCeilPerLevel = (typeof LX_QUEST_COIN_PER_LEVEL === 'number') ? LX_QUEST_COIN_PER_LEVEL : null;
  } catch (e) { out.questErr = String(e).slice(0, 120); }

  // the non-quest coin scalar
  try { out.coinScalar = (typeof MOJICOIN_GAIN_MULT === 'number') ? MOJICOIN_GAIN_MULT : null; } catch (e) {}

  // what a kill actually pays, end to end, through the real grant path
  try {
    const probe = 10000;
    const beforeC = player.mojicoins;
    const got = _grantMojicoins(probe);
    player.mojicoins = beforeC;
    out.grantOf10k = got;
  } catch (e) { out.grantErr = String(e).slice(0, 120); }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await browser.close().catch(() => {}); server.kill();
