// Late-game coin and boon drops: tapered above Lv60, and no single kill pays past the ceiling.
//
// v0.30.635, per user ("cap and decrease the boon and gold drops at later levels especially above
// level 60"). Below Lv60 nothing changes; above it the base payout decays 2% a level to a 0.40
// floor, one ordinary kill can put at most LX_KILL_COIN_CAP in the wallet (a boss a level-scaled
// ceiling) AFTER greed and the grind scalar, and mob-dropped boons taper and are limited per hour.
//   node scripts/drop_cap_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11642), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const LX_CAP60_EXPECT = 4000;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _lxKillCoinValue === 'function' && typeof killMonster === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; } player.cls = 'warrior'; player.level = 60; player.invulnerable = 9e9; player.hp = player.maxHp = 99999; loadMap('forest', 300); game.paused = false; });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const out = {};
    const lvOf = (t) => (typeof MOB_NATURAL_LEVEL !== 'undefined' && MOB_NATURAL_LEVEL[t]) || 0;
    // the richest ordinary mob in the table, which is what the ceiling has to hold
    const types = Object.keys(monsterTypes).filter((t) => lvOf(t) > 0 && !/tower|dummy/i.test(t));
    let rich = null, richCoin = 0;
    game.monsters.length = 0;
    for (const t of types) { const m = spawnMonster(700, 400, t); if (!m || m._suppressed) continue; const boss = m.isBoss || m.boss || m.zodiacBoss; const c = _lxMobCoin(m); if (!boss && c > richCoin) { richCoin = c; rich = t; } game.monsters.length = 0; }   // boss-flagged types spawn as mobs too; they answer to the boss ceiling
    const wallet = (type, lv, greed, coinMul, boss) => {
      player.level = lv; player.mods = player.mods || {}; player.mods.greed = greed;
      game.monsters.length = 0;
      const m = spawnMonster(700, 400, type, !!boss);
      const v = _lxKillCoinValue(m, coinMul, 1) * (1 + greed) * MOJICOIN_GAIN_MULT;
      const lvl = (typeof _mobLevel === 'function') ? _mobLevel(m) : lv;
      game.monsters.length = 0;
      return { pay: Math.floor(v), mobLv: lvl };
    };
    out.rich = { type: rich, coin: richCoin };
    out.taper = { at60: _lxLateCoinMul(60), at70: +_lxLateCoinMul(70).toFixed(3), at80: +_lxLateCoinMul(80).toFixed(3), at200: _lxLateCoinMul(200) };
    out.boonTaper = { at60: _lxLateBoonMul(60), at100: +_lxLateBoonMul(100).toFixed(3), at300: _lxLateBoonMul(300) };
    // the same mob, plain, at three levels
    out.plain60 = wallet(rich, 60, 0, 1).pay; out.plain80 = wallet(rich, 80, 0, 1).pay; out.plain120 = wallet(rich, 120, 0, 1).pay;
    // stacked: greed gear + the 2.5 crit-coin ceiling, at Lv80
    out.stacked80 = wallet(rich, 80, 0.80, 2.5).pay;
    // a real kill still pays, and pays less at 120 than at 60
    // some entities (pathsBane) do not die through killMonster at all - use the first type that really drops
    const killOnce = (t, lv) => { player.level = lv; player.mods.greed = 0; game.drops.length = 0; game.monsters.length = 0; const m = spawnMonster(700, 400, t); if (!m || m._suppressed) return 0; m.currentHp = 0; player.exp = 0; killMonster(m); player.level = lv; let g = 0; for (const d of game.drops) if (d && d.type === String.fromCharCode(109,111,106,105,99,111,105,110)) g += Math.floor(d.value * MOJICOIN_GAIN_MULT); return g; };
    let killType = null;
    for (const t of types) { if (killOnce(t, 60) > 0) { killType = t; break; } }
    out.killType = killType;
    const real = (lv) => killType ? killOnce(killType, lv) : 0;
    out.kill60 = real(60); out.kill120 = real(120);
    player.level = 80; out.cap = _lxKillCoinCap({});   // the ceiling at Lv80, itself tightened by level
    player.level = 60; out.cap60 = _lxKillCoinCap({});
    // a boss: capped, and still far above a mob kill
    const arena = Object.values(typeof MAPS !== 'undefined' ? MAPS : {}).filter((mp) => mp && mp.isBossArena && mp.bossType).sort((a, b) => (b.levelReq || 0) - (a.levelReq || 0))[0];
    if (arena) { const w = wallet(arena.bossType, 90, 0.80, 2.5, true); out.boss = { type: arena.bossType, pay: w.pay, cap: LX_BOSS_COIN_CAP_BASE + LX_BOSS_COIN_CAP_PER_LV * w.mobLv }; }
    // boon budget: the hourly ceiling, and that it refuses past it
    player.level = 80; player._boonWin = [];
    out.hourCap80 = _lxBoonHourCap();
    let spent = 0; while (_lxBoonBudgetOk() && spent < 20) { _lxBoonBudgetSpend(); spent++; }
    out.spent80 = spent;
    player.level = 50; player._boonWin = [];
    out.hourCap50 = _lxBoonHourCap();
    // an hour later the window has rolled off
    player._boonWin = [Date.now() - 3700000, Date.now() - 3700000, Date.now() - 3700000, Date.now() - 3700000];
    out.rollsOff = _lxBoonBudgetOk();
    return out;
  });
  console.log(JSON.stringify(r));
  ok('nothing changes at or below Lv60 (taper is 1.0)', r.taper.at60 === 1 && r.boonTaper.at60 === 1, r.taper);
  ok('the coin taper decays above Lv60 and floors at 0.40', r.taper.at70 < 1 && r.taper.at80 < r.taper.at70 && r.taper.at200 === 0.40, r.taper);
  ok('the same mob pays less the higher you are', r.plain60 > r.plain80 && r.plain80 > r.plain120, { at60: r.plain60, at80: r.plain80, at120: r.plain120 });
  ok('a stacked greed/crit build cannot pass the per-kill ceiling', r.stacked80 <= r.cap && r.stacked80 > r.cap * 0.5, { stacked: r.stacked80, cap: r.cap });
  ok(`the ceiling itself tightens with level`, r.cap < r.cap60 && r.cap60 === LX_CAP60_EXPECT, { at60: r.cap60, at80: r.cap });
  ok('a boss bag is held to its level-scaled ceiling and still dwarfs a mob', r.boss && r.boss.pay <= r.boss.cap && r.boss.pay > r.plain80 * 20, r.boss);
  ok('mob boons are limited per hour, tighter above Lv60', r.hourCap80 === 2 && r.hourCap50 === 4 && r.spent80 === 2, { at80: r.hourCap80, at50: r.hourCap50, spent: r.spent80 });
  ok('the hourly window rolls off after an hour', r.rollsOff === true);
  ok('the boon rate itself tapers above Lv60', r.boonTaper.at100 < 0.6 && r.boonTaper.at300 === 0.30, r.boonTaper);
  ok('a real kill still pays, and pays less at Lv120 than at Lv60', r.kill60 > 0 && r.kill120 > 0 && r.kill120 < r.kill60, { kill60: r.kill60, kill120: r.kill120 });
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
