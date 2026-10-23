// Soul Drain ends with a down / a death and keeps its cadence through a pause; the Boss Rush roster skips the Tower bosses (fix-sd-downed, fix-sd-pause, fix-rush-tower).
//   node scripts/soul_drain_down_rush_test.mjs      (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>)
// Bug hunt on v0.30.1874: (1) a hero DOWNED mid-drain kept _sdLeft = 10: the violet aura and the SOUL DRAIN icon stayed up, the buff-bar timer fell, and a revive resumed the drain
// (the changelog says it "ends if you die"); (2) _sdNextAt is a game.time deadline that the pause shift did not carry, so a menu advanced the cadence and a tick fired at once on close;
// (3) Boss Rush echoes of towerArbiter / towerSovereign (seen once you enter the Tower) were their placeholder rows - 19k / 99k HP - and sorted first.
// Runs the real loop on a paused Playwright clock (page.clock), so it does not depend on machine load.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '15990';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const env = { ...process.env }; delete env.MOJI_GAME_FILE;
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errs = []; const R = {};
try {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.clock.install();
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxSoulDrainApply === 'function' && typeof _bossRushRoster === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; window._prologueAfterCreation = false; window._lxAwaitingCreation = false; window._lxInWorld = true;
    player._tutorialSeen = true; applyClass('warrior'); player.level = 60; player.hp = getMaxHp(); player.mp = getMaxMp();
    for (const k of Object.keys(STORY_BEATS)) (player._storyBeatsSeen = player._storyBeatsSeen || {})[k] = true;
    loadMap('town'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
  });
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1500);
  const run = (ms) => page.clock.runFor(ms);
  const clear = () => page.evaluate(() => { for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'dialog', 'everdawn-welcome-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; } game.paused = false; player._downed = false; game.dying = 0; player._god = false; player.invulnerable = 0; player.hp = getMaxHp(); });
  await run(1500); await clear();
  const snap = () => page.evaluate(() => ({ hp: Math.round(player.hp), sd: player._sdLeft | 0, buff: (player.buffs && player.buffs.soulDrain) | 0, down: !!player._downed, dying: !!game.dying, toNext: (player._sdNextAt | 0) - (game.time | 0), t: game.time | 0, max: getMaxHp() }));

  // (2) a pause card: the cadence holds
  await page.evaluate(() => { _lxSoulDrainApply(); });
  await run(300);
  R.p0 = await snap();
  await page.evaluate(() => { game.paused = true; });
  await run(3000);
  R.p1 = await snap();
  await page.evaluate(() => { game.paused = false; });
  await run(100);
  R.p2 = await snap();

  // (1) a down ends the drain, and a stand-up does not bring it back
  await page.evaluate(() => { game.paused = false; player.hp = getMaxHp(); player._sdLeft = 0; });
  await run(100); await clear();
  await page.evaluate(() => { _lxSoulDrainApply(); });
  await run(500);
  R.d0 = await snap();
  await page.evaluate(() => { player.invulnerable = 0; player.hp = 0; });   // a lethal hit: the loop routes it to the solo downed beat
  await run(1500);
  R.d1 = await snap();
  await run(3000);
  R.d2 = await snap();
  await page.evaluate(() => { player._downed = false; player.hp = Math.floor(getMaxHp() * 0.5); player.invulnerable = 0; });   // a stand-up / partner revive
  await run(3500);
  R.d3 = await snap();

  // (3) the rush roster
  R.roster = await page.evaluate(() => {
    game.mojidexSeen = game.mojidexSeen || {};
    for (const t in monsterTypes) if (monsterTypes[t] && monsterTypes[t].boss) game.mojidexSeen[t] = 1;
    const r = _bossRushRoster();
    const lv = r.map((t) => monsterTypes[t].level || 0);
    return { n: r.length, tower: r.filter((t) => t === 'towerArbiter' || t === 'towerSovereign'), noLevel: r.filter((t) => !(monsterTypes[t].level > 0)),
      sorted: lv.every((v, i) => i === 0 || v >= lv[i - 1]), has: ['king', 'kingKrook', 'zodiac_aries', 'gravitos'].filter((t) => r.indexOf(t) >= 0), first: r[0] };
  });

  // (1b) a real death (no downed beat): the drain ends at once, before the death screen has even faded
  await page.evaluate(() => { game.mojidexSeen = {}; });
  await clear(); await run(100);
  await page.evaluate(() => { _lxSoulDrainApply(); player._noDownUntil = performance.now() + 60000; });
  await run(200);
  R.k0 = await snap();
  await page.evaluate(() => { player.invulnerable = 0; player.hp = 0; });
  await run(300);
  R.k1 = await snap();
} finally { await browser.close(); srv.kill(); }

check(R.p0 && R.p0.sd === 10 && R.p0.toNext > 10, 'pause: Soul Drain is running with a tick still ahead', R.p0);
const dp = R.p1 && R.p0 ? R.p1.toNext - R.p0.toNext : null;
check(R.p1 && R.p1.t - R.p0.t > 150 && Math.abs(dp) <= 2, 'pause: a 3 s menu leaves the time to the next tick where it was (the deadline is carried with the clock)', { before: R.p0, during: R.p1 });
check(R.p1 && R.p1.sd === 10 && R.p1.hp === R.p0.hp, 'pause: nothing ticked while the menu was open', R.p1);
check(R.p2 && R.p2.sd === 10 && R.p2.hp === R.p0.hp, 'pause: closing the menu does not fire a tick at once (the tick is still ~0.5 s away)', { after: R.p2, before: R.p0 });

check(R.d0 && R.d0.sd > 0 && !R.d0.down && R.d0.buff > 0, 'down: Soul Drain is running before the hit', R.d0);
check(R.d1 && R.d1.down && R.d1.hp === 1, 'down: the lethal hit puts the hero in the downed beat at 1 HP', R.d1);
check(R.d1 && R.d1.sd === 0 && R.d1.buff === 0, 'down: being downed ends Soul Drain (aura + icon + buff-bar timer all read _sdLeft)', R.d1);
check(R.d2 && R.d2.sd === 0 && R.d2.buff === 0, 'down: it stays ended for the whole downed window', R.d2);
check(R.d3 && !R.d3.down && R.d3.sd === 0 && R.d3.hp >= Math.floor(R.d3.max * 0.5), 'down: a stand-up does not resume the drain (HP did not fall)', R.d3);

check(R.k0 && R.k0.sd > 0 && !R.k0.down, 'death: Soul Drain is running before the hit', R.k0);
check(R.k1 && R.k1.dying && !R.k1.down && R.k1.sd === 0 && R.k1.buff === 0, 'death: a real death ends Soul Drain at once', R.k1);

check(R.roster && R.roster.tower.length === 0, 'rush: towerArbiter and towerSovereign are not in the roster even when seen (placeholder rows, re-based only inside the Tower)', R.roster);
check(R.roster && R.roster.noLevel.length === 0, 'rush: every echo in the roster has a real level to scale from', R.roster);
check(R.roster && R.roster.sorted && R.roster.first === 'king', 'rush: the ladder runs weakest to strongest and starts at the King', R.roster);
check(R.roster && R.roster.has.length === 4, 'rush: the real bosses are all still there', R.roster);
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${total - bad}/${total} checks passed`);
process.exit(bad ? 1 : 0);
