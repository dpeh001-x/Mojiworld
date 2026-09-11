// Ground Slam and War of Banners, measured on a pinned dummy.
// ============================================================================
// Per user: "Nerf the damage by groundslam and increase cooldown by 1s,
// Increase the damage dealt by war of banners".
//
// One pinned, healed-every-frame dummy 60 px in front of a Lv-50 Warlord with
// base ATK 400 and no crits (the master_skill_audit setup), so every number is
// a clean multiple of ATK. Every point is counted through hitMonster, after the
// global skill / ultimate multipliers - what actually reaches a monster.
//   GROUND SLAM: one cast, 1.5 s window - damage per cast, and per second of
//     the authored cooldown (the number the skill screen shows).
//   WAR OF BANNERS: open the enrage and hold B for the whole 10 s window - the
//     input poll re-casts whenever isReady allows (the 250 ms re-press gate), so
//     this is the most a player can get out of one enrage: presses that went
//     through, damage per press, and the enrage total.
// Prints the measurements; with ASSERT=1 also checks the tuned values.
// Run: node scripts/warrior_skill_tune_test.mjs
//      MOJI_GAME_FILE=_prev.html node scripts/warrior_skill_tune_test.mjs   (baseline)
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

const PORT = Number(process.env.PORT || 12111);
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

const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  try { loadMap('forest'); game.paused = false; } catch (e) { out.err = String(e); return out; }
  await sleep(1500);
  game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0;
  // the master_skill_audit character: Lv 50, base ATK 400, no crits, mana never the limit
  player.cls = 'warrior'; player.job = 'berserker'; player.master = 'warlord';
  player.level = 50; player._god = true; player.facing = 1;
  player.baseAtk = 400; player.baseAcc = 900;
  player.mods = player.mods || {}; player.mods.critDmg = 0;
  player.crit = 0; player.baseCrit = 0;
  player.buffs = {};
  const floorY = player.y + player.h;
  const dummy = spawnMonster(player.x + player.w + 40, player.y, 'slime', false);
  if (!dummy) { out.err = 'no dummy'; return out; }
  const pin = () => {
    dummy.x = player.x + player.w / 2 + 60 - dummy.w / 2; dummy.y = floorY - dummy.h; dummy.vx = 0; dummy.vy = 0;
    dummy.maxHp = 9e12; dummy.currentHp = 9e12; dummy.atk = 0; dummy.def = 0; dummy.evasion = 0; dummy.traits = {};
    dummy.speed = 0; dummy.stunTimer = 0; dummy._dying = false; dummy.invulnerable = 0;
  };
  pin();
  const log = [];
  const _oh = hitMonster;
  hitMonster = function (m, dmg, crit, skill) {
    const hp0 = m ? m.currentHp : 0;
    const r = _oh.apply(this, arguments);
    if (m === dummy && hp0 > m.currentHp) log.push({ d: hp0 - m.currentHp, skill: String(skill), crit: !!crit });
    return r;
  };
  const tick = async (ms) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { pin(); player.mp = 9e9; player.hp = getMaxHp(); game.paused = false; await sleep(16); } };
  const reset = () => { player.skillCooldowns = {}; player._skillLockTimer = 0; player.attackTimer = 0; player.mp = 9e9; player.x = 300; player.facing = 1; player.buffs = {}; pin(); };
  await tick(400);
  const ATK = getAtk();
  out.atk = ATK;
  out.cd = { groundSlam: SKILLS.groundSlam.cd, warlord_ult: SKILLS.warlord_ult.cd };

  // ---- Ground Slam: one cast ----
  reset(); log.length = 0;
  let gsErr = null; try { castSkill('groundSlam'); } catch (e) { gsErr = String(e).slice(0, 80); }
  const gsCdSet = player.skillCooldowns.groundSlam | 0;   // the real cooldown the cast committed
  await tick(1500);
  const gs = log.slice();
  out.gs = { err: gsErr, hits: gs.length, crits: gs.filter((x) => x.crit).length, perCast: +(gs.reduce((a, x) => a + x.d, 0) / ATK).toFixed(2), realCdMs: gsCdSet };
  out.gs.perCdSec = +(out.gs.perCast / (SKILLS.groundSlam.cd / 1000)).toFixed(2);
  await tick(600);

  // ---- War of Banners: open + hold B through the enrage ----
  reset(); log.length = 0;
  let presses = 0;
  const _ofn = SKILL_FNS.warlord_ult;
  SKILL_FNS.warlord_ult = function () { presses++; return _ofn.apply(this, arguments); };
  const t0 = performance.now();
  let wobErr = null;
  while (performance.now() - t0 < 10600) {
    pin(); player.mp = 9e9; player.hp = getMaxHp(); game.paused = false;
    // the keyboard path (line ~68134): a press only casts when isReady says so, which is
    // where the 250 ms re-press gate and the 60 s lock live - castSkill checks neither
    try { if (isReady('warlord_ult')) castSkill('warlord_ult'); } catch (e) { wobErr = String(e).slice(0, 80); }
    await sleep(16);   // a held key: the input poll retries every frame
  }
  await tick(800);
  SKILL_FNS.warlord_ult = _ofn;
  const wob = log.slice();
  const by = {}; for (const x of wob) by[x.skill] = (by[x.skill] || 0) + x.d;
  const total = wob.reduce((a, x) => a + x.d, 0) / ATK;
  out.wob = { err: wobErr, presses, hits: wob.length, crits: wob.filter((x) => x.crit).length, total: +total.toFixed(1), perPress: presses ? +(total / presses).toFixed(2) : null,
              byTag: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, +(v / ATK).toFixed(1)])),
              cdAfterMs: Math.round(player.skillCooldowns.warlord_ult || 0) };
  hitMonster = _oh;
  return out;
});
await browser.close(); server.kill();

