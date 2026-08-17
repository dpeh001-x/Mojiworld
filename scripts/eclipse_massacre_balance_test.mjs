// Eclipse Massacre stays the best screen clear without being absurd.
//
// Per user: "Eclipse Massacre may be too broken, easily the best screen clear
// in the entire game, nerf it a little."
//
// Measured against the other master screen-clears on one 8-dummy stage, it was
// putting out ~636 damage per second of cooldown against 240-262 for Meteor
// Shower, Blade of Calamity and Prismatic Cascade — about 2.5x the field, on
// the shortest cooldown of the group (12s vs 15-32s).
//
// What this measures, and why it measures THAT: cast totals are useless for
// regression bounds here. The same unmodified build produced medians of 502
// and 901 xATK across two batches of seven casts, because a total folds in
// crit variance over ~80 hits, how many dummies stayed on screen, and
// knockback. A single dagger's damage is the exact quantity the nerf changes,
// and the mean over ~450 of them is tight enough to bound.
// Run: node scripts/eclipse_massacre_balance_test.mjs [file.html]
// Negative control: the pre-nerf build measures ~1.49 xATK per dagger and
// fails the ceiling below.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof SKILL_FNS !== 'undefined', { timeout: 90000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
});
await page.waitForTimeout(4500);

const r = await page.evaluate(async () => {
  const frame = () => new Promise((res) => requestAnimationFrame(res));
  const out = {};
  player.cls = 'rogue'; player.job = 'assassin'; player.master = 'nightreaper';
  player.level = 90; player._god = true;
  player.hp = player.maxHp = 5e5; player.mp = player.maxMp = 5e5;
  const def = SKILLS.nightreaper_mark || {};
  out.cd = def.cd; out.mp = def.mp;
  const combat = Object.keys(MAPS).find((k) => MAPS[k] && !MAPS[k].isTown && !MAPS[k].isBossArena
    && (MAPS[k].platforms || []).some((p) => p.type === 'ground'));
  loadMap(combat);
  for (let i = 0; i < 45; i++) await frame();
  game.paused = false;
  const gy = (game.mapData.platforms || []).filter((p) => p.type === 'ground')[0].y;
  const flat = Object.keys(monsterTypes).find((k) => !monsterTypes[k].boss);

  const dagger = [], nova = [];
  const orig = window.hitMonster;
  window.hitMonster = function (m, d, crit, sk) {
    if (sk === 'dagger') dagger.push(d);
    else if (sk === 'eclipse_snap') nova.push(d);
    return orig.apply(this, arguments);
  };
  let atk = 0, everyoneHit = true, mobCount = 0;
  for (let c = 0; c < 6; c++) {
    game.monsters = []; game.projectiles = []; game.smoothFx = [];
    player.x = 900; player.y = gy - player.h; player.facing = 1; player.vx = 0;
    player.mp = player.maxMp;
    const mobs = [];
    for (let i = 0; i < 8; i++) {
      const m = spawnMonster(700 + i * 60, gy - monsterTypes[flat].h, flat);
      if (m) { m.maxHp = m.currentHp = 5e9; m.def = 0; mobs.push(m); }
    }
    mobCount = mobs.length;
    for (let i = 0; i < 6; i++) await frame();
    atk = getAtk();
    const hp0 = mobs.map((m) => m.currentHp);
    SKILL_FNS.nightreaper_mark();
    for (let i = 0; i < 200; i++) {
      mobs.forEach((m, k) => { m.x = 700 + k * 60; m.vx = 0; m.vy = 0; });
      await frame();
    }
    // it is a SCREEN CLEAR: every dummy on camera must have been hit
    if (mobs.some((m, i) => hp0[i] - m.currentHp <= 0)) everyoneHit = false;
  }
  window.hitMonster = orig;
  const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  out.atk = Math.round(atk);
  out.mobCount = mobCount;
  out.daggerN = dagger.length;
  out.daggerMean = +(mean(dagger) / Math.max(1, atk)).toFixed(3);
  out.novaN = nova.length;
  out.novaMean = +(mean(nova) / Math.max(1, atk)).toFixed(2);
  out.everyoneHit = everyoneHit;
  return out;
});
await browser.close();

console.log(`  ATK ${r.atk}, 6 casts on ${r.mobCount} dummies`);
console.log(`  dagger: ${r.daggerN} hits, mean ${r.daggerMean} xATK   nova: ${r.novaN} hits, mean ${r.novaMean} xATK`);
console.log(`  cooldown ${r.cd}ms, mp ${r.mp}`);

check(r.daggerN >= 300, 'enough dagger hits sampled for the mean to be tight', r.daggerN);
// Pre-nerf measured 1.486 xATK; the nerfed rain measures ~1.18.
check(r.daggerMean < 1.30, 'the dagger rain is nerfed below its old per-hit damage', r.daggerMean);
// ...but it is a trim, not a gutting. The user asked for "a little".
check(r.daggerMean > 0.85, 'and NOT gutted — it is still a heavy per-hit multiplier', r.daggerMean);
// The snap is the payoff moment and was deliberately left alone.
// Sample count varies with how many dummies survive to the snap (32-40 seen),
// so the assertion is on the per-hit MEAN, which is the quantity left alone.
check(r.novaN >= 20 && r.novaMean > 4.0, 'the aftershock nova is untouched — the payoff still lands', { n: r.novaN, mean: r.novaMean });
check(r.everyoneHit, 'it is still a SCREEN CLEAR: every enemy on camera takes damage', r.everyoneHit);
// mp is NOT asserted against a literal: the SKILLS table says 55 but reads 69
// at runtime (something rescales it on load), so a literal here would pin a
// number this change never touched.
check(r.cd === 12000, 'the cooldown is unchanged — the nerf is to output, not access', { cd: r.cd, mp: r.mp });
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
