// Codex cohorts: the Magma Foundry's Greater and Apex studies open together.
// ============================================================================
// Per user: "for smith golem apex quest pls try to align it together with the
// other monsters in the magma foundry at the same time".
//
//   1. APEX ALIGNED: the four Foundry Apex Studies share one level
//      (baseline: 66 / 68 / 71 / 72)
//   2. SMITH GOLEM JOINS: its Apex Study opens at that level, earlier than 71
//   3. GREATER ALIGNED: the four Greater Studies share one level
//      (baseline: 63 / 65 / 68 / 69)
//   4. ORDER (control): for every resident, first study < Greater < Apex,
//      with Apex three levels after Greater
//   5. UNLOCK TOGETHER: through the live tickQuestUnlocks, one level below the
//      first Foundry Apex none of the four is open and at it all four are
//      (baseline: one of four)
//   6. CONTROL: the first study stays per creature (natural - 2)
//   7. CONTROL: a non-cohort map keeps the per-creature rule (Glasswind
//      Steppe's Razorgale: Greater natural + 3, Apex natural + 6)
// Prints every Foundry study's count and rewards so a baseline run can be
// compared line for line (they must not move).
// Run: node scripts/codex_cohort_test.mjs
//      MOJI_GAME_FILE=_prev.html node scripts/codex_cohort_test.mjs   (baseline)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 240) });

const PORT = Number(process.env.PORT || 11911);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
let browser = null;
for (let a = 1; a <= 3 && !browser; a++) {
  try { browser = await chromium.launch({ channel: 'msedge', headless: true }); }
  catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 2000 * a)); }
}
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(12000);
const click = async (sel, ms) => {
  const el = await page.$(sel);
  if (!el || !(await el.isVisible().catch(() => false))) return false;
  try { await el.click({ timeout: ms || 2500 }); return true; } catch (e) { return false; }
};
await click('#menu-newgame', 8000); await page.waitForTimeout(1500);
await click('#auth-submit', 8000);  await page.waitForTimeout(2500);
for (let i = 0; i < 8; i++) {
  const r = await page.evaluate(() => { const o = document.getElementById('class-options');
    return !!(o && o.firstElementChild && o.firstElementChild.getBoundingClientRect().width > 40); });
  if (r) break;
  if (!(await click('#cs-nav-next'))) break;
  await page.waitForTimeout(1000);
}
await page.evaluate(() => { const o = document.getElementById('class-options'); if (o && o.firstElementChild) o.firstElementChild.click(); });
for (let i = 0; i < 45; i++) {
  for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) await click(sel, 1200);
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(2000);
  const st = await page.evaluate(() => ({ p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive }));
  if (st.p === false && !st.pro) break;
}
await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) { o.classList.add('fade'); o.style.display = 'none'; } });
await page.waitForTimeout(1200);

const R = await page.evaluate(() => {
  const out = { rows: {}, sig: [] };
  const mobs = ['forgewight', 'cinderling', 'smithgolem', 'bellowsbat'];
  const tier = (id) => QUESTS[id] || null;
  for (const m of mobs) {
    const st = tier('b_' + m), gr = tier('b_' + m + '_greater'), ap = tier('b_' + m + '_apex');
    out.rows[m] = { natural: MOB_NATURAL_LEVEL[m], study: st && st.levelReq, greater: gr && gr.levelReq, apex: ap && ap.levelReq };
    for (const [k, q] of [['study', st], ['greater', gr], ['apex', ap]]) if (q) out.sig.push(`${m}.${k}: count ${q.count}, exp ${q.rewards.exp}, coins ${q.rewards.mojicoins}`);
  }
  const rz = 'razorgale';
  out.control = { natural: MOB_NATURAL_LEVEL[rz], greater: (tier('b_' + rz + '_greater') || {}).levelReq, apex: (tier('b_' + rz + '_apex') || {}).levelReq };
  // unlock through the live path, at the first Foundry apex level and one below it
  const apexIds = mobs.map((m) => 'b_' + m + '_apex');
  const lvls = mobs.map((m) => out.rows[m].apex).filter((n) => typeof n === 'number');
  const first = Math.min(...lvls);
  const saveLv = player.level, saveUnl = Object.assign({}, player.quests.unlocked);
  const probe = (lv) => {
    for (const id of apexIds) delete player.quests.unlocked[id];
    player.level = lv;
    try { tickQuestUnlocks(); } catch (e) { return { err: String(e) }; }
    return apexIds.filter((id) => player.quests.unlocked[id]).map((id) => id.slice(2, -5));
  };
  out.unlock = { first, below: probe(first - 1), at: probe(first) };
  player.level = saveLv; player.quests.unlocked = saveUnl;
  return out;
});
await browser.close(); server.kill();

for (const m in R.rows) { const r = R.rows[m]; console.log(`  ${m.padEnd(11)} natural ${r.natural}  study ${r.study}  greater ${r.greater}  apex ${r.apex}`); }
console.log('  control razorgale: ' + JSON.stringify(R.control));
console.log('  unlock: ' + JSON.stringify(R.unlock));
for (const line of R.sig) console.log('  ' + line);
const rows = Object.values(R.rows);
const apexes = rows.map((r) => r.apex), greaters = rows.map((r) => r.greater);
const same = (a) => a.every((x) => typeof x === 'number' && x === a[0]);
ok('APEX ALIGNED: the four Foundry Apex Studies share one level', same(apexes), `apex levels ${apexes.join(' / ')} (baseline: 66 / 68 / 71 / 72)`);
ok('SMITH GOLEM JOINS: its Apex Study opens at the shared level, earlier than 71', same(apexes) && R.rows.smithgolem.apex < 71, `smith golem apex ${R.rows.smithgolem.apex} (baseline: 71)`);
ok('GREATER ALIGNED: the four Greater Studies share one level', same(greaters), `greater levels ${greaters.join(' / ')} (baseline: 63 / 65 / 68 / 69)`);
ok('ORDER (control): first study < Greater < Apex for every resident, Apex three after Greater', rows.every((r) => r.study < r.greater && r.greater < r.apex && r.apex - r.greater === 3),
   rows.map((r) => `${r.study}<${r.greater}<${r.apex}`).join('  '));
const u = R.unlock || {};
ok('UNLOCK TOGETHER: none open one level below the first Foundry Apex, all four open at it', Array.isArray(u.below) && u.below.length === 0 && Array.isArray(u.at) && u.at.length === 4,
   `at Lv ${u.first - 1}: [${u.below}]  at Lv ${u.first}: [${u.at}] (baseline: one of four)`);
ok('CONTROL: the first study stays per creature (natural - 2)', rows.every((r) => r.study === r.natural - 2), rows.map((r) => `${r.natural}->${r.study}`).join('  '));
ok('CONTROL: a non-cohort map keeps the per-creature rule (Razorgale)', R.control.greater === R.control.natural + 3 && R.control.apex === R.control.natural + 6, JSON.stringify(R.control));
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
