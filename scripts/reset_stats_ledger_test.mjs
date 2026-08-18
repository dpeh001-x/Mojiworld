// RESET STATS — ledger integrity + no-negative-stats guard.
// ============================================================================
// Reported: "huge bug, when I reset stats, my numbers can look like this" —
// a Lv99 rogue sitting on ATK -12074, Speed -0.3, MP 0.
//
// Cause: applyClass() overwrites baseAtk/baseDef/baseSpeed/baseJump/maxHp/maxMp
// with the new class's starting values but left player._levelUpSpent (and
// _trainerSpent) claiming every point the OLD class had invested. Reset Stats
// then reversed bonuses that were no longer applied, driving stats through
// zero — and refunded SP for them as well, minting points out of a class swap.
//
// Drives the REAL resetStats() (uiConfirm stubbed to auto-accept) rather than
// reimplementing its arithmetic, so the test cannot agree with a bug by
// copying it. Asserts three things:
//   1. a class swap leaves no stale ledger behind
//   2. a swap does not mint SP (invested points come back exactly once)
//   3. no reset can leave any stat negative / below the class baseline
// Run: node scripts/reset_stats_ledger_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9312;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'ResetTest');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*rogue\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const R = await page.evaluate(async () => {
  // auto-accept the confirm so the REAL resetStats() runs end to end
  window.uiConfirm = () => Promise.resolve(true);
  const invest = (id, n) => {
    const o = LEVELUP_OPTIONS.find(x => x.id === id);
    for (let k = 0; k < n; k++) {
      if (player.skillPoints < o.cost) break;
      player.skillPoints -= o.cost;
      player._levelUpSpent[o.id] = (player._levelUpSpent[o.id] || 0) + 1;
      o.apply();
    }
  };
  const ledgerTotal = () => {
    let t = 0;
    for (const o of LEVELUP_OPTIONS) t += (player._levelUpSpent || {})[o.id] || 0;
    const ts = player._trainerSpent || { atk: 0, def: 0, hp: 0 };
    return t + (ts.atk | 0) + (ts.def | 0) + (ts.hp | 0);
  };
  const stats = () => ({
    atk: player.baseAtk, def: player.baseDef, acc: player.baseAcc | 0,
    spd: +(player.baseSpeed || 0).toFixed(2), jmp: +(player.baseJump || 0).toFixed(2),
    maxHp: player.maxHp, maxMp: player.maxMp,
  });
  const negatives = (s) => Object.entries(s).filter(([, v]) => v < 0).map(([k, v]) => `${k}=${v}`);

  player.level = 99;
  player._levelUpSpent = player._levelUpSpent || {};
  player._trainerSpent = { atk: 0, def: 0, hp: 0 };

  // ---- CASE A: invest, swap class, then reset ------------------------------
  player.skillPoints = 5000;
  const spStart = player.skillPoints;
  invest('atk', 900); invest('def', 200); invest('speed', 20); invest('hp', 50); invest('mp', 40);
  const spAfterInvest = player.skillPoints;
  const investedSp = spStart - spAfterInvest;

  applyClass('warrior');
  const ledgerAfterSwap = ledgerTotal();
  const spAfterSwap = player.skillPoints;

  player.mojicoins = 10_000_000;
  if (typeof game !== 'undefined') game.bankCoins = 0;
  resetStats();
  await new Promise(r => setTimeout(r, 350));
  const afterSwapReset = stats();
  const spAfterReset = player.skillPoints;

  // ---- CASE B: plain invest -> reset, no swap (must still work) ------------
  const clsStats = (CLASSES[player.cls] && CLASSES[player.cls].stats) || {};
  player.skillPoints = 3000;
  const spB0 = player.skillPoints;
  const preB = stats();
  invest('atk', 300); invest('def', 100); invest('acc', 50);
  const spB1 = player.skillPoints;
  player.mojicoins = 10_000_000;
  resetStats();
  await new Promise(r => setTimeout(r, 350));
  const postB = stats();
  const spB2 = player.skillPoints;

  // ---- CASE C: an ALREADY-corrupted save must be repaired on load ----------
  // Reproduces the reported character: base stats driven below the class
  // baseline by the old bug, persisted, then reloaded.
  const corrupt = { atk: -12074, spd: -0.3, mp: 0, hp: -5, def: -100 };
  player.baseAtk = corrupt.atk; player.baseSpeed = corrupt.spd;
  player.maxMp = corrupt.mp; player.maxHp = corrupt.hp; player.baseDef = corrupt.def;
  // saveState() no-ops while the prologue gate is up, which would silently
  // make this case test nothing — clear it so the save actually lands.
  window._prologueActive = false; window._prologuePending = false;
  saveState();
  // saveState() is debounced — _flushSaveStateNow does the actual write.
  if (typeof _flushSaveStateNow === 'function') _flushSaveStateNow();
  await new Promise(r => setTimeout(r, 250));
  const savedBytes = (localStorage.getItem(SAVE_KEY) || '').length;
  const loaded = loadState();
  await new Promise(r => setTimeout(r, 350));
  const repaired = stats();

  return {
    corrupt, repaired, negC: negatives(repaired), savedBytes, loaded,
    investedSp, spAfterSwap, spAfterReset, ledgerAfterSwap,
    afterSwapReset, negA: negatives(afterSwapReset),
    clsStats: { atk: clsStats.atk, def: clsStats.def, speed: clsStats.speed, hp: clsStats.hp },
    caseB: {
      preB, postB, negB: negatives(postB),
      spSpent: spB0 - spB1, spRefunded: spB2 - spB1,
      restored: preB.atk === postB.atk && preB.def === postB.def && preB.acc === postB.acc,
    },
  };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 115) });

