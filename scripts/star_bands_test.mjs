// Live test: THE ANVIL BITES HARDER PAST SIX, AND EVERY STAR PAYS MORE THAN THE ONE BEFORE.
//
// Odds, per user: "the fail rate should be higher after level 6 of enhancement" - the odds bands, unchanged.
// Reward, per user (v0.30.1589): "Make enhancement increase stats to a greater extent with higher increments at higher
// stars". The two reward bands this file used to pin (x1.08 / x1.12 a star to 7, then x1.15 / x1.20) are one step per
// star now, STAR_STEPS and STAR_SIG_STEPS, each step bigger than the last - so the old 'reward rises at seven' band,
// and the deliberate 6 -> 7 gap with it, are gone. What is pinned instead: every star pays its own step in every slot,
// each star's gain is bigger than the one before, no star is worth less than it was, and a 10-star piece is worth
// much more.
//
// The odds are checked both as declared (starSuccessRate, the function the code
// calls) and as OBSERVED - 800 real attemptEnhance calls with the real RNG, so
// the declared number is proved to be the one actually rolled against. The stat
// curve is measured through getEquipBonus, the cache combat reads.
//   node scripts/star_bands_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
// tests-ports: PORT / MOJI_GAME_FILE from the environment (scripts/apply_tests_ports.mjs); unset = the old defaults
const FILE = process.env.MOJI_GAME_FILE ? process.env.MOJI_GAME_FILE.split(/[\\/]/).pop() : 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2] || process.env.PORT;
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
// MOJI_SERVE_ROOT lets this run against a tree other than the repo working copy. That copy is
// shared with parallel sessions here and is routinely many commits behind origin/main, so without
// it the suite grades a build nobody is shipping.
const SERVE_ROOT = process.env.MOJI_SERVE_ROOT
  || (await import('node:path')).default.resolve((await import('node:url')).fileURLToPath(import.meta.url), '../..');
