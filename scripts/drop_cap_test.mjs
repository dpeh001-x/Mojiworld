// What one kill pays, and how often a boon falls.
//
// v0.30.638, per user: "Lv 20 at 150 mojicoin, lv 40 at 250 moji coin, lvl 50 at 350. lv 60 400,
// lv 70+ 500", "Lv 10 at 50 mojicoins", "for Moji coin increase it to such: Lv 80 1,116 -> 500,
// Lv 100 216 -> 500", and "boon drop rate 0.05% for low level monsters to 0.2% for high level
// monsters". So an ordinary monster pays its LEVEL's number (not its row in the stats table), each
// kill rolling its own +/-12%; coin gear multiplies it again but stops at +500%; a boss keeps its bag under its own
// far larger ceiling; and the boon roll runs 0.05% at Lv10 to 0.2% at Lv70+, still limited per hour.
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
  await page.waitForFunction(() => typeof _lxCoinCapForLevel === 'function' && typeof _lxBoonRateForLevel === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; } player.cls = 'warrior'; player.level = 60; player.invulnerable = 9e9; player.hp = player.maxHp = 99999; loadMap('forest', 300); game.paused = false; });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const out = {};
    const MOJI = String.fromCharCode(109, 111, 106, 105, 99, 111, 105, 110);
    const lvOf = (t) => (typeof MOB_NATURAL_LEVEL !== 'undefined' && MOB_NATURAL_LEVEL[t]) || 0;
    const types = Object.keys(monsterTypes).filter((t) => lvOf(t) > 0 && !/tower|dummy/i.test(t));
    out.curve = [5, 10, 20, 30, 40, 50, 60, 70, 80, 100].map((lv) => _lxCoinCapForLevel(lv));
    // difficulty and the world affix scale the level number on purpose; fold them in before comparing
    out.risk = ((typeof _diffCoinMul === 'function') ? _diffCoinMul() : 1) * ((typeof _affixCoinMul === 'function') ? _affixCoinMul() : 1);
    out.mid15 = _lxCoinCapForLevel(15);
    out.boonRates = [5, 10, 20, 40, 60, 70, 100].map((lv) => +(_lxBoonRateForLevel(lv) * 100).toFixed(4));
    // one kill, summed the way the pickup does
    const killPay = (t, lv, greed, crit) => {
      player.level = lv; player.mods = player.mods || {}; player.mods.greed = greed; player.mods.goldBlood = crit ? 0.4 : 0;
      player._activeSynergies = crit ? { treasureCrits: true } : {};
      game.drops.length = 0; game.monsters.length = 0;
      const mm = spawnMonster(700, 400, t); if (!mm || mm._suppressed) return null;
      mm._killedByCrit = crit; mm.currentHp = 0; player.exp = 0;
      killMonster(mm); player.level = lv;
      let g = 0; for (const d of game.drops) if (d && d.type === MOJI && d.value > 0) g += Math.floor(Math.floor(d.value * (1 + greed)) * MOJICOIN_GAIN_MULT);
      return { pay: g, mobLv: (typeof _mobLevel === 'function') ? _mobLevel(mm) : lv, boss: !!(mm.isBoss || mm.boss || mm.zodiacBoss) };
    };
    // a monster in this level window that really dies through killMonster and drops coins
    const pick = (lo, hi) => { for (const t of types) { const L = lvOf(t); if (L <= lo || L > hi) continue; const k = killPay(t, 60, 0, false); if (k && !k.boss && k.pay > 0) return t; } return null; };
    const sample = (t, lv, greed, crit, n) => { const a = []; for (let i = 0; i < n; i++) { const k = killPay(t, lv, greed, crit); if (k && k.pay > 0) a.push(k.pay); } a.sort((x, y) => x - y); return { n: a.length, mean: Math.round(a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)), med: a[a.length >> 1], min: a[0], max: a[a.length - 1], distinct: new Set(a).size }; };
    for (const [key, lo, hi, at] of [['hi', 70, 200, 80], ['mid', 40, 50, 50], ['lo', 10, 20, 20]]) {
      const t = pick(lo, hi); out[key + 'Type'] = t;
      if (!t) continue;
      const lvl = lvOf(t);
      out[key] = { lv: lvl, base: _lxCoinCapForLevel(lvl), want: Math.round(_lxCoinCapForLevel(lvl) * out.risk), plain: sample(t, at, 0, false, 60), geared: sample(t, at, 0.80, true, 60), rich: sample(t, at, 5.0, true, 40) };
      out.gearMax = LX_COIN_GEAR_MAX;
    }
    // a boss keeps its table bag under its own ceiling
    const arena = Object.values(typeof MAPS !== 'undefined' ? MAPS : {}).filter((mp) => mp && mp.isBossArena && mp.bossType).sort((a, b) => (b.levelReq || 0) - (a.levelReq || 0))[0];
    if (arena) { game.monsters.length = 0; const bm = spawnMonster(700, 400, arena.bossType, true); out.bossCap = bm ? _lxKillCoinCap(bm) : 0; out.bossPay = bm ? Math.floor(_lxKillCoinValue(bm, 1, 1) * MOJICOIN_GAIN_MULT) : 0; game.monsters.length = 0; }
    // the hourly boon ceiling
    player.level = 80; player._boonWin = []; out.hourCap80 = _lxBoonHourCap();
    let spent = 0; while (_lxBoonBudgetOk() && spent < 20) { _lxBoonBudgetSpend(); spent++; }
    out.spent80 = spent;
    player.level = 50; player._boonWin = []; out.hourCap50 = _lxBoonHourCap();
    return out;
  });
  console.log(JSON.stringify(r));
  const c = r.curve, near = (got, want, tol) => got >= want * (1 - tol) && got <= want * (1 + tol);
  ok('the curve hits the levels asked for: 50 / 150 / 250 / 350 / 400 / 500', c[1] === 50 && c[2] === 150 && c[4] === 250 && c[5] === 350 && c[6] === 400 && c[7] === 500 && c[8] === 500 && c[9] === 500, c);
  ok('it climbs with the monster and interpolates between those levels', c.every((v, i) => i === 0 || v >= c[i - 1]) && c[3] === 200 && r.mid15 === 100, { curve: c, lv15: r.mid15 });
  for (const k of ['hi', 'mid', 'lo']) {
    const b = r[k];
    ok(`a Lv${b ? b.lv : '?'} monster pays its level number (${b ? b.want : '?'})`, b && near(b.plain.mean, b.want, 0.08) && b.plain.max <= Math.round(b.want * 1.12) + 1, b && { want: b.want, mean: b.plain.mean, med: b.plain.med, max: b.plain.max });
  }
  ok('the payout varies kill to kill rather than being a flat number', r.hi && r.hi.plain.distinct >= 10 && r.hi.plain.min < r.hi.want, r.hi && r.hi.plain);
  ok('coin gear lifts an ordinary kill again (greed + crit boons = x4.5)', ['hi', 'mid', 'lo'].every((k) => r[k] && near(r[k].geared.mean, r[k].plain.mean * 4.5, 0.08)), { hi: r.hi && [r.hi.plain.mean, r.hi.geared.mean], mid: r.mid && [r.mid.plain.mean, r.mid.geared.mean], lo: r.lo && [r.lo.plain.mean, r.lo.geared.mean] });
  ok('and it stops at +500%: no stack pays past six times the level number', r.gearMax === 6 && ['hi', 'mid', 'lo'].every((k) => r[k] && near(r[k].rich.mean, r[k].plain.mean * 6, 0.08) && r[k].rich.max <= Math.round(r[k].want * 6 * 1.12) + 2), { cap: r.gearMax, hi: r.hi && { plain: r.hi.plain.mean, rich: r.hi.rich.mean, max: r.hi.rich.max, ceiling: Math.round(r.hi.want * 6 * 1.12) } });
  ok('the boon roll runs 0.05% on a low-level monster to 0.2% on a Lv70+ one', r.boonRates[0] === 0.05 && r.boonRates[1] === 0.05 && r.boonRates[5] === 0.2 && r.boonRates[6] === 0.2 && r.boonRates[3] === 0.125 && r.boonRates.every((v, i) => i === 0 || v >= r.boonRates[i - 1]), r.boonRates);
  ok('mob boons are still limited per hour: four to Lv60, two above', r.hourCap80 === 2 && r.hourCap50 === 4 && r.spent80 === 2, { at80: r.hourCap80, at50: r.hourCap50, spent: r.spent80 });
  ok('a boss still pays its own bag, far above a monster kill', r.bossCap > 50000 && r.bossPay > 10000, { cap: r.bossCap, pay: r.bossPay });
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
