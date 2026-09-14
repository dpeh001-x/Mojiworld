// Diagonal Slash on a mage fires ONE bolt.
// ============================================================================
// Per user, reported twice now: "if u equip the diagonal attack boon on mage,
// ur basic attack fires 3 projectiles" (v0.29.921, answered "working as
// designed") and then "mage + diagonal attack boon not fixed yet".
//
//   1. FRAMES RAN: the sim actually stepped (the boot gate is open)
//   2. ONE BOLT AT EVERY ROLL: min, mid and max rolls each fire exactly one
//      projectile (previous build: three at every roll)
//   3. IT FLIES LEVEL: the surviving bolt has no vertical velocity - the fan
//      existed only to aim the two bolts that are gone
//   4. FULL DAMAGE: per hit the boon costs nothing (previous build: x0.55,
//      a 45% cut to the mage's basic for equipping an epic unique)
//   5. REACH STILL SCALES: life grows with the roll, the half of the tooltip
//      v0.29.921 correctly added - this must not be lost undoing the rest
//   6. HITS HIGH & LOW: the hit band opens with the roll, the melee branch's
//      0.55 + roll factor, and stays INSIDE the drawn orb so it never claims
//      reach the art does not show
//   7. CONTROL - MELEE IS UNTOUCHED: a warrior's basic still widens its swing,
//      so this did not fix the caster by breaking the class it already worked on
// Run: node scripts/mage_diag_test.mjs   (MOJI_GAME_FILE=... for a baseline)
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawn } from 'node:child_process';
const ROOT = 'C:/Users/dpeh0/Mojiworld';
const require = createRequire(import.meta.url);
const { chromium } = require(ROOT + '/node_modules/playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 12869);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1200));
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 240) });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(11000);
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
  for (let i = 0; i < 30; i++) {
    for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) await click(sel, 1000);
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => ({ p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive }));
    if (st.p === false && !st.pro) break;
  }
  // .fade is what the boot gate waits for: without it the loop spins without ever stepping the sim
  await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) { o.classList.add('fade'); o.style.display = 'none'; } });

  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = {};
    const t0 = game.time, w0 = performance.now();
    while (game.time - t0 < 30 && performance.now() - w0 < 9000) await sleep(30);
    out.framesRan = game.time - t0;

    player.mods = player.mods || {};
    // performBolt IS the mage basic: SKILL_DEFS.magicBolt is slot 'd', the only
    // slot-'d' skill for the class, and SKILL_FNS.magicBolt calls it. Driving it
    // directly keeps the measurement on the boon rather than on cast cadence.
    const fire = (roll) => {
      player.mods.diagSlash = roll;
      game.projectiles.length = 0;
      player.mp = 999;
      performBolt();
      const mine = game.projectiles.filter((p) => p.owner === 'player');
      return {
        n: mine.length,
        vy: mine.map((p) => +(p.vy || 0).toFixed(2)),
        h: mine.map((p) => p.h),
        life: mine.map((p) => p.life),
        dmg: mine.map((p) => Math.round(p.damage)),
      };
    };
    out.off = fire(0);
    out.min = fire(0.45);
    out.mid = fire(0.70);
    out.max = fire(0.95);

    // The drawn orb: sw = max(p.w,18) * 3.2 for skill 'bolt'. The hit band must
    // stay inside it, so the boon never claims reach the art does not show.
    out.spriteSide = Math.max(20, 18) * 3.2;

    // CONTROL: the melee branch still reads the boon. MEASURE THE HITBOX rather
    // than whether a live mob took damage. The first draft did the latter and was
    // flaky for reasons that had nothing to do with the code under test - which
    // monster the zone happened to spawn, how tall it was, and a per-mob hit
    // cooldown between the two swings. It passed locally and failed on a fresh
    // boot, which is the signature of a test measuring its environment.
    //
    // performMelee builds one hitbox and passes it to aabb() as the first
    // argument, once per live monster. So: put a synthetic monster in the list
    // to guarantee the loop body runs, stub aabb to CAPTURE that box and return
    // false (no hitMonster call, no damage, no side effects at all), swing twice,
    // and compare. No dependence on level, spawns, positions or cooldowns.
    const wasCls = player.cls;
    let melee = 'not measured';
    try {
      player.cls = 'warrior'; player.facing = 1;
      const fake = { currentHp: 100, maxHp: 100, x: player.x + player.w + 30, y: player.y, w: 30, h: 30, vx: 0, vy: 0, type: 'slime' };
      game.monsters.push(fake);
      const realAabb = window.aabb;
      const boxes = [];
      window.aabb = function (a) { boxes.push({ w: Math.round(a.w), h: Math.round(a.h) }); return false; };
      const boxAt = (roll) => {
        player.mods.diagSlash = roll;
        boxes.length = 0;
        try { performMelee(137, 1.10, { basic: true, tall: 10 }); } catch (e) { return null; }
        return boxes[0] || null;
      };
      const off = boxAt(0);
      const on = boxAt(0.95);
      window.aabb = realAabb;
      const i = game.monsters.indexOf(fake);
      if (i >= 0) game.monsters.splice(i, 1);
      melee = { off, on };
    } catch (e) { melee = 'threw: ' + String(e).slice(0, 70); }
    player.cls = wasCls;
    player.mods.diagSlash = 0;
    out.melee = melee;
    return out;
  });

  const L = ['off', 'min', 'mid', 'max'];
  for (const k of L) console.log(`  ${k.padEnd(4)} n=${R[k].n}  vy=${JSON.stringify(R[k].vy)}  h=${JSON.stringify(R[k].h)}  life=${JSON.stringify(R[k].life)}  dmg=${JSON.stringify(R[k].dmg)}`);
  console.log(`  drawn orb ${R.spriteSide}px | melee control ${JSON.stringify(R.melee)} | frames ${R.framesRan}`);

  const counts = L.map((k) => R[k].n);
  ok('FRAMES RAN: the sim actually stepped', (R.framesRan | 0) > 10, `${R.framesRan} frames`);
  ok('ONE BOLT AT EVERY ROLL: the basic never multiplies',
    counts.every((n) => n === 1),
    `counts ${JSON.stringify(counts)} for rolls 0/0.45/0.70/0.95 (previous build: 1,3,3,3)`);
  ok('IT FLIES LEVEL: the surviving bolt has no vertical velocity',
    L.every((k) => R[k].vy.every((v) => v === 0)),
    `vy ${JSON.stringify(L.map((k) => R[k].vy))}`);
  ok('FULL DAMAGE: the boon costs nothing per hit',
    R.max.dmg[0] === R.off.dmg[0] && R.min.dmg[0] === R.off.dmg[0],
    `${R.off.dmg[0]} unequipped vs ${R.max.dmg[0]} at a max roll (previous build: ${Math.round(R.off.dmg[0] * 0.55)}, a 45% cut)`);
  ok('REACH STILL SCALES: bolt life grows with the roll',
    R.min.life[0] > R.off.life[0] && R.mid.life[0] > R.min.life[0] && R.max.life[0] > R.mid.life[0],
    `life ${L.map((k) => R[k].life[0]).join(' -> ')}`);
  ok('HITS HIGH & LOW: the hit band opens with the roll, and stays inside the orb',
    R.min.h[0] > R.off.h[0] && R.max.h[0] > R.mid.h[0] && R.max.h[0] <= R.spriteSide,
    `h ${L.map((k) => R[k].h[0]).join(' -> ')} against a ${R.spriteSide}px drawn orb`);
  ok('CONTROL — MELEE IS UNTOUCHED: the warrior basic hitbox still grows with the boon',
    R.melee && R.melee.off && R.melee.on && R.melee.on.w > R.melee.off.w && R.melee.on.h > R.melee.off.h,
    R.melee && R.melee.off
      ? `swing box ${R.melee.off.w}x${R.melee.off.h} unequipped -> ${R.melee.on.w}x${R.melee.on.h} at a max roll`
      : JSON.stringify(R.melee));
} finally { await browser.close().catch(() => {}); server.kill(); }
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
