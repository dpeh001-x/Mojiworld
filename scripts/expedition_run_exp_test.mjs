// A full Tower Expedition must be worth running for EXP, and worth a
// predictable amount: ~0.50 of a level at Lv 40 tapering to 0.20 at Lv 70,
// then holding at 0.20 (per user: "as for expedition also similar exp, but
// after 70 cap at about 0.2 per run").
//
// Before this, a full 10-floor / 246-monster run paid 0.0014 of a level at
// Lv 40 and rounded to zero from 50 up — not a bug in the Expedition so much as
// a structural gap: kill EXP is ~100/monster by design and the Expedition is
// the one mode with no quest attached, so nothing ever paid out for the run.
//
// The reward is banked PER FLOOR, which is what makes it worth testing rather
// than eyeballing: two different code paths reach the last floor (floors 1-9
// via _expeditionFloorCleared, the F10 boss via _completeExpedition), and the
// floor-clear handler is deliberately re-entrant-guarded because an AoE burst
// can schedule it several times. So this drives the real handlers and checks
// both that a run pays the budget and that no floor pays twice.
// Run: node scripts/expedition_run_exp_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof _expeditionFloorCleared === 'function' && typeof EXPEDITION_FLOOR_COUNT !== 'undefined', { timeout: 90000 });

const r = await page.evaluate(() => {
  const LEVELS = [30, 40, 50, 60, 70, 80, 95];
  const TARGET = { 30: 0.50, 40: 0.50, 50: 0.40, 60: 0.30, 70: 0.20, 80: 0.20, 95: 0.20 };
  const N = EXPEDITION_FLOOR_COUNT;

  // Walk a full run through the REAL floor-clear handler. _maybeLevelUp is held
  // off so the measurement reads the grant rather than the post-level-up
  // remainder (assigning player.level directly leaves the level-up bookkeeping
  // stale, which silently eats part of the grant).
  const run = (lv, opts) => {
    player.level = lv; player.exp = 0;
    const _origLvUp = window._maybeLevelUp; window._maybeLevelUp = function () {};
    const _origToast = window.showToast; window.showToast = function () {};
    try {
      game.expedition = { active: true, floor: 0, bravoReady: false, currentQuest: null };
      for (let f = 1; f <= N; f++) {
        game.expedition.floor = f;
        game.expedition._floorClearedFor = null;   // as the next floor's loadMap hook does
        if (f >= N) {
          // The last floor is reachable by two paths; fire BOTH to prove the
          // per-floor stamp makes the overlap safe.
          if (opts && opts.doubleFireLast && typeof _lxGrantExpeditionFloorExp === 'function') {
            _lxGrantExpeditionFloorExp(f);
          }
        }
        _expeditionFloorCleared();
        if (!game.expedition || !game.expedition.active) break;   // completion ended the run
      }
      return player.exp;
    } finally { window._maybeLevelUp = _origLvUp; window.showToast = _origToast; }
  };

  // A run that dies on floor 7 should bank 7/10 of the budget.
  const partial = (lv, upto) => {
    player.level = lv; player.exp = 0;
    const _o = window._maybeLevelUp; window._maybeLevelUp = function () {};
    const _t = window.showToast; window.showToast = function () {};
    try {
      game.expedition = { active: true, floor: 0, bravoReady: false, currentQuest: null };
      for (let f = 1; f <= upto; f++) {
        game.expedition.floor = f; game.expedition._floorClearedFor = null;
        _expeditionFloorCleared();
        if (!game.expedition || !game.expedition.active) break;
      }
      return player.exp;
    } finally { window._maybeLevelUp = _o; window.showToast = _t; }
  };

  const out = { levels: LEVELS, target: TARGET, share: {}, dbl: {}, partial7: null, floors: N };
  for (const lv of LEVELS) {
    out.share[lv] = +(run(lv) / _lxLevelCost(lv)).toFixed(4);
    out.dbl[lv]   = +(run(lv, { doubleFireLast: true }) / _lxLevelCost(lv)).toFixed(4);
  }
  out.partial7 = +(partial(60, 7) / _lxLevelCost(60)).toFixed(4);
  return out;
});

const L = r.levels;
console.log(`\nFull ${r.floors}-floor run, as a share of ONE level`);
console.log('  ' + 'level'.padEnd(12) + L.map(l => ('Lv' + l).padStart(9)).join(''));
console.log('  ' + 'paid'.padEnd(12) + L.map(l => r.share[l].toFixed(3).padStart(9)).join(''));
console.log('  ' + 'target'.padEnd(12) + L.map(l => r.target[l].toFixed(3).padStart(9)).join(''));

console.log('\nRUN BUDGET — 0.50 at Lv 40 → 0.20 at Lv 70, capped at 0.20 above');
for (const lv of L) {
  check(Math.abs(r.share[lv] - r.target[lv]) <= 0.02, `a full run pays ~${r.target[lv]} of a level at Lv ${lv}`,
        { want: r.target[lv], got: r.share[lv] });
}
check(r.share[80] === r.share[70] && r.share[95] === r.share[70],
      'the cap holds flat above Lv 70 (does not keep falling)', { 70: r.share[70], 80: r.share[80], 95: r.share[95] });
check(L.every((lv, i) => i === 0 || r.share[lv] <= r.share[L[i - 1]] + 0.001),
      'the budget never rises with level', L.map(lv => r.share[lv]));

console.log('\nPAID ONCE PER FLOOR (two paths reach the last one)');
for (const lv of L) {
  check(r.dbl[lv] === r.share[lv], `firing the final floor twice pays no extra at Lv ${lv}`,
        { once: r.share[lv], twice: r.dbl[lv] });
}

console.log('\nPARTIAL RUNS BANK WHAT THEY CLEARED');
check(Math.abs(r.partial7 - r.target[60] * 0.7) <= 0.02,
      'dying on floor 7 of 10 banks ~70% of the budget', { want: +(r.target[60] * 0.7).toFixed(4), got: r.partial7 });
check(r.partial7 > 0 && r.partial7 < r.share[60], 'a partial run pays less than a full clear',
      { partial: r.partial7, full: r.share[60] });

check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(bad === 0 ? '\nALL PASS' : `\n${bad} FAILED`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
