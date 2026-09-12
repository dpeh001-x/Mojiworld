// What a player actually earns: Mojicoins and boons per kill, by level band.
//
// Kills real monsters through killMonster on a field map and reads the coin piles it drops, then
// applies the pickup arithmetic (greed, the 0.5 grind scalar) to get what reaches the wallet. Two
// profiles: PLAIN (no gear, no coin boons) and GEARED (+80% greed, Golden Blood, Hunter's Bounty on
// a crit kill) to bound the top end. Boss bags are computed from the same formula rather than
// killed, so no cutscene can hang the run.
//   node scripts/economy_audit.mjs      MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT / KILLS / ECON_OUT
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync, writeFileSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11640), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const KILLS = Number(process.env.KILLS || 400), OUT = process.env.ECON_OUT || '';
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof killMonster === 'function' && typeof spawnMonster === 'function' && typeof _lxMobCoin === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; } player.cls = 'warrior'; player.level = 60; player.invulnerable = 9e9; player.hp = player.maxHp = 99999; loadMap('forest', 300); game.paused = false; });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async (KILLS) => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const BANDS = [20, 30, 40, 50, 60, 70, 80, 90, 100];
    const lvOf = (t) => (typeof MOB_NATURAL_LEVEL !== 'undefined' && MOB_NATURAL_LEVEL[t]) || (monsterTypes[t] && monsterTypes[t].lv) || 0;
    const types = Object.keys(monsterTypes).filter((t) => lvOf(t) > 0 && !/tower|dummy/i.test(t));
    let boons = 0; const orb = window.spawnPowerupOrb;
    window.spawnPowerupOrb = function () { boons++; return orb.apply(this, arguments); };
    // boss-flagged types also spawn as ordinary mobs (young_confused_barnaby at Lv40 pays ~37k a kill).
    // They are bosses for reward purposes, so keep them out of the grind sample and report bosses separately.
    const bossy = new Set();
    for (const t of types) { game.monsters.length = 0; const m = spawnMonster(700, 400, t); if (m && !m._suppressed && (m.isBoss || m.boss || m.zodiacBoss)) bossy.add(t); }
    game.monsters.length = 0;
    const PROFILES = { plain: { greed: 0, gold: 0, crit: false }, geared: { greed: 0.80, gold: 0.40, crit: true } };
    const out = { bands: {}, boss: {}, meta: { map: game.mapData && game.mapData.name, kills: KILLS } };
    const px = 700, gy = 400;
    for (const L of BANDS) {
      const pool = types.filter((t) => lvOf(t) > L - 10 && lvOf(t) <= L);
      const use = (pool.length ? pool : types.filter((t) => lvOf(t) <= L).slice(-6)).filter((t) => !bossy.has(t));
      out.bands[L] = { types: use.length, hourCap: null, bossySkipped: (pool.length ? pool : []).filter((t) => bossy.has(t)).length };
      for (const [pname, P] of Object.entries(PROFILES)) {
        player.level = L; player.mods = player.mods || {}; player.mods.greed = P.greed; player.mods.goldBlood = P.gold;
        player._activeSynergies = P.crit ? { treasureCrits: true } : {};
        try { out.bands[L].hourCap = _lxBoonHourCap(); } catch (e) {}
        const b0 = boons; const per = [];
        for (let i = 0; i < KILLS; i++) {
          const t = use[i % use.length];
          game.drops.length = 0; game.monsters.length = 0;
          const m = spawnMonster(px, gy, t);
          if (!m || m._suppressed) continue;
          m._killedByCrit = P.crit; m.currentHp = 0; player._boonWin = [];   // raw rate; the hourly ceiling is reported separately
          player.level = L; player.exp = 0;                  // pin the level: a kill grants EXP
          try { killMonster(m); } catch (e) { out.bands[L].err = String(e.message).slice(0, 80); }
          let got = 0;
          for (const d of game.drops) {
            if (!d || d.type !== 'mojicoin' || !(d.value > 0)) continue;
            const amt = Math.floor(d.value * (1 + (player.mods.greed || 0) + (typeof getEquipBonus === 'function' ? getEquipBonus('greed') : 0)));
            got += Math.floor(amt * (typeof MOJICOIN_GAIN_MULT === 'number' ? MOJICOIN_GAIN_MULT : 1));
          }
          per.push(got);
          if (i % 40 === 0) await sleep(0);
        }
        per.sort((a, b) => a - b);
        const sum = per.reduce((a, b) => a + b, 0);
        out.bands[L][pname] = { n: per.length, mean: Math.round(sum / Math.max(1, per.length)), med: per[per.length >> 1] || 0, max: per[per.length - 1] || 0, boons: boons - b0 };
      }
      // boss bag for this band, from the same arithmetic the kill path uses (1-3 piles, avg 2)
      const arena = Object.values(typeof MAPS !== 'undefined' ? MAPS : {}).filter((mp) => mp && mp.isBossArena && mp.bossType && mp.levelReq > L - 10 && mp.levelReq <= L)[0];
      if (arena) {
        game.monsters.length = 0;
        const bm = spawnMonster(px, gy, arena.bossType, true);
        if (bm && !bm._suppressed) {
          const pay = (mul, greed) => { player.mods.greed = greed; try { return _lxKillCoinValue(bm, mul, 1); } catch (e) { return base * mul * ((typeof _diffCoinMul === "function") ? _diffCoinMul() : 1) * ((typeof _affixCoinMul === "function") ? _affixCoinMul() : 1); } };
          const base = _lxMobCoin(bm) * (typeof _monsterCoinMult === 'function' ? _monsterCoinMult(bm) : 1);
          out.boss[L] = { type: arena.bossType, hp: bm.maxHp, tableCoin: bm.mojicoins,
            plain: Math.floor(pay(1, 0) * MOJICOIN_GAIN_MULT), geared: Math.floor(pay(2.5, 0.8) * 1.8 * MOJICOIN_GAIN_MULT) };
          game.monsters.length = 0;
        }
      }
    }
    out.meta.boonTotal = boons;
    return out;
  }, KILLS);
  const F = (n) => Number(n).toLocaleString('en-US');
  console.log(`map ${r.meta.map} - ${r.meta.kills} kills per band per profile\n`);
  console.log('band  types    PLAIN mean      med      max       GEARED mean      med       max     boons/1k');
  for (const [L, b] of Object.entries(r.bands)) {
    const p = b.plain, g = b.geared; if (!p) continue;
    const rate = ((p.boons + g.boons) / Math.max(1, p.n + g.n) * 1000).toFixed(2);
    console.log(`Lv${String(L).padStart(3)}  ${String(b.types).padStart(3)}   ${F(p.mean).padStart(10)} ${F(p.med).padStart(8)} ${F(p.max).padStart(9)}   ${F(g.mean).padStart(12)} ${F(g.med).padStart(9)} ${F(g.max).padStart(9)}   ${rate.padStart(6)}`);
  }
  console.log('\nboss bags (per kill, first clear):');
  for (const [L, b] of Object.entries(r.boss)) console.log(`Lv${String(L).padStart(3)}  ${b.type.padEnd(22)} hp ${F(b.hp).padStart(11)}  plain ${F(b.plain).padStart(9)}  geared ${F(b.geared).padStart(10)}`);
  console.log('\ncoins/hour at 15 kills/min (plain / geared):');
  for (const [L, b] of Object.entries(r.bands)) { if (!b.plain) continue; console.log(`Lv${String(L).padStart(3)}  ${F(b.plain.mean * 900).padStart(12)}  ${F(b.geared.mean * 900).padStart(13)}`); }
  console.log('\npage errors', errs.length, errs.slice(0, 2).join(' | '));
  if (OUT) writeFileSync(OUT, JSON.stringify(r, null, 1));
} finally { await browser.close(); server.kill(); }