const srv = spawn(process.execPath, [(await import('node:path')).default.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof starSuccessRate === 'function' && typeof getEquipBonus === 'function'
  && typeof STAR_STEPS !== 'undefined' && typeof attemptEnhance === 'function', null, { timeout: 120000 });
await page.waitForTimeout(1500);

const r = await page.evaluate(() => {
  const out = { riskFrom: STAR_RISK_FROM, steps: STAR_STEPS.slice(), sigSteps: STAR_SIG_STEPS.slice() };
  out.rates = []; for (let s = 0; s < 10; s++) out.rates.push(starSuccessRate(s));

  // ---- the stat curve, through the real payout cache ----
  const mk = (slot, stars) => ({ name: 'probe', slot, tier: 8, stars, atk: 100, def: 100, hp: 100 });   // v0.30.1596: T8, the tier whose growth is the steps exactly
  const at = (slot, stars, key) => {
    player.equipped = { weapon: null, armor: null, accessory: null };
    player.equipped[slot] = mk(slot, stars);
    refreshGearCache();
    return getEquipBonus(key);
  };
  const SIGKEY = { weapon: 'atk', armor: 'def', accessory: 'hp' };
  const OTHER  = { weapon: 'hp',  armor: 'hp',  accessory: 'atk' };
  out.sigAt = {}; out.otherAt = {};
  for (const slot of ['weapon', 'armor', 'accessory']) {
    out.sigAt[slot] = []; out.otherAt[slot] = [];
    const s0 = at(slot, 0, SIGKEY[slot]), o0 = at(slot, 0, OTHER[slot]);
    for (let n = 0; n <= 10; n++) {
      out.sigAt[slot].push(+(at(slot, n, SIGKEY[slot]) / s0).toFixed(4));
      out.otherAt[slot].push(+(at(slot, n, OTHER[slot]) / o0).toFixed(4));
    }
  }
  player.equipped = { weapon: null, armor: null, accessory: null };
  refreshGearCache();

  // v0.30.1596 - the potential by tier: a weapon's ATK at star 10 over star 0, tier by tier, through the same payout cache
  out.pot = [];
  for (let t = 1; t <= 10; t++) {
    const w = (stars) => { player.equipped = { weapon: { name: 'tier probe', slot: 'weapon', tier: t, stars, atk: 100 }, armor: null, accessory: null };
      refreshGearCache(); return getEquipBonus('atk'); };
    out.pot.push(+(w(10) / w(0)).toFixed(4));
  }
  player.equipped = { weapon: null, armor: null, accessory: null };
  refreshGearCache();

  // ---- and the odds as they are actually ROLLED ----
  // The anvil animation is neutralised for the sample only: 800 sprite loops
  // would queue 800 intervals and it has nothing to do with the roll under
  // test. The RNG, the rate lookup and the branch are all untouched.
  const _anim = window._playForgeAnim; window._playForgeAnim = function () {};
  const _sfx = window._playUiSfx; window._playUiSfx = function () {};
  const sample = (stars, n) => {
    const it = mk('weapon', stars); it.name = 'rate probe';
    let win = 0;
    for (let i = 0; i < n; i++) {
      it.stars = stars; it._pity = 0;              // no pity drift across the sample
      player.mojicoins = 99999999;
      attemptEnhance(it);
      if (it.stars > stars) win++;
    }
    return win / n;
  };
  out.observed = { s5: sample(5, 800), s8: sample(8, 800) };
  window._playForgeAnim = _anim; window._playUiSfx = _sfx;
  return out;
});

// The expectation is restated here from the thresholds rather than read back
// out of the page, so this is a check and not an echo.
const prod = (steps, n) => steps.slice(0, n).reduce((a, b) => a * b, 1);
const expSig  = (n) => +prod(r.sigSteps, n).toFixed(4);
const expBase = (n) => +prod(r.steps, n).toFixed(4);
// the curve before v0.30.1589 (x1.12 / x1.08 a star to 7, then x1.20 / x1.15), pinned so no star can come out worse
const OLD_SIG  = [1, 1.12, 1.2544, 1.4049, 1.5735, 1.7623, 1.9738, 2.2107, 2.6528, 3.1834, 3.8201];
const OLD_BASE = [1, 1.08, 1.1664, 1.2597, 1.3605, 1.4693, 1.5869, 1.7138, 1.9709, 2.2665, 2.6065];
const OLD_RATES = [95, 87, 79, 71, 63, 55, 47, 39, 31, 23];
// v0.30.x (per user: "reduce chance of success of enhancement from 8 to 10 stars") added a
// THIRD band from the star-7 attempt, dropping 15 a star instead of 10, and lowered the floor
// 12 -> 8 so the star-9 rung sits on an authored number. These were [.., 45, 35, 25, 15].
const EXPECT_RATES = [95, 87, 79, 71, 63, 55, 45, 30, 15, 8];
const EXPECT_FLOOR = 8;
const near = (a, b, t) => a != null && Math.abs(a - b) <= (t || 0.02);
const S = r.sigAt || {}, O = r.otherAt || {};
const step = (arr, n) => +(arr[n] - arr[n - 1]).toFixed(4);

ok('risk still rises at six: the odds bands are untouched by the reward curve',
  r.riskFrom === 6, { riskRisesAtStar: r.riskFrom });
ok('nothing at or below \u26055 moved by a single point',
  r.rates.slice(0, 6).every((v, i) => v === OLD_RATES[i]),
  { rates0to5: r.rates.slice(0, 6), previously: OLD_RATES.slice(0, 6) });
ok('from the \u26056 attempt on, the odds fall away faster',
  r.rates.slice(6).every((v, i) => v === EXPECT_RATES[6 + i] && v < OLD_RATES[6 + i]),
  { rates6to9: r.rates.slice(6), previously: OLD_RATES.slice(6),
    failRateNow: r.rates.slice(6).map(v => (100 - v) + '%'), failRateBefore: OLD_RATES.slice(6).map(v => (100 - v) + '%') });
// The star-9 rung now SITS on the floor by design, so "every rung clears it" is no longer the
// claim - the claim is that the floor is where the authored table says it is, and that pity is
// what carries the grind from there (+6% a failure, capped +30%: a star-9 attempt climbs 8 -> 38).
ok('nothing falls below the authored floor, and the last rung sits exactly on it',
  r.rates.every(v => v >= EXPECT_FLOOR) && Math.min(...r.rates) === EXPECT_FLOOR,
  { lowest: Math.min(...r.rates), floor: EXPECT_FLOOR });
// Compare against what the table DECLARES, not against two more hardcoded numbers - that is
// what the check is for, and hardcoding made it fail the moment the table moved.
ok('...and the odds the code DECLARES are the odds it actually rolls',
  near(r.observed.s5, r.rates[5] / 100, 0.05) && near(r.observed.s8, r.rates[8] / 100, 0.05),
  { observedAt5: (r.observed.s5 * 100).toFixed(1) + '%', declared5: r.rates[5] + '%',
    observedAt8: (r.observed.s8 * 100).toFixed(1) + '%', declared8: r.rates[8] + '%', trialsEach: 800 });

// v0.30.1589: one step per star replaces the two bands - measured through getEquipBonus in every slot.
const STARS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
ok('every star multiplies by its own step, in every slot',
  ['weapon', 'armor', 'accessory'].every(sl => S[sl].every((v, n) => near(v, expSig(n))) && O[sl].every((v, n) => near(v, expBase(n)))),
  { weaponMain: S.weapon, weaponOrdinary: O.weapon, expectMainAt10: expSig(10), expectOrdinaryAt10: expBase(10) });
ok('each star adds more than the one before - the steps rise, and so do the measured gains',
  r.steps.every((v, i) => i === 0 || v > r.steps[i - 1]) && r.sigSteps.every((v, i) => i === 0 || v > r.sigSteps[i - 1])
  && STARS.every(n => n === 1 || step(S.weapon, n) > step(S.weapon, n - 1))
  && STARS.every(n => n === 1 || step(O.weapon, n) > step(O.weapon, n - 1)),
  { steps: r.steps, mainSteps: r.sigSteps, weaponMainGains: STARS.map(n => step(S.weapon, n)) });
ok('no star is worth less than it was before (on T8, the reference tier)',
  [0, ...STARS].every(n => S.weapon[n] >= OLD_SIG[n] - 0.002 && O.weapon[n] >= OLD_BASE[n] - 0.002),
  { mainNow: S.weapon, mainBefore: OLD_SIG, ordinaryNow: O.weapon, ordinaryBefore: OLD_BASE });
ok('a 10-star piece is worth much more than it was',
  S.weapon[10] > 5.4 && O.weapon[10] > 3.5,
  { mainAt10: S.weapon && S.weapon[10], previously: 3.8201, ordinaryAt10: O.weapon && O.weapon[10], ordinaryPreviously: 2.6065 });
// v0.30.1596 (per user: "The potential for growth of stats from stars should be higher the higher the tier")
ok('the star 10 potential climbs with the tier - T8 is the reference (the steps exactly), T1 about x2.6, T10 about x6.5',
  r.pot.length === 10 && r.pot.every((v, i) => i === 0 || v > r.pot[i - 1]) && near(r.pot[7], expSig(10)) && near(r.pot[0], 2.6178, 0.03) && near(r.pot[9], 6.5499, 0.05),
  { potentialT1toT10: r.pot });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
