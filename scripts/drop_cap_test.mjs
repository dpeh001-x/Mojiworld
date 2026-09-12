// What one kill can pay, and how often a boon falls.
//
// v0.30.635 tapered late-game coins and put a ceiling on a kill. v0.30.637 moved that ceiling onto
// the MONSTER (per user: "a per-kill coin ceiling to be 500 for level 70 mobs and above, with some
// variations", "the lower level monsters mojicoin drop scale is fair", "boon drops capped at 0.2%
// for normal monsters"): a Lv70+ monster pays at most ~500 into the wallet, each kill rolling its
// own +/-12%; below Lv70 it follows the levels the user named - Lv10 50, Lv20 150, Lv40 250, Lv50
// 350, Lv60 400 - interpolating between them;
// and a normal monster's boon roll is 0.2%, tapering further above Lv60 and limited per hour.
//   node scripts/drop_cap_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11642), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _lxCoinCapForLevel === 'function' && typeof killMonster === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; } player.cls = 'warrior'; player.level = 60; player.invulnerable = 9e9; player.hp = player.maxHp = 99999; loadMap('forest', 300); game.paused = false; });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const out = {};
    const MOJI = String.fromCharCode(109, 111, 106, 105, 99, 111, 105, 110);
    const lvOf = (t) => (typeof MOB_NATURAL_LEVEL !== 'undefined' && MOB_NATURAL_LEVEL[t]) || 0;
    const types = Object.keys(monsterTypes).filter((t) => lvOf(t) > 0 && !/tower|dummy/i.test(t));
    // the ceiling curve itself
    out.curve = [5, 10, 20, 30, 40, 50, 60, 70, 80, 100].map((lv) => _lxCoinCapForLevel(lv));
    out.top = LX_COIN_CAP_TOP; out.boonNormal = LX_BOON_RATE_NORMAL; out.mid15 = _lxCoinCapForLevel(15);
    // a kill's payout: spawn, kill, sum the piles the way the pickup does
    const killPay = (t, lv, greed, crit) => {
      player.level = lv; player.mods = player.mods || {}; player.mods.greed = greed; player.mods.goldBlood = crit ? 0.4 : 0;
      player._activeSynergies = crit ? { treasureCrits: true } : {};
      game.drops.length = 0; game.monsters.length = 0;
      const m = spawnMonster(700, 400, t); if (!m || m._suppressed) return null;
      m._killedByCrit = crit; m.currentHp = 0; player.exp = 0;
      killMonster(m); player.level = lv;
      let g = 0; for (const d of game.drops) if (d && d.type === MOJI && d.value > 0) g += Math.floor(Math.floor(d.value * (1 + greed)) * MOJICOIN_GAIN_MULT);
      return { pay: g, mobLv: (typeof _mobLevel === 'function') ? _mobLevel(m) : lv, piles: game.drops.filter((d) => d && d.type === MOJI).length };
    };
    const firstKillable = (pool) => { for (const t of pool) { const k = killPay(t, 60, 0, false); if (k && k.pay > 0) return t; } return null; };
    // a Lv70+ monster, geared, over many kills: the ceiling holds and it is not a flat number
    const hi = types.filter((t) => lvOf(t) >= 70);
    const hiType = firstKillable(hi);
    out.hiType = hiType; out.hiPool = hi.length;
    if (hiType) {
      const pays = []; for (let i = 0; i < 120; i++) { const k = killPay(hiType, 80, 0.80, true); if (k) pays.push(k.pay); }
      pays.sort((a, b) => a - b);
      out.hi = { n: pays.length, min: pays[0], med: pays[pays.length >> 1], max: pays[pays.length - 1], mean: Math.round(pays.reduce((a, b) => a + b, 0) / pays.length), distinct: new Set(pays).size };
    }
    // a low-level monster: the ceiling sits above what it actually pays, so nothing is clipped there
    const lo = types.filter((t) => lvOf(t) > 10 && lvOf(t) <= 20);
    const loType = firstKillable(lo);
    out.loType = loType;
    if (loType) {
      const k = killPay(loType, 20, 0, false);
      out.lo = { pay: k && k.pay, lv: k && k.mobLv, ceiling: _lxCoinCapForLevel(k ? k.mobLv : 20) };
    }
    // boon budget, unchanged by this pass
    player.level = 80; player._boonWin = []; out.hourCap80 = _lxBoonHourCap();
    let spent = 0; while (_lxBoonBudgetOk() && spent < 20) { _lxBoonBudgetSpend(); spent++; }
    out.spent80 = spent;
    player.level = 50; player._boonWin = []; out.hourCap50 = _lxBoonHourCap();
    out.boonTaper = { at60: _lxLateBoonMul(60), at100: +_lxLateBoonMul(100).toFixed(3) };
    // a boss keeps its own, far larger ceiling
    const arena = Object.values(typeof MAPS !== 'undefined' ? MAPS : {}).filter((mp) => mp && mp.isBossArena && mp.bossType).sort((a, b) => (b.levelReq || 0) - (a.levelReq || 0))[0];
    if (arena) { game.monsters.length = 0; const bm = spawnMonster(700, 400, arena.bossType, true); out.bossCap = bm ? _lxKillCoinCap(bm) : 0; game.monsters.length = 0; }
    return out;
  });
  console.log(JSON.stringify(r));
  const c = r.curve;
  ok('the ceiling hits the levels asked for: 50 / 150 / 250 / 350 / 400 / 500', c[1] === 50 && c[2] === 150 && c[4] === 250 && c[5] === 350 && c[6] === 400 && c[7] === 500 && c[8] === 500 && c[9] === 500, c);
  ok('it climbs with the monster and interpolates between those levels', c.every((v, i) => i === 0 || v >= c[i - 1]) && c[3] > 150 && c[3] < 250 && r.mid15 === 100, { curve: c, lv15: r.mid15 });
  ok('a geared kill on a Lv70+ monster lands on that ceiling', r.hi && r.hi.max <= Math.round(500 * 1.12) + 1 && r.hi.mean >= 430 && r.hi.mean <= 510, r.hi);
  ok('and it varies kill to kill rather than paying a flat 500', r.hi && r.hi.distinct >= 15 && r.hi.min <= Math.round(500 * 0.95), r.hi);
  ok('a low-level kill is held to its own level ceiling', r.lo && r.lo.pay > 0 && r.lo.pay <= Math.round(r.lo.ceiling * 1.12) + 1, r.lo);
  ok('a normal monster rolls a boon at 0.2%', r.boonNormal === 0.002, r.boonNormal);
  ok('boons still taper above Lv60 and are limited per hour', r.boonTaper.at60 === 1 && r.boonTaper.at100 < 0.6 && r.hourCap80 === 2 && r.hourCap50 === 4 && r.spent80 === 2, { taper: r.boonTaper, at80: r.hourCap80, at50: r.hourCap50 });
  ok('a boss keeps its own far larger ceiling', r.bossCap > 50000, r.bossCap);
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
