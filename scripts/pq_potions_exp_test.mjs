// PQ: potions work in every stage, and no stage pays more than its cap.
// ============================================================================
// Two user reports, one run:
//   "bug with PQ, unable to use potions, please fix"
//   "currently doing pq past level 40 is giving me ALOT of exp, cap each stage
//    to 4% of EXP and tail down to 1% after level 80"
//
// POTIONS. Two PQ maps carried noPotion: true. The lock was v0.25.987 and was
// right for what those maps were then; two later changes made it wrong. Stage
// 3 was cut to eight kills (no grind left to drink through) while the chain
// started PAYING potions as that stage's own reward, and the Endless Express
// was promoted to the Stage-4 Master Conductor arena — a level-scaling boss
// duel with healing switched off. Measured through the REAL useQuickPotion, on
// every map in the chain, because the flag is per-map and only a per-map sweep
// can show the lock is gone everywhere and still available to other maps.
//
// EXP. Asserted through the REAL _completeQuest against the live level cost,
// not against the reward table: the payout is max(authored, curve floor) with
// four multipliers over it, so only the number that reaches player.exp means
// anything. The cap is checked at both ends of the taper and in the middle.
// Run: node scripts/pq_potions_exp_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9971);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'PqFix');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

// ---- potions, per map -------------------------------------------------------
const PQ_MAPS = ['clockworkUnderpassLobby', 'clockworkSpire', 'tower', 'clockworkExpress'];
const potions = {};
for (const map of PQ_MAPS) {
  potions[map] = await page.evaluate(async (mp) => {
    loadMap(mp, 300);
    await new Promise((r) => setTimeout(r, 1200));
    game.paused = false;
    player.level = 40;
    player.consumables = player.consumables || {};
    player.consumables.hp_m = 9;
    player.hp = Math.floor(getMaxHp() * 0.3);
    player._potionCdHp = 0; player._potionCdMp = 0;
    const before = player.hp, stock = player.consumables.hp_m | 0;
    try { useQuickPotion('hp', false); } catch (e) {}
    return { noPotionFlag: !!(game.mapData && game.mapData.noPotion),
             healed: player.hp - before, used: stock - (player.consumables.hp_m | 0) };
  }, map);
}
// the mechanism must survive for any map that wants it later
const mechanism = await page.evaluate(async () => {
  loadMap('tower', 300);
  await new Promise((r) => setTimeout(r, 1000));
  game.paused = false;
  game.mapData.noPotion = true;                 // simulate a map that opts in
  player.consumables.hp_m = 5; player.hp = Math.floor(getMaxHp() * 0.3);
  player._potionCdHp = 0;
  const before = player.hp;
  try { useQuickPotion('hp', false); } catch (e) {}
  const blocked = player.hp === before;
  game.mapData.noPotion = false;
  return { blocked };
});