ok('class swap leaves no stale invested-stat ledger', R.ledgerAfterSwap === 0, `ledger=${R.ledgerAfterSwap}`);
ok('class swap refunds the invested SP exactly once',
   R.spAfterSwap === R.spAfterReset && R.spAfterReset > 0,
   `afterSwap=${R.spAfterSwap} afterReset=${R.spAfterReset} (a later reset must not pay again)`);
ok('reset after a class swap leaves NO negative stat', R.negA.length === 0,
   R.negA.length ? R.negA.join(' ') : JSON.stringify(R.afterSwapReset));
ok('ATK never drops below the class baseline', R.afterSwapReset.atk >= (R.clsStats.atk || 0),
   `atk=${R.afterSwapReset.atk} classBase=${R.clsStats.atk}`);
ok('Speed never drops below the class baseline', R.afterSwapReset.spd >= (R.clsStats.speed || 0),
   `spd=${R.afterSwapReset.spd} classBase=${R.clsStats.speed}`);
ok('MaxMP never lands at 0 from a reset', R.afterSwapReset.maxMp > 0, `maxMp=${R.afterSwapReset.maxMp}`);
// the ordinary path must be unharmed
ok('plain invest -> reset restores the original stats', R.caseB.restored,
   `pre=${JSON.stringify(R.caseB.preB)} post=${JSON.stringify(R.caseB.postB)}`);
ok('plain invest -> reset refunds exactly what was spent', R.caseB.spRefunded === R.caseB.spSpent,
   `spent=${R.caseB.spSpent} refunded=${R.caseB.spRefunded}`);
ok('plain reset leaves no negative stat', R.caseB.negB.length === 0, R.caseB.negB.join(' '));
// an already-broken save (the reported character) must heal on load
ok('case C actually round-tripped a save', R.savedBytes > 0 && R.loaded === true, 'bytes=' + R.savedBytes + ' loaded=' + R.loaded);
ok('a save already corrupted by the old bug is repaired on load', R.negC.length === 0,
   R.negC.length ? R.negC.join(' ') : JSON.stringify(R.repaired));
ok('repaired Speed is walkable, not zero', R.repaired.spd > 0, `spd=${R.repaired.spd}`);
ok('repaired ATK is back at/above the class baseline', R.repaired.atk >= (R.clsStats.atk || 0),
   `atk=${R.repaired.atk} classBase=${R.clsStats.atk}`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
