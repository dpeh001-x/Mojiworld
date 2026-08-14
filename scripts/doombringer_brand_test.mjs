// DOOM Brands + Calamity Heat, measured on the live build.
//
// Per user: "DOOM Brands but omit the detonation, also add the calamity heat
// meter." The checks, in the order they can fail:
//   1. brand math: stacks cap at 10, expire, and read as +2%/stack
//   2. a brand never amplifies the hit that applied it
//   3. tags: apoc brands +1 / heat +2, apocSlam +2 / +4
//   4. the ult consumes brands -> execute 22%->32% (capped), window +4s
//   5. the MILESTONE TABLE is not poisoned: the very next window is 22% again
//      (the window copy is a shallow Object.assign, so an in-place mutation of
//      the nested execute object would ratchet the table permanently)
//   6. heat spends whole: the first blade-wave carries x1.5 damage at 100 heat
//   7. no detonation: killing a branded foe must NOT damage its neighbour
//   8. integration: a real Blade of Calamity cast brands a dummy and stokes heat
// Run: node scripts/doombringer_brand_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + path.join(ROOT, process.argv[2] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof SKILL_FNS !== 'undefined' && typeof hitMonster === 'function' && typeof loadMap === 'function', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
});
await page.waitForTimeout(3000);

const r = await page.evaluate(async () => {
  const out = {};
  const frame = () => new Promise((res) => requestAnimationFrame(res));
  player.cls = 'warrior'; player.job = 'berserker'; player.master = 'doombringer';
  player.level = 90; player.invulnerable = 9e9; player.hp = 99999;
  player.skillRanks = player.skillRanks || {};
  player.skillRanks.doombringer_ult = 10; player.skillRanks.doombringer_apoc = 10;
  game.paused = false;
  const dummy = (x) => {
    const d = { type: 'snail', x, y: player.y, w: 40, h: 40, currentHp: 5e6, maxHp: 5e6,
      hp: 5e6, level: 1, evasion: 0, isBoss: false, vx: 0, vy: 0 };
    game.monsters.push(d);
    return d;
  };
  game.monsters.length = 0; game.hazards.length = 0; game.projectiles.length = 0;

  // --- 1. brand math ---------------------------------------------------------
  const a = dummy(player.x + 300);
  _doomBrandAdd(a, 3);
  out.mulAt3 = _doomBrandMul(a);
  _doomBrandAdd(a, 99);
  out.stacksCapped = a._doomStacks;
  out.mulAtCap = _doomBrandMul(a);
  a._doomUntil = (game.time || 0) - 1;             // force expiry
  out.mulExpired = _doomBrandMul(a);
  out.stacksAfterExpiry = a._doomStacks;

  // --- 2/3. amplifier + tag application in hitMonster -------------------------
  const fresh = dummy(player.x + 300);
  const before1 = fresh.currentHp;
  hitMonster(fresh, 10000, false, 'apoc');          // first apoc hit: no amp yet
  const loss1 = before1 - fresh.currentHp;
  out.brandAfterApoc = fresh.currentHp > 0 ? fresh._doomStacks : -1;
  out.heatAfterApoc = player._calamityHeat | 0;
  const before2 = fresh.currentHp;
  hitMonster(fresh, 10000, false, 'apocSlam');      // second hit: amped by 1 stack
  const loss2 = before2 - fresh.currentHp;
  out.loss1 = loss1; out.loss2 = loss2;
  out.ampRatio = loss1 > 0 ? +(loss2 / loss1).toFixed(3) : 0;   // expect ~1.02
  out.brandAfterSlam = fresh._doomStacks;            // 1 + 2
  out.heatAfterSlam = player._calamityHeat | 0;      // 2 + 4

  // --- 7. NO detonation: kill a branded foe next to a bystander ---------------
  const victim = dummy(player.x + 200); const bystander = dummy(player.x + 230);
  _doomBrandAdd(victim, 10);
  const byHp = bystander.currentHp;
  hitMonster(victim, victim.currentHp * 3, false, 'test');   // lethal
  out.victimDead = victim.currentHp <= 0;
  out.bystanderUntouched = bystander.currentHp === byHp;

  // --- 4/5/6. the ult consumes ------------------------------------------------
  game.monsters.length = 0; game.projectiles.length = 0;
  const b1 = dummy(player.x + 300), b2 = dummy(player.x + 360);
  _doomBrandAdd(b1, 6); _doomBrandAdd(b2, 7);       // 13 on screen; cap is 10
  player._calamityHeat = 0; _doomHeatAdd(100);
  out.heatBeforeUlt = player._calamityHeat | 0;
  const atk = getAtk();
  player._msWin = null;
  SKILL_FNS.doombringer_ult();
  if (typeof _msOpenWindow === 'function') _msOpenWindow('doombringer_ult');  // the cast hook's half
  const w1 = player._msWin;
  out.winFrac = w1 && w1.execute ? +w1.execute.frac.toFixed(3) : null;        // 0.22 + 0.10 = 0.32
  out.winLenFrames = w1 ? Math.round(w1.until - (game.time || 0)) : null;      // ~ (8000+4000)ms in frames
  out.brandsClearedB1 = b1._doomStacks | 0;
  out.brandsClearedB2 = b2._doomStacks | 0;
  out.heatAfterUlt = player._calamityHeat | 0;
  const wave = game.projectiles.find((p) => p && p.doomBrand);
  out.waveFound = !!wave;
  out.waveDamage = wave ? Math.round(wave.damage) : null;
  out.waveExpected = Math.round(atk * 8.0 * 1.5 + 30);

  // 5. table poison check: a fresh window with nothing banked must be 0.22
  player._msWin = null; player._doomWinBonus = null;
  if (typeof _msOpenWindow === 'function') _msOpenWindow('doombringer_ult');
  const w2 = player._msWin;
  out.freshFrac = w2 && w2.execute ? +w2.execute.frac.toFixed(3) : null;
  out.freshLenFrames = w2 ? Math.round(w2.until - (game.time || 0)) : null;

  // --- 8. integration: a real apoc cast on a live dummy -----------------------
  player._msWin = null;
  game.monsters.length = 0; game.projectiles.length = 0;
  player._calamityHeat = 0;
  const tgt = dummy(player.x + player.w / 2 + (player.facing || 1) * 150);
  tgt.y = player.y;                                  // in the cleave band
  SKILL_FNS.doombringer_apoc();
  const t0 = performance.now();
  while (performance.now() - t0 < 2600) { game.paused = false; tgt.y = player.y; tgt.x = player.x + (player.facing || 1) * 150; await frame(); }
  out.integStacks = tgt._doomStacks | 0;
  out.integHeat = player._calamityHeat | 0;
  out.integHp = tgt.currentHp < tgt.maxHp;           // it actually got hit too
  return out;
});
await browser.close();