// ---- the EXP cap, through the real completion path -------------------------
const exp = await page.evaluate(() => {
  const out = { haveCap: typeof _lxPqStageCapFrac === 'function', curve: {}, paid: {} };
  if (!out.haveCap) return out;
  for (const lv of [30, 40, 60, 80, 90, 100, 120]) out.curve[lv] = +_lxPqStageCapFrac(lv).toFixed(4);
  const STAGES = ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage', 'q_pq_finale', 'q_clockwork_express'];
  // Measure the RAW award. _completeQuest calls _maybeLevelUp, which spends
  // player.exp against player.expToNext — a threshold this harness has no
  // business owning, and whose stale value made a first draft of this test
  // report a 4%-of-a-level award as 104% (one spurious level-up, counted).
  // Stubbing the level-up for the duration leaves player.exp holding exactly
  // what the quest paid, which is the number under test.
  const _realLevelUp = window._maybeLevelUp;
  const payAt = (id, lv) => {
    player.level = lv; player.exp = 0;
    player.quests = { active: {}, completed: {}, unlocked: {}, progress: {} };
    player.quests.active[id] = { progress: 0, targetCount: 99 };
    window._maybeLevelUp = () => {};
    try { _completeQuest(id); } catch (e) { return { err: String(e).slice(0, 80) }; }
    finally { window._maybeLevelUp = _realLevelUp; }
    return { frac: +(player.exp / _lxLevelCost(lv)).toFixed(4) };
  };
  for (const lv of [30, 40, 60, 80, 90, 100]) {
    out.paid[lv] = {};
    for (const id of STAGES) out.paid[lv][id] = payAt(id, lv).frac;
  }
  // A NON-PQ quest must still be able to pay ABOVE the PQ cap. The control has
  // to be chosen with care: quests are keyed to their DESIGN level to stop
  // back-farming, so a Lv-20 quest completed at Lv 60 pays a Lv-20 reward
  // (0.1% of a level) and would "pass" a naive under-the-cap check while
  // proving nothing. Pick the highest-design-level ordinary quest instead —
  // one the cap would visibly bite if it were wrongly applied.
  const _ctl = Object.keys(QUESTS)
    .filter((k) => !LX_PQ_CAPPED_QUESTS.has(k) && !QUESTS[k].cls
      && ((QUESTS[k].levelReq | 0) >= 45) && ((QUESTS[k].levelReq | 0) <= 60))
    .sort((a, b) => (QUESTS[b].levelReq | 0) - (QUESTS[a].levelReq | 0))[0];
  out.controlId = _ctl || null;
  out.control = _ctl ? payAt(_ctl, 60).frac : null;
  return out;
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 190) });

for (const map of PQ_MAPS) {
  const p = potions[map];
  ok(`potions work in ${map}`, p.healed > 0 && p.used === 1 && p.noPotionFlag === false,
    `healed ${p.healed}, used ${p.used}, noPotion=${p.noPotionFlag}`);
}
ok('the per-map lock still WORKS for any map that opts in (mechanism kept, not ripped out)',
  mechanism.blocked, 'a map setting noPotion:true still blocks');

ok('the cap curve exists', exp.haveCap);
if (exp.haveCap) {
  const c = exp.curve;
  ok('4% through Lv 80', c[30] === 0.04 && c[40] === 0.04 && c[60] === 0.04 && c[80] === 0.04, JSON.stringify(c));
  ok('tails to 1% after 80, and holds there',
    c[90] > 0.01 && c[90] < 0.04 && c[100] === 0.01 && c[120] === 0.01,
    `Lv90 ${c[90]}, Lv100 ${c[100]}, Lv120 ${c[120]}`);
  const over = [];
  for (const lv of Object.keys(exp.paid)) {
    const cap = exp.curve[lv] !== undefined ? exp.curve[lv] : 0.04;
    for (const id in exp.paid[lv]) {
      const f = exp.paid[lv][id];
      if (f > cap + 0.0005) over.push(`${id}@${lv}=${f} > ${cap}`);
    }
  }
  ok('NO PQ stage pays more than its cap, at any level tested', over.length === 0, over.slice(0, 4).join(' · '));
  ok('the post-40 complaint case: a full 4-stage run at Lv 60 is now ~16% of a level, not ~50%',
    Math.abs(['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage', 'q_pq_finale']
      .reduce((a, id) => a + exp.paid[60][id], 0) - 0.16) < 0.005,
    'run at Lv 60 = ' + ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage', 'q_pq_finale']
      .reduce((a, id) => a + exp.paid[60][id], 0).toFixed(3) + ' of a level');
  ok('the repeatable Express is capped too — the farm cannot just move',
    exp.paid[60]['q_clockwork_express'] <= 0.0405, 'Express at Lv 60 = ' + exp.paid[60]['q_clockwork_express']);
  ok('a NON-PQ quest can still pay far above the PQ cap — the ceiling is PQ-only',
    exp.control !== null && exp.control > 0.10,
    `${exp.controlId} at Lv 60 = ${exp.control} of a level (PQ cap there is ${exp.curve[60]})`);
}
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' · '));

let fail = 0;
for (const r of res) { if (!r.pass) fail++; console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra ? '  — ' + r.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
