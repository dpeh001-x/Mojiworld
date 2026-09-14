// The v0.30.x economy cut, pinned.
//
// Per user: "Reduce the chance of getting equipment from quests, monsters, and also reduce overall
// gold gain by 25%".
//
// Gold arrives by four routes that do not share a scalar, so this checks each one landed, and it
// also pins the two things deliberately NOT cut - resale, and the authored one-time gear guarantees -
// so a later "finish the job" pass has to be a decision rather than an accident.
//   node scripts/economy_balance_test.mjs [port]     (MOJI_GAME_FILE overrides the build)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || 29410);
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log('  PASS  ' + m); }
  else { fail++; console.log('  FAIL  ' + m + (extra !== undefined ? '  <- ' + extra : '')); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---------------------------------------------------------------- source-level: the monster roll
// This one is arithmetic rather than observable: the rate is a literal inside the kill path, and
// sampling it would need tens of thousands of kills to separate 0.075% from 0.10%.
const src = readFileSync(path.join(ROOT, FILE), 'utf8');
const dm = src.match(/let dropChance = \(tier === 2 \? ([\d.]+) : tier === 1 \? ([\d.]+) : ([\d.]+)\) \* \(1 \+ luck\) \* ([\d.]+) \*/);
console.log('\n  monster gear roll: ' + (dm ? `bases ${dm[1]}/${dm[2]}/${dm[3]} × global ${dm[4]}` : 'NOT FOUND') + '\n');
ok(!!dm, 'the monster gear roll is where the test expects it');
ok(!!dm && dm[4] === '0.015', 'the monster gear global is cut to 0.015', dm && dm[4]);
ok(!!dm && dm[1] === '0.9' && dm[2] === '0.15' && dm[3] === '0.05',
  'and the per-tier bases are untouched, so boss:elite:normal keeps its shape',
  dm && `${dm[1]}/${dm[2]}/${dm[3]}`);
ok(/const GEAR_SELLBACK_PCT = 0\.10;/.test(src),
  'resale is left where the user set it in v0.29.748 (10%), not cut a second time');
ok(/if \(m\.type === 'vigil_vermillion'\) dropChance = 0\.02;/.test(src),
  "Vermillion's flat 2% is still assigned after every multiplier");

// ---------------------------------------------------------------- runtime: the quest table + grant
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(9000);

const r = await page.evaluate(() => {
  const out = {};
  if (typeof _lxTrimQuestPay === 'function') _lxTrimQuestPay();
  const coins = [], chances = []; let guaranteed = 0;
  for (const id in QUESTS) {
    const q = QUESTS[id]; if (!q || !q.rewards) continue;
    if (q.rewards.mojicoins) coins.push(q.rewards.mojicoins);
    const g = q.rewards.gearChance;
    if (g >= 1) guaranteed++; else if (g > 0) chances.push(g);
  }
  coins.sort((a, b) => a - b);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  out.median = coins[Math.floor(coins.length / 2)];
  out.mean = Math.round(sum(coins) / coins.length);
  out.guaranteed = guaranteed;
  out.meanChancePct = +(100 * sum(chances) / chances.length).toFixed(2);
  out.maxChancePct = +(100 * Math.max(...chances)).toFixed(2);
  out.ceil = LX_QUEST_COIN_PER_LEVEL;
  out.scalar = MOJICOIN_GAIN_MULT;
  const b = player.mojicoins; out.grantOf10k = _grantMojicoins(10000); player.mojicoins = b;
  // The per-level coin TARGET is the only lever on ordinary mob kills: _lxKillCoinValue treats this
  // as the wallet-bound figure and divides it back through MOJICOIN_GAIN_MULT, so the scalar cancels
  // for kills and cutting it alone moves them ~0%. Read through the game's own interpolator.
  out.capLv20 = _lxCoinCapForLevel(20);
  out.capLv80 = _lxCoinCapForLevel(80);
  out.bossCapBase = LX_BOSS_COIN_CAP_BASE;
  out.bossCapPerLv = LX_BOSS_COIN_CAP_PER_LV;
  return out;
});
console.log(`\n  quest coins: median ${r.median} · mean ${r.mean} · ceiling ${r.ceil}/level`);
console.log(`  quest gear:  mean ${r.meanChancePct}% · max ${r.maxChancePct}% · ${r.guaranteed} guarantees`);
console.log(`  coin scalar: ${r.scalar}  (a 10,000 grant pays ${r.grantOf10k})\n`);

ok(r.median === 26250, 'the quest coin median is cut 35,000 -> 26,250', r.median);
ok(r.ceil === 3750, 'and the per-level ceiling comes down with it, 5,000 -> 3,750', r.ceil);
ok(r.scalar === 0.375, 'the kill/chest/rebate coin scalar is 0.5 -> 0.375', r.scalar);
ok(r.grantOf10k === 3750, 'so a 10,000 grant actually pays 3,750', r.grantOf10k);
ok(near(r.meanChancePct, 10.22, 0.2), 'the mean quest gear chance is 13.62% -> ~10.22%', r.meanChancePct);
ok(near(r.maxChancePct, 40.5, 0.2), 'and the highest is 54% -> 40.5%', r.maxChancePct);
ok(r.guaranteed === 36, 'the 36 authored one-time guarantees are still guarantees', r.guaranteed);

// --- the lever that actually moves mob kills ------------------------------------------------------
// v0.30.756 cut MOJICOIN_GAIN_MULT and called mob kills done. They were not: the scalar cancels for
// kills by construction, and 400 real kills a band measured Lv80 at 497 -> 493 coins (-0.8%). These
// four numbers are what a kill is actually worth, so they are what the test guards.
ok(r.capLv80 === 375, 'a Lv 70+ monster targets 375 coins, not 500', r.capLv80);
ok(r.capLv20 === 113, 'and a Lv 20 one targets 113, not 150', r.capLv20);
ok(r.bossCapBase === 22500 && r.bossCapPerLv === 1500,
  'the boss coin ceiling came down too, so cap-bound bosses are cut as well',
  r.bossCapBase + ' + ' + r.bossCapPerLv + '/lv');
ok(errs.length === 0, 'no page errors', errs.join(' | '));

await browser.close().catch(() => {}); server.kill();
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
