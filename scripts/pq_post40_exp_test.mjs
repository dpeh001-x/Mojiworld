// The Clockwork PQ must remain a viable levelling path after Lv 40.
//
// Per user: "PQ should not be block out doing for post 40 levelling."
//
// The PQ is repeatable, level-scaled content: its maps carry `expressScaling`,
// which re-stats every mech onto the player's own capped level at DOUBLE a
// field mob's HP and ATK. But quest EXP keys off the quest's DESIGN level
// (levelReq 29-31), so the payout stayed frozen at Lv 31 while the fight
// tracked the player — a Lv 60 player fought Lv 60 mechs for 0.4% of a level.
//
// MEASURING THIS CORRECTLY IS THE HARD PART. _completeQuest calls
// _maybeLevelUp(), so a payout that crosses a level boundary is CONSUMED:
// reading (player.exp - before) under-reports exactly the large payouts this
// test exists to check, and does it non-monotonically, which reads as noise in
// the game rather than a bug in the harness. So the EXP gained is reconstructed
// across every level crossed.
//
// It guards both directions. Too little and the PQ is locked out of post-40
// play again; too much and it becomes a farm on restartable content, against
// the standing "levelling should not be so quick, there should be some grind".
// Run: node scripts/pq_post40_exp_test.mjs [file.html]
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
await page.waitForFunction(() => typeof _completeQuest === 'function' && typeof QUESTS !== 'undefined', { timeout: 90000 });

const r = await page.evaluate(() => {
  const CHAIN = ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage', 'q_pq_finale'];
  const ALL = CHAIN.concat(['q_clockwork_express']);
  const LEVELS = [40, 45, 50, 60, 70, 80];
  // Per user: a full run is worth 0.50 of a level at Lv 40, tapering linearly
  // to 0.15 at Lv 70 and holding there afterwards.
  const TARGET = { 40: 0.50, 45: 0.4417, 50: 0.3833, 60: 0.2667, 70: 0.15, 80: 0.15 };

  // Share of ONE level paid by completing `id` at level `lv`.
  //
  // _maybeLevelUp is held OFF for the measurement. Assigning player.level
  // directly does not rebuild the bookkeeping the level-up path reads, so
  // letting it run consumes an unrelated amount of the grant and reports it as
  // the payout — which looked like wild non-monotonic noise in the game
  // (0.13 at Lv 40, 0.054 at 50, 0.30 at 60) when it was purely an artefact of
  // measuring a synthetic player. What is being asked here is "how much EXP
  // does this quest GRANT", so read the grant.
  const share = (id, lv) => {
    player.level = lv; player.exp = 0;
    player.quests = { active: {}, completed: {}, progress: {}, unlocked: {} };
    player.quests.active[id] = { targetCount: (QUESTS[id] && QUESTS[id].count) || 1, rewardScale: 1 };
    const _origLvUp = window._maybeLevelUp;
    window._maybeLevelUp = function () {};
    let gained;
    try { _completeQuest(id); gained = player.exp; }
    catch (e) { return null; }
    finally { window._maybeLevelUp = _origLvUp; }
    return +(gained / _lxLevelCost(lv)).toFixed(3);
  };

  const out = { levels: LEVELS, target: TARGET, per: {}, chain: {}, control: {}, flags: {} };
  for (const id of ALL) {
    out.flags[id] = !!(QUESTS[id] && QUESTS[id].scalesToPlayer);
    out.per[id] = {};
    for (const lv of LEVELS) out.per[id][lv] = share(id, lv);
  }
  for (const lv of LEVELS) {
    out.chain[lv] = +CHAIN.reduce((a, id) => a + (out.per[id][lv] || 0), 0).toFixed(2);
    // What ordinary, level-appropriate content pays at the same moment.
    const near = Object.keys(QUESTS).filter(k => {
      const q = QUESTS[k]; return q && q.levelReq && Math.abs(q.levelReq - lv) <= 3 && q.rewards && q.rewards.exp;
    });
    const fr = near.map(k => share(k, lv)).filter(x => typeof x === 'number').sort((a, b) => a - b);
    out.control[lv] = fr.length ? fr[Math.floor(fr.length / 2)] : null;
  }
  return out;
});

const L = r.levels;
console.log('\nShare of ONE level paid, by player level');
console.log('  ' + 'quest'.padEnd(24) + L.map(l => ('Lv' + l).padStart(9)).join(''));
for (const id of Object.keys(r.per)) {
  console.log('  ' + id.padEnd(24) + L.map(l => String(r.per[id][l]).padStart(9)).join(''));
}
console.log('  ' + 'FULL CHAIN (4 stages)'.padEnd(24) + L.map(l => String(r.chain[l]).padStart(9)).join(''));
console.log('  ' + 'control (median quest)'.padEnd(24) + L.map(l => String(r.control[l]).padStart(9)).join(''));

console.log('\nRUN BUDGET — 0.50 of a level at Lv 40, tapering to 0.15 at Lv 70');
for (const lv of L) {
  const want = r.target[lv], got = r.chain[lv];
  check(Math.abs(got - want) <= 0.02, `full 4-stage run pays ~${want} of a level at Lv ${lv}`, { want, got });
}
check(L.every((lv, i) => i === 0 || r.chain[lv] <= r.chain[L[i - 1]] + 0.001),
      'the run budget never rises with level', L.map(lv => r.chain[lv]));

console.log('\nSTILL WORTH DOING (not re-locked-out)');
for (const lv of L) {
  const worst = Math.min(...Object.keys(r.per).map(id => r.per[id][lv]));
  check(worst >= 0.02, `every PQ stage still pays >= 2% of a level at Lv ${lv}`, { worst });
}
const ceilingBreaches = [];
for (const id of Object.keys(r.per)) for (const lv of L) if (r.per[id][lv] > 0.80) ceilingBreaches.push({ id, lv, v: r.per[id][lv] });
check(ceilingBreaches.length === 0, 'no stage exceeds the 80%-of-a-level hard ceiling', ceilingBreaches);

console.log('\nAUTHORED TIER SPREAD SURVIVES (the v0.29.320 failure mode)');
for (const lv of L) {
  const f = r.per.q_pq_finale[lv], c = r.per.q_pq_carriage[lv], u = r.per.q_clockwork_underpass[lv];
  check(f > c && c > u, `finale > carriage > stage 1 at Lv ${lv}`, { finale: f, carriage: c, stage1: u });
}
const pinned = L.filter(lv => new Set(Object.keys(r.per).map(id => r.per[id][lv])).size <= 2);
check(pinned.length === 0, 'stages are not all pinned to one clamp value', pinned);

console.log('\nFLAGS');
check(Object.values(r.flags).every(Boolean), 'all five PQ quests carry scalesToPlayer', r.flags);

check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(bad === 0 ? '\nALL PASS' : `\n${bad} FAILED`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
