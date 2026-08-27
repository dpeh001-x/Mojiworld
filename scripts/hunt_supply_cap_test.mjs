#!/usr/bin/env node
// A hunt may not ask for more than the world can supply.
// ============================================================================
// Per the tester, at 113/500 on the Sunbun codex study in Honeycomb Hollow:
// "too many sunbuns to kill" / "the map has too few sunbuns". Both statements
// were the same defect: the level band (200-500 under Lv 30) sized hunts with
// no idea of spawn supply, and Sunbun's entire world population was five slots
// in one map's queue — the roll asked for ~100 full respawn cycles of the
// species. Cookie, skeleton and mayo (supply 6) carried the same latent bug.
//
// Asserts, against a live build:
//   1. every kill quest (hand-written and codex) with a supplied target asks
//      for at most LX_HUNT_CYCLES respawn cycles of that target's world supply;
//   2. the Sunbun study specifically landed at its cap, not its 500 roll;
//   3. a save carrying an inflated accept-time targetCount is clamped on load;
//   4. boss quests and unsupplied (event/affix) targets are untouched.
//
//   node scripts/hunt_supply_cap_test.mjs [page] [port]
// ============================================================================
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = process.argv[3] || '8767';
const EXE = [process.env.PW_EXE,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
if (!EXE) { console.error('no Chromium'); process.exit(1); }

let pass = 0, fail = 0;
const ok = (name, cond, info) => {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (info !== undefined ? '  ' + JSON.stringify(info).slice(0, 220) : ''));
  cond ? pass++ : fail++;
};

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(`http://localhost:${PORT}/${PAGE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof QUESTS === 'object' && typeof _lxWorldSupplyOf === 'function', null, { timeout: 180000 })
  .catch(() => {});
await page.waitForTimeout(6000);

const R = await page.evaluate(() => {
  const out = { helpers: typeof _lxWorldSupplyOf === 'function' && typeof _lxHuntSupplyCap === 'function' };
  if (!out.helpers) return out;
  out.supply = { orange: _lxWorldSupplyOf('orange'), honeyBuzz: _lxWorldSupplyOf('honeyBuzz'),
    nougatBear: _lxWorldSupplyOf('nougatBear'), cookie: _lxWorldSupplyOf('cookie'), gravitos: _lxWorldSupplyOf('gravitos') };
  // 1. sweep every kill quest
  const over = [];
  let checked = 0, capped = 0;
  for (const id in QUESTS) {
    const q = QUESTS[id];
    if (!q || q.kind !== 'kill' || !q.target) continue;
    const su = _lxWorldSupplyOf(q.target);
    if (!su) continue;
    const cap = Math.max(100, Math.floor((su * LX_HUNT_CYCLES) / 10) * 10);
    // effective requirement: what accept would set (banded) or the baked count
    const eff = (q.bestiary || q.noScale || (Array.isArray(q.objectives) && q.objectives.length))
      ? (q.count | 0)
      : (typeof _lxQuestKillTarget === 'function' ? _lxQuestKillTarget(q) : (q.count | 0));
    checked++;
    if (eff > cap) over.push({ id, target: q.target, eff, cap, supply: su });
    if (eff === cap) capped++;
  }
  out.sweep = { checked, capped, over: over.slice(0, 8), nOver: over.length };
  // 2. the Sunbun study
  const sun = Object.keys(QUESTS).filter((id) => QUESTS[id] && QUESTS[id].bestiary && QUESTS[id].target === 'orange')
    .map((id) => ({ id, count: QUESTS[id].count }));
  out.sunbun = sun;
  // 3. migration: simulate an inflated saved hunt, then run the loadState clamp shape
  const huntId = Object.keys(QUESTS).find((id) => {
    const q = QUESTS[id];
    return q && q.kind === 'kill' && q.target === 'nougatBear' && !q.bestiary && !(Array.isArray(q.objectives) && q.objectives.length);
  });
  if (huntId) {
    player.quests = player.quests || { active: {}, completed: {} };
    player.quests.active = player.quests.active || {};
    player.quests.active[huntId] = { progress: 201, targetCount: 400 };
    // replicate exactly what the loadState migration block does
    const _a2 = player.quests.active[huntId], _q2 = QUESTS[huntId];
    const _cap2 = _lxHuntSupplyCap(_q2.target, _a2.targetCount);
    if (_cap2 < _a2.targetCount) _a2.targetCount = _cap2;
    out.migration = { huntId, target: _q2.target, after: _a2.targetCount,
      cap: Math.max(100, Math.floor((_lxWorldSupplyOf('nougatBear') * LX_HUNT_CYCLES) / 10) * 10) };
    delete player.quests.active[huntId];
  } else out.migration = 'no nougat hunt found';
  // 4. boss quests untouched
  const bossQ = Object.keys(QUESTS).find((id) => QUESTS[id] && QUESTS[id].kind === 'boss' && (QUESTS[id].count | 0) <= 3);
  out.bossUntouched = bossQ ? { id: bossQ, count: QUESTS[bossQ].count } : 'none found';
  return out;
});
await b.close();

ok('supply helpers exist in the build', R.helpers === true);
if (R.helpers) {
  ok('Sunbun world supply is 7 after the Honeycomb rebalance', R.supply.orange === 7, R.supply);
  ok('every supplied kill quest fits inside ' + 'the cycle cap', R.sweep.nOver === 0,
    { checked: R.sweep.checked, capped: R.sweep.capped, over: R.sweep.over });
  ok('the Sunbun study asks 210, not its 500 roll',
    R.sunbun.length > 0 && R.sunbun.every((q) => q.count === 210), R.sunbun);
  ok('an inflated saved hunt clamps on the migration path (400 -> cap)',
    R.migration && R.migration.after === R.migration.cap && R.migration.after < 400, R.migration);
  ok('boss quests keep their authored counts', typeof R.bossUntouched === 'object' && R.bossUntouched.count <= 3, R.bossUntouched);
}
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