console.log(`  brand math: x${r.mulAt3} at 3 stacks, cap ${r.stacksCapped} (x${r.mulAtCap}), expired x${r.mulExpired}`);
console.log(`  hits: loss1 ${r.loss1} -> loss2 ${r.loss2} (ratio ${r.ampRatio}); brands ${r.brandAfterApoc}->${r.brandAfterSlam}, heat ${r.heatAfterApoc}->${r.heatAfterSlam}`);
console.log(`  ult: window frac ${r.winFrac} len ${r.winLenFrames}f | fresh ${r.freshFrac} len ${r.freshLenFrames}f | wave ${r.waveDamage} vs expected ${r.waveExpected}`);
console.log(`  integration: stacks ${r.integStacks}, heat ${r.integHeat}, damaged ${r.integHp}`);

check(Math.abs(r.mulAt3 - 1.06) < 1e-9, 'three stacks read as +6% damage taken', r.mulAt3);
check(r.stacksCapped === 10 && Math.abs(r.mulAtCap - 1.2) < 1e-9, 'stacks cap at 10 (+20%)', { stacks: r.stacksCapped, mul: r.mulAtCap });
check(r.mulExpired === 1 && r.stacksAfterExpiry === 0, 'expired brands read as x1 and clear', { mul: r.mulExpired, stacks: r.stacksAfterExpiry });
check(r.brandAfterApoc === 1 && r.brandAfterSlam === 3, 'apoc brands +1 and the slam +2 (1+2=3)', { afterApoc: r.brandAfterApoc, afterSlam: r.brandAfterSlam });
check(r.heatAfterSlam === 6, 'heat stokes +2 on a cleave hit, +4 on a slam hit', { afterApoc: r.heatAfterApoc, afterSlam: r.heatAfterSlam });
check(r.ampRatio >= 1.005 && r.ampRatio <= 1.06, 'the second hit is amplified by the first hit\'s brand (~x1.02), not by its own', r.ampRatio);
check(r.victimDead && r.bystanderUntouched, 'NO detonation: a branded kill leaves the neighbour untouched', { dead: r.victimDead, untouched: r.bystanderUntouched });
check(r.winFrac === 0.32, 'the ult consumed brands: execute threshold 22% -> 32%, capped at 10 stacks (13 were on screen)', r.winFrac);
check(r.winLenFrames > r.freshLenFrames + 200, 'the window is genuinely longer (+4s at cap)', { boosted: r.winLenFrames, fresh: r.freshLenFrames });
// Post-cast stacks are NOT a consumption failure: the ult's own melee cleave
// brands what it hits (+1), seeding the next cycle. The 0.32 threshold above
// already proves the pre-cast 13 were eaten; here we only require the old
// 6/7 piles to be gone, leaving at most the cleave's fresh +1 (+wave brands).
check(r.brandsClearedB1 <= 2 && r.brandsClearedB2 <= 2, 'pre-cast brand piles were consumed (only the ult\'s own fresh seeds remain)', [r.brandsClearedB1, r.brandsClearedB2]);
check(r.heatBeforeUlt === 100 && r.heatAfterUlt === 0, 'the whole heat meter is spent', { before: r.heatBeforeUlt, after: r.heatAfterUlt });
check(r.waveFound && Math.abs(r.waveDamage - r.waveExpected) <= 2, 'the first blade-wave carries x1.5 damage at 100 heat', { got: r.waveDamage, want: r.waveExpected });
check(r.freshFrac === 0.22, 'THE TABLE IS NOT POISONED: the very next window is back to 22%', r.freshFrac);
check(r.integStacks >= 3 && r.integHeat >= 6, 'a real Blade of Calamity cast brands the target and stokes heat', { stacks: r.integStacks, heat: r.integHeat });
check(r.integHp === true, 'and the cast actually dealt damage (the harness is not measuring a statue)', r.integHp);
check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
