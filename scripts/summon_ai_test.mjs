// Necromancer undead against tall targets: do they land hits, or just hop?
// ============================================================================
// Per user: "work on the summons, especially for necromancer, they seem to be
// jumping at gravitos but not dealing damage, make the summons AI smarter".
//
// Three undead (raiseMinion, the Dark Pulse / warlock summon) are raised beside
// one pinned, healed-every-frame target with its contact damage zeroed, and
// watched for SECS x 60 GAME FRAMES (not wall-clock seconds - headless, Gravitos's
// draw cost can drop the page to ~11 fps, and minions walk per frame, so a
// wall-clock window measured the machine, not the AI) with a god-mode player standing by. Every minion
// swing is counted through hitMonster (tag 'minion'), with the damage that
// landed, and every jump is counted from the jump stamp.
//   GRAVITOS     340 x 380, floor-bound, held inert (patterns off)
//   TALL MOB     a regular monster over 100 px tall on the same floor
//   NORMAL MOB   a small monster on the same floor (control)
//   LEDGE MOB    a small monster standing on a platform above (control: they
//                must still jump when the target really is above them)
// Prints the measurements; with ASSERT=1 also checks them.
// Run: node scripts/summon_ai_test.mjs
//      MOJI_GAME_FILE=_prev.html node scripts/summon_ai_test.mjs   (baseline)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const SECS = Number(process.env.SECS || 8);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 240) });

const PORT = Number(process.env.PORT || 12211);
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

const R = await page.evaluate(async (SECS) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = { scen: {} };
  const skipIntro = () => { for (const id of ['boss-intro-skip', 'plg-skip', 'tut-skip']) { const b = document.getElementById(id); if (b && b.offsetParent) try { b.click(); } catch (e) {} } game.paused = false; };
  // tallest regular monster on a normal floor, for the TALL row
  const tallType = (() => {
    let best = null;
    for (const k in monsterTypes) { const t = monsterTypes[k]; if (!t || t.boss || t.superBoss || t.flies || !(t.h > 100) || t.h > 180) continue; if (!best || t.h > monsterTypes[best].h) best = k; }
    return best || 'towerWarden';
  })();
  out.tallType = tallType + ' ' + (monsterTypes[tallType] || {}).w + 'x' + (monsterTypes[tallType] || {}).h;
  const run = async (key, type, place) => {
    try { loadMap('forest'); } catch (e) { out.err = String(e); return; }
    skipIntro(); player._god = true; player.level = 80; player.baseAcc = 900;   // the level-gap miss roll must not stand in for the AI
    await sleep(1200); skipIntro();
    game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0; game.minions = [];
    const floorY = (game.mapData.platforms || []).filter((p) => p.type === 'ground').reduce((a, p) => Math.max(a, p.y), 0) || (player.y + player.h);
    player.x = 300; player.y = floorY - player.h; player.vx = 0; player.vy = 0;
    const m = spawnMonster(player.x + 360, floorY - 60, type, !!(monsterTypes[type] || {}).boss);
    if (!m) { out.scen[key] = { err: 'no spawn ' + type }; return; }
    await sleep(600); skipIntro();
    const spot = place(m, floorY);
    if (!spot) { out.scen[key] = { err: 'no spot' }; return; }
    const pin = () => {
      m.x = spot.x; m.y = spot.y; m.vx = 0; m.vy = 0; m.speed = 0; m.atk = 0;
      m.currentHp = m.maxHp; m.stunTimer = 0;
      if (m.type === 'gravitos') { m.patternState = 'idle'; m.patternTimer = 0; m._instaTimer = 99999; m._rainTimer = 99999; m._soulTimer = 99999; m._ohkoQueued = null; m._ohkoWarnUntil = null; m._sgSpawned = false; }
      game.hazards.length = 0; for (let i = game.projectiles.length - 1; i >= 0; i--) if (game.projectiles[i].owner !== 'player') game.projectiles.splice(i, 1);
      player.hp = getMaxHp(); player.x = 300; player.vx = 0;
      for (const o of game.monsters) if (o !== m) o.currentHp = 0;
    };
    pin();
    for (let k = 0; k < 3; k++) raiseMinion(spot.x - 120 - k * 26, floorY, k % 2 ? 'zombie' : 'skeleton', 60000);
    let swings = 0, landed = 0, landedSwings = 0, jumps = 0, air = 0, samples = 0; const lastJ = new Map();
    for (const mn of game.minions) lastJ.set(mn, mn._jumpUntil || 0);
    const _oh = hitMonster;
    hitMonster = function (tm, dmg, crit, skill) {
      const hp0 = tm ? tm.currentHp : 0; const r = _oh.apply(this, arguments);
      if (tm === m && skill === 'minion') { swings++; if (hp0 > tm.currentHp) { landed += hp0 - tm.currentHp; landedSwings++; } }
      return r;
    };
    const t0 = performance.now(), g0 = game.time | 0;
    while (((game.time | 0) - g0) < SECS * 60 && performance.now() - t0 < 90000) {   // a game-frame window, wall-capped
      pin(); skipIntro();
      await sleep(16);
      for (const mn of game.minions) {
        samples++;
        if (!mn.onGround) air++;
        const j = mn._jumpUntil || 0;
        if (j && j !== lastJ.get(mn)) { jumps++; lastJ.set(mn, j); }
      }
    }
    hitMonster = _oh;
    const gap = game.minions.length ? Math.round(game.minions.reduce((a, mn) => a + Math.abs((mn.x + mn.w / 2) - (m.x + m.w / 2)), 0) / game.minions.length) : null;
    out.scen[key] = { target: m.type + ' ' + m.w + 'x' + m.h, minions: game.minions.length, swings, landedSwings, landed: Math.round(landed), jumps, airPct: +(100 * air / Math.max(1, samples)).toFixed(0), meanDx: gap,
                      standsAt: Math.round(spot.y + m.h), floorY: Math.round(floorY),
                      frames: (game.time | 0) - g0, fps: Math.round(((game.time | 0) - g0) / Math.max(0.001, (performance.now() - t0) / 1000)) };
  };
  await run('gravitos', 'gravitos', (m, floorY) => ({ x: player.x + 420, y: floorY - m.h }));
  await run('tall', tallType, (m, floorY) => ({ x: player.x + 380, y: floorY - m.h }));
  await run('normal', 'slime', (m, floorY) => ({ x: player.x + 380, y: floorY - m.h }));
  await run('ledge', 'slime', (m, floorY) => {
    const p = (game.mapData.platforms || []).filter((q) => q.type !== 'ground' && q.y < floorY - 70 && q.y > floorY - 150 && q.w >= 80)
      .sort((a, b) => Math.abs((a.x + a.w / 2) - 700) - Math.abs((b.x + b.w / 2) - 700))[0];
    if (!p) return null;
    player.x = Math.max(40, p.x + p.w / 2 - 300);
    return { x: p.x + p.w / 2 - m.w / 2, y: p.y - m.h, plat: p };
  });
  return out;
}, SECS);
await browser.close(); server.kill();

