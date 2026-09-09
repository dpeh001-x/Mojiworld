// Reset Stats costs setshards too (v0.30.454). Per user: "reset stat should also use 1000 set
// shards along with the existing 20% moji coins".
//
// Driven through the REAL flow — resetStats() and its own confirm dialog — and asserted on what the
// wallet, the bank and the shard balance actually hold afterwards, not on the constant.
//   node scripts/reset_stats_price_test.mjs      MOJI_GAME_FILE / MOJI_SERVE_ROOT / PORT override
// Negative control: v0.30.453 charges only the coins and resets with zero setshards in the bag.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10301); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof resetStats === 'function' && typeof totalCoins === 'function' && typeof openLevelUpPanel === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const o = { ver: GAME_VERSION, shardConst: (typeof LX_RESET_STATS_SHARDS !== 'undefined') ? LX_RESET_STATS_SHARDS : null };
    // a character with real invested points to refund
    const arm = (coins, shards) => {
      player.cls = player.cls || 'warrior'; player.level = 60;
      player._levelUpSpent = { hp: 4, atk: 3 };     // 7 ranks across two options
      player._trainerSpent = { atk: 0, def: 0, hp: 0 };
      player.skillPoints = 0;
      player.mojicoins = coins; player.bankBalance = 0;
      player.setshards = shards;
      player.maxHp = (player.maxHp || 500) + 50 * 4; player.baseAtk = (player.baseAtk || 20) + 10 * 3;
    };
    // answer the real confirm dialog
    const confirmYes = async () => {
      for (let i = 0; i < 40; i++) { await sleep(60); const m = document.getElementById('confirm-modal'); if (m && m.style.display !== 'none') break; }
      const body = (document.getElementById('confirm-body') || {}).textContent || '';
      const y = document.getElementById('confirm-yes'); if (y) y.click();
      await sleep(500); return body;
    };
    // --- 1. rich enough for both: both are charged
    arm(100000, 5000);
    const coins0 = totalCoins(), sp0 = player.skillPoints, sh0 = player.setshards;
    resetStats();
    o.body = await confirmYes();
    o.paid = { coinsBefore: coins0, coinsAfter: totalCoins(), coinsPaid: coins0 - totalCoins(), expectCoins: Math.floor(coins0 * 0.20),
               shardsBefore: sh0, shardsAfter: player.setshards, shardsPaid: sh0 - player.setshards,
               spBefore: sp0, spAfter: player.skillPoints, refunded: player.skillPoints - sp0,
               spentCleared: Object.keys(player._levelUpSpent || {}).length === 0 };
    // --- 2. plenty of coins, not enough shards: refused, and NOTHING is charged
    arm(100000, 999);
    const c2 = totalCoins(), s2 = player.setshards, sp2 = player.skillPoints;
    resetStats();
    // the dialog still opens (the price is quoted there); accept it and expect the charge to be refused
    o.shortBody = await confirmYes();
    o.short = { coinsCharged: c2 - totalCoins(), shardsCharged: s2 - player.setshards, spGained: player.skillPoints - sp2,
                stillInvested: (player._levelUpSpent && (player._levelUpSpent.hp | 0)) === 4 };
    // --- 3. what the button says
    try { openLevelUpPanel(); } catch (e) {}
    await sleep(400);
    const btn = document.getElementById('lp-reset-btn');
    o.btn = btn ? { label: (btn.textContent || '').replace(/\s+/g, ' ').trim(), title: btn.getAttribute('title') || '' } : null;
    return o;
  });
  console.log(`build ${r.ver}  LX_RESET_STATS_SHARDS ${r.shardConst}`);
  ok('the price is a named constant of 1,000 setshards', r.shardConst === 1000, String(r.shardConst));
  ok('a reset charges 20% of the coins AND the 1,000 setshards', r.paid.coinsPaid === r.paid.expectCoins && r.paid.shardsPaid === 1000,
    `coins ${r.paid.coinsPaid}/${r.paid.expectCoins}, shards ${r.paid.shardsPaid}`);
  ok('...and still does its job: SP refunded and the invested ledger cleared', r.paid.refunded > 0 && r.paid.spentCleared,
    `+${r.paid.refunded} SP, ledger cleared ${r.paid.spentCleared}`);
  ok('the confirm quotes BOTH prices before you agree to it', /Mojicoins/.test(r.body) && /1000◈|1,000◈/.test(r.body) && /setshards/i.test(r.body), r.body.slice(-120));
  ok('short on shards: the reset is refused and the coins are NOT taken', r.short.coinsCharged === 0 && r.short.shardsCharged === 0,
    `coins charged ${r.short.coinsCharged}, shards charged ${r.short.shardsCharged}`);
  ok('...and the invested points are left exactly where they were', r.short.spGained === 0 && r.short.stillInvested,
    `SP gained ${r.short.spGained}, still invested ${r.short.stillInvested}`);
  ok('the button and its tooltip quote the shard price', !!r.btn && /1000◈/.test(r.btn.label) && /setshard/i.test(r.btn.title), r.btn ? r.btn.label + ' | ' + r.btn.title.slice(0, 80) : 'no button');
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