if (R.err) console.log('  err ' + R.err);
console.log(`  ATK ${R.atk}; authored cooldowns ${JSON.stringify(R.cd)}`);
console.log(`  Ground Slam: ${JSON.stringify(R.gs)}`);
console.log(`  War of Banners: ${JSON.stringify(R.wob)}`);
// Baseline (v0.30.613, this harness): Ground Slam 10.2x ATK a cast, cd 3000
// (real 2250); War of Banners 9.3x ATK a press, 22 presses, 204x ATK an enrage.
const G = R.gs || {}, B = R.wob || {};
ok('GROUND SLAM COOLDOWN: authored 4 s (+1 s), committing a real 3 s',
   R.cd && R.cd.groundSlam === 4000 && G.realCdMs === 3000, `authored ${R.cd && R.cd.groundSlam} ms, real ${G.realCdMs} ms (baseline: 3000 / 2250)`);
ok('GROUND SLAM DAMAGE: about -20% a cast (7.4-8.8x ATK)', G.perCast >= 7.4 && G.perCast <= 8.8,
   `${G.perCast}x ATK a cast (baseline: 10.2x)`);
ok('CONTROL: Ground Slam still lands all 8 ticks', G.hits === 8, `${G.hits} hits`);
ok('WAR OF BANNERS DAMAGE: about +50% a press (at least 12.5x ATK)', B.perPress >= 12.5,
   `${B.perPress}x ATK a press, ${B.total}x ATK over the enrage (baseline: 9.3x, 204x)`);
ok('CONTROL: War of Banners cadence and lock unchanged (15-30 presses, ~60 s lock after)',
   B.presses >= 15 && B.presses <= 30 && B.cdAfterMs > 50000, `${B.presses} presses, lock ${B.cdAfterMs} ms after the enrage (baseline: 22, ~58600)`);
if (process.env.ASSERT === '1') {
  let bad = 0;
  for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
  console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
  process.exit(bad ? 1 : 0);
}