if (R.err) console.log('  err ' + R.err);
console.log('  tall type: ' + R.tallType);
for (const k of ['gravitos', 'tall', 'normal', 'ledge']) console.log(`  ${k.padEnd(9)} ${JSON.stringify(R.scen[k])}`);
// Baseline (v0.30.621 at Lv 1; see the changelog for the Lv-80 run): Gravitos 7 swings / 11 jumps /
// 73% airborne; slime 20 swings (one minion of three).
const S = R.scen || {}; const g = S.gravitos || {}, t = S.tall || {}, n = S.normal || {}, l = S.ledge || {};
ok('GRAVITOS: the undead swing at his body (at least 30 swings in 8 s) and land hits', g.swings >= 30 && g.landedSwings >= 10, `${g.swings} swings, ${g.landedSwings} landed, ${g.landed} damage`);
ok('GRAVITOS: they stop hopping at him (at most 3 jumps, under 25% airborne)', g.jumps <= 3 && g.airPct < 25, `${g.jumps} jumps, ${g.airPct}% airborne`);
ok('TALL MONSTER: swings land on a 100+ px monster on the same floor', t.swings >= 30 && t.landedSwings >= 10, `${t.target}: ${t.swings} swings, ${t.landedSwings} landed`);
ok('FLANKERS: all three swing at a small target (at least 40 swings)', n.swings >= 40, `${n.swings} swings (one minion alone manages ~20)`);
ok('CONTROL: they still jump for a target standing on a ledge, and hit it', l.jumps >= 1 && l.swings >= 10, `${l.jumps} jumps, ${l.swings} swings`);
if (process.env.ASSERT === '1') {
  let bad = 0;
  for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
  console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
  process.exit(bad ? 1 : 0);
}
