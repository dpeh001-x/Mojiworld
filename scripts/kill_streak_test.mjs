// Slaughter Ladder (v0.29.352) â€” kill-streak boons, verified through the live
// game rather than the ladder table: kill real monsters via killMonster(),
// measure getAtk()/getSpeed()/EXP/coins before vs after, and prove the three
// lifecycle rules â€” map change resets the COUNTER but keeps the boons, death
// wipes both, and illusion kills feed nothing.
//   node scripts/kill_streak_test.mjs
// Env: PW_EXE / PW_CHANNEL (default msedge), PORT (default 8915)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8915;
const server = spawn(process.execPath, [join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch(process.env.PW_EXE
  ? { executablePath: process.env.PW_EXE, headless: true }
  : { channel: process.env.PW_CHANNEL || 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(8000);

const o = await page.evaluate(() => {
  const r = {};
  const arena = Object.entries(MAPS)
    .filter(([id, mp]) => !mp.isVoid && !mp.isTown && (mp.platforms || []).some(p => p.w > 900))
    .sort((x, y) => y[1].worldWidth - x[1].worldWidth)[0];
  loadMap(arena[0]);
  const ww = game.mapData.worldWidth;
  const gy = (game.mapData.platforms || []).filter(p => p.w > 900).sort((x, y) => x.y - y.y)[0].y;
  game.monsters.length = 0;
  player.level = 200; player.maxHp = 999999; player.hp = 999999;
  player._ksTier = 0; game.mapKillStreak = 0;
  player.x = ww * 0.5; player.y = gy - 80;

  // Kill N real monsters through the actual pipeline. Some spawns roll a
  // second life (revive/elite affix): the first killMonster runs the revive
  // branch and the mob STAYS in the array â€” correctly granting no streak
  // credit, because it is not dead. Finish those off so N spawns = N deaths.
  const killN = (n, type) => {
    for (let i = 0; i < n; i++) {
      const m = spawnMonster(ww * 0.5 + 100, gy - 60, type || 'slime', false);
      if (!m || m._suppressed) return false;
      let guard = 0;
      while (game.monsters.indexOf(m) >= 0 && guard++ < 6) {
        m.currentHp = 0; m.hp = 0;
        killMonster(m);
      }
      if (game.monsters.indexOf(m) >= 0) return false;
    }
    return true;
  };

  r.spd0 = getSpeed();

  // ---- climb to 100 (BLOODED, +3% EXP) --------------------------------
  killN(100);
  r.streakAt100 = game.mapKillStreak | 0;
  r.tierAt100 = player._ksTier | 0;
  r.xpMulAt100 = _ksXpMul();

  // EXP boon must show up in a real kill's payout. Slime EXP at level 200
  // floors to 0 through the level-gap curve, so pin m.exp to a big constant
  // and compare the same deterministic kill at tier 1 vs tier 0.
  const paidWithTier = (tier) => {
    // Level 200 is the cap â€” EXP there is discarded entirely, which is why an
    // earlier draft of this probe measured 0 vs 0. Probe at 60: no early-level
    // ramp, no cap, and 135k XP is nowhere near a Lv60 level-up.
    const savedLvl = player.level; player.level = 60;
    const saved = player._ksTier; player._ksTier = tier;
    // _ksOnKill re-derives the tier from the streak on every kill (by design —
    // the ladder is monotonic). A "tier 0" probe with streak still at 100+
    // instantly re-tiers to 1 mid-kill and pays the boon anyway, which made an
    // earlier draft compare 1.03x against 1.03x. Pin the streak per probe.
    game.mapKillStreak = (tier === 0) ? 0 : 150;
    const m = spawnMonster(ww * 0.5 + 100, gy - 60, 'slime', false);
    let guard = 0;
    while (game.monsters.indexOf(m) >= 0 && guard++ < 6) {
      m.exp = 100000; m.currentHp = 0; m.hp = 0;
      const e0 = player.exp;
      killMonster(m);
      if (game.monsters.indexOf(m) < 0) { player._ksTier = saved; player.level = savedLvl; return player.exp - e0; }
    }
    player._ksTier = saved; player.level = savedLvl; return -1;
  };
  r.expPaidT1 = paidWithTier(1);
  r.expPaidT0 = paidWithTier(0);
  r.expBoonPays = r.expPaidT0 > 0 && r.expPaidT1 > r.expPaidT0;
  game.mapKillStreak = 100; // the two probe kills above also fed the counter; re-pin

  // ---- climb to 500 (SLAYER, +2% ATK) ---------------------------------
  killN(400);
  r.tierAt500 = player._ksTier | 0;

  // ---- coin boon at 1000 (BUTCHER, +5% coins) -------------------------
  killN(500);
  r.tierAt1000 = player._ksTier | 0;
  const w0 = player.mojicoins;
  _grantMojicoins(1000, { full: true });
  r.coinPaid = player.mojicoins - w0;                    // expect 1050
  r.coinBoonPays = r.coinPaid > 1000;

  // ---- speed at 250 threshold was crossed on the way; check now --------
  r.spdAt1000 = getSpeed();
  r.spdGrew = r.spdAt1000 > r.spd0;

  // ---- map change: counter resets, boons stay -------------------------
  const otherMap = Object.entries(MAPS).find(([id, mp]) => id !== arena[0] && !mp.isVoid && (mp.platforms || []).length);
  loadMap(otherMap[0]);
  r.streakAfterMapChange = game.mapKillStreak | 0;
  r.tierAfterMapChange = player._ksTier | 0;
  r.mapChangeKeepsBoons = r.tierAfterMapChange === r.tierAt1000 && r.streakAfterMapChange === 0;
  r.atkAfterMapChange = getAtk();

  // ---- illusion kills feed nothing ------------------------------------
  loadMap(arena[0]);
  game.mapKillStreak = 0;
  const mi = spawnMonster(ww * 0.5 + 100, gy - 60, 'slime', false);
  mi._isMirage = true; mi.currentHp = 0; mi.hp = 0;
  killMonster(mi);
  r.mirageFeedsStreak = (game.mapKillStreak | 0) !== 0;

  // ---- ATK: clean back-to-back tier flips ------------------------------
  // Measured adjacently with a big frozen base so nothing else (Mojidex
  // perm-ATK milestones popped during the kills, floor() on a small base)
  // can contaminate the ratio.
  const savedBase = player.baseAtk; player.baseAtk = 10000;
  player._ksTier = 0; r.atkT0 = getAtk();
  player._ksTier = 3; r.atkT3 = getAtk();          // SLAYER: +2%
  player._ksTier = 7; r.atkT7 = getAtk();          // GODSLAYER: +10%
  r.atkT3Ratio = +(r.atkT3 / r.atkT0).toFixed(3);
  r.atkT7Ratio = +(r.atkT7 / r.atkT0).toFixed(3);
  player.baseAtk = savedBase;

  // ---- death wipes everything -----------------------------------------
  player._ksTier = r.tierAt1000; game.mapKillStreak = 777;
  _ksOnDeath();
  r.tierAfterDeath = player._ksTier | 0;
  r.streakAfterDeath = game.mapKillStreak | 0;
  r.deathWipes = r.tierAfterDeath === 0 && r.streakAfterDeath === 0 && _ksAtk() === 0 && _ksXpMul() === 1;
  return r;
});

const results = [];
const ok = (n, c, e) => results.push({ n, pass: !!c, e });
ok('100 kills reaches tier 1 (BLOODED)', o.tierAt100 === 1, `tier ${o.tierAt100}, streak ${o.streakAt100}`);
ok('EXP boon pays out on a real kill', o.expBoonPays, `${o.expPaidT1} vs ${o.expPaidT0} XP`);
ok('500 kills reaches tier 3 (SLAYER)', o.tierAt500 === 3, `tier ${o.tierAt500}`);
ok('1000 kills reaches tier 4 (BUTCHER)', o.tierAt1000 === 4, `tier ${o.tierAt1000}`);
ok('coin boon pays out (+5%)', o.coinBoonPays, `1000 granted as ${o.coinPaid}`);
ok('speed rises with the ladder', o.spdGrew, `${o.spd0} -> ${o.spdAt1000}`);
ok('map change resets counter, keeps boons', o.mapChangeKeepsBoons, `streak ${o.streakAfterMapChange}, tier ${o.tierAfterMapChange}`);
ok('mirage kills feed nothing', !o.mirageFeedsStreak);
ok('SLAYER ATK is +2%', o.atkT3Ratio >= 1.015 && o.atkT3Ratio <= 1.025, `x${o.atkT3Ratio}`);
ok('GODSLAYER ATK caps at +10%', o.atkT7Ratio >= 1.095 && o.atkT7Ratio <= 1.105, `x${o.atkT7Ratio}`);
ok('death wipes boons and streak', o.deathWipes, `tier -> ${o.tierAfterDeath}, streak -> ${o.streakAfterDeath}`);

for (const t of results) console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}${t.e ? '  (' + t.e + ')' : ''}`);
const failed = results.filter(t => !t.pass);
console.log(`\n${results.length - failed.length}/${results.length} assertions pass`);
console.log('pageerrors:', errs.length, errs.slice(0, 3));
await browser.close(); server.kill();
process.exit(failed.length || errs.length ? 1 : 0);
