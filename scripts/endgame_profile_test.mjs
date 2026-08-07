// ENDGAME DEV PRESET MUST STAY TRUE (v0.29.NEXT).
//
// The 🎯 ENDGAME STATS dev button bakes a per-class stat table describing the
// character the user specified: LEVEL 100, NO ascensions, every SP spent, and
// best-in-slot gear at MAX_STARS. A baked table is fast and stable but goes
// stale silently the moment a class base stat, a per-level growth value, an SP
// payout, a gear item or a tier/star multiplier changes — and a dev tuning
// combat against stale numbers is worse than having no preset at all.
//
// So this rebuilds that exact character INSIDE the live game and compares what
// the game's own getAtk / getDef / getMaxHp / getMaxMp / getCrit report against
// the baked values. Any drift past the tolerance fails with the new numbers, so
// the fix is to paste them back into _LX_ENDGAME_PROFILES.
// Run: node scripts/endgame_profile_test.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.argv[2] || 'mojiworld_game.html';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto('file:///' + path.join(ROOT, FILE).replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof getAtk === 'function' && typeof _LX_ENDGAME_PROFILES !== 'undefined', { timeout: 60000 });

const out = await page.evaluate(() => {
  const LV = _LX_ENDGAME_LEVEL, SP = (LV - 1) * 3;      // 3 SP/level, no prestige AP
  const topOf = (arr, k) => arr.slice().sort((a, c) => (c[k] | 0) - (a[k] | 0))[0];
  const mk = (it, stars) => JSON.parse(JSON.stringify({ ...it, stars }));
  const STARS = (typeof MAX_STARS === 'number') ? MAX_STARS : 10;
  const live = {};
  for (const cls of Object.keys(_LX_ENDGAME_PROFILES)) {
    const s = CLASSES[cls].stats;
    const gAtk = cls === 'warrior' ? 3 : 2, gDef = cls === 'warrior' ? 2 : 1;
    const gHp = cls === 'warrior' ? 28 : cls === 'mage' ? 12 : 18;
    const gMp = cls === 'mage' ? 22 : 12;
    player.cls = cls; player.level = LV;
    player.baseAtk = s.atk + gAtk * (LV - 1);
    player.baseDef = s.def + gDef * (LV - 1);
    player.baseAcc = 0; player.baseSpeed = s.speed; player.baseJump = s.jump;
    player.maxHp = s.hp + gHp * (LV - 1);
    player.maxMp = s.mp + gMp * (LV - 1);
    // keep the REAL mods object — replacing it with a partial one NaNs getAtk
    player.mods = player.mods || { atk: 0, def: 0, speed: 0, jump: 0 };
    game.prestige = { count: 0, xpMult: 1, dmgMult: 1, bonusAP: 0, critBonus: 0, hpBonus: 0 };
    const spdRanks = 10, each = Math.floor((SP - spdRanks) / 4);
    player.baseSpeed += spdRanks * 0.5;
    player.maxHp += each * 50; player.baseAtk += each * 10;
    player.baseDef += each * 10; player.baseAcc += each * 5;
    player.equipped = {
      weapon: mk(topOf(ITEM_POOL.weapons, 'atk'), STARS),
      armor: mk(topOf(ITEM_POOL.armors, 'def'), STARS),
      accessory: mk(topOf(ITEM_POOL.accessories, 'atk'), STARS),
    };
    player._equipBonusCache = null;
    live[cls] = {
      atk: Math.round(getAtk()), def: Math.round(getDef()),
      maxHp: Math.round(getMaxHp()), maxMp: Math.round(getMaxMp()),
      crit: Math.round(getCrit()), speed: +getSpeed().toFixed(2), acc: player.baseAcc,
    };
  }
  // v0.29.542 — god-mode must OUTRANK the achievable ceiling. The dev cheat
  // shipped at a flat 4999, which is ~7x BELOW a level-100 archer, so it handed
  // devs a weaker character than a real save. Assert it stays ahead on every
  // stat rather than trusting the multiplier by eye.
  const god = (typeof _lxDevGodStats === 'function') ? _lxDevGodStats() : null;
  const peak = { atk: 0, def: 0, maxHp: 0, maxMp: 0, acc: 0 };
  for (const p of Object.values(_LX_ENDGAME_PROFILES)) for (const k of Object.keys(peak)) peak[k] = Math.max(peak[k], p[k]);
  return { LV, SP, stars: STARS, baked: _LX_ENDGAME_PROFILES, live, god, peak };
});
await browser.close();

const TOL = 0.02;   // 2% — absorbs rounding, catches any real balance shift
let bad = 0, driftBad = 0, godBad = 0;
console.log(`reference: level ${out.LV}, 0 ascensions, ${out.SP} SP, best-in-slot @${out.stars}*\n`);
console.log('class     stat     baked      live     drift');
for (const cls of Object.keys(out.baked)) {
  for (const k of ['atk', 'def', 'maxHp', 'maxMp', 'crit', 'speed', 'acc']) {
    const b = out.baked[cls][k], l = out.live[cls][k];
    const drift = b ? Math.abs(l - b) / b : (l ? 1 : 0);
    const ok = drift <= TOL;
    if (!ok) { bad++; driftBad++; }
    if (!ok || process.env.VERBOSE) {
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${cls.padEnd(8)} ${k.padEnd(6)} ${String(b).padStart(8)}  ${String(l).padStart(8)}  ${(drift * 100).toFixed(1)}%`);
    }
  }
}
if (!bad) console.log('  (all 28 values within tolerance — set VERBOSE=1 to list them)');

if (!out.god) { console.log('\n  FAIL  _lxDevGodStats is missing'); bad++; godBad++; }
else {
  console.log('\ngod-mode vs the achievable ceiling:');
  for (const k of ['atk', 'def', 'maxHp', 'maxMp', 'acc']) {
    const ahead = out.god[k] > out.peak[k];
    if (!ahead) { bad++; godBad++; }
    console.log(`  ${ahead ? 'PASS' : 'FAIL'}  ${k.padEnd(6)} god ${String(out.god[k]).padStart(9)}  vs peak achievable ${String(out.peak[k]).padStart(8)}  (x${(out.god[k] / out.peak[k]).toFixed(1)})`);
  }
}
console.log(errs.length ? '\npage errors: ' + errs.slice(0, 3).join(' | ') : '\nno page errors');
// Two independent guards fail for different reasons; report them separately so
// a god-mode regression is never misread as endgame-table drift.
if (driftBad) console.log(`\n${driftBad} baked value(s) have drifted — update _LX_ENDGAME_PROFILES with the live column`);
if (godBad) console.log(`\n${godBad} god-mode stat(s) no longer outrank the achievable ceiling — raise _LX_GODMODE_MUL`);
if (!bad) console.log('\nall good — the baked endgame table matches the live game, and god-mode outranks it');
process.exit(bad || errs.length ? 1 : 0);
