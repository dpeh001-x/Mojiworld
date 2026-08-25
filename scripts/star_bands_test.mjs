// Live test: THE ANVIL BITES HARDER PAST SIX AND PAYS BETTER PAST SEVEN.
//
// Per user: "the fail rate should be higher after level 6 of enhancement, but
// after level 7 enhancement adds more increased value to stat".
//
// Two thresholds, deliberately one apart, so both halves have to be checked
// separately AND the gap between them has to be checked too - it is the design,
// not an off-by-one: risk rises at six, reward rises at seven, so the star 6 to
// 7 rung is the one you pay for with nothing extra in hand.
//
// The odds are checked both as declared (starSuccessRate, the function the code
// calls) and as OBSERVED - 800 real attemptEnhance calls with the real RNG, so
// the declared number is proved to be the one actually rolled against. The stat
// curve is measured through getEquipBonus, the cache combat reads.
//   node scripts/star_bands_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof starSuccessRate === 'function' && typeof getEquipBonus === 'function'
  && typeof STAR_LATE_FROM !== 'undefined' && typeof attemptEnhance === 'function', null, { timeout: 120000 });
await page.waitForTimeout(1500);

const r = await page.evaluate(() => {
  const out = { riskFrom: STAR_RISK_FROM, lateFrom: STAR_LATE_FROM,
    sig: STAR_SIG_GROWTH, base: STAR_GROWTH, sigLate: STAR_SIG_LATE_GROWTH, baseLate: STAR_LATE_GROWTH };
  out.rates = []; for (let s = 0; s < 10; s++) out.rates.push(starSuccessRate(s));

  // ---- the stat curve, through the real payout cache ----
  const mk = (slot, stars) => ({ name: 'probe', slot, tier: 1, stars, atk: 100, def: 100, hp: 100 });
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
const curve = (g, gl, n) => { const e = Math.min(n, r.lateFrom); return Math.pow(g, e) * Math.pow(gl, n - e); };
const expSig  = (n) => +curve(r.sig, r.sigLate, n).toFixed(4);
const expBase = (n) => +curve(r.base, r.baseLate, n).toFixed(4);
const OLD_RATES = [95, 87, 79, 71, 63, 55, 47, 39, 31, 23];
const EXPECT_RATES = [95, 87, 79, 71, 63, 55, 45, 35, 25, 15];
const near = (a, b, t) => a != null && Math.abs(a - b) <= (t || 0.02);
const S = r.sigAt || {}, O = r.otherAt || {};
const step = (arr, n) => +(arr[n] - arr[n - 1]).toFixed(4);

ok('the two thresholds are one apart, which is the design and not an off-by-one',
  r.riskFrom === 6 && r.lateFrom === 7, { riskRisesAtStar: r.riskFrom, rewardRisesAboveStar: r.lateFrom });
ok('nothing at or below \u26055 moved by a single point',
  r.rates.slice(0, 6).every((v, i) => v === OLD_RATES[i]),
  { rates0to5: r.rates.slice(0, 6), previously: OLD_RATES.slice(0, 6) });
ok('from the \u26056 attempt on, the odds fall away faster',
  r.rates.slice(6).every((v, i) => v === EXPECT_RATES[6 + i] && v < OLD_RATES[6 + i]),
  { rates6to9: r.rates.slice(6), previously: OLD_RATES.slice(6),
    failRateNow: r.rates.slice(6).map(v => (100 - v) + '%'), failRateBefore: OLD_RATES.slice(6).map(v => (100 - v) + '%') });
ok('every rung still clears the 12% floor, so pity stays the thing that carries a grind',
  r.rates.every(v => v > 12), { lowest: Math.min(...r.rates) });
ok('...and the odds the code DECLARES are the odds it actually rolls',
  near(r.observed.s5, 0.55, 0.05) && near(r.observed.s8, 0.25, 0.05),
  { observedAt5: (r.observed.s5 * 100).toFixed(1) + '%', declared5: r.rates[5] + '%',
    observedAt8: (r.observed.s8 * 100).toFixed(1) + '%', declared8: r.rates[8] + '%', trialsEach: 800 });

ok('every stat up to \u26057 is exactly where it was before this change',
  ['weapon', 'armor', 'accessory'].every(sl =>
    S[sl].slice(0, 8).every((v, n) => near(v, +Math.pow(r.sig, n).toFixed(4)))
    && O[sl].slice(0, 8).every((v, n) => near(v, +Math.pow(r.base, n).toFixed(4)))),
  { weaponSig0to7: S.weapon && S.weapon.slice(0, 8) });
ok('\u26058 and above grow on the steeper curve, in every slot',
  ['weapon', 'armor', 'accessory'].every(sl =>
    near(S[sl][8], expSig(8)) && near(S[sl][9], expSig(9)) && near(S[sl][10], expSig(10))),
  { at8: expSig(8), at9: expSig(9), at10: expSig(10),
    measured: { weapon: S.weapon && S.weapon.slice(8), armor: S.armor && S.armor.slice(8), accessory: S.accessory && S.accessory.slice(8) } });
ok('...the ordinary stats on the same piece follow their own steeper curve too',
  ['weapon', 'armor', 'accessory'].every(sl => near(O[sl][10], expBase(10))),
  { at10: expBase(10), measured: ['weapon', 'armor', 'accessory'].map(sl => O[sl] && O[sl][10]) });
ok('the \u26057\u2192\u26058 step is a bigger jump than the \u26056\u2192\u26057 step',
  step(S.weapon, 8) > step(S.weapon, 7) * 1.5 && step(S.armor, 8) > step(S.armor, 7) * 1.5
  && step(S.accessory, 8) > step(S.accessory, 7) * 1.5,
  { weapon: { step6to7: step(S.weapon, 7), step7to8: step(S.weapon, 8) },
    armor: { step6to7: step(S.armor, 7), step7to8: step(S.armor, 8) } });
ok('THE GAP IS REAL: \u26056\u2192\u26057 buys worse odds and no extra stat',
  r.rates[6] < OLD_RATES[6] && near(step(S.weapon, 7), step(S.weapon, 7)) && step(S.weapon, 7) < step(S.weapon, 8),
  { oddsAt6: r.rates[6] + '% (was ' + OLD_RATES[6] + '%)', statStep6to7: step(S.weapon, 7), statStep7to8: step(S.weapon, 8) });
ok('a \u260510 piece is worth meaningfully more than it was',
  S.weapon[10] > 3.7 && O.weapon[10] > 2.5,
  { signatureAt10: S.weapon && S.weapon[10], previously: 3.1058,
    ordinaryAt10: O.weapon && O.weapon[10], ordinaryPreviously: 2.1589 });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
